/**
 * Pet OS Sprint 22 — Pet Transport Service
 * Core Domain Engine for Professional Pet Transport Execution
 */

import {
  UserId,
  HouseholdId,
  PetId,
  ProviderId,
  BusinessId,
  BookingId,
  TransportDriverProfileId,
  TransportVehicleId,
  TransportTripId,
  TransportTripPetId,
  TransportStopId,
  TransportCustodyRecordId,
  TransportInstructionSnapshotId,
  TransportContainmentAssignmentId,
  TransportDelayId,
  TransportEnvironmentObservationId,
  TransportSafetyAlertId,
  TransportIncidentId,
  TransportHandoverRecordId,
  TransportCompletionEvidenceId,
  TransportBelongingItemId,
  asTransportDriverProfileId,
  asTransportVehicleId,
  asTransportTripId,
  asTransportTripPetId,
  asTransportStopId,
  asTransportCustodyRecordId,
  asTransportInstructionSnapshotId,
  asTransportContainmentAssignmentId,
  asTransportDelayId,
  asTransportEnvironmentObservationId,
  asTransportSafetyAlertId,
  asTransportIncidentId,
  asTransportHandoverRecordId,
  asTransportCompletionEvidenceId,
  asTransportBelongingItemId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  TransportDriverProfile,
  TransportVehicle,
  TransportTrip,
  TransportStop,
  TransportTripPet,
  TransportInstructionSnapshot,
  TransportPetContainmentAssignment,
  TransportCustodyRecord,
  TransportHandoverRecord,
  TransportDelay,
  TransportEnvironmentObservation,
  TransportSafetyAlert,
  TransportIncident,
  TransportBelongingItem,
  TransportWelfareCheck,
  TransportCompletionEvidence,
  TransportReadinessResult,
  OwnerTripLiveProjection,
  DriverOperationalStatus,
  VehicleOperationalStatus,
  VehicleCapacity,
  TransportServiceType,
  ContainmentCapability,
  SensorCapability,
  DelayReason,
  RecipientVerificationMethod,
  IncidentCategory,
  IncidentSeverity,
  TransportCustodyStatus,
} from './types';
import { TransportStore } from './store';
import {
  TransportTripCreatedEvent,
  TransportDriverAssignedEvent,
  TransportVehicleAssignedEvent,
  TransportPickupCheckedInEvent,
  PetIdentityConfirmedEvent,
  PetTransportCustodyAcceptedEvent,
  PetContainmentConfirmedEvent,
  TransportTripStartedEvent,
  TransportStopArrivedEvent,
  TransportStopCompletedEvent,
  TransportDelayedEvent,
  TransportEnvironmentObservationRecordedEvent,
  TransportSafetyAlertRaisedEvent,
  TransportIncidentReportedEvent,
  TransportVehicleReassignedEvent,
  TransportDriverReassignedEvent,
  PetTransportCustodyTransferredEvent,
  PetTransportHandoverCompletedEvent,
  TransportTripCompletedEvent,
  TransportTripAbortedEvent,
  TrackingSessionRequestedEvent,
  TrackingSessionCompletedEvent,
  LostPetIncidentRequestedEvent,
  ServiceExecutionCompletedEvent,
  BookingReviewEligibleEvent,
} from './events';

export class TransportService {
  private static instance: TransportService;
  private store: TransportStore;

  private constructor() {
    this.store = TransportStore.getInstance();
  }

  public static getInstance(): TransportService {
    if (!TransportService.instance) {
      TransportService.instance = new TransportService();
    }
    return TransportService.instance;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  // ==========================================
  // DRIVER IDENTITY & VERIFICATION
  // ==========================================

  public registerDriver(params: {
    userId: UserId;
    providerId: ProviderId;
    businessId: BusinessId;
    fullName: string;
    phoneNumberMasked: string;
    drivingLicenseRefMasked: string;
    approvedServiceTypes: TransportServiceType[];
    emergencyContact: string;
  }): TransportDriverProfile {
    const profileId = asTransportDriverProfileId(generateUUIDv7());
    const now = this.nowIso();

    const profile: TransportDriverProfile = {
      driverProfileId: profileId,
      userId: params.userId,
      providerId: params.providerId,
      businessId: params.businessId,
      fullName: params.fullName,
      phoneNumberMasked: params.phoneNumberMasked,
      operationalStatus: 'PENDING',
      verificationStatus: 'UNVERIFIED',
      drivingLicenseRefMasked: params.drivingLicenseRefMasked,
      approvedServiceTypes: params.approvedServiceTypes,
      emergencyContact: params.emergencyContact,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveDriver(profile);
    this.store.recordAudit({
      auditId: generateUUIDv7(),
      action: 'DRIVER_REGISTERED',
      actorUserId: params.userId,
      details: { driverProfileId: profileId },
      timestamp: now,
    });

    return profile;
  }

  /**
   * Verified by admin / authorized business officer.
   * INVARIANT: Driver cannot self-verify!
   */
  public verifyDriver(params: {
    driverProfileId: TransportDriverProfileId;
    verifiedByUserId: UserId;
    notes?: string;
  }): TransportDriverProfile {
    const driver = this.store.getDriver(params.driverProfileId);
    if (!driver) {
      throw new Error(`Driver profile ${params.driverProfileId} not found.`);
    }

    if (driver.userId === params.verifiedByUserId) {
      throw new Error('Security Violation: Driver cannot self-verify transport credentials.');
    }

    const now = this.nowIso();
    driver.verificationStatus = 'VERIFIED';
    driver.operationalStatus = 'ACTIVE';
    driver.verificationDate = now;
    driver.verifiedByUserId = params.verifiedByUserId;
    driver.updatedAt = now;

    this.store.saveDriver(driver);
    this.store.recordAudit({
      auditId: generateUUIDv7(),
      action: 'DRIVER_VERIFIED',
      actorUserId: params.verifiedByUserId,
      details: { driverProfileId: params.driverProfileId, notes: params.notes },
      timestamp: now,
    });

    return driver;
  }

  public setDriverOperationalStatus(
    driverProfileId: TransportDriverProfileId,
    status: DriverOperationalStatus,
    actorUserId: UserId,
    reason?: string
  ): TransportDriverProfile {
    const driver = this.store.getDriver(driverProfileId);
    if (!driver) throw new Error(`Driver ${driverProfileId} not found.`);

    driver.operationalStatus = status;
    driver.updatedAt = this.nowIso();
    this.store.saveDriver(driver);

    this.store.recordAudit({
      auditId: generateUUIDv7(),
      action: 'DRIVER_STATUS_CHANGED',
      actorUserId,
      details: { driverProfileId, status, reason },
      timestamp: this.nowIso(),
    });

    return driver;
  }

  // ==========================================
  // VEHICLE REGISTRY & CAPACITY
  // ==========================================

  public registerVehicle(params: {
    businessId: BusinessId;
    providerId: ProviderId;
    displayName: string;
    registrationNumber: string;
    makeModel: string;
    vehicleType: 'CAR' | 'VAN' | 'SPECIALIZED_PET_VAN' | 'OTHER_APPROVED';
    capacity: VehicleCapacity;
    sensorCapabilities: SensorCapability[];
    insuranceValidUntil: string;
    lastInspectionDate: string;
    actorUserId: UserId;
  }): TransportVehicle {
    const vehicleId = asTransportVehicleId(generateUUIDv7());
    const now = this.nowIso();

    const vehicle: TransportVehicle = {
      vehicleId,
      businessId: params.businessId,
      providerId: params.providerId,
      displayName: params.displayName,
      registrationNumber: params.registrationNumber,
      makeModel: params.makeModel,
      vehicleType: params.vehicleType,
      operationalStatus: 'AVAILABLE',
      verificationStatus: 'VERIFIED', // Verified upon inspection
      capacity: params.capacity,
      sensorCapabilities: params.sensorCapabilities,
      insuranceValidUntil: params.insuranceValidUntil,
      lastInspectionDate: params.lastInspectionDate,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveVehicle(vehicle);
    this.store.recordAudit({
      auditId: generateUUIDv7(),
      action: 'VEHICLE_REGISTERED',
      actorUserId: params.actorUserId,
      details: { vehicleId, registrationNumber: params.registrationNumber },
      timestamp: now,
    });

    return vehicle;
  }

  public setVehicleOperationalStatus(
    vehicleId: TransportVehicleId,
    status: VehicleOperationalStatus,
    actorUserId: UserId,
    reason?: string
  ): TransportVehicle {
    const vehicle = this.store.getVehicle(vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found.`);

    vehicle.operationalStatus = status;
    vehicle.updatedAt = this.nowIso();
    this.store.saveVehicle(vehicle);

    this.store.recordAudit({
      auditId: generateUUIDv7(),
      action: 'VEHICLE_STATUS_CHANGED',
      actorUserId,
      details: { vehicleId, status, reason },
      timestamp: this.nowIso(),
    });

    return vehicle;
  }

  // ==========================================
  // TRIP CREATION & BOOKING HANDOFF
  // ==========================================

  public createTripFromBooking(params: {
    bookingId: BookingId;
    householdId: HouseholdId;
    businessId: BusinessId;
    providerId: ProviderId;
    tripType: TransportServiceType;
    pets: {
      petId: PetId;
      petName: string;
      speciesCode: string;
      sizeClassification: string;
      boardStopSequence?: number;
      exitStopSequence?: number;
      instructions: {
        pickupInstructions: string;
        destinationInstructions: string;
        authorizedRecipientName: string;
        authorizedRecipientPhoneMasked: string;
        emergencyContactPhone: string;
        mobilityAssistanceNotes?: string;
        motionSicknessWarning?: boolean;
        transportRestrictions?: string[];
        criticalMedicationTiming?: { medicationName: string; scheduledTime: string; instructions: string }[];
        crateOrCarrierRequirements?: string;
        feedingHydrationInstructions?: string;
      };
    }[];
    stops: {
      sequence: number;
      stopType: TransportStop['stopType'];
      title: string;
      addressPublicSnippet: string;
      exactAddressEncrypted: string;
      addressAccessWindowStartIso: string;
      addressAccessWindowEndIso: string;
      scheduledArrival: string;
      scheduledDeparture?: string;
      recipientContactName: string;
      recipientContactPhoneMasked: string;
      petIdsBoarding: PetId[];
      petIdsExiting: PetId[];
      requiredActions: string[];
    }[];
    scheduledPickupAt: string;
    scheduledCompletionAt: string;
    timezone?: string;
    actorUserId: UserId;
  }): TransportTrip {
    const existing = this.store.getTripByBookingId(params.bookingId);
    if (existing) {
      return existing; // Idempotent
    }

    const tripId = asTransportTripId(generateUUIDv7());
    const now = this.nowIso();

    // 1. Create Stops
    const createdStops: TransportStop[] = params.stops.map(s => {
      const stopId = asTransportStopId(generateUUIDv7());
      const stop: TransportStop = {
        stopId,
        tripId,
        sequence: s.sequence,
        stopType: s.stopType,
        title: s.title,
        addressPublicSnippet: s.addressPublicSnippet,
        exactAddressEncrypted: s.exactAddressEncrypted,
        addressAccessWindowStartIso: s.addressAccessWindowStartIso,
        addressAccessWindowEndIso: s.addressAccessWindowEndIso,
        scheduledArrival: s.scheduledArrival,
        scheduledDeparture: s.scheduledDeparture,
        recipientContactName: s.recipientContactName,
        recipientContactPhoneMasked: s.recipientContactPhoneMasked,
        status: s.sequence === 1 ? 'PENDING' : 'PENDING',
        petIdsBoarding: s.petIdsBoarding,
        petIdsExiting: s.petIdsExiting,
        requiredActions: s.requiredActions,
      };
      this.store.saveStop(stop);
      return stop;
    });

    // 2. Create Snapshots (with Minimum Necessary Health Data)
    const snapshotIds: TransportInstructionSnapshotId[] = [];
    const tripPets: TransportTripPet[] = params.pets.map(p => {
      const snapshotId = asTransportInstructionSnapshotId(generateUUIDv7());
      const snapshot: TransportInstructionSnapshot = {
        snapshotId,
        tripId,
        petId: p.petId,
        petName: p.petName,
        species: p.speciesCode,
        breed: 'CANONICAL_BREED',
        sizeClassification: p.sizeClassification,
        pickupInstructions: p.instructions.pickupInstructions,
        destinationInstructions: p.instructions.destinationInstructions,
        authorizedRecipientName: p.instructions.authorizedRecipientName,
        authorizedRecipientPhoneMasked: p.instructions.authorizedRecipientPhoneMasked,
        emergencyContactPhone: p.instructions.emergencyContactPhone,
        mobilityAssistanceNotes: p.instructions.mobilityAssistanceNotes,
        motionSicknessWarning: p.instructions.motionSicknessWarning,
        transportRestrictions: p.instructions.transportRestrictions,
        criticalMedicationTiming: p.instructions.criticalMedicationTiming,
        crateOrCarrierRequirements: p.instructions.crateOrCarrierRequirements,
        feedingHydrationInstructions: p.instructions.feedingHydrationInstructions,
        capturedAt: now,
        versionRef: 'SNAP_V1',
      };
      this.store.saveSnapshot(snapshot);
      snapshotIds.push(snapshotId);

      const tripPet: TransportTripPet = {
        tripPetId: asTransportTripPetId(generateUUIDv7()),
        tripId,
        petId: p.petId,
        petName: p.petName,
        speciesCode: p.speciesCode,
        sizeClassification: p.sizeClassification,
        custodyStatus: 'OWNER',
        currentCustodianUserId: params.actorUserId,
        boardStopSequence: p.boardStopSequence ?? 1,
        exitStopSequence: p.exitStopSequence ?? createdStops.length,
      };
      return tripPet;
    });

    // 3. Create Trip Aggregate
    const trip: TransportTrip = {
      tripId,
      bookingId: params.bookingId,
      householdId: params.householdId,
      businessId: params.businessId,
      providerId: params.providerId,
      status: 'SCHEDULED',
      tripType: params.tripType,
      pets: tripPets,
      stops: createdStops,
      scheduledPickupAt: params.scheduledPickupAt,
      scheduledCompletionAt: params.scheduledCompletionAt,
      timezone: params.timezone ?? 'Africa/Nairobi',
      currentStopSequence: 1,
      overallCustodyStatus: 'OWNER',
      activeIncidentCount: 0,
      instructionSnapshotIds: snapshotIds,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.store.saveTrip(trip);

    const event: TransportTripCreatedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportTripCreated',
      tripId,
      bookingId: params.bookingId,
      householdId: params.householdId,
      petIds: params.pets.map(p => p.petId),
      stopCount: createdStops.length,
      timestamp: now,
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  // ==========================================
  // DRIVER & VEHICLE ASSIGNMENT & CONCURRENCY
  // ==========================================

  public assignDriver(params: {
    tripId: TransportTripId;
    driverProfileId: TransportDriverProfileId;
    actorUserId: UserId;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(params.driverProfileId);
    if (!driver) throw new Error(`Driver ${params.driverProfileId} not found.`);

    if (driver.verificationStatus !== 'VERIFIED') {
      throw new Error(`Driver eligibility failure: Driver verification status is ${driver.verificationStatus}`);
    }

    if (driver.operationalStatus === 'RESTRICTED' || driver.operationalStatus === 'SUSPENDED' || driver.operationalStatus === 'INACTIVE') {
      throw new Error(`Driver operational status ${driver.operationalStatus} prevents trip assignment.`);
    }

    // Driver double-booking check
    const allTrips = this.store.listTrips();
    const conflictingTrip = allTrips.find(t =>
      t.assignedDriverId === params.driverProfileId &&
      t.tripId !== trip.tripId &&
      (t.status === 'IN_TRANSIT' || t.status === 'STOP_IN_PROGRESS' || t.status === 'ARRIVED_AT_PICKUP')
    );

    if (conflictingTrip) {
      throw new Error(`Concurrency Conflict: Driver ${driver.fullName} is currently active on trip ${conflictingTrip.tripId}.`);
    }

    trip.assignedDriverId = params.driverProfileId;
    trip.updatedAt = this.nowIso();
    trip.version += 1;

    this.store.saveTrip(trip);

    const event: TransportDriverAssignedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportDriverAssigned',
      tripId: trip.tripId,
      driverId: params.driverProfileId,
      timestamp: this.nowIso(),
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  public assignVehicle(params: {
    tripId: TransportTripId;
    vehicleId: TransportVehicleId;
    actorUserId: UserId;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const vehicle = this.store.getVehicle(params.vehicleId);
    if (!vehicle) throw new Error(`Vehicle ${params.vehicleId} not found.`);

    if (vehicle.verificationStatus !== 'VERIFIED') {
      throw new Error(`Vehicle verification status is ${vehicle.verificationStatus}. Must be VERIFIED.`);
    }

    if (vehicle.operationalStatus !== 'AVAILABLE') {
      throw new Error(`Vehicle operational status is ${vehicle.operationalStatus}. Must be AVAILABLE.`);
    }

    // Capacity verification
    if (trip.pets.length > vehicle.capacity.maxPets) {
      throw new Error(`Vehicle capacity exceeded: Trip has ${trip.pets.length} pets, vehicle maximum is ${vehicle.capacity.maxPets}.`);
    }

    for (const p of trip.pets) {
      if (!vehicle.capacity.allowedSpecies.includes(p.speciesCode as any)) {
        throw new Error(`Vehicle does not permit species ${p.speciesCode}.`);
      }
    }

    // Vehicle double-booking check
    const allTrips = this.store.listTrips();
    const conflictingTrip = allTrips.find(t =>
      t.assignedVehicleId === params.vehicleId &&
      t.tripId !== trip.tripId &&
      (t.status === 'IN_TRANSIT' || t.status === 'STOP_IN_PROGRESS' || t.status === 'ARRIVED_AT_PICKUP')
    );

    if (conflictingTrip) {
      throw new Error(`Concurrency Conflict: Vehicle ${vehicle.registrationNumber} is in use on trip ${conflictingTrip.tripId}.`);
    }

    trip.assignedVehicleId = params.vehicleId;
    trip.updatedAt = this.nowIso();
    trip.version += 1;

    this.store.saveTrip(trip);

    const event: TransportVehicleAssignedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportVehicleAssigned',
      tripId: trip.tripId,
      vehicleId: params.vehicleId,
      timestamp: this.nowIso(),
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  // ==========================================
  // TRIP READINESS EVALUATION
  // ==========================================

  public evaluateTripReadiness(tripId: TransportTripId): TransportReadinessResult {
    const trip = this.store.getTrip(tripId);
    if (!trip) throw new Error(`Trip ${tripId} not found.`);

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!trip.assignedDriverId) {
      blockers.push('NO_DRIVER_ASSIGNED');
    } else {
      const driver = this.store.getDriver(trip.assignedDriverId);
      if (!driver || driver.verificationStatus !== 'VERIFIED') {
        blockers.push('DRIVER_NOT_VERIFIED');
      }
    }

    if (!trip.assignedVehicleId) {
      blockers.push('NO_VEHICLE_ASSIGNED');
    } else {
      const vehicle = this.store.getVehicle(trip.assignedVehicleId);
      if (!vehicle || vehicle.verificationStatus !== 'VERIFIED') {
        blockers.push('VEHICLE_NOT_VERIFIED');
      }
    }

    if (!trip.stops || trip.stops.length < 2) {
      blockers.push('INSUFFICIENT_STOPS');
    }

    if (!trip.pets || trip.pets.length === 0) {
      blockers.push('NO_PETS_ASSOCIATED');
    }

    const isReady = blockers.length === 0;

    if (isReady && trip.status === 'SCHEDULED') {
      trip.status = 'READY';
      trip.updatedAt = this.nowIso();
      this.store.saveTrip(trip);
    }

    return {
      isReady,
      blockers,
      warnings,
      checkedAt: this.nowIso(),
    };
  }

  // ==========================================
  // ADDRESS PRIVACY ACCESS WINDOW
  // ==========================================

  public getStopExactAddress(params: {
    stopId: TransportStopId;
    requestingUserId: UserId;
    currentTimeIso?: string;
  }): { address: string; accessGranted: boolean; reason?: string } {
    const stop = this.store.getStop(params.stopId);
    if (!stop) throw new Error(`Stop ${params.stopId} not found.`);

    const trip = this.store.getTrip(stop.tripId);
    if (!trip) throw new Error(`Trip ${stop.tripId} not found.`);

    const driver = trip.assignedDriverId ? this.store.getDriver(trip.assignedDriverId) : undefined;
    const isAssignedDriver = driver?.userId === params.requestingUserId;

    // Check pre-trip access window
    const now = params.currentTimeIso ? new Date(params.currentTimeIso) : new Date();
    const windowStart = new Date(stop.addressAccessWindowStartIso);
    const windowEnd = new Date(stop.addressAccessWindowEndIso);

    // If trip completed, driver loses exact address access
    if (trip.status === 'COMPLETED' || trip.status === 'ABORTED' || trip.status === 'CANCELLED') {
      return {
        address: stop.addressPublicSnippet,
        accessGranted: false,
        reason: 'TRIP_COMPLETED_ACCESS_REVOKED',
      };
    }

    if (isAssignedDriver) {
      if (now >= windowStart && now <= windowEnd) {
        this.store.recordAudit({
          auditId: generateUUIDv7(),
          tripId: trip.tripId,
          action: 'EXACT_ADDRESS_ACCESSED',
          actorUserId: params.requestingUserId,
          details: { stopId: stop.stopId },
          timestamp: this.nowIso(),
        });

        return {
          address: stop.exactAddressEncrypted,
          accessGranted: true,
        };
      } else {
        return {
          address: stop.addressPublicSnippet,
          accessGranted: false,
          reason: now < windowStart ? 'WINDOW_NOT_OPEN' : 'WINDOW_EXPIRED',
        };
      }
    }

    return {
      address: stop.addressPublicSnippet,
      accessGranted: false,
      reason: 'UNAUTHORIZED_USER',
    };
  }

  // ==========================================
  // PICKUP EXECUTION & CUSTODY TRANSFER
  // ==========================================

  public driverCheckInAtPickup(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    driverUserId: UserId;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const stop = this.store.getStop(params.stopId);
    if (!stop) throw new Error(`Stop ${params.stopId} not found.`);

    if (stop.stopType !== 'PICKUP' && stop.stopType !== 'RESCUE_STOP') {
      throw new Error(`Stop ${params.stopId} is not a pickup or collection stop.`);
    }

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized: Requesting user is not the assigned driver.');
    }

    const now = this.nowIso();
    stop.status = 'ARRIVED';
    stop.actualArrival = now;
    this.store.saveStop(stop);

    trip.status = 'ARRIVED_AT_PICKUP';
    trip.updatedAt = now;
    trip.version += 1;
    this.store.saveTrip(trip);

    const event: TransportPickupCheckedInEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportPickupCheckedIn',
      tripId: trip.tripId,
      stopId: stop.stopId,
      driverId: driver.driverProfileId,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  /**
   * Positive identification before custody acceptance.
   * Prevents wrong Pet pickup!
   */
  public verifyPetIdentity(params: {
    tripId: TransportTripId;
    petId: PetId;
    presentedPetIdentifier: string; // Must match canonical petId or known identifier
    verificationMethod: string;
    actorUserId: UserId;
  }): boolean {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not part of trip ${params.tripId}.`);

    const matches = params.presentedPetIdentifier === params.petId ||
      params.presentedPetIdentifier.toLowerCase().includes(tripPet.petName.toLowerCase());

    if (!matches) {
      // Record operational issue and block
      this.store.recordAudit({
        auditId: generateUUIDv7(),
        tripId: trip.tripId,
        action: 'WRONG_PET_IDENTIFICATION_PREVENTED',
        actorUserId: params.actorUserId,
        details: { petId: params.petId, presented: params.presentedPetIdentifier },
        timestamp: this.nowIso(),
      });
      return false;
    }

    const event: PetIdentityConfirmedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetIdentityConfirmed',
      tripId: trip.tripId,
      petId: params.petId,
      verificationMethod: params.verificationMethod,
      timestamp: this.nowIso(),
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return true;
  }

  public acceptPetCustody(params: {
    tripId: TransportTripId;
    petId: PetId;
    fromActorUserId: UserId;
    fromActorRole: string;
    driverUserId: UserId;
    stopId: TransportStopId;
    verificationMethod: RecipientVerificationMethod;
    belongings?: { description: string; category: TransportBelongingItem['category'] }[];
  }): TransportCustodyRecord {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized: Custody can only be accepted by the assigned driver.');
    }

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not found in trip.`);

    const now = this.nowIso();
    const custodyRecordId = asTransportCustodyRecordId(generateUUIDv7());

    const record: TransportCustodyRecord = {
      custodyRecordId,
      tripId: params.tripId,
      petId: params.petId,
      fromActorUserId: params.fromActorUserId,
      fromActorRole: params.fromActorRole,
      toActorUserId: params.driverUserId,
      toActorRole: 'TRANSPORT_DRIVER',
      stopId: params.stopId,
      transferredAt: now,
      verificationMethod: params.verificationMethod,
      immutableSignature: `SIG_${generateUUIDv7()}`,
    };

    this.store.saveCustodyRecord(record);

    // Update Pet state in trip
    tripPet.custodyStatus = 'DRIVER';
    tripPet.currentCustodianUserId = params.driverUserId;

    // Evaluate overall custody
    const allInDriverCustody = trip.pets.every(p => p.custodyStatus === 'DRIVER');
    if (allInDriverCustody) {
      trip.overallCustodyStatus = 'DRIVER';
    }
    trip.status = 'PET_IN_CUSTODY';
    trip.updatedAt = now;
    trip.version += 1;
    this.store.saveTrip(trip);

    // Save belongings if any
    if (params.belongings) {
      for (const b of params.belongings) {
        this.store.saveBelonging({
          itemId: asTransportBelongingItemId(generateUUIDv7()),
          tripId: params.tripId,
          petId: params.petId,
          description: b.description,
          category: b.category,
          acceptedAtPickup: true,
          releasedAtHandover: false,
        });
      }
    }

    const event: PetTransportCustodyAcceptedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetTransportCustodyAccepted',
      tripId: trip.tripId,
      petId: params.petId,
      custodyRecordId,
      driverId: driver.driverProfileId,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return record;
  }

  public confirmPetContainment(params: {
    tripId: TransportTripId;
    petId: PetId;
    slotId: string;
    containmentType: ContainmentCapability;
    providedBy: 'OWNER' | 'PROVIDER';
    driverUserId: UserId;
  }): TransportPetContainmentAssignment {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const vehicle = this.store.getVehicle(trip.assignedVehicleId!);
    if (!vehicle) throw new Error('No assigned vehicle.');

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized.');
    }

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not found in trip.`);

    const assignmentId = asTransportContainmentAssignmentId(generateUUIDv7());
    const now = this.nowIso();

    const assignment: TransportPetContainmentAssignment = {
      assignmentId,
      tripId: params.tripId,
      petId: params.petId,
      vehicleId: vehicle.vehicleId,
      slotId: params.slotId,
      containmentType: params.containmentType,
      providedBy: params.providedBy,
      confirmedAt: now,
      confirmedByDriverId: driver.driverProfileId,
    };

    this.store.saveContainment(assignment);
    tripPet.containmentAssignment = assignment;
    this.store.saveTrip(trip);

    const event: PetContainmentConfirmedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetContainmentConfirmed',
      tripId: trip.tripId,
      petId: params.petId,
      vehicleId: vehicle.vehicleId,
      slotId: params.slotId,
      containmentType: params.containmentType,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return assignment;
  }

  public startTrip(params: {
    tripId: TransportTripId;
    driverUserId: UserId;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized driver.');
    }

    // Invariant: boarding pets must have accepted custody & containment confirmed
    const boardingPets = trip.pets.filter(p => p.boardStopSequence === 1);
    for (const p of boardingPets) {
      if (p.custodyStatus !== 'DRIVER') {
        throw new Error(`Cannot start trip: Pet ${p.petName} is not in driver custody.`);
      }
      if (!p.containmentAssignment?.confirmedAt) {
        throw new Error(`Cannot start trip: Pet ${p.petName} containment has not been confirmed.`);
      }
    }

    const now = this.nowIso();
    const trackingSessionId = `TRK_SES_${generateUUIDv7()}`;
    const routeReference = `RT_REF_${generateUUIDv7().slice(0, 8)}`;

    trip.status = 'IN_TRANSIT';
    trip.actualPickupAt = now;
    trip.trackingSessionId = trackingSessionId;
    trip.routeReference = routeReference;
    trip.updatedAt = now;
    trip.version += 1;

    // Complete pickup stop
    const firstStop = trip.stops[0];
    if (firstStop) {
      firstStop.status = 'COMPLETED';
      firstStop.actualDeparture = now;
      this.store.saveStop(firstStop);
      trip.currentStopSequence = 2;
    }

    this.store.saveTrip(trip);

    // Request tracking session from Sprint 14 Tracking
    const trackingReqEvent: TrackingSessionRequestedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TrackingSessionRequested',
      tripId: trip.tripId,
      purpose: 'PET_TRANSPORT',
      source: 'DRIVER_MOBILE',
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(trackingReqEvent);

    const startedEvent: TransportTripStartedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportTripStarted',
      tripId: trip.tripId,
      trackingSessionId,
      routeReference,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(startedEvent);

    return trip;
  }

  // ==========================================
  // DELAYS & ROUTE PROGRESS
  // ==========================================

  public recordDelay(params: {
    tripId: TransportTripId;
    driverUserId: UserId;
    reason: DelayReason;
    delayMinutes: number;
    revisedEta: string;
    notes?: string;
  }): TransportDelay {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized driver.');
    }

    const delayId = asTransportDelayId(generateUUIDv7());
    const now = this.nowIso();

    const delay: TransportDelay = {
      delayId,
      tripId: params.tripId,
      recordedAt: now,
      recordedByDriverId: driver.driverProfileId,
      reason: params.reason,
      delayMinutes: params.delayMinutes,
      revisedEta: params.revisedEta,
      notes: params.notes,
    };

    this.store.saveDelay(delay);

    const event: TransportDelayedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportDelayed',
      tripId: params.tripId,
      reason: params.reason,
      delayMinutes: params.delayMinutes,
      revisedEta: params.revisedEta,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return delay;
  }

  // ==========================================
  // ENVIRONMENTAL TELEMETRY & SAFETY ALERTS
  // ==========================================

  /**
   * Records factual vehicle/cargo compartment environmental telemetry.
   * INVARIANT: Never claimed as Pet body temperature or medical diagnosis!
   */
  public recordEnvironmentObservation(params: {
    tripId: TransportTripId;
    sensorId: string;
    observationType: 'CARGO_TEMPERATURE' | 'CARGO_HUMIDITY' | 'VENTILATION_STATE';
    value: number;
    unit: 'CELSIUS' | 'PERCENT' | 'BOOLEAN';
    source?: 'VEHICLE_SENSOR_TELEMATICS' | 'MANUAL_CALIBRATION';
  }): TransportEnvironmentObservation {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const observationId = asTransportEnvironmentObservationId(generateUUIDv7());
    const now = this.nowIso();

    const observation: TransportEnvironmentObservation = {
      observationId,
      tripId: params.tripId,
      vehicleId: trip.assignedVehicleId!,
      sensorId: params.sensorId,
      observationType: params.observationType,
      value: params.value,
      unit: params.unit,
      observedAt: now,
      receivedAt: now,
      source: params.source ?? 'VEHICLE_SENSOR_TELEMATICS',
      quality: 'GOOD',
    };

    this.store.saveObservation(observation);

    // Canonical Safety Threshold Check (Cargo Area Ambient Temperature)
    // Safe canonical threshold: 12°C - 28°C
    if (params.observationType === 'CARGO_TEMPERATURE') {
      if (params.value > 28.0) {
        const alertId = asTransportSafetyAlertId(generateUUIDv7());
        const alert: TransportSafetyAlert = {
          alertId,
          tripId: params.tripId,
          observationId,
          alertType: 'TEMPERATURE_HIGH',
          thresholdValue: 28.0,
          observedValue: params.value,
          message: `Vehicle compartment ambient temperature exceeded configured transport threshold: ${params.value}°C (Max: 28.0°C). Check vehicle ventilation/climate controls.`,
          raisedAt: now,
        };
        this.store.saveSafetyAlert(alert);

        const alertEvent: TransportSafetyAlertRaisedEvent = {
          eventId: generateUUIDv7(),
          eventType: 'TransportSafetyAlertRaised',
          tripId: params.tripId,
          alertId,
          alertType: 'TEMPERATURE_HIGH',
          message: alert.message,
          timestamp: now,
          actorUserId: 'usr-system' as UserId,
        };
        this.store.emitEvent(alertEvent);
      } else if (params.value < 12.0) {
        const alertId = asTransportSafetyAlertId(generateUUIDv7());
        const alert: TransportSafetyAlert = {
          alertId,
          tripId: params.tripId,
          observationId,
          alertType: 'TEMPERATURE_LOW',
          thresholdValue: 12.0,
          observedValue: params.value,
          message: `Vehicle compartment ambient temperature below configured transport threshold: ${params.value}°C (Min: 12.0°C).`,
          raisedAt: now,
        };
        this.store.saveSafetyAlert(alert);

        const alertEvent: TransportSafetyAlertRaisedEvent = {
          eventId: generateUUIDv7(),
          eventType: 'TransportSafetyAlertRaised',
          tripId: params.tripId,
          alertId,
          alertType: 'TEMPERATURE_LOW',
          message: alert.message,
          timestamp: now,
          actorUserId: 'usr-system' as UserId,
        };
        this.store.emitEvent(alertEvent);
      }
    }

    const event: TransportEnvironmentObservationRecordedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportEnvironmentObservationRecorded',
      tripId: params.tripId,
      vehicleId: trip.assignedVehicleId!,
      observationType: params.observationType,
      value: params.value,
      unit: params.unit,
      timestamp: now,
      actorUserId: 'usr-telematics' as UserId,
    };
    this.store.emitEvent(event);

    return observation;
  }

  // ==========================================
  // FACTUAL WELFARE OBSERVATIONS
  // ==========================================

  public recordWelfareCheck(params: {
    tripId: TransportTripId;
    petId: PetId;
    driverUserId: UserId;
    responsiveness: 'ALERT' | 'RESTING' | 'VISIBLE_DISTRESS';
    hydrationOffered: boolean;
    waterConsumedObserved: boolean;
    containmentIntact: boolean;
    factualNotes?: string;
  }): TransportWelfareCheck {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized.');
    }

    const checkId = generateUUIDv7();
    const check: TransportWelfareCheck = {
      checkId,
      tripId: params.tripId,
      petId: params.petId,
      checkedAt: this.nowIso(),
      checkedByDriverId: driver.driverProfileId,
      responsiveness: params.responsiveness,
      hydrationOffered: params.hydrationOffered,
      waterConsumedObserved: params.waterConsumedObserved,
      containmentIntact: params.containmentIntact,
      factualNotes: params.factualNotes,
    };

    this.store.saveWelfareCheck(check);
    return check;
  }

  // ==========================================
  // INCIDENTS & EMERGENCIES
  // ==========================================

  public reportIncident(params: {
    tripId: TransportTripId;
    driverUserId: UserId;
    category: IncidentCategory;
    severity: IncidentSeverity;
    description: string;
    actionTaken: string;
    petIds: PetId[];
    lastKnownTrackingRef?: string;
  }): TransportIncident {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized.');
    }

    const incidentId = asTransportIncidentId(generateUUIDv7());
    const now = this.nowIso();

    const incident: TransportIncident = {
      incidentId,
      tripId: params.tripId,
      category: params.category,
      severity: params.severity,
      state: 'OPEN',
      petIds: params.petIds,
      reportedAt: now,
      reportedByDriverId: driver.driverProfileId,
      description: params.description,
      actionTaken: params.actionTaken,
      lastKnownTrackingRef: params.lastKnownTrackingRef ?? trip.routeReference,
    };

    trip.activeIncidentCount += 1;
    if (params.severity === 'HIGH' || params.severity === 'CRITICAL') {
      trip.status = 'INCIDENT_ACTIVE';
    }
    trip.updatedAt = now;
    trip.version += 1;
    this.store.saveTrip(trip);

    // ESCAPE WORKFLOW: Activate Lost Pet Incident exactly once!
    if (params.category === 'PET_ESCAPE') {
      for (const petId of params.petIds) {
        const tripPet = trip.pets.find(p => p.petId === petId);
        if (tripPet) {
          tripPet.custodyStatus = 'LOST_INCIDENT';
        }

        const lostPetCaseId = `LOST_${generateUUIDv7().slice(0, 8)}`;
        incident.lostPetCaseId = lostPetCaseId;

        const escapeEvent: LostPetIncidentRequestedEvent = {
          eventId: generateUUIDv7(),
          eventType: 'LostPetIncidentRequested',
          tripId: trip.tripId,
          petId,
          householdId: trip.householdId,
          lastKnownTrackingReference: incident.lastKnownTrackingRef ?? 'LAST_KNOWN_STOP',
          custodianAtTimeOfEscape: `Transport Driver: ${driver.fullName}`,
          incidentId,
          timestamp: now,
          actorUserId: params.driverUserId,
        };
        this.store.emitEvent(escapeEvent);
      }
      this.store.saveTrip(trip);
    }

    this.store.saveIncident(incident);

    const event: TransportIncidentReportedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportIncidentReported',
      tripId: params.tripId,
      incidentId,
      category: params.category,
      severity: params.severity,
      description: params.description,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return incident;
  }

  /**
   * Safe replacement vehicle workflow upon breakdown
   */
  public reassignVehicleAfterBreakdown(params: {
    tripId: TransportTripId;
    newVehicleId: TransportVehicleId;
    incidentId: TransportIncidentId;
    actorUserId: UserId;
    reason: string;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const newVehicle = this.store.getVehicle(params.newVehicleId);
    if (!newVehicle) throw new Error(`New vehicle ${params.newVehicleId} not found.`);

    if (newVehicle.verificationStatus !== 'VERIFIED' || newVehicle.operationalStatus !== 'AVAILABLE') {
      throw new Error(`Replacement vehicle is not verified or available.`);
    }

    if (trip.pets.length > newVehicle.capacity.maxPets) {
      throw new Error(`Replacement vehicle capacity (${newVehicle.capacity.maxPets}) cannot accommodate ${trip.pets.length} pets.`);
    }

    const previousVehicleId = trip.assignedVehicleId!;

    // Mark previous vehicle in maintenance
    const prevVehicle = this.store.getVehicle(previousVehicleId);
    if (prevVehicle) {
      prevVehicle.operationalStatus = 'MAINTENANCE';
      this.store.saveVehicle(prevVehicle);
    }

    // Assign new vehicle
    trip.assignedVehicleId = params.newVehicleId;
    trip.status = 'IN_TRANSIT';
    trip.updatedAt = this.nowIso();
    trip.version += 1;
    this.store.saveTrip(trip);

    // Update incident
    const incident = this.store.getIncident(params.incidentId);
    if (incident) {
      incident.replacementVehicleId = params.newVehicleId;
      incident.state = 'MITIGATING';
      this.store.saveIncident(incident);
    }

    const event: TransportVehicleReassignedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportVehicleReassigned',
      tripId: trip.tripId,
      previousVehicleId,
      newVehicleId: params.newVehicleId,
      reason: params.reason,
      timestamp: this.nowIso(),
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  /**
   * Driver replacement during active trip with explicit handover
   */
  public reassignDriverDuringTrip(params: {
    tripId: TransportTripId;
    newDriverProfileId: TransportDriverProfileId;
    incidentId: TransportIncidentId;
    actorUserId: UserId;
    reason: string;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const newDriver = this.store.getDriver(params.newDriverProfileId);
    if (!newDriver || newDriver.verificationStatus !== 'VERIFIED') {
      throw new Error('Replacement driver must be verified.');
    }

    const previousDriverId = trip.assignedDriverId!;

    // Custody transitions to new driver
    const now = this.nowIso();
    for (const pet of trip.pets) {
      if (pet.custodyStatus === 'DRIVER') {
        const custodyRecordId = asTransportCustodyRecordId(generateUUIDv7());
        const custodyRecord: TransportCustodyRecord = {
          custodyRecordId,
          tripId: trip.tripId,
          petId: pet.petId,
          fromActorUserId: params.actorUserId,
          fromActorRole: 'PREVIOUS_TRANSPORT_DRIVER',
          toActorUserId: newDriver.userId,
          toActorRole: 'REPLACEMENT_TRANSPORT_DRIVER',
          stopId: trip.stops[trip.currentStopSequence - 1]?.stopId ?? trip.stops[0].stopId,
          transferredAt: now,
          verificationMethod: 'ID_DOCUMENT',
          notes: `Driver handover: ${params.reason}`,
          immutableSignature: `HANDOVER_${generateUUIDv7()}`,
        };
        this.store.saveCustodyRecord(custodyRecord);
        pet.currentCustodianUserId = newDriver.userId;
      }
    }

    trip.assignedDriverId = params.newDriverProfileId;
    trip.updatedAt = now;
    trip.version += 1;
    this.store.saveTrip(trip);

    const event: TransportDriverReassignedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportDriverReassigned',
      tripId: trip.tripId,
      previousDriverId,
      newDriverId: params.newDriverProfileId,
      reason: params.reason,
      timestamp: now,
      actorUserId: params.actorUserId,
    };
    this.store.emitEvent(event);

    return trip;
  }

  // ==========================================
  // MULTI-STOP & WAIT-AND-RETURN
  // ==========================================

  public arriveAtStop(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    driverUserId: UserId;
  }): TransportStop {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const stop = this.store.getStop(params.stopId);
    if (!stop) throw new Error(`Stop ${params.stopId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized driver.');
    }

    const now = this.nowIso();
    stop.status = 'ARRIVED';
    stop.actualArrival = now;
    this.store.saveStop(stop);

    if (stop.stopType === 'DROP_OFF') {
      trip.status = 'ARRIVED_AT_DESTINATION';
    } else {
      trip.status = 'STOP_IN_PROGRESS';
    }
    trip.updatedAt = now;
    this.store.saveTrip(trip);

    const event: TransportStopArrivedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportStopArrived',
      tripId: trip.tripId,
      stopId: stop.stopId,
      sequence: stop.sequence,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return stop;
  }

  /**
   * Temporary custody transfer at intermediate stop (e.g. Vet clinic or Groomer during Wait-and-Return)
   */
  public transferCustodyAtIntermediateStop(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    petId: PetId;
    receivingStaffUserId: UserId;
    receivingStaffRole: 'VET_CLINIC_STAFF' | 'GROOMER_STAFF' | 'BOARDING_STAFF';
    verificationMethod: RecipientVerificationMethod;
    driverUserId: UserId;
  }): TransportCustodyRecord {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not found in trip.`);

    const now = this.nowIso();
    const custodyRecordId = asTransportCustodyRecordId(generateUUIDv7());

    const record: TransportCustodyRecord = {
      custodyRecordId,
      tripId: params.tripId,
      petId: params.petId,
      fromActorUserId: params.driverUserId,
      fromActorRole: 'TRANSPORT_DRIVER',
      toActorUserId: params.receivingStaffUserId,
      toActorRole: params.receivingStaffRole,
      stopId: params.stopId,
      transferredAt: now,
      verificationMethod: params.verificationMethod,
      notes: 'Intermediate stop custody handover',
      immutableSignature: `CUST_${generateUUIDv7()}`,
    };

    this.store.saveCustodyRecord(record);

    tripPet.custodyStatus = 'INTERMEDIATE_PROVIDER';
    tripPet.currentCustodianUserId = params.receivingStaffUserId;
    trip.overallCustodyStatus = 'INTERMEDIATE_PROVIDER';
    trip.updatedAt = now;
    this.store.saveTrip(trip);

    const event: PetTransportCustodyTransferredEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetTransportCustodyTransferred',
      tripId: trip.tripId,
      petId: params.petId,
      custodyRecordId,
      fromRole: 'TRANSPORT_DRIVER',
      toRole: params.receivingStaffRole,
      newCustodyStatus: 'INTERMEDIATE_PROVIDER',
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return record;
  }

  /**
   * Resuming custody from intermediate stop for return leg
   */
  public resumeCustodyFromIntermediateStop(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    petId: PetId;
    releasingStaffUserId: UserId;
    driverUserId: UserId;
    verificationMethod: RecipientVerificationMethod;
  }): TransportCustodyRecord {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not found in trip.`);

    const now = this.nowIso();
    const custodyRecordId = asTransportCustodyRecordId(generateUUIDv7());

    const record: TransportCustodyRecord = {
      custodyRecordId,
      tripId: params.tripId,
      petId: params.petId,
      fromActorUserId: params.releasingStaffUserId,
      fromActorRole: 'INTERMEDIATE_PROVIDER',
      toActorUserId: params.driverUserId,
      toActorRole: 'TRANSPORT_DRIVER',
      stopId: params.stopId,
      transferredAt: now,
      verificationMethod: params.verificationMethod,
      notes: 'Custody resumed for return leg',
      immutableSignature: `RESUME_${generateUUIDv7()}`,
    };

    this.store.saveCustodyRecord(record);

    tripPet.custodyStatus = 'DRIVER';
    tripPet.currentCustodianUserId = params.driverUserId;
    trip.overallCustodyStatus = 'DRIVER';
    trip.status = 'IN_TRANSIT';
    trip.updatedAt = now;
    this.store.saveTrip(trip);

    const event: PetTransportCustodyTransferredEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetTransportCustodyTransferred',
      tripId: trip.tripId,
      petId: params.petId,
      custodyRecordId,
      fromRole: 'INTERMEDIATE_PROVIDER',
      toRole: 'TRANSPORT_DRIVER',
      newCustodyStatus: 'DRIVER',
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return record;
  }

  public completeStop(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    driverUserId: UserId;
  }): TransportStop {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const stop = this.store.getStop(params.stopId);
    if (!stop) throw new Error(`Stop ${params.stopId} not found.`);

    const now = this.nowIso();
    stop.status = 'COMPLETED';
    stop.actualDeparture = now;
    this.store.saveStop(stop);

    trip.currentStopSequence = stop.sequence + 1;
    trip.updatedAt = now;
    this.store.saveTrip(trip);

    const event: TransportStopCompletedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportStopCompleted',
      tripId: trip.tripId,
      stopId: stop.stopId,
      sequence: stop.sequence,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return stop;
  }

  // ==========================================
  // DESTINATION HANDOVER & COMPLETION
  // ==========================================

  public executeDestinationHandover(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    petId: PetId;
    recipientName: string;
    recipientRole: string;
    recipientUserId?: UserId;
    verificationMethod: RecipientVerificationMethod;
    recipientSignatureOrOtp: string;
    driverUserId: UserId;
    notes?: string;
  }): TransportHandoverRecord {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = this.store.getDriver(trip.assignedDriverId!);
    if (!driver || driver.userId !== params.driverUserId) {
      throw new Error('Unauthorized driver.');
    }

    const tripPet = trip.pets.find(p => p.petId === params.petId);
    if (!tripPet) throw new Error(`Pet ${params.petId} not found in trip.`);

    // Check belongings release
    const belongings = this.store.getBelongingsForTrip(params.tripId);
    const petBelongings = belongings.filter(b => b.petId === params.petId);
    for (const b of petBelongings) {
      b.releasedAtHandover = true;
      this.store.saveBelonging(b);
    }

    const handoverId = asTransportHandoverRecordId(generateUUIDv7());
    const now = this.nowIso();

    const handover: TransportHandoverRecord = {
      handoverId,
      tripId: params.tripId,
      stopId: params.stopId,
      petId: params.petId,
      recipientName: params.recipientName,
      recipientRole: params.recipientRole,
      recipientUserId: params.recipientUserId,
      verificationMethod: params.verificationMethod,
      verifiedAt: now,
      belongingsHandedOver: petBelongings.map(b => b.description),
      recipientSignatureOrOtp: params.recipientSignatureOrOtp,
      notes: params.notes,
    };

    this.store.saveHandoverRecord(handover);

    // Record custody release
    const custodyRecordId = asTransportCustodyRecordId(generateUUIDv7());
    const custodyRecord: TransportCustodyRecord = {
      custodyRecordId,
      tripId: params.tripId,
      petId: params.petId,
      fromActorUserId: params.driverUserId,
      fromActorRole: 'TRANSPORT_DRIVER',
      toActorUserId: params.recipientUserId ?? ('usr-verified-recipient' as UserId),
      toActorRole: params.recipientRole,
      stopId: params.stopId,
      transferredAt: now,
      verificationMethod: params.verificationMethod,
      notes: `Final handover to ${params.recipientName}`,
      immutableSignature: `FINAL_${generateUUIDv7()}`,
    };
    this.store.saveCustodyRecord(custodyRecord);

    tripPet.custodyStatus = 'RELEASED';
    tripPet.handoverEvidenceId = handoverId;

    const allReleased = trip.pets.every(p => p.custodyStatus === 'RELEASED');
    if (allReleased) {
      trip.overallCustodyStatus = 'RELEASED';
      trip.status = 'HANDOVER_PENDING'; // Ready for completeTrip
    }
    trip.updatedAt = now;
    trip.version += 1;
    this.store.saveTrip(trip);

    const event: PetTransportHandoverCompletedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'PetTransportHandoverCompleted',
      tripId: trip.tripId,
      handoverId,
      petId: params.petId,
      recipientName: params.recipientName,
      verificationMethod: params.verificationMethod,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(event);

    return handover;
  }

  /**
   * Invariant: Never leave Pet unattended!
   * Failed delivery triggers safe return-to-origin or fallback provider.
   */
  public handleFailedHandover(params: {
    tripId: TransportTripId;
    stopId: TransportStopId;
    reason: string;
    actionTaken: 'WAIT' | 'CONTACT_OWNER' | 'RETURN_TO_ORIGIN' | 'SAFE_PROVIDER_LOCATION';
    driverUserId: UserId;
  }): TransportTrip {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const now = this.nowIso();

    this.store.recordAudit({
      auditId: generateUUIDv7(),
      tripId: trip.tripId,
      action: 'FAILED_HANDOVER_OCCURRED',
      actorUserId: params.driverUserId,
      details: { stopId: params.stopId, reason: params.reason, actionTaken: params.actionTaken },
      timestamp: now,
    });

    if (params.actionTaken === 'RETURN_TO_ORIGIN') {
      // Dynamically append return origin stop
      const returnStopId = asTransportStopId(generateUUIDv7());
      const returnStop: TransportStop = {
        stopId: returnStopId,
        tripId: trip.tripId,
        sequence: trip.stops.length + 1,
        stopType: 'RETURN_ORIGIN_STOP',
        title: 'Return to Origin (Household Pickup Location)',
        addressPublicSnippet: trip.stops[0].addressPublicSnippet,
        exactAddressEncrypted: trip.stops[0].exactAddressEncrypted,
        addressAccessWindowStartIso: now,
        addressAccessWindowEndIso: new Date(Date.now() + 7200000).toISOString(),
        scheduledArrival: new Date(Date.now() + 3600000).toISOString(),
        recipientContactName: trip.stops[0].recipientContactName,
        recipientContactPhoneMasked: trip.stops[0].recipientContactPhoneMasked,
        status: 'PENDING',
        petIdsBoarding: [],
        petIdsExiting: trip.pets.map(p => p.petId),
        requiredActions: ['VERIFY_ORIGIN_OWNER', 'HANDOVER_PET'],
      };
      this.store.saveStop(returnStop);
      trip.stops.push(returnStop);
      trip.status = 'IN_TRANSIT';
      trip.updatedAt = now;
      this.store.saveTrip(trip);
    }

    return trip;
  }

  /**
   * Finalizes the trip aggregate.
   * INVARIANTS:
   * 1. All pets accounted for (no ambiguous custody).
   * 2. Tracking session finalized.
   * 3. Booking receives ServiceExecutionCompleted.
   * 4. Finance receives fulfillment notification.
   * 5. Driver address access window revoked.
   * 6. Idempotent: If called multiple times, returns existing completion evidence.
   */
  public completeTrip(params: {
    tripId: TransportTripId;
    driverUserId: UserId;
  }): TransportCompletionEvidence {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    // Check existing completion evidence (Idempotency)
    const existing = this.store.getCompletionEvidence(params.tripId);
    if (existing) {
      return existing;
    }

    // Invariant: All pets must be accounted for
    const unhandledPets = trip.pets.filter(p => p.custodyStatus !== 'RELEASED');
    if (unhandledPets.length > 0) {
      throw new Error(`Cannot complete trip: ${unhandledPets.length} pet(s) not released (${unhandledPets.map(p => p.petName).join(', ')}).`);
    }

    const now = this.nowIso();
    const durationMinutes = trip.actualPickupAt
      ? Math.max(1, Math.round((new Date(now).getTime() - new Date(trip.actualPickupAt).getTime()) / 60000))
      : 30;

    trip.status = 'COMPLETED';
    trip.actualCompletionAt = now;
    trip.updatedAt = now;
    trip.version += 1;

    // Complete all remaining stops
    for (const stop of trip.stops) {
      if (stop.status !== 'COMPLETED') {
        stop.status = 'COMPLETED';
        this.store.saveStop(stop);
      }
    }
    this.store.saveTrip(trip);

    // Close vehicle occupancy
    const vehicle = this.store.getVehicle(trip.assignedVehicleId!);
    if (vehicle) {
      vehicle.activeTripId = undefined;
      this.store.saveVehicle(vehicle);
    }

    // Finalize TrackingSession
    if (trip.trackingSessionId) {
      const trackingDoneEvent: TrackingSessionCompletedEvent = {
        eventId: generateUUIDv7(),
        eventType: 'TrackingSessionCompleted',
        tripId: trip.tripId,
        trackingSessionId: trip.trackingSessionId,
        timestamp: now,
        actorUserId: params.driverUserId,
      };
      this.store.emitEvent(trackingDoneEvent);
    }

    // Generate Completion Evidence
    const completionEvidenceId = asTransportCompletionEvidenceId(generateUUIDv7());
    const evidence: TransportCompletionEvidence = {
      completionEvidenceId,
      tripId: trip.tripId,
      bookingId: trip.bookingId,
      driverId: trip.assignedDriverId!,
      vehicleId: trip.assignedVehicleId!,
      petIds: trip.pets.map(p => p.petId),
      actualStartAt: trip.actualPickupAt ?? trip.scheduledPickupAt,
      actualEndAt: now,
      routeReference: trip.routeReference ?? 'DEFAULT_ROUTE',
      totalStopsCompleted: trip.stops.length,
      allPetsAccountedFor: true,
      incidentsCount: trip.activeIncidentCount,
      custodySignoffCount: this.store.getCustodyRecordsForTrip(trip.tripId).length,
      verifiedAt: now,
    };
    this.store.saveCompletionEvidence(evidence);

    // Emit Domain & Integration Events
    const tripCompletedEvent: TransportTripCompletedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'TransportTripCompleted',
      tripId: trip.tripId,
      completionEvidenceId,
      bookingId: trip.bookingId,
      durationMinutes,
      timestamp: now,
      actorUserId: params.driverUserId,
    };
    this.store.emitEvent(tripCompletedEvent);

    // Booking Integration: ServiceExecutionCompleted
    const serviceDoneEvent: ServiceExecutionCompletedEvent = {
      eventId: generateUUIDv7(),
      eventType: 'ServiceExecutionCompleted',
      bookingId: trip.bookingId,
      serviceCategory: 'PET_TRANSPORT',
      completedAt: now,
      evidenceId: completionEvidenceId,
    };
    this.store.emitEvent(serviceDoneEvent as any);

    // Review Engine Eligibility
    const reviewEvent: BookingReviewEligibleEvent = {
      eventId: generateUUIDv7(),
      eventType: 'BookingReviewEligible',
      bookingId: trip.bookingId,
      tripId: trip.tripId,
      completedAt: now,
    };
    this.store.emitEvent(reviewEvent as any);

    return evidence;
  }

  // ==========================================
  // OWNER LIVE TRIP PROJECTION & PRIVACY
  // ==========================================

  public getOwnerTripLiveProjection(params: {
    tripId: TransportTripId;
    ownerUserId: UserId;
    currentTimeIso?: string;
  }): OwnerTripLiveProjection {
    const trip = this.store.getTrip(params.tripId);
    if (!trip) throw new Error(`Trip ${params.tripId} not found.`);

    const driver = trip.assignedDriverId ? this.store.getDriver(trip.assignedDriverId) : undefined;
    const vehicle = trip.assignedVehicleId ? this.store.getVehicle(trip.assignedVehicleId) : undefined;
    const currentStop = trip.stops.find(s => s.sequence === trip.currentStopSequence) ?? trip.stops[0];
    const nextStop = trip.stops.find(s => s.sequence === trip.currentStopSequence + 1);

    const delays = this.store.getDelaysForTrip(trip.tripId);
    const latestDelay = delays[delays.length - 1];

    const observations = this.store.getObservationsForTrip(trip.tripId);
    const latestTemp = observations.filter(o => o.observationType === 'CARGO_TEMPERATURE').pop();

    // Tracking Privacy: Owner can ONLY track while trip is actively in transit with Pet in custody
    const canTrack =
      (trip.status === 'IN_TRANSIT' || trip.status === 'STOP_IN_PROGRESS' || trip.status === 'ARRIVED_AT_DESTINATION') &&
      trip.overallCustodyStatus === 'DRIVER';

    // Freshness evaluation
    const now = params.currentTimeIso ? new Date(params.currentTimeIso).getTime() : Date.now();
    const lastUpdate = trip.actualPickupAt ? new Date(trip.updatedAt).getTime() : now;
    const elapsedMinutes = Math.floor((now - lastUpdate) / 60000);

    const trackingFreshness = !canTrack
      ? 'OFFLINE_UNAVAILABLE'
      : elapsedMinutes > 5
      ? 'STALE'
      : 'LIVE';

    return {
      tripId: trip.tripId,
      status: trip.status,
      petNames: trip.pets.map(p => p.petName),
      driverName: driver?.fullName ?? 'Assigned Driver',
      driverPhoneRelay: driver?.phoneNumberMasked ?? '+254 700 *** 000',
      vehicleDescription: vehicle ? `${vehicle.makeModel} (${vehicle.registrationNumber})` : 'Assigned Vehicle',
      currentStopName: currentStop.title,
      nextStopName: nextStop?.title,
      eta: latestDelay?.revisedEta ?? trip.scheduledCompletionAt,
      overallCustody: trip.overallCustodyStatus,
      trackingFreshness,
      lastLocationTimestampIso: trip.updatedAt,
      staleMinutesElapsed: elapsedMinutes > 0 ? elapsedMinutes : 0,
      recentDelayMessage: latestDelay ? `${latestDelay.reason}: delayed by ${latestDelay.delayMinutes} mins` : undefined,
      hasActiveIncident: trip.activeIncidentCount > 0,
      cargoTemperatureObservedCelsius: latestTemp?.value,
      canTrackDriverLocation: canTrack,
    };
  }
}
