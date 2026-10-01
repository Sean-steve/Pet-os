/**
 * Pet OS Sprint 11 - Service Discovery, Availability, Booking, Reservation,
 * Rescheduling & Cancellation Engine Domain Types
 * 
 * Implements Volume XII (Pet Services Marketplace), Volume XIII (Dog Walking Platform),
 * Volume XIV (Professional Workspaces), Volume XVII (Payment Contracts),
 * Volume XXVI (Notifications), Volume XXVIII (API Specifications), Volume XXXI (Privacy & Security)
 * 
 * Normative Rules:
 * - Clear separation between DISCOVERABLE, AVAILABLE, ELIGIBLE, RESERVABLE, and BOOKED
 * - Deterministic server-side availability calculation (operating hours, exceptions, buffers, capacity)
 * - Atomic concurrency control & overbooking prevention
 * - Strict minimum necessary pet access grants (no full medical history to non-clinical providers)
 * - Address privacy masking for at-home and mobile services
 * - Immutable booking snapshots for service, price (minor units), pet, and cancellation policy
 * - Explicit rescheduling & cancellation state transitions with preserved history
 */

import {
  UserId,
  HouseholdId,
  PetId,
  BookingId,
  ReservationHoldId,
  BookingSeriesId,
  BookingAccessGrantId,
  RescheduleRequestId,
  BookingCancellationId,
  CapacityAllocationId,
  SlotId,
  ProviderId,
  BusinessId,
  ServiceOfferingId,
  LocationId,
  TimelineEventId,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';
import {
  ProviderCategory,
  ServiceLocationType,
  PricingModel,
  TrustBadgeType,
} from '../provider/types';

// ---------------------------------------------------------------------------
// Booking State Machine
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PROVIDER'       // Awaiting provider manual approval
  | 'CONFIRMED'              // Confirmed via instant-book or provider acceptance
  | 'DECLINED'               // Provider declined request
  | 'EXPIRED'                // Pending request expired without provider action
  | 'CANCELLED_BY_OWNER'     // Owner cancelled
  | 'CANCELLED_BY_PROVIDER'  // Provider cancelled
  | 'RESCHEDULE_PENDING'     // Reschedule requested, pending confirmation
  | 'IN_PROGRESS'            // Service currently underway (future execution)
  | 'COMPLETED'              // Service completed (future execution)
  | 'NO_SHOW'                // Customer or provider did not show up (future execution)
  | 'DISPUTED';              // Dispute opened (future execution)

export type ConfirmationMode = 'INSTANT_CONFIRM' | 'PROVIDER_APPROVAL_REQUIRED';

export type ReservationHoldStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';

export type DeclineReasonCode =
  | 'UNAVAILABLE'
  | 'PET_NOT_ELIGIBLE'
  | 'CAPACITY'
  | 'SERVICE_MISMATCH'
  | 'OUT_OF_SERVICE_AREA'
  | 'OTHER';

export type RescheduleActor = 'OWNER' | 'PROVIDER' | 'SYSTEM';

export type RescheduleStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type BookingCancellationActor = 'OWNER' | 'PROVIDER' | 'SYSTEM' | 'ADMIN';

// ---------------------------------------------------------------------------
// Minimum Necessary Pet Access Scopes
// ---------------------------------------------------------------------------

export type BookingAccessScope =
  | 'PET_IDENTITY_SUMMARY'   // Name, species, breed, photo, size
  | 'SERVICE_INSTRUCTIONS'   // Handling, leash notes, feeding/walking preferences
  | 'EMERGENCY_CONTACT'      // Designated contact name & phone
  | 'RELEVANT_HEALTH_ALERTS'; // Allergies, bite risk, mobility alerts only (NO full medical record)

export type BookingAccessGrantStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

// ---------------------------------------------------------------------------
// Eligibility & Prerequisite Evaluation
// ---------------------------------------------------------------------------

export type PetEligibilityStatus =
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'REQUIRES_INFORMATION'
  | 'REQUIRES_DOCUMENT'
  | 'REQUIRES_PROVIDER_REVIEW';

export type PrerequisiteSatisfactionState =
  | 'REQUIREMENT_SATISFIED'
  | 'REQUIREMENT_NOT_SATISFIED'
  | 'REQUIREMENT_UNKNOWN';

export interface PrerequisiteCheckItem {
  code: string;
  title: string;
  description: string;
  state: PrerequisiteSatisfactionState;
  reason?: string;
}

export interface PetEligibilityResult {
  petId: PetId;
  status: PetEligibilityStatus;
  isEligible: boolean;
  speciesSupported: boolean;
  sizeSupported: boolean;
  prerequisites: PrerequisiteCheckItem[];
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Availability & Slots
// ---------------------------------------------------------------------------

export interface AvailabilitySlot {
  slotId: SlotId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceOfferingId: ServiceOfferingId;
  locationId?: LocationId;
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  totalCapacity: number;
  consumedCapacity: number;
  availableCapacity: number;
  isReservable: boolean;
  timezone: string;
  slotToken: string; // Cryptographic / opaque concurrency token
}

export interface SlotQuery {
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  timezone?: string;
  petCount?: number;
}

// ---------------------------------------------------------------------------
// Reservation Holds (Short-lived capacity locks)
// ---------------------------------------------------------------------------

export interface ReservationHold {
  holdId: ReservationHoldId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceOfferingId: ServiceOfferingId;
  customerUserId: UserId;
  householdId: HouseholdId;
  petIds: PetId[];
  startAt: string;
  endAt: string;
  capacityUnits: number;
  status: ReservationHoldStatus;
  expiresAt: string; // e.g., 10 minutes from creation
  createdAt: string;
  consumedAt?: string;
  releasedAt?: string;
}

// ---------------------------------------------------------------------------
// Snapshots (Immutable Commercial & Pet Records)
// ---------------------------------------------------------------------------

export interface BookingServiceSnapshot {
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  title: string;
  variantTitle?: string;
  category: ProviderCategory;
  serviceDescription: string;
  defaultDurationMinutes: number;
  locationType: ServiceLocationType;
  confirmationMode: ConfirmationMode;
  snapshotTimestamp: string;
}

export interface BookingPriceSnapshot {
  amountMinorUnits: number; // Integer minor units (e.g. 250000 = 2,500.00 KES)
  currency: CurrencyCode;
  pricingModel: PricingModel;
  baseAmountMinorUnits: number;
  perPetAddonMinorUnits?: number;
  petCount: number;
  taxIncluded: boolean;
  feeBasisReference: string; // Reference for Sprint 12 Payment handoff
}

export interface BookingPetSummarySnapshot {
  petId: PetId;
  displayName: string;
  species: string;
  breed?: string;
  size?: string;
  weightKg?: number;
  ageYears?: number;
  relevantAlerts?: string[];
  prerequisiteSatisfaction: Record<string, PrerequisiteSatisfactionState>;
}

export interface BookingCancellationPolicySnapshot {
  policyTier: 'FLEXIBLE' | 'STANDARD' | 'STRICT';
  freeCancellationCutoffHours: number; // e.g. 24 hours before service start
  lateCancellationNotice: string;
  description: string;
}

export interface BookingInstructions {
  pickupLocationNotes?: string;
  dropoffLocationNotes?: string;
  accessCodeOrKeyLocationMasked?: string; // Revealed only to confirmed provider
  petHandlingNotes?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  specialDietOrMedicationAlert?: string;
}

// ---------------------------------------------------------------------------
// Core Aggregate: Booking
// ---------------------------------------------------------------------------

export interface BookingAggregate {
  bookingId: BookingId;
  ownerUserId: UserId;
  householdId: HouseholdId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  locationId?: LocationId;
  status: BookingStatus;
  confirmationMode: ConfirmationMode;
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  serviceDurationMinutes: number;
  timezone: string;
  petCount: number;
  petIds: PetId[];
  petSnapshots: BookingPetSummarySnapshot[];
  serviceSnapshot: BookingServiceSnapshot;
  priceSnapshot: BookingPriceSnapshot;
  cancellationPolicySnapshot: BookingCancellationPolicySnapshot;
  instructions: BookingInstructions;
  accessGrantId?: BookingAccessGrantId;
  holdId?: ReservationHoldId;
  recurringSeriesId?: BookingSeriesId;
  rescheduledFromBookingId?: BookingId;
  activeRescheduleRequestId?: RescheduleRequestId;
  cancellationId?: BookingCancellationId;
  idempotencyKey?: string;
  concurrencyVersion: number;
  pendingExpiresAt?: string; // For PENDING_PROVIDER requests
  requestedAt: string;
  confirmedAt?: string;
  declinedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Booking-Scoped Pet Access Grant
// ---------------------------------------------------------------------------

export interface BookingAccessGrant {
  grantId: BookingAccessGrantId;
  bookingId: BookingId;
  providerId: ProviderId;
  providerUserId: UserId;
  petIds: PetId[];
  scopes: BookingAccessScope[];
  status: BookingAccessGrantStatus;
  validFrom: string; // Service start - 24 hours (for preparation)
  validUntil: string; // Service end + 4 hours (for post-service handoff)
  grantedAt: string;
  revokedAt?: string;
  revocationReason?: string;
}

// ---------------------------------------------------------------------------
// Reschedule Request
// ---------------------------------------------------------------------------

export interface RescheduleRequest {
  requestId: RescheduleRequestId;
  bookingId: BookingId;
  requestedByUserId: UserId;
  actorType: RescheduleActor;
  originalStartAt: string;
  originalEndAt: string;
  newStartAt: string;
  newEndAt: string;
  reason: string;
  status: RescheduleStatus;
  concurrencySlotToken?: string;
  reviewedByUserId?: UserId;
  rejectionReason?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Booking Cancellation Record
// ---------------------------------------------------------------------------

export interface BookingCancellation {
  cancellationId: BookingCancellationId;
  bookingId: BookingId;
  cancelledByUserId: UserId;
  actorType: BookingCancellationActor;
  reason: string;
  isLateCancellation: boolean;
  hoursBeforeStart: number;
  policyTierApplied: string;
  futureRemediationRequired: boolean; // Flag for Sprint 12 refund / fee processing
  cancelledAt: string;
}

// ---------------------------------------------------------------------------
// Recurring Booking Series
// ---------------------------------------------------------------------------

export type BookingRecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface RecurringBookingSeries {
  seriesId: BookingSeriesId;
  ownerUserId: UserId;
  householdId: HouseholdId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  petIds: PetId[];
  frequency: BookingRecurrenceFrequency;
  daysOfWeek: number[]; // 1 = Monday, ... 7 = Sunday
  scheduledTimeOfDay: string; // "10:00"
  durationMinutes: number;
  timezone: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  maxOccurrences?: number;
  horizonWeeks: number; // Bounded generation horizon (default 4 weeks)
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  instructions: BookingInstructions;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesOccurrence {
  seriesId: BookingSeriesId;
  occurrenceIndex: number;
  scheduledDate: string; // YYYY-MM-DD
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'BOOKED' | 'REQUIRES_ATTENTION' | 'SKIPPED' | 'FAILED';
  bookingId?: BookingId;
  conflictReason?: string;
}

// ---------------------------------------------------------------------------
// Discovery & Search Read Models
// ---------------------------------------------------------------------------

export interface ServiceDiscoveryQuery {
  serviceCategory?: ProviderCategory;
  serviceTypeId?: string;
  targetSpecies?: string; // e.g. "DOG", "CAT"
  petSize?: string;       // "SMALL", "MEDIUM", "LARGE"
  locationType?: ServiceLocationType;
  cityOrRegion?: string;
  preferredDate?: string; // YYYY-MM-DD
  preferredTimeOfDay?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  minPriceMinorUnits?: number;
  maxPriceMinorUnits?: number;
  requiresInstantBook?: boolean;
  verifiedOnly?: boolean;
}

export interface ServiceDiscoveryResult {
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  providerId: ProviderId;
  providerDisplayName: string;
  providerProfessionalTitle?: string;
  providerCategory: ProviderCategory;
  providerAvatarUrl?: string;
  businessId?: BusinessId;
  businessName?: string;
  trustBadges: TrustBadgeType[];
  serviceTitle: string;
  serviceDescription: string;
  durationMinutes: number;
  displayedPriceMinorUnits: number;
  currency: CurrencyCode;
  pricingModel: PricingModel;
  locationTypes: ServiceLocationType[];
  confirmationMode: ConfirmationMode;
  targetSpecies: string[];
  serviceAreaSummary?: string;
  publicCity: string;
  hasUpcomingAvailability: boolean;
  nextAvailableSlotAt?: string;
  ratingPlaceholder?: number;
}

// ---------------------------------------------------------------------------
// Segregated Read Projections
// ---------------------------------------------------------------------------

export interface OwnerBookingProjection {
  bookingId: BookingId;
  status: BookingStatus;
  confirmationMode: ConfirmationMode;
  providerName: string;
  providerCategory: ProviderCategory;
  providerAvatarUrl?: string;
  serviceTitle: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  timezone: string;
  petNames: string[];
  totalPriceFormatted: string;
  currency: CurrencyCode;
  addressDisplay: string; // Masked until confirmed
  canCancel: boolean;
  canReschedule: boolean;
  pendingExpiresAt?: string;
  cancellationPolicySummary: string;
  instructionsSummary: string;
}

export interface ProviderBookingProjection {
  bookingId: BookingId;
  status: BookingStatus;
  confirmationMode: ConfirmationMode;
  ownerDisplayName: string;
  serviceTitle: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  timezone: string;
  pets: Array<{
    name: string;
    species: string;
    breed?: string;
    size?: string;
    alerts?: string[];
  }>;
  totalPriceFormatted: string;
  destinationAddress: string; // Sanitized according to booking state & window
  instructions: BookingInstructions;
  requestedAt: string;
  pendingExpiresAt?: string;
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Future Integration Contracts
// ---------------------------------------------------------------------------

export interface FuturePaymentBookingContract {
  contractVersion: '1.0';
  bookingId: BookingId;
  bookingStatus: BookingStatus;
  amountMinorUnits: number;
  currency: CurrencyCode;
  pricingModel: PricingModel;
  payerUserId: UserId;
  payeeProviderId: ProviderId;
  payeeBusinessId?: BusinessId;
  serviceStartAt: string;
  cancellationPolicyTier: string;
  freeCancellationCutoffHours: number;
  feeBasisReference: string;
  isCancellable: boolean;
}

export interface FutureDogWalkingBookingContract {
  contractVersion: '1.0';
  bookingId: BookingId;
  bookingStatus: 'CONFIRMED' | 'IN_PROGRESS';
  walkerProviderId: ProviderId;
  scheduledWindow: {
    startAt: string;
    endAt: string;
    durationMinutes: number;
  };
  pets: Array<{
    petId: PetId;
    name: string;
    breed?: string;
    size?: string;
    leashNotes?: string;
    behaviorConsiderations?: string[];
  }>;
  pickupHandoffNotes: string;
  emergencyContact: {
    name: string;
    phone: string;
  };
  accessGrantId: BookingAccessGrantId;
  authorizedScopes: BookingAccessScope[];
}

export interface FutureWorkspaceBookingContract {
  contractVersion: '1.0';
  bookingId: BookingId;
  workspaceType: 'VETERINARY' | 'TRAINER' | 'GROOMER' | 'BOARDING';
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
  scheduledAt: string;
  durationMinutes: number;
  petCount: number;
  petSummary: Array<{
    petId: PetId;
    name: string;
    species: string;
    prerequisiteStates: Record<string, PrerequisiteSatisfactionState>;
  }>;
}
