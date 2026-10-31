import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

function httpError(message:string,statusCode:number){ return Object.assign(new Error(message),{statusCode}); }

async function assertHouseholdManager(client:PoolClient,householdId:string,actorUserId:string){
  const result=await client.query(
    `SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE' LIMIT 1`,
    [householdId,actorUserId],
  );
  if(!result.rowCount || !['HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN','CAREGIVER'].includes(String(result.rows[0].role))){
    throw httpError('HOUSEHOLD_LOCATION_MANAGEMENT_DENIED',403);
  }
}

async function assertPetManager(client:PoolClient,petId:string,actorUserId:string){
  const result=await client.query(`SELECT petos_can_manage_tracking_pet($1,$2) AS allowed`,[petId,actorUserId]);
  if(result.rows[0]?.allowed!==true) throw httpError('PET_LOCATION_MANAGEMENT_DENIED',403);
}

function classifyQuality(accuracyM:number):'HIGH'|'MEDIUM'|'LOW'|'UNKNOWN'{
  if(!Number.isFinite(accuracyM)||accuracyM<0) return 'UNKNOWN';
  if(accuracyM<=20) return 'HIGH';
  if(accuracyM<=60) return 'MEDIUM';
  return 'LOW';
}

function haversineMeters(lat1:number,lon1:number,lat2:number,lon2:number){
  const rad=(v:number)=>v*Math.PI/180;
  const R=6371000;
  const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

export async function registerTrackingDevice(client:PoolClient,input:{
  provider:string;externalDeviceReference:string;deviceType:string;serialNumberMasked:string;displayName:string;model:string;
  supportsBleRecovery?:boolean;supportsRotatingIdentifier?:boolean;supportsLostModeBroadcast?:boolean;supportsRemoteModeChange?:boolean;
}){
  const prior=await client.query(
    `SELECT * FROM tracking_devices WHERE provider=$1 AND external_device_reference=$2 LIMIT 1`,
    [input.provider.toUpperCase(),input.externalDeviceReference],
  );
  if(prior.rowCount) return {device:prior.rows[0],replayed:true};
  const deviceId=`device-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO tracking_devices(
      device_id,device_type,provider,external_device_reference,serial_number_masked,display_name,model,
      operational_status,supports_ble_recovery,supports_rotating_identifier,supports_lost_mode_broadcast,supports_remote_mode_change
    ) VALUES($1,$2,$3,$4,$5,$6,$7,'UNCLAIMED',$8,$9,$10,$11) RETURNING *`,
    [deviceId,input.deviceType,input.provider.toUpperCase(),input.externalDeviceReference,input.serialNumberMasked,input.displayName,input.model,
      input.supportsBleRecovery===true,input.supportsRotatingIdentifier===true,input.supportsLostModeBroadcast===true,input.supportsRemoteModeChange===true],
  );
  return {device:result.rows[0],replayed:false};
}

export async function claimTrackingDevice(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;householdId:string;deviceId:string}){
  await assertHouseholdManager(client,input.householdId,input.actorUserId);
  const scope=`tracking:claim:${input.deviceId}`;
  const requestFingerprint=fingerprint(input);
  const priorIdem=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(priorIdem.rowCount){
    if(priorIdem.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {device:priorIdem.rows[0].response_body,replayed:true};
  }
  const current=await client.query(`SELECT * FROM tracking_devices WHERE device_id=$1 FOR UPDATE`,[input.deviceId]);
  if(!current.rowCount) throw httpError('TRACKING_DEVICE_NOT_FOUND',404);
  if(current.rows[0].household_id && current.rows[0].household_id!==input.householdId) throw httpError('TRACKING_DEVICE_ALREADY_CLAIMED',409);
  const result=await client.query(
    `UPDATE tracking_devices SET household_id=$2,claimed_by=$3,claimed_at=COALESCE(claimed_at,now()),
      operational_status=CASE WHEN operational_status='UNCLAIMED' THEN 'CLAIMED' ELSE operational_status END,updated_at=now()
      WHERE device_id=$1 RETURNING *`,
    [input.deviceId,input.householdId,input.actorUserId],
  );
  const device=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.deviceId,JSON.stringify(device)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TrackingDevice',$2,'TrackingDeviceClaimed',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.deviceId,JSON.stringify({deviceId:input.deviceId,householdId:input.householdId,claimedBy:input.actorUserId})],
  );
  return {device,replayed:false};
}

export async function assignTrackingDevice(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;deviceId:string;petId:string;reason?:string}){
  await assertPetManager(client,input.petId,input.actorUserId);
  const pet=await client.query(`SELECT household_id FROM pets WHERE pet_id=$1 LIMIT 1`,[input.petId]);
  if(!pet.rowCount) throw httpError('PET_NOT_FOUND',404);
  const householdId=String(pet.rows[0].household_id);
  const scope=`tracking:assign:${input.deviceId}:${input.petId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {assignment:prior.rows[0].response_body,replayed:true};
  }
  const device=await client.query(`SELECT * FROM tracking_devices WHERE device_id=$1 FOR UPDATE`,[input.deviceId]);
  if(!device.rowCount) throw httpError('TRACKING_DEVICE_NOT_FOUND',404);
  if(device.rows[0].household_id!==householdId) throw httpError('TRACKING_DEVICE_HOUSEHOLD_MISMATCH',403);

  await client.query(
    `UPDATE tracking_device_assignments SET status='TERMINATED',unassigned_at=now(),unassigned_by=$1,reason=COALESCE(reason,'Reassigned')
      WHERE status='ACTIVE' AND (device_id=$2 OR pet_id=$3)`,
    [input.actorUserId,input.deviceId,input.petId],
  );
  const assignmentId=`tracking-assignment-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO tracking_device_assignments(assignment_id,device_id,pet_id,household_id,assigned_by,reason,status)
     VALUES($1,$2,$3,$4,$5,$6,'ACTIVE') RETURNING *`,
    [assignmentId,input.deviceId,input.petId,householdId,input.actorUserId,input.reason||null],
  );
  await client.query(`UPDATE tracking_devices SET operational_status='ACTIVE',updated_at=now() WHERE device_id=$1`,[input.deviceId]);
  const assignment=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,assignmentId,JSON.stringify(assignment)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TrackingAssignment',$2,'TrackingDeviceAssigned',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,assignmentId,JSON.stringify({assignmentId,deviceId:input.deviceId,petId:input.petId,householdId})],
  );
  return {assignment,replayed:false};
}

export async function startTrackingSession(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;petId:string;sourceContextType:string;sourceContextId?:string;trackingMode:string;
}){
  await assertPetManager(client,input.petId,input.actorUserId);
  const scope=`tracking:session:start:${input.petId}:${input.sourceContextType}:${input.sourceContextId||'none'}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {session:prior.rows[0].response_body,replayed:true};
  }
  const assignment=await client.query(
    `SELECT a.*,d.device_type FROM tracking_device_assignments a JOIN tracking_devices d ON d.device_id=a.device_id
     WHERE a.pet_id=$1 AND a.status='ACTIVE' LIMIT 1`,
    [input.petId],
  );
  if(!assignment.rowCount) throw httpError('ACTIVE_TRACKING_DEVICE_REQUIRED',409);
  const active=await client.query(`SELECT tracking_session_id FROM tracking_sessions WHERE pet_id=$1 AND status='ACTIVE' LIMIT 1`,[input.petId]);
  if(active.rowCount) throw httpError('ACTIVE_TRACKING_SESSION_EXISTS',409);
  const trackingSessionId=`tracking-session-${generateUUIDv7()}`;
  const routeReference=`route-ref-${generateUUIDv7()}`;
  const sourceType=assignment.rows[0].device_type==='PHONE_LOCATION_SOURCE'?'PHONE_LOCATION_SOURCE':'TRACKER_DEVICE';
  const now=new Date().toISOString();
  const result=await client.query(
    `INSERT INTO tracking_sessions(tracking_session_id,pet_id,source_device_id,source_type,source_context_type,source_context_id,status,started_at,tracking_mode,route_reference,created_by)
     VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8,$9,$10) RETURNING *`,
    [trackingSessionId,input.petId,assignment.rows[0].device_id,sourceType,input.sourceContextType,input.sourceContextId||null,now,input.trackingMode,routeReference,input.actorUserId],
  );
  await client.query(
    `INSERT INTO tracking_routes(route_id,pet_id,tracking_session_id,source_context_type,source_context_id,started_at,status,route_reference)
     VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7)`,
    [`route-${generateUUIDv7()}`,input.petId,trackingSessionId,input.sourceContextType,input.sourceContextId||null,now,routeReference],
  );
  const session=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,trackingSessionId,JSON.stringify(session)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TrackingSession',$2,'TrackingSessionStarted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,trackingSessionId,JSON.stringify({trackingSessionId,petId:input.petId,routeReference,sourceContextType:input.sourceContextType,sourceContextId:input.sourceContextId})],
  );
  return {session,replayed:false};
}

export async function completeTrackingSession(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;trackingSessionId:string}){
  const current=await client.query(`SELECT * FROM tracking_sessions WHERE tracking_session_id=$1 FOR UPDATE`,[input.trackingSessionId]);
  if(!current.rowCount) throw httpError('TRACKING_SESSION_NOT_FOUND',404);
  await assertPetManager(client,current.rows[0].pet_id,input.actorUserId);
  if(current.rows[0].status==='COMPLETED') return {session:current.rows[0],replayed:true};
  if(current.rows[0].status!=='ACTIVE') throw httpError('TRACKING_SESSION_NOT_ACTIVE',409);
  const scope=`tracking:session:complete:${input.trackingSessionId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {session:prior.rows[0].response_body,replayed:true};
  }
  const now=new Date().toISOString();
  const result=await client.query(
    `UPDATE tracking_sessions SET status='COMPLETED',ended_at=$2,updated_at=now(),version=version+1 WHERE tracking_session_id=$1 RETURNING *`,
    [input.trackingSessionId,now],
  );
  await client.query(
    `UPDATE tracking_routes SET status='COMPLETED',ended_at=$2,completed_at=$2,duration_seconds=GREATEST(0,EXTRACT(EPOCH FROM ($2::timestamptz-started_at))::int)
      WHERE tracking_session_id=$1`,
    [input.trackingSessionId,now],
  );
  const session=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.trackingSessionId,JSON.stringify(session)],
  );
  return {session,replayed:false};
}

export async function ingestTelemetry(client:PoolClient,input:{
  provider:string;providerEventId:string;sourceDeviceReference:string;sequenceNumber?:number;observedAt:string;
  latitude:number;longitude:number;accuracyM:number;altitudeM?:number;speedMps?:number;headingDegrees?:number;batteryPercent?:number;
  signatureVerified:boolean;sourcePayloadVersion:string;
}){
  const provider=input.provider.toUpperCase();
  const existing=await client.query(
    `SELECT i.*,o.observation_id FROM tracking_ingestion_events i
     LEFT JOIN tracking_location_observations o ON o.ingestion_id=i.ingestion_id
     WHERE i.provider=$1 AND i.provider_event_id=$2 LIMIT 1`,
    [provider,input.providerEventId],
  );
  if(existing.rowCount) return {duplicate:true,ingestionId:existing.rows[0].ingestion_id,observationId:existing.rows[0].observation_id||undefined,status:existing.rows[0].status};
  const ingestionId=`ingestion-${generateUUIDv7()}`;
  const payloadHash=hash(JSON.stringify(input));
  if(!input.signatureVerified){
    await client.query(
      `INSERT INTO tracking_ingestion_events(ingestion_id,provider,provider_event_id,source_device_reference,sequence_number,observed_at,signature_verified,source_payload_version,payload_hash,status,rejection_reason)
       VALUES($1,$2,$3,$4,$5,$6,false,$7,$8,'REJECTED','SIGNATURE_INVALID')`,
      [ingestionId,provider,input.providerEventId,input.sourceDeviceReference,input.sequenceNumber??null,input.observedAt,input.sourcePayloadVersion,payloadHash],
    );
    await client.query(
      `INSERT INTO tracking_dead_letters(dead_letter_id,provider,provider_event_id,source_device_reference,error_classification,error_message,payload_summary)
       VALUES($1,$2,$3,$4,'SIGNATURE_INVALID','Trusted location adapter did not verify provider signature',$5::jsonb)`,
      [`dead-letter-${generateUUIDv7()}`,provider,input.providerEventId,input.sourceDeviceReference,JSON.stringify({observedAt:input.observedAt,sourcePayloadVersion:input.sourcePayloadVersion})],
    );
    throw httpError('TELEMETRY_SIGNATURE_NOT_VERIFIED',401);
  }
  if(!Number.isFinite(input.latitude)||input.latitude<-90||input.latitude>90||!Number.isFinite(input.longitude)||input.longitude<-180||input.longitude>180||!Number.isFinite(input.accuracyM)||input.accuracyM<0){
    throw httpError('TELEMETRY_COORDINATES_INVALID',400);
  }
  const device=await client.query(`SELECT * FROM tracking_devices WHERE provider=$1 AND external_device_reference=$2 LIMIT 1`,[provider,input.sourceDeviceReference]);
  if(!device.rowCount) throw httpError('TRACKING_DEVICE_NOT_FOUND',404);
  const d=device.rows[0];
  const assignment=await client.query(
    `SELECT * FROM tracking_device_assignments WHERE device_id=$1 AND status='ACTIVE' LIMIT 1`,
    [d.device_id],
  );
  if(!assignment.rowCount) throw httpError('TRACKING_DEVICE_NOT_ASSIGNED',409);
  const a=assignment.rows[0];
  const session=await client.query(
    `SELECT * FROM tracking_sessions WHERE pet_id=$1 AND source_device_id=$2 AND status='ACTIVE' ORDER BY started_at DESC LIMIT 1`,
    [a.pet_id,d.device_id],
  );
  const observedAt=new Date(input.observedAt);
  if(Number.isNaN(observedAt.getTime())) throw httpError('TELEMETRY_OBSERVED_AT_INVALID',400);
  const receivedAt=new Date();
  const clockSkewMs=receivedAt.getTime()-observedAt.getTime();
  const flags:string[]=[];
  if(Math.abs(clockSkewMs)>10*60*1000) flags.push('CLOCK_SKEW_EXCESSIVE');
  if(input.accuracyM>100) flags.push('POOR_ACCURACY');
  const quality=classifyQuality(input.accuracyM);

  await client.query(
    `INSERT INTO tracking_ingestion_events(ingestion_id,provider,provider_event_id,source_device_reference,sequence_number,observed_at,received_at,signature_verified,source_payload_version,payload_hash,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,true,$8,$9,'ACCEPTED')`,
    [ingestionId,provider,input.providerEventId,input.sourceDeviceReference,input.sequenceNumber??null,observedAt.toISOString(),receivedAt.toISOString(),input.sourcePayloadVersion,payloadHash],
  );
  const observationId=`location-observation-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO tracking_location_observations(
      observation_id,ingestion_id,pet_id,assignment_id,tracking_session_id,device_id,source_type,source_provider,observed_at,received_at,
      latitude,longitude,accuracy_m,altitude_m,speed_mps,heading_degrees,quality,clock_skew_ms,flags,sequence_number
    ) VALUES($1,$2,$3,$4,$5,$6,'TRACKER_DEVICE',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)`,
    [observationId,ingestionId,a.pet_id,a.assignment_id,session.rows[0]?.tracking_session_id||null,d.device_id,provider,observedAt.toISOString(),receivedAt.toISOString(),
      input.latitude,input.longitude,input.accuracyM,input.altitudeM??null,input.speedMps??null,input.headingDegrees??null,quality,clockSkewMs,JSON.stringify(flags),input.sequenceNumber??null],
  );
  const previous=await client.query(`SELECT * FROM tracking_live_locations WHERE pet_id=$1 FOR UPDATE`,[a.pet_id]);
  let liveAdvanced=false;
  if(!previous.rowCount || observedAt.getTime()>new Date(previous.rows[0].observed_at).getTime()){
    await client.query(
      `INSERT INTO tracking_live_locations(pet_id,latest_observation_id,device_id,tracking_session_id,observed_at,latitude,longitude,accuracy_m,quality,source_type,flags,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'TRACKER_DEVICE',$10::jsonb,now())
       ON CONFLICT(pet_id) DO UPDATE SET latest_observation_id=EXCLUDED.latest_observation_id,device_id=EXCLUDED.device_id,
        tracking_session_id=EXCLUDED.tracking_session_id,observed_at=EXCLUDED.observed_at,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
        accuracy_m=EXCLUDED.accuracy_m,quality=EXCLUDED.quality,source_type=EXCLUDED.source_type,flags=EXCLUDED.flags,updated_at=now()
       WHERE tracking_live_locations.observed_at < EXCLUDED.observed_at`,
      [a.pet_id,observationId,d.device_id,session.rows[0]?.tracking_session_id||null,observedAt.toISOString(),input.latitude,input.longitude,input.accuracyM,quality,JSON.stringify(flags)],
    );
    liveAdvanced=true;
  }
  await client.query(
    `UPDATE tracking_devices SET connectivity_status='ONLINE',battery_percent=COALESCE($2,battery_percent),
      battery_status=CASE WHEN $2 IS NULL THEN battery_status WHEN $2<=10 THEN 'CRITICAL' WHEN $2<=25 THEN 'LOW' ELSE 'NORMAL' END,
      last_seen_at=$3,last_location_at=$4,updated_at=now()
     WHERE device_id=$1`,
    [d.device_id,input.batteryPercent??null,receivedAt.toISOString(),observedAt.toISOString()],
  );

  if(previous.rowCount && liveAdvanced){
    const zones=await client.query(`SELECT * FROM recovery_safe_zones WHERE pet_id=$1 AND is_active`,[a.pet_id]);
    for(const zone of zones.rows){
      const previousDistance=haversineMeters(Number(zone.center_latitude),Number(zone.center_longitude),Number(previous.rows[0].latitude),Number(previous.rows[0].longitude));
      const currentDistance=haversineMeters(Number(zone.center_latitude),Number(zone.center_longitude),input.latitude,input.longitude);
      const radius=Number(zone.radius_meters),buffer=Number(zone.hysteresis_buffer_meters);
      let transitionType:string|undefined;
      if(previousDistance<=Math.max(0,radius-buffer) && currentDistance>radius+buffer) transitionType='EXIT';
      if(previousDistance>radius+buffer && currentDistance<=Math.max(0,radius-buffer)) transitionType='ENTRY';
      if(transitionType){
        const transitionId=`geofence-transition-${generateUUIDv7()}`;
        await client.query(
          `INSERT INTO recovery_geofence_transitions(transition_id,safe_zone_id,pet_id,household_id,observation_id,transition_type,transition_at,suppressed_by_hysteresis)
           VALUES($1,$2,$3,$4,$5,$6,$7,false)`,
          [transitionId,zone.safe_zone_id,a.pet_id,a.household_id,observationId,transitionType,observedAt.toISOString()],
        );
        await client.query(
          `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
           VALUES($1,'SafeZone',$2,'GeofenceTransitionDetected',$3::jsonb)`,
          [`evt-${generateUUIDv7()}`,zone.safe_zone_id,JSON.stringify({transitionId,safeZoneId:zone.safe_zone_id,petId:a.pet_id,transitionType,observationId})],
        );
      }
    }
  }

  if(session.rowCount){
    const sessionId=session.rows[0].tracking_session_id;
    const priorPoint=await client.query(
      `SELECT latitude,longitude,observed_at FROM tracking_location_observations
       WHERE tracking_session_id=$1 AND observation_id<>$2 AND observed_at<$3 ORDER BY observed_at DESC LIMIT 1`,
      [sessionId,observationId,observedAt.toISOString()],
    );
    let delta=0;
    if(priorPoint.rowCount){
      delta=haversineMeters(Number(priorPoint.rows[0].latitude),Number(priorPoint.rows[0].longitude),input.latitude,input.longitude);
      if(delta>5000) flags.push('SUSPECT_JUMP');
    }
    await client.query(
      `UPDATE tracking_routes SET point_count=point_count+1,distance_meters=distance_meters+$2,
        distance_reliability=CASE WHEN $3='HIGH' THEN 'HIGH_CONFIDENCE' WHEN $3='MEDIUM' THEN 'LOW_CONFIDENCE' ELSE distance_reliability END,
        quality_summary=jsonb_build_object(
          'highQualityPoints',COALESCE((quality_summary->>'highQualityPoints')::int,0)+CASE WHEN $3='HIGH' THEN 1 ELSE 0 END,
          'mediumQualityPoints',COALESCE((quality_summary->>'mediumQualityPoints')::int,0)+CASE WHEN $3='MEDIUM' THEN 1 ELSE 0 END,
          'lowQualityPoints',COALESCE((quality_summary->>'lowQualityPoints')::int,0)+CASE WHEN $3='LOW' THEN 1 ELSE 0 END,
          'anomalyCount',COALESCE((quality_summary->>'anomalyCount')::int,0)+$4
        )
       WHERE tracking_session_id=$1`,
      [sessionId,delta,quality,flags.length],
    );
  }
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'LocationObservation',$2,'LocationObservationAccepted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,observationId,JSON.stringify({observationId,petId:a.pet_id,deviceId:d.device_id,trackingSessionId:session.rows[0]?.tracking_session_id||null,observedAt:observedAt.toISOString(),quality,liveAdvanced})],
  );
  return {duplicate:false,ingestionId,observationId,petId:a.pet_id,trackingSessionId:session.rows[0]?.tracking_session_id||undefined,quality,flags,liveAdvanced};
}

export async function getLiveLocation(client:PoolClient,petId:string,actorUserId:string){
  const allowed=await client.query(`SELECT petos_can_access_tracking_pet($1,$2) AS allowed`,[petId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('LIVE_LOCATION_ACCESS_DENIED',403);
  const result=await client.query(
    `SELECT l.*,s.route_reference FROM tracking_live_locations l
     LEFT JOIN tracking_sessions s ON s.tracking_session_id=l.tracking_session_id
     WHERE l.pet_id=$1 LIMIT 1`,
    [petId],
  );
  if(!result.rowCount) throw httpError('LIVE_LOCATION_NOT_AVAILABLE',404);
  const row=result.rows[0];
  const ageMs=Date.now()-new Date(row.observed_at).getTime();
  const freshness=ageMs<=2*60*1000?'LIVE':ageMs<=15*60*1000?'RECENT':ageMs<=60*60*1000?'STALE':'OFFLINE_UNKNOWN';
  return {
    petId:row.pet_id,observationId:row.latest_observation_id,observedAt:new Date(row.observed_at).toISOString(),
    latitude:Number(row.latitude),longitude:Number(row.longitude),accuracyM:Number(row.accuracy_m),quality:row.quality,
    deviceId:row.device_id,trackingSessionId:row.tracking_session_id||undefined,routeReference:row.route_reference||undefined,
    freshness,flags:row.flags||[],
  };
}

export async function getTrackingRoute(client:PoolClient,trackingSessionId:string,actorUserId:string){
  const route=await client.query(`SELECT * FROM tracking_routes WHERE tracking_session_id=$1 LIMIT 1`,[trackingSessionId]);
  if(!route.rowCount) throw httpError('TRACKING_ROUTE_NOT_FOUND',404);
  const allowed=await client.query(`SELECT petos_can_access_tracking_pet($1,$2) AS allowed`,[route.rows[0].pet_id,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRACKING_ROUTE_ACCESS_DENIED',403);
  const points=await client.query(
    `SELECT observation_id,observed_at,latitude,longitude,accuracy_m,quality,flags FROM tracking_location_observations
     WHERE tracking_session_id=$1 ORDER BY observed_at ASC LIMIT 5000`,
    [trackingSessionId],
  );
  return {route:route.rows[0],points:points.rows.map((p:any)=>({...p,latitude:Number(p.latitude),longitude:Number(p.longitude),accuracy_m:Number(p.accuracy_m)}))};
}

// ============================================================================
// TRANSPORT
// ============================================================================

export async function createTransportDriver(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;businessId:string;providerId:string;userId:string;fullName:string;
  phoneNumberMasked:string;drivingLicenseRefMasked:string;approvedServiceTypes:string[];emergencyContactMasked:string;
}){
  const allowed=await client.query(`SELECT petos_can_manage_business($1,$2) AS allowed`,[input.businessId,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRANSPORT_DRIVER_MANAGEMENT_DENIED',403);
  const provider=await client.query(`SELECT 1 FROM provider_profiles WHERE provider_id=$1 AND (primary_business_id=$2 OR primary_business_id IS NULL) LIMIT 1`,[input.providerId,input.businessId]);
  if(!provider.rowCount) throw httpError('TRANSPORT_PROVIDER_BUSINESS_MISMATCH',409);
  const membership=await client.query(`SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active LIMIT 1`,[input.businessId,input.userId]);
  if(!membership.rowCount) throw httpError('TRANSPORT_DRIVER_BUSINESS_MEMBERSHIP_REQUIRED',409);
  const scope=`transport:driver:create:${input.businessId}:${input.userId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {driver:prior.rows[0].response_body,replayed:true};
  }
  const driverProfileId=`transport-driver-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO transport_driver_profiles(
      driver_profile_id,user_id,provider_id,business_id,full_name,phone_number_masked,operational_status,verification_status,
      driving_license_ref_masked,approved_service_types,emergency_contact_masked
     ) VALUES($1,$2,$3,$4,$5,$6,'ACTIVE','PENDING',$7,$8::jsonb,$9) RETURNING *`,
    [driverProfileId,input.userId,input.providerId,input.businessId,input.fullName,input.phoneNumberMasked,input.drivingLicenseRefMasked,JSON.stringify(input.approvedServiceTypes),input.emergencyContactMasked],
  );
  const driver=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,driverProfileId,JSON.stringify(driver)],
  );
  return {driver,replayed:false};
}

export async function verifyTransportDriver(client:PoolClient,input:{actorUserId:string;driverProfileId:string}){
  const current=await client.query(`SELECT * FROM transport_driver_profiles WHERE driver_profile_id=$1 LIMIT 1`,[input.driverProfileId]);
  if(!current.rowCount) throw httpError('TRANSPORT_DRIVER_NOT_FOUND',404);
  const allowed=await client.query(`SELECT petos_can_manage_business($1,$2) AS allowed`,[current.rows[0].business_id,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRANSPORT_DRIVER_VERIFICATION_DENIED',403);
  const result=await client.query(
    `UPDATE transport_driver_profiles SET verification_status='VERIFIED',verified_at=now(),verified_by_user_id=$2,updated_at=now()
     WHERE driver_profile_id=$1 RETURNING *`,
    [input.driverProfileId,input.actorUserId],
  );
  return result.rows[0];
}

export async function createTransportVehicle(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;businessId:string;providerId:string;displayName:string;registrationNumberMasked:string;
  makeModel:string;vehicleType:string;capacity:Record<string,unknown>;sensorCapabilities:string[];lastInspectionDate:string;insuranceValidUntil:string;
}){
  const allowed=await client.query(`SELECT petos_can_manage_business($1,$2) AS allowed`,[input.businessId,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRANSPORT_VEHICLE_MANAGEMENT_DENIED',403);
  const scope=`transport:vehicle:create:${input.businessId}:${input.registrationNumberMasked}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {vehicle:prior.rows[0].response_body,replayed:true};
  }
  const maxPets=Number((input.capacity as any).maxPets);
  if(!Number.isInteger(maxPets)||maxPets<=0) throw httpError('TRANSPORT_VEHICLE_CAPACITY_INVALID',400);
  const vehicleId=`transport-vehicle-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO transport_vehicles(
      vehicle_id,business_id,provider_id,display_name,registration_number_masked,make_model,vehicle_type,operational_status,
      verification_status,capacity,sensor_capabilities,last_inspection_date,insurance_valid_until
     ) VALUES($1,$2,$3,$4,$5,$6,$7,'AVAILABLE','UNVERIFIED',$8::jsonb,$9::jsonb,$10,$11) RETURNING *`,
    [vehicleId,input.businessId,input.providerId,input.displayName,input.registrationNumberMasked,input.makeModel,input.vehicleType,JSON.stringify(input.capacity),JSON.stringify(input.sensorCapabilities),input.lastInspectionDate,input.insuranceValidUntil],
  );
  const vehicle=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,vehicleId,JSON.stringify(vehicle)],
  );
  return {vehicle,replayed:false};
}

export async function verifyTransportVehicle(client:PoolClient,input:{actorUserId:string;vehicleId:string}){
  const current=await client.query(`SELECT * FROM transport_vehicles WHERE vehicle_id=$1 LIMIT 1`,[input.vehicleId]);
  if(!current.rowCount) throw httpError('TRANSPORT_VEHICLE_NOT_FOUND',404);
  const allowed=await client.query(`SELECT petos_can_manage_business($1,$2) AS allowed`,[current.rows[0].business_id,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRANSPORT_VEHICLE_VERIFICATION_DENIED',403);
  const result=await client.query(
    `UPDATE transport_vehicles SET verification_status='VERIFIED',updated_at=now() WHERE vehicle_id=$1 RETURNING *`,
    [input.vehicleId],
  );
  return result.rows[0];
}

async function assertTransportManagerForBooking(client:PoolClient,bookingId:string,actorUserId:string){
  const result=await client.query(
    `SELECT b.*,p.user_id AS provider_user_id,
      EXISTS(SELECT 1 FROM business_memberships bm WHERE bm.business_id=b.business_id AND bm.user_id=$2 AND bm.is_active AND bm.role IN ('OWNER','ADMIN','MANAGER','PROVIDER','STAFF')) AS business_member
     FROM bookings b JOIN provider_profiles p ON p.provider_id=b.provider_id WHERE b.booking_id=$1 LIMIT 1`,
    [bookingId,actorUserId],
  );
  if(!result.rowCount) throw httpError('BOOKING_NOT_FOUND',404);
  const row=result.rows[0];
  if(row.provider_user_id!==actorUserId && row.business_member!==true) throw httpError('TRANSPORT_BOOKING_MANAGEMENT_DENIED',403);
  return row;
}

export async function createTransportTrip(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;bookingId:string;assignedDriverId:string;assignedVehicleId:string;tripType:string;
  stops:Array<{stopType:string;title:string;addressPublicSnippet:string;exactAddressCiphertext?:string;scheduledArrival:string;recipientContactName:string;recipientContactPhoneMasked:string;petIdsBoarding:string[];petIdsExiting:string[]}>;
}){
  const booking=await assertTransportManagerForBooking(client,input.bookingId,input.actorUserId);
  if(!booking.business_id) throw httpError('TRANSPORT_REQUIRES_SERVICE_BUSINESS',409);
  if(!['CONFIRMED','IN_PROGRESS'].includes(String(booking.status))) throw httpError('TRANSPORT_BOOKING_STATUS_INVALID',409);
  if(input.stops.length<2) throw httpError('TRANSPORT_REQUIRES_PICKUP_AND_DROPOFF',400);
  const scope=`transport:trip:create:${input.bookingId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {trip:prior.rows[0].response_body,replayed:true};
  }
  const driver=await client.query(
    `SELECT * FROM transport_driver_profiles WHERE driver_profile_id=$1 AND business_id=$2 AND provider_id=$3 AND operational_status='ACTIVE' AND verification_status='VERIFIED' LIMIT 1`,
    [input.assignedDriverId,booking.business_id,booking.provider_id],
  );
  if(!driver.rowCount) throw httpError('VERIFIED_ACTIVE_TRANSPORT_DRIVER_REQUIRED',409);
  const vehicle=await client.query(
    `SELECT * FROM transport_vehicles WHERE vehicle_id=$1 AND business_id=$2 AND provider_id=$3 AND operational_status='AVAILABLE' AND verification_status='VERIFIED'
      AND insurance_valid_until>=CURRENT_DATE LIMIT 1`,
    [input.assignedVehicleId,booking.business_id,booking.provider_id],
  );
  if(!vehicle.rowCount) throw httpError('VERIFIED_AVAILABLE_TRANSPORT_VEHICLE_REQUIRED',409);
  const petIds=Array.isArray(booking.pet_ids)?booking.pet_ids:[];
  if(!petIds.length) throw httpError('TRANSPORT_BOOKING_PETS_REQUIRED',409);
  const capacity=vehicle.rows[0].capacity||{};
  if(Number(capacity.maxPets||0)<petIds.length) throw httpError('TRANSPORT_VEHICLE_CAPACITY_EXCEEDED',409);
  const tripId=`transport-trip-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO transport_trips(
      trip_id,booking_id,household_id,business_id,provider_id,assigned_driver_id,assigned_vehicle_id,status,trip_type,
      scheduled_pickup_at,scheduled_completion_at,timezone,overall_custody_status
     ) VALUES($1,$2,$3,$4,$5,$6,$7,'SCHEDULED',$8,$9,$10,$11,'OWNER') RETURNING *`,
    [tripId,input.bookingId,booking.household_id,booking.business_id,booking.provider_id,input.assignedDriverId,input.assignedVehicleId,input.tripType,
      input.stops[0].scheduledArrival,input.stops[input.stops.length-1].scheduledArrival,booking.timezone],
  );
  let seq=1;
  const driverUserId=String(driver.rows[0].user_id);
  for(const petId of petIds){
    await client.query(
      `INSERT INTO transport_trip_pets(trip_pet_id,trip_id,pet_id,custody_status,current_custodian_user_id,board_stop_sequence,exit_stop_sequence)
       VALUES($1,$2,$3,'OWNER',$4,1,$5)`,
      [`trip-pet-${generateUUIDv7()}`,tripId,petId,booking.owner_user_id,input.stops.length],
    );
  }
  for(const stop of input.stops){
    if(stop.exactAddressCiphertext && !/^(enc:|vault:)/.test(stop.exactAddressCiphertext)) throw httpError('TRANSPORT_EXACT_ADDRESS_MUST_BE_ENCRYPTED_REFERENCE',400);
    await client.query(
      `INSERT INTO transport_stops(stop_id,trip_id,sequence,stop_type,title,address_public_snippet,exact_address_ciphertext,scheduled_arrival,
        recipient_contact_name,recipient_contact_phone_masked,status,pet_ids_boarding,pet_ids_exiting,required_actions)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11::jsonb,$12::jsonb,'[]'::jsonb)`,
      [`transport-stop-${generateUUIDv7()}`,tripId,seq++,stop.stopType,stop.title,stop.addressPublicSnippet,stop.exactAddressCiphertext||null,stop.scheduledArrival,
        stop.recipientContactName,stop.recipientContactPhoneMasked,JSON.stringify(stop.petIdsBoarding),JSON.stringify(stop.petIdsExiting)],
    );
  }
  await client.query(`UPDATE transport_vehicles SET operational_status='IN_USE',updated_at=now() WHERE vehicle_id=$1`,[input.assignedVehicleId]);
  const trip=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,tripId,JSON.stringify(trip)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TransportTrip',$2,'TransportTripCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,tripId,JSON.stringify({tripId,bookingId:input.bookingId,driverUserId,vehicleId:input.assignedVehicleId,petIds})],
  );
  return {trip,replayed:false};
}

function allowedTripTransition(status:string,next:string){
  const map:Record<string,string[]>={
    SCHEDULED:['READY','CANCELLED'],READY:['DRIVER_EN_ROUTE_TO_PICKUP','CANCELLED'],DRIVER_EN_ROUTE_TO_PICKUP:['ARRIVED_AT_PICKUP','INCIDENT_ACTIVE'],
    ARRIVED_AT_PICKUP:['PICKUP_VERIFICATION','INCIDENT_ACTIVE'],PICKUP_VERIFICATION:['PET_IN_CUSTODY','INCIDENT_ACTIVE'],PET_IN_CUSTODY:['IN_TRANSIT','INCIDENT_ACTIVE'],
    IN_TRANSIT:['STOP_IN_PROGRESS','ARRIVED_AT_DESTINATION','INCIDENT_ACTIVE'],STOP_IN_PROGRESS:['IN_TRANSIT','ARRIVED_AT_DESTINATION','INCIDENT_ACTIVE'],
    ARRIVED_AT_DESTINATION:['HANDOVER_PENDING','INCIDENT_ACTIVE'],HANDOVER_PENDING:['COMPLETED','INCIDENT_ACTIVE'],INCIDENT_ACTIVE:['IN_TRANSIT','ABORTED','CANCELLED'],
  };
  return (map[status]||[]).includes(next);
}

export async function transitionTransportTrip(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;tripId:string;expectedVersion:number;nextStatus:string;reason:string;
}){
  const current=await client.query(`SELECT * FROM transport_trips WHERE trip_id=$1 FOR UPDATE`,[input.tripId]);
  if(!current.rowCount) throw httpError('TRANSPORT_TRIP_NOT_FOUND',404);
  const access=await client.query(`SELECT petos_can_manage_transport_trip($1,$2) AS allowed`,[input.tripId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true) throw httpError('TRANSPORT_TRIP_MANAGEMENT_DENIED',403);
  const row=current.rows[0];
  if(Number(row.version)!==input.expectedVersion) throw httpError('TRANSPORT_TRIP_VERSION_CONFLICT',409);
  if(!allowedTripTransition(row.status,input.nextStatus)) throw httpError('TRANSPORT_TRIP_TRANSITION_INVALID',409);
  if(input.nextStatus==='COMPLETED'){
    const pending=await client.query(`SELECT 1 FROM transport_trip_pets WHERE trip_id=$1 AND custody_status NOT IN ('RECIPIENT','RELEASED') LIMIT 1`,[input.tripId]);
    if(pending.rowCount) throw httpError('TRANSPORT_COMPLETION_REQUIRES_PET_HANDOVER',409);
    const incidents=await client.query(`SELECT 1 FROM transport_incidents WHERE trip_id=$1 AND state NOT IN ('RESOLVED','CLOSED') LIMIT 1`,[input.tripId]);
    if(incidents.rowCount) throw httpError('TRANSPORT_COMPLETION_REQUIRES_INCIDENT_RESOLUTION',409);
  }
  const scope=`transport:trip:transition:${input.tripId}:${input.expectedVersion}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {trip:prior.rows[0].response_body,replayed:true};
  }
  const result=await client.query(
    `UPDATE transport_trips SET status=$2,version=version+1,updated_at=now(),
      actual_pickup_at=CASE WHEN $2='PET_IN_CUSTODY' THEN COALESCE(actual_pickup_at,now()) ELSE actual_pickup_at END,
      actual_completion_at=CASE WHEN $2='COMPLETED' THEN now() ELSE actual_completion_at END
     WHERE trip_id=$1 AND version=$3 RETURNING *`,
    [input.tripId,input.nextStatus,input.expectedVersion],
  );
  if(!result.rowCount) throw httpError('TRANSPORT_TRIP_VERSION_CONFLICT',409);
  if(input.nextStatus==='COMPLETED'){
    await client.query(`UPDATE transport_vehicles SET operational_status='AVAILABLE',updated_at=now() WHERE vehicle_id=$1`,[row.assigned_vehicle_id]);
  }
  const trip=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.tripId,JSON.stringify(trip)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TransportTrip',$2,'TransportTripStatusChanged',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.tripId,JSON.stringify({tripId:input.tripId,from:row.status,to:input.nextStatus,reason:input.reason,version:trip.version})],
  );
  return {trip,replayed:false};
}

export async function transferTransportCustody(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;tripId:string;petId:string;stopId:string;toActorUserId:string;toActorRole:string;verificationMethod:string;verificationProof:string;notes?:string;
}){
  const access=await client.query(`SELECT petos_can_manage_transport_trip($1,$2) AS allowed`,[input.tripId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true) throw httpError('TRANSPORT_CUSTODY_WRITE_DENIED',403);
  const pet=await client.query(`SELECT * FROM transport_trip_pets WHERE trip_id=$1 AND pet_id=$2 FOR UPDATE`,[input.tripId,input.petId]);
  if(!pet.rowCount) throw httpError('TRANSPORT_TRIP_PET_NOT_FOUND',404);
  const stop=await client.query(`SELECT * FROM transport_stops WHERE stop_id=$1 AND trip_id=$2 LIMIT 1`,[input.stopId,input.tripId]);
  if(!stop.rowCount) throw httpError('TRANSPORT_STOP_NOT_FOUND',404);
  const scope=`transport:custody:${input.tripId}:${input.petId}:${input.stopId}`;
  const requestFingerprint=fingerprint({...input,verificationProof:'[REDACTED]'});
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {custody:prior.rows[0].response_body,replayed:true};
  }
  const currentStatus=String(pet.rows[0].custody_status);
  let nextCustody:'DRIVER'|'RECIPIENT'|'RELEASED';
  if(currentStatus==='OWNER') nextCustody='DRIVER';
  else if(currentStatus==='DRIVER') nextCustody='RECIPIENT';
  else if(currentStatus==='RECIPIENT') nextCustody='RELEASED';
  else throw httpError('TRANSPORT_CUSTODY_TRANSITION_INVALID',409);
  const custodyRecordId=`custody-${generateUUIDv7()}`;
  const record={
    custodyRecordId,tripId:input.tripId,petId:input.petId,fromActorUserId:pet.rows[0].current_custodian_user_id,
    toActorUserId:input.toActorUserId,toActorRole:input.toActorRole,stopId:input.stopId,verificationMethod:input.verificationMethod,
    transferredAt:new Date().toISOString(),nextCustody,
  };
  await client.query(
    `INSERT INTO transport_custody_records(custody_record_id,trip_id,pet_id,from_actor_user_id,from_actor_role,to_actor_user_id,to_actor_role,stop_id,transferred_at,verification_method,verification_proof_hash,notes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [custodyRecordId,input.tripId,input.petId,pet.rows[0].current_custodian_user_id,currentStatus,input.toActorUserId,input.toActorRole,input.stopId,record.transferredAt,input.verificationMethod,hash(input.verificationProof),input.notes||null],
  );
  await client.query(
    `UPDATE transport_trip_pets SET custody_status=$3,current_custodian_user_id=$4 WHERE trip_id=$1 AND pet_id=$2`,
    [input.tripId,input.petId,nextCustody,input.toActorUserId],
  );
  const aggregate=await client.query(
    `SELECT CASE
      WHEN BOOL_AND(custody_status IN ('RECIPIENT','RELEASED')) THEN 'RECIPIENT'
      WHEN BOOL_AND(custody_status='DRIVER') THEN 'DRIVER'
      ELSE 'INTERMEDIATE_PROVIDER' END AS custody
     FROM transport_trip_pets WHERE trip_id=$1`,
    [input.tripId],
  );
  await client.query(`UPDATE transport_trips SET overall_custody_status=$2,updated_at=now() WHERE trip_id=$1`,[input.tripId,aggregate.rows[0].custody]);
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,custodyRecordId,JSON.stringify(record)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TransportCustody',$2,'TransportCustodyTransferred',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,custodyRecordId,JSON.stringify(record)],
  );
  return {custody:record,replayed:false};
}

export async function reportTransportIncident(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;tripId:string;category:string;severity:string;petIds:string[];description:string;actionTaken:string;lastKnownTrackingRef?:string;
}){
  const access=await client.query(`SELECT petos_can_manage_transport_trip($1,$2) AS allowed`,[input.tripId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true) throw httpError('TRANSPORT_INCIDENT_WRITE_DENIED',403);
  const trip=await client.query(`SELECT * FROM transport_trips WHERE trip_id=$1 FOR UPDATE`,[input.tripId]);
  if(!trip.rowCount) throw httpError('TRANSPORT_TRIP_NOT_FOUND',404);
  const driver=await client.query(`SELECT driver_profile_id FROM transport_driver_profiles WHERE user_id=$1 AND driver_profile_id=$2`,[input.actorUserId,trip.rows[0].assigned_driver_id]);
  const scope=`transport:incident:${input.tripId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {incident:prior.rows[0].response_body,replayed:true};
  }
  const incidentId=`transport-incident-${generateUUIDv7()}`;
  const incident={incidentId,tripId:input.tripId,category:input.category,severity:input.severity,state:'OPEN',petIds:input.petIds,reportedAt:new Date().toISOString(),description:input.description,actionTaken:input.actionTaken,lastKnownTrackingRef:input.lastKnownTrackingRef};
  await client.query(
    `INSERT INTO transport_incidents(incident_id,trip_id,category,severity,state,pet_ids,reported_at,reported_by_driver_id,description,action_taken,last_known_tracking_ref)
     VALUES($1,$2,$3,$4,'OPEN',$5::jsonb,$6,$7,$8,$9,$10)`,
    [incidentId,input.tripId,input.category,input.severity,JSON.stringify(input.petIds),incident.reportedAt,driver.rows[0]?.driver_profile_id||trip.rows[0].assigned_driver_id,input.description,input.actionTaken,input.lastKnownTrackingRef||null],
  );
  await client.query(`UPDATE transport_trips SET status='INCIDENT_ACTIVE',active_incident_count=active_incident_count+1,updated_at=now(),version=version+1 WHERE trip_id=$1`,[input.tripId]);
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,incidentId,JSON.stringify(incident)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'TransportIncident',$2,'TransportIncidentReported',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,incidentId,JSON.stringify(incident)],
  );
  return {incident,replayed:false};
}

export async function getTransportTrip(client:PoolClient,tripId:string,actorUserId:string){
  const allowed=await client.query(`SELECT petos_can_access_transport_trip($1,$2) AS allowed`,[tripId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw httpError('TRANSPORT_TRIP_ACCESS_DENIED',403);
  const trip=await client.query(`SELECT * FROM transport_trips WHERE trip_id=$1 LIMIT 1`,[tripId]);
  if(!trip.rowCount) throw httpError('TRANSPORT_TRIP_NOT_FOUND',404);
  const [pets,stops,custody,incidents]=await Promise.all([
    client.query(`SELECT * FROM transport_trip_pets WHERE trip_id=$1 ORDER BY pet_id`,[tripId]),
    client.query(`SELECT stop_id,sequence,stop_type,title,address_public_snippet,scheduled_arrival,actual_arrival,status,pet_ids_boarding,pet_ids_exiting FROM transport_stops WHERE trip_id=$1 ORDER BY sequence`,[tripId]),
    client.query(`SELECT custody_record_id,pet_id,from_actor_role,to_actor_role,stop_id,transferred_at,verification_method,notes FROM transport_custody_records WHERE trip_id=$1 ORDER BY transferred_at`,[tripId]),
    client.query(`SELECT incident_id,category,severity,state,pet_ids,reported_at,description,action_taken,last_known_tracking_ref,resolution_notes,resolved_at FROM transport_incidents WHERE trip_id=$1 ORDER BY reported_at DESC`,[tripId]),
  ]);
  return {trip:trip.rows[0],pets:pets.rows,stops:stops.rows,custody:custody.rows,incidents:incidents.rows};
}

// ============================================================================
// RECOVERY
// ============================================================================

export async function createSafeZone(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;petId:string;name:string;zoneType:string;centerLatitude:number;centerLongitude:number;radiusMeters:number;hysteresisBufferMeters:number;alertOnExit:boolean;alertOnEntry:boolean;
}){
  await assertPetManager(client,input.petId,input.actorUserId);
  const pet=await client.query(`SELECT household_id FROM pets WHERE pet_id=$1 LIMIT 1`,[input.petId]);
  if(!pet.rowCount) throw httpError('PET_NOT_FOUND',404);
  if(input.radiusMeters<20||input.radiusMeters>5000) throw httpError('SAFE_ZONE_RADIUS_INVALID',400);
  const scope=`recovery:safe-zone:${input.petId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {safeZone:prior.rows[0].response_body,replayed:true};
  }
  const safeZoneId=`safe-zone-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO recovery_safe_zones(safe_zone_id,household_id,pet_id,name,zone_type,center_latitude,center_longitude,radius_meters,hysteresis_buffer_meters,alert_on_exit,alert_on_entry,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [safeZoneId,pet.rows[0].household_id,input.petId,input.name,input.zoneType,input.centerLatitude,input.centerLongitude,input.radiusMeters,input.hysteresisBufferMeters,input.alertOnExit,input.alertOnEntry,input.actorUserId],
  );
  const safeZone=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,safeZoneId,JSON.stringify(safeZone)],
  );
  return {safeZone,replayed:false};
}

export async function reportLostPet(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;petId:string;missingSince:string;coarseDescription:string;neighborhood:string;district:string;city:string;county:string;coarseCenterLatitude:number;coarseCenterLongitude:number;coarseRadiusKm:number;ownerInstructions:string;communityAlertRequested:boolean;
}){
  await assertPetManager(client,input.petId,input.actorUserId);
  const pet=await client.query(`SELECT * FROM pets WHERE pet_id=$1 FOR UPDATE`,[input.petId]);
  if(!pet.rowCount) throw httpError('PET_NOT_FOUND',404);
  const scope=`recovery:lost:${input.petId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {incident:prior.rows[0].response_body,replayed:true};
  }
  const active=await client.query(`SELECT lost_pet_incident_id FROM recovery_incidents WHERE pet_id=$1 AND status IN ('REPORTED','ACTIVE','SEARCH_IN_PROGRESS') LIMIT 1`,[input.petId]);
  if(active.rowCount) throw httpError('ACTIVE_LOST_PET_INCIDENT_EXISTS',409);
  const live=await client.query(`SELECT * FROM tracking_live_locations WHERE pet_id=$1 LIMIT 1`,[input.petId]);
  const incidentId=`lost-pet-${generateUUIDv7()}`;
  const profileId=`recovery-profile-${generateUUIDv7()}`;
  const publicToken=`recover-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO recovery_incidents(
      lost_pet_incident_id,pet_id,household_id,reported_by_user_id,status,missing_since,last_known_observation_id,last_known_accuracy_m,coarse_description,
      coarse_neighborhood,coarse_district,coarse_city,coarse_county,coarse_center_latitude,coarse_center_longitude,coarse_radius_km,community_alert_requested
     ) VALUES($1,$2,$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [incidentId,input.petId,pet.rows[0].household_id,input.actorUserId,input.missingSince,live.rows[0]?.latest_observation_id||null,
      live.rows[0]?Number(live.rows[0].accuracy_m):null,input.coarseDescription,input.neighborhood,input.district,input.city,input.county,input.coarseCenterLatitude,input.coarseCenterLongitude,input.coarseRadiusKm,input.communityAlertRequested],
  );
  await client.query(
    `INSERT INTO recovery_public_profiles(profile_id,lost_pet_incident_id,pet_id,public_token,pet_display_name,species,breed,coarse_missing_area,owner_instructions)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [profileId,incidentId,input.petId,publicToken,pet.rows[0].name,pet.rows[0].species_code,pet.rows[0].breed_code,input.coarseDescription,input.ownerInstructions],
  );
  await client.query(`UPDATE pets SET status='MISSING',updated_at=now(),version=version+1 WHERE pet_id=$1`,[input.petId]);
  let communityAlertId:string|undefined;
  if(input.communityAlertRequested){
    communityAlertId=`community-alert-${generateUUIDv7()}`;
    const coarse={neighborhood:input.neighborhood,district:input.district,city:input.city,county:input.county,centerLatitude:input.coarseCenterLatitude,centerLongitude:input.coarseCenterLongitude,radiusKm:input.coarseRadiusKm};
    await client.query(
      `INSERT INTO community_recovery_alerts(
        community_alert_id,lost_pet_incident_id,recovery_profile_id,public_token,pet_display_name,species,breed,owner_instructions,coarse_target_area,status,visibility_scope,requested_at,activated_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'ACTIVE','LOCAL_COMMUNITY',now(),now())`,
      [communityAlertId,incidentId,profileId,publicToken,pet.rows[0].name,pet.rows[0].species_code,pet.rows[0].breed_code,input.ownerInstructions,JSON.stringify(coarse)],
    );
    await client.query(`UPDATE recovery_incidents SET community_alert_activated_at=now() WHERE lost_pet_incident_id=$1`,[incidentId]);
  }
  const incident={lostPetIncidentId:incidentId,petId:input.petId,householdId:pet.rows[0].household_id,status:'ACTIVE',missingSince:input.missingSince,lastKnownObservationId:live.rows[0]?.latest_observation_id||undefined,coarseDescription:input.coarseDescription,recoveryProfileId:profileId,publicToken,communityAlertId};
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,incidentId,JSON.stringify(incident)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'LostPetIncident',$2,'LostPetIncidentActivated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,incidentId,JSON.stringify({incidentId,petId:input.petId,householdId:pet.rows[0].household_id,profileId,communityAlertId})],
  );
  return {incident,replayed:false};
}

export async function submitRecoverySighting(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;incidentId:string;sightingAt:string;latitude:number;longitude:number;coarseDescription:string;notes:string;confidence:string;reportedVia:string;
}){
  const incident=await client.query(`SELECT status FROM recovery_incidents WHERE lost_pet_incident_id=$1 LIMIT 1`,[input.incidentId]);
  if(!incident.rowCount) throw httpError('LOST_PET_INCIDENT_NOT_FOUND',404);
  if(!['ACTIVE','SEARCH_IN_PROGRESS'].includes(String(incident.rows[0].status))) throw httpError('LOST_PET_INCIDENT_NOT_ACCEPTING_SIGHTINGS',409);
  const scope=`recovery:sighting:${input.incidentId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {sighting:prior.rows[0].response_body,replayed:true};
  }
  const sightingId=`sighting-${generateUUIDv7()}`;
  const sighting={sightingId,lostPetIncidentId:input.incidentId,reporterUserId:input.actorUserId,sightingAt:input.sightingAt,coarseDescription:input.coarseDescription,notes:input.notes,status:'PENDING_REVIEW',confidence:input.confidence,reportedVia:input.reportedVia};
  await client.query(
    `INSERT INTO recovery_sightings(sighting_id,lost_pet_incident_id,reporter_user_id,sighting_at,latitude,longitude,coarse_description,notes,status,confidence,reported_via)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'PENDING_REVIEW',$9,$10)`,
    [sightingId,input.incidentId,input.actorUserId,input.sightingAt,input.latitude,input.longitude,input.coarseDescription,input.notes,input.confidence,input.reportedVia],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,sightingId,JSON.stringify(sighting)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'LostPetSighting',$2,'LostPetSightingReported',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,sightingId,JSON.stringify({sightingId,incidentId:input.incidentId,reporterUserId:input.actorUserId,coarseDescription:input.coarseDescription})],
  );
  return {sighting,replayed:false};
}

export async function verifyRecoverySighting(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;incidentId:string;sightingId:string;status:'VERIFIED'|'REJECTED'|'FLAGGED_ABUSIVE'}){
  const access=await client.query(`SELECT petos_can_access_recovery_incident($1,$2) AS allowed`,[input.incidentId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true) throw httpError('RECOVERY_SIGHTING_REVIEW_DENIED',403);
  const scope=`recovery:sighting:review:${input.sightingId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {sighting:prior.rows[0].response_body,replayed:true};
  }
  const result=await client.query(
    `UPDATE recovery_sightings SET status=$3,updated_at=now() WHERE sighting_id=$1 AND lost_pet_incident_id=$2 AND status='PENDING_REVIEW' RETURNING *`,
    [input.sightingId,input.incidentId,input.status],
  );
  if(!result.rowCount) throw httpError('RECOVERY_SIGHTING_NOT_REVIEWABLE',409);
  const sighting=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.sightingId,JSON.stringify(sighting)],
  );
  return {sighting,replayed:false};
}

export async function resolveLostPet(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;incidentId:string;resolutionNotes:string}){
  const incident=await client.query(`SELECT * FROM recovery_incidents WHERE lost_pet_incident_id=$1 FOR UPDATE`,[input.incidentId]);
  if(!incident.rowCount) throw httpError('LOST_PET_INCIDENT_NOT_FOUND',404);
  await assertPetManager(client,incident.rows[0].pet_id,input.actorUserId);
  if(incident.rows[0].status==='RECOVERED') return {incident:incident.rows[0],replayed:true};
  const scope=`recovery:resolve:${input.incidentId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {incident:prior.rows[0].response_body,replayed:true};
  }
  const result=await client.query(
    `UPDATE recovery_incidents SET status='RECOVERED',recovered_at=now(),resolution_notes=$2,updated_at=now(),version=version+1 WHERE lost_pet_incident_id=$1 RETURNING *`,
    [input.incidentId,input.resolutionNotes],
  );
  await client.query(`UPDATE recovery_public_profiles SET is_active=false,updated_at=now() WHERE lost_pet_incident_id=$1`,[input.incidentId]);
  await client.query(`UPDATE community_recovery_alerts SET status='CLOSED',closure_reason='RECOVERED',closed_at=now(),updated_at=now() WHERE lost_pet_incident_id=$1`,[input.incidentId]);
  await client.query(`UPDATE pets SET status='ACTIVE',updated_at=now(),version=version+1 WHERE pet_id=$1`,[incident.rows[0].pet_id]);
  const resolved=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.incidentId,JSON.stringify(resolved)],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'LostPetIncident',$2,'LostPetRecovered',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.incidentId,JSON.stringify({incidentId:input.incidentId,petId:incident.rows[0].pet_id,recoveredBy:input.actorUserId})],
  );
  return {incident:resolved,replayed:false};
}

export async function getRecoveryIncident(client:PoolClient,incidentId:string,actorUserId:string){
  const access=await client.query(`SELECT petos_can_access_recovery_incident($1,$2) AS allowed`,[incidentId,actorUserId]);
  if(access.rows[0]?.allowed!==true) throw httpError('RECOVERY_INCIDENT_ACCESS_DENIED',403);
  const incident=await client.query(`SELECT * FROM recovery_incidents WHERE lost_pet_incident_id=$1 LIMIT 1`,[incidentId]);
  if(!incident.rowCount) throw httpError('LOST_PET_INCIDENT_NOT_FOUND',404);
  const [profile,sightings,alert]=await Promise.all([
    client.query(`SELECT * FROM recovery_public_profiles WHERE lost_pet_incident_id=$1 LIMIT 1`,[incidentId]),
    client.query(`SELECT * FROM recovery_sightings WHERE lost_pet_incident_id=$1 ORDER BY sighting_at DESC`,[incidentId]),
    client.query(`SELECT * FROM community_recovery_alerts WHERE lost_pet_incident_id=$1 LIMIT 1`,[incidentId]),
  ]);
  return {incident:incident.rows[0],publicProfile:profile.rows[0]||null,sightings:sightings.rows,communityAlert:alert.rows[0]||null};
}

export async function getPublicRecoveryProfile(client:PoolClient,publicToken:string){
  const profile=await client.query(
    `SELECT rp.profile_id,rp.public_token,rp.pet_display_name,rp.photo_url,rp.species,rp.breed,rp.coarse_missing_area,rp.owner_instructions,rp.emergency_medical_notes,
      r.status AS incident_status
     FROM recovery_public_profiles rp JOIN recovery_incidents r ON r.lost_pet_incident_id=rp.lost_pet_incident_id
     WHERE rp.public_token=$1 AND rp.is_active LIMIT 1`,
    [publicToken],
  );
  if(!profile.rowCount) throw httpError('PUBLIC_RECOVERY_PROFILE_NOT_FOUND',404);
  return profile.rows[0];
}

// ============================================================================
// COMMUNITY
// ============================================================================

export async function createCommunityProfile(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;handle:string;displayName:string;bio:string;neighborhood:string;city:string;county:string;visibility:string;allowsRecoveryRelay:boolean;
}){
  const scope='community:profile:create';
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {profile:prior.rows[0].response_body,replayed:true};
  }
  const existing=await client.query(`SELECT profile_id FROM community_profiles WHERE user_id=$1 LIMIT 1`,[input.actorUserId]);
  if(existing.rowCount) throw httpError('COMMUNITY_PROFILE_ALREADY_EXISTS',409);
  const profileId=`community-profile-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO community_profiles(profile_id,user_id,handle,display_name,bio,neighborhood,city,county,visibility,status,allows_recovery_relay)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10) RETURNING *`,
    [profileId,input.actorUserId,input.handle.toLowerCase(),input.displayName,input.bio,input.neighborhood,input.city,input.county,input.visibility,input.allowsRecoveryRelay],
  );
  const profile=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,profileId,JSON.stringify(profile)],
  );
  return {profile,replayed:false};
}

export async function createCommunityPost(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;postType:string;content:string;coarseLocationArea?:string;
}){
  const profile=await client.query(`SELECT * FROM community_profiles WHERE user_id=$1 AND status='ACTIVE' LIMIT 1`,[input.actorUserId]);
  if(!profile.rowCount) throw httpError('ACTIVE_COMMUNITY_PROFILE_REQUIRED',409);
  const scope=`community:post:create:${profile.rows[0].profile_id}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {post:prior.rows[0].response_body,replayed:true};
  }
  const postId=`community-post-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO community_posts(post_id,author_profile_id,post_type,content,coarse_location_area,status)
     VALUES($1,$2,$3,$4,$5,'ACTIVE') RETURNING *`,
    [postId,profile.rows[0].profile_id,input.postType,input.content,input.coarseLocationArea||null],
  );
  const post=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,postId,JSON.stringify(post)],
  );
  return {post,replayed:false};
}

export async function listCommunityFeed(client:PoolClient,actorUserId:string,limit=50){
  const result=await client.query(
    `SELECT p.post_id,p.post_type,p.content,p.coarse_location_area,p.reaction_counts,p.comment_count,p.is_pinned,p.created_at,p.updated_at,
      cp.profile_id,cp.handle,cp.display_name,cp.avatar_url,cp.neighborhood,cp.city,cp.county,cp.provider_badge,cp.is_verified
     FROM community_posts p JOIN community_profiles cp ON cp.profile_id=p.author_profile_id
     WHERE p.status IN ('ACTIVE','LIMITED') AND cp.status='ACTIVE' AND cp.visibility<>'PRIVATE'
     ORDER BY p.is_pinned DESC,p.created_at DESC LIMIT $1`,
    [Math.min(limit,100)],
  );
  return result.rows;
}

export async function volunteerForRecovery(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;communityAlertId:string;volunteerRole:string;notes?:string}){
  const profile=await client.query(`SELECT * FROM community_profiles WHERE user_id=$1 AND status='ACTIVE' AND allows_recovery_relay=true LIMIT 1`,[input.actorUserId]);
  if(!profile.rowCount) throw httpError('RECOVERY_RELAY_OPT_IN_REQUIRED',403);
  const alert=await client.query(`SELECT * FROM community_recovery_alerts WHERE community_alert_id=$1 AND status IN ('ACTIVE','SEARCH_IN_PROGRESS') LIMIT 1`,[input.communityAlertId]);
  if(!alert.rowCount) throw httpError('COMMUNITY_RECOVERY_ALERT_NOT_ACTIVE',409);
  const scope=`community:recovery:volunteer:${input.communityAlertId}:${input.volunteerRole}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
    return {volunteer:prior.rows[0].response_body,replayed:true};
  }
  const volunteerId=`recovery-volunteer-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO community_recovery_volunteers(volunteer_id,community_alert_id,profile_id,volunteer_role,notes)
     VALUES($1,$2,$3,$4,$5) RETURNING *`,
    [volunteerId,input.communityAlertId,profile.rows[0].profile_id,input.volunteerRole,input.notes||null],
  );
  const volunteer=result.rows[0];
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,volunteerId,JSON.stringify(volunteer)],
  );
  return {volunteer,replayed:false};
}
