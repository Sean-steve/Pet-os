/**
 * Pet OS Sprint 11 - Booking Platform Service
 * Implements Volume XII (Marketplace), Volume XIII (Dog Walking), Volume XIV (Workspaces),
 * Volume XVII (Payments Contract), Volume XXVI (Notifications), Volume XXIX (Events)
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
  SlotId,
  ProviderId,
  BusinessId,
  ServiceOfferingId,
  TimelineEventId,
  asBookingId,
  asReservationHoldId,
  asBookingSeriesId,
  asBookingAccessGrantId,
  asRescheduleRequestId,
  asBookingCancellationId,
  asSlotId,
  asTimelineEventId,
  asCorrelationId,
  asNotificationId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';
import {
  BookingAggregate,
  BookingStatus,
  ConfirmationMode,
  DeclineReasonCode,
  ReservationHold,
  AvailabilitySlot,
  SlotQuery,
  BookingInstructions,
  BookingServiceSnapshot,
  BookingPriceSnapshot,
  BookingPetSummarySnapshot,
  BookingCancellationPolicySnapshot,
  BookingAccessGrant,
  RescheduleRequest,
  BookingCancellation,
  RecurringBookingSeries,
  SeriesOccurrence,
  ServiceDiscoveryQuery,
  ServiceDiscoveryResult,
  PetEligibilityResult,
  OwnerBookingProjection,
  ProviderBookingProjection,
  FuturePaymentBookingContract,
  FutureDogWalkingBookingContract,
  FutureWorkspaceBookingContract,
} from './types';
import {
  assertLegalStatusTransition,
  assertNotSelfApproval,
  evaluatePetToServiceEligibility,
  STANDARD_CANCELLATION_POLICY,
  FLEXIBLE_CANCELLATION_POLICY,
  evaluateCancellationPolicy,
  maskDestinationAddress,
  calculateRequiredCapacity,
} from './policy';
import { BookingStore } from './store';
import { ProviderStore } from '../provider/store';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { TimelineStore } from '../timeline/store';
import { TimelineActorType, TimelineProvenanceType } from '../timeline/types';
import { NotificationStore } from '../notifications/store';
import { ServiceOffering } from '../provider/types';

export interface CreateBookingParams {
  ownerUserId: UserId;
  householdId: HouseholdId;
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  petIds: PetId[];
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  timezone?: string;
  instructions?: Partial<BookingInstructions>;
  idempotencyKey?: string;
  holdId?: ReservationHoldId;
}

export interface CreateRecurringSeriesParams {
  ownerUserId: UserId;
  householdId: HouseholdId;
  providerId: ProviderId;
  serviceOfferingId: ServiceOfferingId;
  serviceVariantId?: string;
  petIds: PetId[];
  daysOfWeek: number[]; // 1 = Monday, 3 = Wednesday, 5 = Friday
  scheduledTimeOfDay: string; // "09:00"
  durationMinutes: number;
  timezone?: string;
  startDate: string; // YYYY-MM-DD
  horizonWeeks?: number;
  instructions?: Partial<BookingInstructions>;
}

export class BookingPlatformService {
  private bookingStore: BookingStore;
  private providerStore: ProviderStore;

  constructor(
    bookingStore: BookingStore = BookingStore.getInstance(),
    providerStore: ProviderStore = ProviderStore.getInstance()
  ) {
    this.bookingStore = bookingStore;
    this.providerStore = providerStore;
  }

  private sendNotification(params: {
    recipientUserId: UserId;
    petId?: PetId;
    notificationType: any;
    sourceType: string;
    sourceId: string;
    title: string;
    body: string;
    priority?: any;
    channel?: any;
  }): void {
    const now = new Date().toISOString();
    const notifId = asNotificationId(`ntf-${generateUUIDv7()}`);
    NotificationStore.saveNotification({
      notificationId: notifId,
      recipientUserId: params.recipientUserId,
      petId: params.petId,
      notificationType: params.notificationType,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      title: params.title,
      body: params.body,
      channel: params.channel || 'IN_APP',
      priority: params.priority || 'HIGH',
      scheduledAt: now,
      sentAt: now,
      deliveredAt: now,
      status: 'DELIVERED',
      attemptCount: 1,
      maxAttempts: 3,
      deduplicationKey: `dedup-${notifId}`,
      isRead: false,
      isDismissed: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  private projectToTimeline(params: {
    petId: PetId;
    householdId: HouseholdId;
    eventType: string;
    occurredAt: string;
    sourceEntityId: string;
    sourceActorType: TimelineActorType;
    sourceActorId: string;
    provenanceType: TimelineProvenanceType;
    title: string;
    summary: string;
    structuredPayload?: Record<string, unknown>;
  }): void {
    const now = new Date().toISOString();
    const eventId = asTimelineEventId(`tle-${generateUUIDv7()}`);
    TimelineStore.save({
      timelineEventId: eventId,
      petId: params.petId,
      householdId: params.householdId,
      eventType: params.eventType,
      eventCategory: 'SERVICE',
      occurredAt: params.occurredAt,
      recordedAt: now,
      sourceDomain: 'SERVICES',
      sourceEntityType: 'BOOKING',
      sourceEntityId: params.sourceEntityId,
      sourceActorType: params.sourceActorType,
      sourceActorId: params.sourceActorId,
      provenanceType: params.provenanceType,
      title: params.title,
      summary: params.summary,
      structuredPayload: params.structuredPayload,
      visibility: 'HOUSEHOLD',
      status: 'ACTIVE',
      correlationId: asCorrelationId(`corr-${generateUUIDv7()}`),
      deduplicationKey: `dedup-${eventId}`,
      createdAt: now,
      updatedAt: now,
    });
  }

  // -------------------------------------------------------------------------
  // 1. Service Discovery & Search Engine
  // -------------------------------------------------------------------------

  discoverServices(query: ServiceDiscoveryQuery = {}): ServiceDiscoveryResult[] {
    const allOfferings = this.providerStore.listActiveOfferings();
    const results: ServiceDiscoveryResult[] = [];

    for (const offering of allOfferings) {
      const provider = this.providerStore.getProvider(offering.providerId);
      if (!provider) continue;

      // Organic eligibility rule: Provider must be ACTIVE and VERIFIED and PUBLIC
      if (provider.operationalStatus !== 'ACTIVE') continue;
      if (provider.verificationStatus !== 'VERIFIED') continue;
      if (provider.visibilityStatus !== 'PUBLIC') continue;

      // Filter by category
      if (query.serviceCategory && offering.category !== query.serviceCategory) continue;

      // Filter by species support
      if (query.targetSpecies) {
        const querySpecies = query.targetSpecies.toUpperCase();
        const supportedSpecies = (offering.targetSpecies || []).map(s => s.toUpperCase());
        if (!supportedSpecies.includes(querySpecies)) continue;
      }

      // Filter by pet size
      if (query.petSize && offering.sizeRestrictions && offering.sizeRestrictions.length > 0) {
        const querySize = query.petSize.toUpperCase();
        const supportedSizes = offering.sizeRestrictions.map(s => s.toUpperCase());
        if (!supportedSizes.includes(querySize)) continue;
      }

      // Filter by location type
      if (query.locationType && !offering.locationTypes.includes(query.locationType)) continue;

      // Filter by price range (minor units)
      if (query.minPriceMinorUnits !== undefined && offering.basePriceMinorUnits < query.minPriceMinorUnits) continue;
      if (query.maxPriceMinorUnits !== undefined && offering.basePriceMinorUnits > query.maxPriceMinorUnits) continue;

      // Verification only filter
      if (query.verifiedOnly && provider.verificationStatus !== 'VERIFIED') continue;

      // Business lookup
      const business = provider.primaryBusinessId
        ? this.providerStore.getBusiness(provider.primaryBusinessId)
        : undefined;

      // Trust badges
      const trustIndicators = this.providerStore.getTrustIndicatorsForProvider(provider.providerId);
      const trustBadges = trustIndicators.filter(t => t.isValid).map(t => t.badgeType);

      // Location summary
      const locations = this.providerStore.getLocationsForProvider(provider.providerId);
      const primaryLoc = locations.find(l => l.isPrimary) || locations[0];
      const publicCity = primaryLoc ? primaryLoc.city : 'Nairobi';

      // Service area
      const serviceAreas = this.providerStore.getServiceAreasForProvider(provider.providerId);
      const areaSummary = serviceAreas.length > 0
        ? serviceAreas.map(a => a.name).join(', ')
        : 'Metro Coverage Area';

      // Confirmation mode (instant for walking/grooming with active availability; approval for surgical vet or training)
      const confirmationMode: ConfirmationMode =
        offering.category === 'VETERINARIAN' || offering.title.toLowerCase().includes('consultation')
          ? 'PROVIDER_APPROVAL_REQUIRED'
          : 'INSTANT_CONFIRM';

      if (query.requiresInstantBook && confirmationMode !== 'INSTANT_CONFIRM') continue;

      results.push({
        serviceOfferingId: offering.serviceOfferingId,
        providerId: provider.providerId,
        providerDisplayName: provider.displayName,
        providerProfessionalTitle: provider.professionalTitle,
        providerCategory: provider.category,
        providerAvatarUrl: provider.avatarUrl,
        businessId: business?.businessId,
        businessName: business?.tradingName,
        trustBadges,
        serviceTitle: offering.title,
        serviceDescription: offering.description,
        durationMinutes: offering.defaultDurationMinutes,
        displayedPriceMinorUnits: offering.basePriceMinorUnits,
        currency: offering.currency,
        pricingModel: offering.pricingModel,
        locationTypes: offering.locationTypes,
        confirmationMode,
        targetSpecies: offering.targetSpecies,
        serviceAreaSummary: areaSummary,
        publicCity,
        hasUpcomingAvailability: true,
        nextAvailableSlotAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // 2. Pet Eligibility & Prerequisites
  // -------------------------------------------------------------------------

  evaluatePetEligibility(petId: PetId, offeringId: ServiceOfferingId): PetEligibilityResult {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet not found with ID '${petId}'.`);
    }

    const offering = this.providerStore.getServiceOffering(offeringId);
    if (!offering) {
      throw new Error(`Service offering not found with ID '${offeringId}'.`);
    }

    return evaluatePetToServiceEligibility(pet, offering);
  }

  // -------------------------------------------------------------------------
  // 3. Availability Engine & Slot Calculation
  // -------------------------------------------------------------------------

  calculateAvailabilitySlots(params: {
    providerId: ProviderId;
    serviceOfferingId: ServiceOfferingId;
    date: string; // YYYY-MM-DD
    timezone?: string;
    petCount?: number;
  }): AvailabilitySlot[] {
    const { providerId, serviceOfferingId, date, timezone = 'Africa/Nairobi', petCount = 1 } = params;

    const provider = this.providerStore.getProvider(providerId);
    if (!provider || provider.operationalStatus !== 'ACTIVE') {
      return [];
    }

    const offering = this.providerStore.getServiceOffering(serviceOfferingId);
    if (!offering || offering.status !== 'ACTIVE') {
      return [];
    }

    // 1. Check if provider has an exception (time-off, holiday, closure) on this date
    const exceptions = this.providerStore.getAvailabilityExceptionsForProvider(providerId);
    for (const exc of exceptions) {
      if (date >= exc.startDate && date <= exc.endDate) {
        if (exc.isAllDay) {
          // Entire day blocked by provider time-off or closure!
          return [];
        }
      }
    }

    // 2. Get weekly operating rules for day of week
    const targetDate = new Date(`${date}T00:00:00Z`);
    const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...

    const rules = this.providerStore.getAvailabilityRulesForProvider(providerId);
    const dayRules = rules.filter(r => r.dayOfWeek === dayOfWeek && r.isActive);
    if (dayRules.length === 0) {
      return [];
    }

    const requiredUnits = calculateRequiredCapacity(petCount);
    const durationMinutes = offering.defaultDurationMinutes || 45;
    const bufferBeforeMinutes = 10;
    const bufferAfterMinutes = 15;
    const stepMinutes = durationMinutes + bufferAfterMinutes;

    const slots: AvailabilitySlot[] = [];

    for (const rule of dayRules) {
      const [startHour, startMin] = rule.startTime.split(':').map(Number);
      const [endHour, endMin] = rule.endTime.split(':').map(Number);

      const ruleStartMs = targetDate.setUTCHours(startHour, startMin, 0, 0);
      const ruleEndMs = targetDate.setUTCHours(endHour, endMin, 0, 0);

      let currentSlotStartMs = ruleStartMs;
      while (currentSlotStartMs + durationMinutes * 60000 <= ruleEndMs) {
        const slotStartAt = new Date(currentSlotStartMs).toISOString();
        const slotEndAt = new Date(currentSlotStartMs + durationMinutes * 60000).toISOString();

        // Check consumed capacity
        const consumedCapacity = this.bookingStore.getConsumedCapacity(providerId, slotStartAt, slotEndAt);
        const totalCapacity = rule.maxConcurrentCapacity || 1;
        const availableCapacity = Math.max(0, totalCapacity - consumedCapacity);
        const isReservable = availableCapacity >= requiredUnits;

        const slotToken = `slot_${providerId}_${date}_${currentSlotStartMs}_${totalCapacity}`;

        slots.push({
          slotId: asSlotId(`slt-${generateUUIDv7()}`),
          providerId,
          businessId: provider.primaryBusinessId,
          serviceOfferingId,
          startAt: slotStartAt,
          endAt: slotEndAt,
          durationMinutes,
          bufferBeforeMinutes,
          bufferAfterMinutes,
          totalCapacity,
          consumedCapacity,
          availableCapacity,
          isReservable,
          timezone,
          slotToken,
        });

        currentSlotStartMs += stepMinutes * 60000;
      }
    }

    return slots;
  }

  // -------------------------------------------------------------------------
  // 4. Reservation Holds
  // -------------------------------------------------------------------------

  createReservationHold(params: {
    offeringId: ServiceOfferingId;
    providerId: ProviderId;
    customerUserId: UserId;
    householdId: HouseholdId;
    petIds: PetId[];
    startAt: string;
    endAt: string;
    capacityUnits?: number;
    durationSeconds?: number;
  }): ReservationHold {
    const capacityUnits = params.capacityUnits || params.petIds.length || 1;
    const durationSeconds = params.durationSeconds || 600; // 10 minutes default
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000).toISOString();

    const holdId = asReservationHoldId(`hld-${generateUUIDv7()}`);
    const hold: ReservationHold = {
      holdId,
      providerId: params.providerId,
      serviceOfferingId: params.offeringId,
      customerUserId: params.customerUserId,
      householdId: params.householdId,
      petIds: params.petIds,
      startAt: params.startAt,
      endAt: params.endAt,
      capacityUnits,
      status: 'ACTIVE',
      expiresAt,
      createdAt: now.toISOString(),
    };

    this.bookingStore.saveHold(hold);
    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'ReservationHoldCreated',
      aggregateId: holdId,
      aggregateType: 'ReservationHold',
      occurredAt: now.toISOString(),
      payload: {
        holdId,
        serviceOfferingId: params.offeringId,
        providerId: params.providerId,
        startAt: params.startAt,
        endAt: params.endAt,
        capacityUnits,
        expiresAt,
      },
    });

    return hold;
  }

  releaseReservationHold(holdId: ReservationHoldId): void {
    const hold = this.bookingStore.findHoldById(holdId);
    if (!hold || hold.status !== 'ACTIVE') return;

    hold.status = 'RELEASED';
    hold.releasedAt = new Date().toISOString();
    this.bookingStore.saveHold(hold);

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'ReservationHoldReleased',
      aggregateId: holdId,
      aggregateType: 'ReservationHold',
      occurredAt: new Date().toISOString(),
      payload: {
        holdId,
        releasedAt: hold.releasedAt,
      },
    });
  }

  // -------------------------------------------------------------------------
  // 5. Booking Creation (Instant Confirmation vs Request-to-Book)
  // -------------------------------------------------------------------------

  createBooking(params: CreateBookingParams): BookingAggregate {
    const now = new Date().toISOString();

    // 1. Idempotency Check
    if (params.idempotencyKey) {
      const existing = this.bookingStore.findBookingByIdempotencyKey(params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // 2. Validate Provider & Service Offering
    const provider = this.providerStore.getProvider(params.providerId);
    if (!provider || provider.operationalStatus !== 'ACTIVE') {
      throw new Error(`Provider '${params.providerId}' is not active or eligible for bookings.`);
    }

    const offering = this.providerStore.getServiceOffering(params.serviceOfferingId);
    if (!offering || offering.status !== 'ACTIVE') {
      throw new Error(`Service offering '${params.serviceOfferingId}' is not active.`);
    }

    // 3. Validate Pet(s) and Evaluate Eligibility
    const petCount = params.petIds.length;
    if (petCount === 0) {
      throw new Error('At least one pet must be selected for booking.');
    }

    if (offering.maxPetsPerBooking && petCount > offering.maxPetsPerBooking) {
      throw new Error(`Service permits maximum ${offering.maxPetsPerBooking} pets per booking. Requested: ${petCount}.`);
    }

    const petSnapshots: BookingPetSummarySnapshot[] = [];
    for (const petId of params.petIds) {
      const pet = PetStore.findPetById(petId);
      if (!pet) {
        throw new Error(`Pet '${petId}' not found.`);
      }
      if (pet.householdId !== params.householdId) {
        throw new Error(`Pet '${petId}' does not belong to household '${params.householdId}'.`);
      }

      const eligibility = evaluatePetToServiceEligibility(pet, offering);
      if (!eligibility.isEligible) {
        throw new Error(
          `Pet '${pet.name}' is ineligible for '${offering.title}': ${eligibility.reasons.join(' ')}`
        );
      }

      const prereqSatisfaction: Record<string, any> = {};
      for (const p of eligibility.prerequisites) {
        prereqSatisfaction[p.code] = p.state;
      }

      petSnapshots.push({
        petId: pet.petId,
        displayName: pet.name,
        species: pet.speciesCode,
        breed: pet.customBreedName || pet.breedCode,
        size: String(pet.metadata?.size || pet.sizeClassification || 'MEDIUM'),
        weightKg: typeof pet.metadata?.weightKg === 'number' ? pet.metadata.weightKg : undefined,
        ageYears: pet.dateOfBirth ? Math.floor((Date.now() - new Date(pet.dateOfBirth).getTime()) / (365 * 24 * 3600 * 1000)) : undefined,
        relevantAlerts: pet.metadata?.specialNeeds ? [String(pet.metadata.specialNeeds)] : undefined,
        prerequisiteSatisfaction: prereqSatisfaction,
      });
    }

    // 4. Capacity & Overbooking Concurrency Check
    const requiredCapacity = calculateRequiredCapacity(petCount);
    // Find rule capacity
    const rules = this.providerStore.getAvailabilityRulesForProvider(params.providerId);
    const maxCapacity = rules.length > 0 ? Math.max(...rules.map(r => r.maxConcurrentCapacity)) : 1;

    const allocated = this.bookingStore.atomicAllocateCapacity(
      params.providerId,
      params.startAt,
      params.endAt,
      requiredCapacity,
      maxCapacity
    );

    if (!allocated) {
      throw new Error(
        `SLOT_UNAVAILABLE: Insufficient provider capacity for slot [${params.startAt} - ${params.endAt}].`
      );
    }

    // 5. Consume Reservation Hold if provided
    if (params.holdId) {
      const hold = this.bookingStore.findHoldById(params.holdId);
      if (hold && hold.status === 'ACTIVE') {
        hold.status = 'CONSUMED';
        hold.consumedAt = now;
        this.bookingStore.saveHold(hold);
      }
    }

    // 6. Build Immutable Commercial Snapshots
    let variantTitle: string | undefined;
    let priceMinorUnits = offering.basePriceMinorUnits;
    if (params.serviceVariantId) {
      const variant = (offering.variants || []).find(v => v.variantId === params.serviceVariantId);
      if (variant) {
        variantTitle = variant.title;
        priceMinorUnits = variant.priceMinorUnits;
      }
    }

    // Multi-pet pricing calculation if applicable
    const totalPriceMinorUnits = priceMinorUnits * (petCount > 1 ? 1 + (petCount - 1) * 0.5 : 1);

    const confirmationMode: ConfirmationMode =
      offering.category === 'VETERINARIAN' || offering.title.toLowerCase().includes('consultation')
        ? 'PROVIDER_APPROVAL_REQUIRED'
        : 'INSTANT_CONFIRM';

    const serviceSnapshot: BookingServiceSnapshot = {
      serviceOfferingId: offering.serviceOfferingId,
      serviceVariantId: params.serviceVariantId,
      title: offering.title,
      variantTitle,
      category: offering.category,
      serviceDescription: offering.description,
      defaultDurationMinutes: offering.defaultDurationMinutes,
      locationType: offering.locationTypes[0] || 'CLIENT_LOCATION',
      confirmationMode,
      snapshotTimestamp: now,
    };

    const priceSnapshot: BookingPriceSnapshot = {
      amountMinorUnits: Math.round(totalPriceMinorUnits),
      currency: offering.currency,
      pricingModel: offering.pricingModel,
      baseAmountMinorUnits: priceMinorUnits,
      perPetAddonMinorUnits: petCount > 1 ? Math.round(priceMinorUnits * 0.5) : 0,
      petCount,
      taxIncluded: true,
      feeBasisReference: `PRC-REF-${offering.serviceOfferingId.slice(0, 8)}-${now.slice(0, 10)}`,
    };

    const cancellationPolicySnapshot: BookingCancellationPolicySnapshot =
      offering.category === 'DOG_WALKER'
        ? FLEXIBLE_CANCELLATION_POLICY
        : STANDARD_CANCELLATION_POLICY;

    const instructions: BookingInstructions = {
      pickupLocationNotes: params.instructions?.pickupLocationNotes || 'Main entrance gate',
      dropoffLocationNotes: params.instructions?.dropoffLocationNotes || 'Same as pickup',
      accessCodeOrKeyLocationMasked: params.instructions?.accessCodeOrKeyLocationMasked || 'Code: 4492 (Stored securely)',
      petHandlingNotes: params.instructions?.petHandlingNotes || 'Walk on standard 6ft harness. Enjoys grass sniffing.',
      emergencyContactName: params.instructions?.emergencyContactName || 'Elena Vance',
      emergencyContactPhone: params.instructions?.emergencyContactPhone || '+254700000001',
      specialDietOrMedicationAlert: params.instructions?.specialDietOrMedicationAlert,
    };

    const bookingId = asBookingId(`bkg-${generateUUIDv7()}`);

    // Initial Status depends on confirmation mode
    const status: BookingStatus =
      confirmationMode === 'INSTANT_CONFIRM' ? 'CONFIRMED' : 'PENDING_PROVIDER';

    const pendingExpiresAt =
      confirmationMode === 'PROVIDER_APPROVAL_REQUIRED'
        ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
        : undefined;

    let accessGrantId: BookingAccessGrantId | undefined;

    // 7. If instant book, immediately create BookingAccessGrant & Timeline projection
    if (status === 'CONFIRMED') {
      accessGrantId = asBookingAccessGrantId(`grt-${generateUUIDv7()}`);
      const grant: BookingAccessGrant = {
        grantId: accessGrantId,
        bookingId,
        providerId: provider.providerId,
        providerUserId: provider.userId,
        petIds: params.petIds,
        scopes: [
          'PET_IDENTITY_SUMMARY',
          'SERVICE_INSTRUCTIONS',
          'EMERGENCY_CONTACT',
          'RELEVANT_HEALTH_ALERTS',
        ],
        status: 'ACTIVE',
        validFrom: new Date(new Date(params.startAt).getTime() - 24 * 3600 * 1000).toISOString(),
        validUntil: new Date(new Date(params.endAt).getTime() + 4 * 3600 * 1000).toISOString(),
        grantedAt: now,
      };
      this.bookingStore.saveAccessGrant(grant);

      // Project to Pet Timeline
      for (const petId of params.petIds) {
        this.projectToTimeline({
          petId,
          householdId: params.householdId,
          eventType: 'SERVICE_BOOKED',
          occurredAt: params.startAt,
          sourceEntityId: bookingId,
          sourceActorType: 'USER',
          sourceActorId: params.ownerUserId,
          provenanceType: 'SYSTEM_GENERATED',
          title: `Service Confirmed: ${offering.title}`,
          summary: `Booked with ${provider.displayName} for ${new Date(params.startAt).toLocaleString('en-KE')}.`,
        });
      }

      // Notifications
      this.sendNotification({
        recipientUserId: params.ownerUserId,
        petId: params.petIds[0],
        notificationType: 'BOOKING_CONFIRMED',
        sourceType: 'BOOKING',
        sourceId: bookingId,
        title: 'Booking Confirmed',
        body: `Your booking for ${offering.title} with ${provider.displayName} is confirmed.`,
        priority: 'HIGH',
      });
    } else {
      // Pending request notification to provider
      this.sendNotification({
        recipientUserId: provider.userId,
        petId: params.petIds[0],
        notificationType: 'BOOKING_REQUESTED',
        sourceType: 'BOOKING',
        sourceId: bookingId,
        title: 'New Service Request',
        body: `New request for ${offering.title} on ${new Date(params.startAt).toLocaleDateString()}. Please accept or decline within 24 hours.`,
        priority: 'HIGH',
      });
    }

    const booking: BookingAggregate = {
      bookingId,
      ownerUserId: params.ownerUserId,
      householdId: params.householdId,
      providerId: params.providerId,
      businessId: provider.primaryBusinessId,
      serviceOfferingId: params.serviceOfferingId,
      serviceVariantId: params.serviceVariantId,
      status,
      confirmationMode,
      startAt: params.startAt,
      endAt: params.endAt,
      serviceDurationMinutes: offering.defaultDurationMinutes,
      timezone: params.timezone || 'Africa/Nairobi',
      petCount,
      petIds: params.petIds,
      petSnapshots,
      serviceSnapshot,
      priceSnapshot,
      cancellationPolicySnapshot,
      instructions,
      accessGrantId,
      holdId: params.holdId,
      concurrencyVersion: 1,
      pendingExpiresAt,
      requestedAt: now,
      confirmedAt: status === 'CONFIRMED' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (params.idempotencyKey) {
      booking.idempotencyKey = params.idempotencyKey;
      this.bookingStore.registerIdempotency(params.idempotencyKey, bookingId);
    }

    this.bookingStore.saveBooking(booking);

    // Emit Domain Events
    if (status === 'CONFIRMED') {
      this.bookingStore.emit({
        eventId: generateUUIDv7() as any,
        eventType: 'BookingConfirmed',
        aggregateId: bookingId,
        aggregateType: 'Booking',
        occurredAt: now,
        payload: {
          bookingId,
          ownerUserId: params.ownerUserId,
          householdId: params.householdId,
          providerId: params.providerId,
          businessId: provider.primaryBusinessId,
          serviceOfferingId: params.serviceOfferingId,
          startAt: params.startAt,
          endAt: params.endAt,
          petIds: params.petIds,
          confirmationMode,
          accessGrantId: accessGrantId!,
        },
      });
    } else {
      this.bookingStore.emit({
        eventId: generateUUIDv7() as any,
        eventType: 'BookingRequested',
        aggregateId: bookingId,
        aggregateType: 'Booking',
        occurredAt: now,
        payload: {
          bookingId,
          ownerUserId: params.ownerUserId,
          householdId: params.householdId,
          providerId: params.providerId,
          businessId: provider.primaryBusinessId,
          serviceOfferingId: params.serviceOfferingId,
          startAt: params.startAt,
          endAt: params.endAt,
          petIds: params.petIds,
          amountMinorUnits: priceSnapshot.amountMinorUnits,
          currency: priceSnapshot.currency,
          confirmationMode,
          pendingExpiresAt,
        },
      });
    }

    return booking;
  }

  // -------------------------------------------------------------------------
  // 6. Provider Approval Workflow (Accept / Decline)
  // -------------------------------------------------------------------------

  providerAcceptBooking(params: {
    bookingId: BookingId;
    providerUserId: UserId;
  }): BookingAggregate {
    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking '${params.bookingId}' not found.`);
    }

    // Zero Self-Approval Rule Enforcement!
    assertNotSelfApproval(params.providerUserId, booking.ownerUserId);

    assertLegalStatusTransition(booking.status, 'CONFIRMED', booking.bookingId);

    const now = new Date().toISOString();
    booking.status = 'CONFIRMED';
    booking.confirmedAt = now;
    booking.updatedAt = now;
    booking.concurrencyVersion += 1;

    // Create Booking Access Grant
    const grantId = asBookingAccessGrantId(`grt-${generateUUIDv7()}`);
    const grant: BookingAccessGrant = {
      grantId,
      bookingId: booking.bookingId,
      providerId: booking.providerId,
      providerUserId: params.providerUserId,
      petIds: booking.petIds,
      scopes: [
        'PET_IDENTITY_SUMMARY',
        'SERVICE_INSTRUCTIONS',
        'EMERGENCY_CONTACT',
        'RELEVANT_HEALTH_ALERTS',
      ],
      status: 'ACTIVE',
      validFrom: new Date(new Date(booking.startAt).getTime() - 24 * 3600 * 1000).toISOString(),
      validUntil: new Date(new Date(booking.endAt).getTime() + 4 * 3600 * 1000).toISOString(),
      grantedAt: now,
    };
    this.bookingStore.saveAccessGrant(grant);
    booking.accessGrantId = grantId;

    this.bookingStore.saveBooking(booking);

    // Project to Pet Timeline
    for (const petId of booking.petIds) {
      this.projectToTimeline({
        petId,
        householdId: booking.householdId,
        eventType: 'SERVICE_ACCEPTED',
        occurredAt: booking.startAt,
        sourceEntityId: booking.bookingId,
        sourceActorType: 'PROVIDER',
        sourceActorId: params.providerUserId,
        provenanceType: 'VERIFIED_PROFESSIONAL',
        title: `Service Accepted: ${booking.serviceSnapshot.title}`,
        summary: `Appointment confirmed by provider for ${new Date(booking.startAt).toLocaleString('en-KE')}.`,
      });
    }

    // Notifications
    this.sendNotification({
      recipientUserId: booking.ownerUserId,
      petId: booking.petIds[0],
      notificationType: 'BOOKING_ACCEPTED',
      sourceType: 'BOOKING',
      sourceId: booking.bookingId,
      title: 'Booking Request Accepted',
      body: `Your request for ${booking.serviceSnapshot.title} was accepted.`,
      priority: 'HIGH',
    });

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingAccepted',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        bookingId: booking.bookingId,
        providerUserId: params.providerUserId,
        providerId: booking.providerId,
        ownerUserId: booking.ownerUserId,
        confirmedAt: now,
        accessGrantId: grantId,
      },
    });

    return booking;
  }

  providerDeclineBooking(params: {
    bookingId: BookingId;
    providerUserId: UserId;
    reasonCode: DeclineReasonCode;
    internalNote?: string;
  }): BookingAggregate {
    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking '${params.bookingId}' not found.`);
    }

    assertLegalStatusTransition(booking.status, 'DECLINED', booking.bookingId);

    const now = new Date().toISOString();
    booking.status = 'DECLINED';
    booking.declinedAt = now;
    booking.updatedAt = now;
    booking.concurrencyVersion += 1;

    // Release Capacity
    const requiredCapacity = calculateRequiredCapacity(booking.petCount);
    this.bookingStore.releaseCapacity(booking.providerId, booking.startAt, booking.endAt, requiredCapacity);

    this.bookingStore.saveBooking(booking);

    // Notification to owner
    this.sendNotification({
      recipientUserId: booking.ownerUserId,
      petId: booking.petIds[0],
      notificationType: 'BOOKING_DECLINED',
      sourceType: 'BOOKING',
      sourceId: booking.bookingId,
      title: 'Booking Request Declined',
      body: `Your request for ${booking.serviceSnapshot.title} could not be accepted (${params.reasonCode}). No charges applied.`,
      priority: 'NORMAL',
    });

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingDeclined',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        bookingId: booking.bookingId,
        providerUserId: params.providerUserId,
        providerId: booking.providerId,
        ownerUserId: booking.ownerUserId,
        reasonCode: params.reasonCode,
        capacityReleased: true,
      },
    });

    return booking;
  }

  // -------------------------------------------------------------------------
  // 7. Rescheduling Workflow
  // -------------------------------------------------------------------------

  requestReschedule(params: {
    bookingId: BookingId;
    actorUserId: UserId;
    actorType: 'OWNER' | 'PROVIDER';
    newStartAt: string;
    newEndAt: string;
    reason: string;
  }): RescheduleRequest {
    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking '${params.bookingId}' not found.`);
    }

    assertLegalStatusTransition(booking.status, 'RESCHEDULE_PENDING', booking.bookingId);

    // Validate new slot capacity
    const requiredCapacity = calculateRequiredCapacity(booking.petCount);
    const rules = this.providerStore.getAvailabilityRulesForProvider(booking.providerId);
    const maxCapacity = rules.length > 0 ? Math.max(...rules.map(r => r.maxConcurrentCapacity)) : 1;

    const allocatedNew = this.bookingStore.atomicAllocateCapacity(
      booking.providerId,
      params.newStartAt,
      params.newEndAt,
      requiredCapacity,
      maxCapacity
    );

    if (!allocatedNew) {
      throw new Error('Proposed new time slot does not have sufficient capacity.');
    }

    const now = new Date().toISOString();
    const requestId = asRescheduleRequestId(`res-${generateUUIDv7()}`);
    const req: RescheduleRequest = {
      requestId,
      bookingId: booking.bookingId,
      requestedByUserId: params.actorUserId,
      actorType: params.actorType,
      originalStartAt: booking.startAt,
      originalEndAt: booking.endAt,
      newStartAt: params.newStartAt,
      newEndAt: params.newEndAt,
      reason: params.reason,
      status: 'PENDING',
      createdAt: now,
    };

    this.bookingStore.saveRescheduleRequest(req);

    booking.status = 'RESCHEDULE_PENDING';
    booking.activeRescheduleRequestId = requestId;
    booking.updatedAt = now;
    this.bookingStore.saveBooking(booking);

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingRescheduleRequested',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        requestId,
        bookingId: booking.bookingId,
        requestedByUserId: params.actorUserId,
        actorType: params.actorType,
        originalStartAt: booking.startAt,
        newStartAt: params.newStartAt,
        newEndAt: params.newEndAt,
        reason: params.reason,
      },
    });

    return req;
  }

  respondReschedule(params: {
    requestId: RescheduleRequestId;
    responderUserId: UserId;
    accept: boolean;
    rejectionReason?: string;
  }): BookingAggregate {
    const req = this.bookingStore.findRescheduleRequestById(params.requestId);
    if (!req || req.status !== 'PENDING') {
      throw new Error(`Reschedule request '${params.requestId}' is not pending.`);
    }

    const booking = this.bookingStore.findBookingById(req.bookingId);
    if (!booking) {
      throw new Error(`Booking '${req.bookingId}' not found.`);
    }

    const now = new Date().toISOString();
    const requiredCapacity = calculateRequiredCapacity(booking.petCount);

    if (params.accept) {
      req.status = 'ACCEPTED';
      req.resolvedAt = now;
      req.reviewedByUserId = params.responderUserId;
      this.bookingStore.saveRescheduleRequest(req);

      // Atomic Capacity Shift: Release old slot capacity (new slot capacity was already allocated on request)
      this.bookingStore.releaseCapacity(booking.providerId, req.originalStartAt, req.originalEndAt, requiredCapacity);

      // Update Booking Time and transition back to CONFIRMED
      booking.rescheduledFromBookingId = booking.bookingId;
      booking.startAt = req.newStartAt;
      booking.endAt = req.newEndAt;
      booking.status = 'CONFIRMED';
      booking.activeRescheduleRequestId = undefined;
      booking.updatedAt = now;
      booking.concurrencyVersion += 1;

      // Update Access Grant Window
      if (booking.accessGrantId) {
        const grant = this.bookingStore.findAccessGrantById(booking.accessGrantId);
        if (grant) {
          grant.validFrom = new Date(new Date(req.newStartAt).getTime() - 24 * 3600 * 1000).toISOString();
          grant.validUntil = new Date(new Date(req.newEndAt).getTime() + 4 * 3600 * 1000).toISOString();
          this.bookingStore.saveAccessGrant(grant);
        }
      }

      this.bookingStore.saveBooking(booking);

      // Project Reschedule to Timeline
      for (const petId of booking.petIds) {
        this.projectToTimeline({
          petId,
          householdId: booking.householdId,
          eventType: 'SERVICE_RESCHEDULED',
          occurredAt: req.newStartAt,
          sourceEntityId: booking.bookingId,
          sourceActorType: 'USER',
          sourceActorId: params.responderUserId,
          provenanceType: 'SYSTEM_GENERATED',
          title: `Service Rescheduled: ${booking.serviceSnapshot.title}`,
          summary: `Rescheduled from ${new Date(req.originalStartAt).toLocaleString('en-KE')} to ${new Date(req.newStartAt).toLocaleString('en-KE')}.`,
        });
      }

      this.bookingStore.emit({
        eventId: generateUUIDv7() as any,
        eventType: 'BookingRescheduled',
        aggregateId: booking.bookingId,
        aggregateType: 'Booking',
        occurredAt: now,
        payload: {
          requestId: req.requestId,
          bookingId: booking.bookingId,
          newStartAt: req.newStartAt,
          newEndAt: req.newEndAt,
          originalStartAt: req.originalStartAt,
          approvedByUserId: params.responderUserId,
        },
      });
    } else {
      // Rejected: Release the tentatively allocated new capacity, and revert booking to CONFIRMED with original schedule
      req.status = 'REJECTED';
      req.rejectionReason = params.rejectionReason || 'Declined by recipient.';
      req.resolvedAt = now;
      req.reviewedByUserId = params.responderUserId;
      this.bookingStore.saveRescheduleRequest(req);

      this.bookingStore.releaseCapacity(booking.providerId, req.newStartAt, req.newEndAt, requiredCapacity);

      booking.status = 'CONFIRMED';
      booking.activeRescheduleRequestId = undefined;
      booking.updatedAt = now;
      this.bookingStore.saveBooking(booking);

      this.bookingStore.emit({
        eventId: generateUUIDv7() as any,
        eventType: 'BookingRescheduleRejected',
        aggregateId: booking.bookingId,
        aggregateType: 'Booking',
        occurredAt: now,
        payload: {
          requestId: req.requestId,
          bookingId: booking.bookingId,
          rejectionReason: req.rejectionReason,
          originalScheduleRetained: true,
        },
      });
    }

    return booking;
  }

  // -------------------------------------------------------------------------
  // 8. Cancellations (Owner vs Provider)
  // -------------------------------------------------------------------------

  cancelBookingByOwner(params: {
    bookingId: BookingId;
    ownerUserId: UserId;
    reason: string;
  }): BookingAggregate {
    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking '${params.bookingId}' not found.`);
    }

    if (booking.ownerUserId !== params.ownerUserId) {
      throw new Error('Unauthorized: Only the booking owner can cancel this booking.');
    }

    assertLegalStatusTransition(booking.status, 'CANCELLED_BY_OWNER', booking.bookingId);

    const now = new Date().toISOString();
    const policyResult = evaluateCancellationPolicy(
      booking.startAt,
      now,
      booking.cancellationPolicySnapshot
    );

    const cancellationId = asBookingCancellationId(`ccl-${generateUUIDv7()}`);
    const cancellation: BookingCancellation = {
      cancellationId,
      bookingId: booking.bookingId,
      cancelledByUserId: params.ownerUserId,
      actorType: 'OWNER',
      reason: params.reason,
      isLateCancellation: policyResult.isLateCancellation,
      hoursBeforeStart: policyResult.hoursBeforeStart,
      policyTierApplied: booking.cancellationPolicySnapshot.policyTier,
      futureRemediationRequired: false,
      cancelledAt: now,
    };
    this.bookingStore.saveCancellation(cancellation);

    // Release capacity
    const requiredCapacity = calculateRequiredCapacity(booking.petCount);
    this.bookingStore.releaseCapacity(booking.providerId, booking.startAt, booking.endAt, requiredCapacity);

    // Revoke Access Grant
    if (booking.accessGrantId) {
      const grant = this.bookingStore.findAccessGrantById(booking.accessGrantId);
      if (grant) {
        grant.status = 'REVOKED';
        grant.revokedAt = now;
        grant.revocationReason = 'OWNER_CANCELLED';
        this.bookingStore.saveAccessGrant(grant);
      }
    }

    booking.status = 'CANCELLED_BY_OWNER';
    booking.cancelledAt = now;
    booking.cancellationId = cancellationId;
    booking.updatedAt = now;
    booking.concurrencyVersion += 1;
    this.bookingStore.saveBooking(booking);

    // Project Cancellation to Pet Timeline
    for (const petId of booking.petIds) {
      this.projectToTimeline({
        petId,
        householdId: booking.householdId,
        eventType: 'SERVICE_CANCELLED_BY_OWNER',
        occurredAt: now,
        sourceEntityId: booking.bookingId,
        sourceActorType: 'USER',
        sourceActorId: params.ownerUserId,
        provenanceType: 'OWNER_ENTERED',
        title: `Service Cancelled: ${booking.serviceSnapshot.title}`,
        summary: `Cancelled by owner (${params.reason}). Policy applied: ${booking.cancellationPolicySnapshot.policyTier}.`,
      });
    }

    // Notifications
    const provider = this.providerStore.getProvider(booking.providerId);
    if (provider) {
      this.sendNotification({
        recipientUserId: provider.userId,
        petId: booking.petIds[0],
        notificationType: 'BOOKING_CANCELLED',
        sourceType: 'BOOKING',
        sourceId: booking.bookingId,
        title: 'Booking Cancelled by Customer',
        body: `Booking for ${booking.serviceSnapshot.title} on ${new Date(booking.startAt).toLocaleDateString()} was cancelled. Slot capacity released.`,
        priority: 'NORMAL',
      });
    }

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingCancelledByOwner',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        bookingId: booking.bookingId,
        cancellationId,
        ownerUserId: params.ownerUserId,
        providerId: booking.providerId,
        reason: params.reason,
        isLateCancellation: policyResult.isLateCancellation,
        hoursBeforeStart: policyResult.hoursBeforeStart,
        policyTier: booking.cancellationPolicySnapshot.policyTier,
        cancelledAt: now,
      },
    });

    return booking;
  }

  cancelBookingByProvider(params: {
    bookingId: BookingId;
    providerUserId: UserId;
    reason: string;
  }): BookingAggregate {
    const booking = this.bookingStore.findBookingById(params.bookingId);
    if (!booking) {
      throw new Error(`Booking '${params.bookingId}' not found.`);
    }

    assertLegalStatusTransition(booking.status, 'CANCELLED_BY_PROVIDER', booking.bookingId);

    const now = new Date().toISOString();
    const cancellationId = asBookingCancellationId(`ccl-${generateUUIDv7()}`);
    const cancellation: BookingCancellation = {
      cancellationId,
      bookingId: booking.bookingId,
      cancelledByUserId: params.providerUserId,
      actorType: 'PROVIDER',
      reason: params.reason,
      isLateCancellation: false,
      hoursBeforeStart: 0,
      policyTierApplied: 'PROVIDER_DEFAULT',
      futureRemediationRequired: true, // Flag for Sprint 12 refund / re-booking credit
      cancelledAt: now,
    };
    this.bookingStore.saveCancellation(cancellation);

    // Release capacity
    const requiredCapacity = calculateRequiredCapacity(booking.petCount);
    this.bookingStore.releaseCapacity(booking.providerId, booking.startAt, booking.endAt, requiredCapacity);

    // Revoke Access Grant
    if (booking.accessGrantId) {
      const grant = this.bookingStore.findAccessGrantById(booking.accessGrantId);
      if (grant) {
        grant.status = 'REVOKED';
        grant.revokedAt = now;
        grant.revocationReason = 'PROVIDER_CANCELLED';
        this.bookingStore.saveAccessGrant(grant);
      }
    }

    booking.status = 'CANCELLED_BY_PROVIDER';
    booking.cancelledAt = now;
    booking.cancellationId = cancellationId;
    booking.updatedAt = now;
    booking.concurrencyVersion += 1;
    this.bookingStore.saveBooking(booking);

    // Project to Timeline
    for (const petId of booking.petIds) {
      this.projectToTimeline({
        petId,
        householdId: booking.householdId,
        eventType: 'SERVICE_CANCELLED_BY_PROVIDER',
        occurredAt: now,
        sourceEntityId: booking.bookingId,
        sourceActorType: 'PROVIDER',
        sourceActorId: params.providerUserId,
        provenanceType: 'VERIFIED_PROFESSIONAL',
        title: `Service Cancelled by Provider: ${booking.serviceSnapshot.title}`,
        summary: `Cancelled by provider due to: ${params.reason}.`,
      });
    }

    // Owner Notification
    this.sendNotification({
      recipientUserId: booking.ownerUserId,
      petId: booking.petIds[0],
      notificationType: 'BOOKING_CANCELLED',
      sourceType: 'BOOKING',
      sourceId: booking.bookingId,
      title: 'Booking Cancelled by Provider',
      body: `Your provider had to cancel ${booking.serviceSnapshot.title} for ${new Date(booking.startAt).toLocaleDateString()} (${params.reason}). We apologize for the inconvenience.`,
      priority: 'CRITICAL',
    });

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingCancelledByProvider',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        bookingId: booking.bookingId,
        cancellationId,
        providerUserId: params.providerUserId,
        providerId: booking.providerId,
        ownerUserId: booking.ownerUserId,
        reason: params.reason,
        cancelledAt: now,
      },
    });

    // Future Payment Integration Event
    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingCancellationFinancialReviewRequired',
      aggregateId: booking.bookingId,
      aggregateType: 'Booking',
      occurredAt: now,
      payload: {
        bookingId: booking.bookingId,
        cancellationId,
        isLateCancellation: false,
        cancelledByActor: 'PROVIDER',
      },
    });

    return booking;
  }

  // -------------------------------------------------------------------------
  // 9. Recurring Booking Series
  // -------------------------------------------------------------------------

  createRecurringSeries(params: CreateRecurringSeriesParams): {
    series: RecurringBookingSeries;
    occurrences: SeriesOccurrence[];
  } {
    const now = new Date().toISOString();
    const seriesId = asBookingSeriesId(`srs-${generateUUIDv7()}`);
    const horizonWeeks = params.horizonWeeks || 4;

    const series: RecurringBookingSeries = {
      seriesId,
      ownerUserId: params.ownerUserId,
      householdId: params.householdId,
      providerId: params.providerId,
      serviceOfferingId: params.serviceOfferingId,
      serviceVariantId: params.serviceVariantId,
      petIds: params.petIds,
      frequency: 'WEEKLY',
      daysOfWeek: params.daysOfWeek,
      scheduledTimeOfDay: params.scheduledTimeOfDay,
      durationMinutes: params.durationMinutes,
      timezone: params.timezone || 'Africa/Nairobi',
      startDate: params.startDate,
      horizonWeeks,
      status: 'ACTIVE',
      instructions: {
        emergencyContactName: params.instructions?.emergencyContactName || 'Elena Vance',
        emergencyContactPhone: params.instructions?.emergencyContactPhone || '+254700000001',
        pickupLocationNotes: params.instructions?.pickupLocationNotes || 'Standard recurring gate pickup',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.bookingStore.saveRecurringSeries(series);

    // Generate Bounded Horizon Occurrences
    const occurrences: SeriesOccurrence[] = [];
    const [hours, minutes] = params.scheduledTimeOfDay.split(':').map(Number);
    const startBase = new Date(`${params.startDate}T00:00:00Z`);

    let occurrenceIndex = 1;
    for (let dayOffset = 0; dayOffset < horizonWeeks * 7; dayOffset++) {
      const currentDay = new Date(startBase.getTime() + dayOffset * 24 * 3600 * 1000);
      const dayOfWeek = currentDay.getUTCDay() === 0 ? 7 : currentDay.getUTCDay(); // 1 = Mon .. 7 = Sun

      if (params.daysOfWeek.includes(dayOfWeek)) {
        const dateStr = currentDay.toISOString().split('T')[0];
        const slotStart = new Date(currentDay);
        slotStart.setUTCHours(hours, minutes, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + params.durationMinutes * 60000);

        // Check provider availability exceptions for this date
        const exceptions = this.providerStore.getAvailabilityExceptionsForProvider(params.providerId);
        const hasConflict = exceptions.some(e => dateStr >= e.startDate && dateStr <= e.endDate && e.isAllDay);

        if (hasConflict) {
          // Explicit requirement: if conflict, flag as REQUIRES_ATTENTION without silently shifting time!
          occurrences.push({
            seriesId,
            occurrenceIndex,
            scheduledDate: dateStr,
            startAt: slotStart.toISOString(),
            endAt: slotEnd.toISOString(),
            status: 'REQUIRES_ATTENTION',
            conflictReason: 'Provider has scheduled time-off / holiday on this date.',
          });

          this.bookingStore.emit({
            eventId: generateUUIDv7() as any,
            eventType: 'BookingOccurrenceGenerationFailed',
            aggregateId: seriesId,
            aggregateType: 'BookingSeries',
            occurredAt: now,
            payload: {
              seriesId,
              occurrenceIndex,
              scheduledDate: dateStr,
              conflictReason: 'Provider scheduled time-off',
            },
          });
        } else {
          // Reserve slot and create booking for occurrence
          try {
            const booking = this.createBooking({
              ownerUserId: params.ownerUserId,
              householdId: params.householdId,
              providerId: params.providerId,
              serviceOfferingId: params.serviceOfferingId,
              serviceVariantId: params.serviceVariantId,
              petIds: params.petIds,
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              timezone: params.timezone,
              instructions: series.instructions,
            });

            booking.recurringSeriesId = seriesId;
            this.bookingStore.saveBooking(booking);

            occurrences.push({
              seriesId,
              occurrenceIndex,
              scheduledDate: dateStr,
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              status: 'BOOKED',
              bookingId: booking.bookingId,
            });
          } catch (err: any) {
            occurrences.push({
              seriesId,
              occurrenceIndex,
              scheduledDate: dateStr,
              startAt: slotStart.toISOString(),
              endAt: slotEnd.toISOString(),
              status: 'REQUIRES_ATTENTION',
              conflictReason: err?.message || 'Capacity conflict',
            });
          }
        }
        occurrenceIndex += 1;
      }
    }

    this.bookingStore.saveOccurrences(seriesId, occurrences);

    this.bookingStore.emit({
      eventId: generateUUIDv7() as any,
      eventType: 'BookingSeriesCreated',
      aggregateId: seriesId,
      aggregateType: 'BookingSeries',
      occurredAt: now,
      payload: {
        seriesId,
        ownerUserId: params.ownerUserId,
        providerId: params.providerId,
        serviceOfferingId: params.serviceOfferingId,
        horizonWeeks,
        occurrencesGeneratedCount: occurrences.length,
      },
    });

    return { series, occurrences };
  }

  // -------------------------------------------------------------------------
  // 10. Background Processing Workers
  // -------------------------------------------------------------------------

  processExpiredHolds(): number {
    const now = new Date().toISOString();
    const holds = this.bookingStore.listAllHolds();
    let expiredCount = 0;

    for (const hold of holds) {
      if (hold.status === 'ACTIVE' && hold.expiresAt < now) {
        hold.status = 'EXPIRED';
        this.bookingStore.saveHold(hold);
        expiredCount += 1;

        this.bookingStore.emit({
          eventId: generateUUIDv7() as any,
          eventType: 'ReservationHoldExpired',
          aggregateId: hold.holdId,
          aggregateType: 'ReservationHold',
          occurredAt: now,
          payload: {
            holdId: hold.holdId,
            serviceOfferingId: hold.serviceOfferingId,
            providerId: hold.providerId,
            expiredAt: now,
          },
        });
      }
    }

    return expiredCount;
  }

  processExpiredRequests(): number {
    const now = new Date().toISOString();
    const bookings = this.bookingStore.listAllBookings();
    let expiredCount = 0;

    for (const booking of bookings) {
      if (
        booking.status === 'PENDING_PROVIDER' &&
        booking.pendingExpiresAt &&
        booking.pendingExpiresAt < now
      ) {
        booking.status = 'EXPIRED';
        booking.updatedAt = now;
        booking.concurrencyVersion += 1;

        // Release capacity
        const requiredCapacity = calculateRequiredCapacity(booking.petCount);
        this.bookingStore.releaseCapacity(booking.providerId, booking.startAt, booking.endAt, requiredCapacity);

        this.bookingStore.saveBooking(booking);
        expiredCount += 1;

        // Notify owner
        this.sendNotification({
          recipientUserId: booking.ownerUserId,
          petId: booking.petIds[0],
          notificationType: 'BOOKING_EXPIRED',
          sourceType: 'BOOKING',
          sourceId: booking.bookingId,
          title: 'Booking Request Expired',
          body: `Your request for ${booking.serviceSnapshot.title} was not confirmed within the 24-hour window and has expired.`,
          priority: 'NORMAL',
        });

        this.bookingStore.emit({
          eventId: generateUUIDv7() as any,
          eventType: 'BookingExpired',
          aggregateId: booking.bookingId,
          aggregateType: 'Booking',
          occurredAt: now,
          payload: {
            bookingId: booking.bookingId,
            ownerUserId: booking.ownerUserId,
            providerId: booking.providerId,
            expiredAt: now,
            capacityReleased: true,
          },
        });
      }
    }

    return expiredCount;
  }

  // -------------------------------------------------------------------------
  // 11. Segregated Read Models
  // -------------------------------------------------------------------------

  getOwnerBookingProjections(ownerUserId: UserId): OwnerBookingProjection[] {
    const bookings = this.bookingStore.listBookingsByOwner(ownerUserId);
    const projections: OwnerBookingProjection[] = [];

    for (const b of bookings) {
      const provider = this.providerStore.getProvider(b.providerId);
      const providerName = provider ? provider.displayName : 'Verified Provider';
      const petNames = b.petSnapshots.map(p => p.displayName);

      // Mask address based on booking status and scheduled time
      const masked = maskDestinationAddress(
        '14 Elgon Court, Ralph Bunche Rd, Kilimani, Nairobi',
        b.status,
        b.startAt
      );

      const priceFormatted = (b.priceSnapshot.amountMinorUnits / 100).toLocaleString('en-KE', {
        style: 'currency',
        currency: b.priceSnapshot.currency,
      });

      projections.push({
        bookingId: b.bookingId,
        status: b.status,
        confirmationMode: b.confirmationMode,
        providerName,
        providerCategory: b.serviceSnapshot.category,
        providerAvatarUrl: provider?.avatarUrl,
        serviceTitle: b.serviceSnapshot.title,
        startAt: b.startAt,
        endAt: b.endAt,
        durationMinutes: b.serviceDurationMinutes,
        timezone: b.timezone,
        petNames,
        totalPriceFormatted: priceFormatted,
        currency: b.priceSnapshot.currency,
        addressDisplay: masked.addressText,
        canCancel: b.status === 'CONFIRMED' || b.status === 'PENDING_PROVIDER',
        canReschedule: b.status === 'CONFIRMED',
        pendingExpiresAt: b.pendingExpiresAt,
        cancellationPolicySummary: b.cancellationPolicySnapshot.description,
        instructionsSummary: b.instructions.pickupLocationNotes || 'Standard handoff',
      });
    }

    // Sort upcoming first
    return projections.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  getProviderBookingProjections(providerId: ProviderId): ProviderBookingProjection[] {
    const bookings = this.bookingStore.listBookingsByProvider(providerId);
    const projections: ProviderBookingProjection[] = [];

    for (const b of bookings) {
      const owner = IdentityStore.findUserById(b.ownerUserId);
      const ownerName = owner ? owner.normalizedEmail.split('@')[0] : 'Client';

      const masked = maskDestinationAddress(
        '14 Elgon Court, Ralph Bunche Rd, Kilimani, Nairobi',
        b.status,
        b.startAt
      );

      const priceFormatted = (b.priceSnapshot.amountMinorUnits / 100).toLocaleString('en-KE', {
        style: 'currency',
        currency: b.priceSnapshot.currency,
      });

      const pets = b.petSnapshots.map(p => ({
        name: p.displayName,
        species: p.species,
        breed: p.breed,
        size: p.size,
        alerts: p.relevantAlerts,
      }));

      const isExpired = Boolean(
        b.status === 'PENDING_PROVIDER' && b.pendingExpiresAt && b.pendingExpiresAt < new Date().toISOString()
      );

      projections.push({
        bookingId: b.bookingId,
        status: b.status,
        confirmationMode: b.confirmationMode,
        ownerDisplayName: ownerName,
        serviceTitle: b.serviceSnapshot.title,
        startAt: b.startAt,
        endAt: b.endAt,
        durationMinutes: b.serviceDurationMinutes,
        timezone: b.timezone,
        pets,
        totalPriceFormatted: priceFormatted,
        destinationAddress: masked.addressText,
        instructions: b.instructions,
        requestedAt: b.requestedAt,
        pendingExpiresAt: b.pendingExpiresAt,
        isExpired,
      });
    }

    return projections.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  // -------------------------------------------------------------------------
  // 12. Future Integration Contracts
  // -------------------------------------------------------------------------

  getFuturePaymentContract(bookingId: BookingId): FuturePaymentBookingContract {
    const booking = this.bookingStore.findBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    return {
      contractVersion: '1.0',
      bookingId: booking.bookingId,
      bookingStatus: booking.status,
      amountMinorUnits: booking.priceSnapshot.amountMinorUnits,
      currency: booking.priceSnapshot.currency,
      pricingModel: booking.priceSnapshot.pricingModel,
      payerUserId: booking.ownerUserId,
      payeeProviderId: booking.providerId,
      payeeBusinessId: booking.businessId,
      serviceStartAt: booking.startAt,
      cancellationPolicyTier: booking.cancellationPolicySnapshot.policyTier,
      freeCancellationCutoffHours: booking.cancellationPolicySnapshot.freeCancellationCutoffHours,
      feeBasisReference: booking.priceSnapshot.feeBasisReference,
      isCancellable: booking.status === 'CONFIRMED' || booking.status === 'PENDING_PROVIDER',
    };
  }

  getFutureDogWalkingContract(bookingId: BookingId): FutureDogWalkingBookingContract {
    const booking = this.bookingStore.findBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    if (booking.serviceSnapshot.category !== 'DOG_WALKER') {
      throw new Error('Future Dog Walking contract is only valid for dog walking services.');
    }

    if (!booking.accessGrantId) {
      throw new Error('Confirmed access grant is required for Dog Walking execution contract.');
    }

    const grant = this.bookingStore.findAccessGrantById(booking.accessGrantId);

    return {
      contractVersion: '1.0',
      bookingId: booking.bookingId,
      bookingStatus: booking.status as any,
      walkerProviderId: booking.providerId,
      scheduledWindow: {
        startAt: booking.startAt,
        endAt: booking.endAt,
        durationMinutes: booking.serviceDurationMinutes,
      },
      pets: booking.petSnapshots.map(p => ({
        petId: p.petId,
        name: p.displayName,
        breed: p.breed,
        size: p.size,
        leashNotes: booking.instructions.petHandlingNotes,
        behaviorConsiderations: p.relevantAlerts,
      })),
      pickupHandoffNotes: booking.instructions.pickupLocationNotes || 'Standard front gate handoff',
      emergencyContact: {
        name: booking.instructions.emergencyContactName,
        phone: booking.instructions.emergencyContactPhone,
      },
      accessGrantId: booking.accessGrantId,
      authorizedScopes: grant?.scopes || ['PET_IDENTITY_SUMMARY', 'SERVICE_INSTRUCTIONS'],
    };
  }

  getFutureWorkspaceContract(bookingId: BookingId): FutureWorkspaceBookingContract {
    const booking = this.bookingStore.findBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking '${bookingId}' not found.`);
    }

    let workspaceType: FutureWorkspaceBookingContract['workspaceType'] = 'VETERINARY';
    if (booking.serviceSnapshot.category === 'TRAINER') workspaceType = 'TRAINER';
    else if (booking.serviceSnapshot.category === 'GROOMER') workspaceType = 'GROOMER';
    else if (booking.serviceSnapshot.category === 'BOARDING_PROVIDER') workspaceType = 'BOARDING';

    return {
      contractVersion: '1.0',
      bookingId: booking.bookingId,
      workspaceType,
      providerId: booking.providerId,
      serviceOfferingId: booking.serviceOfferingId,
      scheduledAt: booking.startAt,
      durationMinutes: booking.serviceDurationMinutes,
      petCount: booking.petCount,
      petSummary: booking.petSnapshots.map(p => ({
        petId: p.petId,
        name: p.displayName,
        species: p.species,
        prerequisiteStates: p.prerequisiteSatisfaction,
      })),
    };
  }
}
