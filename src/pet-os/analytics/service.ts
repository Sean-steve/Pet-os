import type { HouseholdId, ProviderId, UserId } from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { ActivityStore } from '../activity/store';
import { TrainingStore } from '../training/store';
import { BookingStore } from '../booking/store';
import { NotificationStore } from '../notifications/store';
import { TrackingStore } from '../tracking/store';
import { OrchestrationStore } from '../orchestration/store';
import { IntegrationStore } from '../integrations/store';
import { ProviderStore } from '../provider/store';
import { ReviewStore } from '../reviews/store';
import { FinanceStore } from '../finance/store';
import type { AnalyticsContext, AnalyticsMetric, AnalyticsSnapshot, IntelligenceStatus, MetricDirection, MetricSeries, OutcomeIndicator, OperationsSignal } from './types';

const DAY=24*60*60*1000;
const pct=(n:number,d:number)=>d<=0?0:Math.round((n/d)*1000)/10;
const inWindow=(iso:string,start:number,end:number)=>{const t=new Date(iso).getTime();return Number.isFinite(t)&&t>=start&&t<=end;};

function windowFor(ctx:AnalyticsContext){
  const end=ctx.windowEnd?new Date(ctx.windowEnd):new Date();
  const start=ctx.windowStart?new Date(ctx.windowStart):new Date(end.getTime()-30*DAY);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw new Error('ANALYTICS_WINDOW_INVALID');
  if(end.getTime()-start.getTime()>366*DAY)throw new Error('ANALYTICS_WINDOW_TOO_LARGE');
  return {start,startMs:start.getTime(),end,endMs:end.getTime(),previousStartMs:start.getTime()-(end.getTime()-start.getTime()),previousEndMs:start.getTime()-1};
}

function direction(value:number,previous?:number):MetricDirection{
  if(previous===undefined||!Number.isFinite(previous))return 'NOT_COMPARABLE';
  const delta=value-previous;
  if(Math.abs(delta)<0.0001)return 'FLAT';
  return delta>0?'UP':'DOWN';
}
function metric(input:Omit<AnalyticsMetric,'direction'|'asOf'>):AnalyticsMetric{
  return {...input,direction:direction(input.value,input.previousValue),asOf:new Date().toISOString()};
}
function statusForPercent(v:number,healthy:number,watch:number):IntelligenceStatus{
  if(v>=healthy)return 'HEALTHY'; if(v>=watch)return 'WATCH'; return 'ACTION_NEEDED';
}
function activeHousehold(actor:UserId,household:HouseholdId){
  const m=IdentityStore.findMembership(household,actor);
  if(!m||m.status!=='ACTIVE')throw new Error('ANALYTICS_HOUSEHOLD_ACCESS_DENIED');
}
function providerSelf(actor:UserId,providerId:ProviderId){
  const p=ProviderStore.getInstance().getProvider(providerId);
  if(!p||p.userId!==actor)throw new Error('ANALYTICS_PROVIDER_ACCESS_DENIED');
  return p;
}
function platformOps(actor:UserId){
  const reviewer=IntegrationStore.getInstance().getPlatformReviewer(String(actor));
  if(!reviewer||reviewer.status!=='ACTIVE'||!reviewer.permissions.some(p=>p==='SECURITY_REVIEW'||p==='INCIDENT_RESPONSE'||p==='APP_REVIEW')){
    throw new Error('ANALYTICS_PLATFORM_ACCESS_DENIED');
  }
}

function terminalBooking(status:string){return ['COMPLETED','NO_SHOW','CANCELLED_BY_OWNER','CANCELLED_BY_PROVIDER','DECLINED','EXPIRED'].includes(status);}
function cancelBooking(status:string){return ['CANCELLED_BY_OWNER','CANCELLED_BY_PROVIDER','DECLINED','EXPIRED'].includes(status);}
function careStats(householdId:HouseholdId,start:number,end:number){
  const rows=CareStore.getAllOccurrences().filter(o=>o.householdId===householdId&&inWindow(o.scheduledFor,start,end));
  const eligible=rows.filter(o=>['COMPLETED','SKIPPED','OVERDUE'].includes(o.status));
  const completed=eligible.filter(o=>o.status==='COMPLETED').length;
  return {rows,eligible:eligible.length,completed,rate:pct(completed,eligible.length),overdue:rows.filter(o=>o.status==='OVERDUE').length};
}
function activityMinutes(householdId:HouseholdId,start:number,end:number){
  return Math.round(ActivityStore.getRecordsForHousehold(householdId).filter(r=>inWindow(r.startedAt,start,end)).reduce((a,r)=>a+r.durationSeconds,0)/60);
}
function trainingStats(householdId:HouseholdId,start:number,end:number){
  const pets=PetStore.listPetsByHousehold(householdId);
  const sessions=pets.flatMap(p=>TrainingStore.listSessionsForPet(p.petId)).filter(s=>inWindow(s.startedAt,start,end));
  return {total:sessions.length,completed:sessions.filter(s=>s.status==='COMPLETED').length};
}
function householdBookings(householdId:HouseholdId,start:number,end:number){
  return BookingStore.getInstance().listBookingsByHousehold(householdId).filter(b=>inWindow(b.startAt,start,end));
}
function proposalStats(householdId:HouseholdId,start:number,end:number){
  const rows=OrchestrationStore.getInstance().listProposals().filter(p=>p.householdId===householdId&&inWindow(p.updatedAt,start,end)&&['COMPLETED','FAILED','PARTIALLY_COMPLETED'].includes(p.status));
  return {total:rows.length,success:rows.filter(p=>p.status==='COMPLETED').length,rate:pct(rows.filter(p=>p.status==='COMPLETED').length,rows.length)};
}

export class AnalyticsService{
  static getSnapshot(ctx:AnalyticsContext):AnalyticsSnapshot{
    const w=windowFor(ctx),timezone=ctx.timezone||'Africa/Nairobi';
    if(ctx.audience==='HOUSEHOLD'){
      if(!ctx.householdId)throw new Error('ANALYTICS_HOUSEHOLD_REQUIRED');
      activeHousehold(ctx.actorUserId,ctx.householdId);
      return this.household(ctx,w,timezone);
    }
    if(ctx.audience==='PROVIDER'){
      if(!ctx.providerId)throw new Error('ANALYTICS_PROVIDER_REQUIRED');
      providerSelf(ctx.actorUserId,ctx.providerId);
      return this.provider(ctx,w,timezone);
    }
    platformOps(ctx.actorUserId);
    return this.platform(ctx,w,timezone);
  }

  private static household(ctx:AnalyticsContext,w:ReturnType<typeof windowFor>,timezone:string):AnalyticsSnapshot{
    const hh=ctx.householdId!;
    const care=careStats(hh,w.startMs,w.endMs),prevCare=careStats(hh,w.previousStartMs,w.previousEndMs);
    const activity=activityMinutes(hh,w.startMs,w.endMs),prevActivity=activityMinutes(hh,w.previousStartMs,w.previousEndMs);
    const training=trainingStats(hh,w.startMs,w.endMs),prevTraining=trainingStats(hh,w.previousStartMs,w.previousEndMs);
    const bookings=householdBookings(hh,w.startMs,w.endMs),prevBookings=householdBookings(hh,w.previousStartMs,w.previousEndMs);
    const terminal=bookings.filter(b=>terminalBooking(b.status)),prevTerminal=prevBookings.filter(b=>terminalBooking(b.status));
    const bookingRate=pct(terminal.filter(b=>b.status==='COMPLETED').length,terminal.length);
    const prevBookingRate=pct(prevTerminal.filter(b=>b.status==='COMPLETED').length,prevTerminal.length);
    const props=proposalStats(hh,w.startMs,w.endMs),prevProps=proposalStats(hh,w.previousStartMs,w.previousEndMs);
    const notes=NotificationStore.getNotificationsForUser(ctx.actorUserId).filter(n=>inWindow(n.createdAt,w.startMs,w.endMs));
    const prevNotes=NotificationStore.getNotificationsForUser(ctx.actorUserId).filter(n=>inWindow(n.createdAt,w.previousStartMs,w.previousEndMs));
    const delivered=notes.filter(n=>['DELIVERED','SENT'].includes(n.status)).length,prevDelivered=prevNotes.filter(n=>['DELIVERED','SENT'].includes(n.status)).length;
    const devices=TrackingStore.getInstance().listDevicesForHousehold(hh);
    const online=devices.filter(d=>d.connectivityStatus==='ONLINE').length;
    const metrics:AnalyticsMetric[]=[
      metric({metricId:'household.care_adherence',label:'Care completion rate',domain:'CARE',value:care.rate,unit:'PERCENT',numerator:care.completed,denominator:care.eligible,previousValue:prevCare.rate,definition:'Completed care occurrences divided by completed, skipped, or overdue occurrences scheduled in the window.',source:'CareStore'}),
      metric({metricId:'household.activity_minutes',label:'Activity minutes',domain:'ACTIVITY',value:activity,unit:'MINUTES',previousValue:prevActivity,definition:'Sum of canonical ActivityRecord durations in the window.',source:'ActivityStore'}),
      metric({metricId:'household.training_sessions',label:'Completed training sessions',domain:'TRAINING',value:training.completed,unit:'COUNT',numerator:training.completed,denominator:training.total,previousValue:prevTraining.completed,definition:'Canonical training sessions with COMPLETED status in the window.',source:'TrainingStore'}),
      metric({metricId:'household.service_completion',label:'Service completion rate',domain:'BOOKING',value:bookingRate,unit:'PERCENT',numerator:terminal.filter(b=>b.status==='COMPLETED').length,denominator:terminal.length,previousValue:prevBookingRate,definition:'Completed bookings divided by terminal bookings in the window.',source:'BookingStore'}),
      metric({metricId:'household.notification_delivery',label:'Notification delivery rate',domain:'NOTIFICATIONS',value:pct(delivered,notes.length),unit:'PERCENT',numerator:delivered,denominator:notes.length,previousValue:pct(prevDelivered,prevNotes.length),definition:'Sent or delivered notifications for this actor divided by actor notifications created in the window.',source:'NotificationStore'}),
      metric({metricId:'household.automation_success',label:'Confirmed action success rate',domain:'ORCHESTRATION',value:props.rate,unit:'PERCENT',numerator:props.success,denominator:props.total,previousValue:prevProps.rate,definition:'Completed terminal action proposals divided by completed/failed/partial proposals in the household.',source:'OrchestrationStore'}),
      metric({metricId:'household.trackers_online',label:'Trackers online now',domain:'TRACKING',value:online,unit:'COUNT',numerator:online,denominator:devices.length,definition:'Point-in-time device connectivity snapshot; not historical uptime.',source:'TrackingStore'}),
    ];
    const outcomes:OutcomeIndicator[]=[
      {outcomeId:'care-consistency',title:'Care consistency',value:care.rate,unit:'PERCENT',status:statusForPercent(care.rate,90,75),interpretation:'Household execution of scheduled preventive-care tasks.',caveat:'Operational adherence only; it is not a clinical outcome or diagnosis.',sourceDomains:['CARE']},
      {outcomeId:'activity-engagement',title:'Activity engagement',value:activity,unit:'MINUTES',status:activity>0?'HEALTHY':'WATCH',interpretation:'Recorded physical activity during the selected period.',caveat:'Minutes are descriptive and are not a veterinary exercise prescription.',sourceDomains:['ACTIVITY']},
      {outcomeId:'training-engagement',title:'Training engagement',value:training.completed,unit:'COUNT',status:training.completed>0?'HEALTHY':'INFORMATIONAL',interpretation:'Completed household/professional training sessions.',caveat:'Session count does not imply behavior improvement or clinical efficacy.',sourceDomains:['TRAINING']},
      {outcomeId:'service-continuity',title:'Service continuity',value:bookingRate,unit:'PERCENT',status:statusForPercent(bookingRate,90,70),interpretation:'Share of terminal service bookings completed.',caveat:'Cancellation/no-show context must be reviewed in the Booking domain before conclusions are drawn.',sourceDomains:['BOOKING']},
    ];
    const operations:OperationsSignal[]=[
      {signalId:'overdue-care',title:'Overdue care',status:care.overdue>0?'ACTION_NEEDED':'HEALTHY',value:care.overdue,unit:'COUNT',threshold:'Action needed when > 0',explanation:'Canonical overdue Care occurrences in the selected window.',sourceDomain:'CARE',drilldownTab:'sprint6'},
      {signalId:'tracker-readiness',title:'Tracker readiness',status:devices.length===0?'INFORMATIONAL':online===devices.length?'HEALTHY':online>0?'WATCH':'ACTION_NEEDED',value:pct(online,devices.length),unit:'PERCENT',threshold:'Healthy when all assigned household devices are online',explanation:'Current connectivity only; does not imply a fresh GPS fix.',sourceDomain:'TRACKING',drilldownTab:'sprint14'},
      {signalId:'action-reliability',title:'Action workflow reliability',status:props.total===0?'INFORMATIONAL':statusForPercent(props.rate,95,80),value:props.rate,unit:'PERCENT',threshold:'Healthy ≥ 95%',explanation:'Sprint 29 terminal action workflow success rate.',sourceDomain:'ORCHESTRATION',drilldownTab:'sprint29'},
    ];
    return this.finish(ctx,String(hh),w,timezone,metrics,outcomes,operations,['CareStore','ActivityStore','TrainingStore','BookingStore','NotificationStore','TrackingStore','OrchestrationStore']);
  }

  private static provider(ctx:AnalyticsContext,w:ReturnType<typeof windowFor>,timezone:string):AnalyticsSnapshot{
    const providerId=ctx.providerId!,provider=providerSelf(ctx.actorUserId,providerId);
    const rows=BookingStore.getInstance().listBookingsByProvider(providerId).filter(b=>inWindow(b.startAt,w.startMs,w.endMs));
    const prev=BookingStore.getInstance().listBookingsByProvider(providerId).filter(b=>inWindow(b.startAt,w.previousStartMs,w.previousEndMs));
    const terminal=rows.filter(b=>terminalBooking(b.status)),prevTerminal=prev.filter(b=>terminalBooking(b.status));
    const completed=terminal.filter(b=>b.status==='COMPLETED').length,prevCompleted=prevTerminal.filter(b=>b.status==='COMPLETED').length;
    const noShow=terminal.filter(b=>b.status==='NO_SHOW').length;
    const cancelled=terminal.filter(b=>cancelBooking(b.status)).length;
    const reviews=ReviewStore.getInstance().listReviewsForProvider(providerId).filter(r=>r.status==='PUBLISHED'&&inWindow(r.createdAt,w.startMs,w.endMs));
    const prevReviews=ReviewStore.getInstance().listReviewsForProvider(providerId).filter(r=>r.status==='PUBLISHED'&&inWindow(r.createdAt,w.previousStartMs,w.previousEndMs));
    const rating=reviews.length?Math.round((reviews.reduce((a,r)=>a+r.overallRating,0)/reviews.length)*100)/100:0;
    const prevRating=prevReviews.length?Math.round((prevReviews.reduce((a,r)=>a+r.overallRating,0)/prevReviews.length)*100)/100:0;
    const financial=FinanceStore.getInstance().getProviderFinancialSummary(providerId,'KES');
    const metrics:AnalyticsMetric[]=[
      metric({metricId:'provider.bookings',label:'Bookings',domain:'BOOKING',value:rows.length,unit:'COUNT',previousValue:prev.length,definition:'Provider bookings scheduled in the selected window.',source:'BookingStore'}),
      metric({metricId:'provider.completion_rate',label:'Completion rate',domain:'BOOKING',value:pct(completed,terminal.length),unit:'PERCENT',numerator:completed,denominator:terminal.length,previousValue:pct(prevCompleted,prevTerminal.length),definition:'Completed bookings divided by terminal provider bookings.',source:'BookingStore'}),
      metric({metricId:'provider.no_show_rate',label:'No-show rate',domain:'BOOKING',value:pct(noShow,terminal.length),unit:'PERCENT',numerator:noShow,denominator:terminal.length,definition:'No-show bookings divided by terminal provider bookings.',source:'BookingStore'}),
      metric({metricId:'provider.rating',label:'Verified-service rating',domain:'REVIEWS',value:rating,unit:'RATING',numerator:reviews.length,previousValue:prevRating,definition:'Average published verified-service review rating in the selected window.',source:'ReviewStore'}),
      metric({metricId:'provider.available_earnings',label:'Available earnings',domain:'FINANCE',value:financial.availableBalanceMinor,unit:'MINOR_UNITS',definition:'Authoritative Finance domain provider summary in KES minor units; not recomputed from bookings.',source:'FinanceStore'}),
    ];
    const outcomes:OutcomeIndicator[]=[
      {outcomeId:'provider-service-reliability',title:'Service reliability',value:pct(completed,terminal.length),unit:'PERCENT',status:statusForPercent(pct(completed,terminal.length),95,80),interpretation:'Completion of terminal bookings for this provider.',caveat:'Operational service outcome only; does not measure clinical or training efficacy.',sourceDomains:['BOOKING']},
      {outcomeId:'provider-customer-feedback',title:'Customer feedback',value:rating,unit:'RATING',status:reviews.length===0?'INFORMATIONAL':rating>=4.5?'HEALTHY':rating>=3.5?'WATCH':'ACTION_NEEDED',interpretation:'Average published verified-service review rating.',caveat:'Ratings are customer experience signals and never credential verification.',sourceDomains:['REVIEWS']},
    ];
    const operations:OperationsSignal[]=[
      {signalId:'provider-no-show',title:'No-show rate',status:pct(noShow,terminal.length)>10?'ACTION_NEEDED':pct(noShow,terminal.length)>5?'WATCH':'HEALTHY',value:pct(noShow,terminal.length),unit:'PERCENT',threshold:'Watch > 5%; action needed > 10%',explanation:'Terminal bookings recorded as NO_SHOW.',sourceDomain:'BOOKING',drilldownTab:'sprint11'},
      {signalId:'provider-cancellations',title:'Cancellation/decline rate',status:pct(cancelled,terminal.length)>20?'WATCH':'HEALTHY',value:pct(cancelled,terminal.length),unit:'PERCENT',threshold:'Watch > 20%',explanation:'Owner/provider cancellations, declines and expirations among terminal bookings.',sourceDomain:'BOOKING',drilldownTab:'sprint11'},
    ];
    return this.finish(ctx,String(providerId),w,timezone,metrics,outcomes,operations,['BookingStore','ReviewStore','FinanceStore'],['Provider finance figures come from FinanceStore and are never reconstructed from booking totals.']);
  }

  private static platform(ctx:AnalyticsContext,w:ReturnType<typeof windowFor>,timezone:string):AnalyticsSnapshot{
    const bookings=BookingStore.getInstance().listAllBookings().filter(b=>inWindow(b.createdAt,w.startMs,w.endMs));
    const prevBookings=BookingStore.getInstance().listAllBookings().filter(b=>inWindow(b.createdAt,w.previousStartMs,w.previousEndMs));
    const terminal=bookings.filter(b=>terminalBooking(b.status)),prevTerminal=prevBookings.filter(b=>terminalBooking(b.status));
    const completed=terminal.filter(b=>b.status==='COMPLETED').length,prevCompleted=prevTerminal.filter(b=>b.status==='COMPLETED').length;
    const notes=NotificationStore.getAllNotifications().filter(n=>inWindow(n.createdAt,w.startMs,w.endMs));
    const prevNotes=NotificationStore.getAllNotifications().filter(n=>inWindow(n.createdAt,w.previousStartMs,w.previousEndMs));
    const noteGood=notes.filter(n=>['DELIVERED','SENT'].includes(n.status)).length,prevNoteGood=prevNotes.filter(n=>['DELIVERED','SENT'].includes(n.status)).length;
    const proposals=OrchestrationStore.getInstance().listProposals().filter(p=>inWindow(p.updatedAt,w.startMs,w.endMs)&&['COMPLETED','FAILED','PARTIALLY_COMPLETED'].includes(p.status));
    const prevProposals=OrchestrationStore.getInstance().listProposals().filter(p=>inWindow(p.updatedAt,w.previousStartMs,w.previousEndMs)&&['COMPLETED','FAILED','PARTIALLY_COMPLETED'].includes(p.status));
    const orchGood=proposals.filter(p=>p.status==='COMPLETED').length,prevOrchGood=prevProposals.filter(p=>p.status==='COMPLETED').length;
    const deliveries=IntegrationStore.getInstance().listDeliveries().filter(d=>inWindow(d.createdAt,w.startMs,w.endMs));
    const prevDeliveries=IntegrationStore.getInstance().listDeliveries().filter(d=>inWindow(d.createdAt,w.previousStartMs,w.previousEndMs));
    const delivered=deliveries.filter(d=>d.status==='DELIVERED').length,prevDelivered=prevDeliveries.filter(d=>d.status==='DELIVERED').length;
    const dead=deliveries.filter(d=>d.status==='DEAD_LETTER').length;
    const activeApps=IntegrationStore.getInstance().listApps().filter(a=>a.status==='ACTIVE').length;
    const activeInstalls=IntegrationStore.getInstance().listApps().flatMap(a=>IntegrationStore.getInstance().listInstallationsForApp(a.developerAppId)).filter(i=>i.status==='ACTIVE').length;
    const deniedAudits=IntegrationStore.getInstance().listAudits().filter(a=>a.outcome==='DENIED'&&inWindow(a.createdAt,w.startMs,w.endMs)).length;
    const metrics:AnalyticsMetric[]=[
      metric({metricId:'platform.booking_volume',label:'Booking volume',domain:'BOOKING',value:bookings.length,unit:'COUNT',previousValue:prevBookings.length,definition:'Bookings created during the selected window.',source:'BookingStore'}),
      metric({metricId:'platform.booking_completion',label:'Booking completion rate',domain:'BOOKING',value:pct(completed,terminal.length),unit:'PERCENT',numerator:completed,denominator:terminal.length,previousValue:pct(prevCompleted,prevTerminal.length),definition:'Completed bookings divided by terminal bookings.',source:'BookingStore'}),
      metric({metricId:'platform.notification_delivery',label:'Notification delivery rate',domain:'NOTIFICATIONS',value:pct(noteGood,notes.length),unit:'PERCENT',numerator:noteGood,denominator:notes.length,previousValue:pct(prevNoteGood,prevNotes.length),definition:'Sent/delivered notifications divided by notifications created in the window.',source:'NotificationStore'}),
      metric({metricId:'platform.orchestration_success',label:'Action orchestration success',domain:'ORCHESTRATION',value:pct(orchGood,proposals.length),unit:'PERCENT',numerator:orchGood,denominator:proposals.length,previousValue:pct(prevOrchGood,prevProposals.length),definition:'Completed terminal action proposals divided by terminal action proposals.',source:'OrchestrationStore'}),
      metric({metricId:'platform.webhook_delivery',label:'Webhook delivery rate',domain:'INTEGRATIONS',value:pct(delivered,deliveries.length),unit:'PERCENT',numerator:delivered,denominator:deliveries.length,previousValue:pct(prevDelivered,prevDeliveries.length),definition:'Delivered Sprint 31 webhook deliveries divided by deliveries created in the window.',source:'IntegrationStore'}),
      metric({metricId:'platform.active_apps',label:'Active developer apps',domain:'INTEGRATIONS',value:activeApps,unit:'COUNT',definition:'Point-in-time count of platform-approved ACTIVE developer apps.',source:'IntegrationStore'}),
      metric({metricId:'platform.active_installations',label:'Active app installations',domain:'INTEGRATIONS',value:activeInstalls,unit:'COUNT',definition:'Point-in-time count of ACTIVE household app installations.',source:'IntegrationStore'}),
    ];
    const outcomes:OutcomeIndicator[]=[
      {outcomeId:'platform-service-flow',title:'Service-flow completion',value:pct(completed,terminal.length),unit:'PERCENT',status:statusForPercent(pct(completed,terminal.length),90,75),interpretation:'Platform booking completion across terminal service requests.',caveat:'This is operational throughput, not provider quality or Pet outcome causality.',sourceDomains:['BOOKING']},
      {outcomeId:'platform-action-reliability',title:'Action execution reliability',value:pct(orchGood,proposals.length),unit:'PERCENT',status:proposals.length===0?'INFORMATIONAL':statusForPercent(pct(orchGood,proposals.length),98,90),interpretation:'Reliability of terminal Sprint 29 action workflows.',caveat:'Failures require domain-level investigation before attribution.',sourceDomains:['ORCHESTRATION']},
      {outcomeId:'platform-integration-reliability',title:'Integration delivery reliability',value:pct(delivered,deliveries.length),unit:'PERCENT',status:deliveries.length===0?'INFORMATIONAL':statusForPercent(pct(delivered,deliveries.length),99,95),interpretation:'Successful external webhook delivery.',caveat:'A delivered webhook confirms transport success, not downstream partner processing.',sourceDomains:['INTEGRATIONS']},
    ];
    const operations:OperationsSignal[]=[
      {signalId:'webhook-dead-letter',title:'Webhook dead letters',status:dead>0?'CRITICAL':'HEALTHY',value:dead,unit:'COUNT',threshold:'Critical when > 0',explanation:'External deliveries exhausted their retry policy.',sourceDomain:'INTEGRATIONS',drilldownTab:'sprint31'},
      {signalId:'notification-dead-letter',title:'Notification dead letters',status:notes.some(n=>n.status==='DEAD_LETTER')?'CRITICAL':'HEALTHY',value:notes.filter(n=>n.status==='DEAD_LETTER').length,unit:'COUNT',threshold:'Critical when > 0',explanation:'Notification deliveries in terminal dead-letter state.',sourceDomain:'NOTIFICATIONS',drilldownTab:'sprint6'},
      {signalId:'integration-denials',title:'Denied integration access',status:deniedAudits>0?'WATCH':'HEALTHY',value:deniedAudits,unit:'COUNT',threshold:'Review when > 0',explanation:'Denied developer-platform authorization decisions during the window.',sourceDomain:'INTEGRATIONS',drilldownTab:'sprint31'},
      {signalId:'orchestration-failures',title:'Action workflow failures',status:proposals.length===0?'INFORMATIONAL':pct(orchGood,proposals.length)>=95?'HEALTHY':pct(orchGood,proposals.length)>=80?'WATCH':'ACTION_NEEDED',value:proposals.length-orchGood,unit:'COUNT',threshold:'Healthy when success ≥ 95%',explanation:'Terminal action proposals not completed successfully.',sourceDomain:'ORCHESTRATION',drilldownTab:'sprint29'},
    ];
    return this.finish(ctx,'PET_OS_PLATFORM',w,timezone,metrics,outcomes,operations,['BookingStore','NotificationStore','OrchestrationStore','IntegrationStore'],['Platform analytics are operational aggregates. They do not expose household-level clinical, financial, or exact-location content.']);
  }

  private static finish(ctx:AnalyticsContext,scopeId:string,w:ReturnType<typeof windowFor>,timezone:string,metrics:AnalyticsMetric[],outcomes:OutcomeIndicator[],operations:OperationsSignal[],provenance:string[],extra:string[]=[]):AnalyticsSnapshot{
    return {audience:ctx.audience,actorUserId:ctx.actorUserId,scopeId,windowStart:w.start.toISOString(),windowEnd:w.end.toISOString(),generatedAt:new Date().toISOString(),timezone,metrics,outcomes,operations,provenance,disclaimers:[
      'Analytics are derived projections; canonical source domains remain authoritative.',
      'Outcome indicators are descriptive operational signals and must not be interpreted as medical diagnosis, treatment efficacy, or causal proof.',
      'Exact tracker coordinates, private clinical notes, credentials, access secrets and raw payment instruments are excluded.',
      ...extra,
    ]};
  }

  static metricSeries(ctx:AnalyticsContext,metricId:string,buckets=6):MetricSeries{
    if(buckets<2||buckets>12)throw new Error('ANALYTICS_BUCKET_COUNT_INVALID');
    const w=windowFor(ctx),width=(w.endMs-w.startMs)/buckets;
    const points=[] as MetricSeries['points'];
    let label=metricId,unit:MetricSeries['unit']='COUNT';
    for(let i=0;i<buckets;i++){
      const start=new Date(w.startMs+i*width),end=new Date(i===buckets-1?w.endMs:w.startMs+(i+1)*width-1);
      const snap=this.getSnapshot({...ctx,windowStart:start.toISOString(),windowEnd:end.toISOString()});
      const m=snap.metrics.find(x=>x.metricId===metricId);
      if(!m)throw new Error('ANALYTICS_METRIC_NOT_FOUND');
      label=m.label;unit=m.unit;points.push({periodStart:start.toISOString(),periodEnd:end.toISOString(),value:m.value});
    }
    return {metricId,label,unit,points};
  }
}
