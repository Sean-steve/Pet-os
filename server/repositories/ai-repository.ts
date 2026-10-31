import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

function httpError(message:string,statusCode:number){return Object.assign(new Error(message),{statusCode});}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

const USE_CASE_SCOPES:Record<string,string[]>={
  PET_ASSISTANT:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  PET_SUMMARY:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  DAILY_INSIGHT:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  HEALTH_SUMMARY:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','HEALTH_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  MEDICATION_EXPLANATION:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','HEALTH_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  TRAINING_GUIDANCE:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  NUTRITION_INFORMATION:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  ACTIVITY_INSIGHT:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  LOST_PET_ASSISTANT:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','LOCATION_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  TRACKER_TROUBLESHOOTING:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  PROFESSIONAL_DRAFT:['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','PROFESSIONAL_AI_CONTEXT','MODEL_PROVIDER_PROCESSING'],
  PRODUCT_INFORMATION:['GENERAL_AI_ASSISTANCE','MODEL_PROVIDER_PROCESSING'],
};
const SENSITIVITY:Record<string,string[]>={
  PET_ASSISTANT:['GENERAL','PET_PROFILE'],PET_SUMMARY:['PET_PROFILE'],DAILY_INSIGHT:['PET_PROFILE'],
  HEALTH_SUMMARY:['PET_PROFILE','HEALTH'],MEDICATION_EXPLANATION:['PET_PROFILE','HEALTH'],TRAINING_GUIDANCE:['PET_PROFILE'],
  NUTRITION_INFORMATION:['PET_PROFILE'],ACTIVITY_INSIGHT:['PET_PROFILE'],LOST_PET_ASSISTANT:['PET_PROFILE','LOCATION'],
  TRACKER_TROUBLESHOOTING:['PET_PROFILE'],PROFESSIONAL_DRAFT:['PET_PROFILE','PROFESSIONAL'],PRODUCT_INFORMATION:['GENERAL'],
};
const EMERGENCY_PATTERNS=[
  /not breathing/i,/difficulty breathing/i,/seizure/i,/unconscious/i,/poison(ed|ing)?/i,/severe bleeding/i,/hit by (a )?car/i,/collapse(d)?/i,
];

async function assertHouseholdPet(client:PoolClient,householdId:string,petId:string,userId:string){
  const access=await client.query(
    `SELECT EXISTS(
      SELECT 1 FROM pets p JOIN household_members hm ON hm.household_id=p.household_id
      WHERE p.pet_id=$1 AND p.household_id=$2 AND hm.user_id=$3 AND hm.status='ACTIVE'
    ) AS allowed`,
    [petId,householdId,userId],
  );
  if(access.rows[0]?.allowed!==true)throw httpError('AI_PET_CONTEXT_ACCESS_DENIED',403);
}

export async function grantAIConsent(client:PoolClient,input:{actorUserId:string;householdId:string;scopes:string[];policyVersion:string}){
  const member=await client.query(`SELECT 1 FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE' LIMIT 1`,[input.householdId,input.actorUserId]);
  if(!member.rowCount)throw httpError('AI_CONSENT_HOUSEHOLD_ACCESS_DENIED',403);
  const allowed=new Set(['GENERAL_AI_ASSISTANCE','PET_DATA_AI_CONTEXT','HEALTH_DATA_AI_CONTEXT','LOCATION_AI_CONTEXT','PROFESSIONAL_AI_CONTEXT','MODEL_PROVIDER_PROCESSING']);
  const scopes=[...new Set(input.scopes)];
  if(!scopes.length||scopes.some(s=>!allowed.has(s)))throw httpError('AI_CONSENT_SCOPE_INVALID',400);
  const existing=await client.query(`SELECT consent_id FROM ai_consents WHERE user_id=$1 AND household_id=$2 LIMIT 1`,[input.actorUserId,input.householdId]);
  const consentId=existing.rows[0]?.consent_id||`ai-consent-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO ai_consents(consent_id,user_id,household_id,scopes,policy_version,granted_at,withdrawn_scopes,withdrawn_at)
     VALUES($1,$2,$3,$4::jsonb,$5,now(),'[]'::jsonb,NULL)
     ON CONFLICT(user_id,household_id) DO UPDATE SET scopes=EXCLUDED.scopes,policy_version=EXCLUDED.policy_version,granted_at=now(),withdrawn_scopes='[]'::jsonb,withdrawn_at=NULL
     RETURNING *`,
    [consentId,input.actorUserId,input.householdId,JSON.stringify(scopes),input.policyVersion],
  );
  return result.rows[0];
}

export async function createAIRequest(client:PoolClient,input:{actorUserId:string;householdId:string;petId:string;useCase:string;text:string}){
  await assertHouseholdPet(client,input.householdId,input.petId,input.actorUserId);
  const required=USE_CASE_SCOPES[input.useCase];
  if(!required)throw httpError('AI_USE_CASE_INVALID',400);
  const consent=await client.query(`SELECT * FROM ai_consents WHERE user_id=$1 AND household_id=$2 LIMIT 1`,[input.actorUserId,input.householdId]);
  if(!consent.rowCount)throw httpError('AI_CONSENT_REQUIRED',403);
  const scopes=new Set<string>(consent.rows[0].scopes||[]),withdrawn=new Set<string>(consent.rows[0].withdrawn_scopes||[]);
  if(required.some(s=>!scopes.has(s)||withdrawn.has(s)))throw httpError('AI_REQUIRED_CONSENT_SCOPE_MISSING',403);

  const prompt=await client.query(`SELECT * FROM ai_prompt_versions WHERE use_case=$1 AND status='ACTIVE' ORDER BY version DESC LIMIT 1`,[input.useCase]);
  if(!prompt.rowCount)throw httpError('AI_ACTIVE_PROMPT_NOT_AVAILABLE',503);
  const model=await client.query(`SELECT * FROM ai_model_deployments WHERE status='ACTIVE' ORDER BY enabled_at DESC NULLS LAST LIMIT 1`);
  if(!model.rowCount)throw httpError('AI_MODEL_DEPLOYMENT_NOT_AVAILABLE',503);

  const emergency=EMERGENCY_PATTERNS.some(p=>p.test(input.text));
  const riskClass=emergency?'EMERGENCY':String(prompt.rows[0].risk_class);
  const safetyAction=emergency?'EMERGENCY_ESCALATION':riskClass==='HIGH'?'ALLOW_WITH_WARNING':'ALLOW';
  const status=emergency?'BLOCKED':'READY';
  const contextRefs:any[]=[];
  const pet=await client.query(`SELECT pet_id,name,species_code,breed_code,lifecycle_stage,status,updated_at FROM pets WHERE pet_id=$1 LIMIT 1`,[input.petId]);
  if(pet.rowCount)contextRefs.push({sourceDomain:'PET_CORE',sourceRecordId:input.petId,recordType:'PET_PROFILE',summary:`${pet.rows[0].name} · ${pet.rows[0].species_code} · ${pet.rows[0].lifecycle_stage}`,recordedAt:pet.rows[0].updated_at,provenance:'CANONICAL_PET_CORE',sensitivity:'PET_PROFILE',freshness:'CURRENT'});
  if(['HEALTH_SUMMARY','MEDICATION_EXPLANATION'].includes(input.useCase)){
    const records=await client.query(`SELECT record_id,record_type,occurred_at,provenance,verification_status FROM health_records WHERE pet_id=$1 ORDER BY occurred_at DESC LIMIT 25`,[input.petId]);
    for(const r of records.rows)contextRefs.push({sourceDomain:'HEALTH',sourceRecordId:r.record_id,recordType:r.record_type,summary:`Health record: ${r.record_type}`,recordedAt:r.occurred_at,provenance:r.provenance||'UNKNOWN',sensitivity:'HEALTH',freshness:'RECENT',verificationStatus:r.verification_status});
  }
  if(input.useCase==='LOST_PET_ASSISTANT'){
    const recovery=await client.query(`SELECT lost_pet_incident_id,status,coarse_description,updated_at FROM recovery_incidents WHERE pet_id=$1 AND status IN ('REPORTED','ACTIVE','SEARCH_IN_PROGRESS') ORDER BY created_at DESC LIMIT 1`,[input.petId]);
    if(recovery.rowCount)contextRefs.push({sourceDomain:'LOST_PET',sourceRecordId:recovery.rows[0].lost_pet_incident_id,recordType:'LOST_PET_INCIDENT',summary:`Active recovery area: ${recovery.rows[0].coarse_description}`,recordedAt:recovery.rows[0].updated_at,provenance:'RECOVERY_AUTHORITY',sensitivity:'LOCATION',freshness:'CURRENT'});
  }
  const requestId=`ai-request-${generateUUIDv7()}`,safetyDecisionId=`ai-safety-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO ai_requests(
      request_id,user_id,household_id,pet_id,use_case,risk_class,prompt_version_id,model_deployment_id,status,user_text,context_refs,sensitivity_classes
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
    [requestId,input.actorUserId,input.householdId,input.petId,input.useCase,riskClass,prompt.rows[0].prompt_version_id,model.rows[0].model_deployment_id,status,input.text,JSON.stringify(contextRefs),JSON.stringify(SENSITIVITY[input.useCase]||['GENERAL'])],
  );
  const warning=emergency?'Potential emergency detected. AI inference is blocked; seek urgent veterinary care.':riskClass==='HIGH'?'High-risk informational request: response must remain non-diagnostic and recommend professional review when appropriate.':null;
  await client.query(
    `INSERT INTO ai_safety_decisions(safety_decision_id,request_id,risk_class,policy_version,detected_categories,action,warning)
     VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [safetyDecisionId,requestId,riskClass,prompt.rows[0].policy_version,JSON.stringify(emergency?['POTENTIAL_EMERGENCY']:[]),safetyAction,warning],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'AIRequest',$2,$3,$4::jsonb)`,
    [`evt-${generateUUIDv7()}`,requestId,emergency?'AIRequestEmergencyEscalated':'AIRequestReady',JSON.stringify({requestId,householdId:input.householdId,petId:input.petId,useCase:input.useCase,riskClass,safetyAction})],
  );
  return {requestId,status,riskClass,safetyAction,warning,modelAlias:model.rows[0].internal_alias,promptVersionId:prompt.rows[0].prompt_version_id,contextRefs};
}

export async function settleAIResponse(client:PoolClient,input:{
  requestId:string;content:string;supportLevel:'HIGH_SUPPORT'|'MODERATE_SUPPORT'|'LIMITED_INFORMATION';completionStatus:'COMPLETED'|'SAFETY_RESPONSE'|'BLOCKED'|'FAILED';
  latencyMs:number;tokenUsage?:{input:number;output:number};provenanceRefs?:Array<Record<string,unknown>>;
}){
  const request=await client.query(`SELECT * FROM ai_requests WHERE request_id=$1 FOR UPDATE`,[input.requestId]);
  if(!request.rowCount)throw httpError('AI_REQUEST_NOT_FOUND',404);
  const row=request.rows[0];
  if(row.status==='BLOCKED')throw httpError('AI_BLOCKED_REQUEST_CANNOT_BE_COMPLETED_BY_PROVIDER',409);
  const existing=await client.query(`SELECT * FROM ai_responses WHERE request_id=$1 LIMIT 1`,[input.requestId]);
  if(existing.rowCount)return {response:existing.rows[0],duplicate:true};
  if(!['READY','INFERENCE','POST_PROCESSING'].includes(String(row.status)))throw httpError('AI_REQUEST_NOT_SETTLEABLE',409);
  const safety=await client.query(`SELECT * FROM ai_safety_decisions WHERE request_id=$1 LIMIT 1`,[input.requestId]);
  if(!safety.rowCount)throw httpError('AI_SAFETY_DECISION_REQUIRED',409);
  if(row.risk_class==='HIGH'&&input.completionStatus==='COMPLETED'&&!['ALLOW_WITH_WARNING','LIMIT_RESPONSE','ESCALATE_VET'].includes(String(safety.rows[0].action)))throw httpError('AI_HIGH_RISK_SAFETY_ACTION_INVALID',409);
  const responseId=`ai-response-${generateUUIDv7()}`;
  const provenanceRefs=input.provenanceRefs&&input.provenanceRefs.length?input.provenanceRefs:row.context_refs;
  const result=await client.query(
    `INSERT INTO ai_responses(
      response_id,request_id,model_deployment_id,content,safety_decision_id,provenance_refs,support_level,completion_status,token_usage,latency_ms
     ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10) RETURNING *`,
    [responseId,input.requestId,row.model_deployment_id,input.content,safety.rows[0].safety_decision_id,JSON.stringify(provenanceRefs||[]),input.supportLevel,input.completionStatus,JSON.stringify(input.tokenUsage||null),input.latencyMs],
  );
  await client.query(`UPDATE ai_requests SET status=$2,updated_at=now() WHERE request_id=$1`,[input.requestId,input.completionStatus==='FAILED'?'FAILED':'COMPLETED']);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'AIRequest',$2,'AIResponseCompleted',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.requestId,JSON.stringify({requestId:input.requestId,responseId,completionStatus:input.completionStatus,supportLevel:input.supportLevel})],
  );
  return {response:result.rows[0],duplicate:false};
}

export async function getAIRequest(client:PoolClient,requestId:string,actorUserId:string){
  const request=await client.query(`SELECT * FROM ai_requests WHERE request_id=$1 AND user_id=$2 LIMIT 1`,[requestId,actorUserId]);
  if(!request.rowCount)throw httpError('AI_REQUEST_ACCESS_DENIED',403);
  const [safety,response]=await Promise.all([
    client.query(`SELECT * FROM ai_safety_decisions WHERE request_id=$1 LIMIT 1`,[requestId]),
    client.query(`SELECT * FROM ai_responses WHERE request_id=$1 LIMIT 1`,[requestId]),
  ]);
  return {request:request.rows[0],safetyDecision:safety.rows[0]||null,response:response.rows[0]||null};
}

export async function createAIRecommendation(client:PoolClient,input:{
  householdId:string;petId:string;category:string;title:string;explanation:string;priority:'LOW'|'NORMAL'|'HIGH'|'URGENT';evidenceRefs:Array<Record<string,unknown>>;modelDeploymentId?:string;policyVersion:string;
}){
  const pet=await client.query(`SELECT 1 FROM pets WHERE pet_id=$1 AND household_id=$2 LIMIT 1`,[input.petId,input.householdId]);
  if(!pet.rowCount)throw httpError('AI_RECOMMENDATION_PET_HOUSEHOLD_MISMATCH',409);
  const recommendationId=`ai-recommendation-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO ai_recommendations(
      recommendation_id,household_id,pet_id,category,title,explanation,priority,evidence_refs,generated_by,model_deployment_id,policy_version,status,valid_from
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'AI_DERIVED',$9,$10,'ACTIVE',now()) RETURNING *`,
    [recommendationId,input.householdId,input.petId,input.category,input.title,input.explanation,input.priority,JSON.stringify(input.evidenceRefs),input.modelDeploymentId||'ai-deployment-runtime-default',input.policyVersion],
  );
  return result.rows[0];
}

export async function updateRecommendationStatus(client:PoolClient,input:{actorUserId:string;recommendationId:string;status:'ACCEPTED'|'DISMISSED'|'SNOOZED';snoozedUntil?:string}){
  const current=await client.query(`SELECT * FROM ai_recommendations WHERE recommendation_id=$1 FOR UPDATE`,[input.recommendationId]);
  if(!current.rowCount)throw httpError('AI_RECOMMENDATION_NOT_FOUND',404);
  const access=await client.query(`SELECT petos_can_access_ai_household($1,$2) AS allowed`,[current.rows[0].household_id,input.actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('AI_RECOMMENDATION_ACCESS_DENIED',403);
  const result=await client.query(
    `UPDATE ai_recommendations SET status=$2,snoozed_until=$3,updated_at=now() WHERE recommendation_id=$1 RETURNING *`,
    [input.recommendationId,input.status,input.status==='SNOOZED'?input.snoozedUntil||null:null],
  );
  return result.rows[0];
}
