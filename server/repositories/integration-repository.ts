import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const ALLOWED_SCOPES = new Set([
  'pet:profile:read','care:read','booking:read','tracker:health:read','command-center:read','webhook:manage',
]);
const PUBLIC_EVENTS = new Set([
  'pet.profile.updated','care.status.changed','booking.status.changed','tracker.health.changed','command-center.attention.changed',
]);

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function httpError(message:string,statusCode:number){return Object.assign(new Error(message),{statusCode});}
function unique(values:string[]){return [...new Set(values)];}
function assertScopes(scopes:string[]){
  if(scopes.length>20||scopes.some(s=>!ALLOWED_SCOPES.has(s)))throw httpError('INTEGRATION_SCOPE_NOT_ALLOWED',400);
  return unique(scopes);
}
async function audit(client:PoolClient,input:{appId?:string;installationId?:string;resourceType:string;resourceId?:string;outcome:'ALLOWED'|'DENIED'|'SUCCESS'|'FAILURE';reason?:string}){
  await client.query(
    `INSERT INTO integration_audit_events(audit_event_id,developer_app_id,installation_id,resource_type,resource_id,outcome,reason)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [`integration-audit-${generateUUIDv7()}`,input.appId||null,input.installationId||null,input.resourceType,input.resourceId||null,input.outcome,input.reason||null],
  );
}

export async function createDeveloperApp(client:PoolClient,input:{
  actorUserId:string;name:string;description:string;requestedScopes:string[];redirectUris:string[];privacyPolicyUrl?:string;termsUrl?:string;
}){
  const scopes=assertScopes(input.requestedScopes);
  if(input.redirectUris.some(uri=>{try{const u=new URL(uri);return !['https:','http:'].includes(u.protocol);}catch{return true;}}))throw httpError('INTEGRATION_REDIRECT_URI_INVALID',400);
  const developerAppId=`developer-app-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO integration_developer_apps(
      developer_app_id,owner_user_id,name,description,app_type,status,requested_scopes,approved_scopes,redirect_uris,privacy_policy_url,terms_url
     ) VALUES($1,$2,$3,$4,'THIRD_PARTY','UNDER_REVIEW',$5::jsonb,'[]'::jsonb,$6::jsonb,$7,$8) RETURNING *`,
    [developerAppId,input.actorUserId,input.name,input.description,JSON.stringify(scopes),JSON.stringify(unique(input.redirectUris)),input.privacyPolicyUrl||null,input.termsUrl||null],
  );
  await audit(client,{appId:developerAppId,resourceType:'DEVELOPER_APP',resourceId:developerAppId,outcome:'SUCCESS',reason:'APP_SUBMITTED_FOR_REVIEW'});
  return result.rows[0];
}

export async function reviewDeveloperApp(client:PoolClient,input:{
  developerAppId:string;reviewerUserId:string;approved:boolean;approvedScopes:string[];
}){
  const app=await client.query(`SELECT * FROM integration_developer_apps WHERE developer_app_id=$1 FOR UPDATE`,[input.developerAppId]);
  if(!app.rowCount)throw httpError('DEVELOPER_APP_NOT_FOUND',404);
  const scopes=assertScopes(input.approvedScopes);
  const requested=new Set<string>(app.rows[0].requested_scopes||[]);
  if(scopes.some(s=>!requested.has(s)))throw httpError('INTEGRATION_APPROVED_SCOPE_NOT_REQUESTED',400);
  const result=await client.query(
    `UPDATE integration_developer_apps SET status=$2,approved_scopes=$3::jsonb,reviewed_at=now(),reviewed_by=$4,updated_at=now(),version=version+1
     WHERE developer_app_id=$1 RETURNING *`,
    [input.developerAppId,input.approved?'ACTIVE':'REVOKED',JSON.stringify(input.approved?scopes:[]),input.reviewerUserId],
  );
  await audit(client,{appId:input.developerAppId,resourceType:'DEVELOPER_APP',resourceId:input.developerAppId,outcome:input.approved?'SUCCESS':'DENIED',reason:input.approved?'APP_APPROVED':'APP_REJECTED'});
  return result.rows[0];
}

export async function installDeveloperApp(client:PoolClient,input:{
  actorUserId:string;developerAppId:string;householdId:string;grantedScopes:string[];
}){
  const member=await client.query(
    `SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE' LIMIT 1`,
    [input.householdId,input.actorUserId],
  );
  if(!member.rowCount||!['HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN'].includes(String(member.rows[0].role)))throw httpError('INTEGRATION_INSTALLATION_REQUIRES_HOUSEHOLD_ADMIN',403);
  const app=await client.query(`SELECT * FROM integration_developer_apps WHERE developer_app_id=$1 AND status='ACTIVE' LIMIT 1`,[input.developerAppId]);
  if(!app.rowCount)throw httpError('ACTIVE_DEVELOPER_APP_REQUIRED',409);
  const scopes=assertScopes(input.grantedScopes);
  const approved=new Set<string>(app.rows[0].approved_scopes||[]);
  if(scopes.some(s=>!approved.has(s)))throw httpError('INTEGRATION_SCOPE_NOT_APPROVED',400);
  const existing=await client.query(`SELECT installation_id,status FROM integration_installations WHERE developer_app_id=$1 AND household_id=$2 LIMIT 1`,[input.developerAppId,input.householdId]);
  if(existing.rowCount){
    if(existing.rows[0].status==='ACTIVE')return {installationId:existing.rows[0].installation_id,replayed:true};
    const updated=await client.query(
      `UPDATE integration_installations SET granted_scopes=$3::jsonb,status='ACTIVE',installed_by_user_id=$4,updated_at=now(),revoked_at=NULL,revoked_by=NULL
       WHERE developer_app_id=$1 AND household_id=$2 RETURNING *`,
      [input.developerAppId,input.householdId,JSON.stringify(scopes),input.actorUserId],
    );
    return {installation:updated.rows[0],replayed:false};
  }
  const installationId=`integration-installation-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO integration_installations(installation_id,developer_app_id,household_id,installed_by_user_id,granted_scopes,status)
     VALUES($1,$2,$3,$4,$5::jsonb,'ACTIVE') RETURNING *`,
    [installationId,input.developerAppId,input.householdId,input.actorUserId,JSON.stringify(scopes)],
  );
  await audit(client,{appId:input.developerAppId,installationId,resourceType:'INSTALLATION',resourceId:installationId,outcome:'SUCCESS',reason:'HOUSEHOLD_CONSENT_GRANTED'});
  return {installation:result.rows[0],replayed:false};
}

export async function createIntegrationCredential(client:PoolClient,input:{
  actorUserId:string;installationId:string;expiresAt?:string;rateLimitPerMinute:number;
}){
  const access=await client.query(`SELECT petos_can_access_installation($1,$2) AS allowed`,[input.installationId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('INTEGRATION_CREDENTIAL_ACCESS_DENIED',403);
  const installation=await client.query(
    `SELECT i.*,a.status AS app_status FROM integration_installations i JOIN integration_developer_apps a ON a.developer_app_id=i.developer_app_id
     WHERE i.installation_id=$1 LIMIT 1`,
    [input.installationId],
  );
  if(!installation.rowCount||installation.rows[0].status!=='ACTIVE'||installation.rows[0].app_status!=='ACTIVE')throw httpError('ACTIVE_INTEGRATION_INSTALLATION_REQUIRED',409);
  if(!Number.isInteger(input.rateLimitPerMinute)||input.rateLimitPerMinute<1||input.rateLimitPerMinute>1000)throw httpError('INTEGRATION_RATE_LIMIT_INVALID',400);
  const raw=`petos_int_${randomBytes(24).toString('base64url')}`;
  const credentialId=`integration-credential-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO integration_api_credentials(credential_id,developer_app_id,installation_id,secret_prefix,secret_hash,scopes,rate_limit_per_minute,status,expires_at)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,'ACTIVE',$8)`,
    [credentialId,installation.rows[0].developer_app_id,input.installationId,raw.slice(0,14),hash(raw),JSON.stringify(installation.rows[0].granted_scopes||[]),input.rateLimitPerMinute,input.expiresAt||null],
  );
  await audit(client,{appId:installation.rows[0].developer_app_id,installationId:input.installationId,resourceType:'API_CREDENTIAL',resourceId:credentialId,outcome:'SUCCESS',reason:'CREDENTIAL_CREATED'});
  return {credentialId,token:raw,tokenPrefix:raw.slice(0,14),scopes:installation.rows[0].granted_scopes||[],rateLimitPerMinute:input.rateLimitPerMinute,expiresAt:input.expiresAt};
}

export interface IntegrationIdentity {
  credentialId:string;
  developerAppId:string;
  installationId:string;
  householdId:string;
  scopes:string[];
  rateLimitPerMinute:number;
}

export async function authenticateIntegration(client:PoolClient,rawToken:string,requiredScope:string):Promise<IntegrationIdentity>{
  if(!rawToken||!rawToken.startsWith('petos_int_'))throw httpError('INTEGRATION_AUTHENTICATION_REQUIRED',401);
  const result=await client.query(
    `SELECT c.*,i.household_id,i.status AS installation_status,i.granted_scopes,a.status AS app_status
     FROM integration_api_credentials c
     JOIN integration_installations i ON i.installation_id=c.installation_id
     JOIN integration_developer_apps a ON a.developer_app_id=c.developer_app_id
     WHERE c.secret_hash=$1 LIMIT 1`,
    [hash(rawToken)],
  );
  if(!result.rowCount)throw httpError('INTEGRATION_CREDENTIAL_INVALID',401);
  const row=result.rows[0];
  if(row.status!=='ACTIVE'||row.installation_status!=='ACTIVE'||row.app_status!=='ACTIVE'||(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()))throw httpError('INTEGRATION_CREDENTIAL_INACTIVE',401);
  const scopes=(row.scopes||[]) as string[];
  if(!scopes.includes(requiredScope)) {
    await audit(client,{appId:row.developer_app_id,installationId:row.installation_id,resourceType:'API_SCOPE',resourceId:requiredScope,outcome:'DENIED',reason:'SCOPE_NOT_GRANTED'});
    throw httpError('INTEGRATION_SCOPE_DENIED',403);
  }
  await client.query(`UPDATE integration_api_credentials SET last_used_at=now() WHERE credential_id=$1`,[row.credential_id]);
  return {credentialId:row.credential_id,developerAppId:row.developer_app_id,installationId:row.installation_id,householdId:row.household_id,scopes,rateLimitPerMinute:Number(row.rate_limit_per_minute)};
}

export async function integrationPetProfiles(client:PoolClient,identity:IntegrationIdentity){
  const result=await client.query(
    `SELECT pet_id,name,species_code AS species,breed_code AS breed,lifecycle_stage,status
     FROM pets WHERE household_id=$1 AND status<>'ARCHIVED' ORDER BY name`,
    [identity.householdId],
  );
  await audit(client,{appId:identity.developerAppId,installationId:identity.installationId,resourceType:'PET_PROFILE_PROJECTION',outcome:'SUCCESS'});
  return result.rows;
}

export async function integrationCare(client:PoolClient,identity:IntegrationIdentity){
  const result=await client.query(
    `SELECT record_id AS "careObligationId",pet_id,COALESCE(payload->>'title',payload->>'name','Care item') AS title,
      COALESCE(payload->>'category',record_type) AS category,occurred_at AS "dueAt",COALESCE(status,'UNKNOWN') AS status,
      COALESCE(payload->>'priority','NORMAL') AS priority
     FROM care_records WHERE household_id=$1 AND record_type='OBLIGATION' ORDER BY occurred_at LIMIT 200`,
    [identity.householdId],
  );
  await audit(client,{appId:identity.developerAppId,installationId:identity.installationId,resourceType:'CARE_PROJECTION',outcome:'SUCCESS'});
  return result.rows;
}

export async function integrationBookings(client:PoolClient,identity:IntegrationIdentity){
  const result=await client.query(
    `SELECT b.booking_id,b.pet_ids,COALESCE(b.service_snapshot->>'title','Pet service') AS service_title,b.status,b.start_at,b.end_at,b.timezone
     FROM bookings b WHERE b.household_id=$1 ORDER BY b.start_at DESC LIMIT 100`,
    [identity.householdId],
  );
  await audit(client,{appId:identity.developerAppId,installationId:identity.installationId,resourceType:'BOOKING_PROJECTION',outcome:'SUCCESS'});
  return result.rows;
}

export async function integrationTrackerHealth(client:PoolClient,identity:IntegrationIdentity){
  const result=await client.query(
    `SELECT d.device_id,a.pet_id,d.display_name,d.provider,d.model,d.connectivity_status,d.battery_status,d.battery_percent,d.last_seen_at
     FROM tracking_devices d LEFT JOIN tracking_device_assignments a ON a.device_id=d.device_id AND a.status='ACTIVE'
     WHERE d.household_id=$1 ORDER BY d.display_name`,
    [identity.householdId],
  );
  await audit(client,{appId:identity.developerAppId,installationId:identity.installationId,resourceType:'TRACKER_HEALTH_PROJECTION',outcome:'SUCCESS'});
  return result.rows;
}

export async function integrationCommandCenter(client:PoolClient,identity:IntegrationIdentity){
  const [pets,care,bookings,trackers,orders]=await Promise.all([
    client.query(`SELECT COUNT(*)::int AS count FROM pets WHERE household_id=$1 AND status<>'ARCHIVED'`,[identity.householdId]),
    client.query(`SELECT COUNT(*)::int AS due_today,COUNT(*) FILTER(WHERE occurred_at<now() AND COALESCE(status,'') NOT IN ('COMPLETED','DONE'))::int AS overdue
      FROM care_records WHERE household_id=$1 AND record_type='OBLIGATION' AND occurred_at<now()+interval '1 day'`,[identity.householdId]),
    client.query(`SELECT COUNT(*)::int AS count FROM bookings WHERE household_id=$1 AND start_at>=now() AND status NOT IN ('CANCELLED','COMPLETED')`,[identity.householdId]),
    client.query(`SELECT COUNT(*)::int AS count FROM tracking_devices WHERE household_id=$1 AND connectivity_status='ONLINE'`,[identity.householdId]),
    client.query(`SELECT COUNT(*)::int AS count FROM commerce_orders WHERE household_id=$1 AND status NOT IN ('COMPLETED','CLOSED','CANCELLED')`,[identity.householdId]),
  ]);
  await audit(client,{appId:identity.developerAppId,installationId:identity.installationId,resourceType:'COMMAND_CENTER_PROJECTION',outcome:'SUCCESS'});
  return {
    generatedAt:new Date().toISOString(),
    pets:pets.rows[0].count,dueToday:care.rows[0].due_today,overdueCare:care.rows[0].overdue,
    upcomingBookings:bookings.rows[0].count,unreadNotifications:0,onlineTrackers:trackers.rows[0].count,actionInbox:0,ordersInProgress:orders.rows[0].count,
  };
}

function safeWebhookUrl(endpoint:string){
  let u:URL;try{u=new URL(endpoint);}catch{throw httpError('WEBHOOK_URL_INVALID',400);}
  if(u.protocol!=='https:')throw httpError('WEBHOOK_HTTPS_REQUIRED',400);
  const host=u.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.local')||/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host))throw httpError('WEBHOOK_PRIVATE_NETWORK_FORBIDDEN',400);
  return u.toString();
}

export async function createWebhookSubscription(client:PoolClient,input:{
  actorUserId:string;installationId:string;endpointUrl:string;eventTypes:string[];
}){
  const access=await client.query(`SELECT petos_can_access_installation($1,$2) AS allowed`,[input.installationId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('WEBHOOK_MANAGEMENT_DENIED',403);
  const installation=await client.query(`SELECT * FROM integration_installations WHERE installation_id=$1 AND status='ACTIVE' LIMIT 1`,[input.installationId]);
  if(!installation.rowCount)throw httpError('ACTIVE_INTEGRATION_INSTALLATION_REQUIRED',409);
  if(!(installation.rows[0].granted_scopes||[]).includes('webhook:manage'))throw httpError('WEBHOOK_SCOPE_REQUIRED',403);
  const eventTypes=unique(input.eventTypes);
  if(!eventTypes.length||eventTypes.some(e=>!PUBLIC_EVENTS.has(e)))throw httpError('WEBHOOK_EVENT_TYPE_INVALID',400);
  const endpointUrl=safeWebhookUrl(input.endpointUrl);
  const secret=`whsec_${randomBytes(24).toString('base64url')}`;
  const webhookSubscriptionId=`webhook-sub-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO integration_webhook_subscriptions(
      webhook_subscription_id,installation_id,endpoint_url,event_types,signing_secret_hash,signing_secret_prefix,created_by,status
     ) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,'ACTIVE')`,
    [webhookSubscriptionId,input.installationId,endpointUrl,JSON.stringify(eventTypes),hash(secret),secret.slice(0,12),input.actorUserId],
  );
  await audit(client,{installationId:input.installationId,resourceType:'WEBHOOK_SUBSCRIPTION',resourceId:webhookSubscriptionId,outcome:'SUCCESS'});
  return {webhookSubscriptionId,endpointUrl,eventTypes,signingSecret:secret,signingSecretPrefix:secret.slice(0,12)};
}

export async function queuePublicIntegrationEvent(client:PoolClient,input:{
  householdId:string;eventId:string;eventType:string;aggregateId:string;data:Record<string,unknown>;
}){
  if(!PUBLIC_EVENTS.has(input.eventType))throw httpError('PUBLIC_INTEGRATION_EVENT_TYPE_INVALID',400);
  const subscriptions=await client.query(
    `SELECT w.* FROM integration_webhook_subscriptions w
     JOIN integration_installations i ON i.installation_id=w.installation_id
     WHERE i.household_id=$1 AND i.status='ACTIVE' AND w.status='ACTIVE' AND w.event_types ? $2`,
    [input.householdId,input.eventType],
  );
  const created:string[]=[];
  for(const row of subscriptions.rows){
    const webhookDeliveryId=`webhook-delivery-${generateUUIDv7()}`;
    const payload={eventId:input.eventId,eventType:input.eventType,householdId:input.householdId,occurredAt:new Date().toISOString(),aggregateId:input.aggregateId,data:input.data};
    await client.query(
      `INSERT INTO integration_webhook_deliveries(webhook_delivery_id,webhook_subscription_id,event_id,event_type,payload,status)
       VALUES($1,$2,$3,$4,$5::jsonb,'PENDING') ON CONFLICT(webhook_subscription_id,event_id) DO NOTHING`,
      [webhookDeliveryId,row.webhook_subscription_id,input.eventId,input.eventType,JSON.stringify(payload)],
    );
    created.push(webhookDeliveryId);
  }
  return {queued:created.length,deliveryIds:created};
}

export async function settleWebhookDelivery(client:PoolClient,input:{webhookDeliveryId:string;statusCode:number;error?:string}){
  const current=await client.query(`SELECT * FROM integration_webhook_deliveries WHERE webhook_delivery_id=$1 FOR UPDATE`,[input.webhookDeliveryId]);
  if(!current.rowCount)throw httpError('WEBHOOK_DELIVERY_NOT_FOUND',404);
  const row=current.rows[0],attempt=Number(row.attempt_count)+1;
  const success=input.statusCode>=200&&input.statusCode<300;
  const permanent=!success&&attempt>=5;
  const status=success?'DELIVERED':permanent?'DEAD_LETTER':'RETRY_SCHEDULED';
  const nextAttempt=success||permanent?null:new Date(Date.now()+Math.min(3600000,30000*(2**Math.min(attempt,6)))).toISOString();
  const result=await client.query(
    `UPDATE integration_webhook_deliveries SET status=$2,attempt_count=$3,next_attempt_at=$4,last_status_code=$5,last_error=$6,
      delivered_at=CASE WHEN $2='DELIVERED' THEN now() ELSE delivered_at END WHERE webhook_delivery_id=$1 RETURNING *`,
    [input.webhookDeliveryId,status,attempt,nextAttempt,input.statusCode,input.error||null],
  );
  return result.rows[0];
}
