import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

function httpError(message:string,statusCode:number){return Object.assign(new Error(message),{statusCode});}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const stable=(value:unknown)=>JSON.stringify(value,Object.keys(value as any).sort());

async function assertHouseholdMember(client:PoolClient,householdId:string,userId:string){
  const r=await client.query(`SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE' LIMIT 1`,[householdId,userId]);
  if(!r.rowCount)throw httpError('AUTOMATION_HOUSEHOLD_ACCESS_DENIED',403);
  return String(r.rows[0].role);
}

export async function createAutomationRule(client:PoolClient,input:{
  actorUserId:string;householdId:string;name:string;description:string;triggerType:string;triggerConfig:Record<string,unknown>;
  conditionExpression:string;actionType:string;actionPayloadTemplate:Record<string,unknown>;requiresConfirmationEveryRun:boolean;maxExecutionsPerDay:number;
}){
  await assertHouseholdMember(client,input.householdId,input.actorUserId);
  const definition=await client.query(`SELECT * FROM automation_action_definitions WHERE action_type=$1 AND enabled LIMIT 1`,[input.actionType]);
  if(!definition.rowCount)throw httpError('AUTOMATION_ACTION_NOT_AVAILABLE',400);
  const d=definition.rows[0];
  if(d.may_run_from_rule!==true)throw httpError('AUTOMATION_ACTION_CANNOT_RUN_FROM_RULE',400);
  if(d.confirmation_level!=='NONE'&&input.requiresConfirmationEveryRun!==true)throw httpError('AUTOMATION_CONFIRMATION_CANNOT_BE_BYPASSED',400);
  if(!Number.isInteger(input.maxExecutionsPerDay)||input.maxExecutionsPerDay<1||input.maxExecutionsPerDay>100)throw httpError('AUTOMATION_DAILY_LIMIT_INVALID',400);
  const automationRuleId=`automation-rule-${generateUUIDv7()}`,versionId=`automation-rule-version-${generateUUIDv7()}`;
  const rule=await client.query(
    `INSERT INTO automation_rules(automation_rule_id,owner_user_id,household_id,name,description,status,active_version)
     VALUES($1,$2,$3,$4,$5,'ACTIVE',1) RETURNING *`,
    [automationRuleId,input.actorUserId,input.householdId,input.name,input.description],
  );
  await client.query(
    `INSERT INTO automation_rule_versions(
      automation_rule_version_id,automation_rule_id,version,trigger_type,trigger_config,condition_expression,action_type,action_payload_template,
      requires_confirmation_every_run,max_executions_per_day
     ) VALUES($1,$2,1,$3,$4::jsonb,$5,$6,$7::jsonb,$8,$9)`,
    [versionId,automationRuleId,input.triggerType,JSON.stringify(input.triggerConfig),input.conditionExpression,input.actionType,JSON.stringify(input.actionPayloadTemplate),input.requiresConfirmationEveryRun,input.maxExecutionsPerDay],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'AutomationRule',$2,'AutomationRuleActivated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,automationRuleId,JSON.stringify({automationRuleId,householdId:input.householdId,actionType:input.actionType})],
  );
  return {rule:rule.rows[0],versionId};
}

export async function proposeAutomationAction(client:PoolClient,input:{
  actorUserId:string;householdId:string;petId?:string;actionType:string;origin:string;originReferenceId?:string;payload:Record<string,unknown>;idempotencyKey:string;
}){
  await assertHouseholdMember(client,input.householdId,input.actorUserId);
  if(input.petId){
    const pet=await client.query(`SELECT 1 FROM pets WHERE pet_id=$1 AND household_id=$2 LIMIT 1`,[input.petId,input.householdId]);
    if(!pet.rowCount)throw httpError('AUTOMATION_PET_TARGET_INVALID',400);
  }
  const existing=await client.query(`SELECT * FROM automation_action_proposals WHERE actor_user_id=$1 AND idempotency_key=$2 LIMIT 1`,[input.actorUserId,input.idempotencyKey]);
  if(existing.rowCount)return {proposal:existing.rows[0],replayed:true};
  const definition=await client.query(`SELECT * FROM automation_action_definitions WHERE action_type=$1 AND enabled LIMIT 1`,[input.actionType]);
  if(!definition.rowCount)throw httpError('AUTOMATION_ACTION_NOT_AVAILABLE',400);
  const d=definition.rows[0];
  if(input.origin==='AUTOMATION_RULE'&&d.may_run_from_rule!==true)throw httpError('AUTOMATION_ACTION_CANNOT_RUN_FROM_RULE',403);
  if(d.money_movement||d.clinical_mutation)throw httpError('AUTOMATION_SENSITIVE_MUTATION_NOT_AUTONOMOUS',403);
  const proposalId=`action-proposal-${generateUUIDv7()}`;
  const preview={actionType:input.actionType,householdId:input.householdId,petId:input.petId||null,payload:input.payload,risk:d.risk,confirmationLevel:d.confirmation_level};
  const previewHash=hash(stable(preview));
  const targetStateFingerprint=hash(`${input.householdId}|${input.petId||''}|${input.actionType}`);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const status=d.confirmation_level==='NONE'?'CONFIRMED':'AWAITING_CONFIRMATION';
  const result=await client.query(
    `INSERT INTO automation_action_proposals(
      action_proposal_id,action_type,actor_user_id,household_id,pet_id,origin,origin_reference_id,payload,status,risk,confirmation_level,
      preview_hash,target_state_fingerprint,idempotency_key,expires_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [proposalId,input.actionType,input.actorUserId,input.householdId,input.petId||null,input.origin,input.originReferenceId||null,JSON.stringify(input.payload),status,d.risk,d.confirmation_level,previewHash,targetStateFingerprint,input.idempotencyKey,expiresAt],
  );
  return {proposal:result.rows[0],preview,replayed:false};
}

export async function confirmAutomationAction(client:PoolClient,input:{
  actorUserId:string;proposalId:string;previewHash:string;confirmationBinding:string;
}){
  const proposal=await client.query(`SELECT * FROM automation_action_proposals WHERE action_proposal_id=$1 FOR UPDATE`,[input.proposalId]);
  if(!proposal.rowCount)throw httpError('AUTOMATION_PROPOSAL_NOT_FOUND',404);
  const p=proposal.rows[0];
  if(p.actor_user_id!==input.actorUserId)throw httpError('AUTOMATION_CONFIRMATION_ACTOR_MISMATCH',403);
  if(p.status==='CONFIRMED'){
    const existing=await client.query(`SELECT * FROM automation_confirmations WHERE action_proposal_id=$1 LIMIT 1`,[input.proposalId]);
    return {confirmation:existing.rows[0]||null,replayed:true};
  }
  if(p.status!=='AWAITING_CONFIRMATION')throw httpError('AUTOMATION_PROPOSAL_NOT_CONFIRMABLE',409);
  if(new Date(p.expires_at).getTime()<=Date.now())throw httpError('AUTOMATION_CONFIRMATION_EXPIRED',409);
  if(input.previewHash!==p.preview_hash)throw httpError('AUTOMATION_PREVIEW_HASH_MISMATCH',409);
  if(String(p.confirmation_level)==='STRONG_REAUTH'&&input.confirmationBinding.length<16)throw httpError('AUTOMATION_STRONG_REAUTH_BINDING_REQUIRED',400);
  if(!input.confirmationBinding.trim())throw httpError('AUTOMATION_CONFIRMATION_BINDING_REQUIRED',400);
  const confirmationId=`action-confirmation-${generateUUIDv7()}`;
  const expiresAt=new Date(Math.min(new Date(p.expires_at).getTime(),Date.now()+5*60*1000)).toISOString();
  const result=await client.query(
    `INSERT INTO automation_confirmations(action_confirmation_id,action_proposal_id,actor_user_id,preview_hash,confirmation_level,confirmation_binding_hash,one_time_use,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
    [confirmationId,input.proposalId,input.actorUserId,input.previewHash,p.confirmation_level,hash(input.confirmationBinding),expiresAt],
  );
  await client.query(`UPDATE automation_action_proposals SET status='CONFIRMED',updated_at=now() WHERE action_proposal_id=$1`,[input.proposalId]);
  return {confirmation:result.rows[0],replayed:false};
}

export async function executeAutomationAction(client:PoolClient,input:{actorUserId:string;proposalId:string}){
  const proposal=await client.query(`SELECT * FROM automation_action_proposals WHERE action_proposal_id=$1 FOR UPDATE`,[input.proposalId]);
  if(!proposal.rowCount)throw httpError('AUTOMATION_PROPOSAL_NOT_FOUND',404);
  const p=proposal.rows[0];
  if(p.actor_user_id!==input.actorUserId)throw httpError('AUTOMATION_EXECUTION_ACTOR_MISMATCH',403);
  if(p.status==='EXECUTING'||p.status==='COMPLETED')return {proposal:p,replayed:true};
  if(p.status!=='CONFIRMED')throw httpError('AUTOMATION_CONFIRMATION_REQUIRED',409);
  if(new Date(p.expires_at).getTime()<=Date.now())throw httpError('AUTOMATION_PROPOSAL_EXPIRED',409);
  if(p.confirmation_level!=='NONE'){
    const confirmation=await client.query(`SELECT * FROM automation_confirmations WHERE action_proposal_id=$1 FOR UPDATE`,[input.proposalId]);
    if(!confirmation.rowCount||confirmation.rows[0].used_at||new Date(confirmation.rows[0].expires_at).getTime()<=Date.now())throw httpError('AUTOMATION_CONFIRMATION_INVALID_OR_USED',409);
    await client.query(`UPDATE automation_confirmations SET used_at=now() WHERE action_proposal_id=$1`,[input.proposalId]);
  }
  if(p.action_type==='OPEN_DOMAIN_WORKSPACE'){
    const attemptId=`execution-attempt-${generateUUIDv7()}`;
    await client.query(
      `INSERT INTO automation_execution_attempts(execution_attempt_id,action_proposal_id,attempt_number,classification,result_reference,result_summary,started_at,completed_at)
       VALUES($1,$2,1,'SUCCESS',$3,'Read-only workspace navigation authorized',now(),now())`,
      [attemptId,input.proposalId,`workspace:${String(p.payload?.workspace||'overview')}`],
    );
    const result=await client.query(`UPDATE automation_action_proposals SET status='COMPLETED',updated_at=now() WHERE action_proposal_id=$1 RETURNING *`,[input.proposalId]);
    return {proposal:result.rows[0],queued:false,resultReference:`workspace:${String(p.payload?.workspace||'overview')}`};
  }
  const eventId=`evt-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'ActionProposal',$2,'AutomationActionAuthorized',$3::jsonb)`,
    [eventId,input.proposalId,JSON.stringify({proposalId:input.proposalId,actionType:p.action_type,householdId:p.household_id,petId:p.pet_id,payload:p.payload})],
  );
  const result=await client.query(`UPDATE automation_action_proposals SET status='EXECUTING',updated_at=now() WHERE action_proposal_id=$1 RETURNING *`,[input.proposalId]);
  return {proposal:result.rows[0],queued:true,resultReference:`outbox:${eventId}`};
}

export async function settleAutomationExecution(client:PoolClient,input:{
  proposalId:string;classification:'SUCCESS'|'VALIDATION_FAILURE'|'AUTHORIZATION_FAILURE'|'STALE_PREVIEW'|'CONFIRMATION_EXPIRED'|'TARGET_CONFLICT'|'DEPENDENCY_RETRYABLE'|'PERMANENT_FAILURE'|'PARTIAL_FAILURE'|'POLICY_BLOCKED';
  resultReference?:string;resultSummary?:string;errorMessage?:string;
}){
  const proposal=await client.query(`SELECT * FROM automation_action_proposals WHERE action_proposal_id=$1 FOR UPDATE`,[input.proposalId]);
  if(!proposal.rowCount)throw httpError('AUTOMATION_PROPOSAL_NOT_FOUND',404);
  if(proposal.rows[0].status==='COMPLETED'||proposal.rows[0].status==='FAILED')return {proposal:proposal.rows[0],duplicate:true};
  if(proposal.rows[0].status!=='EXECUTING')throw httpError('AUTOMATION_PROPOSAL_NOT_EXECUTING',409);
  const count=await client.query(`SELECT COUNT(*)::int AS count FROM automation_execution_attempts WHERE action_proposal_id=$1`,[input.proposalId]);
  const attemptNumber=Number(count.rows[0].count)+1,attemptId=`execution-attempt-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO automation_execution_attempts(execution_attempt_id,action_proposal_id,attempt_number,classification,result_reference,result_summary,error_message,started_at,completed_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,now(),now())`,
    [attemptId,input.proposalId,attemptNumber,input.classification,input.resultReference||null,input.resultSummary||null,input.errorMessage||null],
  );
  const success=input.classification==='SUCCESS';
  const result=await client.query(
    `UPDATE automation_action_proposals SET status=$2,updated_at=now() WHERE action_proposal_id=$1 RETURNING *`,
    [input.proposalId,success?'COMPLETED':'FAILED'],
  );
  return {proposal:result.rows[0],duplicate:false,attemptId};
}

export async function getAutomationProposal(client:PoolClient,proposalId:string,actorUserId:string){
  const proposal=await client.query(`SELECT * FROM automation_action_proposals WHERE action_proposal_id=$1 AND actor_user_id=$2 LIMIT 1`,[proposalId,actorUserId]);
  if(!proposal.rowCount)throw httpError('AUTOMATION_PROPOSAL_ACCESS_DENIED',403);
  const [confirmation,attempts]=await Promise.all([
    client.query(`SELECT action_confirmation_id,preview_hash,confirmation_level,one_time_use,used_at,confirmed_at,expires_at FROM automation_confirmations WHERE action_proposal_id=$1 LIMIT 1`,[proposalId]),
    client.query(`SELECT * FROM automation_execution_attempts WHERE action_proposal_id=$1 ORDER BY attempt_number`,[proposalId]),
  ]);
  return {proposal:proposal.rows[0],confirmation:confirmation.rows[0]||null,attempts:attempts.rows};
}
