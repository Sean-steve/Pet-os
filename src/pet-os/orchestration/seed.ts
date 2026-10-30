import {
  UserId, HouseholdId, AutomationRuleId, AutomationRuleVersionId
} from '../kernel/ids';
import { OrchestrationStore } from './store';
import { seedActionRegistry } from './registry';

export const ORCHESTRATION_SEED_IDS={
  HOUSEHOLD_REMINDER_RULE:'ar-household-care-reminder-v1' as AutomationRuleId,
  HOUSEHOLD_REMINDER_RULE_VERSION:'arv-household-care-reminder-v1' as AutomationRuleVersionId,
};

export function seedOrchestrationData(ownerUserId:UserId,householdId:HouseholdId,store=OrchestrationStore.getInstance()):void{
  seedActionRegistry(store);
  if(store.getRule(ORCHESTRATION_SEED_IDS.HOUSEHOLD_REMINDER_RULE))return;
  const now=new Date().toISOString();
  store.saveRuleVersion({
    automationRuleVersionId:ORCHESTRATION_SEED_IDS.HOUSEHOLD_REMINDER_RULE_VERSION,
    automationRuleId:ORCHESTRATION_SEED_IDS.HOUSEHOLD_REMINDER_RULE,
    version:1,triggerType:'DOMAIN_EVENT',
    triggerConfig:{eventType:'CareOccurrenceDue'},
    conditionExpression:'event.householdId == rule.householdId',
    actionType:'NOTIFICATION_SCHEDULE_SELF',
    actionPayloadTemplate:{title:'Care task is due',body:'A Pet OS care task needs attention.'},
    requiresConfirmationEveryRun:false,maxExecutionsPerDay:10,createdAt:now
  });
  store.saveRule({
    automationRuleId:ORCHESTRATION_SEED_IDS.HOUSEHOLD_REMINDER_RULE,
    activeVersionId:ORCHESTRATION_SEED_IDS.HOUSEHOLD_REMINDER_RULE_VERSION,
    ownerUserId,householdId,name:'Household care due reminder',
    description:'Demonstrates a low-risk, pre-authorized notification automation. It does not change clinical schedules or Pet records.',
    status:'ACTIVE',createdAt:now,updatedAt:now
  });
}
