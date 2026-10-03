import {
  AIConversationId,
  AIMessageId,
  AIRequestId,
  AIResponseId,
  AIContextAssemblyId,
  AIModelDeploymentId,
  RecommendationId,
  AIEvaluationRunId,
  AIIncidentId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { HealthStore } from '../health/store';
import { CareStore } from '../care/store';
import { NutritionStore } from '../nutrition/store';
import { TrainingStore } from '../training/store';
import { ActivityStore } from '../activity/store';
import { TrackingStore } from '../tracking/store';
import { RecoveryStore } from '../recovery/store';
import { AIStore } from './store';
import {
  AIAskInput,
  AIContextSourceRef,
  PetContextBundle,
  AIModelDeployment,
  AISensitivityClass,
  AIUseCase,
  AIRiskClass,
  AIResponse,
  AIConversation,
  AIRecommendation,
  RecommendationCategory,
  AIEvaluationRun,
  AIIncident,
  AIConsentScope,
} from './types';
import { AISafetyPolicy, AI_POLICY_VERSION } from './policy';
import { AIModelProviderRegistry } from './model-provider';
import { AIEvents } from './events';

const store=AIStore.getInstance();

function freshness(iso?: string): AIContextSourceRef['freshness'] {
  if (!iso) return 'UNKNOWN';
  const age=Date.now()-new Date(iso).getTime();
  if (!Number.isFinite(age)) return 'UNKNOWN';
  const day=86400000;
  if (age <= day) return 'CURRENT';
  if (age <= 30*day) return 'RECENT';
  if (age <= 180*day) return 'STALE';
  return 'HISTORICAL';
}

function recId(record: any, keys: string[]): string {
  for (const key of keys) if (record?.[key]) return String(record[key]);
  return `ref-${generateUUIDv7()}`;
}

function recDate(record: any, keys: string[]): string | undefined {
  for (const key of keys) if (record?.[key]) return String(record[key]);
  return undefined;
}

export class AIModelRouter {
  static route(useCase: AIUseCase, riskClass: AIRiskClass, sensitivities: AISensitivityClass[]): AIModelDeployment {
    const candidates=store.listModelDeployments().filter(d => {
      if (d.status !== 'ACTIVE' && d.status !== 'APPROVED') return false;
      if (!d.allowedRiskClasses.includes(riskClass)) return false;
      if (!sensitivities.every(s => d.allowedSensitivities.includes(s))) return false;
      const def=store.getModelDefinition(d.modelDefinitionId);
      return !!def && (def.status==='ACTIVE' || def.status==='APPROVED') && def.approvedUseCases.includes(useCase) && !def.prohibitedUseCases.includes(useCase);
    }).sort((a,b)=>b.routingWeight-a.routingWeight);

    if (!candidates.length) throw new Error('NO_APPROVED_AI_MODEL_FOR_RISK_AND_SENSITIVITY');
    return candidates[0];
  }
}

export class AIConsentService {
  static hasScope(userId: any, householdId: any, scope: AIConsentScope): boolean {
    const c=store.getConsentForUserHousehold(userId, householdId);
    if (!c) return false;
    return c.scopes.includes(scope) && !c.withdrawnScopes.includes(scope);
  }

  static withdrawScope(userId: any, householdId: any, scope: AIConsentScope): void {
    const c=store.getConsentForUserHousehold(userId, householdId);
    if (!c) throw new Error('AI_CONSENT_NOT_FOUND');
    if (!c.withdrawnScopes.includes(scope)) c.withdrawnScopes=[...c.withdrawnScopes,scope];
    c.withdrawnAt=new Date().toISOString();
    store.saveConsent(c);
  }
}

export class PetContextAssembler {
  static authorize(userId: any, householdId: any, petId: any): void {
    const membership=IdentityStore.findMembership(householdId,userId);
    if (!membership) throw new Error('AI_AUTHORIZATION_DENIED: user is not an active household member');
    const pet=PetStore.findPetById(petId);
    if (!pet || pet.householdId !== householdId) throw new Error('AI_AUTHORIZATION_DENIED: pet is outside household scope');
  }

  static assemble(input: AIAskInput): PetContextBundle {
    this.authorize(input.userId,input.householdId,input.petId);

    if (!AIConsentService.hasScope(input.userId,input.householdId,'GENERAL_AI_ASSISTANCE')) {
      throw new Error('AI_CONSENT_REQUIRED: GENERAL_AI_ASSISTANCE');
    }
    if (!AIConsentService.hasScope(input.userId,input.householdId,'PET_DATA_AI_CONTEXT')) {
      throw new Error('AI_CONSENT_REQUIRED: PET_DATA_AI_CONTEXT');
    }

    const sourceRefs: AIContextSourceRef[]=[];
    const pet=PetStore.findPetById(input.petId)!;
    sourceRefs.push({
      sourceDomain:'PET_CORE',
      sourceRecordId:String(pet.petId),
      recordType:'Pet',
      summary:`${pet.name} is recorded as ${pet.speciesCode}, lifecycle stage ${pet.lifecycleStage}, status ${pet.status}.`,
      recordedAt:pet.updatedAt,
      provenance:'CANONICAL_PET_CORE',
      sensitivity:'PET_PROFILE',
      freshness:freshness(pet.updatedAt),
    });

    const needsHealth=['PET_SUMMARY','HEALTH_SUMMARY','MEDICATION_EXPLANATION','NUTRITION_INFORMATION','PROFESSIONAL_DRAFT'].includes(input.useCase) || /health|vaccin|allergy|medication|vet|dose|vomit|diarrhea|poison|breathe|seizure|diet|food/i.test(input.text);
    if (needsHealth) {
      if (!AIConsentService.hasScope(input.userId,input.householdId,'HEALTH_DATA_AI_CONTEXT')) {
        throw new Error('AI_CONSENT_REQUIRED: HEALTH_DATA_AI_CONTEXT');
      }
      for (const c of HealthStore.listConditionsForPet(input.petId).slice(0,6)) {
        sourceRefs.push({
          sourceDomain:'HEALTH',sourceRecordId:String(c.conditionId),recordType:'MedicalCondition',
          summary:`${c.isDiagnosis ? 'Provider-recorded diagnosis' : 'Recorded observation'}: ${c.conditionName} (${c.status}).`,
          recordedAt:c.updatedAt,provenance:c.provenance,sensitivity:'HEALTH',freshness:freshness(c.updatedAt)
        });
      }
      for (const a of HealthStore.listAllergiesForPet(input.petId).slice(0,6)) {
        sourceRefs.push({
          sourceDomain:'HEALTH',sourceRecordId:String(a.allergyId),recordType:'PetAllergy',
          summary:`Recorded ${a.allergyType.toLowerCase()}: ${a.allergen} (${a.status}).`,
          recordedAt:(a as any).updatedAt || (a as any).createdAt,provenance:(a as any).provenance || 'HEALTH_RECORD',sensitivity:'HEALTH',freshness:freshness((a as any).updatedAt || (a as any).createdAt)
        });
      }
      for (const m of HealthStore.listMedicationsForPet(input.petId).slice(0,6)) {
        sourceRefs.push({
          sourceDomain:'HEALTH',sourceRecordId:String(m.medicationId),recordType:'PetMedication',
          summary:`Recorded medication: ${(m as any).medicationName || (m as any).name || 'medication'} (${m.status}).`,
          recordedAt:(m as any).updatedAt || m.startAt,provenance:(m as any).provenance || 'HEALTH_RECORD',sensitivity:'HEALTH',freshness:freshness((m as any).updatedAt || m.startAt)
        });
      }
      for (const v of HealthStore.listVaccinationsForPet(input.petId).slice(0,5)) {
        sourceRefs.push({
          sourceDomain:'HEALTH',sourceRecordId:String(v.vaccinationId),recordType:'PetVaccination',
          summary:`Vaccination record: ${(v as any).vaccineName || (v as any).vaccineType || 'vaccination'} administered ${v.administeredAt}.`,
          recordedAt:v.administeredAt,provenance:(v as any).provenance || 'HEALTH_RECORD',sensitivity:'HEALTH',freshness:freshness(v.administeredAt)
        });
      }
    }

    if (['PET_SUMMARY','DAILY_INSIGHT','PET_ASSISTANT'].includes(input.useCase)) {
      for (const c of CareStore.getObligationsForPet(input.petId).slice(0,6)) {
        sourceRefs.push({
          sourceDomain:'CARE',sourceRecordId:String(c.careObligationId),recordType:'CareObligation',
          summary:`${c.title}: ${c.status}; due ${c.dueAt}.`,recordedAt:c.updatedAt,
          provenance:c.sourceType,sensitivity:'PET_PROFILE',freshness:freshness(c.updatedAt)
        });
      }
    }

    if (['PET_SUMMARY','NUTRITION_INFORMATION','PET_ASSISTANT'].includes(input.useCase) || /food|diet|meal|nutrition/.test(input.text.toLowerCase())) {
      const plan=NutritionStore.findActivePlanForPet(input.petId);
      if (plan) sourceRefs.push({
        sourceDomain:'NUTRITION',sourceRecordId:String(plan.feedingPlanId),recordType:'FeedingPlan',
        summary:`Active feeding plan: ${(plan as any).name || (plan as any).title || 'recorded plan'} (${plan.status}).`,
        recordedAt:(plan as any).updatedAt || plan.createdAt,provenance:(plan as any).sourceType || 'NUTRITION_RECORD',sensitivity:'PET_PROFILE',freshness:freshness((plan as any).updatedAt || plan.createdAt)
      });
      for (const r of NutritionStore.listDietaryRestrictionsForPet(input.petId).slice(0,5)) {
        sourceRefs.push({
          sourceDomain:'NUTRITION',sourceRecordId:recId(r,['restrictionId']),recordType:'DietaryRestriction',
          summary:`Dietary restriction: ${(r as any).restrictedIngredient || (r as any).description || (r as any).restrictionType || 'recorded restriction'}.`,
          recordedAt:recDate(r,['updatedAt','createdAt']),provenance:(r as any).sourceType || 'NUTRITION_RECORD',sensitivity:'HEALTH',freshness:freshness(recDate(r,['updatedAt','createdAt']))
        });
      }
    }

    if (['PET_SUMMARY','TRAINING_GUIDANCE','PET_ASSISTANT'].includes(input.useCase)) {
      const plan=TrainingStore.findActivePlanForPet(input.petId);
      if (plan) sourceRefs.push({
        sourceDomain:'TRAINING',sourceRecordId:String(plan.trainingPlanId),recordType:'TrainingPlan',
        summary:`Active training plan: ${plan.title} (${plan.sourceType}).`,recordedAt:plan.updatedAt,
        provenance:plan.sourceType,sensitivity:'PET_PROFILE',freshness:freshness(plan.updatedAt)
      });
      for (const p of TrainingStore.listSkillProgressForPet(input.petId).slice(0,5)) {
        sourceRefs.push({
          sourceDomain:'TRAINING',sourceRecordId:recId(p,['skillProgressId']),recordType:'PetSkillProgress',
          summary:`Skill progress: ${(p as any).proficiencyStage || (p as any).stage || 'recorded'}.`,
          recordedAt:recDate(p,['updatedAt','assessedAt']),provenance:(p as any).sourceType || 'TRAINING_RECORD',sensitivity:'PET_PROFILE',freshness:freshness(recDate(p,['updatedAt','assessedAt']))
        });
      }
    }

    if (['PET_SUMMARY','ACTIVITY_INSIGHT','PET_ASSISTANT'].includes(input.useCase)) {
      for (const a of ActivityStore.getRecordsForPet(input.petId).slice(0,6)) {
        sourceRefs.push({
          sourceDomain:'ACTIVITY',sourceRecordId:String(a.activityId),recordType:'ActivityRecord',
          summary:`${a.activityType} recorded for ${Math.round(a.durationSeconds/60)} min.`,recordedAt:a.recordedAt,
          provenance:a.sourceType,sensitivity:'PET_PROFILE',freshness:freshness(a.recordedAt)
        });
      }
    }

    if (['PET_SUMMARY','TRACKER_TROUBLESHOOTING','LOST_PET_ASSISTANT'].includes(input.useCase) || /tracker|gps|location|lost/.test(input.text.toLowerCase())) {
      if (!AIConsentService.hasScope(input.userId,input.householdId,'LOCATION_AI_CONTEXT')) {
        throw new Error('AI_CONSENT_REQUIRED: LOCATION_AI_CONTEXT');
      }
      const tracking=TrackingStore.getInstance();
      const assignment=tracking.getActiveAssignmentForPet(input.petId);
      if (assignment) {
        const device=tracking.getDevice(assignment.deviceId);
        if (device) sourceRefs.push({
          sourceDomain:'TRACKING',sourceRecordId:String(device.deviceId),recordType:'TrackingDevice',
          summary:`Tracker ${device.displayName}: device state ${device.operationalStatus}, connectivity ${device.connectivityStatus}, battery ${device.batteryStatus}${typeof device.batteryPercent==='number' ? ` (${device.batteryPercent}%)` : ''}, last seen ${device.lastSeenAt || 'unknown'}.`,
          recordedAt:device.updatedAt,provenance:'TRACKING_DEVICE_REGISTRY',sensitivity:'LOCATION',freshness:freshness(device.lastSeenAt || device.updatedAt)
        });
        const live=tracking.getLiveLocation(input.petId);
        if (live) sourceRefs.push({
          sourceDomain:'TRACKING',sourceRecordId:String((live as any).locationObservationId || assignment.assignmentId),recordType:'PetLiveLocationSummary',
          summary:`Latest location freshness: ${(live as any).freshness || 'UNKNOWN'}, source ${(live as any).sourceType || 'TRACKING'}; exact coordinates intentionally excluded from AI context.`,
          recordedAt:(live as any).observedAt,provenance:'TRACKING_LIVE_READ_MODEL',sensitivity:'LOCATION',freshness:freshness((live as any).observedAt)
        });
      }
      const incident=RecoveryStore.getInstance().getActiveIncidentByPetId(input.petId);
      if (incident) sourceRefs.push({
        sourceDomain:'LOST_PET',sourceRecordId:String((incident as any).incidentId),recordType:'LostPetIncident',
        summary:`Lost Pet incident is active with status ${(incident as any).status}; protected recovery-network identities are excluded.`,
        recordedAt:(incident as any).updatedAt || (incident as any).activatedAt,provenance:'LOST_PET_DOMAIN',sensitivity:'LOCATION',freshness:'CURRENT'
      });
    }

    const sensitivities=Array.from(new Set(sourceRefs.map(s=>s.sensitivity)));
    return {
      contextAssemblyId:`aictx-${generateUUIDv7()}` as AIContextAssemblyId,
      userId:input.userId,householdId:input.householdId,petId:input.petId,useCase:input.useCase,
      sensitivityClasses:sensitivities,sourceRefs,assembledAt:new Date().toISOString(),
      contextVersion:`ctx-${sourceRefs.length}-${pet.version}`,
    };
  }
}

export class AIRecommendationService {
  static generateForPet(userId:any, householdId:any, petId:any): AIRecommendation[] {
    PetContextAssembler.authorize(userId,householdId,petId);
    const now=new Date().toISOString();
    const existing=store.listRecommendationsForPet(petId);
    const out: AIRecommendation[]=[];

    for (const c of CareStore.getObligationsForPet(petId).filter(x=>x.status==='ACTIVE').slice(0,8)) {
      const due = new Date(c.dueAt).getTime() <= Date.now();
      if (!due) continue;
      const key=String(c.careObligationId);
      const prior=existing.find(r=>r.category==='PREVENTIVE_CARE' && r.evidenceRefs.some(e=>e.sourceRecordId===key) && ['ACTIVE','SNOOZED','ACCEPTED'].includes(r.status));
      if (prior) { out.push(prior); continue; }
      const ref:AIContextSourceRef={
        sourceDomain:'CARE',sourceRecordId:key,recordType:'CareObligation',summary:`${c.title} is due based on the canonical care schedule.`,
        recordedAt:c.updatedAt,provenance:c.sourceType,sensitivity:'PET_PROFILE',freshness:freshness(c.updatedAt)
      };
      const rec:AIRecommendation={
        recommendationId:`rec-${generateUUIDv7()}` as RecommendationId,householdId,petId,category:'PREVENTIVE_CARE',
        title:`Review due care: ${c.title}`,explanation:'Pet OS is surfacing an existing canonical due state; it is not calculating a new clinical due date.',
        priority:c.priority==='CRITICAL'?'URGENT':c.priority==='HIGH'?'HIGH':'NORMAL',evidenceRefs:[ref],
        generatedBy:'CANONICAL_DUE_STATE',policyVersion:AI_POLICY_VERSION,status:'ACTIVE',validFrom:now,createdAt:now,updatedAt:now
      };
      store.saveRecommendation(rec);store.publish(AIEvents.recommendationCreated(rec));out.push(rec);
    }
    return out;
  }

  static changeStatus(id:RecommendationId,status:'ACCEPTED'|'DISMISSED'|'SNOOZED',snoozedUntil?:string):AIRecommendation {
    const rec=store.getRecommendation(id); if(!rec) throw new Error('AI_RECOMMENDATION_NOT_FOUND');
    const updated={...rec,status,snoozedUntil:status==='SNOOZED'?snoozedUntil:undefined,updatedAt:new Date().toISOString()};
    store.saveRecommendation(updated);return updated;
  }
}

export class AIPlatformService {
  static createConversation(input:{userId:any;householdId:any;petId?:any;title?:string}):AIConversation {
    if (input.petId) PetContextAssembler.authorize(input.userId,input.householdId,input.petId);
    const now=new Date().toISOString();
    const conv:AIConversation={conversationId:`aic-${generateUUIDv7()}` as AIConversationId,userId:input.userId,householdId:input.householdId,petId:input.petId,title:input.title||'Pet OS Assistant',status:'ACTIVE',createdAt:now,updatedAt:now};
    store.saveConversation(conv);return conv;
  }

  static async ask(input:AIAskInput):Promise<AIResponse> {
    const started=Date.now();
    const prompt=store.getActivePromptForUseCase(input.useCase) || store.getActivePromptForUseCase('PET_ASSISTANT');
    if (!prompt) throw new Error('AI_PROMPT_NOT_APPROVED');

    const requestId=`air-${generateUUIDv7()}` as AIRequestId;
    const safety=AISafetyPolicy.decide(requestId,input.text);
    let request:any={
      requestId,userId:input.userId,householdId:input.householdId,petId:input.petId,conversationId:input.conversationId,
      useCase:input.useCase,riskClass:safety.riskClass,promptVersionId:prompt.promptVersionId,status:'CREATED',userText:input.text,
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    store.saveRequest(request);store.publish(AIEvents.requestCreated(request));store.saveSafetyDecision(safety);

    request={...request,status:'CONTEXT_ASSEMBLING',updatedAt:new Date().toISOString()};store.saveRequest(request);
    const context=PetContextAssembler.assemble(input);
    request={...request,status:'SAFETY_CHECK',contextAssemblyId:context.contextAssemblyId,updatedAt:new Date().toISOString()};store.saveRequest(request);

    let content:string;
    let completionStatus:AIResponse['completionStatus']='COMPLETED';
    let modelDeploymentId:AIModelDeploymentId|undefined;
    let usage:{input:number;output:number}|undefined;

    if (safety.action==='EMERGENCY_ESCALATION') {
      content=AISafetyPolicy.emergencyResponse(safety.detectedCategories);
      completionStatus='SAFETY_RESPONSE';
    } else {
      const deployment=AIModelRouter.route(input.useCase,safety.riskClass,context.sensitivityClasses);
      modelDeploymentId=deployment.modelDeploymentId;
      request={...request,status:'INFERENCE',modelDeploymentId,updatedAt:new Date().toISOString()};store.saveRequest(request);
      const def=store.getModelDefinition(deployment.modelDefinitionId);
      if (!def) throw new Error('AI_MODEL_DEFINITION_MISSING');
      const provider=AIModelProviderRegistry.get(def.provider);
      const generated=await provider.generate({deployment,useCase:input.useCase,userText:input.text,context:context.sourceRefs,safety});
      content=generated.content;usage={input:generated.inputTokens,output:generated.outputTokens};

      const validation=AISafetyPolicy.validateOutput(content,context.sourceRefs);
      if (!validation.safe) {
        content='I cannot safely provide that generated answer. I can summarize the records I have or help you contact an appropriate veterinary professional.';
        completionStatus='SAFETY_RESPONSE';
      }
    }

    request={...request,status:'COMPLETED',updatedAt:new Date().toISOString()};store.saveRequest(request);
    const response:AIResponse={
      responseId:`aires-${generateUUIDv7()}` as AIResponseId,requestId,modelDeploymentId,content,
      safetyDecisionId:safety.safetyDecisionId,provenanceRefs:context.sourceRefs.slice(0,12),
      supportLevel:context.sourceRefs.length>=5?'HIGH_SUPPORT':context.sourceRefs.length>=2?'MODERATE_SUPPORT':'LIMITED_INFORMATION',
      completionStatus,tokenUsage:usage,latencyMs:Date.now()-started,createdAt:new Date().toISOString()
    };
    store.saveResponse(response);store.publish(AIEvents.responseCompleted(response,String(input.householdId)));

    if (input.conversationId) {
      store.saveMessage({messageId:`aim-${generateUUIDv7()}` as AIMessageId,conversationId:input.conversationId,role:'USER',content:input.text,requestId,createdAt:new Date().toISOString()});
      store.saveMessage({messageId:`aim-${generateUUIDv7()}` as AIMessageId,conversationId:input.conversationId,role:'ASSISTANT',content:response.content,responseId:response.responseId,createdAt:new Date().toISOString()});
    }
    return response;
  }

  static openIncident(input:{category:AIIncident['category'];severity:AIIncident['severity'];summary:string;requestId?:any;responseId?:any;modelDeploymentId?:any;promptVersionId?:any}):AIIncident {
    const now=new Date().toISOString();
    const incident:AIIncident={incidentId:`aii-${generateUUIDv7()}` as AIIncidentId,category:input.category,severity:input.severity,status:'OPEN',summary:input.summary,requestId:input.requestId,responseId:input.responseId,modelDeploymentId:input.modelDeploymentId,promptVersionId:input.promptVersionId,createdAt:now,updatedAt:now};
    store.saveIncident(incident);store.publish(AIEvents.incidentOpened(incident));return incident;
  }
}

export class AIEvaluationService {
  static async run(modelDeploymentId:AIModelDeploymentId):Promise<AIEvaluationRun> {
    const deployment=store.getModelDeployment(modelDeploymentId);if(!deployment)throw new Error('AI_MODEL_DEPLOYMENT_NOT_FOUND');
    const prompt=store.getActivePromptForUseCase('PET_ASSISTANT');if(!prompt)throw new Error('AI_PROMPT_NOT_APPROVED');
    const startedAt=new Date().toISOString();
    const results=store.listEvaluationCases().map(c=>{
      const safety=AISafetyPolicy.decide(`air-eval-${generateUUIDv7()}` as AIRequestId,c.input);
      const notes:string[]=[];
      if(c.expectedAction && safety.action!==c.expectedAction)notes.push(`expected ${c.expectedAction}, got ${safety.action}`);
      if(c.suite==='PROMPT_INJECTION' && !safety.detectedCategories.includes('PROMPT_INJECTION'))notes.push('prompt injection not detected');
      return {evaluationCaseId:c.evaluationCaseId,passed:notes.length===0,notes};
    });
    const run:AIEvaluationRun={
      evaluationRunId:`aier-${generateUUIDv7()}` as AIEvaluationRunId,modelDeploymentId,promptVersionId:prompt.promptVersionId,
      policyVersion:AI_POLICY_VERSION,datasetVersion:'sprint28-golden-v1',results,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,
      startedAt,completedAt:new Date().toISOString()
    };
    store.saveEvaluationRun(run);return run;
  }
}
