import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { OrchestrationStore } from './store';
import { seedOrchestrationData } from './seed';
import { OrchestrationService } from './service';
import { CareStore } from '../care/store';
import { NotificationStore } from '../notifications/store';
import { IdentityStore } from '../identity/store';
import { RecoveryService } from '../recovery/service';
import { CommunityStore } from '../community/store';
import { TrackingStore } from '../tracking/store';
import { AIPlatformService } from '../ai/service';
import { ActionProposalId, AutomationRuleId } from '../kernel/ids';

export interface TestResult {
  id:string;
  name:string;
  category:'REGISTRY'|'CONFIRMATION'|'AUTHORIZATION'|'AI_BOUNDARY'|'DOMAIN_EXECUTION'|'AUTOMATION'|'SAFETY'|'COMPENSATION'|'IDEMPOTENCY';
  passed:boolean;
  message:string;
  durationMs:number;
}

async function setup(){
  await seedUnifiedPetOS({forceReset:true});
  seedOrchestrationData(CANONICAL_IDS.OWNER_ELENA,CANONICAL_IDS.MAIN_HOUSEHOLD);
}

function future(hours=2){return new Date(Date.now()+hours*3600000).toISOString();}

function firstCareOccurrence(){
  const occ=CareStore.getOccurrencesForPet(CANONICAL_IDS.PET_KIBO)[0];
  if(!occ)throw new Error('Seeded care occurrence missing');
  return occ;
}

function createLostIncident(){
  return RecoveryService.getInstance().reportLostPetIncident({
    householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,reportedByUserId:CANONICAL_IDS.OWNER_ELENA,petId:CANONICAL_IDS.PET_KIBO,
    missingSince:new Date(Date.now()-3600000).toISOString(),
    lastKnownLocation:{latitude:-1.2892,longitude:36.7865,accuracyMeters:10,coarseDescription:'Kilimani, Nairobi'},
    coarseSearchArea:{neighborhood:'Kilimani',district:'Dagoretti North',city:'Nairobi',county:'Nairobi',centerLatitude:-1.2892,centerLongitude:36.7865,radiusKm:4},
    ownerInstructions:'Please use the Pet OS contact relay. Do not chase.',
  });
}

export class OrchestrationTestSuite {
  static async runAllTests():Promise<{passed:number;failed:number;total:number;results:TestResult[]}>{
    const tests:Array<{id:string;name:string;category:TestResult['category'];fn:()=>Promise<void>|void}>=[
      {id:'ORCH-01',name:'Action registry is an explicit allowlist',category:'REGISTRY',fn:async()=>{
        await setup();const defs=OrchestrationStore.getInstance().listActionDefinitions();
        if(defs.length!==8)throw new Error(`expected 8 allowlisted actions, found ${defs.length}`);
        if(defs.some(d=>d.moneyMovement||d.clinicalMutation||d.exactLocationDisclosure))throw new Error('unsafe generic action present');
      }},
      {id:'ORCH-02',name:'Unknown financial action is rejected',category:'SAFETY',fn:async()=>{
        await setup();let blocked=false;try{OrchestrationService.propose({actionType:'FINANCE_REFUND' as any,actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'USER_UI',payload:{amount:100}});}catch(e:any){blocked=e.message.includes('ACTION_NOT_REGISTERED');}
        if(!blocked)throw new Error('generic financial automation was not rejected');
      }},
      {id:'ORCH-03',name:'Unknown clinical mutation is rejected',category:'SAFETY',fn:async()=>{
        await setup();let blocked=false;try{OrchestrationService.propose({actionType:'HEALTH_CHANGE_MEDICATION_DOSE' as any,actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'AI_PROPOSAL',payload:{dose:'20mg'}});}catch(e:any){blocked=e.message.includes('ACTION_NOT_REGISTERED');}
        if(!blocked)throw new Error('clinical mutation automation was not rejected');
      }},
      {id:'ORCH-04',name:'AI can propose but cannot silently execute a Care write',category:'AI_BOUNDARY',fn:async()=>{
        await setup();const before=CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length;
        const ai=await AIPlatformService.ask({userId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,useCase:'PET_ASSISTANT',text:'Remind me to brush Kibo tomorrow'});
        const req=OrchestrationStore.getInstance();
        const aiReq=(await import('../ai/store')).AIStore.getInstance().getRequest(ai.requestId)!;
        const p=OrchestrationService.proposeFromAI({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,aiRequestId:aiReq.requestId,payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Brush Kibo',dueAt:future(24)}});
        const after=CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length;
        if(after!==before||p.status!=='AWAITING_CONFIRMATION')throw new Error('AI proposal mutated Care before confirmation');
      }},
      {id:'ORCH-05',name:'Confirmed Care proposal executes through canonical Care service',category:'DOMAIN_EXECUTION',fn:async()=>{
        await setup();const before=CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length;
        const p=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Check paws',dueAt:future(4)}});
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);
        const r=await OrchestrationService.executeProposal(p.actionProposalId);
        if(r.attempt.classification!=='SUCCESS'||CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length!==before+1)throw new Error('Care task not created');
      }},
      {id:'ORCH-06',name:'Confirmation is actor-bound and cannot be replayed',category:'CONFIRMATION',fn:async()=>{
        await setup();const p=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Clean bowl',dueAt:future()}});
        let actorBlocked=false;try{OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.CAREGIVER_SEAN);}catch(e:any){actorBlocked=e.message.includes('ACTOR_MISMATCH');}
        if(!actorBlocked)throw new Error('wrong actor confirmation accepted');
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);
        let replayBlocked=false;try{OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);}catch(e:any){replayBlocked=e.message.includes('ALREADY_CONFIRMED');}
        if(!replayBlocked)throw new Error('confirmation replay accepted');
      }},
      {id:'ORCH-07',name:'Stale preview forces reconfirmation',category:'CONFIRMATION',fn:async()=>{
        await setup();const occ=firstCareOccurrence();
        const p=OrchestrationService.propose({actionType:'CARE_SNOOZE_OCCURRENCE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{occurrenceId:occ.occurrenceId,snoozedUntil:future(6)}});
        CareStore.saveOccurrence({...occ,updatedAt:new Date(Date.now()+1000).toISOString()});
        let stale=false;try{OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);}catch(e:any){stale=e.message.includes('STALE_PREVIEW');}
        if(!stale)throw new Error('stale preview was confirmable');
      }},
      {id:'ORCH-08',name:'Care snooze does not alter canonical due date',category:'DOMAIN_EXECUTION',fn:async()=>{
        await setup();const occ=firstCareOccurrence();const due=occ.scheduledFor;
        const p=OrchestrationService.propose({actionType:'CARE_SNOOZE_OCCURRENCE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{occurrenceId:occ.occurrenceId,snoozedUntil:future(6),reason:'Later today'}});
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);await OrchestrationService.executeProposal(p.actionProposalId);
        const after=CareStore.getOccurrence(occ.occurrenceId)!;
        if(after.scheduledFor!==due||!after.snoozedUntil)throw new Error('snooze changed due date or failed');
      }},
      {id:'ORCH-09',name:'Runtime membership is rechecked after confirmation',category:'AUTHORIZATION',fn:async()=>{
        await setup();const p=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.CAREGIVER_SEAN,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Fresh water',dueAt:future()}});
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.CAREGIVER_SEAN);
        const m=IdentityStore.findMembership(CANONICAL_IDS.MAIN_HOUSEHOLD,CANONICAL_IDS.CAREGIVER_SEAN)!;
        IdentityStore.saveMembership({...m,status:'SUSPENDED',updatedAt:new Date().toISOString()});
        let denied=false;try{await OrchestrationService.executeProposal(p.actionProposalId);}catch(e:any){denied=e.message.includes('ACTIVE_MEMBERSHIP_REQUIRED');}
        if(!denied)throw new Error('revoked membership retained execution authority');
      }},
      {id:'ORCH-10',name:'Cross-household Pet target is denied',category:'AUTHORIZATION',fn:async()=>{
        await setup();const p=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Safe',dueAt:future()}});
        if(p.status==='FAILED')throw new Error('valid baseline unexpectedly failed');
        const q=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.OUTSIDER_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Cross tenant',dueAt:future()},idempotencyKey:'cross-household'});
        if(q.status!=='FAILED')throw new Error('cross-household proposal not denied');
      }},
      {id:'ORCH-11',name:'Lost Pet public alert requires strong reauthentication',category:'SAFETY',fn:async()=>{
        await setup();const {incident}=createLostIncident();
        const p=OrchestrationService.propose({actionType:'LOST_PET_ACTIVATE_COMMUNITY_ALERT',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{lostPetIncidentId:incident.lostPetIncidentId}});
        if(p.preview?.privacyImpact!=='PUBLIC'||p.preview.dataShared.some(x=>/exact|phone|microchip/i.test(x)))throw new Error('public preview privacy disclosure incorrect');
        let blocked=false;try{OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);}catch(e:any){blocked=e.message.includes('STRONG_REAUTH_REQUIRED');}
        if(!blocked)throw new Error('public safety action confirmed without reauth');
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA,{reauthenticated:true});
        await OrchestrationService.executeProposal(p.actionProposalId);
        const updated=RecoveryService.getInstance().getIncidentById(incident.lostPetIncidentId)!;
        const alert=CommunityStore.getInstance().getAlertByIncidentId(incident.lostPetIncidentId);
        if(!updated.isCommunityAlertRequested||!alert||alert.status!=='ACTIVE')throw new Error('community alert distribution not activated');
      }},
      {id:'ORCH-12',name:'Tracker Lost Mode is capability-truthful and strongly confirmed',category:'SAFETY',fn:async()=>{
        await setup();const p=OrchestrationService.propose({actionType:'TRACKING_REQUEST_LOST_MODE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO}});
        OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA,{reauthenticated:true});
        const r=await OrchestrationService.executeProposal(p.actionProposalId);
        if(r.attempt.classification!=='SUCCESS')throw new Error('Lost Mode request failed');
      }},
      {id:'ORCH-13',name:'Standing automation cannot run sensitive Care writes',category:'AUTOMATION',fn:async()=>{
        await setup();let blocked=false;try{OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'Unsafe care writer',description:'test',triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'x'},actionType:'CARE_CREATE_OWNER_TASK',actionPayloadTemplate:{petId:CANONICAL_IDS.PET_KIBO,title:'x',dueAt:future()}});}catch(e:any){blocked=e.message.includes('AUTOMATION_RULE_ACTION_FORBIDDEN');}
        if(!blocked)throw new Error('sensitive standing automation rule accepted');
      }},
      {id:'ORCH-14',name:'Low-risk notification automation can execute idempotently',category:'AUTOMATION',fn:async()=>{
        await setup();const rule=OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'Care heads-up',description:'Notify only',triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'CareDue'},actionType:'NOTIFICATION_SCHEDULE_SELF',actionPayloadTemplate:{title:'Care due',body:'Kibo has care due.',petId:CANONICAL_IDS.PET_KIBO},maxExecutionsPerDay:5});
        const before=NotificationStore.getNotificationsForUser(CANONICAL_IDS.OWNER_ELENA).length;
        const a=await OrchestrationService.triggerRule(rule.automationRuleId,'evt-one');
        const b=await OrchestrationService.triggerRule(rule.automationRuleId,'evt-one');
        const after=NotificationStore.getNotificationsForUser(CANONICAL_IDS.OWNER_ELENA).length;
        if(a.actionProposalId!==b.actionProposalId||after!==before+1)throw new Error('automation event was not idempotent');
      }},
      {id:'ORCH-15',name:'Automation cycle guard blocks recursive rule invocation',category:'AUTOMATION',fn:async()=>{
        await setup();const rule=OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'Loop guard',description:'test',triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'X'},actionType:'OPEN_DOMAIN_WORKSPACE',actionPayloadTemplate:{module:'care'}});
        let blocked=false;try{await OrchestrationService.triggerRule(rule.automationRuleId,'evt-loop',{},[String(rule.automationRuleId)]);}catch(e:any){blocked=e.message.includes('AUTOMATION_CYCLE_DETECTED');}
        if(!blocked||!OrchestrationStore.getInstance().listIncidents().some(i=>i.category==='ACTION_LOOP'))throw new Error('cycle guard failed');
      }},
      {id:'ORCH-16',name:'Per-rule daily execution cap prevents automation floods',category:'AUTOMATION',fn:async()=>{
        await setup();const rule=OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'One per day',description:'test',triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'X'},actionType:'OPEN_DOMAIN_WORKSPACE',actionPayloadTemplate:{module:'care'},maxExecutionsPerDay:1});
        await OrchestrationService.triggerRule(rule.automationRuleId,'evt-1');
        let blocked=false;try{await OrchestrationService.triggerRule(rule.automationRuleId,'evt-2');}catch(e:any){blocked=e.message.includes('DAILY_LIMIT');}
        if(!blocked)throw new Error('rule flood cap failed');
      }},
      {id:'ORCH-17',name:'Only no-confirmation actions can be scheduled unattended',category:'AUTOMATION',fn:async()=>{
        await setup();const sensitive=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Later',dueAt:future()}});
        let blocked=false;try{OrchestrationService.scheduleLowRisk(sensitive.actionProposalId,future());}catch(e:any){blocked=e.message.includes('INTERACTIVE_CONFIRMATION');}
        if(!blocked)throw new Error('sensitive scheduled action accepted');
        const low=OrchestrationService.propose({actionType:'NOTIFICATION_SCHEDULE_SELF',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'USER_UI',payload:{title:'Later',body:'Reminder'}});
        const schedule=OrchestrationService.scheduleLowRisk(low.actionProposalId,new Date(Date.now()-1000).toISOString());
        const result=await OrchestrationService.processSchedules(new Date());
        if(result.executed!==1||schedule.timezone!=='Africa/Nairobi')throw new Error('safe schedule did not execute');
      }},
      {id:'ORCH-18',name:'Composite workflow compensates reversible step after downstream failure',category:'COMPENSATION',fn:async()=>{
        await setup();const title='Compensation test care task';
        const first=OrchestrationService.propose({actionType:'CARE_CREATE_OWNER_TASK',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_KIBO,title,dueAt:future(8)},idempotencyKey:'comp-care'});
        OrchestrationService.confirmProposal(first.actionProposalId,CANONICAL_IDS.OWNER_ELENA);
        const second=OrchestrationService.propose({actionType:'TRACKING_REQUEST_LOST_MODE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_LUNA,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_LUNA},idempotencyKey:'comp-tracking'});
        OrchestrationService.confirmProposal(second.actionProposalId,CANONICAL_IDS.OWNER_ELENA,{reauthenticated:true});
        let failed=false;try{await OrchestrationService.executeComposite([first.actionProposalId,second.actionProposalId]);}catch{failed=true;}
        const task=CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).find(x=>x.title===title);
        if(!failed||!task||task.status!=='CANCELLED')throw new Error('reversible Care step was not compensated');
      }},
      {id:'ORCH-19',name:'Real-world notification effect is never falsely rolled back',category:'COMPENSATION',fn:async()=>{
        await setup();const first=OrchestrationService.propose({actionType:'NOTIFICATION_SCHEDULE_SELF',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'USER_UI',payload:{title:'Cannot unsend',body:'Real-world effects are truthful.'},idempotencyKey:'no-unsend'});
        const second=OrchestrationService.propose({actionType:'TRACKING_REQUEST_LOST_MODE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_LUNA,origin:'USER_UI',payload:{petId:CANONICAL_IDS.PET_LUNA},idempotencyKey:'no-unsend-fail'});
        OrchestrationService.confirmProposal(second.actionProposalId,CANONICAL_IDS.OWNER_ELENA,{reauthenticated:true});
        let failed=false;try{await OrchestrationService.executeComposite([first.actionProposalId,second.actionProposalId]);}catch{failed=true;}
        const comps=OrchestrationStore.getInstance().listCompensations();
        if(!failed||!comps.some(c=>c.capability==='NONE'&&c.status==='NOT_REQUIRED'))throw new Error('non-reversible effect was misrepresented');
      }},
      {id:'ORCH-21',name:'Automation conditions use deterministic safe evaluation',category:'AUTOMATION',fn:async()=>{
        await setup();const rule=OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'Scoped condition',description:'test',triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'CareDue'},conditionExpression:'event.householdId == rule.householdId',actionType:'OPEN_DOMAIN_WORKSPACE',actionPayloadTemplate:{module:'care'}});
        let blocked=false;try{await OrchestrationService.triggerRule(rule.automationRuleId,'evt-wrong',{householdId:String(CANONICAL_IDS.OUTSIDER_HOUSEHOLD)});}catch(e:any){blocked=e.message.includes('CONDITION_FALSE');}
        if(!blocked)throw new Error('condition mismatch did not block action');
        const p=await OrchestrationService.triggerRule(rule.automationRuleId,'evt-right',{householdId:String(CANONICAL_IDS.MAIN_HOUSEHOLD)});
        if(p.status!=='COMPLETED')throw new Error('matching deterministic condition did not execute');
        let unsafe=false;try{OrchestrationService.createRule({ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,name:'Unsafe condition',description:'test',triggerType:'CONDITION',triggerConfig:{},conditionExpression:'select * from pets;',actionType:'OPEN_DOMAIN_WORKSPACE',actionPayloadTemplate:{module:'care'}});}catch(e:any){unsafe=e.message.includes('UNSAFE_AUTOMATION_CONDITION');}
        if(!unsafe)throw new Error('unsafe condition syntax was accepted');
      }},
      {id:'ORCH-22',name:'Multi-party approval requires a distinct active second household member',category:'CONFIRMATION',fn:async()=>{
        await setup();
        const store=OrchestrationStore.getInstance();
        const original=store.getActionDefinitionByType('OPEN_DOMAIN_WORKSPACE')!;
        store.saveActionDefinition({...original,confirmationLevel:'MULTI_PARTY'});
        const p=OrchestrationService.propose({actionType:'OPEN_DOMAIN_WORKSPACE',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'USER_UI',payload:{module:'care'},idempotencyKey:'multi-party-test'});
        if(p.status!=='AWAITING_APPROVAL')throw new Error('multi-party action did not await approval');
        let selfBlocked=false;try{OrchestrationService.requestApproval(p.actionProposalId,[CANONICAL_IDS.OWNER_ELENA],'Second-person review');}catch(e:any){selfBlocked=e.message.includes('DISTINCT_APPROVER_REQUIRED');}
        if(!selfBlocked)throw new Error('proposer was allowed to self-approve');
        const approval=OrchestrationService.requestApproval(p.actionProposalId,[CANONICAL_IDS.CAREGIVER_SEAN],'Second-person review');
        OrchestrationService.decideApproval(approval.approvalRequestId,CANONICAL_IDS.CAREGIVER_SEAN,true,'Approved');
        const result=await OrchestrationService.executeProposal(p.actionProposalId);
        if(result.attempt.classification!=='SUCCESS')throw new Error('approved multi-party action did not execute');
      }},
      {id:'ORCH-23',name:'Future low-risk schedules outlive the default proposal preview window',category:'AUTOMATION',fn:async()=>{
        await setup();
        const p=OrchestrationService.propose({actionType:'NOTIFICATION_SCHEDULE_SELF',actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,origin:'USER_UI',payload:{title:'Tomorrow reminder',body:'Future safe reminder'}});
        const executeAt=future(6);
        OrchestrationService.scheduleLowRisk(p.actionProposalId,executeAt);
        const updated=OrchestrationStore.getInstance().getProposal(p.actionProposalId)!;
        if(new Date(updated.expiresAt).getTime()<=new Date(executeAt).getTime())throw new Error('scheduled proposal expires before execution');
      }},
      {id:'ORCH-20',name:'Proposal and execution idempotency prevent duplicate domain writes',category:'IDEMPOTENCY',fn:async()=>{
        await setup();const before=CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length;
        const input={actionType:'CARE_CREATE_OWNER_TASK' as const,actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,petId:CANONICAL_IDS.PET_KIBO,origin:'USER_UI' as const,payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Idempotent task',dueAt:future(5)},idempotencyKey:'idem-care'};
        const a=OrchestrationService.propose(input),b=OrchestrationService.propose(input);
        if(a.actionProposalId!==b.actionProposalId)throw new Error('proposal dedup failed');
        OrchestrationService.confirmProposal(a.actionProposalId,CANONICAL_IDS.OWNER_ELENA);
        await OrchestrationService.executeProposal(a.actionProposalId);await OrchestrationService.executeProposal(a.actionProposalId);
        if(CareStore.getObligationsForPet(CANONICAL_IDS.PET_KIBO).length!==before+1)throw new Error('duplicate domain write occurred');
      }}
    ];

    const results:TestResult[]=[];
    for(const t of tests){const start=Date.now();try{await t.fn();results.push({id:t.id,name:t.name,category:t.category,passed:true,message:'PASS',durationMs:Date.now()-start});}catch(e:any){results.push({id:t.id,name:t.name,category:t.category,passed:false,message:e?.message||String(e),durationMs:Date.now()-start});}}
    return {passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,total:results.length,results};
  }
}
