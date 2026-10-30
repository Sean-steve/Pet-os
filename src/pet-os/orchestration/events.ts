import { createEventEnvelope, EventEnvelope } from '../kernel/events';
import { ActionProposal, WorkflowInstance, ExecutionAttempt, ApprovalRequest } from './types';

export type OrchestrationEvent = EventEnvelope<Record<string, unknown>>;

export const OrchestrationEvents = {
  proposalCreated(p: ActionProposal): OrchestrationEvent {
    return createEventEnvelope(
      'ActionProposalCreated',
      'ActionProposal',
      p.actionProposalId,
      { actionProposalId:p.actionProposalId, actionType:p.actionType, origin:p.origin, riskContext:'POLICY_EVALUATED_SEPARATELY' },
      1,
      undefined,
      p.actorUserId,
      p.householdId
    );
  },
  proposalConfirmed(p: ActionProposal): OrchestrationEvent {
    return createEventEnvelope(
      'ActionProposalConfirmed','ActionProposal',p.actionProposalId,
      { actionProposalId:p.actionProposalId, actionType:p.actionType },1,undefined,p.actorUserId,p.householdId
    );
  },
  workflowStarted(w: WorkflowInstance): OrchestrationEvent {
    return createEventEnvelope(
      'OrchestrationWorkflowStarted','WorkflowInstance',w.workflowInstanceId,
      { workflowInstanceId:w.workflowInstanceId, correlationId:w.correlationId },1,undefined,w.actorUserId,w.householdId
    );
  },
  actionExecuted(p: ActionProposal,a:ExecutionAttempt): OrchestrationEvent {
    return createEventEnvelope(
      'OrchestratedActionExecuted','ActionProposal',p.actionProposalId,
      { actionProposalId:p.actionProposalId, actionType:p.actionType, classification:a.classification, resultReference:a.resultReference },
      1,undefined,p.actorUserId,p.householdId
    );
  },
  approvalRequested(a:ApprovalRequest,proposal:ActionProposal):OrchestrationEvent {
    return createEventEnvelope(
      'OrchestrationApprovalRequested','ApprovalRequest',a.approvalRequestId,
      { approvalRequestId:a.approvalRequestId, actionProposalId:proposal.actionProposalId, actionType:proposal.actionType },
      1,undefined,proposal.actorUserId,proposal.householdId
    );
  }
};
