import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface ReviewRow {
  reviewId:string;eligibilityId:string;reviewerUserId:string;reviewerHouseholdId:string;providerId:string;businessId?:string;offeringId:string;
  serviceType:string;overallRating:number;dimensions:unknown[];structuredTags:string[];body:string;status:string;moderationStatus:string;
  publicIdentityMode:string;publicAuthorDisplayName:string;verifiedService:boolean;version:number;submittedAt:string;publishedAt?:string;
}
const mapReview=(row:any):ReviewRow=>({
  reviewId:row.review_id,eligibilityId:row.eligibility_id,reviewerUserId:row.reviewer_user_id,reviewerHouseholdId:row.reviewer_household_id,
  providerId:row.provider_id,businessId:row.business_id||undefined,offeringId:row.offering_id,serviceType:row.service_type,
  overallRating:Number(row.overall_rating),dimensions:row.dimensions||[],structuredTags:row.structured_tags||[],body:row.body,status:row.status,
  moderationStatus:row.moderation_status,publicIdentityMode:row.public_identity_mode,publicAuthorDisplayName:row.public_author_display_name,
  verifiedService:row.verified_service,version:Number(row.version),submittedAt:new Date(row.submitted_at).toISOString(),
  publishedAt:row.published_at?new Date(row.published_at).toISOString():undefined,
});

export async function listReviewEligibilities(client:PoolClient,actorUserId:string){
  const result=await client.query(
    `SELECT eligibility_id,booking_id,reviewer_user_id,reviewer_household_id,provider_id,business_id,offering_id,service_type,
            service_execution_reference,service_snapshot,eligible_at,expires_at,status,consumed_by_review_id,eligibility_reason
       FROM review_eligibilities WHERE reviewer_user_id=$1 ORDER BY eligible_at DESC`,
    [actorUserId],
  );
  return result.rows.map((row:any)=>({
    eligibilityId:row.eligibility_id,bookingId:row.booking_id,reviewerUserId:row.reviewer_user_id,reviewerHouseholdId:row.reviewer_household_id,
    providerId:row.provider_id,businessId:row.business_id||undefined,offeringId:row.offering_id,serviceType:row.service_type,
    serviceExecutionReference:row.service_execution_reference,serviceSnapshot:row.service_snapshot,eligibleAt:new Date(row.eligible_at).toISOString(),
    expiresAt:new Date(row.expires_at).toISOString(),status:row.status,consumedByReviewId:row.consumed_by_review_id||undefined,eligibilityReason:row.eligibility_reason,
  }));
}

export async function submitReview(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;eligibilityId:string;overallRating:number;dimensions:unknown[];structuredTags:string[];body:string;publicIdentityMode:string;
}):Promise<{review:ReviewRow;replayed:boolean}>{
  if(!Number.isInteger(input.overallRating)||input.overallRating<1||input.overallRating>5) throw Object.assign(new Error('REVIEW_RATING_INVALID'),{statusCode:400});
  const cleanBody=input.body.trim();
  if(cleanBody.length<2||cleanBody.length>5000) throw Object.assign(new Error('REVIEW_BODY_INVALID'),{statusCode:400});
  const scope=`review:submit:${input.eligibilityId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {review:prior.rows[0].response_body as ReviewRow,replayed:true};
  }

  const eligibilityResult=await client.query(`SELECT * FROM review_eligibilities WHERE eligibility_id=$1 FOR UPDATE`,[input.eligibilityId]);
  if(!eligibilityResult.rowCount) throw Object.assign(new Error('REVIEW_ELIGIBILITY_NOT_FOUND'),{statusCode:404});
  const e=eligibilityResult.rows[0];
  if(e.reviewer_user_id!==input.actorUserId) throw Object.assign(new Error('REVIEW_ELIGIBILITY_ACTOR_MISMATCH'),{statusCode:403});
  if(e.status!=='ELIGIBLE') throw Object.assign(new Error('REVIEW_ELIGIBILITY_NOT_ACTIVE'),{statusCode:409});
  if(new Date(e.expires_at).getTime()<Date.now()) {
    await client.query(`UPDATE review_eligibilities SET status='EXPIRED',updated_at=now() WHERE eligibility_id=$1`,[input.eligibilityId]);
    throw Object.assign(new Error('REVIEW_ELIGIBILITY_EXPIRED'),{statusCode:409});
  }
  const booking=await client.query(`SELECT status,owner_user_id FROM bookings WHERE booking_id=$1 LIMIT 1`,[e.booking_id]);
  if(!booking.rowCount||booking.rows[0].status!=='COMPLETED'||booking.rows[0].owner_user_id!==input.actorUserId){
    throw Object.assign(new Error('VERIFIED_SERVICE_REVIEW_REQUIRES_COMPLETED_BOOKING'),{statusCode:409});
  }
  const provider=await client.query(`SELECT user_id FROM provider_profiles WHERE provider_id=$1 LIMIT 1`,[e.provider_id]);
  if(provider.rows[0]?.user_id===input.actorUserId) throw Object.assign(new Error('PROVIDER_SELF_REVIEW_FORBIDDEN'),{statusCode:403});
  if(e.business_id){
    const staff=await client.query(`SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active LIMIT 1`,[e.business_id,input.actorUserId]);
    if(staff.rowCount) throw Object.assign(new Error('BUSINESS_STAFF_REVIEW_FORBIDDEN'),{statusCode:403});
  }
  const reviewId=`review-${generateUUIDv7()}`;
  const revisionId=`review-revision-${generateUUIDv7()}`;
  const now=new Date().toISOString();
  const displayName=input.publicIdentityMode==='ANONYMOUS_TO_PUBLIC'?'Verified customer':'Verified customer';
  const result=await client.query(
    `INSERT INTO reviews(
      review_id,eligibility_id,reviewer_user_id,reviewer_household_id,provider_id,business_id,offering_id,service_type,
      overall_rating,dimensions,structured_tags,body,status,moderation_status,public_identity_mode,public_author_display_name,
      verified_service,service_snapshot,submitted_at,published_at
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,'PUBLISHED','APPROVED',$13,$14,true,$15::jsonb,$16,$16)
    RETURNING *`,
    [reviewId,input.eligibilityId,input.actorUserId,e.reviewer_household_id,e.provider_id,e.business_id||null,e.offering_id,e.service_type,input.overallRating,JSON.stringify(input.dimensions),JSON.stringify(input.structuredTags),cleanBody,input.publicIdentityMode,displayName,JSON.stringify(e.service_snapshot),now],
  );
  const review=mapReview(result.rows[0]);
  await client.query(
    `INSERT INTO review_revisions(revision_id,review_id,version,snapshot,author_user_id)
     VALUES($1,$2,1,$3::jsonb,$4)`,
    [revisionId,reviewId,JSON.stringify(review),input.actorUserId],
  );
  await client.query(
    `UPDATE review_eligibilities SET status='CONSUMED',consumed_by_review_id=$1,updated_at=now() WHERE eligibility_id=$2`,
    [reviewId,input.eligibilityId],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'Review',$2,'ReviewPublished',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,reviewId,JSON.stringify({reviewId,bookingId:e.booking_id,providerId:e.provider_id,overallRating:input.overallRating,verifiedService:true})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,reviewId,JSON.stringify(review)],
  );
  return {review,replayed:false};
}

export async function listPublicReviews(client:PoolClient,providerId:string):Promise<ReviewRow[]>{
  const result=await client.query(
    `SELECT * FROM reviews WHERE provider_id=$1 AND status IN ('PUBLISHED','LIMITED') ORDER BY published_at DESC`,
    [providerId],
  );
  return result.rows.map(mapReview);
}

export async function respondToReview(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;reviewId:string;body:string;
}){
  const body=input.body.trim();
  if(body.length<2||body.length>3000) throw Object.assign(new Error('REVIEW_RESPONSE_BODY_INVALID'),{statusCode:400});
  const reviewResult=await client.query(`SELECT * FROM reviews WHERE review_id=$1 LIMIT 1`,[input.reviewId]);
  if(!reviewResult.rowCount) throw Object.assign(new Error('REVIEW_NOT_FOUND'),{statusCode:404});
  const review=reviewResult.rows[0];
  if(!['PUBLISHED','LIMITED'].includes(review.status)) throw Object.assign(new Error('REVIEW_RESPONSE_REQUIRES_PUBLISHED_REVIEW'),{statusCode:409});
  const manager=await client.query(`SELECT petos_can_manage_provider($1,$2) AS allowed`,[review.provider_id,input.actorUserId]);
  if(manager.rows[0]?.allowed!==true) throw Object.assign(new Error('REVIEW_RESPONSE_PROVIDER_DENIED'),{statusCode:403});
  const scope=`review:response:${input.reviewId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {response:prior.rows[0].response_body,replayed:true};
  }
  const exists=await client.query(`SELECT 1 FROM review_responses WHERE review_id=$1`,[input.reviewId]);
  if(exists.rowCount) throw Object.assign(new Error('REVIEW_RESPONSE_ALREADY_EXISTS'),{statusCode:409});
  const responseId=`review-response-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO review_responses(response_id,review_id,provider_id,business_id,responder_user_id,responder_role,body,status)
     VALUES($1,$2,$3,$4,$5,'REVIEWED_PROVIDER',$6,'PUBLISHED')
     RETURNING *`,
    [responseId,input.reviewId,review.provider_id,review.business_id||null,input.actorUserId,body],
  );
  const response={
    responseId:result.rows[0].response_id,reviewId:result.rows[0].review_id,providerId:result.rows[0].provider_id,
    businessId:result.rows[0].business_id||undefined,responderUserId:result.rows[0].responder_user_id,
    responderRole:result.rows[0].responder_role,body:result.rows[0].body,status:result.rows[0].status,version:Number(result.rows[0].version),
  };
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ReviewResponse',$2,'ReviewResponsePublished',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,responseId,JSON.stringify({responseId,reviewId:input.reviewId,providerId:review.provider_id})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,responseId,JSON.stringify(response)],
  );
  return {response,replayed:false};
}
