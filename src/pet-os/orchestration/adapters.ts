import {
  asProviderId, asServiceOfferingId, asCareOccurrenceId, asLostPetIncidentId, asDeviceId
} from '../kernel/ids';
import { CareService } from '../care/service';
import { CareStore } from '../care/store';
import { NotificationService } from '../notifications/service';
import { BookingPlatformService } from '../booking/service';
import { BookingStore } from '../booking/store';
import { ProviderStore } from '../provider/store';
import { RecoveryService } from '../recovery/service';
import { CommunityService } from '../community/service';
import { TrackingService } from '../tracking/service';
import { TrackingStore } from '../tracking/store';
import {
  ActionProposal, CareCreateOwnerTaskPayload, CareSnoozePayload, CareCompletePayload,
  NotificationSelfPayload, BookingCreatePayload, LostPetCommunityAlertPayload,
  TrackingLostModePayload, OpenWorkspacePayload
} from './types';

export interface DomainExecutionResult {
  resultReference?:string;
  summary:string;
  data?:unknown;
}

function requiredString(payload:Record<string,unknown>,key:string):string{
  const value=payload[key];
  if(typeof value!=='string'||!value.trim())throw new Error(`VALIDATION_ERROR: ${key} is required`);
  return value;
}

export class OrchestrationDomainAdapter {
  static validateTarget(proposal:ActionProposal):void{
    if(proposal.actionType==='LOST_PET_ACTIVATE_COMMUNITY_ALERT'){
      const incidentId=requiredString(proposal.payload,'lostPetIncidentId');
      const incident=RecoveryService.getInstance().getIncidentById(asLostPetIncidentId(incidentId));
      if(!incident)throw new Error('TARGET_CONFLICT: Lost Pet incident not found');
      if(incident.householdId!==proposal.householdId)throw new Error('AUTHORIZATION_FAILURE: incident belongs to another household');
      if(['RECOVERED','CANCELLED'].includes(incident.status))throw new Error('TARGET_CONFLICT: Lost Pet incident is closed');
    }
    if(proposal.actionType==='CARE_SNOOZE_OCCURRENCE'||proposal.actionType==='CARE_COMPLETE_OCCURRENCE'){
      const id=asCareOccurrenceId(requiredString(proposal.payload,'occurrenceId'));
      const occ=CareStore.getOccurrence(id);
      if(!occ)throw new Error('TARGET_CONFLICT: care occurrence not found');
      if(occ.householdId!==proposal.householdId)throw new Error('AUTHORIZATION_FAILURE: occurrence belongs to another household');
    }
  }

  static async execute(proposal:ActionProposal):Promise<DomainExecutionResult>{
    this.validateTarget(proposal);
    switch(proposal.actionType){
      case 'CARE_CREATE_OWNER_TASK':{
        const p=proposal.payload as unknown as CareCreateOwnerTaskPayload;
        if(!p.petId||!p.title||!p.dueAt)throw new Error('VALIDATION_ERROR: petId, title and dueAt are required');
        const result=CareService.createObligation(proposal.actorUserId,{
          petId:p.petId,householdId:proposal.householdId,category:p.category||'GENERAL_CARE',
          careType:'OWNER_AUTOMATION_TASK',title:p.title,description:p.description,sourceType:'OWNER_CREATED',
          scheduleType:'ONE_TIME',dueAt:p.dueAt,timezone:'Africa/Nairobi',priority:p.priority||'MEDIUM',
          completionPolicy:'MANUAL_ACKNOWLEDGEMENT'
        });
        return {resultReference:String(result.obligation.careObligationId),summary:`Created care task "${result.obligation.title}".`,data:result};
      }
      case 'CARE_SNOOZE_OCCURRENCE':{
        const p=proposal.payload as unknown as CareSnoozePayload;
        if(!p.occurrenceId||!p.snoozedUntil)throw new Error('VALIDATION_ERROR: occurrenceId and snoozedUntil are required');
        const result=CareService.snoozeReminder(proposal.actorUserId,asCareOccurrenceId(String(p.occurrenceId)),p.snoozedUntil,p.reason);
        return {resultReference:String(result.occurrenceId),summary:`Reminder snoozed until ${result.snoozedUntil}; clinical due date unchanged.`,data:result};
      }
      case 'CARE_COMPLETE_OCCURRENCE':{
        const p=proposal.payload as unknown as CareCompletePayload;
        if(!p.occurrenceId)throw new Error('VALIDATION_ERROR: occurrenceId is required');
        const result=CareService.completeOccurrence(proposal.actorUserId,asCareOccurrenceId(String(p.occurrenceId)),{
          completionSourceType:'MANUAL_USER',completionNotes:p.completionNotes
        });
        return {resultReference:String(result.completionRecord.completionId),summary:`Recorded completion of "${result.occurrence.title}".`,data:result};
      }
      case 'NOTIFICATION_SCHEDULE_SELF':{
        const p=proposal.payload as unknown as NotificationSelfPayload;
        if(!p.title||!p.body)throw new Error('VALIDATION_ERROR: title and body are required');
        const result=await NotificationService.schedule({
          recipientUserId:proposal.actorUserId,petId:p.petId,notificationType:'CARE_UPCOMING',
          sourceType:'ORCHESTRATION',sourceId:String(proposal.actionProposalId),title:p.title,body:p.body,
          channels:['IN_APP'],priority:'NORMAL',scheduledAt:p.scheduledAt,
          deduplicationKey:`orchestration:${proposal.idempotencyKey}`
        });
        return {resultReference:result[0]?String(result[0].notificationId):undefined,summary:`Scheduled ${result.length} in-app notification delivery record(s).`,data:result};
      }
      case 'BOOKING_CREATE_SERVICE_REQUEST':{
        const p=proposal.payload as unknown as BookingCreatePayload;
        if(!p.providerId||!p.serviceOfferingId||!p.petIds?.length||!p.startAt||!p.endAt)throw new Error('VALIDATION_ERROR: booking target, pets and time window are required');
        const service=new BookingPlatformService(BookingStore.getInstance(),ProviderStore.getInstance());
        const booking=service.createBooking({
          ownerUserId:proposal.actorUserId,householdId:proposal.householdId,
          providerId:asProviderId(String(p.providerId)),serviceOfferingId:asServiceOfferingId(String(p.serviceOfferingId)),
          petIds:p.petIds,startAt:p.startAt,endAt:p.endAt,timezone:p.timezone||'Africa/Nairobi',
          instructions:{petHandlingNotes:p.note||'Created from a user-confirmed Pet OS action proposal.'},
          idempotencyKey:`orch-${proposal.idempotencyKey}`
        });
        return {resultReference:String(booking.bookingId),summary:`Booking request created with status ${booking.status}.`,data:booking};
      }
      case 'LOST_PET_ACTIVATE_COMMUNITY_ALERT':{
        const p=proposal.payload as unknown as LostPetCommunityAlertPayload;
        if(!p.lostPetIncidentId)throw new Error('VALIDATION_ERROR: lostPetIncidentId is required');
        // Ensure the Community domain subscriber is active before the Recovery event is emitted.
        CommunityService.getInstance();
        const incident=RecoveryService.getInstance().activateCommunityAlert(asLostPetIncidentId(String(p.lostPetIncidentId)),proposal.actorUserId);
        return {resultReference:String(incident.lostPetIncidentId),summary:'Minimized Lost Pet recovery alert requested for Community distribution.',data:incident};
      }
      case 'TRACKING_REQUEST_LOST_MODE':{
        const p=proposal.payload as unknown as TrackingLostModePayload;
        if(!p.petId)throw new Error('VALIDATION_ERROR: petId is required');
        const assignment=TrackingStore.getInstance().getActiveAssignmentForPet(p.petId);
        const deviceId=p.deviceId||assignment?.deviceId;
        if(!deviceId)throw new Error('TARGET_CONFLICT: no active tracker is assigned to this Pet');
        const supported=await TrackingService.getInstance().requestTrackingMode(asDeviceId(String(deviceId)),'FUTURE_LOST_MODE',proposal.actorUserId);
        if(!supported)throw new Error('TARGET_CONFLICT: tracker does not support the requested Lost Mode');
        return {resultReference:String(deviceId),summary:'Lost Mode request accepted by the Tracking capability boundary.',data:{deviceId,mode:'FUTURE_LOST_MODE',supported}};
      }
      case 'OPEN_DOMAIN_WORKSPACE':{
        const p=proposal.payload as unknown as OpenWorkspacePayload;
        return {resultReference:p.module,summary:`Navigation request ready for ${p.module}.`,data:p};
      }
      default:
        throw new Error(`ACTION_NOT_REGISTERED: ${(proposal as any).actionType}`);
    }
  }
}
