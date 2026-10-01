/**
 * Pet OS Sprint 11 - Service Discovery & Booking Engine Domain Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture)
 * Normative Rules:
 * - Immutable, strongly typed domain event payloads
 * - Explicit causation & correlation tracking
 * - Safe for replay and idempotency
 */

import {
  BookingId,
  ReservationHoldId,
  BookingSeriesId,
  BookingAccessGrantId,
  RescheduleRequestId,
  BookingCancellationId,
  UserId,
  HouseholdId,
  PetId,
  ProviderId,
  BusinessId,
  ServiceOfferingId,
  EventId,
  CorrelationId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';
import {
  BookingStatus,
  ConfirmationMode,
  DeclineReasonCode,
  BookingAccessScope,
  RescheduleActor,
} from './types';

export interface BookingEventBase {
  eventId: EventId;
  correlationId?: CorrelationId;
  occurredAt: string;
  aggregateId: string;
  aggregateType: 'Booking' | 'ReservationHold' | 'BookingSeries' | 'BookingAccessGrant';
}

// 1. BookingRequested
export interface BookingRequestedEvent extends BookingEventBase {
  eventType: 'BookingRequested';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    ownerUserId: UserId;
    householdId: HouseholdId;
    providerId: ProviderId;
    businessId?: BusinessId;
    serviceOfferingId: ServiceOfferingId;
    startAt: string;
    endAt: string;
    petIds: PetId[];
    amountMinorUnits: number;
    currency: CurrencyCode;
    confirmationMode: ConfirmationMode;
    pendingExpiresAt?: string;
  };
}

// 2. BookingConfirmed
export interface BookingConfirmedEvent extends BookingEventBase {
  eventType: 'BookingConfirmed';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    ownerUserId: UserId;
    householdId: HouseholdId;
    providerId: ProviderId;
    businessId?: BusinessId;
    serviceOfferingId: ServiceOfferingId;
    startAt: string;
    endAt: string;
    petIds: PetId[];
    confirmationMode: ConfirmationMode;
    accessGrantId: BookingAccessGrantId;
  };
}

// 3. BookingAccepted
export interface BookingAcceptedEvent extends BookingEventBase {
  eventType: 'BookingAccepted';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    providerUserId: UserId;
    providerId: ProviderId;
    ownerUserId: UserId;
    confirmedAt: string;
    accessGrantId: BookingAccessGrantId;
  };
}

// 4. BookingDeclined
export interface BookingDeclinedEvent extends BookingEventBase {
  eventType: 'BookingDeclined';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    providerUserId: UserId;
    providerId: ProviderId;
    ownerUserId: UserId;
    reasonCode: DeclineReasonCode;
    capacityReleased: boolean;
  };
}

// 5. BookingExpired
export interface BookingExpiredEvent extends BookingEventBase {
  eventType: 'BookingExpired';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    ownerUserId: UserId;
    providerId: ProviderId;
    expiredAt: string;
    capacityReleased: boolean;
  };
}

// 6. BookingCancelledByOwner
export interface BookingCancelledByOwnerEvent extends BookingEventBase {
  eventType: 'BookingCancelledByOwner';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    cancellationId: BookingCancellationId;
    ownerUserId: UserId;
    providerId: ProviderId;
    reason: string;
    isLateCancellation: boolean;
    hoursBeforeStart: number;
    policyTier: string;
    cancelledAt: string;
  };
}

// 7. BookingCancelledByProvider
export interface BookingCancelledByProviderEvent extends BookingEventBase {
  eventType: 'BookingCancelledByProvider';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    cancellationId: BookingCancellationId;
    providerUserId: UserId;
    providerId: ProviderId;
    ownerUserId: UserId;
    reason: string;
    cancelledAt: string;
  };
}

// 8. BookingRescheduleRequested
export interface BookingRescheduleRequestedEvent extends BookingEventBase {
  eventType: 'BookingRescheduleRequested';
  aggregateType: 'Booking';
  payload: {
    requestId: RescheduleRequestId;
    bookingId: BookingId;
    requestedByUserId: UserId;
    actorType: RescheduleActor;
    originalStartAt: string;
    newStartAt: string;
    newEndAt: string;
    reason: string;
  };
}

// 9. BookingRescheduled
export interface BookingRescheduledEvent extends BookingEventBase {
  eventType: 'BookingRescheduled';
  aggregateType: 'Booking';
  payload: {
    requestId: RescheduleRequestId;
    bookingId: BookingId;
    newStartAt: string;
    newEndAt: string;
    originalStartAt: string;
    approvedByUserId: UserId;
  };
}

// 10. BookingRescheduleRejected
export interface BookingRescheduleRejectedEvent extends BookingEventBase {
  eventType: 'BookingRescheduleRejected';
  aggregateType: 'Booking';
  payload: {
    requestId: RescheduleRequestId;
    bookingId: BookingId;
    rejectionReason: string;
    originalScheduleRetained: boolean;
  };
}

// 11. ReservationHoldCreated
export interface ReservationHoldCreatedEvent extends BookingEventBase {
  eventType: 'ReservationHoldCreated';
  aggregateType: 'ReservationHold';
  payload: {
    holdId: ReservationHoldId;
    serviceOfferingId: ServiceOfferingId;
    providerId: ProviderId;
    startAt: string;
    endAt: string;
    capacityUnits: number;
    expiresAt: string;
  };
}

// 12. ReservationHoldExpired
export interface ReservationHoldExpiredEvent extends BookingEventBase {
  eventType: 'ReservationHoldExpired';
  aggregateType: 'ReservationHold';
  payload: {
    holdId: ReservationHoldId;
    serviceOfferingId: ServiceOfferingId;
    providerId: ProviderId;
    expiredAt: string;
  };
}

// 13. ReservationHoldReleased
export interface ReservationHoldReleasedEvent extends BookingEventBase {
  eventType: 'ReservationHoldReleased';
  aggregateType: 'ReservationHold';
  payload: {
    holdId: ReservationHoldId;
    releasedAt: string;
  };
}

// 14. BookingSeriesCreated
export interface BookingSeriesCreatedEvent extends BookingEventBase {
  eventType: 'BookingSeriesCreated';
  aggregateType: 'BookingSeries';
  payload: {
    seriesId: BookingSeriesId;
    ownerUserId: UserId;
    providerId: ProviderId;
    serviceOfferingId: ServiceOfferingId;
    horizonWeeks: number;
    occurrencesGeneratedCount: number;
  };
}

// 15. BookingOccurrenceGenerationFailed
export interface BookingOccurrenceGenerationFailedEvent extends BookingEventBase {
  eventType: 'BookingOccurrenceGenerationFailed';
  aggregateType: 'BookingSeries';
  payload: {
    seriesId: BookingSeriesId;
    occurrenceIndex: number;
    scheduledDate: string;
    conflictReason: string;
  };
}

// 16. BookingAccessGranted
export interface BookingAccessGrantedEvent extends BookingEventBase {
  eventType: 'BookingAccessGranted';
  aggregateType: 'BookingAccessGrant';
  payload: {
    grantId: BookingAccessGrantId;
    bookingId: BookingId;
    providerId: ProviderId;
    providerUserId: UserId;
    petIds: PetId[];
    scopes: BookingAccessScope[];
    validFrom: string;
    validUntil: string;
  };
}

// 17. BookingAccessRevoked
export interface BookingAccessRevokedEvent extends BookingEventBase {
  eventType: 'BookingAccessRevoked';
  aggregateType: 'BookingAccessGrant';
  payload: {
    grantId: BookingAccessGrantId;
    bookingId: BookingId;
    reason: string;
    revokedAt: string;
  };
}

// 18. AddressAccessedAudit
export interface AddressAccessedAuditEvent extends BookingEventBase {
  eventType: 'AddressAccessedAudit';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    accessorUserId: UserId;
    providerId: ProviderId;
    reason: 'SERVICE_HANDOFF_WINDOW_ACTIVE';
    accessedAt: string;
  };
}

// 19. Future Payment Integration (Non-financial event descriptor)
export interface BookingRequiresPaymentEvent extends BookingEventBase {
  eventType: 'BookingRequiresPayment';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    amountMinorUnits: number;
    currency: CurrencyCode;
    payerUserId: UserId;
    payeeProviderId: ProviderId;
  };
}

// 20. Future Cancellation Financial Review Event
export interface BookingCancellationFinancialReviewRequiredEvent extends BookingEventBase {
  eventType: 'BookingCancellationFinancialReviewRequired';
  aggregateType: 'Booking';
  payload: {
    bookingId: BookingId;
    cancellationId: BookingCancellationId;
    isLateCancellation: boolean;
    cancelledByActor: string;
  };
}

export type BookingDomainEvent =
  | BookingRequestedEvent
  | BookingConfirmedEvent
  | BookingAcceptedEvent
  | BookingDeclinedEvent
  | BookingExpiredEvent
  | BookingCancelledByOwnerEvent
  | BookingCancelledByProviderEvent
  | BookingRescheduleRequestedEvent
  | BookingRescheduledEvent
  | BookingRescheduleRejectedEvent
  | ReservationHoldCreatedEvent
  | ReservationHoldExpiredEvent
  | ReservationHoldReleasedEvent
  | BookingSeriesCreatedEvent
  | BookingOccurrenceGenerationFailedEvent
  | BookingAccessGrantedEvent
  | BookingAccessRevokedEvent
  | AddressAccessedAuditEvent
  | BookingRequiresPaymentEvent
  | BookingCancellationFinancialReviewRequiredEvent;
