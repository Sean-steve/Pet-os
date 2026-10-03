/**
 * Pet OS Sprint 28 - Pet Intelligence & AI Platform
 * Governed AI types. AI output is never canonical Pet truth.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  ProviderId,
  RecommendationId,
  AIModelDefinitionId,
  AIModelDeploymentId,
  AIPromptTemplateId,
  AIPromptVersionId,
  AIConversationId,
  AIMessageId,
  AIRequestId,
  AIResponseId,
  AIContextAssemblyId,
  AISafetyDecisionId,
  AIConsentId,
  AIEvaluationCaseId,
  AIEvaluationRunId,
  AIIncidentId,
} from '../kernel/ids';

export type AIRiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type AISensitivityClass = 'GENERAL' | 'PET_PROFILE' | 'HEALTH' | 'LOCATION' | 'PROFESSIONAL';
export type AIUseCase =
  | 'PET_ASSISTANT'
  | 'PET_SUMMARY'
  | 'DAILY_INSIGHT'
  | 'HEALTH_SUMMARY'
  | 'MEDICATION_EXPLANATION'
  | 'TRAINING_GUIDANCE'
  | 'NUTRITION_INFORMATION'
  | 'ACTIVITY_INSIGHT'
  | 'LOST_PET_ASSISTANT'
  | 'TRACKER_TROUBLESHOOTING'
  | 'PROFESSIONAL_DRAFT'
  | 'PRODUCT_INFORMATION';

export type AIModelStatus = 'CANDIDATE' | 'APPROVED' | 'LIMITED' | 'ACTIVE' | 'DEPRECATED' | 'SUSPENDED' | 'RETIRED';
export type AIPromptStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED';
export type AIRequestStatus = 'CREATED' | 'CONTEXT_ASSEMBLING' | 'SAFETY_CHECK' | 'READY' | 'INFERENCE' | 'POST_PROCESSING' | 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'CANCELLED';
export type AISafetyAction = 'ALLOW' | 'ALLOW_WITH_WARNING' | 'LIMIT_RESPONSE' | 'REFUSE_UNSAFE_INSTRUCTION' | 'ESCALATE_VET' | 'EMERGENCY_ESCALATION';
export type RecommendationStatus = 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'SNOOZED' | 'EXPIRED' | 'SUPERSEDED' | 'WITHDRAWN';
export type RecommendationCategory =
  | 'CARE_TASK'
  | 'PREVENTIVE_CARE'
  | 'TRAINING'
  | 'ACTIVITY'
  | 'NUTRITION_INFORMATION'
  | 'VET_FOLLOW_UP'
  | 'RECORD_COMPLETION'
  | 'TRACKER_MAINTENANCE'
  | 'SAFETY'
  | 'SERVICE_SUGGESTION'
  | 'PRODUCT_INFORMATION';

export type AIConsentScope =
  | 'GENERAL_AI_ASSISTANCE'
  | 'PET_DATA_AI_CONTEXT'
  | 'HEALTH_DATA_AI_CONTEXT'
  | 'LOCATION_AI_CONTEXT'
  | 'PROFESSIONAL_AI_CONTEXT'
  | 'MODEL_PROVIDER_PROCESSING';

export interface AIModelDefinition {
  modelDefinitionId: AIModelDefinitionId;
  provider: string;
  providerModelName: string;
  internalAlias: string;
  modelFamily: string;
  capabilities: Array<'GENERATE' | 'STRUCTURED_OUTPUT' | 'TOOL_USE' | 'EMBEDDINGS' | 'MODERATION'>;
  approvedUseCases: AIUseCase[];
  prohibitedUseCases: AIUseCase[];
  safetyClass: 'GENERAL' | 'HIGH_ASSURANCE';
  status: AIModelStatus;
  createdAt: string;
}

export interface AIModelDeployment {
  modelDeploymentId: AIModelDeploymentId;
  modelDefinitionId: AIModelDefinitionId;
  region: string;
  dataPolicyProfile: string;
  allowedSensitivities: AISensitivityClass[];
  allowedRiskClasses: AIRiskClass[];
  routingWeight: number;
  status: AIModelStatus;
  enabledAt?: string;
}

export interface AIPromptTemplate {
  promptTemplateId: AIPromptTemplateId;
  useCase: AIUseCase;
  riskClass: AIRiskClass;
  description: string;
  owner: string;
  status: AIPromptStatus;
}

export interface AIPromptVersion {
  promptVersionId: AIPromptVersionId;
  promptTemplateId: AIPromptTemplateId;
  version: number;
  systemInstruction: string;
  outputSchema: string;
  safetyRules: string[];
  compatibleModelAliases: string[];
  approvalStatus: AIPromptStatus;
  createdAt: string;
  approvedAt?: string;
}

export interface AIConsent {
  consentId: AIConsentId;
  userId: UserId;
  householdId: HouseholdId;
  scopes: AIConsentScope[];
  policyVersion: string;
  grantedAt: string;
  withdrawnScopes: AIConsentScope[];
  withdrawnAt?: string;
}

export interface AIContextSourceRef {
  sourceDomain: 'PET_CORE' | 'HEALTH' | 'CARE' | 'NUTRITION' | 'TRAINING' | 'ACTIVITY' | 'TRACKING' | 'LOST_PET' | 'PROFESSIONAL' | 'COMMERCE' | 'COMMUNITY';
  sourceRecordId: string;
  recordType: string;
  summary: string;
  recordedAt?: string;
  provenance: string;
  sensitivity: AISensitivityClass;
  freshness: 'CURRENT' | 'RECENT' | 'STALE' | 'HISTORICAL' | 'UNKNOWN';
}

export interface PetContextBundle {
  contextAssemblyId: AIContextAssemblyId;
  userId: UserId;
  householdId: HouseholdId;
  petId: PetId;
  useCase: AIUseCase;
  sensitivityClasses: AISensitivityClass[];
  sourceRefs: AIContextSourceRef[];
  assembledAt: string;
  contextVersion: string;
}

export interface AISafetyDecision {
  safetyDecisionId: AISafetyDecisionId;
  requestId: AIRequestId;
  riskClass: AIRiskClass;
  policyVersion: string;
  detectedCategories: string[];
  action: AISafetyAction;
  warning?: string;
  createdAt: string;
}

export interface AIRequest {
  requestId: AIRequestId;
  userId: UserId;
  householdId: HouseholdId;
  petId: PetId;
  conversationId?: AIConversationId;
  useCase: AIUseCase;
  riskClass: AIRiskClass;
  promptVersionId: AIPromptVersionId;
  modelDeploymentId?: AIModelDeploymentId;
  contextAssemblyId?: AIContextAssemblyId;
  status: AIRequestStatus;
  userText: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIResponse {
  responseId: AIResponseId;
  requestId: AIRequestId;
  modelDeploymentId?: AIModelDeploymentId;
  content: string;
  safetyDecisionId: AISafetyDecisionId;
  provenanceRefs: AIContextSourceRef[];
  supportLevel: 'HIGH_SUPPORT' | 'MODERATE_SUPPORT' | 'LIMITED_INFORMATION';
  completionStatus: 'COMPLETED' | 'SAFETY_RESPONSE' | 'BLOCKED' | 'FAILED';
  tokenUsage?: { input: number; output: number };
  latencyMs: number;
  createdAt: string;
}

export interface AIConversation {
  conversationId: AIConversationId;
  userId: UserId;
  householdId: HouseholdId;
  petId?: PetId;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  messageId: AIMessageId;
  conversationId: AIConversationId;
  role: 'USER' | 'ASSISTANT';
  content: string;
  requestId?: AIRequestId;
  responseId?: AIResponseId;
  createdAt: string;
}

export interface AIRecommendation {
  recommendationId: RecommendationId;
  householdId: HouseholdId;
  petId: PetId;
  category: RecommendationCategory;
  title: string;
  explanation: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  evidenceRefs: AIContextSourceRef[];
  generatedBy: 'DETERMINISTIC_RULE' | 'CANONICAL_DUE_STATE' | 'AI_DERIVED' | 'PROFESSIONAL_PLAN' | 'OWNER_GOAL';
  modelDeploymentId?: AIModelDeploymentId;
  policyVersion: string;
  status: RecommendationStatus;
  validFrom: string;
  expiresAt?: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIEvaluationCase {
  evaluationCaseId: AIEvaluationCaseId;
  code: string;
  suite: 'GENERAL_HELPFULNESS' | 'PET_FACT_GROUNDING' | 'PROVENANCE' | 'HEALTH_SAFETY' | 'MEDICATION_SAFETY' | 'EMERGENCY_ESCALATION' | 'NUTRITION_SAFETY' | 'BEHAVIOR_SAFETY' | 'LOST_PET_PRIVACY' | 'TRACKER_STATUS_ACCURACY' | 'PROMPT_INJECTION' | 'TENANT_ISOLATION' | 'COMMERCE_PRIVACY' | 'TOOL_AUTHORIZATION';
  useCase: AIUseCase;
  riskClass: AIRiskClass;
  input: string;
  expectedAction?: AISafetyAction;
  prohibitedPhrases?: string[];
  requiredPhrases?: string[];
}

export interface AIEvaluationResult {
  evaluationCaseId: AIEvaluationCaseId;
  passed: boolean;
  notes: string[];
}

export interface AIEvaluationRun {
  evaluationRunId: AIEvaluationRunId;
  modelDeploymentId: AIModelDeploymentId;
  promptVersionId: AIPromptVersionId;
  policyVersion: string;
  datasetVersion: string;
  results: AIEvaluationResult[];
  passed: number;
  failed: number;
  startedAt: string;
  completedAt: string;
}

export interface AIIncident {
  incidentId: AIIncidentId;
  category: 'UNSAFE_MEDICAL_ADVICE' | 'PRIVACY_LEAK' | 'CROSS_TENANT_LEAK' | 'HALLUCINATED_PET_FACT' | 'PROMPT_INJECTION_SUCCESS' | 'UNAUTHORIZED_TOOL_CALL' | 'SAFETY_CLASSIFIER_FAILURE' | 'PROVIDER_OUTAGE' | 'MODEL_REGRESSION' | 'BIAS_FAIRNESS_CONCERN' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'TRIAGED' | 'MITIGATING' | 'MODEL_DISABLED' | 'PROMPT_ROLLED_BACK' | 'RESOLVED' | 'CLOSED';
  requestId?: AIRequestId;
  responseId?: AIResponseId;
  modelDeploymentId?: AIModelDeploymentId;
  promptVersionId?: AIPromptVersionId;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAskInput {
  userId: UserId;
  householdId: HouseholdId;
  petId: PetId;
  useCase: AIUseCase;
  text: string;
  conversationId?: AIConversationId;
}
