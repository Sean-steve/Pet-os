import { generateUUIDv7, AutomationPolicyDecisionId } from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { OrchestrationStore } from './store';
import { ActionDefinition, ActionProposal, AutomationPolicyDecision, PolicyOutcome } from './types';

export const ORCHESTRATION_POLICY_VERSION='ORCH-POLICY-1.0.0';

export class OrchestrationPolicyEngine {
  static evaluate(proposal:ActionProposal,definition:ActionDefinition):AutomationPolicyDecision{
    let outcome:PolicyOutcome='ALLOWED';
    let reasonCode='POLICY_ALLOWED';
    let reason='Action is allowed by the Sprint 29 orchestration policy.';

    if(!definition.enabled){
      outcome='UNAVAILABLE';reasonCode='ACTION_DISABLED';reason='This action type is disabled.';
    } else if(!definition.allowedOrigins.includes(proposal.origin)){
      outcome='DENIED';reasonCode='ORIGIN_NOT_ALLOWED';reason=`${proposal.origin} may not propose ${proposal.actionType}.`;
    } else if(proposal.origin==='AUTOMATION_RULE' && !definition.mayRunFromAutomationRule){
      outcome='DENIED';reasonCode='AUTOMATION_RULE_NOT_ALLOWED';reason='This state-changing action cannot be executed from a standing automation rule.';
    }

    if(outcome==='ALLOWED' && definition.requiresActiveHouseholdMembership){
      const membership=IdentityStore.findMembership(proposal.householdId,proposal.actorUserId);
      if(!membership || membership.status!=='ACTIVE'){
        outcome='DENIED';reasonCode='ACTIVE_MEMBERSHIP_REQUIRED';reason='Active household membership is required at execution time.';
      }
    }

    if(outcome==='ALLOWED' && proposal.petId){
      const pet=PetStore.findPetById(proposal.petId);
      if(!pet || pet.householdId!==proposal.householdId){
        outcome='DENIED';reasonCode='CROSS_HOUSEHOLD_TARGET';reason='The target Pet is outside the actor household.';
      } else if(pet.status==='DECEASED' && proposal.actionType!=='OPEN_DOMAIN_WORKSPACE'){
        outcome='DENIED';reasonCode='PET_DECEASED';reason='State-changing automation is not permitted for a deceased Pet.';
      }
    }

    if(outcome==='ALLOWED'){
      if(definition.moneyMovement || definition.risk==='FINANCIAL'){
        outcome='DENIED';reasonCode='GENERIC_FINANCIAL_AUTOMATION_FORBIDDEN';reason='Sprint 29 does not permit generic automation to move funds, refund, pay out, or purchase.';
      } else if(definition.clinicalMutation || definition.risk==='CLINICAL'){
        outcome='DENIED';reasonCode='CLINICAL_MUTATION_FORBIDDEN';reason='Automation may not diagnose, prescribe, change medication doses, or sign clinical records.';
      } else if(definition.exactLocationDisclosure){
        outcome='DENIED';reasonCode='EXACT_LOCATION_DISCLOSURE_FORBIDDEN';reason='Precise location cannot be published through generic orchestration.';
      } else if(definition.confirmationLevel==='STRONG_REAUTH'){
        outcome='REQUIRES_REAUTH';reasonCode='STRONG_CONFIRMATION_REQUIRED';reason='This safety-critical action requires explicit strong confirmation immediately before execution.';
      } else if(definition.confirmationLevel==='MULTI_PARTY'){
        outcome='REQUIRES_APPROVAL';reasonCode='MULTI_PARTY_APPROVAL_REQUIRED';reason='This action requires an approval decision from an authorized second party.';
      } else if(definition.confirmationLevel==='STANDARD'){
        outcome='REQUIRES_CONFIRMATION';reasonCode='CONFIRMATION_REQUIRED';reason='Review and confirm the exact action preview before execution.';
      }
    }

    const decision:AutomationPolicyDecision={
      policyDecisionId:`apd-${generateUUIDv7()}` as AutomationPolicyDecisionId,
      actionType:proposal.actionType,actionRisk:definition.risk,outcome,reasonCode,reason,
      confirmationLevel:definition.confirmationLevel,evaluatedAt:new Date().toISOString()
    };
    OrchestrationStore.getInstance().savePolicyDecision(decision);
    return decision;
  }
}
