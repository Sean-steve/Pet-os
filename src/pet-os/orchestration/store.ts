import {
  ActionDefinitionId, ActionProposalId, ActionConfirmationId, ApprovalRequestId,
  WorkflowDefinitionId, WorkflowInstanceId, WorkflowStepId, AutomationRuleId,
  AutomationRuleVersionId, ScheduledActionId, ExecutionAttemptId, CompensationRecordId,
  AutomationPolicyDecisionId, OrchestrationIncidentId,
} from '../kernel/ids';
import {
  ActionDefinition, ActionProposal, ActionConfirmation, ApprovalRequest,
  WorkflowDefinition, WorkflowInstance, WorkflowStep, AutomationRule,
  AutomationRuleVersion, ScheduledAction, ExecutionAttempt, CompensationRecord,
  AutomationPolicyDecision, OrchestrationIncident
} from './types';
import type { OrchestrationEvent } from './events';

export class OrchestrationStore {
  private static instance:OrchestrationStore;

  private actionDefinitions=new Map<ActionDefinitionId,ActionDefinition>();
  private actionByType=new Map<string,ActionDefinitionId>();
  private proposals=new Map<ActionProposalId,ActionProposal>();
  private proposalByIdempotency=new Map<string,ActionProposalId>();
  private confirmations=new Map<ActionConfirmationId,ActionConfirmation>();
  private approvals=new Map<ApprovalRequestId,ApprovalRequest>();
  private workflowDefinitions=new Map<WorkflowDefinitionId,WorkflowDefinition>();
  private workflows=new Map<WorkflowInstanceId,WorkflowInstance>();
  private steps=new Map<WorkflowStepId,WorkflowStep>();
  private attempts=new Map<ExecutionAttemptId,ExecutionAttempt>();
  private attemptByIdempotency=new Map<string,ExecutionAttemptId>();
  private compensations=new Map<CompensationRecordId,CompensationRecord>();
  private rules=new Map<AutomationRuleId,AutomationRule>();
  private ruleVersions=new Map<AutomationRuleVersionId,AutomationRuleVersion>();
  private schedules=new Map<ScheduledActionId,ScheduledAction>();
  private policyDecisions=new Map<AutomationPolicyDecisionId,AutomationPolicyDecision>();
  private incidents=new Map<OrchestrationIncidentId,OrchestrationIncident>();
  private events:OrchestrationEvent[]=[];

  private constructor(){}
  static getInstance():OrchestrationStore{
    if(!this.instance)this.instance=new OrchestrationStore();
    return this.instance;
  }
  reset():void{
    this.actionDefinitions.clear();this.actionByType.clear();this.proposals.clear();this.proposalByIdempotency.clear();
    this.confirmations.clear();this.approvals.clear();this.workflowDefinitions.clear();this.workflows.clear();this.steps.clear();
    this.attempts.clear();this.attemptByIdempotency.clear();this.compensations.clear();this.rules.clear();this.ruleVersions.clear();
    this.schedules.clear();this.policyDecisions.clear();this.incidents.clear();this.events=[];
  }

  saveActionDefinition(v:ActionDefinition){this.actionDefinitions.set(v.actionDefinitionId,{...v});this.actionByType.set(v.actionType,v.actionDefinitionId);}
  getActionDefinitionByType(type:string){const id=this.actionByType.get(type);const v=id?this.actionDefinitions.get(id):undefined;return v?{...v}:undefined;}
  listActionDefinitions(){return Array.from(this.actionDefinitions.values()).map(v=>({...v}));}

  saveProposal(v:ActionProposal){this.proposals.set(v.actionProposalId,{...v,payload:{...v.payload},target:{...v.target}});this.proposalByIdempotency.set(v.idempotencyKey,v.actionProposalId);}
  getProposal(id:ActionProposalId){const v=this.proposals.get(id);return v?{...v,payload:{...v.payload},target:{...v.target},preview:v.preview?{...v.preview,effects:[...v.preview.effects],dataShared:[...v.preview.dataShared],warnings:[...v.preview.warnings],irreversibleEffects:[...v.preview.irreversibleEffects]}:undefined}:undefined;}
  getProposalByIdempotency(key:string){const id=this.proposalByIdempotency.get(key);return id?this.getProposal(id):undefined;}
  listProposals(){return Array.from(this.proposals.keys()).map(id=>this.getProposal(id)!).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}

  saveConfirmation(v:ActionConfirmation){this.confirmations.set(v.actionConfirmationId,{...v});}
  getConfirmation(id:ActionConfirmationId){const v=this.confirmations.get(id);return v?{...v}:undefined;}

  saveApproval(v:ApprovalRequest){this.approvals.set(v.approvalRequestId,{...v,requestedFromUserIds:[...v.requestedFromUserIds]});}
  getApproval(id:ApprovalRequestId){const v=this.approvals.get(id);return v?{...v,requestedFromUserIds:[...v.requestedFromUserIds]}:undefined;}
  listApprovals(){return Array.from(this.approvals.values()).map(v=>({...v,requestedFromUserIds:[...v.requestedFromUserIds]}));}

  saveWorkflowDefinition(v:WorkflowDefinition){this.workflowDefinitions.set(v.workflowDefinitionId,{...v,stepActionTypes:[...v.stepActionTypes]});}
  getWorkflowDefinition(id:WorkflowDefinitionId){const v=this.workflowDefinitions.get(id);return v?{...v,stepActionTypes:[...v.stepActionTypes]}:undefined;}
  listWorkflowDefinitions(){return Array.from(this.workflowDefinitions.values()).map(v=>({...v,stepActionTypes:[...v.stepActionTypes]}));}

  saveWorkflow(v:WorkflowInstance){this.workflows.set(v.workflowInstanceId,{...v});}
  getWorkflow(id:WorkflowInstanceId){const v=this.workflows.get(id);return v?{...v}:undefined;}
  listWorkflows(){return Array.from(this.workflows.values()).map(v=>({...v})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}

  saveStep(v:WorkflowStep){this.steps.set(v.workflowStepId,{...v,executionAttemptIds:[...v.executionAttemptIds]});}
  getStep(id:WorkflowStepId){const v=this.steps.get(id);return v?{...v,executionAttemptIds:[...v.executionAttemptIds]}:undefined;}
  listStepsForWorkflow(id:WorkflowInstanceId){return Array.from(this.steps.values()).filter(v=>v.workflowInstanceId===id).sort((a,b)=>a.sequence-b.sequence).map(v=>({...v,executionAttemptIds:[...v.executionAttemptIds]}));}

  saveAttempt(v:ExecutionAttempt){this.attempts.set(v.executionAttemptId,{...v});this.attemptByIdempotency.set(v.idempotencyKey,v.executionAttemptId);}
  getAttempt(id:ExecutionAttemptId){const v=this.attempts.get(id);return v?{...v}:undefined;}
  getAttemptByIdempotency(key:string){const id=this.attemptByIdempotency.get(key);return id?this.getAttempt(id):undefined;}
  listAttempts(){return Array.from(this.attempts.values()).map(v=>({...v}));}

  saveCompensation(v:CompensationRecord){this.compensations.set(v.compensationRecordId,{...v});}
  listCompensations(){return Array.from(this.compensations.values()).map(v=>({...v}));}

  saveRule(v:AutomationRule){this.rules.set(v.automationRuleId,{...v});}
  getRule(id:AutomationRuleId){const v=this.rules.get(id);return v?{...v}:undefined;}
  listRules(){return Array.from(this.rules.values()).map(v=>({...v}));}
  saveRuleVersion(v:AutomationRuleVersion){this.ruleVersions.set(v.automationRuleVersionId,{...v,triggerConfig:{...v.triggerConfig},actionPayloadTemplate:{...v.actionPayloadTemplate}});}
  getRuleVersion(id:AutomationRuleVersionId){const v=this.ruleVersions.get(id);return v?{...v,triggerConfig:{...v.triggerConfig},actionPayloadTemplate:{...v.actionPayloadTemplate}}:undefined;}

  saveSchedule(v:ScheduledAction){this.schedules.set(v.scheduledActionId,{...v});}
  listSchedules(){return Array.from(this.schedules.values()).map(v=>({...v}));}

  savePolicyDecision(v:AutomationPolicyDecision){this.policyDecisions.set(v.policyDecisionId,{...v});}
  getPolicyDecision(id:AutomationPolicyDecisionId){const v=this.policyDecisions.get(id);return v?{...v}:undefined;}
  listPolicyDecisions(){return Array.from(this.policyDecisions.values()).map(v=>({...v}));}

  saveIncident(v:OrchestrationIncident){this.incidents.set(v.orchestrationIncidentId,{...v});}
  listIncidents(){return Array.from(this.incidents.values()).map(v=>({...v}));}

  publish(e:OrchestrationEvent){this.events.push(e);}
  listEvents(){return [...this.events];}
}
