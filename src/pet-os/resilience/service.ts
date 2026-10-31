import { generateUUIDv7 } from '../kernel/ids';
import type { UserId } from '../kernel/ids';
import { utcNow } from '../kernel/time';
import { InMemoryAuditStore } from '../kernel/audit';
import { IdentityStore } from '../identity/store';
import { IntegrationStore } from '../integrations/store';
import { ResilienceStore } from './store';
import type { DependencyId, DependencyPolicy, DependencyRuntimeState, GracefulDegradationRule, PerformanceBudget, RecoveryObjective, ResilienceSnapshot, RetryDecision } from './types';

const store=ResilienceStore.getInstance();

const POLICIES:DependencyPolicy[]=[
  {dependencyId:'IDENTITY',label:'Identity & authorization',criticality:'CRITICAL',timeoutMs:1500,maxAttempts:1,circuitFailureThreshold:3,circuitRecoverySeconds:30,degradationMode:'FAIL_CLOSED',degradationMessage:'Authentication and authorization fail closed; no privileged operation proceeds without identity.',idempotencyRequiredForRetry:true},
  {dependencyId:'FINANCE',label:'Finance & ledger',criticality:'CRITICAL',timeoutMs:2500,maxAttempts:2,circuitFailureThreshold:3,circuitRecoverySeconds:60,degradationMode:'READ_ONLY',degradationMessage:'Financial mutation pauses; reconciled balances and prior ledger state may remain readable.',idempotencyRequiredForRetry:true},
  {dependencyId:'HEALTH',label:'Pet health records',criticality:'HIGH',timeoutMs:2500,maxAttempts:2,circuitFailureThreshold:4,circuitRecoverySeconds:45,degradationMode:'READ_ONLY',degradationMessage:'Existing authorized records remain readable; writes requiring durable persistence pause.',idempotencyRequiredForRetry:true},
  {dependencyId:'BOOKING',label:'Bookings & scheduling',criticality:'HIGH',timeoutMs:2500,maxAttempts:2,circuitFailureThreshold:4,circuitRecoverySeconds:45,degradationMode:'STALE_SAFE_READ',degradationMessage:'Confirmed bookings may be shown from safe cached state; new confirmations pause when authority is unavailable.',idempotencyRequiredForRetry:true},
  {dependencyId:'TRACKING',label:'Tracking & recovery',criticality:'HIGH',timeoutMs:1800,maxAttempts:2,circuitFailureThreshold:4,circuitRecoverySeconds:30,degradationMode:'STALE_SAFE_READ',degradationMessage:'Clearly timestamped last-known device health may be shown; stale location must never be presented as live.',idempotencyRequiredForRetry:true},
  {dependencyId:'NOTIFICATIONS',label:'Notifications',criticality:'MEDIUM',timeoutMs:2000,maxAttempts:3,circuitFailureThreshold:5,circuitRecoverySeconds:60,degradationMode:'QUEUE_AND_RETRY',degradationMessage:'Durable notification intents queue for bounded retry; critical care state remains canonical elsewhere.',idempotencyRequiredForRetry:true},
  {dependencyId:'INTEGRATIONS',label:'External integrations',criticality:'MEDIUM',timeoutMs:3000,maxAttempts:3,circuitFailureThreshold:5,circuitRecoverySeconds:90,degradationMode:'QUEUE_AND_RETRY',degradationMessage:'Outbound events use bounded retry/dead-letter handling; core Pet OS workflows continue independently.',idempotencyRequiredForRetry:true},
  {dependencyId:'AI',label:'Pet OS AI',criticality:'OPTIONAL',timeoutMs:5000,maxAttempts:1,circuitFailureThreshold:3,circuitRecoverySeconds:120,degradationMode:'FEATURE_DISABLED',degradationMessage:'AI assistance disables cleanly; canonical workflows remain available without model output.',idempotencyRequiredForRetry:false},
];

const OBJECTIVES:RecoveryObjective[]=[
  {objectiveId:'RTO-IDENTITY',domain:'Identity & authorization',tier:'TIER_0',targetRtoMinutes:30,targetRpoMinutes:5,backupRequired:true,restoreVerificationRequired:true,notes:'Privileged operations remain fail-closed until identity authority is restored.'},
  {objectiveId:'RTO-FINANCE',domain:'Finance ledger',tier:'TIER_0',targetRtoMinutes:60,targetRpoMinutes:0,backupRequired:true,restoreVerificationRequired:true,notes:'Ledger recovery targets no accepted committed-entry loss; production requires transactional durability evidence.'},
  {objectiveId:'RTO-HEALTH',domain:'Pet health records',tier:'TIER_1',targetRtoMinutes:60,targetRpoMinutes:15,backupRequired:true,restoreVerificationRequired:true,notes:'Clinical retention and restore policies must respect professional/legal obligations.'},
  {objectiveId:'RTO-TRACKING',domain:'Tracking & Lost Pet recovery',tier:'TIER_1',targetRtoMinutes:15,targetRpoMinutes:5,backupRequired:true,restoreVerificationRequired:true,notes:'Last-known state must be timestamped and never misrepresented as live during recovery.'},
  {objectiveId:'RTO-BOOKING',domain:'Bookings & service continuity',tier:'TIER_2',targetRtoMinutes:120,targetRpoMinutes:15,backupRequired:true,restoreVerificationRequired:true,notes:'Confirmed commitments must be recoverable before new booking mutation resumes.'},
  {objectiveId:'RTO-AUDIT',domain:'Security/audit evidence',tier:'TIER_1',targetRtoMinutes:240,targetRpoMinutes:0,backupRequired:true,restoreVerificationRequired:true,notes:'Security evidence requires append-only durable storage and independent protected backups in production.'},
];

const BUDGETS:PerformanceBudget[]=[
  {budgetId:'PERF-ENTRY-RAW',metric:'ENTRY_JS_RAW_KB',label:'Initial JavaScript entry',limit:900,unit:'KB',enforcement:'CI',status:'TARGET',notes:'Enforced after production build; route/domain code should be lazy-loaded.'},
  {budgetId:'PERF-ENTRY-GZIP',metric:'ENTRY_JS_GZIP_KB',label:'Initial JavaScript entry gzip',limit:250,unit:'KB',enforcement:'CI',status:'TARGET',notes:'Protects first-load network cost.'},
  {budgetId:'PERF-CHUNK-RAW',metric:'MAX_CHUNK_RAW_KB',label:'Largest JavaScript chunk',limit:1200,unit:'KB',enforcement:'CI',status:'TARGET',notes:'Prevents a new monolithic lazy chunk from replacing the old monolith.'},
  {budgetId:'PERF-TOTAL-GZIP',metric:'TOTAL_JS_GZIP_KB',label:'Total JavaScript gzip',limit:950,unit:'KB',enforcement:'CI',status:'TARGET',notes:'Caps aggregate shipped JavaScript while preserving complete prototype coverage.'},
  {budgetId:'PERF-CSS-GZIP',metric:'CSS_GZIP_KB',label:'Total CSS gzip',limit:40,unit:'KB',enforcement:'CI',status:'TARGET',notes:'Prevents uncontrolled stylesheet growth.'},
  {budgetId:'PERF-LCP',metric:'LCP_P75_MS',label:'Largest Contentful Paint p75',limit:2500,unit:'MS',enforcement:'RUM_TARGET',status:'UNMEASURED',notes:'Production target only; requires real-user monitoring.'},
  {budgetId:'PERF-INP',metric:'INP_P75_MS',label:'Interaction to Next Paint p75',limit:200,unit:'MS',enforcement:'RUM_TARGET',status:'UNMEASURED',notes:'Production target only; requires real-user monitoring.'},
  {budgetId:'PERF-CLS',metric:'CLS_P75',label:'Cumulative Layout Shift p75',limit:0.1,unit:'RATIO',enforcement:'RUM_TARGET',status:'UNMEASURED',notes:'Production target only; requires real-user monitoring.'},
];

const DEGRADATION:GracefulDegradationRule[]=[
  {ruleId:'DEG-IDENTITY',dependencyId:'IDENTITY',userImpact:'Protected operations unavailable',allowedBehavior:['Public/non-sensitive shell content','Explicit service status messaging'],forbiddenBehavior:['Bypass authorization','Reuse stale privileges','Mutate protected data']},
  {ruleId:'DEG-FINANCE',dependencyId:'FINANCE',userImpact:'Payments/refunds/payouts pause',allowedBehavior:['Read previously reconciled ledger state','Queue user intent only when owning domain supports idempotency'],forbiddenBehavior:['Assume payment success','Create synthetic balances','Move funds through fallback code']},
  {ruleId:'DEG-TRACKING',dependencyId:'TRACKING',userImpact:'Live tracking unavailable or delayed',allowedBehavior:['Show timestamped last-known status','Offer manual Lost Pet procedures'],forbiddenBehavior:['Label stale coordinates as live','Silently hide freshness']},
  {ruleId:'DEG-INTEGRATIONS',dependencyId:'INTEGRATIONS',userImpact:'Third-party delivery delayed',allowedBehavior:['Retry with bounded backoff','Dead-letter after exhaustion','Continue canonical core workflows'],forbiddenBehavior:['Infinite retry','Block core care workflows on third-party availability']},
  {ruleId:'DEG-AI',dependencyId:'AI',userImpact:'AI assistance unavailable',allowedBehavior:['Use normal Pet OS workflows','Show deterministic safety guidance already owned by product'],forbiddenBehavior:['Invent model output','Block canonical workflows']},
];

function activeUser(userId:UserId){const u=IdentityStore.findUserById(userId);if(!u||u.accountStatus!=='ACTIVE')throw new Error('RESILIENCE_ACTOR_NOT_ACTIVE');}
function requireIncidentAuthority(userId:UserId){activeUser(userId);const r=IntegrationStore.getInstance().getPlatformReviewer(String(userId));if(!r||r.status!=='ACTIVE'||!r.permissions.includes('INCIDENT_RESPONSE'))throw new Error('RESILIENCE_INCIDENT_AUTHORITY_REQUIRED');}
function policy(id:DependencyId){const p=POLICIES.find(x=>x.dependencyId===id);if(!p)throw new Error('RESILIENCE_DEPENDENCY_UNKNOWN');return p;}
function initial(id:DependencyId):DependencyRuntimeState{return {dependencyId:id,health:'UNKNOWN',circuitState:'CLOSED',consecutiveFailures:0};}

export class ResilienceService{
  static reset(){store.reset();}
  static listPolicies(){return POLICIES.map(p=>({...p}));}
  static getRecoveryObjectives(){return OBJECTIVES.map(o=>({...o}));}
  static getPerformanceBudgets(){return BUDGETS.map(b=>({...b}));}
  static getDegradationRules(){return DEGRADATION.map(r=>({...r,allowedBehavior:[...r.allowedBehavior],forbiddenBehavior:[...r.forbiddenBehavior]}));}

  static evaluateRetry(input:{dependencyId:DependencyId;idempotent:boolean;attemptNumber:number}):RetryDecision{
    const p=policy(input.dependencyId);
    if(input.attemptNumber>=p.maxAttempts)return {allowed:false,maxAttempts:p.maxAttempts,reasonCode:'MAX_ATTEMPTS_REACHED',requiresIdempotency:p.idempotencyRequiredForRetry};
    if(p.idempotencyRequiredForRetry&&!input.idempotent)return {allowed:false,maxAttempts:p.maxAttempts,reasonCode:'IDEMPOTENCY_REQUIRED',requiresIdempotency:true};
    return {allowed:true,maxAttempts:p.maxAttempts,reasonCode:'BOUNDED_RETRY_ALLOWED',requiresIdempotency:p.idempotencyRequiredForRetry};
  }

  static recordDependencyResult(input:{dependencyId:DependencyId;success:boolean;error?:string;now?:string}){
    const p=policy(input.dependencyId),now=input.now||utcNow(),current=store.getDependency(input.dependencyId)||initial(input.dependencyId);
    if(input.success){
      const next:DependencyRuntimeState={...current,health:'HEALTHY',circuitState:'CLOSED',consecutiveFailures:0,lastCheckedAt:now,lastSuccessAt:now,lastError:undefined,circuitOpenedAt:undefined};
      return store.saveDependency(next);
    }
    const failures=current.consecutiveFailures+1;
    const opened=failures>=p.circuitFailureThreshold;
    return store.saveDependency({...current,health:opened?'UNAVAILABLE':'DEGRADED',circuitState:opened?'OPEN':current.circuitState,consecutiveFailures:failures,lastCheckedAt:now,lastFailureAt:now,lastError:input.error||'DEPENDENCY_FAILURE',circuitOpenedAt:opened?(current.circuitOpenedAt||now):current.circuitOpenedAt});
  }

  static canAttempt(dependencyId:DependencyId,nowIso=utcNow()){
    const p=policy(dependencyId),current=store.getDependency(dependencyId)||initial(dependencyId);
    if(current.circuitState!=='OPEN')return {allowed:true,state:current.circuitState,reasonCode:'CIRCUIT_ACCEPTING'};
    const openedAt=current.circuitOpenedAt?new Date(current.circuitOpenedAt).getTime():0,now=new Date(nowIso).getTime();
    if(openedAt&&now-openedAt>=p.circuitRecoverySeconds*1000){
      const next=store.saveDependency({...current,circuitState:'HALF_OPEN',health:'DEGRADED',lastCheckedAt:nowIso});
      return {allowed:true,state:next.circuitState,reasonCode:'HALF_OPEN_PROBE'};
    }
    return {allowed:false,state:'OPEN' as const,reasonCode:'CIRCUIT_OPEN'};
  }

  static startRecoveryDrill(actorUserId:UserId,input:{objectiveId:string;scenario:string}){
    requireIncidentAuthority(actorUserId);
    const objective=OBJECTIVES.find(o=>o.objectiveId===input.objectiveId);if(!objective)throw new Error('RECOVERY_OBJECTIVE_NOT_FOUND');
    if(!input.scenario.trim())throw new Error('RECOVERY_SCENARIO_REQUIRED');
    const v=store.saveDrill({drillId:generateUUIDv7(),objectiveId:objective.objectiveId,scenario:input.scenario.trim(),status:'RUNNING',startedAt:utcNow(),startedBy:actorUserId});
    InMemoryAuditStore.record({actorId:String(actorUserId),actorType:'ADMIN',action:'RECOVERY_DRILL_STARTED',resourceType:'RecoveryDrill',resourceId:v.drillId,classification:'INTERNAL',metadata:{objectiveId:v.objectiveId}});
    return v;
  }

  static completeRecoveryDrill(actorUserId:UserId,drillId:string,input:{observedRtoMinutes:number;observedRpoMinutes:number;restoreVerified:boolean;evidence:string}){
    requireIncidentAuthority(actorUserId);const drill=store.getDrill(drillId);if(!drill)throw new Error('RECOVERY_DRILL_NOT_FOUND');
    if(drill.status!=='RUNNING')throw new Error('RECOVERY_DRILL_NOT_RUNNING');
    const objective=OBJECTIVES.find(o=>o.objectiveId===drill.objectiveId)!;
    const pass=input.observedRtoMinutes<=objective.targetRtoMinutes&&input.observedRpoMinutes<=objective.targetRpoMinutes&&(!objective.restoreVerificationRequired||input.restoreVerified);
    const next=store.saveDrill({...drill,status:pass?'PASSED':'FAILED',completedAt:utcNow(),observedRtoMinutes:input.observedRtoMinutes,observedRpoMinutes:input.observedRpoMinutes,restoreVerified:input.restoreVerified,evidence:input.evidence.trim()});
    InMemoryAuditStore.record({actorId:String(actorUserId),actorType:'ADMIN',action:'RECOVERY_DRILL_COMPLETED',resourceType:'RecoveryDrill',resourceId:drillId,classification:'INTERNAL',metadata:{status:next.status,objectiveId:next.objectiveId}});
    return next;
  }

  static getSnapshot(actorUserId:UserId):ResilienceSnapshot{
    requireIncidentAuthority(actorUserId);
    const dependencies=POLICIES.map(p=>({policy:{...p},runtime:store.getDependency(p.dependencyId)||initial(p.dependencyId)}));
    const drills=store.listDrills(),tested=new Set(drills.filter(d=>d.status==='PASSED'||d.status==='FAILED').map(d=>d.objectiveId));
    return {generatedAt:utcNow(),dependencies,recoveryObjectives:this.getRecoveryObjectives(),drills,performanceBudgets:this.getPerformanceBudgets(),degradationRules:this.getDegradationRules(),recoveryReadiness:{verifiedDrills:drills.filter(d=>d.status==='PASSED').length,failedDrills:drills.filter(d=>d.status==='FAILED').length,untestedObjectives:OBJECTIVES.filter(o=>!tested.has(o.objectiveId)).length},productionBoundaries:[
      'Prototype dependency health and recovery drills are simulated control-plane evidence, not proof of multi-region production availability.',
      'Production disaster recovery requires encrypted backups, off-site/region-separated copies, scheduled restore verification, infrastructure-as-code recreation and independently monitored recovery objectives.',
      'RTO/RPO values are recovery objectives. They must not be represented as achieved SLAs until production drills and telemetry prove them.',
      'Browser performance budgets are CI bundle controls; LCP, INP and CLS remain unmeasured until real-user monitoring is deployed.'
    ]};
  }
}
