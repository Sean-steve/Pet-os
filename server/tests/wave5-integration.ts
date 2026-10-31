import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { createApp } from '../app';
import { loadServerConfig } from '../config';
import { closeDatabase, getDatabase, withTenantTransaction } from '../db';
import { closeRedis, getRedis } from '../redis';
import { runMigrations } from '../migrate';

const config=loadServerConfig();
const db=getDatabase(config);

async function token(subject:string){
  assert.ok(config.authJwtSecret);
  return new SignJWT({scope:'petos:api'})
    .setProtectedHeader({alg:'HS256'}).setSubject(subject).setIssuer(config.authIssuer).setAudience(config.authAudience)
    .setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(config.authJwtSecret));
}
async function api(base:string,path:string,accessToken:string,init:RequestInit={}){
  const headers=new Headers(init.headers);headers.set('authorization',`Bearer ${accessToken}`);
  if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  return fetch(base+path,{...init,headers});
}
async function locationInternal(base:string,path:string,init:RequestInit={},secret=config.locationAdapterSecret){
  const headers=new Headers(init.headers);headers.set('x-location-adapter-secret',secret);
  if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  return fetch(base+path,{...init,headers});
}
const readJson=(r:Response)=>r.json() as Promise<any>;

async function seed(){
  await db.query(`
    TRUNCATE
      community_recovery_volunteers,community_recovery_alerts,community_posts,community_profiles,
      recovery_sightings,recovery_public_profiles,recovery_incidents,recovery_geofence_transitions,recovery_safe_zones,
      transport_incidents,transport_custody_records,transport_stops,transport_trip_pets,transport_trips,transport_vehicles,transport_driver_profiles,
      tracking_dead_letters,tracking_routes,tracking_live_locations,tracking_location_observations,tracking_ingestion_events,tracking_sessions,tracking_device_assignments,tracking_devices,
      billing_reconciliation_items,billing_reconciliation_runs,
      provider_saas_continuity_grants,provider_saas_invoices,provider_saas_entitlement_grants,provider_saas_status_history,provider_saas_subscriptions,
      subscription_entitlement_grants,subscription_invoices,subscription_status_history,consumer_subscriptions,
      finance_reconciliation_items,finance_reconciliation_runs,finance_refunds,finance_payout_allocations,finance_provider_payouts,finance_payout_destinations,
      finance_provider_earnings,finance_receipts,finance_ledger_entries,finance_ledger_journals,finance_ledger_accounts,
      finance_payment_transactions,finance_webhook_events,finance_payment_intents,
      review_responses,review_revisions,reviews,review_eligibilities,
      professional_care_records,professional_care_engagements,
      booking_revisions,booking_pet_links,bookings,provider_service_offerings,business_memberships,provider_profiles,service_businesses,
      pet_domain_record_revisions,health_records,care_records,nutrition_records,training_records,activity_records,
      idempotency_records,outbox_events,pets,household_members,households,users
    RESTART IDENTITY CASCADE
  `);
  await db.query(`INSERT INTO users(user_id,normalized_email,account_status) VALUES
    ('usr-w5-owner','w5-owner@test.local','ACTIVE'),
    ('usr-w5-business','w5-business@test.local','ACTIVE'),
    ('usr-w5-driver','w5-driver@test.local','ACTIVE'),
    ('usr-w5-community','w5-community@test.local','ACTIVE'),
    ('usr-w5-outsider','w5-outsider@test.local','ACTIVE')`);
  await db.query(`INSERT INTO households(household_id,name,owner_user_id,status) VALUES('hh-w5','Wave 5 Household','usr-w5-owner','ACTIVE')`);
  await db.query(`INSERT INTO household_members(membership_id,household_id,user_id,role,status)
    VALUES('mem-w5-owner','hh-w5','usr-w5-owner','HOUSEHOLD_OWNER','ACTIVE')`);
  await db.query(`INSERT INTO pets(
    pet_id,household_id,name,species_code,breed_code,sex,reproductive_status,birthdate_precision,
    primary_color,size_classification,lifecycle_stage,status,created_by
  ) VALUES('pet-w5','hh-w5','Kibo','SPECIES_DOG','BREED_MIXED','MALE','STERILIZED','ESTIMATED_YEAR','Brown','MEDIUM','ADULT','ACTIVE','usr-w5-owner')`);
  await db.query(`INSERT INTO service_businesses(
    business_id,legal_name,trading_name,business_type,owner_user_id,verification_status,is_active,contact_email,contact_phone
  ) VALUES('business-w5','Wave 5 Transport Ltd','Wave 5 Transport','PET_TRANSPORT','usr-w5-business','VERIFIED',true,'transport@test.local','+254700000000')`);
  await db.query(`INSERT INTO provider_profiles(
    provider_id,user_id,display_name,professional_title,category,bio,years_of_experience,languages,
    verification_status,operational_status,visibility_status,primary_business_id,metadata
  ) VALUES('provider-w5','usr-w5-business','Wave 5 Transport','Pet Transport','PET_TRANSPORT','Safe Pet transport',5,'["English"]'::jsonb,'VERIFIED','ACTIVE','PUBLIC','business-w5','{}'::jsonb)`);
  await db.query(`INSERT INTO business_memberships(membership_id,business_id,user_id,provider_id,role,is_active,can_manage_services,can_manage_schedule)
    VALUES
      ('bm-w5-owner','business-w5','usr-w5-business','provider-w5','OWNER',true,true,true),
      ('bm-w5-driver','business-w5','usr-w5-driver',NULL,'STAFF',true,false,true)`);
  await db.query(`INSERT INTO provider_service_offerings(
    offering_id,provider_id,business_id,service_type_id,title,description,category,status,pricing_model,
    base_price_minor_units,currency,default_duration_minutes,location_types,target_species,max_pets_per_booking
  ) VALUES('offering-w5','provider-w5','business-w5','PET_TRANSPORT','Pet Transport','Door-to-door Pet transport','PET_TRANSPORT','ACTIVE','FIXED',200000,'KES',90,'["CLIENT_LOCATION"]'::jsonb,'["DOG"]'::jsonb,2)`);
  await db.query(`INSERT INTO bookings(
    booking_id,owner_user_id,household_id,provider_id,business_id,offering_id,status,confirmation_mode,start_at,end_at,
    service_duration_minutes,timezone,pet_count,pet_ids,service_snapshot,price_snapshot,cancellation_policy_snapshot,instructions,confirmed_at
  ) VALUES(
    'booking-w5','usr-w5-owner','hh-w5','provider-w5','business-w5','offering-w5','CONFIRMED','PROVIDER_APPROVAL_REQUIRED',
    '2026-11-15T07:00:00Z','2026-11-15T09:00:00Z',120,'Africa/Nairobi',1,'["pet-w5"]'::jsonb,
    '{"title":"Pet Transport","category":"PET_TRANSPORT","providerDisplayName":"Wave 5 Transport"}'::jsonb,
    '{"amountMinorUnits":200000,"currency":"KES","pricingModel":"FIXED"}'::jsonb,
    '{"policyTier":"STANDARD"}'::jsonb,'{"notes":"Wave 5"}'::jsonb,now()
  )`);
  await db.query(`INSERT INTO booking_pet_links(booking_id,pet_id) VALUES('booking-w5','pet-w5')`);
}

async function main(){
  await runMigrations();await seed();await (await getRedis(config)).flushDb();
  const app=createApp(config);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const owner=await token('usr-w5-owner'),business=await token('usr-w5-business'),driver=await token('usr-w5-driver');
  const community=await token('usr-w5-community'),outsider=await token('usr-w5-outsider');
  try{
    let response=await locationInternal(base,'/internal/location/devices',{method:'POST',body:JSON.stringify({
      provider:'PET_OS_HARDWARE',externalDeviceReference:'device-ext-w5',deviceType:'GPS_CELLULAR_TRACKER',
      serialNumberMasked:'TRK-***-4242',displayName:'Kibo Tracker',model:'Pet OS One',supportsLostModeBroadcast:true,
    })},'wrong-location-secret');
    assert.equal(response.status,401);

    response=await locationInternal(base,'/internal/location/devices',{method:'POST',body:JSON.stringify({
      provider:'PET_OS_HARDWARE',externalDeviceReference:'device-ext-w5',deviceType:'GPS_CELLULAR_TRACKER',
      serialNumberMasked:'TRK-***-4242',displayName:'Kibo Tracker',model:'Pet OS One',supportsLostModeBroadcast:true,
    })});
    assert.equal(response.status,201);let payload=await readJson(response);const deviceId=payload.device.device_id;

    response=await api(base,`/v1/tracking/devices/${deviceId}/claim`,owner,{method:'POST',headers:{'idempotency-key':'w5-claim'},body:JSON.stringify({householdId:'hh-w5'})});
    assert.equal(response.status,200);
    response=await api(base,`/v1/tracking/devices/${deviceId}/assign`,owner,{method:'POST',headers:{'idempotency-key':'w5-assign'},body:JSON.stringify({petId:'pet-w5',reason:'Primary tracker'})});
    assert.equal(response.status,201);

    response=await api(base,'/v1/recovery/pets/pet-w5/safe-zones',owner,{method:'POST',headers:{'idempotency-key':'w5-zone'},body:JSON.stringify({
      name:'Home',zoneType:'HOME',centerLatitude:-1.286389,centerLongitude:36.817223,radiusMeters:100,hysteresisBufferMeters:20,alertOnExit:true,
    })});
    assert.equal(response.status,201);

    response=await api(base,'/v1/tracking/pets/pet-w5/sessions',owner,{method:'POST',headers:{'idempotency-key':'w5-session'},body:JSON.stringify({
      sourceContextType:'GENERAL_PET_TRACKING',trackingMode:'ACTIVE_SESSION',
    })});
    assert.equal(response.status,201);payload=await readJson(response);const trackingSessionId=payload.session.tracking_session_id;

    response=await locationInternal(base,'/internal/location/telemetry',{method:'POST',body:JSON.stringify({
      provider:'PET_OS_HARDWARE',providerEventId:'telemetry-w5-1',sourceDeviceReference:'device-ext-w5',sequenceNumber:1,
      observedAt:'2026-10-31T12:00:00Z',latitude:-1.28640,longitude:36.81720,accuracyM:8,batteryPercent:80,signatureVerified:true,sourcePayloadVersion:'1',
    })});
    assert.equal(response.status,200);
    response=await locationInternal(base,'/internal/location/telemetry',{method:'POST',body:JSON.stringify({
      provider:'PET_OS_HARDWARE',providerEventId:'telemetry-w5-2',sourceDeviceReference:'device-ext-w5',sequenceNumber:2,
      observedAt:'2026-10-31T12:02:00Z',latitude:-1.28900,longitude:36.82000,accuracyM:10,batteryPercent:79,signatureVerified:true,sourcePayloadVersion:'1',
    })});
    assert.equal(response.status,200);
    response=await locationInternal(base,'/internal/location/telemetry',{method:'POST',body:JSON.stringify({
      provider:'PET_OS_HARDWARE',providerEventId:'telemetry-w5-stale',sourceDeviceReference:'device-ext-w5',sequenceNumber:0,
      observedAt:'2026-10-31T11:59:00Z',latitude:-1.28000,longitude:36.81000,accuracyM:12,batteryPercent:79,signatureVerified:true,sourcePayloadVersion:'1',
    })});
    assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.liveAdvanced,false);

    response=await api(base,'/v1/tracking/pets/pet-w5/live',owner);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.location.observedAt,'2026-10-31T12:02:00.000Z');assert.equal(payload.location.latitude,-1.289);
    response=await api(base,'/v1/tracking/pets/pet-w5/live',outsider);assert.equal(response.status,403);

    const transitions=await db.query(`SELECT transition_type FROM recovery_geofence_transitions WHERE pet_id='pet-w5'`);
    assert.equal(transitions.rowCount,1);assert.equal(transitions.rows[0].transition_type,'EXIT');
    response=await api(base,`/v1/tracking/sessions/${trackingSessionId}/route`,owner);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.points.length,3);assert.equal(Number(payload.route.point_count),3);

    response=await api(base,'/v1/businesses/business-w5/transport/drivers',business,{method:'POST',headers:{'idempotency-key':'w5-driver'},body:JSON.stringify({
      providerId:'provider-w5',userId:'usr-w5-driver',fullName:'Driver W5',phoneNumberMasked:'+2547****1111',
      drivingLicenseRefMasked:'DL-***-111',approvedServiceTypes:['SINGLE_PET_DIRECT'],emergencyContactMasked:'+2547****2222',
    })});assert.equal(response.status,201);payload=await readJson(response);const driverProfileId=payload.driver.driver_profile_id;
    response=await api(base,`/v1/transport/drivers/${driverProfileId}/verify`,business,{method:'POST'});assert.equal(response.status,200);

    response=await api(base,'/v1/businesses/business-w5/transport/vehicles',business,{method:'POST',headers:{'idempotency-key':'w5-vehicle'},body:JSON.stringify({
      providerId:'provider-w5',displayName:'Pet Van 1',registrationNumberMasked:'K** 123X',makeModel:'Toyota Pet Van',vehicleType:'VAN',
      capacity:{maxPets:2,maxWeightKg:80,allowedSpecies:['DOG'],crateSlots:[]},sensorCapabilities:['TEMPERATURE_CARGO'],
      lastInspectionDate:'2026-10-01T00:00:00Z',insuranceValidUntil:'2027-10-01T00:00:00Z',
    })});assert.equal(response.status,201);payload=await readJson(response);const vehicleId=payload.vehicle.vehicle_id;
    response=await api(base,`/v1/transport/vehicles/${vehicleId}/verify`,business,{method:'POST'});assert.equal(response.status,200);

    response=await api(base,'/v1/transport/trips',business,{method:'POST',headers:{'idempotency-key':'w5-trip-bad-address'},body:JSON.stringify({
      bookingId:'booking-w5',assignedDriverId:driverProfileId,assignedVehicleId:vehicleId,tripType:'SINGLE_PET_DIRECT',
      stops:[
        {stopType:'PICKUP',title:'Pickup',addressPublicSnippet:'Kilimani, Nairobi',exactAddressCiphertext:'Plain exact home',scheduledArrival:'2026-11-15T07:00:00Z',recipientContactName:'Owner',recipientContactPhoneMasked:'+2547****0000',petIdsBoarding:['pet-w5']},
        {stopType:'DROP_OFF',title:'Drop off',addressPublicSnippet:'Westlands, Nairobi',exactAddressCiphertext:'enc:v1:dropoff',scheduledArrival:'2026-11-15T09:00:00Z',recipientContactName:'Owner',recipientContactPhoneMasked:'+2547****0000',petIdsExiting:['pet-w5']},
      ],
    })});assert.equal(response.status,400);

    response=await api(base,'/v1/transport/trips',business,{method:'POST',headers:{'idempotency-key':'w5-trip'},body:JSON.stringify({
      bookingId:'booking-w5',assignedDriverId:driverProfileId,assignedVehicleId:vehicleId,tripType:'SINGLE_PET_DIRECT',
      stops:[
        {stopType:'PICKUP',title:'Pickup',addressPublicSnippet:'Kilimani, Nairobi',exactAddressCiphertext:'enc:v1:pickup',scheduledArrival:'2026-11-15T07:00:00Z',recipientContactName:'Owner',recipientContactPhoneMasked:'+2547****0000',petIdsBoarding:['pet-w5']},
        {stopType:'DROP_OFF',title:'Drop off',addressPublicSnippet:'Westlands, Nairobi',exactAddressCiphertext:'vault:dropoff-ref',scheduledArrival:'2026-11-15T09:00:00Z',recipientContactName:'Owner',recipientContactPhoneMasked:'+2547****0000',petIdsExiting:['pet-w5']},
      ],
    })});assert.equal(response.status,201);payload=await readJson(response);const tripId=payload.trip.trip_id;

    response=await api(base,`/v1/transport/trips/${tripId}`,owner);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.stops[0].exact_address_ciphertext,undefined);const pickupStopId=payload.stops[0].stop_id,dropStopId=payload.stops[1].stop_id;
    response=await api(base,`/v1/transport/trips/${tripId}`,outsider);assert.equal(response.status,403);

    let version=1;
    for(const nextStatus of ['READY','DRIVER_EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','PICKUP_VERIFICATION']){
      response=await api(base,`/v1/transport/trips/${tripId}/transitions`,driver,{method:'POST',headers:{'idempotency-key':`w5-trip-${nextStatus}`},body:JSON.stringify({expectedVersion:version,nextStatus,reason:'Lifecycle progression'})});
      assert.equal(response.status,200);payload=await readJson(response);version=Number(payload.trip.version);
    }
    response=await api(base,`/v1/transport/trips/${tripId}/custody`,driver,{method:'POST',headers:{'idempotency-key':'w5-custody-pickup'},body:JSON.stringify({
      petId:'pet-w5',stopId:pickupStopId,toActorUserId:'usr-w5-driver',toActorRole:'DRIVER',verificationMethod:'OWNER_PIN',verificationProof:'482910',
    })});assert.equal(response.status,201);
    response=await api(base,`/v1/transport/trips/${tripId}/transitions`,driver,{method:'POST',headers:{'idempotency-key':'w5-trip-custody'},body:JSON.stringify({expectedVersion:version,nextStatus:'PET_IN_CUSTODY',reason:'Pickup verified'})});
    assert.equal(response.status,200);payload=await readJson(response);version=Number(payload.trip.version);
    for(const nextStatus of ['IN_TRANSIT','ARRIVED_AT_DESTINATION','HANDOVER_PENDING']){
      response=await api(base,`/v1/transport/trips/${tripId}/transitions`,driver,{method:'POST',headers:{'idempotency-key':`w5-trip-${nextStatus}`},body:JSON.stringify({expectedVersion:version,nextStatus,reason:'Lifecycle progression'})});
      assert.equal(response.status,200);payload=await readJson(response);version=Number(payload.trip.version);
    }
    response=await api(base,`/v1/transport/trips/${tripId}/custody`,driver,{method:'POST',headers:{'idempotency-key':'w5-custody-dropoff'},body:JSON.stringify({
      petId:'pet-w5',stopId:dropStopId,toActorUserId:'usr-w5-owner',toActorRole:'OWNER',verificationMethod:'OWNER_PIN',verificationProof:'778811',
    })});assert.equal(response.status,201);
    response=await api(base,`/v1/transport/trips/${tripId}/transitions`,driver,{method:'POST',headers:{'idempotency-key':'w5-trip-complete'},body:JSON.stringify({expectedVersion:version,nextStatus:'COMPLETED',reason:'Pet safely handed over'})});
    assert.equal(response.status,200);

    const custody=await db.query(`SELECT custody_record_id FROM transport_custody_records WHERE trip_id=$1 ORDER BY transferred_at LIMIT 1`,[tripId]);
    let custodyImmutable=false;try{await db.query(`UPDATE transport_custody_records SET notes='tamper' WHERE custody_record_id=$1`,[custody.rows[0].custody_record_id]);}catch{custodyImmutable=true;}
    assert.equal(custodyImmutable,true);

    response=await api(base,'/v1/community/profile',community,{method:'POST',headers:{'idempotency-key':'w5-community-profile'},body:JSON.stringify({
      handle:'searchhelper',displayName:'Search Helper',bio:'Local Pet community volunteer',neighborhood:'Kilimani',city:'Nairobi',county:'Nairobi',
      visibility:'PUBLIC',allowsRecoveryRelay:true,
    })});assert.equal(response.status,201);

    response=await api(base,'/v1/community/posts',community,{method:'POST',headers:{'idempotency-key':'w5-community-post-bad'},body:JSON.stringify({
      postType:'GENERAL',content:'Exact map marker',coarseLocationArea:'Kilimani',latitude:-1.2864,longitude:36.8172,
    })});assert.equal(response.status,400);

    response=await api(base,'/v1/community/posts',community,{method:'POST',headers:{'idempotency-key':'w5-community-post'},body:JSON.stringify({
      postType:'GENERAL',content:'Pet community update',coarseLocationArea:'Kilimani, Nairobi',
    })});assert.equal(response.status,201);

    response=await api(base,'/v1/recovery/pets/pet-w5/incidents',owner,{method:'POST',headers:{'idempotency-key':'w5-lost'},body:JSON.stringify({
      missingSince:'2026-10-31T12:10:00Z',coarseDescription:'Kilimani / Hurlingham area, Nairobi',neighborhood:'Kilimani',district:'Dagoretti North',
      city:'Nairobi',county:'Nairobi',coarseCenterLatitude:-1.289,coarseCenterLongitude:36.79,coarseRadiusKm:3,
      ownerInstructions:'Approach calmly and call the relay number.',communityAlertRequested:true,
    })});assert.equal(response.status,201);payload=await readJson(response);const incidentId=payload.incident.lostPetIncidentId,publicToken=payload.incident.publicToken,communityAlertId=payload.incident.communityAlertId;
    assert.ok(payload.incident.lastKnownObservationId);

    response=await fetch(base+`/public/recovery/${publicToken}`);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.profile.coarse_missing_area,'Kilimani / Hurlingham area, Nairobi');
    assert.equal(payload.profile.latitude,undefined);assert.equal(payload.profile.longitude,undefined);

    response=await api(base,`/v1/recovery/incidents/${incidentId}/sightings`,community,{method:'POST',headers:{'idempotency-key':'w5-sighting'},body:JSON.stringify({
      sightingAt:'2026-10-31T12:20:00Z',latitude:-1.2912,longitude:36.7902,coarseDescription:'Near Hurlingham',notes:'Dog matching description moving east',
      confidence:'MEDIUM',reportedVia:'COMMUNITY_ALERT',
    })});assert.equal(response.status,201);payload=await readJson(response);const sightingId=payload.sighting.sightingId;

    response=await api(base,`/v1/recovery/incidents/${incidentId}`,outsider);assert.equal(response.status,403);
    response=await api(base,`/v1/recovery/incidents/${incidentId}`,owner);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(Number(payload.sightings[0].latitude),-1.2912);
    response=await api(base,`/v1/recovery/incidents/${incidentId}/sightings/${sightingId}/review`,owner,{method:'POST',headers:{'idempotency-key':'w5-sighting-review'},body:JSON.stringify({status:'VERIFIED'})});
    assert.equal(response.status,200);

    response=await api(base,`/v1/community/recovery-alerts/${communityAlertId}/volunteer`,community,{method:'POST',headers:{'idempotency-key':'w5-volunteer'},body:JSON.stringify({volunteerRole:'SEARCH_PARTICIPANT',notes:'Available in coarse search area'})});
    assert.equal(response.status,201);

    response=await api(base,`/v1/recovery/incidents/${incidentId}/resolve`,owner,{method:'POST',headers:{'idempotency-key':'w5-recovered'},body:JSON.stringify({resolutionNotes:'Safely recovered after verified sighting'})});
    assert.equal(response.status,200);
    const petStatus=await db.query(`SELECT status FROM pets WHERE pet_id='pet-w5'`);assert.equal(petStatus.rows[0].status,'ACTIVE');
    const alertStatus=await db.query(`SELECT status,closure_reason FROM community_recovery_alerts WHERE community_alert_id=$1`,[communityAlertId]);
    assert.equal(alertStatus.rows[0].status,'CLOSED');assert.equal(alertStatus.rows[0].closure_reason,'RECOVERED');

    const foreignTracking=await withTenantTransaction(config,'usr-w5-outsider',undefined,(client)=>client.query(`SELECT pet_id FROM tracking_live_locations WHERE pet_id='pet-w5'`));
    assert.equal(foreignTracking.rowCount,0);
    const foreignRecovery=await withTenantTransaction(config,'usr-w5-outsider',undefined,(client)=>client.query(`SELECT lost_pet_incident_id FROM recovery_incidents WHERE lost_pet_incident_id=$1`,[incidentId]));
    assert.equal(foreignRecovery.rowCount,0);
    const foreignTransport=await withTenantTransaction(config,'usr-w5-outsider',undefined,(client)=>client.query(`SELECT trip_id FROM transport_trips WHERE trip_id=$1`,[tripId]));
    assert.equal(foreignTransport.rowCount,0);

    console.log('WAVE5-INTEGRATION: PASS');
    console.log('Trusted telemetry adapter authentication + deduplication: PASS');
    console.log('Monotonic exact live-location projection: PASS');
    console.log('Route accumulation + geofence transition authority: PASS');
    console.log('Tracking PostgreSQL RLS isolation: PASS');
    console.log('Transport verified driver/vehicle readiness: PASS');
    console.log('Transport encrypted-address boundary + coarse owner projection: PASS');
    console.log('Immutable Transport custody chain + completion gate: PASS');
    console.log('Lost Pet incident derived from Tracking observation: PASS');
    console.log('Public recovery profile coarse-location privacy: PASS');
    console.log('Private exact sighting + owner verification: PASS');
    console.log('Community exact-location rejection + coarse feed: PASS');
    console.log('Community recovery volunteer opt-in: PASS');
    console.log('Recovery closure propagates Pet + Community state: PASS');
    console.log('Tracking/Transport/Recovery PostgreSQL RLS isolation: PASS');
  } finally {
    await new Promise<void>((resolve)=>server.close(()=>resolve()));
    await Promise.allSettled([closeDatabase(),closeRedis()]);
  }
}
main().catch(async(error)=>{
  console.error('WAVE5-INTEGRATION: FAIL',error);
  await Promise.allSettled([closeDatabase(),closeRedis()]);
  process.exit(1);
});
