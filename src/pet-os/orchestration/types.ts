/**
 * Pet OS Sprint 29 — Cross-Domain Automation & Action Orchestration
 *
 * This bounded context coordinates commands but never becomes canonical truth
 * for target domains. Domain services remain authoritative.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  DeviceId,
  LostPetIncidentId,
  CareOccurrenceId,
  ActionDefinitionId,
  ActionProposalId,
  ActionConfirmationId,
  ApprovalRequestId,
  WorkflowDefinitionId,
  WorkflowInstanceId,
  WorkflowStepId,
  AutomationRuleId,
  AutomationRuleVersionId,
  ScheduledActionId,
  ExecutionAttemptId,
  CompensationRecordId,
  AutomationPolicyDecisionId,
  OrchestrationIncidentId,
  AIRequestId,
  RecommendationId,
} from '../kernel/ids';

export type ActionRisk =
  | 'READ_ONLY'
  | 'REVERSIBLE_LOW_RISK'
  | 'SENSITIVE'
  | 'FINANCIAL'
  | 'CLINICAL'
  | 'SAFETY_CRITICAL'
  | 'IRREVERSIBLE';

export type ConfirmationLevel =
  | 'NONE'
  | 'STANDARD'
  | 'STRONG_REAUTH'
  | 'MULTI_PARTY';

export type ActionOrigin =
  | 'USER_UI'
  | 'AI_PROPOSAL'
  | 'AUTOMATION_RULE'
  | 'DOMAIN_EVENT'
  | 'SYSTEM';

export type OrchestrationDomain =
  | 'CARE'
  | 'NOTIFICATIONS'
  | 'BOOKING'
  | 'TRACKING'
  | 'LOST_PET'
  | 'COMMUNITY'
  | 'HEALTH'
  | 'FINANCE'
  | 'COMMERCE'
  | 'IDENTITY'
  | 'PLATFORM';

export type ActionType =
  | 'CARE_CREATE_OWNER_TASK'
  | 'CARE_SNOOZE_OCCURRENCE'
  | 'CARE_COMPLETE_OCCURRENCE'
  | 'NOTIFICATION_SCHEDULE_SELF'
  | 'BOOKING_CREATE_SERVICE_REQUEST'
  | 'LOST_PET_ACTIVATE_COMMUNITY_ALERT'
  | 'TRACKING_REQUEST_LOST_MODE'
  | 'OPEN_DOMAIN_WORKSPACE';

export type PolicyOutcome =
  | 'ALLOWED'
  | 'DENIED'
  | 'REQUIRES_CONFIRMATION'
  | 'REQUIRES_REAUTH'
  | 'REQUIRES_APPROVAL'
  | 'UNAVAILABLE';

export type ProposalStatus =
  | 'DRAFT'
  | 'READY_FOR_PREVIEW'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_APPROVAL'
  | 'CONFIRMED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'STALE';

export type WorkflowStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'AWAITING_CONFIRMATION'
  | 'AWAITING_APPROVAL'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_EXTERNAL'
  | 'COMPENSATING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type WorkflowStepStatus =
  | 'PENDING'
  | 'READY'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'COMPENSATED'
  | 'COMPENSATION_FAILED'
  | 'BLOCKED';

export type AutomationRuleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ERROR'
  | 'DISABLED'
  | 'ARCHIVED';

export type TriggerType =
  | 'DOMAIN_EVENT'
  | 'SCHEDULE'
  | 'CONDITION'
  | 'MANUAL'
  | 'AI_RECOMMENDATION';

export type ExecutionClassification =
  | 'SUCCESS'
  | 'VALIDATION_FAILURE'
  | 'AUTHORIZATION_FAILURE'
  | 'STALE_PREVIEW'
  | 'CONFIRMATION_EXPIRED'
  | 'TARGET_CONFLICT'
  | 'DEPENDENCY_RETRYABLE'
  | 'PERMANENT_FAILURE'
  | 'PARTIAL_FAILURE'
  | 'POLICY_BLOCKED';

export type CompensationCapability =
  | 'NONE'
  | 'SEMANTIC_COMPENSATION'
  | 'TARGET_DOMAIN_REVERSAL'
  | 'MANUAL_REVIEW';

export interface ActionDefinition {
  actionDefinitionId: ActionDefinitionId;
  actionType: ActionType;
  version: number;
  title: string;
  description: string;
  owningDomain: OrchestrationDomain;
  commandSchema: string;
  risk: ActionRisk;
  confirmationLevel: ConfirmationLevel;
  compensationCapability: CompensationCapability;
  idempotencyRequired: boolean;
  allowedOrigins: ActionOrigin[];
  requiresActiveHouseholdMembership: boolean;
  mayRunFromAutomationRule: boolean;
  publicDisclosure: boolean;
  moneyMovement: boolean;
  clinicalMutation: boolean;
  exactLocationDisclosure: boolean;
  enabled: boolean;
}

export interface ActionTargetRef {
  householdId: HouseholdId;
  petId?: PetId;
  resourceType?: string;
  resourceId?: string;
}

export interface ActionPreview {
  actionType: ActionType;
  actionVersion: number;
  title: string;
  summary: string;
  target: ActionTargetRef;
  effects: string[];
  dataShared: string[];
  warnings: string[];
  irreversibleEffects: string[];
  money?: { currency: string; amountMinor: number };
  privacyImpact: 'NONE' | 'LOW' | 'SENSITIVE' | 'PUBLIC';
  generatedAt: string;
  expiresAt: string;
  previewHash: string;
}

export interface AutomationPolicyDecision {
  policyDecisionId: AutomationPolicyDecisionId;
  actionType: ActionType;
  actionRisk: ActionRisk;
  outcome: PolicyOutcome;
  reasonCode: string;
  reason: string;
  confirmationLevel: ConfirmationLevel;
  evaluatedAt: string;
}

export interface ActionProposal {
  actionProposalId: ActionProposalId;
  actionType: ActionType;
  actionVersion: number;
  actorUserId: UserId;
  householdId: HouseholdId;
  petId?: PetId;
  origin: ActionOrigin;
  originReferenceId?: string;
  aiRequestId?: AIRequestId;
  recommendationId?: RecommendationId;
  payload: Record<string, unknown>;
  target: ActionTargetRef;
  status: ProposalStatus;
  preview?: ActionPreview;
  policyDecisionId?: AutomationPolicyDecisionId;
  confirmationId?: ActionConfirmationId;
  workflowInstanceId?: WorkflowInstanceId;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface ActionConfirmation {
  actionConfirmationId: ActionConfirmationId;
  actionProposalId: ActionProposalId;
  actorUserId: UserId;
  proposalVersion: number;
  previewHash: string;
  confirmationLevel: ConfirmationLevel;
  confirmationBinding: string;
  oneTimeUse: boolean;
  usedAt?: string;
  confirmedAt: string;
  expiresAt: string;
}

export interface ApprovalRequest {
  approvalRequestId: ApprovalRequestId;
  actionProposalId: ActionProposalId;
  requestedFromUserIds: UserId[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  reason: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: UserId;
  decisionNote?: string;
}

export interface WorkflowDefinition {
  workflowDefinitionId: WorkflowDefinitionId;
  code: string;
  version: number;
  name: string;
  description: string;
  stepActionTypes: ActionType[];
  active: boolean;
}

export interface WorkflowStep {
  workflowStepId: WorkflowStepId;
  workflowInstanceId: WorkflowInstanceId;
  sequence: number;
  actionType: ActionType;
  status: WorkflowStepStatus;
  actionProposalId: ActionProposalId;
  executionAttemptIds: ExecutionAttemptId[];
  compensationRecordId?: CompensationRecordId;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
}

export interface WorkflowInstance {
  workflowInstanceId: WorkflowInstanceId;
  workflowDefinitionId: WorkflowDefinitionId;
  actorUserId: UserId;
  householdId: HouseholdId;
  petId?: PetId;
  status: WorkflowStatus;
  currentStep: number;
  correlationId: string;
  causationId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ExecutionAttempt {
  executionAttemptId: ExecutionAttemptId;
  actionProposalId: ActionProposalId;
  workflowInstanceId: WorkflowInstanceId;
  workflowStepId: WorkflowStepId;
  idempotencyKey: string;
  attemptNumber: number;
  classification: ExecutionClassification;
  startedAt: string;
  completedAt: string;
  resultReference?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface CompensationRecord {
  compensationRecordId: CompensationRecordId;
  workflowInstanceId: WorkflowInstanceId;
  workflowStepId: WorkflowStepId;
  capability: CompensationCapability;
  status: 'NOT_REQUIRED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'MANUAL_REVIEW_REQUIRED';
  description: string;
  attemptedAt?: string;
  completedAt?: string;
}

export interface AutomationRule {
  automationRuleId: AutomationRuleId;
  activeVersionId: AutomationRuleVersionId;
  ownerUserId: UserId;
  householdId: HouseholdId;
  name: string;
  description: string;
  status: AutomationRuleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRuleVersion {
  automationRuleVersionId: AutomationRuleVersionId;
  automationRuleId: AutomationRuleId;
  version: number;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  conditionExpression: string;
  actionType: ActionType;
  actionPayloadTemplate: Record<string, unknown>;
  requiresConfirmationEveryRun: boolean;
  maxExecutionsPerDay: number;
  createdAt: string;
}

export interface ScheduledAction {
  scheduledActionId: ScheduledActionId;
  actionProposalId: ActionProposalId;
  executeAt: string;
  timezone: string;
  status: 'SCHEDULED' | 'READY' | 'EXECUTED' | 'MISSED' | 'CANCELLED' | 'FAILED';
  missedRunPolicy: 'SKIP' | 'RUN_ONCE_IF_STILL_VALID';
  createdAt: string;
  updatedAt: string;
}

export interface OrchestrationIncident {
  orchestrationIncidentId: OrchestrationIncidentId;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category:
    | 'POLICY_BYPASS_ATTEMPT'
    | 'CONFIRMATION_REPLAY'
    | 'CROSS_TENANT_ATTEMPT'
    | 'WORKFLOW_STUCK'
    | 'COMPENSATION_FAILURE'
    | 'ACTION_LOOP'
    | 'UNAUTHORIZED_TARGET_MUTATION'
    | 'OTHER';
  actionProposalId?: ActionProposalId;
  workflowInstanceId?: WorkflowInstanceId;
  summary: string;
  status: 'OPEN' | 'TRIAGED' | 'MITIGATING' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface ProposeActionInput {
  actionType: ActionType;
  actorUserId: UserId;
  householdId: HouseholdId;
  petId?: PetId;
  origin: ActionOrigin;
  originReferenceId?: string;
  aiRequestId?: AIRequestId;
  recommendationId?: RecommendationId;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ExecuteActionResult {
  workflow: WorkflowInstance;
  step: WorkflowStep;
  attempt: ExecutionAttempt;
  proposal: ActionProposal;
  domainResult?: unknown;
}

export interface CareCreateOwnerTaskPayload {
  petId: PetId;
  title: string;
  description?: string;
  dueAt: string;
  category?: 'GENERAL_CARE' | 'GROOMING' | 'WEIGHT_CHECK';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CareSnoozePayload {
  occurrenceId: CareOccurrenceId;
  snoozedUntil: string;
  reason?: string;
}

export interface CareCompletePayload {
  occurrenceId: CareOccurrenceId;
  completionNotes?: string;
}

export interface NotificationSelfPayload {
  title: string;
  body: string;
  petId?: PetId;
  scheduledAt?: string;
}

export interface BookingCreatePayload {
  providerId: string;
  serviceOfferingId: string;
  petIds: PetId[];
  startAt: string;
  endAt: string;
  timezone?: string;
  note?: string;
}

export interface LostPetCommunityAlertPayload {
  lostPetIncidentId: LostPetIncidentId;
}

export interface TrackingLostModePayload {
  petId: PetId;
  deviceId?: DeviceId;
}

export interface OpenWorkspacePayload {
  module: string;
}
