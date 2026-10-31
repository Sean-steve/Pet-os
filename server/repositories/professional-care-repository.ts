import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface EngagementRow {
  engagementId:string;bookingId:string;serviceType:string;offeringId:string;householdId:string;petIds:string[];
  providerId:string;businessId?:string;assignedStaffId:string;status:string;custodyStatus:string;
  scheduledStartAt:string;scheduledEndAt:string;actualStartAt?:string;actualEndAt?:string;timezone:string;
  activeIncidentCount:number;concurrencyVersion:number;
}
const mapEngagement=(row:any):EngagementRow=>({
  engagementId:row.engagement_id,bookingId:row.booking_id,serviceType:row.service_type,offeringId:row.offering_id,
  householdId:row.household_id,petIds:row.pet_ids||[],providerId:row.provider_id,businessId:row.business_id||undefined,
  assignedStaffId:row.assigned_staff_id,status:row.status,custodyStatus:row.custody_status,
  scheduledStartAt:new Date(row.scheduled_start_at).toISOString(),scheduledEndAt:new Date(row.scheduled_end_at).toISOString(),
  actualStartAt:row.actual_start_at?new Date(row.actual_start_at).toISOString():undefined,
  actualEndAt:row.actual_end_at?new Date(row.actual_end_at).toISOString():undefined,
  timezone:row.timezone,activeIncidentCount:Number(row.active_incident_count),concurrencyVersion:Number(row.concurrency_version),
});

async function assertProviderActor(client:PoolClient,providerId:string,actorUserId:string,businessId?:string,assignedStaffId?:string){
  const provider=await client.query(`SELECT user_id FROM provider_profiles WHERE provider_id=$1 LIMIT 1`,[providerId]);
  if(!provider.rowCount) throw Object.assign(new Error('PROVIDER_NOT_FOUND'),{statusCode:404});
  if(provider.rows[0].user_id===actorUserId) return;
  if(assignedStaffId===actorUserId && businessId){
    const staff=await client.query(`SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active LIMIT 1`,[businessId,actorUserId]);
    if(staff.rowCount) return;
  }
  if(businessId){
    const manager=await client.query(`SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active AND role IN ('OWNER','ADMIN','MANAGER') LIMIT 1`,[businessId,actorUserId]);
    if(manager.rowCount) return;
  }
  throw Object.assign(new Error('PROFESSIONAL_CARE_PROVIDER_DENIED'),{statusCode:403});
}

export async function createEngagementFromBooking(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;bookingId:string;serviceType:string;assignedStaffId:string;
}):Promise<{engagement:EngagementRow;replayed:boolean}>{
  const bookingResult=await client.query(`SELECT * FROM bookings WHERE booking_id=$1 FOR UPDATE`,[input.bookingId]);
  if(!bookingResult.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  const b=bookingResult.rows[0];
  if(!['CONFIRMED','IN_PROGRESS'].includes(b.status)) throw Object.assign(new Error('CARE_ENGAGEMENT_REQUIRES_CONFIRMED_BOOKING'),{statusCode:409});
  await assertProviderActor(client,b.provider_id,input.actorUserId,b.business_id||undefined,input.assignedStaffId);
  const providerActor=await client.query(`SELECT user_id FROM provider_profiles WHERE provider_id=$1 LIMIT 1`,[b.provider_id]);
  const providerUserId=String(providerActor.rows[0]?.user_id||'');
  if(!b.business_id && input.assignedStaffId!==providerUserId){
    throw Object.assign(new Error('PERSONAL_PROVIDER_MUST_SELF_ASSIGN'),{statusCode:409});
  }
  if(b.business_id && input.assignedStaffId!==providerUserId){
    const staff=await client.query(`SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active LIMIT 1`,[b.business_id,input.assignedStaffId]);
    if(!staff.rowCount) throw Object.assign(new Error('ASSIGNED_STAFF_NOT_IN_BUSINESS'),{statusCode:409});
  }
  const scope=`professional-care:create:${input.bookingId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {engagement:prior.rows[0].response_body as EngagementRow,replayed:true};
  }
  const existing=await client.query(`SELECT * FROM professional_care_engagements WHERE booking_id=$1 LIMIT 1`,[input.bookingId]);
  if(existing.rowCount) return {engagement:mapEngagement(existing.rows[0]),replayed:true};

  const engagementId=`care-engagement-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO professional_care_engagements(
      engagement_id,booking_id,service_type,offering_id,household_id,pet_ids,provider_id,business_id,assigned_staff_id,
      status,custody_status,scheduled_start_at,scheduled_end_at,timezone
    ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,'SCHEDULED','OWNER_CUSTODY',$10,$11,$12)
    RETURNING *`,
    [engagementId,input.bookingId,input.serviceType,b.offering_id,b.household_id,JSON.stringify(b.pet_ids),b.provider_id,b.business_id||null,input.assignedStaffId,b.start_at,b.end_at,b.timezone],
  );
  const engagement=mapEngagement(result.rows[0]);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ProfessionalCareEngagement',$2,'ProfessionalCareEngagementCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,engagementId,JSON.stringify({engagementId,bookingId:input.bookingId,providerId:b.provider_id,householdId:b.household_id})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,engagementId,JSON.stringify(engagement)],
  );
  return {engagement,replayed:false};
}

export async function getEngagement(client:PoolClient,engagementId:string,actorUserId:string):Promise<EngagementRow>{
  const allowed=await client.query(`SELECT petos_can_access_engagement($1,$2) AS allowed`,[engagementId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('CARE_ENGAGEMENT_ACCESS_DENIED'),{statusCode:403});
  const result=await client.query(`SELECT * FROM professional_care_engagements WHERE engagement_id=$1 LIMIT 1`,[engagementId]);
  if(!result.rowCount) throw Object.assign(new Error('CARE_ENGAGEMENT_NOT_FOUND'),{statusCode:404});
  return mapEngagement(result.rows[0]);
}

export async function addCareRecord(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;engagementId:string;recordType:string;petId?:string;status?:string;occurredAt:string;payload:Record<string,unknown>;
}){
  const engagement=await getEngagement(client,input.engagementId,input.actorUserId);
  const allowedTypes=['INSTRUCTION_SNAPSHOT','ACCESS_GRANT','HANDOVER','OBSERVATION','INCIDENT','GROOMING_SESSION','SITTER_VISIT','BOARDING_STAY','SHIFT_HANDOVER','COMPLETION_EVIDENCE'];
  if(!allowedTypes.includes(input.recordType)) throw Object.assign(new Error('CARE_RECORD_TYPE_INVALID'),{statusCode:400});
  if(input.petId && !engagement.petIds.includes(input.petId)) throw Object.assign(new Error('CARE_RECORD_PET_SCOPE_INVALID'),{statusCode:400});
  const scope=`professional-care:record:${input.engagementId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {record:prior.rows[0].response_body,replayed:true};
  }
  const recordId=`care-record-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO professional_care_records(record_id,engagement_id,record_type,pet_id,status,occurred_at,payload,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
     RETURNING *`,
    [recordId,input.engagementId,input.recordType,input.petId||null,input.status||null,input.occurredAt,JSON.stringify(input.payload),input.actorUserId],
  );
  const record={
    recordId:result.rows[0].record_id,engagementId:result.rows[0].engagement_id,recordType:result.rows[0].record_type,
    petId:result.rows[0].pet_id||undefined,status:result.rows[0].status||undefined,occurredAt:new Date(result.rows[0].occurred_at).toISOString(),
    payload:result.rows[0].payload||{},createdBy:result.rows[0].created_by,version:Number(result.rows[0].version),
  };
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ProfessionalCareRecord',$2,'ProfessionalCareRecordPersisted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,recordId,JSON.stringify({recordId,engagementId:input.engagementId,recordType:input.recordType,petId:input.petId||null})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,recordId,JSON.stringify(record)],
  );
  return {record,replayed:false};
}

export async function transitionEngagement(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;engagementId:string;expectedVersion:number;nextStatus:string;custodyStatus:string;reason:string;
}):Promise<{engagement:EngagementRow;replayed:boolean}>{
  const scope=`professional-care:transition:${input.engagementId}:${input.expectedVersion}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {engagement:prior.rows[0].response_body as EngagementRow,replayed:true};
  }
  const currentResult=await client.query(`SELECT * FROM professional_care_engagements WHERE engagement_id=$1 FOR UPDATE`,[input.engagementId]);
  if(!currentResult.rowCount) throw Object.assign(new Error('CARE_ENGAGEMENT_NOT_FOUND'),{statusCode:404});
  const current=mapEngagement(currentResult.rows[0]);
  await assertProviderActor(client,current.providerId,input.actorUserId,current.businessId,current.assignedStaffId);
  if(current.concurrencyVersion!==input.expectedVersion) throw Object.assign(new Error('CARE_ENGAGEMENT_VERSION_CONFLICT'),{statusCode:409});
  const transitions:Record<string,string[]>={
    SCHEDULED:['READY_FOR_HANDOVER','CANCELLED'],READY_FOR_HANDOVER:['IN_CARE','CANCELLED'],IN_CARE:['RETURN_PENDING','INCIDENT_ACTIVE','ABORTED'],
    INCIDENT_ACTIVE:['IN_CARE','RETURN_PENDING','ABORTED'],RETURN_PENDING:['COMPLETION_PENDING'],COMPLETION_PENDING:['COMPLETED','ABORTED'],
  };
  if(!(transitions[current.status]||[]).includes(input.nextStatus)) throw Object.assign(new Error('CARE_ENGAGEMENT_STATUS_TRANSITION_INVALID'),{statusCode:409});
  const nextVersion=current.concurrencyVersion+1;
  const result=await client.query(
    `UPDATE professional_care_engagements SET status=$1,custody_status=$2,concurrency_version=$3,updated_at=now(),
       actual_start_at=CASE WHEN $1='IN_CARE' AND actual_start_at IS NULL THEN now() ELSE actual_start_at END,
       actual_end_at=CASE WHEN $1 IN ('COMPLETED','ABORTED') THEN now() ELSE actual_end_at END
     WHERE engagement_id=$4 AND concurrency_version=$5 RETURNING *`,
    [input.nextStatus,input.custodyStatus,nextVersion,input.engagementId,input.expectedVersion],
  );
  if(!result.rowCount) throw Object.assign(new Error('CARE_ENGAGEMENT_VERSION_CONFLICT'),{statusCode:409});
  const engagement=mapEngagement(result.rows[0]);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ProfessionalCareEngagement',$2,'ProfessionalCareStatusChanged',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,engagement.engagementId,JSON.stringify({engagementId:engagement.engagementId,from:current.status,to:engagement.status,custodyStatus:engagement.custodyStatus,reason:input.reason})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,engagement.engagementId,JSON.stringify(engagement)],
  );
  return {engagement,replayed:false};
}
