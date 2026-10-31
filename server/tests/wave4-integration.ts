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

async function seed(){
  await db.query(`
    TRUNCATE
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
    ('usr-w4-owner','w4-owner@test.local','ACTIVE'),
    ('usr-w4-provider','w4-provider@test.local','ACTIVE'),
    ('usr-w4-outsider','w4-outsider@test.local','ACTIVE')`);
  await db.query(`INSERT INTO households(household_id,name,owner_user_id,status) VALUES('hh-w4','Wave 4 Household','usr-w4-owner','ACTIVE')`);
  await db.query(`INSERT INTO household_members(membership_id,household_id,user_id,role,status)
    VALUES('mem-w4-owner','hh-w4','usr-w4-owner','HOUSEHOLD_OWNER','ACTIVE')`);
  await db.query(`INSERT INTO pets(
    pet_id,household_id,name,species_code,breed_code,sex,reproductive_status,birthdate_precision,
    primary_color,size_classification,lifecycle_stage,status,created_by
  ) VALUES('pet-w4','hh-w4','Nala','SPECIES_DOG','BREED_MIXED','FEMALE','STERILIZED','ESTIMATED_YEAR','Tan','MEDIUM','ADULT','ACTIVE','usr-w4-owner')`);
  await db.query(`INSERT INTO provider_profiles(
    provider_id,user_id,display_name,professional_title,category,bio,years_of_experience,languages,
    verification_status,operational_status,visibility_status,metadata
  ) VALUES('provider-w4','usr-w4-provider','Wave 4 Pet Care','Pet Sitter','PET_SITTER','Wave 4 provider',5,'["English"]'::jsonb,'VERIFIED','ACTIVE','PUBLIC','{}'::jsonb)`);
  await db.query(`INSERT INTO provider_service_offerings(
    offering_id,provider_id,service_type_id,title,description,category,status,pricing_model,
    base_price_minor_units,currency,default_duration_minutes,location_types,target_species,max_pets_per_booking
  ) VALUES('offering-w4','provider-w4','PET_SITTING_VISIT','Wave 4 Visit','Finance integration visit','PET_SITTER','ACTIVE','FIXED',150000,'KES',60,'["CLIENT_LOCATION"]'::jsonb,'["DOG"]'::jsonb,2)`);

  const bookings=[
    ['booking-w4-paid',150000,'2026-11-10T07:00:00Z','2026-11-10T08:00:00Z'],
    ['booking-w4-refund',80000,'2026-11-11T07:00:00Z','2026-11-11T08:00:00Z'],
    ['booking-w4-care',100000,'2026-11-12T07:00:00Z','2026-11-12T08:00:00Z'],
  ] as const;
  for(const [bookingId,amount,start,end] of bookings){
    await db.query(`INSERT INTO bookings(
      booking_id,owner_user_id,household_id,provider_id,offering_id,status,confirmation_mode,start_at,end_at,
      service_duration_minutes,timezone,pet_count,pet_ids,service_snapshot,price_snapshot,cancellation_policy_snapshot,instructions,confirmed_at
    ) VALUES($1,'usr-w4-owner','hh-w4','provider-w4','offering-w4','CONFIRMED','PROVIDER_APPROVAL_REQUIRED',$2,$3,60,'Africa/Nairobi',1,
      '["pet-w4"]'::jsonb,$4::jsonb,$5::jsonb,'{"policyTier":"STANDARD"}'::jsonb,'{"notes":"Wave 4"}'::jsonb,now())`,
      [bookingId,start,end,JSON.stringify({title:'Wave 4 Visit',category:'PET_SITTER',providerDisplayName:'Wave 4 Pet Care'}),JSON.stringify({amountMinorUnits:amount,currency:'KES',pricingModel:'FIXED'})]);
    await db.query(`INSERT INTO booking_pet_links(booking_id,pet_id) VALUES($1,'pet-w4')`,[bookingId]);
  }
  await db.query(`INSERT INTO professional_care_engagements(
    engagement_id,booking_id,service_type,offering_id,household_id,pet_ids,provider_id,assigned_staff_id,status,custody_status,
    scheduled_start_at,scheduled_end_at,timezone
  ) VALUES('engagement-w4','booking-w4-care','PET_SITTING_VISIT','offering-w4','hh-w4','["pet-w4"]'::jsonb,'provider-w4','usr-w4-provider',
    'IN_CARE','PROVIDER_CUSTODY','2026-11-12T07:00:00Z','2026-11-12T08:00:00Z','Africa/Nairobi')`);
}

async function api(base:string,path:string,accessToken:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  headers.set('authorization',`Bearer ${accessToken}`);
  if(init.body&&!headers.has('content-type')) headers.set('content-type','application/json');
  return fetch(base+path,{...init,headers});
}
async function internal(base:string,path:string,init:RequestInit={},secret=config.billingAdapterSecret){
  const headers=new Headers(init.headers);
  headers.set('x-billing-adapter-secret',secret);
  if(init.body&&!headers.has('content-type')) headers.set('content-type','application/json');
  return fetch(base+path,{...init,headers});
}
const readJson=(r:Response)=>r.json() as Promise<any>;

async function main(){
  await runMigrations();
  await seed();
  await (await getRedis(config)).flushDb();
  const app=createApp(config);
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const ownerToken=await token('usr-w4-owner');
  const providerToken=await token('usr-w4-provider');
  const outsiderToken=await token('usr-w4-outsider');

  try{
    let response=await api(base,'/v1/finance/payment-intents',ownerToken,{method:'POST',body:JSON.stringify({
      bookingId:'booking-w4-paid',paymentMethodType:'MPESA',provider:'MPESA_SAFARICOM',
    })});
    assert.equal(response.status,400,'payment intent must require idempotency');

    response=await api(base,'/v1/finance/payment-intents',ownerToken,{method:'POST',headers:{'idempotency-key':'w4-pay-1'},body:JSON.stringify({
      bookingId:'booking-w4-paid',paymentMethodType:'MPESA',provider:'INVALID_PROVIDER',
    })});
    assert.equal(response.status,400,'invalid runtime payment provider must fail');

    response=await api(base,'/v1/finance/payment-intents',ownerToken,{method:'POST',headers:{'idempotency-key':'w4-pay-1'},body:JSON.stringify({
      bookingId:'booking-w4-paid',paymentMethodType:'MPESA',provider:'MPESA_SAFARICOM',
    })});
    assert.equal(response.status,201);
    let payload=await readJson(response);
    assert.equal(payload.paymentIntent.amountMinor,150000);
    const paidIntentId=payload.paymentIntent.paymentIntentId;

    response=await api(base,'/v1/finance/bookings/booking-w4-paid',outsiderToken);
    assert.equal(response.status,403);

    const settlementBody=JSON.stringify({
      providerEventId:'evt-w4-payment-1',paymentIntentId:paidIntentId,providerTransactionId:'MPESA-W4-PAID',
      settledAmountMinor:150000,currency:'KES',status:'SUCCESS',providerFeeMinor:3000,
    });
    response=await internal(base,'/internal/billing/finance/payment-settlements',{method:'POST',body:settlementBody},'wrong-secret');
    assert.equal(response.status,401,'billing adapter secret must be enforced');
    response=await internal(base,'/internal/billing/finance/payment-settlements',{method:'POST',body:settlementBody});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.status,'SUCCESS');
    const paidTransactionId=payload.paymentTransactionId;

    response=await internal(base,'/internal/billing/finance/payment-settlements',{method:'POST',body:settlementBody});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.duplicate,true);

    await db.query(`UPDATE bookings SET status='COMPLETED',completed_at=now(),updated_at=now() WHERE booking_id='booking-w4-paid'`);
    response=await internal(base,'/internal/billing/finance/bookings/booking-w4-paid/finalize-earning',{method:'POST'});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(Number(payload.earning.grossAmountMinor||payload.earning.gross_amount_minor),150000);
    assert.equal(Number(payload.earning.platformCommissionMinor||payload.earning.platform_commission_minor),22500);
    assert.equal(Number(payload.earning.netAmountMinor||payload.earning.net_amount_minor),127500);

    response=await api(base,'/v1/providers/provider-w4/finance',providerToken);
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.availableBalanceMinor,127500);
    response=await api(base,'/v1/providers/provider-w4/finance',outsiderToken);
    assert.equal(response.status,403);

    response=await api(base,'/v1/providers/provider-w4/payout-destinations',providerToken,{method:'POST',headers:{'idempotency-key':'w4-dest-raw'},body:JSON.stringify({
      destinationType:'MPESA_B2C',displayTitle:'Raw number',maskedIdentifier:'2547****0000',destinationToken:'254700000000',isDefault:true,
    })});
    assert.equal(response.status,400,'raw payout credentials must be rejected');

    response=await api(base,'/v1/providers/provider-w4/payout-destinations',providerToken,{method:'POST',headers:{'idempotency-key':'w4-dest-token'},body:JSON.stringify({
      destinationType:'MPESA_B2C',displayTitle:'M-PESA 2547****0000',maskedIdentifier:'2547****0000',destinationToken:'vault_mpesa_token_wave4',isDefault:true,
    })});
    assert.equal(response.status,201);
    payload=await readJson(response);
    const destinationId=payload.destination.destination_id||payload.destination.destinationId;
    response=await internal(base,`/internal/billing/finance/payout-destinations/${destinationId}/verify`,{method:'POST'});
    assert.equal(response.status,200);

    response=await api(base,'/v1/providers/provider-w4/payouts',providerToken,{method:'POST',headers:{'idempotency-key':'w4-payout-1'},body:JSON.stringify({destinationId,currency:'KES'})});
    assert.equal(response.status,201);
    payload=await readJson(response);
    assert.equal(payload.payout.amountMinor,127500);
    const payoutId=payload.payout.payoutId;
    response=await internal(base,`/internal/billing/finance/payouts/${payoutId}/settle`,{method:'POST',body:JSON.stringify({providerReference:'B2C-W4-001',status:'PAID'})});
    assert.equal(response.status,200);

    response=await api(base,'/v1/providers/provider-w4/finance',providerToken);
    payload=await readJson(response);
    assert.equal(payload.availableBalanceMinor,0);
    assert.equal(payload.lifetimePaidMinor,127500);

    response=await api(base,'/v1/finance/payment-intents',ownerToken,{method:'POST',headers:{'idempotency-key':'w4-refund-pay'},body:JSON.stringify({
      bookingId:'booking-w4-refund',paymentMethodType:'MPESA',provider:'MPESA_SAFARICOM',
    })});
    assert.equal(response.status,201);
    payload=await readJson(response);
    const refundIntentId=payload.paymentIntent.paymentIntentId;
    response=await internal(base,'/internal/billing/finance/payment-settlements',{method:'POST',body:JSON.stringify({
      providerEventId:'evt-w4-payment-refund',paymentIntentId:refundIntentId,providerTransactionId:'MPESA-W4-REFUND',
      settledAmountMinor:80000,currency:'KES',status:'SUCCESS',
    })});
    assert.equal(response.status,200);

    response=await api(base,'/v1/finance/bookings/booking-w4-refund/refunds',ownerToken,{method:'POST',headers:{'idempotency-key':'w4-refund-request'},body:JSON.stringify({
      reason:'OWNER_CANCELLATION',reasonDetails:'Cancelled before service fulfillment',
    })});
    assert.equal(response.status,201);
    payload=await readJson(response);
    assert.equal(payload.refund.requestedAmountMinor,80000);
    const refundId=payload.refund.refundId;
    response=await internal(base,`/internal/billing/finance/refunds/${refundId}/settle`,{method:'POST',body:JSON.stringify({
      providerRefundReference:'MPESA-REF-W4',status:'SUCCEEDED',
    })});
    assert.equal(response.status,200);

    response=await internal(base,'/internal/billing/finance/reconcile',{method:'POST',body:JSON.stringify({
      provider:'MPESA_SAFARICOM',periodStart:'2026-01-01T00:00:00Z',periodEnd:'2027-01-01T00:00:00Z',currency:'KES',
      records:[
        {providerTransactionId:'MPESA-W4-PAID',amountMinor:150000,currency:'KES',status:'SUCCESS',bookingId:'booking-w4-paid'},
        {providerTransactionId:'MPESA-W4-REFUND',amountMinor:80000,currency:'KES',status:'SUCCESS',bookingId:'booking-w4-refund'},
      ],
    })});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.matchedCount,2);
    assert.equal(payload.exceptionCount,0);

    response=await api(base,'/v1/subscriptions/consumer',ownerToken,{method:'POST',headers:{'idempotency-key':'w4-consumer-sub'},body:JSON.stringify({
      ownerType:'HOUSEHOLD',ownerId:'hh-w4',planCode:'PREMIUM',billingInterval:'MONTHLY',currency:'KES',marketCountry:'KE',billingProvider:'MPESA_RECURRING',
    })});
    assert.equal(response.status,201);
    payload=await readJson(response);
    assert.equal(payload.subscription.amountMinor,99900);
    assert.equal(payload.subscription.status,'INCOMPLETE');
    const consumerSubId=payload.subscription.subscriptionId;

    response=await api(base,`/v1/subscriptions/consumer/${consumerSubId}`,outsiderToken);
    assert.equal(response.status,404,'foreign consumer subscription should be hidden by RLS');

    response=await internal(base,`/internal/billing/subscriptions/consumer/${consumerSubId}/settle`,{method:'POST',body:JSON.stringify({
      providerEventId:'consumer-event-w4',providerInvoiceReference:'consumer-invoice-w4',status:'PAYMENT_SUCCEEDED',amountMinor:99900,currency:'KES',
      externalSubscriptionReference:'consumer-ext-w4',
    })});
    assert.equal(response.status,200);

    response=await api(base,`/v1/subscriptions/consumer/${consumerSubId}`,ownerToken);
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.subscription.status,'ACTIVE');
    assert.equal(payload.entitlements.some((g:any)=>g.entitlement_code==='tracking.live'),true);

    response=await api(base,`/v1/subscriptions/consumer/${consumerSubId}/cancel`,ownerToken,{method:'POST',headers:{'idempotency-key':'w4-consumer-cancel'},body:JSON.stringify({reason:'User requested cancellation'})});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.subscription.status,'CANCEL_AT_PERIOD_END');

    response=await api(base,'/v1/provider-saas/subscriptions',providerToken,{method:'POST',headers:{'idempotency-key':'w4-psaas-create'},body:JSON.stringify({
      subscriberType:'INDIVIDUAL_PROVIDER',providerId:'provider-w4',planCode:'PROVIDER_PRO',billingInterval:'MONTHLY',currency:'KES',market:'KE',
    })});
    assert.equal(response.status,201);
    payload=await readJson(response);
    assert.equal(payload.subscription.amountMinor,149900);
    assert.equal(payload.subscription.status,'TRIALING');
    const providerSubId=payload.subscription.subscriptionId;

    response=await api(base,`/v1/provider-saas/subscriptions/${providerSubId}`,outsiderToken);
    assert.equal(response.status,404,'foreign Provider SaaS subscription should be hidden by RLS');

    response=await internal(base,`/internal/billing/provider-saas/${providerSubId}/settle`,{method:'POST',body:JSON.stringify({
      providerEventId:'psaas-success-w4',providerInvoiceReference:'psaas-invoice-success-w4',status:'PAYMENT_SUCCEEDED',amountMinor:149900,currency:'KES',externalBillingRef:'psaas-ext-w4',
    })});
    assert.equal(response.status,200);
    response=await api(base,`/v1/provider-saas/subscriptions/${providerSubId}`,providerToken);
    payload=await readJson(response);
    assert.equal(payload.subscription.status,'ACTIVE');
    assert.equal(payload.entitlements.some((g:any)=>g.entitlement_key==='provider.workspace.advanced'),true);

    for(let attempt=1;attempt<=3;attempt++){
      response=await internal(base,`/internal/billing/provider-saas/${providerSubId}/settle`,{method:'POST',body:JSON.stringify({
        providerEventId:`psaas-fail-w4-${attempt}`,providerInvoiceReference:`psaas-invoice-fail-w4-${attempt}`,status:'PAYMENT_FAILED',amountMinor:149900,currency:'KES',
      })});
      assert.equal(response.status,200);
    }
    response=await api(base,`/v1/provider-saas/subscriptions/${providerSubId}`,providerToken);
    payload=await readJson(response);
    assert.equal(payload.subscription.status,'RESTRICTED');
    assert.equal(payload.entitlements.length,0);
    assert.equal(payload.continuityGrants.length,1,'active Pet care must receive continuity grant during billing restriction');
    assert.equal(payload.continuityGrants[0].engagement_id,'engagement-w4');

    response=await internal(base,'/internal/billing/subscriptions/reconcile',{method:'POST',body:JSON.stringify({
      billingDomain:'CONSUMER_SUBSCRIPTION',records:[{subscriptionId:consumerSubId,providerStatus:'CANCEL_AT_PERIOD_END'}],
    })});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.matchedCount,1);
    assert.equal(payload.driftedCount,0);

    response=await internal(base,'/internal/billing/subscriptions/reconcile',{method:'POST',body:JSON.stringify({
      billingDomain:'PROVIDER_SAAS',records:[{subscriptionId:providerSubId,providerStatus:'RESTRICTED'}],
    })});
    assert.equal(response.status,200);
    payload=await readJson(response);
    assert.equal(payload.matchedCount,1);

    const foreignFinance=await withTenantTransaction(config,'usr-w4-outsider',undefined,(client)=>
      client.query(`SELECT payment_intent_id FROM finance_payment_intents WHERE booking_id='booking-w4-paid'`));
    assert.equal(foreignFinance.rowCount,0);
    const foreignConsumer=await withTenantTransaction(config,'usr-w4-outsider',undefined,(client)=>
      client.query(`SELECT subscription_id FROM consumer_subscriptions WHERE subscription_id=$1`,[consumerSubId]));
    assert.equal(foreignConsumer.rowCount,0);
    const foreignProviderSaaS=await withTenantTransaction(config,'usr-w4-outsider',undefined,(client)=>
      client.query(`SELECT subscription_id FROM provider_saas_subscriptions WHERE subscription_id=$1`,[providerSubId]));
    assert.equal(foreignProviderSaaS.rowCount,0);

    const journals=await db.query(`
      SELECT j.journal_id,j.total_amount_minor,
        COALESCE(SUM(e.amount_minor) FILTER(WHERE e.direction='DEBIT'),0) AS debits,
        COALESCE(SUM(e.amount_minor) FILTER(WHERE e.direction='CREDIT'),0) AS credits
      FROM finance_ledger_journals j JOIN finance_ledger_entries e ON e.journal_id=j.journal_id
      WHERE j.status='POSTED' GROUP BY j.journal_id,j.total_amount_minor ORDER BY j.journal_id
    `);
    assert.equal(journals.rowCount,5);
    for(const row of journals.rows){
      assert.equal(Number(row.debits),Number(row.credits));
      assert.equal(Number(row.debits),Number(row.total_amount_minor));
    }

    const postedEntry=await db.query(`SELECT e.entry_id FROM finance_ledger_entries e JOIN finance_ledger_journals j ON j.journal_id=e.journal_id WHERE j.status='POSTED' LIMIT 1`);
    let immutableBlocked=false;
    try{await db.query(`UPDATE finance_ledger_entries SET amount_minor=amount_minor+1 WHERE entry_id=$1`,[postedEntry.rows[0].entry_id]);}
    catch{immutableBlocked=true;}
    assert.equal(immutableBlocked,true,'posted ledger entries must be immutable');

    const processorFees=await db.query(`
      SELECT COALESCE(SUM(e.amount_minor),0)::bigint AS amount
      FROM finance_ledger_entries e
      JOIN finance_ledger_accounts a ON a.account_id=e.account_id
      WHERE a.code='EXPENSE_PAYMENT_PROCESSOR_FEES' AND e.direction='DEBIT'
    `);
    assert.equal(Number(processorFees.rows[0].amount),3000);

    const successfulIntent=await db.query(`SELECT status FROM finance_payment_intents WHERE payment_intent_id=$1`,[paidIntentId]);
    assert.equal(successfulIntent.rows[0].status,'SUCCEEDED');
    const tx=await db.query(`SELECT status FROM finance_payment_transactions WHERE payment_transaction_id=$1`,[paidTransactionId]);
    assert.equal(tx.rows[0].status,'SUCCESS');

    console.log('WAVE4-INTEGRATION: PASS');
    console.log('Booking-derived payment authority + adapter authentication: PASS');
    console.log('Immutable balanced double-entry ledger: PASS');
    console.log('Provider earning + commission + payout lifecycle: PASS');
    console.log('Pre-fulfillment refund lifecycle: PASS');
    console.log('Payment reconciliation: PASS');
    console.log('Consumer subscription + entitlements + cancellation: PASS');
    console.log('Provider SaaS billing + entitlement restriction: PASS');
    console.log('Active-service Provider SaaS continuity grant: PASS');
    console.log('Consumer + Provider SaaS billing reconciliation: PASS');
    console.log('Finance/subscription/Provider SaaS PostgreSQL RLS isolation: PASS');
  } finally {
    await new Promise<void>((resolve)=>server.close(()=>resolve()));
    await Promise.allSettled([closeDatabase(),closeRedis()]);
  }
}

main().catch(async(error)=>{
  console.error('WAVE4-INTEGRATION: FAIL',error);
  await Promise.allSettled([closeDatabase(),closeRedis()]);
  process.exit(1);
});
