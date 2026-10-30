import {
  ActionProposalId, ActionConfirmationId, ApprovalRequestId, WorkflowDefinitionId,
  WorkflowInstanceId, WorkflowStepId, ExecutionAttemptId, CompensationRecordId,
  OrchestrationIncidentId, AutomationRuleId, AutomationRuleVersionId, ScheduledActionId,
  asCareObligationId, asBookingId, generateUUIDv7
} from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { CareService } from '../care/service';
import { BookingStore } from '../booking/store';
import { BookingPlatformService } from '../booking/service';
import { ProviderStore } from '../provider/store';
import { RecoveryService } from '../recovery/service';
import { TrackingStore } from '../tracking/store';
import { TrackingService } from '../tracking/service';
import { AIStore } from '../ai/store';
import { OrchestrationStore } from './store';
import { OrchestrationPolicyEngine, ORCHESTRATION_POLICY_VERSION } from './policy';
import { OrchestrationDomainAdapter } from './adapters';
import { OrchestrationEvents } from './events';
import {
  ActionDefinition, ActionPreview, ActionProposal, ActionConfirmation, ApprovalRequest,
  ProposeActionInput, ExecuteActionResult, WorkflowDefinition, WorkflowInstance, WorkflowStep,
  ExecutionAttempt, CompensationRecord, AutomationRule, AutomationRuleVersion, TriggerType,
  ActionType, ScheduledAction, OrchestrationIncident
} from './types';

const store=OrchestrationStore.getInstance();

function stableStringify(value:any):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')}}`;
}

function integrityHash(value:any):string{
  const s=stableStringify(value);
  let h1=0x811c9dc5;
  for(let i=0;i<s.length;i++){h1^=s.charCodeAt(i);h1=Math.imul(h1,0x01000193);}
  return `fnv1a-${(h1>>>0).toString(16).padStart(8,'0')}`;
}

function nowIso(){return new Date().toISOString();}
function minutesFromNow(n:number){return new Date(Date.now()+n*60000).toISOString();}

function activeMembership(actor:any,household:any):void{
  const membership=IdentityStore.findMembership(household,actor);
  if(!membership||membership.status!=='ACTIVE')throw new Error('AUTHORIZATION_FAILURE: active household membership required');
}

function getDefinition(type:ActionType):ActionDefinition{
  const def=store.getActionDefinitionByType(type);
  if(!def)throw new Error(`ACTION_NOT_REGISTERED: ${type}`);
  return def;
}

function targetFingerprint(proposal:ActionProposal):string{
  switch(proposal.actionType){
    case 'CARE_CREATE_OWNER_TASK':{
      const pet=proposal.petId?PetStore.findPetById(proposal.petId):undefined;
      return integrityHash({petId:proposal.petId,status:pet?.status,version:pet?.version,dueAt:proposal.payload.dueAt});
    }
    case 'CARE_SNOOZE_OCCURRENCE':
    case 'CARE_COMPLETE_OCCURRENCE':{
      const id=String(proposal.payload.occurrenceId||'');
      const occ=CareStore.getAllOccurrences().find(x=>String(x.occurrenceId)===id);
      return integrityHash(occ?{id,status:occ.status,scheduledFor:occ.scheduledFor,dueWindowEnd:occ.dueWindowEnd,snoozeCount:occ.snoozeCount,updatedAt:occ.updatedAt}:{id,missing:true});
    }
    case 'BOOKING_CREATE_SERVICE_REQUEST':{
      const provider=ProviderStore.getInstance().getProvider(proposal.payload.providerId as any);
      const offering=ProviderStore.getInstance().getServiceOffering(proposal.payload.serviceOfferingId as any);
      return integrityHash({
        providerId:proposal.payload.providerId,providerStatus:provider?.operationalStatus,verification:provider?.verificationStatus,
        offeringId:proposal.payload.serviceOfferingId,offeringStatus:offering?.status,basePriceMinorUnits:offering?.basePriceMinorUnits,
        startAt:proposal.payload.startAt,endAt:proposal.payload.endAt
      });
    }
    case 'LOST_PET_ACTIVATE_COMMUNITY_ALERT':{
      const incident=RecoveryService.getInstance().getIncidentById(proposal.payload.lostPetIncidentId as any);
      return integrityHash(incident?{id:incident.lostPetIncidentId,status:incident.status,isCommunityAlertRequested:incident.isCommunityAlertRequested,updatedAt:incident.updatedAt}:{missing:true});
    }
    case 'TRACKING_REQUEST_LOST_MODE':{
      const petId=(proposal.payload.petId||proposal.petId) as any;
      const assignment=petId?TrackingStore.getInstance().getActiveAssignmentForPet(petId):undefined;
      const device=assignment?TrackingStore.getInstance().getDevice(assignment.deviceId):undefined;
      return integrityHash({petId,assignmentId:assignment?.assignmentId,deviceId:device?.deviceId,operationalStatus:device?.operationalStatus,connectivityStatus:device?.connectivityStatus,updatedAt:device?.updatedAt});
    }
    case 'NOTIFICATION_SCHEDULE_SELF':
      return integrityHash({actor:proposal.actorUserId,scheduledAt:proposal.payload.scheduledAt,title:proposal.payload.title});
    case 'OPEN_DOMAIN_WORKSPACE':
      return integrityHash({module:proposal.payload.module});
  }
}

function previewDetails(proposal:ActionProposal,def:ActionDefinition):Omit<ActionPreview,'previewHash'>{
  const base={
    actionType:proposal.actionType,actionVersion:def.version,title:def.title,target:proposal.target,
    effects:[] as string[],dataShared:[] as string[],warnings:[] as string[],irreversibleEffects:[] as string[],
    privacyImpact:'LOW' as ActionPreview['privacyImpact'],generatedAt:nowIso(),expiresAt:minutesFromNow(10),
    targetStateFingerprint:targetFingerprint(proposal)
  };
  switch(proposal.actionType){
    case 'CARE_CREATE_OWNER_TASK':
      return {...base,summary:`Create household care task "${proposal.payload.title}" due ${proposal.payload.dueAt}.`,
        effects:['Creates a canonical owner-defined Care obligation and first occurrence.','Care domain authorization and Pet ownership are rechecked at execution.'],
        warnings:['This does not create or alter a veterinary diagnosis, prescription, medication dose, or provider-defined clinical schedule.']};
    case 'CARE_SNOOZE_OCCURRENCE':
      return {...base,summary:`Snooze the selected reminder until ${proposal.payload.snoozedUntil}.`,
        effects:['Changes reminder timing only.'],warnings:['The clinical scheduled date and due date remain unchanged.']};
    case 'CARE_COMPLETE_OCCURRENCE':
      return {...base,summary:'Record the selected care occurrence as completed.',
        effects:['Creates a Care completion record with user provenance.','May generate the next occurrence when the existing obligation is recurring.'],
        warnings:['This records household execution; it does not create a clinical diagnosis or prescription.']};
    case 'NOTIFICATION_SCHEDULE_SELF':
      return {...base,summary:`Schedule an in-app reminder: "${proposal.payload.title}".`,
        effects:['Creates a deduplicated Notification delivery record.'],warnings:['Quiet-hours policy still applies at delivery time.']};
    case 'BOOKING_CREATE_SERVICE_REQUEST':{
      const offering=ProviderStore.getInstance().getServiceOffering(proposal.payload.serviceOfferingId as any);
      const money=offering?{currency:offering.currency,amountMinor:offering.basePriceMinorUnits}:undefined;
      return {...base,summary:'Create a service booking request for the selected provider, Pet(s), and time window.',
        effects:['Booking domain revalidates provider, offering, Pet eligibility and capacity.','The resulting booking may be confirmed immediately or await provider approval.'],
        warnings:['This does not authorize a payment or move money. Payment remains a separate Finance flow.'],money};
    }
    case 'LOST_PET_ACTIVATE_COMMUNITY_ALERT':
      return {...base,summary:'Publish the existing Lost Pet incident to the privacy-minimized Community recovery network.',
        effects:['Requests public distribution of the recovery profile and coarse search area.'],dataShared:['Pet display name','Species/breed','Approved photo','Coarse recovery area','Owner-approved recovery instructions'],
        warnings:['Exact GPS coordinates, home address, phone number, microchip number and BLE detector identity are not included.'],
        irreversibleEffects:['Once distributed publicly, copies or screenshots outside Pet OS cannot be recalled.'],privacyImpact:'PUBLIC'};
    case 'TRACKING_REQUEST_LOST_MODE':
      return {...base,summary:'Request the tracker capability boundary to enter supported Lost Mode.',
        effects:['May request a higher-frequency tracking mode when the device/provider supports it.'],
        dataShared:['Tracker device reference with the configured tracking provider'],warnings:['An active connectivity plan does not guarantee a fresh GPS observation.','Unsupported devices must fail truthfully rather than simulate Lost Mode.'],privacyImpact:'SENSITIVE'};
    case 'OPEN_DOMAIN_WORKSPACE':
      return {...base,summary:`Open the ${proposal.payload.module} workspace.`,effects:['Navigation only; no canonical state change.'],privacyImpact:'NONE'};
  }
}

export class OrchestrationService {
  static propose(input:ProposeActionInput):ActionProposal{
    const def=getDefinition(input.actionType);
    const idempotencyKey=input.idempotencyKey||integrityHash({
      actionType:input.actionType,actor:input.actorUserId,household:input.householdId,pet:input.petId,
      payload:input.payload,origin:input.origin,originRef:input.originReferenceId
    });
    const existing=store.getProposalByIdempotency(idempotencyKey);
    if(existing)return existing;

    const now=nowIso();
    let proposal:ActionProposal={
      actionProposalId:`ap-${generateUUIDv7()}` as ActionProposalId,actionType:input.actionType,actionVersion:def.version,
      actorUserId:input.actorUserId,householdId:input.householdId,petId:input.petId,origin:input.origin,
      originReferenceId:input.originReferenceId,aiRequestId:input.aiRequestId,recommendationId:input.recommendationId,
      payload:{...input.payload},target:{householdId:input.householdId,petId:input.petId},status:'DRAFT',
      idempotencyKey,createdAt:now,updatedAt:now,expiresAt:minutesFromNow(30)
    };

    const details=previewDetails(proposal,def);
    const preview:ActionPreview={...details,previewHash:integrityHash(details)};
    proposal={...proposal,preview,status:'READY_FOR_PREVIEW',updatedAt:nowIso()};
    const policy=OrchestrationPolicyEngine.evaluate(proposal,def);
    proposal.policyDecisionId=policy.policyDecisionId;
    proposal.status=policy.outcome==='ALLOWED'?'CONFIRMED'
      : policy.outcome==='REQUIRES_APPROVAL'?'AWAITING_APPROVAL'
      : ['REQUIRES_CONFIRMATION','REQUIRES_REAUTH'].includes(policy.outcome)?'AWAITING_CONFIRMATION'
      :'FAILED';
    store.saveProposal(proposal);store.publish(OrchestrationEvents.proposalCreated(proposal));
    return proposal;
  }

  static proposeFromAI(input:Omit<ProposeActionInput,'origin'> & {aiRequestId:any}):ActionProposal{
    const req=AIStore.getInstance().getRequest(input.aiRequestId);
    if(!req||req.status!=='COMPLETED')throw new Error('AI_PROPOSAL_REJECTED: originating AI request is not a completed governed request');
    if(req.userId!==input.actorUserId||req.householdId!==input.householdId)throw new Error('AI_PROPOSAL_REJECTED: request actor/household mismatch');
    return this.propose({...input,origin:'AI_PROPOSAL'});
  }

  static confirmProposal(proposalId:ActionProposalId,actorUserId:any,options:{reauthenticated?:boolean}={}):ActionConfirmation{
    const proposal=store.getProposal(proposalId);if(!proposal)throw new Error('ACTION_PROPOSAL_NOT_FOUND');
    if(proposal.actorUserId!==actorUserId)throw new Error('CONFIRMATION_ACTOR_MISMATCH');
    if(proposal.confirmationId || ['COMPLETED','EXECUTING'].includes(proposal.status))throw new Error('ACTION_ALREADY_CONFIRMED_OR_EXECUTED');
    if(!proposal.preview)throw new Error('ACTION_PREVIEW_REQUIRED');
    if(new Date(proposal.expiresAt).getTime()<=Date.now())throw new Error('ACTION_PROPOSAL_EXPIRED');
    const def=getDefinition(proposal.actionType);
    const policy=OrchestrationPolicyEngine.evaluate(proposal,def);
    if(['DENIED','UNAVAILABLE'].includes(policy.outcome))throw new Error(`ORCHESTRATION_POLICY_DENIED: ${policy.reasonCode}`);
    if(def.confirmationLevel==='STRONG_REAUTH'&&!options.reauthenticated)throw new Error('STRONG_REAUTH_REQUIRED');
    if(def.confirmationLevel==='MULTI_PARTY')throw new Error('APPROVAL_REQUIRED_BEFORE_CONFIRMATION');

    const currentFingerprint=targetFingerprint(proposal);
    if(currentFingerprint!==proposal.preview.targetStateFingerprint){
      proposal.status='STALE';proposal.updatedAt=nowIso();store.saveProposal(proposal);
      throw new Error('STALE_PREVIEW: target state changed; review a new preview');
    }

    const confirmedAt=nowIso(),expiresAt=minutesFromNow(def.confirmationLevel==='STRONG_REAUTH'?3:10);
    const confirmationId=`ac-${generateUUIDv7()}` as ActionConfirmationId;
    const binding=integrityHash({
      confirmationId,proposalId,actorUserId,version:proposal.actionVersion,previewHash:proposal.preview.previewHash,
      targetStateFingerprint:proposal.preview.targetStateFingerprint,confirmationLevel:def.confirmationLevel,expiresAt
    });
    const confirmation:ActionConfirmation={
      actionConfirmationId:confirmationId,actionProposalId:proposalId,actorUserId,proposalVersion:proposal.actionVersion,
      previewHash:proposal.preview.previewHash,confirmationLevel:def.confirmationLevel,confirmationBinding:binding,
      oneTimeUse:true,confirmedAt,expiresAt
    };
    store.saveConfirmation(confirmation);
    proposal.confirmationId=confirmationId;proposal.status='CONFIRMED';proposal.updatedAt=confirmedAt;store.saveProposal(proposal);
    store.publish(OrchestrationEvents.proposalConfirmed(proposal));
    return confirmation;
  }

  static requestApproval(proposalId:ActionProposalId,requestedFromUserIds:any[],reason:string):ApprovalRequest{
    const proposal=store.getProposal(proposalId);if(!proposal)throw new Error('ACTION_PROPOSAL_NOT_FOUND');
    const def=getDefinition(proposal.actionType);
    if(def.confirmationLevel!=='MULTI_PARTY')throw new Error('APPROVAL_NOT_REQUIRED_FOR_ACTION');
    if(!requestedFromUserIds.length)throw new Error('APPROVER_REQUIRED');
    const approval:ApprovalRequest={
      approvalRequestId:`apr-${generateUUIDv7()}` as ApprovalRequestId,actionProposalId:proposalId,
      requestedFromUserIds:[...requestedFromUserIds],status:'PENDING',reason,requestedAt:nowIso()
    };
    store.saveApproval(approval);store.publish(OrchestrationEvents.approvalRequested(approval,proposal));return approval;
  }

  static decideApproval(approvalId:ApprovalRequestId,actorUserId:any,approve:boolean,note?:string):ApprovalRequest{
    const approval=store.getApproval(approvalId);if(!approval)throw new Error('APPROVAL_NOT_FOUND');
    if(approval.status!=='PENDING')throw new Error('APPROVAL_ALREADY_DECIDED');
    if(!approval.requestedFromUserIds.includes(actorUserId))throw new Error('APPROVER_NOT_AUTHORIZED');
    approval.status=approve?'APPROVED':'REJECTED';approval.decidedAt=nowIso();approval.decidedBy=actorUserId;approval.decisionNote=note;
    store.saveApproval(approval);
    const proposal=store.getProposal(approval.actionProposalId);
    if(proposal){proposal.status=approve?'CONFIRMED':'FAILED';proposal.updatedAt=nowIso();store.saveProposal(proposal);}
    return approval;
  }

  private static verifyConfirmation(proposal:ActionProposal,def:ActionDefinition):void{
    if(def.confirmationLevel==='NONE')return;
    if(!proposal.confirmationId)throw new Error('ACTION_CONFIRMATION_REQUIRED');
    const c=store.getConfirmation(proposal.confirmationId);if(!c)throw new Error('ACTION_CONFIRMATION_NOT_FOUND');
    if(c.usedAt)throw new Error('CONFIRMATION_REPLAY_BLOCKED');
    if(c.actorUserId!==proposal.actorUserId||c.actionProposalId!==proposal.actionProposalId)throw new Error('CONFIRMATION_BINDING_MISMATCH');
    if(new Date(c.expiresAt).getTime()<=Date.now())throw new Error('CONFIRMATION_EXPIRED');
    if(!proposal.preview||c.previewHash!==proposal.preview.previewHash)throw new Error('CONFIRMATION_PREVIEW_MISMATCH');
    const expected=integrityHash({
      confirmationId:c.actionConfirmationId,proposalId:proposal.actionProposalId,actorUserId:c.actorUserId,
      version:proposal.actionVersion,previewHash:c.previewHash,targetStateFingerprint:proposal.preview.targetStateFingerprint,
      confirmationLevel:c.confirmationLevel,expiresAt:c.expiresAt
    });
    if(expected!==c.confirmationBinding)throw new Error('CONFIRMATION_INTEGRITY_FAILURE');
  }

  private static consumeConfirmation(proposal:ActionProposal):void{
    if(!proposal.confirmationId)return;
    const c=store.getConfirmation(proposal.confirmationId);
    if(c){c.usedAt=nowIso();store.saveConfirmation(c);}
  }

  private static createWorkflow(proposal:ActionProposal,code='SINGLE_ACTION'): {workflow:WorkflowInstance;step:WorkflowStep}{
    const defId=`wfdef-${code.toLowerCase()}-v1` as WorkflowDefinitionId;
    if(!store.getWorkflowDefinition(defId)){
      const wd:WorkflowDefinition={workflowDefinitionId:defId,code,version:1,name:code==='SINGLE_ACTION'?'Single action execution':'Cross-domain composite workflow',description:'Sprint 29 orchestrated workflow; target domains remain canonical.',stepActionTypes:[proposal.actionType],active:true};
      store.saveWorkflowDefinition(wd);
    }
    const workflow:WorkflowInstance={
      workflowInstanceId:`wfi-${generateUUIDv7()}` as WorkflowInstanceId,workflowDefinitionId:defId,
      actorUserId:proposal.actorUserId,householdId:proposal.householdId,petId:proposal.petId,status:'READY',currentStep:0,
      correlationId:`corr-${generateUUIDv7()}`,causationId:proposal.originReferenceId,createdAt:nowIso(),updatedAt:nowIso()
    };
    const step:WorkflowStep={
      workflowStepId:`wfs-${generateUUIDv7()}` as WorkflowStepId,workflowInstanceId:workflow.workflowInstanceId,
      sequence:1,actionType:proposal.actionType,status:'READY',actionProposalId:proposal.actionProposalId,executionAttemptIds:[]
    };
    store.saveWorkflow(workflow);store.saveStep(step);proposal.workflowInstanceId=workflow.workflowInstanceId;store.saveProposal(proposal);
    return {workflow,step};
  }

  private static async executeStep(proposal:ActionProposal,workflow:WorkflowInstance,step:WorkflowStep):Promise<ExecuteActionResult>{
    const def=getDefinition(proposal.actionType);
    const previous=store.getAttemptByIdempotency(`${workflow.workflowInstanceId}:${proposal.idempotencyKey}`);
    if(previous&&previous.classification==='SUCCESS'){
      workflow.status='COMPLETED';step.status='SUCCEEDED';proposal.status='COMPLETED';
      store.saveWorkflow(workflow);store.saveStep(step);store.saveProposal(proposal);
      return {workflow,step,attempt:previous,proposal};
    }

    const decision=OrchestrationPolicyEngine.evaluate(proposal,def);
    if(['DENIED','UNAVAILABLE'].includes(decision.outcome))throw new Error(`ORCHESTRATION_POLICY_DENIED: ${decision.reasonCode}`);
    if(def.requiresActiveHouseholdMembership)activeMembership(proposal.actorUserId,proposal.householdId);
    this.verifyConfirmation(proposal,def);
    if(!proposal.preview)throw new Error('ACTION_PREVIEW_REQUIRED');
    if(targetFingerprint(proposal)!==proposal.preview.targetStateFingerprint){
      proposal.status='STALE';proposal.updatedAt=nowIso();store.saveProposal(proposal);
      throw new Error('STALE_PREVIEW: target state changed since confirmation');
    }

    workflow.status='RUNNING';workflow.currentStep=step.sequence;workflow.updatedAt=nowIso();step.status='EXECUTING';step.startedAt=nowIso();
    proposal.status='EXECUTING';proposal.updatedAt=nowIso();store.saveWorkflow(workflow);store.saveStep(step);store.saveProposal(proposal);
    store.publish(OrchestrationEvents.workflowStarted(workflow));

    const startedAt=nowIso(),executionId=`exa-${generateUUIDv7()}` as ExecutionAttemptId;
    try{
      const domainResult=await OrchestrationDomainAdapter.execute(proposal);
      const attempt:ExecutionAttempt={
        executionAttemptId:executionId,actionProposalId:proposal.actionProposalId,workflowInstanceId:workflow.workflowInstanceId,
        workflowStepId:step.workflowStepId,idempotencyKey:`${workflow.workflowInstanceId}:${proposal.idempotencyKey}`,attemptNumber:1,
        classification:'SUCCESS',startedAt,completedAt:nowIso(),resultReference:domainResult.resultReference,resultSummary:domainResult.summary
      };
      store.saveAttempt(attempt);step.executionAttemptIds.push(executionId);step.status='SUCCEEDED';step.completedAt=attempt.completedAt;
      workflow.status='COMPLETED';workflow.updatedAt=attempt.completedAt;workflow.completedAt=attempt.completedAt;
      proposal.status='COMPLETED';proposal.updatedAt=attempt.completedAt;store.saveStep(step);store.saveWorkflow(workflow);store.saveProposal(proposal);
      this.consumeConfirmation(proposal);store.publish(OrchestrationEvents.actionExecuted(proposal,attempt));
      return {workflow,step,attempt,proposal,domainResult:domainResult.data};
    }catch(error:any){
      const message=error?.message||String(error);
      const classification=message.includes('AUTHORIZATION')?'AUTHORIZATION_FAILURE'
        : message.includes('STALE')?'STALE_PREVIEW'
        : message.includes('TARGET_CONFLICT')?'TARGET_CONFLICT'
        : message.includes('VALIDATION')?'VALIDATION_FAILURE':'PERMANENT_FAILURE';
      const attempt:ExecutionAttempt={
        executionAttemptId:executionId,actionProposalId:proposal.actionProposalId,workflowInstanceId:workflow.workflowInstanceId,
        workflowStepId:step.workflowStepId,idempotencyKey:`${workflow.workflowInstanceId}:${proposal.idempotencyKey}`,attemptNumber:1,
        classification,startedAt,completedAt:nowIso(),errorMessage:message
      };
      store.saveAttempt(attempt);step.executionAttemptIds.push(executionId);step.status='FAILED';step.failureReason=message;step.completedAt=attempt.completedAt;
      workflow.status='FAILED';workflow.updatedAt=attempt.completedAt;proposal.status='FAILED';proposal.updatedAt=attempt.completedAt;
      store.saveStep(step);store.saveWorkflow(workflow);store.saveProposal(proposal);throw error;
    }
  }

  static async executeProposal(proposalId:ActionProposalId):Promise<ExecuteActionResult>{
    const proposal=store.getProposal(proposalId);if(!proposal)throw new Error('ACTION_PROPOSAL_NOT_FOUND');
    if(new Date(proposal.expiresAt).getTime()<=Date.now())throw new Error('ACTION_PROPOSAL_EXPIRED');
    if(proposal.status==='COMPLETED'&&proposal.workflowInstanceId){
      const wf=store.getWorkflow(proposal.workflowInstanceId);const step=wf?store.listStepsForWorkflow(wf.workflowInstanceId)[0]:undefined;
      const attempt=step?.executionAttemptIds.length?store.getAttempt(step.executionAttemptIds[0]):undefined;
      if(wf&&step&&attempt)return {workflow:wf,step,attempt,proposal};
    }
    const {workflow,step}=this.createWorkflow(proposal);
    return this.executeStep(proposal,workflow,step);
  }

  static async executeComposite(proposalIds:ActionProposalId[]):Promise<WorkflowInstance>{
    if(proposalIds.length<2)throw new Error('COMPOSITE_WORKFLOW_REQUIRES_MULTIPLE_ACTIONS');
    const proposals=proposalIds.map(id=>store.getProposal(id));
    if(proposals.some(p=>!p))throw new Error('ACTION_PROPOSAL_NOT_FOUND');
    const typed=proposals as ActionProposal[];
    const first=typed[0];
    if(typed.some(p=>p.actorUserId!==first.actorUserId||p.householdId!==first.householdId))throw new Error('COMPOSITE_SCOPE_MISMATCH');

    const defId='wfdef-cross-domain-v1' as WorkflowDefinitionId;
    store.saveWorkflowDefinition({workflowDefinitionId:defId,code:'CROSS_DOMAIN',version:1,name:'Cross-domain Pet OS action workflow',description:'Ordered saga using public domain commands with compensation where truthful.',stepActionTypes:typed.map(p=>p.actionType),active:true});
    const workflow:WorkflowInstance={
      workflowInstanceId:`wfi-${generateUUIDv7()}` as WorkflowInstanceId,workflowDefinitionId:defId,actorUserId:first.actorUserId,
      householdId:first.householdId,petId:first.petId,status:'READY',currentStep:0,correlationId:`corr-${generateUUIDv7()}`,createdAt:nowIso(),updatedAt:nowIso()
    };
    store.saveWorkflow(workflow);
    const succeeded:Array<{proposal:ActionProposal;step:WorkflowStep;attempt:ExecutionAttempt}>=[];
    for(let i=0;i<typed.length;i++){
      let proposal=typed[i];proposal.workflowInstanceId=workflow.workflowInstanceId;store.saveProposal(proposal);
      const step:WorkflowStep={workflowStepId:`wfs-${generateUUIDv7()}` as WorkflowStepId,workflowInstanceId:workflow.workflowInstanceId,sequence:i+1,actionType:proposal.actionType,status:'READY',actionProposalId:proposal.actionProposalId,executionAttemptIds:[]};
      store.saveStep(step);
      try{
        const result=await this.executeStep(proposal,workflow,step);
        succeeded.push({proposal:result.proposal,step:result.step,attempt:result.attempt});
        workflow.status=i===typed.length-1?'COMPLETED':'RUNNING';workflow.currentStep=i+1;workflow.updatedAt=nowIso();store.saveWorkflow(workflow);
      }catch(error){
        workflow.status=succeeded.length?'PARTIALLY_COMPLETED':'FAILED';workflow.updatedAt=nowIso();store.saveWorkflow(workflow);
        if(succeeded.length)await this.compensateSucceededSteps(workflow,succeeded);
        throw error;
      }
    }
    workflow.status='COMPLETED';workflow.completedAt=nowIso();workflow.updatedAt=workflow.completedAt;store.saveWorkflow(workflow);return workflow;
  }

  private static async compensateSucceededSteps(workflow:WorkflowInstance,items:Array<{proposal:ActionProposal;step:WorkflowStep;attempt:ExecutionAttempt}>):Promise<void>{
    workflow.status='COMPENSATING';workflow.updatedAt=nowIso();store.saveWorkflow(workflow);
    for(const item of [...items].reverse()){
      const def=getDefinition(item.proposal.actionType);
      const rec:CompensationRecord={
        compensationRecordId:`cmp-${generateUUIDv7()}` as CompensationRecordId,workflowInstanceId:workflow.workflowInstanceId,
        workflowStepId:item.step.workflowStepId,capability:def.compensationCapability,status:'PENDING',
        description:'Compensation initiated after downstream workflow failure.',attemptedAt:nowIso()
      };
      try{
        if(def.compensationCapability==='TARGET_DOMAIN_REVERSAL'&&item.attempt.resultReference){
          if(item.proposal.actionType==='CARE_CREATE_OWNER_TASK'){
            CareService.cancelObligation(item.proposal.actorUserId,asCareObligationId(item.attempt.resultReference),'Compensated after downstream orchestration failure');
          }else if(item.proposal.actionType==='BOOKING_CREATE_SERVICE_REQUEST'){
            const bookingService=new BookingPlatformService(BookingStore.getInstance(),ProviderStore.getInstance());
            bookingService.cancelBookingByOwner({bookingId:asBookingId(item.attempt.resultReference),ownerUserId:item.proposal.actorUserId,reason:'Compensated after downstream orchestration failure'});
          }else if(item.proposal.actionType==='TRACKING_REQUEST_LOST_MODE'){
            await TrackingService.getInstance().requestTrackingMode(item.attempt.resultReference as any,'NORMAL',item.proposal.actorUserId);
          }else{
            rec.status='MANUAL_REVIEW_REQUIRED';rec.description='No truthful automatic reversal is defined for this real-world effect.';
          }
          if(rec.status==='PENDING')rec.status='SUCCEEDED';
        }else if(def.compensationCapability==='NONE'){
          rec.status='NOT_REQUIRED';
        }else{
          rec.status='MANUAL_REVIEW_REQUIRED';
        }
      }catch(e:any){
        rec.status='FAILED';rec.description=e?.message||String(e);
        this.openIncident('HIGH','COMPENSATION_FAILURE',rec.description,item.proposal.actionProposalId,workflow.workflowInstanceId);
      }
      rec.completedAt=nowIso();store.saveCompensation(rec);
      item.step.compensationRecordId=rec.compensationRecordId;
      item.step.status=rec.status==='SUCCEEDED'?'COMPENSATED':rec.status==='FAILED'?'COMPENSATION_FAILED':item.step.status;
      store.saveStep(item.step);
    }
    workflow.status='PARTIALLY_COMPLETED';workflow.updatedAt=nowIso();store.saveWorkflow(workflow);
  }

  static createRule(input:{ownerUserId:any;householdId:any;name:string;description:string;triggerType:TriggerType;triggerConfig:Record<string,unknown>;conditionExpression?:string;actionType:ActionType;actionPayloadTemplate:Record<string,unknown>;maxExecutionsPerDay?:number}):AutomationRule{
    activeMembership(input.ownerUserId,input.householdId);
    const def=getDefinition(input.actionType);
    if(!def.mayRunFromAutomationRule)throw new Error('AUTOMATION_RULE_ACTION_FORBIDDEN');
    if((input.conditionExpression||'').includes('eval(')||(input.conditionExpression||'').includes('SELECT '))throw new Error('UNSAFE_AUTOMATION_CONDITION');
    const now=nowIso(),ruleId=`ar-${generateUUIDv7()}` as AutomationRuleId,versionId=`arv-${generateUUIDv7()}` as AutomationRuleVersionId;
    const version:AutomationRuleVersion={
      automationRuleVersionId:versionId,automationRuleId:ruleId,version:1,triggerType:input.triggerType,triggerConfig:{...input.triggerConfig},
      conditionExpression:input.conditionExpression||'true',actionType:input.actionType,actionPayloadTemplate:{...input.actionPayloadTemplate},
      requiresConfirmationEveryRun:def.confirmationLevel!=='NONE',maxExecutionsPerDay:Math.max(1,Math.min(input.maxExecutionsPerDay||10,50)),createdAt:now
    };
    const rule:AutomationRule={automationRuleId:ruleId,activeVersionId:versionId,ownerUserId:input.ownerUserId,householdId:input.householdId,name:input.name,description:input.description,status:'ACTIVE',createdAt:now,updatedAt:now};
    store.saveRuleVersion(version);store.saveRule(rule);return rule;
  }

  static async triggerRule(ruleId:AutomationRuleId,triggerEventId:string,payloadOverrides:Record<string,unknown>={}):Promise<ActionProposal>{
    const rule=store.getRule(ruleId);if(!rule||rule.status!=='ACTIVE')throw new Error('AUTOMATION_RULE_NOT_ACTIVE');
    activeMembership(rule.ownerUserId,rule.householdId);
    const version=store.getRuleVersion(rule.activeVersionId);if(!version)throw new Error('AUTOMATION_RULE_VERSION_NOT_FOUND');
    const today=nowIso().slice(0,10);
    const executions=store.listProposals().filter(p=>p.origin==='AUTOMATION_RULE'&&p.originReferenceId===String(version.automationRuleVersionId)&&p.createdAt.startsWith(today)).length;
    if(executions>=version.maxExecutionsPerDay)throw new Error('AUTOMATION_RULE_DAILY_LIMIT_REACHED');
    const proposal=this.propose({
      actionType:version.actionType,actorUserId:rule.ownerUserId,householdId:rule.householdId,
      petId:(payloadOverrides.petId||version.actionPayloadTemplate.petId) as any,origin:'AUTOMATION_RULE',
      originReferenceId:String(version.automationRuleVersionId),payload:{...version.actionPayloadTemplate,...payloadOverrides},
      idempotencyKey:`rule:${version.automationRuleVersionId}:${triggerEventId}`
    });
    if(getDefinition(proposal.actionType).confirmationLevel==='NONE')await this.executeProposal(proposal.actionProposalId);
    return store.getProposal(proposal.actionProposalId)!;
  }

  static scheduleLowRisk(proposalId:ActionProposalId,executeAt:string,timezone='Africa/Nairobi'):ScheduledAction{
    const proposal=store.getProposal(proposalId);if(!proposal)throw new Error('ACTION_PROPOSAL_NOT_FOUND');
    const def=getDefinition(proposal.actionType);
    if(def.confirmationLevel!=='NONE'||['FINANCIAL','CLINICAL','SAFETY_CRITICAL','IRREVERSIBLE'].includes(def.risk))throw new Error('SCHEDULED_ACTION_REQUIRES_INTERACTIVE_CONFIRMATION');
    const schedule:ScheduledAction={scheduledActionId:`sa-${generateUUIDv7()}` as ScheduledActionId,actionProposalId:proposalId,executeAt,timezone,status:'SCHEDULED',missedRunPolicy:'RUN_ONCE_IF_STILL_VALID',createdAt:nowIso(),updatedAt:nowIso()};
    store.saveSchedule(schedule);return schedule;
  }

  static async processSchedules(at=new Date()):Promise<{executed:number;failed:number}>{
    let executed=0,failed=0;
    for(const s of store.listSchedules().filter(x=>x.status==='SCHEDULED'&&new Date(x.executeAt).getTime()<=at.getTime())){
      try{
        await this.executeProposal(s.actionProposalId);s.status='EXECUTED';executed++;
      }catch{ s.status='FAILED';failed++; }
      s.updatedAt=nowIso();store.saveSchedule(s);
    }
    return {executed,failed};
  }

  static openIncident(severity:OrchestrationIncident['severity'],category:OrchestrationIncident['category'],summary:string,proposalId?:ActionProposalId,workflowId?:WorkflowInstanceId):OrchestrationIncident{
    const now=nowIso();const incident:OrchestrationIncident={orchestrationIncidentId:`oi-${generateUUIDv7()}` as OrchestrationIncidentId,severity,category,actionProposalId:proposalId,workflowInstanceId:workflowId,summary,status:'OPEN',createdAt:now,updatedAt:now};
    store.saveIncident(incident);return incident;
  }

  static getPolicyVersion(){return ORCHESTRATION_POLICY_VERSION;}
}
