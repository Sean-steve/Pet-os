import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export interface ProviderProfileRow {
  providerId: string;
  userId: string;
  displayName: string;
  professionalTitle?: string;
  category: string;
  verificationStatus: string;
  operationalStatus: string;
  visibilityStatus: string;
  primaryBusinessId?: string;
  version: number;
}

export interface OfferingRow {
  offeringId: string;
  providerId: string;
  businessId?: string;
  serviceTypeId: string;
  title: string;
  description: string;
  category: string;
  status: string;
  pricingModel: string;
  basePriceMinorUnits: number;
  currency: string;
  defaultDurationMinutes: number;
  locationTypes: string[];
  targetSpecies: string[];
  maxPetsPerBooking?: number;
  version: number;
}

const mapProvider = (row: any): ProviderProfileRow => ({
  providerId: row.provider_id,
  userId: row.user_id,
  displayName: row.display_name,
  professionalTitle: row.professional_title || undefined,
  category: row.category,
  verificationStatus: row.verification_status,
  operationalStatus: row.operational_status,
  visibilityStatus: row.visibility_status,
  primaryBusinessId: row.primary_business_id || undefined,
  version: Number(row.version),
});

const mapOffering = (row: any): OfferingRow => ({
  offeringId: row.offering_id,
  providerId: row.provider_id,
  businessId: row.business_id || undefined,
  serviceTypeId: row.service_type_id,
  title: row.title,
  description: row.description,
  category: row.category,
  status: row.status,
  pricingModel: row.pricing_model,
  basePriceMinorUnits: Number(row.base_price_minor_units),
  currency: row.currency,
  defaultDurationMinutes: Number(row.default_duration_minutes),
  locationTypes: row.location_types || [],
  targetSpecies: row.target_species || [],
  maxPetsPerBooking: row.max_pets_per_booking == null ? undefined : Number(row.max_pets_per_booking),
  version: Number(row.version),
});

export async function getProviderForActor(client: PoolClient, actorUserId: string): Promise<ProviderProfileRow | undefined> {
  const result = await client.query(
    `SELECT provider_id, user_id, display_name, professional_title, category, verification_status,
            operational_status, visibility_status, primary_business_id, version
       FROM provider_profiles WHERE user_id = $1 LIMIT 1`,
    [actorUserId],
  );
  return result.rowCount ? mapProvider(result.rows[0]) : undefined;
}

export async function createProviderProfile(
  client: PoolClient,
  input: { actorUserId: string; idempotencyKey: string; displayName: string; professionalTitle?: string; category: string; bio: string; yearsOfExperience: number; languages: string[] },
): Promise<{ provider: ProviderProfileRow; replayed: boolean }> {
  const scope='provider:create:self';
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records
      WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {provider:prior.rows[0].response_body as ProviderProfileRow,replayed:true};
  }

  const existing=await getProviderForActor(client,input.actorUserId);
  if(existing) throw Object.assign(new Error('PROVIDER_PROFILE_ALREADY_EXISTS'),{statusCode:409});

  const providerId=`provider-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO provider_profiles (
      provider_id,user_id,display_name,professional_title,category,bio,years_of_experience,languages,
      verification_status,operational_status,visibility_status,metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'PENDING_VERIFICATION','TEMPORARILY_INACTIVE','PRIVATE','{}'::jsonb)
    RETURNING provider_id,user_id,display_name,professional_title,category,verification_status,
      operational_status,visibility_status,primary_business_id,version`,
    [providerId,input.actorUserId,input.displayName,input.professionalTitle||null,input.category,input.bio,input.yearsOfExperience,JSON.stringify(input.languages)],
  );
  const provider=mapProvider(result.rows[0]);

  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ProviderProfile',$2,'ProviderProfileSubmitted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,provider.providerId,JSON.stringify({providerId:provider.providerId,userId:provider.userId,category:provider.category})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,provider.providerId,JSON.stringify(provider)],
  );
  return {provider,replayed:false};
}

export async function createServiceBusiness(
  client: PoolClient,
  input:{actorUserId:string;idempotencyKey:string;legalName:string;tradingName:string;businessType:string;contactEmail:string;contactPhone:string;websiteUrl?:string},
){
  const scope='business:create:self';
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {business:prior.rows[0].response_body,replayed:true};
  }
  const businessId=`business-${generateUUIDv7()}`;
  const membershipId=`business-membership-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO service_businesses(
      business_id,legal_name,trading_name,business_type,owner_user_id,verification_status,is_active,
      contact_email,contact_phone,website_url
    ) VALUES($1,$2,$3,$4,$5,'UNVERIFIED',true,$6,$7,$8)
    RETURNING business_id,legal_name,trading_name,business_type,owner_user_id,verification_status,is_active,contact_email,contact_phone,website_url,version`,
    [businessId,input.legalName,input.tradingName,input.businessType,input.actorUserId,input.contactEmail,input.contactPhone,input.websiteUrl||null],
  );
  await client.query(
    `INSERT INTO business_memberships(membership_id,business_id,user_id,role,is_active,can_manage_services,can_manage_schedule)
     VALUES($1,$2,$3,'OWNER',true,true,true)`,
    [membershipId,businessId,input.actorUserId],
  );
  const business={
    businessId:result.rows[0].business_id,
    legalName:result.rows[0].legal_name,
    tradingName:result.rows[0].trading_name,
    businessType:result.rows[0].business_type,
    ownerUserId:result.rows[0].owner_user_id,
    verificationStatus:result.rows[0].verification_status,
    isActive:result.rows[0].is_active,
    contactEmail:result.rows[0].contact_email,
    contactPhone:result.rows[0].contact_phone,
    websiteUrl:result.rows[0].website_url||undefined,
    version:Number(result.rows[0].version),
  };
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ServiceBusiness',$2,'ServiceBusinessCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,businessId,JSON.stringify({businessId,ownerUserId:input.actorUserId})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,businessId,JSON.stringify(business)],
  );
  return {business,replayed:false};
}

async function assertProviderManager(client:PoolClient,providerId:string,actorUserId:string){
  const result=await client.query(`SELECT petos_can_manage_provider($1,$2) AS allowed`,[providerId,actorUserId]);
  if(result.rows[0]?.allowed!==true) throw Object.assign(new Error('PROVIDER_MANAGE_DENIED'),{statusCode:403});
}

export async function createOffering(
  client:PoolClient,
  input:{
    actorUserId:string;idempotencyKey:string;providerId:string;businessId?:string;serviceTypeId:string;title:string;description:string;
    category:string;requestedStatus?:string;pricingModel:string;basePriceMinorUnits:number;currency:string;defaultDurationMinutes:number;
    locationTypes:string[];targetSpecies:string[];variants?:unknown[];prerequisites?:string[];maxPetsPerBooking?:number;
  },
):Promise<{offering:OfferingRow;replayed:boolean}>{
  await assertProviderManager(client,input.providerId,input.actorUserId);
  const providerResult=await client.query(
    `SELECT verification_status,operational_status FROM provider_profiles WHERE provider_id=$1 LIMIT 1`,[input.providerId],
  );
  if(!providerResult.rowCount) throw Object.assign(new Error('PROVIDER_NOT_FOUND'),{statusCode:404});
  if(input.businessId){
    const business=await client.query(
      `SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND is_active AND can_manage_services LIMIT 1`,
      [input.businessId,input.actorUserId],
    );
    if(!business.rowCount) throw Object.assign(new Error('BUSINESS_SERVICE_MANAGE_DENIED'),{statusCode:403});
  }
  const canActivate=providerResult.rows[0].verification_status==='VERIFIED' && providerResult.rows[0].operational_status==='ACTIVE';
  const status=input.requestedStatus==='ACTIVE' && canActivate ? 'ACTIVE' : 'DRAFT';
  const scope=`offering:create:${input.providerId}`;
  const requestFingerprint=fingerprint({...input,status});
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {offering:prior.rows[0].response_body as OfferingRow,replayed:true};
  }
  const offeringId=`offering-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO provider_service_offerings(
      offering_id,provider_id,business_id,service_type_id,title,description,category,status,pricing_model,
      base_price_minor_units,currency,default_duration_minutes,location_types,target_species,variants,prerequisites,max_pets_per_booking
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17)
    RETURNING *`,
    [
      offeringId,input.providerId,input.businessId||null,input.serviceTypeId,input.title,input.description,input.category,status,input.pricingModel,
      input.basePriceMinorUnits,input.currency,input.defaultDurationMinutes,JSON.stringify(input.locationTypes),JSON.stringify(input.targetSpecies),
      JSON.stringify(input.variants||[]),JSON.stringify(input.prerequisites||[]),input.maxPetsPerBooking||null,
    ],
  );
  const offering=mapOffering(result.rows[0]);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ServiceOffering',$2,'ServiceOfferingCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,offeringId,JSON.stringify({offeringId,providerId:input.providerId,status})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,offeringId,JSON.stringify(offering)],
  );
  return {offering,replayed:false};
}

export async function listPublicOfferings(client:PoolClient,filter?:{category?:string}):Promise<OfferingRow[]>{
  const result=await client.query(
    `SELECT o.*
       FROM provider_service_offerings o
       JOIN provider_profiles p ON p.provider_id=o.provider_id
      WHERE o.status='ACTIVE'
        AND p.verification_status='VERIFIED'
        AND p.operational_status='ACTIVE'
        AND p.visibility_status='PUBLIC'
        AND ($1::text IS NULL OR o.category=$1)
      ORDER BY o.created_at DESC`,
    [filter?.category||null],
  );
  return result.rows.map(mapOffering);
}

export async function getOfferingForBooking(client:PoolClient,offeringId:string):Promise<OfferingRow & {providerUserId:string;providerDisplayName:string}>{
  const result=await client.query(
    `SELECT o.*,p.user_id AS provider_user_id,p.display_name AS provider_display_name
       FROM provider_service_offerings o
       JOIN provider_profiles p ON p.provider_id=o.provider_id
      WHERE o.offering_id=$1
        AND o.status='ACTIVE'
        AND p.verification_status='VERIFIED'
        AND p.operational_status='ACTIVE'
        AND p.visibility_status='PUBLIC'
      LIMIT 1`,
    [offeringId],
  );
  if(!result.rowCount) throw Object.assign(new Error('OFFERING_NOT_BOOKABLE'),{statusCode:409});
  return {...mapOffering(result.rows[0]),providerUserId:result.rows[0].provider_user_id,providerDisplayName:result.rows[0].provider_display_name};
}
