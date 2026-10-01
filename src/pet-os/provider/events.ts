/**
 * Pet OS Sprint 10 - Provider Platform Domain Events
 * Implements Event-Driven Architecture across identity, verification, and service marketplace.
 */

import {
  UserId,
  ProviderId,
  BusinessId,
  CredentialId,
  VerificationCaseId,
  ServiceOfferingId,
  LocationId,
  ProviderReportId,
} from '../kernel/ids';
import {
  ProviderCategory,
  ProviderVerificationStatus,
  ProviderOperationalStatus,
  CredentialType,
} from './types';

export type ProviderEventType =
  | 'provider.created'
  | 'provider.profile_updated'
  | 'provider.verification_submitted'
  | 'provider.verified'
  | 'provider.verification_rejected'
  | 'provider.suspended'
  | 'provider.reinstated'
  | 'provider.credential_added'
  | 'provider.credential_verified'
  | 'provider.credential_expired'
  | 'business.created'
  | 'business.member_added'
  | 'business.member_removed'
  | 'service_offering.created'
  | 'service_offering.activated'
  | 'service_offering.paused'
  | 'provider.location_added'
  | 'provider.service_area_added'
  | 'provider.availability_updated'
  | 'provider.report_submitted'
  | 'provider.report_resolved';

export interface BaseProviderEvent {
  eventId: string;
  eventType: ProviderEventType;
  timestamp: string;
  actorUserId: UserId;
}

export interface ProviderCreatedEvent extends BaseProviderEvent {
  eventType: 'provider.created';
  providerId: ProviderId;
  userId: UserId;
  category: ProviderCategory;
  displayName: string;
}

export interface ProviderProfileUpdatedEvent extends BaseProviderEvent {
  eventType: 'provider.profile_updated';
  providerId: ProviderId;
  changes: Record<string, any>;
}

export interface ProviderVerificationSubmittedEvent extends BaseProviderEvent {
  eventType: 'provider.verification_submitted';
  providerId: ProviderId;
  caseId: VerificationCaseId;
  submittedCredentialCount: number;
}

export interface ProviderVerifiedEvent extends BaseProviderEvent {
  eventType: 'provider.verified';
  providerId: ProviderId;
  caseId: VerificationCaseId;
  reviewerUserId: UserId;
}

export interface ProviderVerificationRejectedEvent extends BaseProviderEvent {
  eventType: 'provider.verification_rejected';
  providerId: ProviderId;
  caseId: VerificationCaseId;
  reviewerUserId: UserId;
  rejectionReason: string;
}

export interface ProviderSuspendedEvent extends BaseProviderEvent {
  eventType: 'provider.suspended';
  providerId: ProviderId;
  reason: string;
  reviewerUserId: UserId;
}

export interface ProviderReinstatedEvent extends BaseProviderEvent {
  eventType: 'provider.reinstated';
  providerId: ProviderId;
  reviewerUserId: UserId;
}

export interface CredentialAddedEvent extends BaseProviderEvent {
  eventType: 'provider.credential_added';
  providerId: ProviderId;
  credentialId: CredentialId;
  credentialType: CredentialType;
}

export interface CredentialVerifiedEvent extends BaseProviderEvent {
  eventType: 'provider.credential_verified';
  providerId: ProviderId;
  credentialId: CredentialId;
  reviewerUserId: UserId;
}

export interface CredentialExpiredEvent extends BaseProviderEvent {
  eventType: 'provider.credential_expired';
  providerId: ProviderId;
  credentialId: CredentialId;
  credentialType: CredentialType;
}

export interface BusinessCreatedEvent extends BaseProviderEvent {
  eventType: 'business.created';
  businessId: BusinessId;
  tradingName: string;
  ownerUserId: UserId;
}

export interface BusinessMemberAddedEvent extends BaseProviderEvent {
  eventType: 'business.member_added';
  businessId: BusinessId;
  memberUserId: UserId;
  role: string;
}

export interface ServiceOfferingCreatedEvent extends BaseProviderEvent {
  eventType: 'service_offering.created';
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
  title: string;
  category: ProviderCategory;
}

export interface ServiceOfferingActivatedEvent extends BaseProviderEvent {
  eventType: 'service_offering.activated';
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
}

export interface ServiceOfferingPausedEvent extends BaseProviderEvent {
  eventType: 'service_offering.paused';
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
}

export interface ProviderLocationAddedEvent extends BaseProviderEvent {
  eventType: 'provider.location_added';
  providerId: ProviderId;
  locationId: LocationId;
  isPublic: boolean;
}

export interface ProviderReportSubmittedEvent extends BaseProviderEvent {
  eventType: 'provider.report_submitted';
  reportId: ProviderReportId;
  targetProviderId?: ProviderId;
  category: string;
}

export interface ProviderReportResolvedEvent extends BaseProviderEvent {
  eventType: 'provider.report_resolved';
  reportId: ProviderReportId;
  resolutionStatus: string;
}

export type ProviderDomainEvent =
  | ProviderCreatedEvent
  | ProviderProfileUpdatedEvent
  | ProviderVerificationSubmittedEvent
  | ProviderVerifiedEvent
  | ProviderVerificationRejectedEvent
  | ProviderSuspendedEvent
  | ProviderReinstatedEvent
  | CredentialAddedEvent
  | CredentialVerifiedEvent
  | CredentialExpiredEvent
  | BusinessCreatedEvent
  | BusinessMemberAddedEvent
  | ServiceOfferingCreatedEvent
  | ServiceOfferingActivatedEvent
  | ServiceOfferingPausedEvent
  | ProviderLocationAddedEvent
  | ProviderReportSubmittedEvent
  | ProviderReportResolvedEvent;
