import type { UserId, HouseholdId, ProviderId } from '../kernel/ids';
import { EngagementService } from './service';
import { EngagementStore } from './store';

export function seedEngagementData(owner:UserId,providerUser:UserId,providerId:ProviderId,admin:UserId,household:HouseholdId){
  const store=EngagementStore.getInstance();
  if(store.listPreferences().length>0)return;
  EngagementService.setTelemetryPreference(owner,true);
  EngagementService.setTelemetryPreference(providerUser,true);
  EngagementService.setTelemetryPreference(admin,false);

  const now=Date.now();
  const at=(daysAgo:number,hour=9)=>{const d=new Date(now-daysAgo*24*60*60*1000);d.setHours(hour,0,0,0);return d.toISOString();};

  const rows=[
    {actorUserId:owner,householdId:household,kind:'VALUE' as const,area:'CARE' as const,eventName:'care_task_completed',surface:'Care',occurredAt:at(1),idempotencyKey:'eng-seed-care-1'},
    {actorUserId:owner,householdId:household,kind:'VALUE' as const,area:'ACTIVITY' as const,eventName:'activity_recorded',surface:'Activity',occurredAt:at(3),idempotencyKey:'eng-seed-activity-1'},
    {actorUserId:owner,householdId:household,kind:'VALUE' as const,area:'BOOKING' as const,eventName:'service_booking_confirmed',surface:'Services',occurredAt:at(7),idempotencyKey:'eng-seed-booking-1'},
    {actorUserId:owner,householdId:household,kind:'NAVIGATION' as const,area:'PET_PROFILE' as const,eventName:'pet_profile_opened',surface:'Pet profile',occurredAt:at(2),idempotencyKey:'eng-seed-nav-1'},
    {actorUserId:owner,householdId:household,kind:'WORKFLOW' as const,area:'BOOKING' as const,eventName:'booking_flow',workflowState:'STARTED' as const,correlationId:'wf-booking-1',surface:'Services',occurredAt:at(7,8),idempotencyKey:'eng-seed-wf-booking-start'},
    {actorUserId:owner,householdId:household,kind:'WORKFLOW' as const,area:'BOOKING' as const,eventName:'booking_flow',workflowState:'COMPLETED' as const,correlationId:'wf-booking-1',surface:'Services',occurredAt:at(7,9),idempotencyKey:'eng-seed-wf-booking-complete'},
    {actorUserId:providerUser,providerId,kind:'VALUE' as const,area:'BOOKING' as const,eventName:'provider_service_completed',surface:'Professional',occurredAt:at(2),idempotencyKey:'eng-seed-provider-value'},
    {actorUserId:providerUser,providerId,kind:'WORKFLOW' as const,area:'BOOKING' as const,eventName:'service_execution',workflowState:'STARTED' as const,correlationId:'wf-provider-1',surface:'Professional',occurredAt:at(2,10),idempotencyKey:'eng-seed-provider-start'},
    {actorUserId:providerUser,providerId,kind:'WORKFLOW' as const,area:'BOOKING' as const,eventName:'service_execution',workflowState:'COMPLETED' as const,correlationId:'wf-provider-1',surface:'Professional',occurredAt:at(2,11),idempotencyKey:'eng-seed-provider-complete'},
  ];
  for(const row of rows)EngagementService.recordEvent(row);
}
