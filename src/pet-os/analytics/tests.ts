import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { AnalyticsService } from './service';
import { CareStore } from '../care/store';
import { ActivityStore } from '../activity/store';
import { BookingStore } from '../booking/store';
import { TrackingStore } from '../tracking/store';
import { IntegrationStore } from '../integrations/store';
import { ProviderStore } from '../provider/store';

interface TestResult{ id:string; name:string; passed:boolean; message:string; durationMs:number; }

async function setup(){ await seedUnifiedPetOS({forceReset:true}); }
function householdCtx(){
  return {
    actorUserId:CANONICAL_IDS.OWNER_ELENA,
    audience:'HOUSEHOLD' as const,
    householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,
    timezone:'Africa/Nairobi',
    windowStart:new Date(Date.now()-365*24*60*60*1000).toISOString(),
    windowEnd:new Date().toISOString(),
  };
}

export class AnalyticsTestSuite{
  static async runAllTests():Promise<{passed:number;failed:number;total:number;results:TestResult[]}>{
    const tests:Array<{id:string;name:string;fn:()=>Promise<void>|void}>=[
      {id:'AN-01',name:'Household analytics require active membership',fn:async()=>{
        await setup();let denied=false;
        try{AnalyticsService.getSnapshot({...householdCtx(),actorUserId:CANONICAL_IDS.OUTSIDER_BRIAN});}
        catch(e:any){denied=String(e.message).includes('ANALYTICS_HOUSEHOLD_ACCESS_DENIED');}
        if(!denied)throw new Error('outsider received household analytics');
      }},
      {id:'AN-02',name:'Household metrics reconcile to canonical Care and Activity stores',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot(householdCtx());
        const care=snap.metrics.find(m=>m.metricId==='household.care_adherence');
        const activity=snap.metrics.find(m=>m.metricId==='household.activity_minutes');
        if(!care||!activity)throw new Error('required household metrics missing');
        const start=new Date(householdCtx().windowStart).getTime(),end=new Date(householdCtx().windowEnd).getTime();
        const rows=CareStore.getAllOccurrences().filter(o=>o.householdId===CANONICAL_IDS.MAIN_HOUSEHOLD&&new Date(o.scheduledFor).getTime()>=start&&new Date(o.scheduledFor).getTime()<=end);
        const eligible=rows.filter(o=>['COMPLETED','SKIPPED','OVERDUE'].includes(o.status));
        const expectedCare=eligible.length?Math.round((eligible.filter(o=>o.status==='COMPLETED').length/eligible.length)*1000)/10:0;
        const expectedActivity=Math.round(ActivityStore.getRecordsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).filter(r=>new Date(r.startedAt).getTime()>=start&&new Date(r.startedAt).getTime()<=end).reduce((a,r)=>a+r.durationSeconds,0)/60);
        if(care.value!==expectedCare||activity.value!==expectedActivity)throw new Error('derived values diverged from canonical stores');
      }},
      {id:'AN-03',name:'Outcome indicators explicitly remain non-clinical descriptive signals',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot(householdCtx());
        if(!snap.disclaimers.some(d=>/not.*medical|medical diagnosis/i.test(d)))throw new Error('medical non-causality disclaimer missing');
        if(snap.outcomes.some(o=>!/not|does not|never|operational|descriptive/i.test(o.caveat)))throw new Error('outcome caveat missing');
      }},
      {id:'AN-04',name:'Tracker analytics expose health summary but not coordinates',fn:async()=>{
        await setup();const snap:any=AnalyticsService.getSnapshot(householdCtx());
        const raw=JSON.stringify(snap);
        if(/latitude|longitude|routeReference|externalDeviceReference/.test(raw))throw new Error('restricted tracker detail leaked');
      }},
      {id:'AN-05',name:'Provider analytics are provider-self scoped',fn:async()=>{
        await setup();
        const snap=AnalyticsService.getSnapshot({
          actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH,
          windowStart:new Date(Date.now()-365*24*60*60*1000).toISOString(),windowEnd:new Date().toISOString()
        });
        if(snap.scopeId!==String(CANONICAL_IDS.WALKER_SARAH))throw new Error('provider scope mismatch');
        let denied=false;try{AnalyticsService.getSnapshot({...householdCtx(),audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH} as any);}catch(e:any){denied=String(e.message).includes('ANALYTICS_PROVIDER_ACCESS_DENIED');}
        if(!denied)throw new Error('unrelated user received provider analytics');
      }},
      {id:'AN-06',name:'Provider finance metric comes from Finance read model, not reconstructed booking value',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot({
          actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH,
          windowStart:new Date(Date.now()-365*24*60*60*1000).toISOString(),windowEnd:new Date().toISOString()
        });
        const m=snap.metrics.find(x=>x.metricId==='provider.available_earnings');
        if(!m||m.source!=='FinanceStore'||!/Authoritative Finance/.test(m.definition))throw new Error('finance provenance not authoritative');
      }},
      {id:'AN-07',name:'Platform operations analytics require explicit platform review authority',fn:async()=>{
        await setup();let denied=false;
        try{AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.OWNER_ELENA,audience:'PLATFORM_OPS'});}
        catch(e:any){denied=String(e.message).includes('ANALYTICS_PLATFORM_ACCESS_DENIED');}
        if(!denied)throw new Error('ordinary household user received platform analytics');
        const admin=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        if(admin.scopeId!=='PET_OS_PLATFORM')throw new Error('platform scope unavailable');
      }},
      {id:'AN-08',name:'Platform operations surface integration reliability and dead letters',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        if(!snap.metrics.some(m=>m.metricId==='platform.webhook_delivery'))throw new Error('webhook reliability metric missing');
        if(!snap.operations.some(s=>s.signalId==='webhook-dead-letter'))throw new Error('webhook dead-letter signal missing');
      }},
      {id:'AN-09',name:'Metrics preserve formula and source provenance',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot(householdCtx());
        if(snap.metrics.some(m=>!m.definition||!m.source||!m.metricId))throw new Error('metric provenance incomplete');
        if(snap.provenance.length<3)throw new Error('snapshot provenance incomplete');
      }},
      {id:'AN-10',name:'Analytics windows reject invalid and unbounded queries',fn:async()=>{
        await setup();let invalid=false,tooLarge=false;
        try{AnalyticsService.getSnapshot({...householdCtx(),windowStart:new Date().toISOString(),windowEnd:new Date(Date.now()-DAY).toISOString()});}catch(e:any){invalid=String(e.message).includes('WINDOW_INVALID');}
        try{AnalyticsService.getSnapshot({...householdCtx(),windowStart:new Date(Date.now()-500*DAY).toISOString(),windowEnd:new Date().toISOString()});}catch(e:any){tooLarge=String(e.message).includes('WINDOW_TOO_LARGE');}
        if(!invalid||!tooLarge)throw new Error('analytics query bounds not enforced');
      }},
      {id:'AN-11',name:'Metric series uses the same governed metric definitions',fn:async()=>{
        await setup();const series=AnalyticsService.metricSeries(householdCtx(),'household.activity_minutes',4);
        if(series.points.length!==4||series.metricId!=='household.activity_minutes'||series.unit!=='MINUTES')throw new Error('metric series incorrect');
      }},
      {id:'AN-12',name:'Metric series rejects unknown metric IDs',fn:async()=>{
        await setup();let blocked=false;try{AnalyticsService.metricSeries(householdCtx(),'household.fake_metric',4);}catch(e:any){blocked=String(e.message).includes('ANALYTICS_METRIC_NOT_FOUND');}
        if(!blocked)throw new Error('unknown metric accepted');
      }},
      {id:'AN-13',name:'Provider completion rate reconciles with BookingStore',fn:async()=>{
        await setup();const start=new Date(Date.now()-365*DAY).toISOString(),end=new Date(Date.now()+DAY).toISOString();
        const snap=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience:'PROVIDER',providerId:CANONICAL_IDS.WALKER_SARAH,windowStart:start,windowEnd:end});
        const metric=snap.metrics.find(m=>m.metricId==='provider.completion_rate')!;
        const rows=BookingStore.getInstance().listBookingsByProvider(CANONICAL_IDS.WALKER_SARAH).filter(b=>new Date(b.startAt)>=new Date(start)&&new Date(b.startAt)<=new Date(end));
        const terminal=rows.filter(b=>['COMPLETED','NO_SHOW','CANCELLED_BY_OWNER','CANCELLED_BY_PROVIDER','DECLINED','EXPIRED'].includes(b.status));
        const expected=terminal.length?Math.round((terminal.filter(b=>b.status==='COMPLETED').length/terminal.length)*1000)/10:0;
        if(metric.value!==expected)throw new Error('provider booking metric mismatch');
      }},
      {id:'AN-14',name:'Platform snapshots avoid household clinical and financial detail',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const exposed=JSON.stringify({metrics:snap.metrics,outcomes:snap.outcomes,operations:snap.operations});
        if(/clinical note|prescription|medication dose|card number|payment instrument|microchip/i.test(exposed))throw new Error('restricted domain detail leaked');
      }},
      {id:'AN-15',name:'Current tracker readiness is labeled point-in-time, not historical uptime',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot(householdCtx());
        const m=snap.metrics.find(x=>x.metricId==='household.trackers_online');
        if(!m||!/Point-in-time/.test(m.definition))throw new Error('tracker metric overclaims historical uptime');
      }},
      {id:'AN-16',name:'Platform integration metric reconciles with IntegrationStore deliveries',fn:async()=>{
        await setup();const snap=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const m=snap.metrics.find(x=>x.metricId==='platform.webhook_delivery')!;
        const deliveries=IntegrationStore.getInstance().listDeliveries();
        if(m.denominator!==deliveries.length)throw new Error('integration delivery denominator mismatch');
      }},
      {id:'AN-17',name:'Audience scopes do not mutate canonical domain records',fn:async()=>{
        await setup();
        const before={care:CareStore.getAllOccurrences().length,activity:ActivityStore.getRecordsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,booking:BookingStore.getInstance().listAllBookings().length,devices:TrackingStore.getInstance().listDevicesForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length};
        AnalyticsService.getSnapshot(householdCtx());
        AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        const after={care:CareStore.getAllOccurrences().length,activity:ActivityStore.getRecordsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length,booking:BookingStore.getInstance().listAllBookings().length,devices:TrackingStore.getInstance().listDevicesForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).length};
        if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('analytics mutated canonical state');
      }},
      {id:'AN-18',name:'Platform admin authority originates from Sprint 31 reviewer registry',fn:async()=>{
        await setup();const reviewer=IntegrationStore.getInstance().getPlatformReviewer(String(CANONICAL_IDS.ADMIN_CHARLES));
        if(!reviewer||reviewer.status!=='ACTIVE')throw new Error('seeded platform reviewer missing');
        const snap=AnalyticsService.getSnapshot({actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience:'PLATFORM_OPS'});
        if(snap.audience!=='PLATFORM_OPS')throw new Error('platform analytics unavailable to reviewer');
      }},
    ];

    const results:TestResult[]=[];
    for(const t of tests){const start=Date.now();try{await t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-start});}catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-start});}}
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
const DAY=24*60*60*1000;
