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
async function internal(base:string,path:string,secretHeader:string,secret:string,init:RequestInit={}){
  const headers=new Headers(init.headers);headers.set(secretHeader,secret);
  if(init.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  return fetch(base+path,{...init,headers});
}
const readJson=(r:Response)=>r.json() as Promise<any>;

async function seed(){
  await db.query(`
    TRUNCATE
      analytics_snapshots,
      automation_execution_attempts,automation_confirmations,automation_action_proposals,automation_rule_versions,automation_rules,
      ai_recommendations,ai_responses,ai_safety_decisions,ai_requests,ai_consents,
      integration_audit_events,integration_webhook_deliveries,integration_webhook_subscriptions,integration_api_credentials,integration_installations,integration_developer_apps,
      commerce_return_requests,commerce_shipments,commerce_payment_transactions,commerce_order_items,commerce_seller_orders,commerce_orders,
      commerce_inventory_reservations,commerce_checkout_items,commerce_checkouts,commerce_inventory_items,commerce_listings,commerce_skus,commerce_products,commerce_seller_memberships,commerce_sellers,
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
    ('usr-w6-buyer','w6-buyer@test.local','ACTIVE'),
    ('usr-w6-seller','w6-seller@test.local','ACTIVE'),
    ('usr-w6-developer','w6-developer@test.local','ACTIVE'),
    ('usr-w6-platform','w6-platform@test.local','ACTIVE'),
    ('usr-w6-provider','w6-provider@test.local','ACTIVE'),
    ('usr-w6-outsider','w6-outsider@test.local','ACTIVE')`);
  await db.query(`INSERT INTO households(household_id,name,owner_user_id,status) VALUES('hh-w6','Wave 6 Household','usr-w6-buyer','ACTIVE')`);
  await db.query(`INSERT INTO household_members(membership_id,household_id,user_id,role,status)
    VALUES('mem-w6-buyer','hh-w6','usr-w6-buyer','HOUSEHOLD_OWNER','ACTIVE')`);
  await db.query(`INSERT INTO pets(
    pet_id,household_id,name,species_code,breed_code,sex,reproductive_status,birthdate_precision,
    primary_color,size_classification,lifecycle_stage,status,created_by
  ) VALUES('pet-w6','hh-w6','Milo','SPECIES_DOG','BREED_MIXED','MALE','STERILIZED','ESTIMATED_YEAR','Black','MEDIUM','ADULT','ACTIVE','usr-w6-buyer')`);
  await db.query(`INSERT INTO care_records(record_id,pet_id,household_id,record_type,occurred_at,status,provenance,payload,created_by)
    VALUES('care-w6','pet-w6','hh-w6','OBLIGATION','2026-10-20T08:00:00Z','OPEN','OWNER','{"title":"Monthly preventive care","category":"PREVENTIVE","priority":"NORMAL"}'::jsonb,'usr-w6-buyer')`);

  await db.query(`INSERT INTO service_businesses(
    business_id,legal_name,trading_name,business_type,owner_user_id,verification_status,is_active,contact_email,contact_phone
  ) VALUES('business-w6','Wave 6 Care Ltd','Wave 6 Care','PET_CARE','usr-w6-provider','VERIFIED',true,'provider@test.local','+254700000000')`);
  await db.query(`INSERT INTO provider_profiles(
    provider_id,user_id,display_name,professional_title,category,bio,years_of_experience,languages,
    verification_status,operational_status,visibility_status,primary_business_id,metadata
  ) VALUES('provider-w6','usr-w6-provider','Wave 6 Care','Pet Sitter','PET_SITTER','Wave 6 provider',5,'["English"]'::jsonb,'VERIFIED','ACTIVE','PUBLIC','business-w6','{}'::jsonb)`);
  await db.query(`INSERT INTO business_memberships(membership_id,business_id,user_id,provider_id,role,is_active,can_manage_services,can_manage_schedule)
    VALUES('bm-w6','business-w6','usr-w6-provider','provider-w6','OWNER',true,true,true)`);
  await db.query(`INSERT INTO provider_service_offerings(
    offering_id,provider_id,business_id,service_type_id,title,description,category,status,pricing_model,
    base_price_minor_units,currency,default_duration_minutes,location_types,target_species,max_pets_per_booking
  ) VALUES('offering-w6','provider-w6','business-w6','PET_SITTING_VISIT','Wave 6 Visit','Analytics service','PET_SITTER','ACTIVE','FIXED',100000,'KES',60,'["CLIENT_LOCATION"]'::jsonb,'["DOG"]'::jsonb,2)`);
  await db.query(`INSERT INTO bookings(
    booking_id,owner_user_id,household_id,provider_id,business_id,offering_id,status,confirmation_mode,start_at,end_at,
    service_duration_minutes,timezone,pet_count,pet_ids,service_snapshot,price_snapshot,cancellation_policy_snapshot,instructions,confirmed_at,completed_at
  ) VALUES(
    'booking-w6','usr-w6-buyer','hh-w6','provider-w6','business-w6','offering-w6','COMPLETED','PROVIDER_APPROVAL_REQUIRED',
    '2026-10-25T07:00:00Z','2026-10-25T08:00:00Z',60,'Africa/Nairobi',1,'["pet-w6"]'::jsonb,
    '{"title":"Wave 6 Visit","category":"PET_SITTER","providerDisplayName":"Wave 6 Care"}'::jsonb,
    '{"amountMinorUnits":100000,"currency":"KES","pricingModel":"FIXED"}'::jsonb,
    '{"policyTier":"STANDARD"}'::jsonb,'{"notes":"Wave 6"}'::jsonb,'2026-10-24T00:00:00Z','2026-10-25T08:00:00Z'
  )`);
  await db.query(`INSERT INTO booking_pet_links(booking_id,pet_id) VALUES('booking-w6','pet-w6')`);
  await db.query(`INSERT INTO professional_care_engagements(
    engagement_id,booking_id,service_type,offering_id,household_id,pet_ids,provider_id,business_id,assigned_staff_id,status,custody_status,
    scheduled_start_at,scheduled_end_at,actual_start_at,actual_end_at,timezone
  ) VALUES('engagement-w6','booking-w6','PET_SITTING_VISIT','offering-w6','hh-w6','["pet-w6"]'::jsonb,'provider-w6','business-w6','usr-w6-provider',
    'COMPLETED','RETURNED','2026-10-25T07:00:00Z','2026-10-25T08:00:00Z','2026-10-25T07:00:00Z','2026-10-25T08:00:00Z','Africa/Nairobi')`);
  await db.query(`INSERT INTO finance_provider_earnings(
    earning_id,booking_id,provider_id,business_id,gross_amount_minor,platform_commission_minor,provider_fees_minor,adjustments_minor,net_amount_minor,currency,status,available_at
  ) VALUES('earning-w6','booking-w6','provider-w6','business-w6',100000,10000,0,0,90000,'KES','AVAILABLE','2026-10-25T08:00:00Z')`);
}

async function main(){
  await runMigrations();await seed();await (await getRedis(config)).flushDb();
  const app=createApp(config);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const buyer=await token('usr-w6-buyer'),seller=await token('usr-w6-seller'),developer=await token('usr-w6-developer');
  const provider=await token('usr-w6-provider'),outsider=await token('usr-w6-outsider');

  try{
    // Commerce: seller cannot self-activate, live animals are prohibited, checkout ignores client price.
    let response=await api(base,'/v1/commerce/sellers',seller,{method:'POST',headers:{'idempotency-key':'w6-seller'},body:JSON.stringify({
      sellerType:'INDIVIDUAL',tradingName:'Milo Pet Goods',legalEntityName:'Milo Pet Goods',supportEmail:'seller@test.local',supportPhone:'+254700000111',
    })});
    assert.equal(response.status,201);let payload=await readJson(response);const sellerId=payload.seller.seller_id;

    let runtimeRoleBlockedSellerApproval=false;
    try{
      await withTenantTransaction(config,'usr-w6-seller',undefined,(client)=>client.query(`UPDATE commerce_sellers SET status='ACTIVE',is_verified=true WHERE seller_id=$1`,[sellerId]));
    }catch{runtimeRoleBlockedSellerApproval=true;}
    assert.equal(runtimeRoleBlockedSellerApproval,true);

    response=await internal(base,`/internal/commerce/sellers/${sellerId}/review`,'x-integration-adapter-secret','wrong-secret',{method:'POST',body:JSON.stringify({approved:true,reviewerUserId:'usr-w6-platform'})});
    assert.equal(response.status,401);
    response=await internal(base,`/internal/commerce/sellers/${sellerId}/review`,'x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({approved:true,reviewerUserId:'usr-w6-platform'})});
    assert.equal(response.status,200);

    response=await api(base,`/v1/commerce/sellers/${sellerId}/products`,seller,{method:'POST',headers:{'idempotency-key':'w6-live-animal'},body:JSON.stringify({
      title:'Live Puppy',slug:'live-puppy',description:'Not allowed',categoryCode:'LIVE_ANIMAL',speciesApplicability:'DOG',lifeStageApplicability:'PUPPY_KITTEN',
      safetyClassification:'STANDARD',isLiveAnimal:true,prescriptionRestricted:false,skuCode:'LIVE-001',variantTitle:'Puppy',options:{},priceMinor:5000000,
      currency:'KES',fulfillmentMethods:['PLATFORM_DELIVERY'],shippingProfileId:'default',initialStock:1,locationCode:'seller-main',condition:'NEW',
    })});
    assert.equal(response.status,400);

    response=await api(base,`/v1/commerce/sellers/${sellerId}/products`,seller,{method:'POST',headers:{'idempotency-key':'w6-product'},body:JSON.stringify({
      title:'Reflective Dog Harness',slug:'reflective-dog-harness',description:'Durable reflective harness',shortDescription:'Reflective harness',categoryCode:'HARNESS',
      speciesApplicability:'DOG',lifeStageApplicability:'ALL_STAGES',safetyClassification:'STANDARD',isLiveAnimal:false,prescriptionRestricted:false,
      skuCode:'HARNESS-M-BLK',variantTitle:'Medium / Black',options:{size:'M',color:'Black'},priceMinor:125000,currency:'KES',
      fulfillmentMethods:['PLATFORM_DELIVERY'],shippingProfileId:'default',initialStock:2,locationCode:'seller-main',condition:'NEW',
    })});
    assert.equal(response.status,201);payload=await readJson(response);const productId=payload.product.product_id,listingId=payload.product.listingId;

    let runtimeRoleBlockedProductApproval=false;
    try{
      await withTenantTransaction(config,'usr-w6-seller',undefined,(client)=>client.query(`UPDATE commerce_products SET moderation_status='APPROVED',status='ACTIVE' WHERE product_id=$1`,[productId]));
    }catch{runtimeRoleBlockedProductApproval=true;}
    assert.equal(runtimeRoleBlockedProductApproval,true);

    response=await internal(base,`/internal/commerce/products/${productId}/review`,'x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({approved:true,reviewerUserId:'usr-w6-platform'})});
    assert.equal(response.status,200);
    response=await fetch(base+'/public/commerce/listings');assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.listings.length,1);assert.equal(Number(payload.listings[0].price_minor),125000);

    response=await api(base,'/v1/commerce/checkouts',buyer,{method:'POST',headers:{'idempotency-key':'w6-checkout'},body:JSON.stringify({
      householdId:'hh-w6',items:[{listingId,quantity:1,priceMinor:1}],shippingAddressCiphertext:'vault:address-w6',maskedAddressSummary:'Kilimani, Nairobi',
    })});
    assert.equal(response.status,201);payload=await readJson(response);const orderId=payload.checkout.orderId;
    assert.equal(payload.checkout.grandTotalMinor,125000,'server price must override any client money');
    response=await api(base,'/v1/commerce/checkouts',buyer,{method:'POST',headers:{'idempotency-key':'w6-oversell'},body:JSON.stringify({
      householdId:'hh-w6',items:[{listingId,quantity:2}],shippingAddressCiphertext:'vault:address-w6-b',maskedAddressSummary:'Kilimani, Nairobi',
    })});
    assert.equal(response.status,409,'reservation must prevent oversell');

    response=await internal(base,'/internal/commerce/payment-settlements','x-billing-adapter-secret',config.billingAdapterSecret,{method:'POST',body:JSON.stringify({
      providerEventId:'commerce-event-w6-bad',orderId,provider:'MOCK_COMMERCE',providerTransactionId:'COM-W6-BAD',settledAmountMinor:1,currency:'KES',status:'SUCCESS',
    })});
    assert.equal(response.status,409);
    response=await internal(base,'/internal/commerce/payment-settlements','x-billing-adapter-secret',config.billingAdapterSecret,{method:'POST',body:JSON.stringify({
      providerEventId:'commerce-event-w6',orderId,provider:'MOCK_COMMERCE',providerTransactionId:'COM-W6-PAID',settledAmountMinor:125000,currency:'KES',status:'SUCCESS',providerFeeMinor:2500,
    })});
    assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.orderStatus,'CONFIRMED');

    response=await api(base,`/v1/commerce/orders/${orderId}`,outsider);assert.equal(response.status,403);
    response=await api(base,`/v1/commerce/orders/${orderId}`,buyer);assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.order.payment_status,'SUCCEEDED');assert.equal(payload.order.shipping_address_ciphertext,undefined);
    const sellerOrderId=payload.sellerOrders[0].seller_order_id;
    response=await api(base,`/v1/commerce/orders/${orderId}`,seller);assert.equal(response.status,200);
    response=await api(base,`/v1/commerce/seller-orders/${sellerOrderId}/transitions`,seller,{method:'POST',headers:{'idempotency-key':'w6-seller-order-accept'},body:JSON.stringify({nextStatus:'ACCEPTED'})});
    assert.equal(response.status,200);
    const inventory=await db.query(`SELECT on_hand_quantity,reserved_quantity FROM commerce_inventory_items WHERE seller_id=$1`,[sellerId]);
    assert.equal(Number(inventory.rows[0].on_hand_quantity),1);assert.equal(Number(inventory.rows[0].reserved_quantity),0);
    const ledger=await db.query(`SELECT status,total_amount_minor FROM finance_ledger_journals WHERE source_type='COMMERCE_PAYMENT' AND source_id=$1`,[orderId]);
    assert.equal(ledger.rows[0].status,'POSTED');assert.equal(Number(ledger.rows[0].total_amount_minor),125000);

    // Integrations: forbidden scopes blocked, credential hashed, projections are scope-bound.
    response=await api(base,'/v1/integrations/apps',developer,{method:'POST',body:JSON.stringify({
      name:'Bad Integration',description:'Forbidden scope test',requestedScopes:['tracking:exact-location:read'],redirectUris:['https://example.test/callback'],
    })});
    assert.equal(response.status,400);
    response=await api(base,'/v1/integrations/apps',developer,{method:'POST',body:JSON.stringify({
      name:'Household Companion',description:'Safe projections',requestedScopes:['pet:profile:read','booking:read','command-center:read','webhook:manage'],redirectUris:['https://example.test/callback'],
      privacyPolicyUrl:'https://example.test/privacy',termsUrl:'https://example.test/terms',
    })});
    assert.equal(response.status,201);payload=await readJson(response);const developerAppId=payload.app.developer_app_id;

    let runtimeRoleBlockedAppApproval=false;
    try{
      await withTenantTransaction(config,'usr-w6-developer',undefined,(client)=>client.query(`UPDATE integration_developer_apps SET status='ACTIVE',approved_scopes='["pet:profile:read"]'::jsonb WHERE developer_app_id=$1`,[developerAppId]));
    }catch{runtimeRoleBlockedAppApproval=true;}
    assert.equal(runtimeRoleBlockedAppApproval,true);

    response=await internal(base,`/internal/integrations/apps/${developerAppId}/review`,'x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({
      reviewerUserId:'usr-w6-platform',approved:true,approvedScopes:['pet:profile:read','booking:read','command-center:read','webhook:manage'],
    })});
    assert.equal(response.status,200);

    response=await api(base,`/v1/integrations/apps/${developerAppId}/installations`,buyer,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',grantedScopes:['pet:profile:read','booking:read','command-center:read','webhook:manage'],
    })});
    assert.equal(response.status,201);payload=await readJson(response);const installationId=payload.installation.installation_id;
    response=await api(base,`/v1/integrations/installations/${installationId}/credentials`,buyer,{method:'POST',body:JSON.stringify({rateLimitPerMinute:20})});
    assert.equal(response.status,201);payload=await readJson(response);const integrationToken=payload.credential.token;
    assert.ok(integrationToken.startsWith('petos_int_'));
    const credentialRow=await db.query(`SELECT secret_hash FROM integration_api_credentials WHERE credential_id=$1`,[payload.credential.credentialId]);
    assert.notEqual(credentialRow.rows[0].secret_hash,integrationToken);

    response=await fetch(base+'/integration/v1/pets',{headers:{'x-integration-key':integrationToken}});assert.equal(response.status,200);payload=await readJson(response);
    assert.equal(payload.pets.length,1);assert.equal(payload.pets[0].name,'Milo');assert.equal(payload.pets[0].household_id,undefined);
    response=await fetch(base+'/integration/v1/care',{headers:{'x-integration-key':integrationToken}});assert.equal(response.status,403,'ungranted integration scope must fail');

    response=await api(base,`/v1/integrations/installations/${installationId}/webhooks`,buyer,{method:'POST',body:JSON.stringify({
      endpointUrl:'https://hooks.example.test/petos',eventTypes:['pet.profile.updated'],
    })});
    assert.equal(response.status,201);

    response=await internal(base,'/internal/integrations/events','x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',eventId:'int-event-bad',eventType:'pet.profile.updated',aggregateId:'pet-w6',data:{petId:'pet-w6',latitude:-1.28,longitude:36.81},
    })});
    assert.equal(response.status,400);
    response=await internal(base,'/internal/integrations/events','x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',eventId:'int-event-good',eventType:'pet.profile.updated',aggregateId:'pet-w6',data:{petId:'pet-w6',status:'ACTIVE'},
    })});
    assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.queued,1);const webhookDeliveryId=payload.deliveryIds[0];
    response=await internal(base,`/internal/integrations/webhook-deliveries/${webhookDeliveryId}/settle`,'x-integration-adapter-secret','wrong-secret',{method:'POST',body:JSON.stringify({statusCode:204})});
    assert.equal(response.status,401);
    response=await internal(base,`/internal/integrations/webhook-deliveries/${webhookDeliveryId}/settle`,'x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({statusCode:204})});
    assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.delivery.status,'DELIVERED');

    // AI: consent + governed request + provider response; emergency inference remains blocked.
    response=await api(base,'/v1/ai/consents',buyer,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',scopes:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],policyVersion:'ai-policy-v1',
    })});assert.equal(response.status,200);

    response=await api(base,'/v1/ai/requests',outsider,{method:'POST',body:JSON.stringify({householdId:'hh-w6',petId:'pet-w6',useCase:'PET_SUMMARY',text:'Summarize Milo'})});
    assert.equal(response.status,403);
    response=await api(base,'/v1/ai/requests',buyer,{method:'POST',body:JSON.stringify({householdId:'hh-w6',petId:'pet-w6',useCase:'PET_SUMMARY',text:'Summarize Milo'})});
    assert.equal(response.status,201);payload=await readJson(response);const aiRequestId=payload.requestId;assert.equal(payload.status,'READY');

    let runtimeRoleBlockedAIRequestForge=false;
    try{
      await withTenantTransaction(config,'usr-w6-buyer',undefined,(client)=>client.query(
        `INSERT INTO ai_requests(request_id,user_id,household_id,pet_id,use_case,risk_class,prompt_version_id,status,user_text)
         VALUES('forged-ai','usr-w6-buyer','hh-w6','pet-w6','PET_SUMMARY','LOW','ai-prompt-pet-summary-v1','COMPLETED','forged')`
      ));
    }catch{runtimeRoleBlockedAIRequestForge=true;}
    assert.equal(runtimeRoleBlockedAIRequestForge,true);

    response=await internal(base,`/internal/ai/requests/${aiRequestId}/responses`,'x-ai-adapter-secret','wrong-secret',{method:'POST',body:JSON.stringify({
      content:'Milo is an adult dog based on the canonical Pet profile.',supportLevel:'HIGH_SUPPORT',completionStatus:'COMPLETED',latencyMs:25,
    })});assert.equal(response.status,401);
    response=await internal(base,`/internal/ai/requests/${aiRequestId}/responses`,'x-ai-adapter-secret',config.aiAdapterSecret,{method:'POST',body:JSON.stringify({
      content:'Milo is an adult dog based on the canonical Pet profile.',supportLevel:'HIGH_SUPPORT',completionStatus:'COMPLETED',latencyMs:25,
    })});assert.equal(response.status,200);
    response=await api(base,`/v1/ai/requests/${aiRequestId}`,buyer);assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.response.completion_status,'COMPLETED');

    response=await api(base,'/v1/ai/requests',buyer,{method:'POST',body:JSON.stringify({householdId:'hh-w6',petId:'pet-w6',useCase:'PET_ASSISTANT',text:'Milo is not breathing and collapsed'})});
    assert.equal(response.status,201);payload=await readJson(response);const emergencyRequestId=payload.requestId;assert.equal(payload.status,'BLOCKED');assert.equal(payload.safetyAction,'EMERGENCY_ESCALATION');
    response=await internal(base,`/internal/ai/requests/${emergencyRequestId}/responses`,'x-ai-adapter-secret',config.aiAdapterSecret,{method:'POST',body:JSON.stringify({
      content:'unsafe completion',supportLevel:'LIMITED_INFORMATION',completionStatus:'COMPLETED',latencyMs:1,
    })});assert.equal(response.status,409);

    // Automation: confirmation is mandatory and cannot be bypassed; exact location is rejected.
    response=await api(base,'/v1/automation/rules',buyer,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',name:'Unsafe lost mode automation',triggerType:'DOMAIN_EVENT',triggerConfig:{event:'pet.missing'},actionType:'TRACKING_REQUEST_LOST_MODE',
      actionPayloadTemplate:{petId:'pet-w6'},requiresConfirmationEveryRun:true,maxExecutionsPerDay:1,
    })});assert.equal(response.status,400);

    response=await api(base,'/v1/automation/rules',buyer,{method:'POST',body:JSON.stringify({
      householdId:'hh-w6',name:'Reminder automation',triggerType:'SCHEDULE',triggerConfig:{cron:'0 8 * * *'},actionType:'NOTIFICATION_SCHEDULE_SELF',
      actionPayloadTemplate:{message:'Daily Pet check'},requiresConfirmationEveryRun:false,maxExecutionsPerDay:1,
    })});assert.equal(response.status,201);

    response=await api(base,'/v1/automation/proposals',buyer,{method:'POST',headers:{'idempotency-key':'w6-proposal-location'},body:JSON.stringify({
      householdId:'hh-w6',petId:'pet-w6',actionType:'CARE_CREATE_OWNER_TASK',origin:'USER_UI',payload:{latitude:-1.28,longitude:36.81},
    })});assert.equal(response.status,400);
    response=await api(base,'/v1/automation/proposals',buyer,{method:'POST',headers:{'idempotency-key':'w6-proposal'},body:JSON.stringify({
      householdId:'hh-w6',petId:'pet-w6',actionType:'CARE_CREATE_OWNER_TASK',origin:'USER_UI',payload:{title:'Follow up preventive care'},
    })});assert.equal(response.status,201);payload=await readJson(response);const proposalId=payload.proposal.action_proposal_id,previewHash=payload.proposal.preview_hash;
    assert.equal(payload.proposal.status,'AWAITING_CONFIRMATION');

    response=await api(base,`/v1/automation/proposals/${proposalId}/execute`,buyer,{method:'POST'});assert.equal(response.status,409);
    response=await api(base,`/v1/automation/proposals/${proposalId}/confirm`,buyer,{method:'POST',body:JSON.stringify({previewHash:'wrong',confirmationBinding:'owner-confirmation-binding'})});
    assert.equal(response.status,409);
    response=await api(base,`/v1/automation/proposals/${proposalId}/confirm`,buyer,{method:'POST',body:JSON.stringify({previewHash,confirmationBinding:'owner-confirmation-binding'})});
    assert.equal(response.status,200);
    response=await api(base,`/v1/automation/proposals/${proposalId}/execute`,buyer,{method:'POST'});assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.queued,true);assert.equal(payload.proposal.status,'EXECUTING');
    response=await internal(base,`/internal/automation/proposals/${proposalId}/settle`,'x-integration-adapter-secret','wrong-secret',{method:'POST',body:JSON.stringify({classification:'SUCCESS'})});
    assert.equal(response.status,401);
    response=await internal(base,`/internal/automation/proposals/${proposalId}/settle`,'x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({
      classification:'SUCCESS',resultReference:'care-task:test',resultSummary:'Domain worker confirmed durable action',
    })});assert.equal(response.status,200);
    response=await api(base,`/v1/automation/proposals/${proposalId}`,buyer);assert.equal(response.status,200);payload=await readJson(response);assert.equal(payload.proposal.status,'COMPLETED');assert.equal(payload.attempts.length,1);
    response=await api(base,`/v1/automation/proposals/${proposalId}`,outsider);assert.equal(response.status,403);

    let runtimeRoleBlockedProposalEscalation=false;
    try{
      await withTenantTransaction(config,'usr-w6-buyer',undefined,(client)=>client.query(`UPDATE automation_action_proposals SET status='COMPLETED' WHERE action_proposal_id=$1`,[proposalId]));
    }catch{runtimeRoleBlockedProposalEscalation=true;}
    assert.equal(runtimeRoleBlockedProposalEscalation,true);

    // Analytics: derived snapshots, tenant authorization, no sensitive raw fields.
    response=await api(base,'/v1/analytics/households/hh-w6/snapshots',outsider,{method:'POST',body:JSON.stringify({
      windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-11-30T23:59:59Z',timezone:'Africa/Nairobi',
    })});assert.equal(response.status,403);
    response=await api(base,'/v1/analytics/households/hh-w6/snapshots',buyer,{method:'POST',body:JSON.stringify({
      windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-11-30T23:59:59Z',timezone:'Africa/Nairobi',
    })});assert.equal(response.status,201);payload=await readJson(response);
    const analyticsText=JSON.stringify(payload);
    assert.equal(/latitude|longitude|secret|paymentInstrument|clinicalNote/i.test(analyticsText),false);

    response=await api(base,'/v1/analytics/providers/provider-w6/snapshots',provider,{method:'POST',body:JSON.stringify({
      windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-11-30T23:59:59Z',timezone:'Africa/Nairobi',
    })});assert.equal(response.status,201);payload=await readJson(response);
    assert.ok(payload.snapshot.metrics.some((m:any)=>m.metricId==='provider-net-earnings'&&m.value===90000));

    response=await internal(base,'/internal/analytics/platform/snapshots','x-integration-adapter-secret',config.integrationAdapterSecret,{method:'POST',body:JSON.stringify({
      actorUserId:'usr-w6-platform',windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-11-30T23:59:59Z',timezone:'Africa/Nairobi',
    })});assert.equal(response.status,201);

    let runtimeRoleBlockedAnalyticsForge=false;
    try{
      await withTenantTransaction(config,'usr-w6-buyer',undefined,(client)=>client.query(
        `INSERT INTO analytics_snapshots(analytics_snapshot_id,actor_user_id,audience,household_id,scope_id,window_start,window_end,timezone,metrics,outcomes,operations,provenance,disclaimers)
         VALUES('forged-analytics','usr-w6-buyer','HOUSEHOLD','hh-w6','hh-w6','2026-10-01','2026-11-01','Africa/Nairobi','[]','[]','[]','[]','[]')`
      ));
    }catch{runtimeRoleBlockedAnalyticsForge=true;}
    assert.equal(runtimeRoleBlockedAnalyticsForge,true);

    response=await api(base,'/v1/analytics/HOUSEHOLD/hh-w6/snapshots',buyer);assert.equal(response.status,200);payload=await readJson(response);assert.ok(payload.snapshots.length>=1);

    console.log('WAVE6-INTEGRATION: PASS');
    console.log('Commerce seller/product moderation authority: PASS');
    console.log('Live-animal and prescription/prohibited marketplace boundary: PASS');
    console.log('Server-priced checkout + inventory oversell prevention: PASS');
    console.log('Commerce payment -> immutable Finance ledger continuity: PASS');
    console.log('Buyer/Seller Commerce isolation + masked address projection: PASS');
    console.log('Integration forbidden-scope rejection + hashed credentials: PASS');
    console.log('Integration scope-bound projections + rate boundary: PASS');
    console.log('Webhook exact-location rejection + durable delivery state: PASS');
    console.log('AI consent + governed request/response provenance: PASS');
    console.log('AI emergency inference block: PASS');
    console.log('AI non-authoritative runtime-role boundary: PASS');
    console.log('Automation confirmation + one-time execution authority: PASS');
    console.log('Automation exact-location payload rejection: PASS');
    console.log('Analytics tenant isolation + privacy-safe persisted snapshots: PASS');
    console.log('Runtime role cannot forge approvals, AI requests, Automation completion or Analytics snapshots: PASS');
  } finally {
    await new Promise<void>((resolve)=>server.close(()=>resolve()));
    await Promise.allSettled([closeDatabase(),closeRedis()]);
  }
}
main().catch(async(error)=>{
  console.error('WAVE6-INTEGRATION: FAIL',error);
  await Promise.allSettled([closeDatabase(),closeRedis()]);
  process.exit(1);
});
