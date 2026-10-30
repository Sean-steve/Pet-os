import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { EngagementService } from './service';
import { EngagementStore } from './store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { ActivityStore } from '../activity/store';
import { BookingStore } from '../booking/store';

interface TestResult{ id:string;name:string;passed:boolean;message:string;durationMs:number; }
const DAY=24*60*60*1000;
async function setup(){await seedUnifiedPetOS({forceReset:true});}
function hhCtx(){return {actorUserId:CANONICAL_IDS.OWNER_ELENA,audience:'HOUSEHOLD' as const,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,windowStart:new Date(Date.now()-30*DAY).toISOString(),windowEnd:new Date(Date.now()+DAY).toISOString()};}

export class EngagementTestSuite{
  static async runAllTests():Promise<{passed:number;failed:number;total:number;results:TestResult[]}>{
    const tests:Array<{id:string;name:string;fn:()=>Promise<void>|void}>=[
      {id:'EN-01',name:'Optional telemetry can be disabled without blocking canonical snapshot',fn:async()=>{
        await setup();EngagementService.setTelemetryPreference(CANONICAL_IDS.OWNER_ELENA,false);
        let blocked=false;try{EngagementService.recordEvent({actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,kind:'VALUE',area:'CARE',eventName:'care_task_completed',surface:'Care',idempotencyKey:'optout-test'});}catch(e:any){blocked=String(e.message).includes('TELEMETRY_DISABLED');}
        if(!blocked)throw new Error('opt-out event was stored');
        const snap=EngagementService.getSnapshot(hhCtx());if(!snap.metrics.some(m=>m.metricId==='household.adoption_breadth'))throw new Error('canonical engagement snapshot disappeared after opt-out');
      }},
      {id:'EN-02',name:'Navigation events never count as meaningful engagement',fn:async()=>{
        await setup();const before=EngagementService.getSnapshot(hhCtx()).metrics.find(m=>m.metricId==='household.meaningful_events')!.value;
        EngagementService.recordEvent({actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,kind:'NAVIGATION',area:'PET_PROFILE',eventName:'profile_opened',surface:'Pet profile',idempotencyKey:'nav-only-test'});
        const after=EngagementService.getSnapshot(hhCtx()).metrics.find(m=>m.metricId==='household.meaningful_events')!.value;
        if(before!==after)throw new Error('navigation inflated meaningful engagement');
      }},
      {id:'EN-03',name:'Household engagement requires active membership',fn:async()=>{
        await setup();let denied=false;try{EngagementService.getSnapshot({...hhCtx(),actorUserId:CANONICAL_IDS.OUTSIDER_BRIAN});}catch(e:any){denied=String(e.message).includes('HOUSEHOLD_ACCESS_DENIED');}
        if(!denied)throw new Error('outsider received household engagement');
      }},
      {id:'EN-04',name:'Provider engagement is provider-self scoped',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH});
        if(snap.scopeId!==String(CANONICAL_IDS.WALKER_SARAH))throw new Error('provider scope mismatch');
        let denied=false;try{EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.OWNER_ELENA,audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH});}catch(e:any){denied=String(e.message).includes('PROVIDER_ACCESS_DENIED');}
        if(!denied)throw new Error('unrelated actor received provider engagement');
      }},
      {id:'EN-05',name:'Platform intelligence requires Sprint 31 platform authority',fn:async()=>{
        await setup();let denied=false;try{EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.OWNER_ELENA,audience:'PLATFORM_OPS'});}catch(e:any){denied=String(e.message).includes('PLATFORM_ACCESS_DENIED');}
        if(!denied)throw new Error('ordinary user received platform intelligence');
        const snap=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});if(snap.scopeId!=='PET_OS_PLATFORM')throw new Error('authorized platform snapshot missing');
      }},
      {id:'EN-06',name:'Household activation breadth reconciles with canonical milestones',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot(hhCtx());
        const achieved=snap.milestones.filter(m=>m.achieved).length;
        const expected=snap.milestones.length?Math.round((achieved/snap.milestones.length)*1000)/10:0;
        if(snap.metrics.find(m=>m.metricId==='household.adoption_breadth')?.value!==expected)throw new Error('adoption breadth mismatch');
      }},
      {id:'EN-07',name:'Canonical household milestones remain available with no telemetry events',fn:async()=>{
        await setup();EngagementStore.getInstance().reset();
        const snap=EngagementService.getSnapshot(hhCtx());
        if(snap.milestones.length<5||!snap.milestones.some(m=>m.sourceDomain==='PET_CORE'&&m.achieved))throw new Error('canonical milestones depend on telemetry');
      }},
      {id:'EN-08',name:'No time-spent, streak, click-volume or session-length metric exists',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const text=JSON.stringify(snap.metrics).toLowerCase();
        if(/time.spent|session.length|click.volume|streak/.test(text))throw new Error('manipulative engagement metric exposed');
        if(!snap.guardrails.some(g=>/No time-spent/i.test(g)))throw new Error('anti-manipulation guardrail missing');
      }},
      {id:'EN-09',name:'Workflow completion requires correlated STARTED and COMPLETED events',fn:async()=>{
        await setup();const base=EngagementService.getSnapshot(hhCtx()).metrics.find(m=>m.metricId==='household.workflow_completion')!.value;
        EngagementService.recordEvent({actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,kind:'WORKFLOW',area:'CARE',eventName:'care_flow',workflowState:'STARTED',correlationId:'wf-unfinished',surface:'Care',idempotencyKey:'wf-unfinished-start'});
        const next=EngagementService.getSnapshot(hhCtx()).metrics.find(m=>m.metricId==='household.workflow_completion')!.value;
        if(!(next<base||base===0))throw new Error('unfinished workflow did not affect completion denominator');
      }},
      {id:'EN-10',name:'Workflow events require workflow state',fn:async()=>{
        await setup();let blocked=false;try{EngagementService.recordEvent({actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,kind:'WORKFLOW',area:'CARE',eventName:'bad_workflow',surface:'Care',idempotencyKey:'bad-wf'} as any);}catch(e:any){blocked=String(e.message).includes('WORKFLOW_STATE_REQUIRED');}
        if(!blocked)throw new Error('workflow without state accepted');
      }},
      {id:'EN-11',name:'Event idempotency prevents duplicate telemetry inflation',fn:async()=>{
        await setup();const input={actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,kind:'VALUE' as const,area:'CARE' as const,eventName:'idempotent_value',surface:'Care',idempotencyKey:'idem-event-1'};
        EngagementService.recordEvent(input);const before=EngagementStore.getInstance().listEvents().length;EngagementService.recordEvent(input);const after=EngagementStore.getInstance().listEvents().length;
        if(before!==after)throw new Error('duplicate event inflated telemetry');
      }},
      {id:'EN-12',name:'Platform activation funnel contains aggregate counts only',fn:async()=>{
        await setup();const snap:any=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const raw=JSON.stringify(snap.funnel);
        if(/userId|householdId|email|displayName|petId/.test(raw))throw new Error('individual identifiers leaked into platform funnel');
      }},
      {id:'EN-13',name:'Platform telemetry opt-in metric reconciles to stored preferences and active users',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const metric=snap.metrics.find(m=>m.metricId==='platform.telemetry_opt_in')!;
        const activeUsers=(await import('../identity/store')).IdentityStore.listAllUsers().filter(u=>u.accountStatus==='ACTIVE').length;
        const opted=EngagementStore.getInstance().listPreferences().filter(p=>p.productAnalyticsEnabled).length;
        const expected=activeUsers?Math.round((opted/activeUsers)*1000)/10:0;
        if(metric.value!==expected)throw new Error('opt-in rate mismatch');
      }},
      {id:'EN-14',name:'Engagement events contain no arbitrary payload field',fn:async()=>{
        await setup();const event:any=EngagementStore.getInstance().listEvents()[0];if(!event)throw new Error('seed engagement event missing');
        for(const key of ['payload','body','query','latitude','longitude','healthData','paymentData'])if(key in event)throw new Error('sensitive/arbitrary payload field present: '+key);
      }},
      {id:'EN-15',name:'Engagement snapshots do not expose private health/location/payment content',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const exposed=JSON.stringify({metrics:snap.metrics,funnel:snap.funnel,signals:snap.signals});
        if(/latitude|longitude|prescription|clinical note|card number|payment instrument|microchip/i.test(exposed))throw new Error('restricted content leaked');
      }},
      {id:'EN-16',name:'Engagement reads do not mutate canonical domain state',fn:async()=>{
        await setup();const before={pets:PetStore.listPetsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,care:CareStore.getAllOccurrences().length,activity:ActivityStore.getRecordsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,bookings:BookingStore.getInstance().listAllBookings().length};
        EngagementService.getSnapshot(hhCtx());EngagementService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const after={pets:PetStore.listPetsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,care:CareStore.getAllOccurrences().length,activity:ActivityStore.getRecordsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,bookings:BookingStore.getInstance().listAllBookings().length};
        if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('engagement intelligence mutated canonical state');
      }},
      {id:'EN-17',name:'Engagement windows are bounded to 180 days',fn:async()=>{
        await setup();let invalid=false,tooLarge=false;
        try{EngagementService.getSnapshot({...hhCtx(),windowStart:new Date().toISOString(),windowEnd:new Date(Date.now()-DAY).toISOString()});}catch(e:any){invalid=String(e.message).includes('WINDOW_INVALID');}
        try{EngagementService.getSnapshot({...hhCtx(),windowStart:new Date(Date.now()-181*DAY).toISOString(),windowEnd:new Date().toISOString()});}catch(e:any){tooLarge=String(e.message).includes('WINDOW_TOO_LARGE');}
        if(!invalid||!tooLarge)throw new Error('window bounds not enforced');
      }},
      {id:'EN-18',name:'Engagement signals cannot authorize or execute actions',fn:async()=>{
        await setup();const snap=EngagementService.getSnapshot(hhCtx());
        if(!snap.guardrails.some(g=>/do not authorize notifications, purchases, recommendations, ranking changes or automated actions/i.test(g)))throw new Error('action boundary missing');
        const raw=JSON.stringify(snap);if(/confirmationToken|executeAction|paymentIntent/.test(raw))throw new Error('action-execution material leaked into engagement snapshot');
      }},
    ];
    const results:TestResult[]=[];
    for(const t of tests){const start=Date.now();try{await t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-start});}catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-start});}}
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
