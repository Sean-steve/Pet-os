import { ActionDefinitionId } from '../kernel/ids';
import { ActionDefinition, ActionType } from './types';
import { OrchestrationStore } from './store';

function id(type:ActionType):ActionDefinitionId {
  return `actdef-${type.toLowerCase().replace(/_/g,'-')}-v1` as ActionDefinitionId;
}

export const SPRINT29_ACTION_DEFINITIONS:ActionDefinition[]=[
  {
    actionDefinitionId:id('CARE_CREATE_OWNER_TASK'),actionType:'CARE_CREATE_OWNER_TASK',version:1,
    title:'Create household care task',description:'Creates an owner-defined care obligation through the Care domain.',
    owningDomain:'CARE',commandSchema:'CareCreateOwnerTaskPayload@1',risk:'REVERSIBLE_LOW_RISK',confirmationLevel:'STANDARD',
    compensationCapability:'TARGET_DOMAIN_REVERSAL',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL','AUTOMATION_RULE'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('CARE_SNOOZE_OCCURRENCE'),actionType:'CARE_SNOOZE_OCCURRENCE',version:1,
    title:'Snooze care reminder',description:'Changes reminder timing without changing the canonical due date.',
    owningDomain:'CARE',commandSchema:'CareSnoozePayload@1',risk:'REVERSIBLE_LOW_RISK',confirmationLevel:'STANDARD',
    compensationCapability:'MANUAL_REVIEW',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('CARE_COMPLETE_OCCURRENCE'),actionType:'CARE_COMPLETE_OCCURRENCE',version:1,
    title:'Record care completion',description:'Records completion through the canonical Care service with provenance.',
    owningDomain:'CARE',commandSchema:'CareCompletePayload@1',risk:'SENSITIVE',confirmationLevel:'STANDARD',
    compensationCapability:'MANUAL_REVIEW',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('NOTIFICATION_SCHEDULE_SELF'),actionType:'NOTIFICATION_SCHEDULE_SELF',version:1,
    title:'Schedule household notification',description:'Schedules an in-app household reminder through Notification orchestration.',
    owningDomain:'NOTIFICATIONS',commandSchema:'NotificationSelfPayload@1',risk:'REVERSIBLE_LOW_RISK',confirmationLevel:'NONE',
    compensationCapability:'NONE',idempotencyRequired:true,allowedOrigins:['USER_UI','AUTOMATION_RULE','DOMAIN_EVENT'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:true,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('BOOKING_CREATE_SERVICE_REQUEST'),actionType:'BOOKING_CREATE_SERVICE_REQUEST',version:1,
    title:'Create service booking request',description:'Creates a booking only after explicit preview and confirmation.',
    owningDomain:'BOOKING',commandSchema:'BookingCreatePayload@1',risk:'SENSITIVE',confirmationLevel:'STANDARD',
    compensationCapability:'TARGET_DOMAIN_REVERSAL',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('LOST_PET_ACTIVATE_COMMUNITY_ALERT'),actionType:'LOST_PET_ACTIVATE_COMMUNITY_ALERT',version:1,
    title:'Publish Lost Pet recovery alert',description:'Requests minimized public community distribution for an existing Lost Pet incident.',
    owningDomain:'LOST_PET',commandSchema:'LostPetCommunityAlertPayload@1',risk:'SAFETY_CRITICAL',confirmationLevel:'STRONG_REAUTH',
    compensationCapability:'TARGET_DOMAIN_REVERSAL',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:true,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('TRACKING_REQUEST_LOST_MODE'),actionType:'TRACKING_REQUEST_LOST_MODE',version:1,
    title:'Request tracker Lost Mode',description:'Requests supported high-frequency tracking mode through the Tracking domain.',
    owningDomain:'TRACKING',commandSchema:'TrackingLostModePayload@1',risk:'SAFETY_CRITICAL',confirmationLevel:'STRONG_REAUTH',
    compensationCapability:'TARGET_DOMAIN_REVERSAL',idempotencyRequired:true,allowedOrigins:['USER_UI','AI_PROPOSAL'],
    requiresActiveHouseholdMembership:true,mayRunFromAutomationRule:false,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  },
  {
    actionDefinitionId:id('OPEN_DOMAIN_WORKSPACE'),actionType:'OPEN_DOMAIN_WORKSPACE',version:1,
    title:'Open Pet OS workspace',description:'Navigation-only action with no canonical state change.',
    owningDomain:'PLATFORM',commandSchema:'OpenWorkspacePayload@1',risk:'READ_ONLY',confirmationLevel:'NONE',
    compensationCapability:'NONE',idempotencyRequired:false,allowedOrigins:['USER_UI','AI_PROPOSAL','AUTOMATION_RULE','SYSTEM'],
    requiresActiveHouseholdMembership:false,mayRunFromAutomationRule:true,publicDisclosure:false,moneyMovement:false,clinicalMutation:false,exactLocationDisclosure:false,enabled:true
  }
];

export function seedActionRegistry(store=OrchestrationStore.getInstance()):void{
  for(const def of SPRINT29_ACTION_DEFINITIONS)store.saveActionDefinition(def);
}
