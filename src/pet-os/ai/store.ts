import {
  UserId,
  HouseholdId,
  PetId,
  RecommendationId,
  AIModelDefinitionId,
  AIModelDeploymentId,
  AIPromptTemplateId,
  AIPromptVersionId,
  AIConversationId,
  AIRequestId,
  AIResponseId,
  AISafetyDecisionId,
  AIConsentId,
  AIEvaluationCaseId,
  AIEvaluationRunId,
  AIIncidentId,
} from '../kernel/ids';
import {
  AIModelDefinition,
  AIModelDeployment,
  AIPromptTemplate,
  AIPromptVersion,
  AIConversation,
  AIMessage,
  AIRequest,
  AIResponse,
  AISafetyDecision,
  AIConsent,
  AIRecommendation,
  AIEvaluationCase,
  AIEvaluationRun,
  AIIncident,
} from './types';
import { AIDomainEvent } from './events';

export class AIStore {
  private static instance: AIStore;

  private modelDefinitions = new Map<AIModelDefinitionId, AIModelDefinition>();
  private modelDeployments = new Map<AIModelDeploymentId, AIModelDeployment>();
  private promptTemplates = new Map<AIPromptTemplateId, AIPromptTemplate>();
  private promptVersions = new Map<AIPromptVersionId, AIPromptVersion>();
  private conversations = new Map<AIConversationId, AIConversation>();
  private messages = new Map<AIConversationId, AIMessage[]>();
  private requests = new Map<AIRequestId, AIRequest>();
  private responses = new Map<AIResponseId, AIResponse>();
  private safetyDecisions = new Map<AISafetyDecisionId, AISafetyDecision>();
  private consents = new Map<AIConsentId, AIConsent>();
  private recommendations = new Map<RecommendationId, AIRecommendation>();
  private evaluationCases = new Map<AIEvaluationCaseId, AIEvaluationCase>();
  private evaluationRuns = new Map<AIEvaluationRunId, AIEvaluationRun>();
  private incidents = new Map<AIIncidentId, AIIncident>();
  private events: AIDomainEvent[] = [];

  private constructor() {}

  static getInstance(): AIStore {
    if (!AIStore.instance) AIStore.instance = new AIStore();
    return AIStore.instance;
  }

  reset(): void {
    this.modelDefinitions.clear();
    this.modelDeployments.clear();
    this.promptTemplates.clear();
    this.promptVersions.clear();
    this.conversations.clear();
    this.messages.clear();
    this.requests.clear();
    this.responses.clear();
    this.safetyDecisions.clear();
    this.consents.clear();
    this.recommendations.clear();
    this.evaluationCases.clear();
    this.evaluationRuns.clear();
    this.incidents.clear();
    this.events = [];
  }

  saveModelDefinition(v: AIModelDefinition): void { this.modelDefinitions.set(v.modelDefinitionId, { ...v }); }
  getModelDefinition(id: AIModelDefinitionId): AIModelDefinition | undefined { const v=this.modelDefinitions.get(id); return v ? { ...v } : undefined; }
  listModelDefinitions(): AIModelDefinition[] { return Array.from(this.modelDefinitions.values()).map(v => ({ ...v })); }

  saveModelDeployment(v: AIModelDeployment): void { this.modelDeployments.set(v.modelDeploymentId, { ...v }); }
  getModelDeployment(id: AIModelDeploymentId): AIModelDeployment | undefined { const v=this.modelDeployments.get(id); return v ? { ...v } : undefined; }
  listModelDeployments(): AIModelDeployment[] { return Array.from(this.modelDeployments.values()).map(v => ({ ...v })); }
  disableModelDeployment(id: AIModelDeploymentId): void {
    const v=this.modelDeployments.get(id);
    if (v) this.modelDeployments.set(id, { ...v, status: 'SUSPENDED' });
  }

  savePromptTemplate(v: AIPromptTemplate): void { this.promptTemplates.set(v.promptTemplateId, { ...v }); }
  listPromptTemplates(): AIPromptTemplate[] { return Array.from(this.promptTemplates.values()).map(v => ({ ...v })); }
  savePromptVersion(v: AIPromptVersion): void { this.promptVersions.set(v.promptVersionId, { ...v }); }
  getPromptVersion(id: AIPromptVersionId): AIPromptVersion | undefined { const v=this.promptVersions.get(id); return v ? { ...v } : undefined; }
  getActivePromptForUseCase(useCase: string): AIPromptVersion | undefined {
    const tpl = Array.from(this.promptTemplates.values()).find(t => t.useCase === useCase && (t.status === 'ACTIVE' || t.status === 'APPROVED'));
    if (!tpl) return undefined;
    return Array.from(this.promptVersions.values())
      .filter(v => v.promptTemplateId === tpl.promptTemplateId && (v.approvalStatus === 'ACTIVE' || v.approvalStatus === 'APPROVED'))
      .sort((a,b) => b.version-a.version)[0];
  }

  saveConversation(v: AIConversation): void { this.conversations.set(v.conversationId, { ...v }); }
  getConversation(id: AIConversationId): AIConversation | undefined { const v=this.conversations.get(id); return v ? { ...v } : undefined; }
  listConversations(userId: UserId): AIConversation[] { return Array.from(this.conversations.values()).filter(v=>v.userId===userId && v.status!=='DELETED').map(v=>({...v})); }
  saveMessage(v: AIMessage): void {
    const list=this.messages.get(v.conversationId) || [];
    list.push({ ...v });
    this.messages.set(v.conversationId, list);
  }
  listMessages(id: AIConversationId): AIMessage[] { return (this.messages.get(id)||[]).map(v=>({...v})); }

  saveRequest(v: AIRequest): void { this.requests.set(v.requestId, { ...v }); }
  getRequest(id: AIRequestId): AIRequest | undefined { const v=this.requests.get(id); return v ? { ...v } : undefined; }
  listRequests(): AIRequest[] { return Array.from(this.requests.values()).map(v=>({...v})); }

  saveResponse(v: AIResponse): void { this.responses.set(v.responseId, { ...v, provenanceRefs: [...v.provenanceRefs] }); }
  getResponse(id: AIResponseId): AIResponse | undefined { const v=this.responses.get(id); return v ? { ...v, provenanceRefs:[...v.provenanceRefs] } : undefined; }
  listResponses(): AIResponse[] { return Array.from(this.responses.values()).map(v=>({...v, provenanceRefs:[...v.provenanceRefs]})); }

  saveSafetyDecision(v: AISafetyDecision): void { this.safetyDecisions.set(v.safetyDecisionId, { ...v }); }
  getSafetyDecision(id: AISafetyDecisionId): AISafetyDecision | undefined { const v=this.safetyDecisions.get(id); return v ? { ...v } : undefined; }
  listSafetyDecisions(): AISafetyDecision[] { return Array.from(this.safetyDecisions.values()).map(v=>({...v})); }

  saveConsent(v: AIConsent): void { this.consents.set(v.consentId, { ...v, scopes:[...v.scopes], withdrawnScopes:[...v.withdrawnScopes] }); }
  getConsentForUserHousehold(userId: UserId, householdId: HouseholdId): AIConsent | undefined {
    const v=Array.from(this.consents.values()).find(c=>c.userId===userId && c.householdId===householdId);
    return v ? { ...v, scopes:[...v.scopes], withdrawnScopes:[...v.withdrawnScopes] } : undefined;
  }
  listConsents(): AIConsent[] { return Array.from(this.consents.values()).map(v=>({...v, scopes:[...v.scopes], withdrawnScopes:[...v.withdrawnScopes]})); }

  saveRecommendation(v: AIRecommendation): void { this.recommendations.set(v.recommendationId, { ...v, evidenceRefs:[...v.evidenceRefs] }); }
  getRecommendation(id: RecommendationId): AIRecommendation | undefined { const v=this.recommendations.get(id); return v ? { ...v, evidenceRefs:[...v.evidenceRefs] } : undefined; }
  listRecommendationsForPet(petId: PetId): AIRecommendation[] {
    return Array.from(this.recommendations.values()).filter(v=>v.petId===petId).map(v=>({...v,evidenceRefs:[...v.evidenceRefs]}));
  }

  saveEvaluationCase(v: AIEvaluationCase): void { this.evaluationCases.set(v.evaluationCaseId, { ...v }); }
  listEvaluationCases(): AIEvaluationCase[] { return Array.from(this.evaluationCases.values()).map(v=>({...v})); }
  saveEvaluationRun(v: AIEvaluationRun): void { this.evaluationRuns.set(v.evaluationRunId, { ...v, results:[...v.results] }); }
  listEvaluationRuns(): AIEvaluationRun[] { return Array.from(this.evaluationRuns.values()).map(v=>({...v,results:[...v.results]})); }

  saveIncident(v: AIIncident): void { this.incidents.set(v.incidentId, { ...v }); }
  listIncidents(): AIIncident[] { return Array.from(this.incidents.values()).map(v=>({...v})); }

  publish(event: AIDomainEvent): void { this.events.push(event); }
  listEvents(): AIDomainEvent[] { return [...this.events]; }
}
