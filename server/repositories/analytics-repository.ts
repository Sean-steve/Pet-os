import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

function httpError(message:string,statusCode:number){return Object.assign(new Error(message),{statusCode});}
const metric=(metricId:string,label:string,domain:string,value:number,unit:'COUNT'|'PERCENT'|'MINUTES'|'RATING'|'MINOR_UNITS',definition:string,source:string)=>({
  metricId,label,domain,value,unit,direction:'NOT_COMPARABLE',definition,source,asOf:new Date().toISOString(),
});
const status=(value:number,good:number,warn:number)=>value<=good?'HEALTHY':value<=warn?'WATCH':'ACTION_NEEDED';

export async function generateHouseholdAnalytics(client:PoolClient,input:{
  actorUserId:string;householdId:string;windowStart:string;windowEnd:string;timezone:string;
}){
  const access=await client.query(`SELECT petos_can_access_ai_household($1,$2) AS allowed`,[input.householdId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('HOUSEHOLD_ANALYTICS_ACCESS_DENIED',403);
  const [pets,care,bookings,tracking,orders,recommendations]=await Promise.all([
    client.query(`SELECT COUNT(*)::int AS count FROM pets WHERE household_id=$1 AND status<>'ARCHIVED'`,[input.householdId]),
    client.query(
      `SELECT COUNT(*) FILTER(WHERE record_type='OBLIGATION')::int AS obligations,
        COUNT(*) FILTER(WHERE record_type='OBLIGATION' AND occurred_at<now() AND COALESCE(status,'') NOT IN ('COMPLETED','DONE'))::int AS overdue
       FROM care_records WHERE household_id=$1 AND occurred_at BETWEEN $2 AND $3`,
      [input.householdId,input.windowStart,input.windowEnd],
    ),
    client.query(
      `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE status='COMPLETED')::int AS completed,
        COUNT(*) FILTER(WHERE status IN ('CONFIRMED','IN_PROGRESS'))::int AS active
       FROM bookings WHERE household_id=$1 AND start_at BETWEEN $2 AND $3`,
      [input.householdId,input.windowStart,input.windowEnd],
    ),
    client.query(`SELECT COUNT(*)::int AS online FROM tracking_devices WHERE household_id=$1 AND connectivity_status='ONLINE'`,[input.householdId]),
    client.query(
      `SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER(WHERE status NOT IN ('COMPLETED','CLOSED','CANCELLED'))::int AS active
       FROM commerce_orders WHERE household_id=$1 AND created_at BETWEEN $2 AND $3`,
      [input.householdId,input.windowStart,input.windowEnd],
    ),
    client.query(
      `SELECT COUNT(*) FILTER(WHERE status='ACTIVE')::int AS active,
        COUNT(*) FILTER(WHERE status='ACCEPTED')::int AS accepted
       FROM ai_recommendations WHERE household_id=$1 AND created_at BETWEEN $2 AND $3`,
      [input.householdId,input.windowStart,input.windowEnd],
    ),
  ]);
  const metrics=[
    metric('pets-active','Active pets','PET_CORE',pets.rows[0].count,'COUNT','Canonical non-archived Pets in the Household.','pets'),
    metric('care-overdue','Overdue care','CARE',care.rows[0].overdue,'COUNT','Care obligations past due and not completed.','care_records'),
    metric('bookings-completed','Completed bookings','BOOKING',bookings.rows[0].completed,'COUNT','Bookings completed in the selected window.','bookings'),
    metric('trackers-online','Online trackers','TRACKING',tracking.rows[0].online,'COUNT','Household tracking devices currently online.','tracking_devices'),
    metric('commerce-active-orders','Orders in progress','COMMERCE',orders.rows[0].active,'COUNT','Commerce orders not yet closed/completed/cancelled.','commerce_orders'),
    metric('ai-active-recommendations','Active recommendations','AI',recommendations.rows[0].active,'COUNT','Governed AI recommendations currently active.','ai_recommendations'),
  ];
  const outcomes=[
    {outcomeId:'care-followthrough',title:'Care follow-through',value:Number(care.rows[0].obligations)===0?100:Math.max(0,Math.round(100*(Number(care.rows[0].obligations)-Number(care.rows[0].overdue))/Number(care.rows[0].obligations))),unit:'PERCENT',status:status(Number(care.rows[0].overdue),0,2),interpretation:'Operational completion signal for due care obligations.',caveat:'This is not a medical outcome or causal health measure.',sourceDomains:['CARE']},
    {outcomeId:'service-continuity',title:'Service continuity',value:Number(bookings.rows[0].completed),unit:'COUNT',status:'INFORMATIONAL',interpretation:'Completed service interactions during the selected period.',caveat:'Counts service completion only; it does not evaluate quality or clinical outcomes.',sourceDomains:['BOOKING','PROFESSIONAL_CARE']},
  ];
  const operations=[
    {signalId:'overdue-care',title:'Overdue care attention',status:status(Number(care.rows[0].overdue),0,2),value:Number(care.rows[0].overdue),unit:'COUNT',threshold:'Healthy when zero overdue obligations',explanation:'Outstanding care obligations that may require household action.',sourceDomain:'CARE',drilldownTab:'sprint6'},
    {signalId:'active-orders',title:'Commerce orders in progress',status:'INFORMATIONAL',value:Number(orders.rows[0].active),unit:'COUNT',explanation:'Current commerce fulfillment workload for the household.',sourceDomain:'COMMERCE',drilldownTab:'sprint27'},
  ];
  const analyticsSnapshotId=`analytics-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO analytics_snapshots(
      analytics_snapshot_id,actor_user_id,audience,household_id,scope_id,window_start,window_end,timezone,metrics,outcomes,operations,provenance,disclaimers
     ) VALUES($1,$2,'HOUSEHOLD',$3,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)`,
    [analyticsSnapshotId,input.actorUserId,input.householdId,input.windowStart,input.windowEnd,input.timezone,JSON.stringify(metrics),JSON.stringify(outcomes),JSON.stringify(operations),
      JSON.stringify(['pets','care_records','bookings','tracking_devices','commerce_orders','ai_recommendations']),
      JSON.stringify(['Analytics are derived projections; canonical domain stores remain authoritative.','No exact tracker coordinates, clinical note bodies, credentials, payment instruments or access secrets are included.','Outcome indicators are descriptive and are not medical diagnosis or causal proof.'])],
  );
  return {analyticsSnapshotId,audience:'HOUSEHOLD',scopeId:input.householdId,windowStart:input.windowStart,windowEnd:input.windowEnd,generatedAt:new Date().toISOString(),timezone:input.timezone,metrics,outcomes,operations};
}

export async function generateProviderAnalytics(client:PoolClient,input:{
  actorUserId:string;providerId:string;windowStart:string;windowEnd:string;timezone:string;
}){
  const access=await client.query(`SELECT petos_can_manage_provider($1,$2) AS allowed`,[input.providerId,input.actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('PROVIDER_ANALYTICS_ACCESS_DENIED',403);
  const [bookings,care,reviews,earnings]=await Promise.all([
    client.query(
      `SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='COMPLETED')::int AS completed,
        COUNT(*) FILTER(WHERE status='CANCELLED')::int AS cancelled
       FROM bookings WHERE provider_id=$1 AND start_at BETWEEN $2 AND $3`,
      [input.providerId,input.windowStart,input.windowEnd],
    ),
    client.query(
      `SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='COMPLETED')::int AS completed
       FROM professional_care_engagements WHERE provider_id=$1 AND scheduled_start_at BETWEEN $2 AND $3`,
      [input.providerId,input.windowStart,input.windowEnd],
    ),
    client.query(
      `SELECT COUNT(*)::int AS count,COALESCE(AVG(overall_rating),0)::float AS rating
       FROM reviews WHERE provider_id=$1 AND created_at BETWEEN $2 AND $3 AND status='PUBLISHED' AND moderation_status='APPROVED'`,
      [input.providerId,input.windowStart,input.windowEnd],
    ),
    client.query(
      `SELECT COALESCE(SUM(net_amount_minor),0)::bigint AS net
       FROM finance_provider_earnings WHERE provider_id=$1 AND created_at BETWEEN $2 AND $3`,
      [input.providerId,input.windowStart,input.windowEnd],
    ).catch(()=>({rows:[{net:0}]} as any)),
  ]);
  const completionRate=Number(bookings.rows[0].total)===0?100:Math.round(100*Number(bookings.rows[0].completed)/Number(bookings.rows[0].total));
  const metrics=[
    metric('provider-bookings','Bookings','BOOKING',bookings.rows[0].total,'COUNT','Provider bookings in selected window.','bookings'),
    metric('provider-completion-rate','Booking completion rate','BOOKING',completionRate,'PERCENT','Completed bookings divided by total bookings.','bookings'),
    metric('provider-care-completed','Care engagements completed','PROFESSIONAL_CARE',care.rows[0].completed,'COUNT','Professional care engagements completed in window.','professional_care_engagements'),
    metric('provider-rating','Average review rating','REVIEWS',Number(reviews.rows[0].rating),'RATING','Average published review rating.','reviews'),
    metric('provider-net-earnings','Net provider earnings','FINANCE',Number(earnings.rows[0].net),'MINOR_UNITS','Durable provider net earnings recorded by Finance.','finance_provider_earnings'),
  ];
  const outcomes=[
    {outcomeId:'provider-service-completion',title:'Service completion',value:completionRate,unit:'PERCENT',status:completionRate>=95?'HEALTHY':completionRate>=80?'WATCH':'ACTION_NEEDED',interpretation:'Operational completion rate for Provider bookings.',caveat:'Completion does not imply clinical or customer outcome quality.',sourceDomains:['BOOKING','PROFESSIONAL_CARE']},
  ];
  const operations=[
    {signalId:'provider-cancellations',title:'Booking cancellations',status:status(Number(bookings.rows[0].cancelled),0,2),value:Number(bookings.rows[0].cancelled),unit:'COUNT',threshold:'Watch when cancellations exceed 2 in the selected window',explanation:'Cancelled Provider bookings requiring operational review.',sourceDomain:'BOOKING',drilldownTab:'sprint11'},
  ];
  const analyticsSnapshotId=`analytics-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO analytics_snapshots(
      analytics_snapshot_id,actor_user_id,audience,provider_id,scope_id,window_start,window_end,timezone,metrics,outcomes,operations,provenance,disclaimers
     ) VALUES($1,$2,'PROVIDER',$3,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)`,
    [analyticsSnapshotId,input.actorUserId,input.providerId,input.windowStart,input.windowEnd,input.timezone,JSON.stringify(metrics),JSON.stringify(outcomes),JSON.stringify(operations),
      JSON.stringify(['bookings','professional_care_engagements','reviews','finance_provider_earnings']),
      JSON.stringify(['Analytics are derived projections; canonical domain stores remain authoritative.','No household clinical content, exact location, payment instruments or credentials are included.'])],
  );
  return {analyticsSnapshotId,audience:'PROVIDER',scopeId:input.providerId,windowStart:input.windowStart,windowEnd:input.windowEnd,generatedAt:new Date().toISOString(),timezone:input.timezone,metrics,outcomes,operations};
}

export async function generatePlatformAnalytics(client:PoolClient,input:{actorUserId:string;windowStart:string;windowEnd:string;timezone:string}){
  const [users,orders,integrations,ai,automation,webhooks]=await Promise.all([
    client.query(`SELECT COUNT(*)::int AS count FROM users WHERE account_status='ACTIVE'`),
    client.query(`SELECT COUNT(*)::int AS count FROM commerce_orders WHERE created_at BETWEEN $1 AND $2`,[input.windowStart,input.windowEnd]),
    client.query(`SELECT COUNT(*)::int AS count FROM integration_installations WHERE status='ACTIVE'`),
    client.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='FAILED')::int AS failed FROM ai_requests WHERE created_at BETWEEN $1 AND $2`,[input.windowStart,input.windowEnd]),
    client.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='FAILED')::int AS failed FROM automation_action_proposals WHERE created_at BETWEEN $1 AND $2`,[input.windowStart,input.windowEnd]),
    client.query(`SELECT COUNT(*) FILTER(WHERE status IN ('PERMANENT_FAILURE','DEAD_LETTER'))::int AS failed FROM integration_webhook_deliveries WHERE created_at BETWEEN $1 AND $2`,[input.windowStart,input.windowEnd]),
  ]);
  const metrics=[
    metric('platform-active-users','Active users','IDENTITY',users.rows[0].count,'COUNT','Active platform accounts.','users'),
    metric('platform-commerce-orders','Commerce orders','COMMERCE',orders.rows[0].count,'COUNT','Commerce orders created in window.','commerce_orders'),
    metric('platform-integrations','Active integrations','INTEGRATIONS',integrations.rows[0].count,'COUNT','Active Household integration installations.','integration_installations'),
    metric('platform-ai-failures','AI failures','AI',ai.rows[0].failed,'COUNT','Governed AI requests marked failed.','ai_requests'),
    metric('platform-automation-failures','Automation failures','AUTOMATION',automation.rows[0].failed,'COUNT','Action proposals ending in failure.','automation_action_proposals'),
    metric('platform-webhook-deadletters','Webhook dead letters','INTEGRATIONS',webhooks.rows[0].failed,'COUNT','Webhook deliveries requiring operator attention.','integration_webhook_deliveries'),
  ];
  const outcomes=[{outcomeId:'platform-runtime-safety',title:'Governed runtime failures',value:Number(ai.rows[0].failed)+Number(automation.rows[0].failed)+Number(webhooks.rows[0].failed),unit:'COUNT',status:status(Number(ai.rows[0].failed)+Number(automation.rows[0].failed)+Number(webhooks.rows[0].failed),0,5),interpretation:'Aggregate operational failure signal across governed Wave 6 runtimes.',caveat:'Aggregate only; no tenant content is exposed.',sourceDomains:['AI','AUTOMATION','INTEGRATIONS']}];
  const operations=[
    {signalId:'webhook-deadletters',title:'Webhook delivery failures',status:status(Number(webhooks.rows[0].failed),0,3),value:Number(webhooks.rows[0].failed),unit:'COUNT',threshold:'Healthy when zero permanent failures/dead letters',explanation:'Integration deliveries requiring platform operations review.',sourceDomain:'INTEGRATIONS',drilldownTab:'sprint31'},
    {signalId:'automation-failures',title:'Automation failures',status:status(Number(automation.rows[0].failed),0,3),value:Number(automation.rows[0].failed),unit:'COUNT',threshold:'Healthy when zero failed proposals',explanation:'Governed automation actions ending in failure.',sourceDomain:'ORCHESTRATION',drilldownTab:'sprint29'},
  ];
  const analyticsSnapshotId=`analytics-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO analytics_snapshots(
      analytics_snapshot_id,actor_user_id,audience,scope_id,window_start,window_end,timezone,metrics,outcomes,operations,provenance,disclaimers
     ) VALUES($1,$2,'PLATFORM_OPS','PET_OS_PLATFORM',$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)`,
    [analyticsSnapshotId,input.actorUserId,input.windowStart,input.windowEnd,input.timezone,JSON.stringify(metrics),JSON.stringify(outcomes),JSON.stringify(operations),
      JSON.stringify(['users','commerce_orders','integration_installations','ai_requests','automation_action_proposals','integration_webhook_deliveries']),
      JSON.stringify(['Platform analytics contain aggregate operational counts only.','No household clinical, financial instrument, exact-location, secret or credential content is exposed.'])],
  );
  return {analyticsSnapshotId,audience:'PLATFORM_OPS',scopeId:'PET_OS_PLATFORM',windowStart:input.windowStart,windowEnd:input.windowEnd,generatedAt:new Date().toISOString(),timezone:input.timezone,metrics,outcomes,operations};
}

export async function listAnalyticsSnapshots(client:PoolClient,input:{actorUserId:string;audience:'HOUSEHOLD'|'PROVIDER';scopeId:string;limit:number}){
  const result=await client.query(
    `SELECT analytics_snapshot_id,audience,scope_id,window_start,window_end,timezone,metrics,outcomes,operations,provenance,disclaimers,privacy_version,generated_at
     FROM analytics_snapshots WHERE audience=$1 AND scope_id=$2 ORDER BY generated_at DESC LIMIT $3`,
    [input.audience,input.scopeId,Math.min(input.limit,50)],
  );
  return result.rows;
}
