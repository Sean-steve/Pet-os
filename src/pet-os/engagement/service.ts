import type { HouseholdId, ProviderId, UserId } from '../kernel/ids';
import { generateUUIDv7 } from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { ActivityStore } from '../activity/store';
import { TrainingStore } from '../training/store';
import { BookingStore } from '../booking/store';
import { TrackingStore } from '../tracking/store';
import { OrchestrationStore } from '../orchestration/store';
import { IntegrationStore } from '../integrations/store';
import { ProviderStore } from '../provider/store';
import { ReviewStore } from '../reviews/store';
import { FinanceStore } from '../finance/store';
import { CommerceStore } from '../commerce/store';
import { EngagementStore } from './store';
import type { AdoptionMilestone, ActivationFunnelStep, EngagementContext, EngagementEvent, EngagementMetric, EngagementSnapshot, PlatformHealthSignal, RecordEngagementEventInput } from './types';

const DAY=24*60*60*1000;
const pct=(n:number,d:number)=>d<=0?0:Math.round((n/d)*1000)/10;
const inWindow=(iso:string,start:number,end:number)=>{const t=new Date(iso).getTime();return Number.isFinite(t)&&t>=start&&t<=end;};

function windowFor(ctx:EngagementContext){
  const end=ctx.windowEnd?new Date(ctx.windowEnd):new Date();
  const start=ctx.windowStart?new Date(ctx.windowStart):new Date(end.getTime()-30*DAY);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end)throw new Error('ENGAGEMENT_WINDOW_INVALID');
  if(end.getTime()-start.getTime()>180*DAY)throw new Error('ENGAGEMENT_WINDOW_TOO_LARGE');
  return {start,end,startMs:start.getTime(),endMs:end.getTime()};
}
function requireHousehold(actor:UserId,household:HouseholdId){
  const m=IdentityStore.findMembership(household,actor);
  if(!m||m.status!=='ACTIVE')throw new Error('ENGAGEMENT_HOUSEHOLD_ACCESS_DENIED');
}
function requireProvider(actor:UserId,providerId:ProviderId){
  const p=ProviderStore.getInstance().getProvider(providerId);
  if(!p||p.userId!==actor)throw new Error('ENGAGEMENT_PROVIDER_ACCESS_DENIED');
}
function requirePlatform(actor:UserId){
  const r=IntegrationStore.getInstance().getPlatformReviewer(String(actor));
  if(!r||r.status!=='ACTIVE'||!r.permissions.some(p=>p==='SECURITY_REVIEW'||p==='INCIDENT_RESPONSE'||p==='APP_REVIEW'))throw new Error('ENGAGEMENT_PLATFORM_ACCESS_DENIED');
}
function workflowCompletion(events:EngagementEvent[]){
  const starts=new Set(events.filter(e=>e.kind==='WORKFLOW'&&e.workflowState==='STARTED'&&e.correlationId).map(e=>e.correlationId!));
  const completed=new Set(events.filter(e=>e.kind==='WORKFLOW'&&e.workflowState==='COMPLETED'&&e.correlationId).map(e=>e.correlationId!));
  const done=Array.from(starts).filter(id=>completed.has(id)).length;
  return {started:starts.size,completed:done,rate:pct(done,starts.size)};
}
function activeDays(events:EngagementEvent[]){
  return new Set(events.filter(e=>e.kind==='VALUE').map(e=>e.occurredAt.slice(0,10))).size;
}
function uniqueAreas(events:EngagementEvent[]){
  return new Set(events.filter(e=>e.kind==='VALUE').map(e=>e.area)).size;
}
function metric(metricId:string,label:string,value:number,unit:EngagementMetric['unit'],definition:string,source:string):EngagementMetric{
  return {metricId,label,value,unit,definition,source};
}

export class EngagementService{
  static setTelemetryPreference(actorUserId:UserId,enabled:boolean){
    const store=EngagementStore.getInstance();
    store.savePreference({userId:actorUserId,productAnalyticsEnabled:enabled,updatedAt:new Date().toISOString(),updatedBy:actorUserId});
    return store.getPreference(actorUserId)!;
  }

  static recordEvent(input:RecordEngagementEventInput):EngagementEvent{
    const store=EngagementStore.getInstance();
    const pref=store.getPreference(input.actorUserId);
    if(!pref?.productAnalyticsEnabled)throw new Error('ENGAGEMENT_TELEMETRY_DISABLED');
    if(input.kind==='WORKFLOW'&&!input.workflowState)throw new Error('ENGAGEMENT_WORKFLOW_STATE_REQUIRED');
    if(input.kind!=='WORKFLOW'&&input.workflowState)throw new Error('ENGAGEMENT_WORKFLOW_STATE_NOT_ALLOWED');
    if(input.eventName.length>80||input.surface.length>80)throw new Error('ENGAGEMENT_EVENT_METADATA_TOO_LONG');
    const event:EngagementEvent={
      eventId:'eng-'+generateUUIDv7(),
      actorUserId:input.actorUserId,
      householdId:input.householdId,
      providerId:input.providerId,
      kind:input.kind,
      area:input.area,
      eventName:input.eventName,
      occurredAt:input.occurredAt||new Date().toISOString(),
      correlationId:input.correlationId,
      workflowState:input.workflowState,
      surface:input.surface,
      idempotencyKey:input.idempotencyKey,
    };
    return store.saveEvent(event);
  }

  static getSnapshot(ctx:EngagementContext):EngagementSnapshot{
    const w=windowFor(ctx);
    if(ctx.audience==='HOUSEHOLD'){
      if(!ctx.householdId)throw new Error('ENGAGEMENT_HOUSEHOLD_REQUIRED');
      requireHousehold(ctx.actorUserId,ctx.householdId);
      return this.household(ctx,w);
    }
    if(ctx.audience==='PROVIDER'){
      if(!ctx.providerId)throw new Error('ENGAGEMENT_PROVIDER_REQUIRED');
      requireProvider(ctx.actorUserId,ctx.providerId);
      return this.provider(ctx,w);
    }
    requirePlatform(ctx.actorUserId);
    return this.platform(ctx,w);
  }

  private static household(ctx:EngagementContext,w:ReturnType<typeof windowFor>):EngagementSnapshot{
    const hh=ctx.householdId!;
    const store=EngagementStore.getInstance();
    const events=store.listEvents().filter(e=>e.householdId===hh&&inWindow(e.occurredAt,w.startMs,w.endMs));
    const workflow=workflowCompletion(events);
    const pets=PetStore.listPetsByHousehold(hh).filter(p=>p.status!=='ARCHIVED');
    const petIds=new Set(pets.map(p=>String(p.petId)));
    const care=CareStore.getObligationsForHousehold(hh);
    const activity=ActivityStore.getRecordsForHousehold(hh);
    const training=pets.flatMap(p=>TrainingStore.listSessionsForPet(p.petId));
    const bookings=BookingStore.getInstance().listBookingsByHousehold(hh);
    const trackers=TrackingStore.getInstance().listDevicesForHousehold(hh);
    const automations=OrchestrationStore.getInstance().listRules().filter(r=>r.householdId===hh);
    const installs=IntegrationStore.getInstance().listInstallationsForHousehold(String(hh));
    const orders=CommerceStore.getInstance().listOrdersForBuyer(ctx.actorUserId).filter(o=>!o.householdId||o.householdId===hh);
    const milestones:AdoptionMilestone[]=[
      {milestoneId:'pet-profile',label:'Pet profile established',achieved:pets.length>0,sourceDomain:'PET_CORE',definition:'At least one active Pet exists in the household.'},
      {milestoneId:'care-configured',label:'Care configured',achieved:care.length>0,sourceDomain:'CARE',definition:'At least one preventive-care obligation exists.'},
      {milestoneId:'activity-recorded',label:'Activity recorded',achieved:activity.length>0,sourceDomain:'ACTIVITY',definition:'At least one canonical ActivityRecord exists.'},
      {milestoneId:'training-used',label:'Training used',achieved:training.length>0,sourceDomain:'TRAINING',definition:'At least one training session exists for an active household Pet.'},
      {milestoneId:'service-booked',label:'Service booked',achieved:bookings.length>0,sourceDomain:'BOOKING',definition:'At least one Booking exists for the household.'},
      {milestoneId:'tracker-connected',label:'Tracker connected',achieved:trackers.length>0,sourceDomain:'TRACKING',definition:'At least one tracking device is claimed by the household.'},
      {milestoneId:'automation-configured',label:'Automation configured',achieved:automations.length>0,sourceDomain:'ORCHESTRATION',definition:'At least one Sprint 29 automation rule exists.'},
      {milestoneId:'integration-connected',label:'Integration connected',achieved:installs.some(i=>i.status==='ACTIVE'),sourceDomain:'INTEGRATIONS',definition:'At least one Sprint 31 app installation is active.'},
      {milestoneId:'commerce-used',label:'Commerce used',achieved:orders.length>0,sourceDomain:'COMMERCE',definition:'At least one buyer order exists for the actor/household.'},
    ];
    const achieved=milestones.filter(m=>m.achieved).length;
    const metrics:EngagementMetric[]=[
      metric('household.adoption_breadth','Capability adoption breadth',pct(achieved,milestones.length),'PERCENT','Achieved canonical capability milestones divided by defined household milestones. This is not a user score.','Canonical domain stores'),
      metric('household.meaningful_events','Meaningful value events',events.filter(e=>e.kind==='VALUE').length,'COUNT','Opted-in VALUE events only; navigation and time spent are excluded.','EngagementStore'),
      metric('household.value_active_days','Value-active days',activeDays(events),'DAYS','Distinct days with at least one opted-in VALUE event. No streaks or daily pressure are used.','EngagementStore'),
      metric('household.value_areas','Meaningful areas used',uniqueAreas(events),'COUNT','Distinct VALUE areas observed in opted-in telemetry.','EngagementStore'),
      metric('household.workflow_completion','Workflow completion',workflow.rate,'PERCENT','Completed workflow correlations divided by started workflow correlations in opted-in telemetry.','EngagementStore'),
    ];
    const funnel:ActivationFunnelStep[]=[
      {stepId:'profile',label:'Pet profile',count:milestones[0].achieved?1:0,percentOfBase:milestones[0].achieved?100:0,definition:milestones[0].definition},
      {stepId:'care',label:'Care setup',count:milestones[1].achieved?1:0,percentOfBase:milestones[1].achieved?100:0,definition:milestones[1].definition},
      {stepId:'meaningful-use',label:'Meaningful care/activity/service use',count:(milestones[2].achieved||milestones[3].achieved||milestones[4].achieved)?1:0,percentOfBase:(milestones[2].achieved||milestones[3].achieved||milestones[4].achieved)?100:0,definition:'Activity, training or service-booking evidence exists.'},
      {stepId:'connected',label:'Connected capability',count:(milestones[5].achieved||milestones[6].achieved||milestones[7].achieved)?1:0,percentOfBase:(milestones[5].achieved||milestones[6].achieved||milestones[7].achieved)?100:0,definition:'Tracking, automation or an external integration is configured.'},
    ];
    const pref=store.getPreference(ctx.actorUserId);
    const signals:PlatformHealthSignal[]=[
      {signalId:'telemetry-choice',label:'Product analytics preference',value:pref?.productAnalyticsEnabled?1:0,unit:'COUNT',status:pref?.productAnalyticsEnabled?'HEALTHY':'INFORMATIONAL',explanation:'Optional product telemetry may be disabled without blocking Pet OS core functionality.'},
      {signalId:'unfinished-workflows',label:'Unfinished observed workflows',value:Math.max(0,workflow.started-workflow.completed),unit:'COUNT',status:workflow.started===0?'INFORMATIONAL':workflow.rate>=80?'HEALTHY':'WATCH',explanation:'Opted-in workflows started without an observed completion in the selected window.'},
    ];
    return this.finish(ctx,String(hh),w,metrics,milestones,funnel,signals,['PetStore','CareStore','ActivityStore','TrainingStore','BookingStore','TrackingStore','OrchestrationStore','IntegrationStore','CommerceStore','EngagementStore']);
  }

  private static provider(ctx:EngagementContext,w:ReturnType<typeof windowFor>):EngagementSnapshot{
    const providerId=ctx.providerId!;
    requireProvider(ctx.actorUserId,providerId);
    const store=EngagementStore.getInstance();
    const events=store.listEvents().filter(e=>e.providerId===providerId&&e.actorUserId===ctx.actorUserId&&inWindow(e.occurredAt,w.startMs,w.endMs));
    const workflow=workflowCompletion(events);
    const provider=ProviderStore.getInstance().getProvider(providerId)!;
    const offerings=ProviderStore.getInstance().getServiceOfferingsForProvider(providerId);
    const bookings=BookingStore.getInstance().listBookingsByProvider(providerId);
    const completed=bookings.filter(b=>b.status==='COMPLETED');
    const reviews=ReviewStore.getInstance().listReviewsForProvider(providerId).filter(r=>r.status==='PUBLISHED');
    const money=FinanceStore.getInstance().getProviderFinancialSummary(providerId,'KES');
    const milestones:AdoptionMilestone[]=[
      {milestoneId:'verified-profile',label:'Verified professional profile',achieved:provider.verificationStatus==='VERIFIED',sourceDomain:'PROVIDER',definition:'Sprint 10 verification is VERIFIED.'},
      {milestoneId:'active-offering',label:'Active service offering',achieved:offerings.some(o=>o.status==='ACTIVE'),sourceDomain:'PROVIDER',definition:'At least one service offering is ACTIVE.'},
      {milestoneId:'first-booking',label:'First booking received',achieved:bookings.length>0,sourceDomain:'BOOKING',definition:'At least one provider Booking exists.'},
      {milestoneId:'completed-service',label:'Service completed',achieved:completed.length>0,sourceDomain:'BOOKING',definition:'At least one provider Booking is COMPLETED.'},
      {milestoneId:'customer-feedback',label:'Verified customer feedback',achieved:reviews.length>0,sourceDomain:'REVIEWS',definition:'At least one published service-linked review exists.'},
      {milestoneId:'earnings-established',label:'Earnings established',achieved:money.earningsCount>0,sourceDomain:'FINANCE',definition:'FinanceStore has at least one provider earning record.'},
    ];
    const achieved=milestones.filter(m=>m.achieved).length;
    const metrics=[
      metric('provider.adoption_breadth','Business capability adoption',pct(achieved,milestones.length),'PERCENT','Achieved provider milestones divided by defined provider milestones; not a quality score.','Canonical domain stores'),
      metric('provider.meaningful_events','Meaningful provider events',events.filter(e=>e.kind==='VALUE').length,'COUNT','Opted-in VALUE events only; time spent is excluded.','EngagementStore'),
      metric('provider.value_active_days','Value-active days',activeDays(events),'DAYS','Distinct days with provider VALUE events; no streak mechanics.','EngagementStore'),
      metric('provider.workflow_completion','Workflow completion',workflow.rate,'PERCENT','Completed observed workflows divided by started observed workflows.','EngagementStore'),
    ];
    const funnel:ActivationFunnelStep[]=[
      {stepId:'profile',label:'Verified profile',count:milestones[0].achieved?1:0,percentOfBase:milestones[0].achieved?100:0,definition:milestones[0].definition},
      {stepId:'offering',label:'Service available',count:milestones[1].achieved?1:0,percentOfBase:milestones[1].achieved?100:0,definition:milestones[1].definition},
      {stepId:'booking',label:'Booking received',count:milestones[2].achieved?1:0,percentOfBase:milestones[2].achieved?100:0,definition:milestones[2].definition},
      {stepId:'completion',label:'Service completed',count:milestones[3].achieved?1:0,percentOfBase:milestones[3].achieved?100:0,definition:milestones[3].definition},
    ];
    const signals:PlatformHealthSignal[]=[
      {signalId:'provider-workflow',label:'Provider workflow completion',value:workflow.rate,unit:'PERCENT',status:workflow.started===0?'INFORMATIONAL':workflow.rate>=85?'HEALTHY':'WATCH',explanation:'Observed opted-in provider workflows completed after start.'},
    ];
    return this.finish(ctx,String(providerId),w,metrics,milestones,funnel,signals,['ProviderStore','BookingStore','ReviewStore','FinanceStore','EngagementStore']);
  }

  private static platform(ctx:EngagementContext,w:ReturnType<typeof windowFor>):EngagementSnapshot{
    const store=EngagementStore.getInstance();
    const events=store.listEvents().filter(e=>inWindow(e.occurredAt,w.startMs,w.endMs));
    const preferences=store.listPreferences();
    const users=IdentityStore.listAllUsers().filter(u=>u.accountStatus==='ACTIVE');
    const households=IdentityStore.listAllHouseholds().filter(h=>h.status==='ACTIVE');
    const eligibleHouseholds=households.filter(h=>PetStore.listPetsByHousehold(h.householdId).some(p=>p.status!=='ARCHIVED'));
    const careHouseholds=eligibleHouseholds.filter(h=>CareStore.getObligationsForHousehold(h.householdId).length>0);
    const meaningfulHouseholds=eligibleHouseholds.filter(h=>{
      const pets=PetStore.listPetsByHousehold(h.householdId);
      return ActivityStore.getRecordsForHousehold(h.householdId).length>0||
        pets.some(p=>TrainingStore.listSessionsForPet(p.petId).length>0)||
        BookingStore.getInstance().listBookingsByHousehold(h.householdId).length>0;
    });
    const connectedHouseholds=eligibleHouseholds.filter(h=>
      TrackingStore.getInstance().listDevicesForHousehold(h.householdId).length>0||
      OrchestrationStore.getInstance().listRules().some(r=>r.householdId===h.householdId)||
      IntegrationStore.getInstance().listInstallationsForHousehold(String(h.householdId)).some(i=>i.status==='ACTIVE')
    );
    const workflow=workflowCompletion(events);
    const optedIn=preferences.filter(p=>p.productAnalyticsEnabled).length;
    const valueEvents=events.filter(e=>e.kind==='VALUE');
    const activeOptedHouseholds=new Set(valueEvents.filter(e=>e.householdId).map(e=>String(e.householdId))).size;
    const platformBase=Math.max(eligibleHouseholds.length,1);
    const funnel:ActivationFunnelStep[]=[
      {stepId:'pet-profile',label:'Households with an active Pet',count:eligibleHouseholds.length,percentOfBase:pct(eligibleHouseholds.length,eligibleHouseholds.length),definition:'Active households with at least one active Pet.'},
      {stepId:'care-setup',label:'Care configured',count:careHouseholds.length,percentOfBase:pct(careHouseholds.length,platformBase),definition:'Pet households with at least one Care obligation.'},
      {stepId:'meaningful-use',label:'Meaningful workflow evidence',count:meaningfulHouseholds.length,percentOfBase:pct(meaningfulHouseholds.length,platformBase),definition:'Pet households with Activity, Training or Booking evidence.'},
      {stepId:'connected',label:'Connected capability',count:connectedHouseholds.length,percentOfBase:pct(connectedHouseholds.length,platformBase),definition:'Pet households using Tracking, Automation or Integrations.'},
    ];
    const metrics:EngagementMetric[]=[
      metric('platform.activated_households','Activated Pet households',meaningfulHouseholds.length,'COUNT','Households with canonical Activity, Training or Booking evidence.','Canonical domain stores'),
      metric('platform.activation_rate','Activation rate',pct(meaningfulHouseholds.length,platformBase),'PERCENT','Activated Pet households divided by households with an active Pet.','Canonical domain stores'),
      metric('platform.connected_rate','Connected-capability adoption',pct(connectedHouseholds.length,platformBase),'PERCENT','Pet households with Tracking, Automation or Integrations divided by Pet households.','Canonical domain stores'),
      metric('platform.telemetry_opt_in','Optional telemetry opt-in',pct(optedIn,users.length),'PERCENT','Active users with productAnalyticsEnabled divided by active users.','EngagementStore + IdentityStore'),
      metric('platform.meaningful_active_households','Opted-in value-active households',activeOptedHouseholds,'COUNT','Distinct opted-in households with VALUE events in the selected window. This is sample-dependent.','EngagementStore'),
      metric('platform.workflow_completion','Observed workflow completion',workflow.rate,'PERCENT','Completed opted-in workflow correlations divided by started workflow correlations.','EngagementStore'),
    ];
    const milestones:AdoptionMilestone[]=[];
    const orphaned=Math.max(0,workflow.started-workflow.completed);
    const signals:PlatformHealthSignal[]=[
      {signalId:'telemetry-coverage',label:'Telemetry sample coverage',value:pct(optedIn,users.length),unit:'PERCENT',status:users.length===0?'INFORMATIONAL':pct(optedIn,users.length)>=50?'HEALTHY':'WATCH',explanation:'Optional telemetry coverage; canonical adoption metrics remain available when users opt out.'},
      {signalId:'workflow-dropoff',label:'Observed unfinished workflows',value:orphaned,unit:'COUNT',status:workflow.started===0?'INFORMATIONAL':workflow.rate>=90?'HEALTHY':workflow.rate>=75?'WATCH':'ACTION_NEEDED',explanation:'Started opted-in workflows without observed completion in the selected window.'},
      {signalId:'navigation-pressure',label:'Navigation events excluded from success',value:events.filter(e=>e.kind==='NAVIGATION').length,unit:'COUNT',status:'INFORMATIONAL',explanation:'Navigation may diagnose discoverability, but is explicitly excluded from meaningful-engagement and activation calculations.'},
    ];
    return this.finish(ctx,'PET_OS_PLATFORM',w,metrics,milestones,funnel,signals,['IdentityStore','PetStore','CareStore','ActivityStore','TrainingStore','BookingStore','TrackingStore','OrchestrationStore','IntegrationStore','EngagementStore']);
  }

  private static finish(ctx:EngagementContext,scopeId:string,w:ReturnType<typeof windowFor>,metrics:EngagementMetric[],milestones:AdoptionMilestone[],funnel:ActivationFunnelStep[],signals:PlatformHealthSignal[],provenance:string[]):EngagementSnapshot{
    return {
      audience:ctx.audience,actorUserId:ctx.actorUserId,scopeId,
      windowStart:w.start.toISOString(),windowEnd:w.end.toISOString(),generatedAt:new Date().toISOString(),
      metrics,milestones,funnel,signals,provenance,
      guardrails:[
        'No time-spent, session-length, click-volume, streak, compulsion or addiction proxy is treated as success.',
        'Navigation events never count as meaningful engagement or activation.',
        'Optional product telemetry can be disabled without disabling core Pet OS functionality.',
        'Platform views are aggregate-only and do not expose per-user engagement rankings.',
        'Sensitive health content, exact location, private messages, search text, payment instruments and user-generated text are not captured by EngagementStore.',
        'Engagement signals do not authorize notifications, purchases, recommendations, ranking changes or automated actions.',
        'Canonical Pet OS domains remain authoritative for product and operational truth.',
      ],
    };
  }
}
