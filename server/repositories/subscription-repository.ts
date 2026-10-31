import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const SAFETY_ENTITLEMENTS=new Set(['pet.profile.core','data_export.privacy']);

function addInterval(start:Date,interval:'MONTHLY'|'ANNUAL'){
  const next=new Date(start);
  if(interval==='MONTHLY') next.setUTCMonth(next.getUTCMonth()+1);
  else next.setUTCFullYear(next.getUTCFullYear()+1);
  return next;
}

async function assertConsumerOwner(client:PoolClient,ownerType:'HOUSEHOLD'|'USER',ownerId:string,actorUserId:string){
  const allowed=await client.query(`SELECT petos_consumer_subscription_access($1,$2,$3) AS allowed`,[ownerType,ownerId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('SUBSCRIPTION_OWNER_ACCESS_DENIED'),{statusCode:403});
}

async function writeConsumerEntitlements(client:PoolClient,subscription:any,planEntitlements:Record<string,unknown>,mode:'FULL'|'SAFETY_ONLY'){
  await client.query(`UPDATE subscription_entitlement_grants SET status='REVOKED',valid_until=now() WHERE subscription_id=$1 AND status='ACTIVE'`,[subscription.subscription_id]);
  for(const [code,value] of Object.entries(planEntitlements)){
    if(mode==='SAFETY_ONLY'&&!SAFETY_ENTITLEMENTS.has(code)) continue;
    await client.query(
      `INSERT INTO subscription_entitlement_grants(grant_id,subscription_id,subject_type,subject_id,entitlement_code,value,source_type,valid_from,valid_until,status)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,now(),$8,'ACTIVE')`,
      [`entitlement-grant-${generateUUIDv7()}`,subscription.subscription_id,subscription.owner_type,subscription.owner_id,code,JSON.stringify(value),
       mode==='SAFETY_ONLY'?'FREE_BASELINE':'CONSUMER_SUBSCRIPTION',subscription.current_period_end],
    );
  }
}

export async function createConsumerSubscription(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;ownerType:'HOUSEHOLD'|'USER';ownerId:string;planCode:'FREE'|'PREMIUM';
  billingInterval:'MONTHLY'|'ANNUAL';currency:string;marketCountry:string;billingProvider:'MPESA_RECURRING'|'CARD_GATEWAY'|'MOCK_BILLING_PROVIDER';
}){
  await assertConsumerOwner(client,input.ownerType,input.ownerId,input.actorUserId);
  const plan=await client.query(
    `SELECT p.*,pr.price_id,pr.amount_minor,pr.currency,pr.billing_interval
       FROM consumer_plan_catalog p JOIN consumer_plan_prices pr ON pr.plan_id=p.plan_id
      WHERE p.code=$1 AND p.is_active AND pr.status='ACTIVE' AND pr.currency=$2 AND pr.billing_interval=$3 AND pr.market_country=$4
      LIMIT 1`,
    [input.planCode,input.currency,input.billingInterval,input.marketCountry],
  );
  if(!plan.rowCount) throw Object.assign(new Error('CONSUMER_PLAN_PRICE_NOT_FOUND'),{statusCode:404});
  const p=plan.rows[0];
  const scope=`consumer-subscription:create:${input.ownerType}:${input.ownerId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {subscription:prior.rows[0].response_body,replayed:true};
  }
  const active=await client.query(`SELECT subscription_id FROM consumer_subscriptions WHERE owner_type=$1 AND owner_id=$2 AND status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','PAUSED','CANCEL_AT_PERIOD_END') LIMIT 1`,[input.ownerType,input.ownerId]);
  if(active.rowCount) throw Object.assign(new Error('ACTIVE_CONSUMER_SUBSCRIPTION_EXISTS'),{statusCode:409});
  const now=new Date();
  const end=addInterval(now,input.billingInterval);
  const status=Number(p.amount_minor)===0?'ACTIVE':'INCOMPLETE';
  const subscriptionId=`consumer-sub-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO consumer_subscriptions(subscription_id,owner_type,owner_id,billing_owner_user_id,plan_id,price_id,billing_provider,status,billing_interval,currency,current_period_start,current_period_end)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [subscriptionId,input.ownerType,input.ownerId,input.actorUserId,p.plan_id,p.price_id,input.billingProvider,status,input.billingInterval,input.currency,now.toISOString(),end.toISOString()],
  );
  const subscription=result.rows[0];
  if(status==='ACTIVE') await writeConsumerEntitlements(client,subscription,p.entitlements,'FULL');
  await client.query(`INSERT INTO subscription_status_history(history_id,subscription_id,from_status,to_status,reason,actor_user_id) VALUES($1,$2,'INCOMPLETE',$3,'Subscription created',$4)`,
    [`subscription-history-${generateUUIDv7()}`,subscriptionId,status,input.actorUserId]);
  await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ConsumerSubscription',$2,'ConsumerSubscriptionCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,subscriptionId,JSON.stringify({subscriptionId,ownerType:input.ownerType,ownerId:input.ownerId,planCode:input.planCode,status})]);
  const response={subscriptionId,ownerType:input.ownerType,ownerId:input.ownerId,planCode:input.planCode,priceId:p.price_id,amountMinor:Number(p.amount_minor),currency:input.currency,billingInterval:input.billingInterval,status,currentPeriodStart:now.toISOString(),currentPeriodEnd:end.toISOString()};
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,subscriptionId,JSON.stringify(response)]);
  return {subscription:response,replayed:false};
}

export async function settleConsumerSubscription(client:PoolClient,input:{
  subscriptionId:string;providerEventId:string;providerInvoiceReference:string;status:'PAYMENT_SUCCEEDED'|'PAYMENT_FAILED';amountMinor:number;currency:string;externalSubscriptionReference?:string;
}){
  const result=await client.query(
    `SELECT s.*,p.entitlements,pr.amount_minor AS price_amount
       FROM consumer_subscriptions s JOIN consumer_plan_catalog p ON p.plan_id=s.plan_id JOIN consumer_plan_prices pr ON pr.price_id=s.price_id
      WHERE s.subscription_id=$1 FOR UPDATE`,
    [input.subscriptionId],
  );
  if(!result.rowCount) throw Object.assign(new Error('CONSUMER_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  if(input.currency!==s.currency||input.amountMinor!==Number(s.price_amount)) throw Object.assign(new Error('SUBSCRIPTION_SETTLEMENT_AMOUNT_MISMATCH'),{statusCode:409});
  const existingInvoice=await client.query(`SELECT * FROM subscription_invoices WHERE provider_invoice_reference=$1 LIMIT 1`,[input.providerInvoiceReference]);
  if(existingInvoice.rowCount) return {subscriptionId:input.subscriptionId,status:s.status,replayed:true};
  const invoiceId=`subscription-invoice-${generateUUIDv7()}`;
  const previousStatus=s.status;
  if(input.status==='PAYMENT_SUCCEEDED'){
    const start=new Date();
    const end=addInterval(start,s.billing_interval);
    await client.query(
      `UPDATE consumer_subscriptions SET status='ACTIVE',external_subscription_reference=COALESCE($2,external_subscription_reference),current_period_start=$3,current_period_end=$4,grace_period_end=NULL,version=version+1,updated_at=now() WHERE subscription_id=$1`,
      [input.subscriptionId,input.externalSubscriptionReference||null,start.toISOString(),end.toISOString()],
    );
    await client.query(
      `INSERT INTO subscription_invoices(invoice_id,subscription_id,period_start,period_end,amount_minor,currency,status,provider_invoice_reference,issued_at,due_at,paid_at)
       VALUES($1,$2,$3,$4,$5,$6,'PAID',$7,now(),now(),now())`,
      [invoiceId,input.subscriptionId,start.toISOString(),end.toISOString(),input.amountMinor,input.currency,input.providerInvoiceReference],
    );
    const refreshed={...s,current_period_end:end.toISOString()};
    await writeConsumerEntitlements(client,refreshed,s.entitlements,'FULL');
    await client.query(`INSERT INTO subscription_status_history(history_id,subscription_id,from_status,to_status,reason) VALUES($1,$2,$3,'ACTIVE','Billing payment succeeded')`,
      [`subscription-history-${generateUUIDv7()}`,input.subscriptionId,previousStatus]);
    await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ConsumerSubscription',$2,'ConsumerSubscriptionActivated',$3::jsonb)`,
      [`evt-${generateUUIDv7()}`,input.subscriptionId,JSON.stringify({subscriptionId:input.subscriptionId,invoiceId,amountMinor:input.amountMinor,currency:input.currency,providerEventId:input.providerEventId})]);
    return {subscriptionId:input.subscriptionId,status:'ACTIVE',invoiceId,replayed:false};
  }
  const graceEnd=new Date(Date.now()+7*24*60*60*1000).toISOString();
  await client.query(`UPDATE consumer_subscriptions SET status='GRACE_PERIOD',grace_period_end=$2,version=version+1,updated_at=now() WHERE subscription_id=$1`,[input.subscriptionId,graceEnd]);
  await client.query(
    `INSERT INTO subscription_invoices(invoice_id,subscription_id,period_start,period_end,amount_minor,currency,status,provider_invoice_reference,issued_at,due_at)
     VALUES($1,$2,$3,$4,$5,$6,'FAILED',$7,now(),now())`,
    [invoiceId,input.subscriptionId,s.current_period_start,s.current_period_end,input.amountMinor,input.currency,input.providerInvoiceReference],
  );
  await client.query(`INSERT INTO subscription_status_history(history_id,subscription_id,from_status,to_status,reason) VALUES($1,$2,$3,'GRACE_PERIOD','Billing payment failed')`,
    [`subscription-history-${generateUUIDv7()}`,input.subscriptionId,previousStatus]);
  return {subscriptionId:input.subscriptionId,status:'GRACE_PERIOD',invoiceId,replayed:false};
}

export async function cancelConsumerSubscription(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;subscriptionId:string;reason:string}){
  const result=await client.query(`SELECT * FROM consumer_subscriptions WHERE subscription_id=$1 FOR UPDATE`,[input.subscriptionId]);
  if(!result.rowCount) throw Object.assign(new Error('CONSUMER_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  await assertConsumerOwner(client,s.owner_type,s.owner_id,input.actorUserId);
  if(['CANCELLED','EXPIRED','TERMINATED'].includes(String(s.status))) return {subscriptionId:input.subscriptionId,status:s.status,replayed:true};
  const scope=`consumer-subscription:cancel:${input.subscriptionId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {subscription:prior.rows[0].response_body,replayed:true};
  }
  await client.query(`UPDATE consumer_subscriptions SET status='CANCEL_AT_PERIOD_END',cancel_at_period_end=true,cancellation_reason=$2,version=version+1,updated_at=now() WHERE subscription_id=$1`,[input.subscriptionId,input.reason]);
  const response={subscriptionId:input.subscriptionId,status:'CANCEL_AT_PERIOD_END',currentPeriodEnd:new Date(s.current_period_end).toISOString()};
  await client.query(`INSERT INTO subscription_status_history(history_id,subscription_id,from_status,to_status,reason,actor_user_id) VALUES($1,$2,$3,'CANCEL_AT_PERIOD_END',$4,$5)`,
    [`subscription-history-${generateUUIDv7()}`,input.subscriptionId,s.status,input.reason,input.actorUserId]);
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.subscriptionId,JSON.stringify(response)]);
  return {subscription:response,replayed:false};
}

export async function getConsumerSubscription(client:PoolClient,subscriptionId:string,actorUserId:string){
  const result=await client.query(`SELECT s.*,p.code AS plan_code,p.display_name,p.entitlements,pr.amount_minor FROM consumer_subscriptions s JOIN consumer_plan_catalog p ON p.plan_id=s.plan_id JOIN consumer_plan_prices pr ON pr.price_id=s.price_id WHERE s.subscription_id=$1 LIMIT 1`,[subscriptionId]);
  if(!result.rowCount) throw Object.assign(new Error('CONSUMER_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  await assertConsumerOwner(client,s.owner_type,s.owner_id,actorUserId);
  const grants=await client.query(`SELECT entitlement_code,value,source_type,valid_until,status FROM subscription_entitlement_grants WHERE subscription_id=$1 AND status='ACTIVE' ORDER BY entitlement_code`,[subscriptionId]);
  const invoices=await client.query(`SELECT invoice_id,amount_minor,currency,status,provider_invoice_reference,issued_at,paid_at FROM subscription_invoices WHERE subscription_id=$1 ORDER BY issued_at DESC`,[subscriptionId]);
  return {subscription:{...s,amount_minor:Number(s.amount_minor)},entitlements:grants.rows,invoices:invoices.rows};
}

async function assertProviderSaaSTarget(client:PoolClient,targetType:'SERVICE_BUSINESS'|'INDIVIDUAL_PROVIDER',businessId:string|undefined,providerId:string|undefined,actorUserId:string){
  const allowed=await client.query(`SELECT petos_provider_saas_access($1,$2,$3,$4) AS allowed`,[targetType,businessId||null,providerId||null,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('PROVIDER_SAAS_ACCESS_DENIED'),{statusCode:403});
}

async function writeProviderEntitlements(client:PoolClient,subscription:any,entitlements:string[],active:boolean){
  await client.query(`UPDATE provider_saas_entitlement_grants SET status='REVOKED',valid_until=now() WHERE subscription_id=$1 AND status='ACTIVE'`,[subscription.subscription_id]);
  if(!active) return;
  for(const key of entitlements){
    await client.query(
      `INSERT INTO provider_saas_entitlement_grants(grant_id,subscription_id,entitlement_key,valid_from,valid_until,status)
       VALUES($1,$2,$3,now(),$4,'ACTIVE')`,
      [`provider-entitlement-${generateUUIDv7()}`,subscription.subscription_id,key,subscription.current_period_end],
    );
  }
}

export async function createProviderSaaSSubscription(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;subscriberType:'SERVICE_BUSINESS'|'INDIVIDUAL_PROVIDER';businessId?:string;providerId?:string;
  planCode:string;billingInterval:'MONTHLY'|'ANNUAL';currency:string;market:string;
}){
  await assertProviderSaaSTarget(client,input.subscriberType,input.businessId,input.providerId,input.actorUserId);
  const plan=await client.query(
    `SELECT p.*,pr.price_id,pr.amount_minor,pr.currency,pr.billing_interval,pr.trial_period_days,pr.grace_period_days
       FROM provider_saas_plan_catalog p JOIN provider_saas_prices pr ON pr.plan_id=p.plan_id
      WHERE p.code=$1 AND p.target_type=$2 AND p.is_active AND pr.status='ACTIVE' AND pr.market=$3 AND pr.currency=$4 AND pr.billing_interval=$5 LIMIT 1`,
    [input.planCode,input.subscriberType,input.market,input.currency,input.billingInterval],
  );
  if(!plan.rowCount) throw Object.assign(new Error('PROVIDER_SAAS_PLAN_PRICE_NOT_FOUND'),{statusCode:404});
  const p=plan.rows[0];
  const targetId=input.businessId||input.providerId!;
  const scope=`provider-saas:create:${input.subscriberType}:${targetId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {subscription:prior.rows[0].response_body,replayed:true};
  }
  const existing=await client.query(`SELECT subscription_id FROM provider_saas_subscriptions WHERE subscriber_type=$1 AND COALESCE(business_id,provider_id)=$2 AND status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','RESTRICTED','CANCEL_AT_PERIOD_END') LIMIT 1`,[input.subscriberType,targetId]);
  if(existing.rowCount) throw Object.assign(new Error('ACTIVE_PROVIDER_SAAS_SUBSCRIPTION_EXISTS'),{statusCode:409});
  const now=new Date();
  const trialDays=Number(p.trial_period_days);
  const end=addInterval(now,input.billingInterval);
  const status=Number(p.amount_minor)===0?'ACTIVE':trialDays>0?'TRIALING':'INCOMPLETE';
  const subscriptionId=`provider-saas-sub-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO provider_saas_subscriptions(subscription_id,subscriber_type,business_id,provider_id,billing_owner_user_id,plan_id,price_id,status,current_period_start,current_period_end)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [subscriptionId,input.subscriberType,input.businessId||null,input.providerId||null,input.actorUserId,p.plan_id,p.price_id,status,now.toISOString(),end.toISOString()],
  );
  const sub=result.rows[0];
  if(status==='ACTIVE'||status==='TRIALING') await writeProviderEntitlements(client,sub,p.entitlements||[],true);
  const response={subscriptionId,subscriberType:input.subscriberType,businessId:input.businessId,providerId:input.providerId,planCode:input.planCode,priceId:p.price_id,amountMinor:Number(p.amount_minor),currency:input.currency,status,currentPeriodStart:now.toISOString(),currentPeriodEnd:end.toISOString()};
  await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ProviderSaaSSubscription',$2,'ProviderSaaSSubscriptionCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,subscriptionId,JSON.stringify(response)]);
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,subscriptionId,JSON.stringify(response)]);
  return {subscription:response,replayed:false};
}

async function ensureContinuityGrants(client:PoolClient,subscription:any){
  const engagements=await client.query(
    `SELECT engagement_id,pet_ids,scheduled_end_at
       FROM professional_care_engagements
      WHERE status NOT IN ('COMPLETED','ABORTED','CANCELLED')
        AND (($1::text IS NOT NULL AND business_id=$1) OR ($2::text IS NOT NULL AND provider_id=$2))`,
    [subscription.business_id||null,subscription.provider_id||null],
  );
  for(const e of engagements.rows){
    const expires=new Date(Math.max(new Date(e.scheduled_end_at).getTime()+24*60*60*1000,Date.now()+24*60*60*1000)).toISOString();
    await client.query(
      `INSERT INTO provider_saas_continuity_grants(grant_id,subscription_id,business_id,provider_id,engagement_id,pet_ids,reason,activated_at,expires_at,is_active)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,'Billing restriction while active Pet care remains in custody/service',now(),$7,true)
       ON CONFLICT(subscription_id,engagement_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,is_active=true`,
      [`continuity-${generateUUIDv7()}`,subscription.subscription_id,subscription.business_id||null,subscription.provider_id||null,e.engagement_id,JSON.stringify(e.pet_ids||[]),expires],
    );
  }
  return engagements.rowCount||0;
}

export async function settleProviderSaaSSubscription(client:PoolClient,input:{
  subscriptionId:string;providerEventId:string;providerInvoiceReference:string;status:'PAYMENT_SUCCEEDED'|'PAYMENT_FAILED';amountMinor:number;currency:string;externalBillingRef?:string;
}){
  const result=await client.query(
    `SELECT s.*,p.entitlements,pr.amount_minor AS price_amount,pr.grace_period_days
       FROM provider_saas_subscriptions s JOIN provider_saas_plan_catalog p ON p.plan_id=s.plan_id JOIN provider_saas_prices pr ON pr.price_id=s.price_id
      WHERE s.subscription_id=$1 FOR UPDATE`,
    [input.subscriptionId],
  );
  if(!result.rowCount) throw Object.assign(new Error('PROVIDER_SAAS_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  if(input.currency!==s.currency && s.currency!==undefined) throw Object.assign(new Error('PROVIDER_SAAS_CURRENCY_MISMATCH'),{statusCode:409});
  if(input.amountMinor!==Number(s.price_amount)) throw Object.assign(new Error('PROVIDER_SAAS_SETTLEMENT_AMOUNT_MISMATCH'),{statusCode:409});
  const existing=await client.query(`SELECT 1 FROM provider_saas_invoices WHERE provider_invoice_reference=$1 LIMIT 1`,[input.providerInvoiceReference]);
  if(existing.rowCount) return {subscriptionId:input.subscriptionId,status:s.status,replayed:true};
  const invoiceId=`provider-saas-invoice-${generateUUIDv7()}`;
  const now=new Date();
  if(input.status==='PAYMENT_SUCCEEDED'){
    const end=addInterval(now,(await client.query(`SELECT billing_interval FROM provider_saas_prices WHERE price_id=$1`,[s.price_id])).rows[0].billing_interval);
    await client.query(`UPDATE provider_saas_subscriptions SET status='ACTIVE',external_billing_ref=COALESCE($2,external_billing_ref),current_period_start=$3,current_period_end=$4,grace_period_end=NULL,consecutive_failed_payments=0,version=version+1,updated_at=now() WHERE subscription_id=$1`,
      [input.subscriptionId,input.externalBillingRef||null,now.toISOString(),end.toISOString()]);
    await client.query(`INSERT INTO provider_saas_invoices(invoice_id,subscription_id,period_start,period_end,amount_minor,currency,status,provider_invoice_reference,issued_at,due_at,paid_at) VALUES($1,$2,$3,$4,$5,$6,'PAID',$7,now(),now(),now())`,
      [invoiceId,input.subscriptionId,now.toISOString(),end.toISOString(),input.amountMinor,input.currency,input.providerInvoiceReference]);
    await writeProviderEntitlements(client,{...s,current_period_end:end.toISOString()},s.entitlements||[],true);
    await client.query(`UPDATE provider_saas_continuity_grants SET is_active=false WHERE subscription_id=$1 AND is_active`,[input.subscriptionId]);
    await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ProviderSaaSSubscription',$2,'ProviderSaaSSubscriptionActivated',$3::jsonb)`,
      [`evt-${generateUUIDv7()}`,input.subscriptionId,JSON.stringify({subscriptionId:input.subscriptionId,invoiceId,providerEventId:input.providerEventId})]);
    return {subscriptionId:input.subscriptionId,status:'ACTIVE',invoiceId,continuityGrants:0,replayed:false};
  }
  const failures=Number(s.consecutive_failed_payments)+1;
  const nextStatus=failures>=3?'RESTRICTED':'GRACE_PERIOD';
  const graceEnd=new Date(Date.now()+Number(s.grace_period_days||7)*24*60*60*1000).toISOString();
  await client.query(`UPDATE provider_saas_subscriptions SET status=$2,grace_period_end=$3,consecutive_failed_payments=$4,version=version+1,updated_at=now() WHERE subscription_id=$1`,[input.subscriptionId,nextStatus,graceEnd,failures]);
  await client.query(`INSERT INTO provider_saas_invoices(invoice_id,subscription_id,period_start,period_end,amount_minor,currency,status,provider_invoice_reference,issued_at,due_at) VALUES($1,$2,$3,$4,$5,$6,'FAILED',$7,now(),now())`,
    [invoiceId,input.subscriptionId,s.current_period_start,s.current_period_end,input.amountMinor,input.currency,input.providerInvoiceReference]);
  let continuityGrants=0;
  if(nextStatus==='RESTRICTED'){
    await writeProviderEntitlements(client,s,s.entitlements||[],false);
    continuityGrants=await ensureContinuityGrants(client,s);
  }
  return {subscriptionId:input.subscriptionId,status:nextStatus,invoiceId,continuityGrants,replayed:false};
}

export async function getProviderSaaSSubscription(client:PoolClient,subscriptionId:string,actorUserId:string){
  const result=await client.query(
    `SELECT s.*,p.code AS plan_code,p.tier,p.display_name,p.included_staff_seats,p.included_locations,p.entitlements,pr.amount_minor,pr.currency,pr.billing_interval
       FROM provider_saas_subscriptions s JOIN provider_saas_plan_catalog p ON p.plan_id=s.plan_id JOIN provider_saas_prices pr ON pr.price_id=s.price_id
      WHERE s.subscription_id=$1 LIMIT 1`,
    [subscriptionId],
  );
  if(!result.rowCount) throw Object.assign(new Error('PROVIDER_SAAS_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  await assertProviderSaaSTarget(client,s.subscriber_type,s.business_id||undefined,s.provider_id||undefined,actorUserId);
  const [grants,continuity,invoices]=await Promise.all([
    client.query(`SELECT entitlement_key,valid_until,status FROM provider_saas_entitlement_grants WHERE subscription_id=$1 AND status='ACTIVE' ORDER BY entitlement_key`,[subscriptionId]),
    client.query(`SELECT grant_id,engagement_id,pet_ids,reason,expires_at,is_active FROM provider_saas_continuity_grants WHERE subscription_id=$1 AND is_active ORDER BY activated_at DESC`,[subscriptionId]),
    client.query(`SELECT invoice_id,amount_minor,currency,status,provider_invoice_reference,issued_at,paid_at FROM provider_saas_invoices WHERE subscription_id=$1 ORDER BY issued_at DESC`,[subscriptionId]),
  ]);
  return {subscription:{...s,amount_minor:Number(s.amount_minor)},entitlements:grants.rows,continuityGrants:continuity.rows,invoices:invoices.rows};
}

export async function cancelProviderSaaSSubscription(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;subscriptionId:string;reason:string}){
  const result=await client.query(`SELECT * FROM provider_saas_subscriptions WHERE subscription_id=$1 FOR UPDATE`,[input.subscriptionId]);
  if(!result.rowCount) throw Object.assign(new Error('PROVIDER_SAAS_SUBSCRIPTION_NOT_FOUND'),{statusCode:404});
  const s=result.rows[0];
  await assertProviderSaaSTarget(client,s.subscriber_type,s.business_id||undefined,s.provider_id||undefined,input.actorUserId);
  const scope=`provider-saas:cancel:${input.subscriptionId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {subscription:prior.rows[0].response_body,replayed:true};
  }
  await client.query(`UPDATE provider_saas_subscriptions SET status='CANCEL_AT_PERIOD_END',cancel_at_period_end=true,version=version+1,updated_at=now() WHERE subscription_id=$1`,[input.subscriptionId]);
  const response={subscriptionId:input.subscriptionId,status:'CANCEL_AT_PERIOD_END',currentPeriodEnd:new Date(s.current_period_end).toISOString()};
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,200,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,input.subscriptionId,JSON.stringify(response)]);
  return {subscription:response,replayed:false};
}

export async function runBillingReconciliation(client:PoolClient,input:{
  billingDomain:'CONSUMER_SUBSCRIPTION'|'PROVIDER_SAAS';records:Array<{subscriptionId:string;providerStatus:string}>;
}){
  const runId=`billing-reconciliation-${generateUUIDv7()}`;
  const table=input.billingDomain==='CONSUMER_SUBSCRIPTION'?'consumer_subscriptions':'provider_saas_subscriptions';
  const local=await client.query(`SELECT subscription_id,status FROM ${table}`);
  const localMap=new Map(local.rows.map((r:any)=>[r.subscription_id,r.status]));
  const items:Array<{subscriptionId:string;localStatus:string;providerStatus:string;classification:string}>=[];
  const seen=new Set<string>();
  for(const record of input.records){
    const localStatus=localMap.get(record.subscriptionId);
    const classification=localStatus===undefined?'LOCAL_MISSING':localStatus===record.providerStatus?'MATCHED':'STATUS_MISMATCH';
    items.push({subscriptionId:record.subscriptionId,localStatus:String(localStatus||'MISSING'),providerStatus:record.providerStatus,classification});
    seen.add(record.subscriptionId);
  }
  for(const [subscriptionId,status] of localMap.entries()){
    if(!seen.has(subscriptionId)) items.push({subscriptionId,localStatus:String(status),providerStatus:'MISSING',classification:'PROVIDER_MISSING'});
  }
  const matched=items.filter(i=>i.classification==='MATCHED').length;
  const drifted=items.length-matched;
  await client.query(`INSERT INTO billing_reconciliation_runs(run_id,billing_domain,checked_count,matched_count,drifted_count,status,completed_at) VALUES($1,$2,$3,$4,$5,'COMPLETED',now())`,
    [runId,input.billingDomain,items.length,matched,drifted]);
  for(const item of items){
    await client.query(`INSERT INTO billing_reconciliation_items(item_id,run_id,subscription_id,local_status,provider_status,classification,details) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [`billing-recon-item-${generateUUIDv7()}`,runId,item.subscriptionId,item.localStatus,item.providerStatus,item.classification,item.classification==='MATCHED'?'No drift detected':'Billing-provider state differs from durable Pet OS state']);
  }
  return {runId,checkedCount:items.length,matchedCount:matched,driftedCount:drifted,items};
}
