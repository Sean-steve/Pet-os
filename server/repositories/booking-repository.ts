import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';
import { getOfferingForBooking } from './provider-repository';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface BookingRow {
  bookingId:string;ownerUserId:string;householdId:string;providerId:string;businessId?:string;offeringId:string;
  status:string;confirmationMode:string;startAt:string;endAt:string;serviceDurationMinutes:number;timezone:string;
  petIds:string[];serviceSnapshot:Record<string,unknown>;priceSnapshot:Record<string,unknown>;instructions:Record<string,unknown>;
  concurrencyVersion:number;requestedAt:string;confirmedAt?:string;completedAt?:string;createdAt:string;updatedAt:string;
}

const mapBooking=(row:any):BookingRow=>({
  bookingId:row.booking_id,ownerUserId:row.owner_user_id,householdId:row.household_id,providerId:row.provider_id,
  businessId:row.business_id||undefined,offeringId:row.offering_id,status:row.status,confirmationMode:row.confirmation_mode,
  startAt:new Date(row.start_at).toISOString(),endAt:new Date(row.end_at).toISOString(),serviceDurationMinutes:Number(row.service_duration_minutes),
  timezone:row.timezone,petIds:row.pet_ids||[],serviceSnapshot:row.service_snapshot||{},priceSnapshot:row.price_snapshot||{},
  instructions:row.instructions||{},concurrencyVersion:Number(row.concurrency_version),requestedAt:new Date(row.requested_at).toISOString(),
  confirmedAt:row.confirmed_at?new Date(row.confirmed_at).toISOString():undefined,
  completedAt:row.completed_at?new Date(row.completed_at).toISOString():undefined,
  createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),
});

async function assertHouseholdBookingOwner(client:PoolClient,householdId:string,actorUserId:string,petIds:string[]){
  const membership=await client.query(
    `SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE' LIMIT 1`,
    [householdId,actorUserId],
  );
  if(!membership.rowCount || !['HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN'].includes(String(membership.rows[0].role))){
    throw Object.assign(new Error('BOOKING_OWNER_ACCESS_DENIED'),{statusCode:403});
  }
  const pets=await client.query(
    `SELECT pet_id FROM pets WHERE household_id=$1 AND pet_id=ANY($2::text[]) AND status='ACTIVE'`,
    [householdId,petIds],
  );
  if(pets.rowCount!==new Set(petIds).size) throw Object.assign(new Error('BOOKING_PET_SCOPE_INVALID'),{statusCode:400});
}

export async function createBooking(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;householdId:string;offeringId:string;petIds:string[];
  startAt:string;endAt:string;timezone:string;instructions:Record<string,unknown>;
}):Promise<{booking:BookingRow;replayed:boolean}>{
  const uniquePetIds=[...new Set(input.petIds)];
  if(!uniquePetIds.length) throw Object.assign(new Error('BOOKING_PETS_REQUIRED'),{statusCode:400});
  await assertHouseholdBookingOwner(client,input.householdId,input.actorUserId,uniquePetIds);
  const offering=await getOfferingForBooking(client,input.offeringId);
  if(offering.providerUserId===input.actorUserId) throw Object.assign(new Error('PROVIDER_SELF_BOOKING_FORBIDDEN'),{statusCode:409});
  if(offering.maxPetsPerBooking && uniquePetIds.length>offering.maxPetsPerBooking) throw Object.assign(new Error('BOOKING_PET_CAPACITY_EXCEEDED'),{statusCode:409});
  const start=new Date(input.startAt),end=new Date(input.endAt);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start) throw Object.assign(new Error('BOOKING_TIME_RANGE_INVALID'),{statusCode:400});
  const duration=Math.round((end.getTime()-start.getTime())/60000);
  const scope=`booking:create:${input.householdId}`;
  const requestFingerprint=fingerprint({...input,petIds:uniquePetIds});
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {booking:prior.rows[0].response_body as BookingRow,replayed:true};
  }
  const bookingId=`booking-${generateUUIDv7()}`;
  const amount=offering.basePriceMinorUnits * (offering.pricingModel==='PER_PET'?uniquePetIds.length:1);
  const serviceSnapshot={
    serviceOfferingId:offering.offeringId,title:offering.title,category:offering.category,
    serviceDescription:offering.description,defaultDurationMinutes:offering.defaultDurationMinutes,
    providerDisplayName:offering.providerDisplayName,snapshotTimestamp:new Date().toISOString(),
  };
  const priceSnapshot={amountMinorUnits:amount,currency:offering.currency,pricingModel:offering.pricingModel,baseAmountMinorUnits:offering.basePriceMinorUnits,petCount:uniquePetIds.length,taxIncluded:false,feeBasisReference:`booking:${bookingId}`};
  const cancellationPolicySnapshot={policyTier:'STANDARD',freeCancellationCutoffHours:24,lateCancellationNotice:'Late cancellation may require remediation.',description:'Server-captured booking policy snapshot.'};
  const result=await client.query(
    `INSERT INTO bookings(
      booking_id,owner_user_id,household_id,provider_id,business_id,offering_id,status,confirmation_mode,start_at,end_at,
      service_duration_minutes,timezone,pet_count,pet_ids,service_snapshot,price_snapshot,cancellation_policy_snapshot,instructions
    ) VALUES($1,$2,$3,$4,$5,$6,'PENDING_PROVIDER','PROVIDER_APPROVAL_REQUIRED',$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb)
    RETURNING *`,
    [
      bookingId,input.actorUserId,input.householdId,offering.providerId,offering.businessId||null,offering.offeringId,start.toISOString(),end.toISOString(),
      duration,input.timezone,uniquePetIds.length,JSON.stringify(uniquePetIds),JSON.stringify(serviceSnapshot),JSON.stringify(priceSnapshot),
      JSON.stringify(cancellationPolicySnapshot),JSON.stringify(input.instructions),
    ],
  );
  for(const petId of uniquePetIds){
    await client.query(`INSERT INTO booking_pet_links(booking_id,pet_id) VALUES($1,$2)`,[bookingId,petId]);
  }
  const booking=mapBooking(result.rows[0]);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'Booking',$2,'BookingRequested',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,bookingId,JSON.stringify({bookingId,householdId:booking.householdId,providerId:booking.providerId,offeringId:booking.offeringId,status:booking.status})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,bookingId,JSON.stringify(booking)],
  );
  return {booking,replayed:false};
}

export async function getBooking(client:PoolClient,bookingId:string,actorUserId:string):Promise<BookingRow>{
  const allowed=await client.query(`SELECT petos_can_access_booking($1,$2) AS allowed`,[bookingId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('BOOKING_ACCESS_DENIED'),{statusCode:403});
  const result=await client.query(`SELECT * FROM bookings WHERE booking_id=$1 LIMIT 1`,[bookingId]);
  if(!result.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  return mapBooking(result.rows[0]);
}

export async function listBookingsForActor(client:PoolClient,actorUserId:string):Promise<BookingRow[]>{
  const result=await client.query(
    `SELECT DISTINCT b.*
       FROM bookings b
       LEFT JOIN provider_profiles p ON p.provider_id=b.provider_id
       LEFT JOIN business_memberships bm ON bm.business_id=b.business_id AND bm.user_id=$1 AND bm.is_active
      WHERE b.owner_user_id=$1 OR p.user_id=$1 OR bm.user_id IS NOT NULL
      ORDER BY b.start_at DESC`,
    [actorUserId],
  );
  return result.rows.map(mapBooking);
}

function allowedTransition(status:string,next:string,owner:boolean,provider:boolean):boolean{
  const ownerTransitions:Record<string,string[]>={
    PENDING_PROVIDER:['CANCELLED_BY_OWNER'],CONFIRMED:['CANCELLED_BY_OWNER'],RESCHEDULE_PENDING:['CANCELLED_BY_OWNER'],
  };
  const providerTransitions:Record<string,string[]>={
    PENDING_PROVIDER:['CONFIRMED','DECLINED','CANCELLED_BY_PROVIDER'],
    CONFIRMED:['IN_PROGRESS','CANCELLED_BY_PROVIDER','NO_SHOW'],
    IN_PROGRESS:['COMPLETED','DISPUTED'],
  };
  return (owner && (ownerTransitions[status]||[]).includes(next)) || (provider && (providerTransitions[status]||[]).includes(next));
}

export async function transitionBooking(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;bookingId:string;expectedVersion:number;nextStatus:string;reason:string;
}):Promise<{booking:BookingRow;replayed:boolean}>{
  const scope=`booking:transition:${input.bookingId}:${input.expectedVersion}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {booking:prior.rows[0].response_body as BookingRow,replayed:true};
  }
  const currentResult=await client.query(
    `SELECT b.*,p.user_id AS provider_user_id,
       EXISTS(SELECT 1 FROM business_memberships bm WHERE bm.business_id=b.business_id AND bm.user_id=$2 AND bm.is_active AND bm.can_manage_schedule) AS business_scheduler
       FROM bookings b JOIN provider_profiles p ON p.provider_id=b.provider_id
      WHERE b.booking_id=$1 FOR UPDATE`,
    [input.bookingId,input.actorUserId],
  );
  if(!currentResult.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  const row=currentResult.rows[0];
  const owner=row.owner_user_id===input.actorUserId;
  const provider=row.provider_user_id===input.actorUserId || row.business_scheduler===true;
  if(!owner&&!provider) throw Object.assign(new Error('BOOKING_TRANSITION_DENIED'),{statusCode:403});
  const current=mapBooking(row);
  if(current.concurrencyVersion!==input.expectedVersion) throw Object.assign(new Error('BOOKING_VERSION_CONFLICT'),{statusCode:409});
  if(!allowedTransition(current.status,input.nextStatus,owner,provider)) throw Object.assign(new Error('BOOKING_STATUS_TRANSITION_INVALID'),{statusCode:409});
  if(input.nextStatus==='COMPLETED'){
    const engagement=await client.query(`SELECT status FROM professional_care_engagements WHERE booking_id=$1 LIMIT 1`,[input.bookingId]);
    if(engagement.rowCount && engagement.rows[0].status!=='COMPLETED'){
      throw Object.assign(new Error('BOOKING_COMPLETION_REQUIRES_CARE_COMPLETION'),{statusCode:409});
    }
  }
  const nextVersion=current.concurrencyVersion+1;
  const result=await client.query(
    `UPDATE bookings SET status=$1,concurrency_version=$2,updated_at=now(),
       confirmed_at=CASE WHEN $1='CONFIRMED' THEN now() ELSE confirmed_at END,
       completed_at=CASE WHEN $1='COMPLETED' THEN now() ELSE completed_at END,
       cancelled_at=CASE WHEN $1 IN ('CANCELLED_BY_OWNER','CANCELLED_BY_PROVIDER') THEN now() ELSE cancelled_at END
     WHERE booking_id=$3 AND concurrency_version=$4 RETURNING *`,
    [input.nextStatus,nextVersion,input.bookingId,input.expectedVersion],
  );
  if(!result.rowCount) throw Object.assign(new Error('BOOKING_VERSION_CONFLICT'),{statusCode:409});
  const booking=mapBooking(result.rows[0]);
  await client.query(
    `INSERT INTO booking_revisions(revision_id,booking_id,prior_version,new_version,previous_status,new_status,previous_snapshot,new_snapshot,reason,changed_by)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,
    [`booking-revision-${generateUUIDv7()}`,booking.bookingId,current.concurrencyVersion,booking.concurrencyVersion,current.status,booking.status,JSON.stringify(current),JSON.stringify(booking),input.reason,input.actorUserId],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'Booking',$2,'BookingStatusChanged',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,booking.bookingId,JSON.stringify({bookingId:booking.bookingId,from:current.status,to:booking.status,version:booking.concurrencyVersion})],
  );
  if(booking.status==='COMPLETED'){
    await ensureReviewEligibility(client,booking);
  }
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,booking.bookingId,JSON.stringify(booking)],
  );
  return {booking,replayed:false};
}

async function ensureReviewEligibility(client:PoolClient,booking:BookingRow){
  const exists=await client.query(`SELECT 1 FROM review_eligibilities WHERE booking_id=$1`,[booking.bookingId]);
  if(exists.rowCount) return;
  const eligibilityId=`review-eligibility-${generateUUIDv7()}`;
  const eligibleAt=new Date();
  const expiresAt=new Date(eligibleAt.getTime()+30*24*60*60*1000);
  const serviceType=String((booking.serviceSnapshot as any).category||'PET_CARE');
  const snapshot={...booking.serviceSnapshot,bookingId:booking.bookingId,completedAt:booking.completedAt,executionReference:`booking:${booking.bookingId}`,isPartialService:false};
  await client.query(
    `INSERT INTO review_eligibilities(
      eligibility_id,booking_id,reviewer_user_id,reviewer_household_id,provider_id,business_id,offering_id,service_type,
      service_execution_reference,service_snapshot,eligible_at,expires_at,status,eligibility_reason
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,'ELIGIBLE',$13)`,
    [eligibilityId,booking.bookingId,booking.ownerUserId,booking.householdId,booking.providerId,booking.businessId||null,booking.offeringId,serviceType,`booking:${booking.bookingId}`,JSON.stringify(snapshot),eligibleAt.toISOString(),expiresAt.toISOString(),'Completed verified Pet OS booking'],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ReviewEligibility',$2,'ReviewEligibilityGranted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,eligibilityId,JSON.stringify({eligibilityId,bookingId:booking.bookingId,reviewerUserId:booking.ownerUserId,providerId:booking.providerId})],
  );
}
