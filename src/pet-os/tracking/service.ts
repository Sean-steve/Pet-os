/**
 * Pet OS Sprint 14 - Pet Tracking & Location Platform Service
 * Core domain service orchestrating device registry, telemetry ingestion,
 * monotonic live projections, route filtering, and privacy authorization.
 */

import {
  DeviceId,
  PetId,
  HouseholdId,
  UserId,
  WalkSessionId,
  TrackingDeviceAssignmentId,
  TrackingSessionId,
  LocationObservationId,
  RouteId,
  DeadLetterEventId,
  asDeviceId,
  asTrackingDeviceAssignmentId,
  asTrackingSessionId,
  asLocationObservationId,
  asRouteId,
  asDeadLetterEventId,
  asNotificationId,
  asActivityId,
  asIngestionId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  TrackingDevice,
  TrackingDeviceAssignment,
  TrackingSession,
  LocationObservation,
  PetLiveLocation,
  LocationRoute,
  RouteSummary,
  DeviceHealth,
  TelemetryEnvelope,
  DeviceType,
  LocationSourceType,
  TrackingMode,
  BatteryStatus,
  DeviceConnectivityStatus,
  LocationAuthorizationQuery,
  LocationAuthorizationResult,
  LocationAccessRole,
  LocationFreshness,
} from './types';
import { TrackingStore } from './store';
import { VendorAdapterRegistry } from './adapters';
import {
  haversineDistanceMeters,
  isValidCoordinate,
  classifyQuality,
  evaluatePointAnomalies,
  calculateFilteredRouteDistance,
} from './geospatial';
import { TrackingEventBus } from './events';
import { TrackingAuditLogger } from './audit';
import { NotificationStore } from '../notifications/store';
import { ActivityStore } from '../activity/store';
import { IdentityStore } from '../identity/store';
import { DogWalkingStore } from '../dog-walking/store';

export class TrackingService {
  private static instance: TrackingService;
  private store: TrackingStore;
  private eventBus: TrackingEventBus;
  private auditLogger: TrackingAuditLogger;
  private adapterRegistry: VendorAdapterRegistry;

  // Battery alert cooldown tracking: `${deviceId}:${level}` -> timestamp
  private batteryAlertCooldown = new Map<string, number>();

  private constructor() {
    this.store = TrackingStore.getInstance();
    this.eventBus = TrackingEventBus.getInstance();
    this.auditLogger = TrackingAuditLogger.getInstance();
    this.adapterRegistry = VendorAdapterRegistry.getInstance();
  }

  static getInstance(): TrackingService {
    if (!TrackingService.instance) {
      TrackingService.instance = new TrackingService();
    }
    return TrackingService.instance;
  }

  // ==========================================================================
  // 1. DEVICE REGISTRY & LIFECYCLE
  // ==========================================================================

  registerDevice(params: {
    deviceType: DeviceType;
    provider: string;
    externalDeviceReference: string;
    serialNumber: string;
    displayName: string;
    model: string;
    hardwareVersion?: string;
    firmwareVersion?: string;
  }): TrackingDevice {
    const existing = this.store.findDeviceByExternalReference(
      params.provider,
      params.externalDeviceReference
    );
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const deviceId = asDeviceId(`dev-${generateUUIDv7()}`);

    // Mask sensitive serial number for safe display (e.g. TRK-***-8921)
    const rawSerial = params.serialNumber;
    const serialMasked =
      rawSerial.length > 4
        ? `${rawSerial.slice(0, 3)}-***-${rawSerial.slice(-4)}`
        : `***-${rawSerial}`;

    const device: TrackingDevice = {
      deviceId,
      deviceType: params.deviceType,
      provider: params.provider.toUpperCase(),
      externalDeviceReference: params.externalDeviceReference,
      serialNumberMasked: serialMasked,
      displayName: params.displayName,
      model: params.model,
      hardwareVersion: params.hardwareVersion || '1.0.0',
      firmwareVersion: params.firmwareVersion || '1.0.0',
      operationalStatus: 'UNCLAIMED',
      connectivityStatus: 'UNKNOWN',
      batteryStatus: 'UNKNOWN',
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveDevice(device);

    this.store.saveDeviceHealth({
      deviceId,
      lastSeenAt: now,
      lastLocationAt: now,
      batteryState: 'UNKNOWN',
      connectivityState: 'UNKNOWN',
      locationSourceState: 'STANDBY',
      updatedAt: now,
    });

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'TrackingDeviceRegistered',
      deviceId,
      deviceType: device.deviceType,
      provider: device.provider,
      displayName: device.displayName,
      occurredAt: now,
      aggregateId: deviceId,
    });

    this.auditLogger.log({
      action: 'DEVICE_REGISTERED',
      deviceId,
      success: true,
      metadata: { provider: device.provider, model: device.model },
    });

    return device;
  }

  claimDevice(params: {
    deviceId: DeviceId;
    householdId: HouseholdId;
    actorUserId: UserId;
    claimProofToken?: string;
  }): TrackingDevice {
    const device = this.store.getDevice(params.deviceId);
    if (!device) {
      throw new Error(`Device ${params.deviceId} not found in registry`);
    }

    // Anti-takeover check: if already claimed by a DIFFERENT household, reject
    if (device.householdId && device.householdId !== params.householdId) {
      this.auditLogger.log({
        action: 'DEVICE_TAKEOVER_BLOCKED',
        deviceId: params.deviceId,
        actorUserId: params.actorUserId,
        householdId: params.householdId,
        success: false,
        reason: `Device already claimed by household ${device.householdId}`,
      });
      throw new Error(
        `Device ${params.deviceId} is already claimed by another household. Unclaim required before transfer.`
      );
    }

    const now = new Date().toISOString();
    device.householdId = params.householdId;
    device.operationalStatus = 'CLAIMED';
    device.claimedAt = now;
    device.claimedBy = params.actorUserId;
    device.updatedAt = now;

    this.store.saveDevice(device);

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'TrackingDeviceClaimed',
      deviceId: device.deviceId,
      householdId: params.householdId,
      claimedBy: params.actorUserId,
      occurredAt: now,
      aggregateId: device.deviceId,
      actorUserId: params.actorUserId,
    });

    this.auditLogger.log({
      action: 'DEVICE_CLAIMED',
      deviceId: device.deviceId,
      actorUserId: params.actorUserId,
      householdId: params.householdId,
      success: true,
    });

    return device;
  }

  unclaimDevice(params: {
    deviceId: DeviceId;
    householdId: HouseholdId;
    actorUserId: UserId;
  }): TrackingDevice {
    const device = this.store.getDevice(params.deviceId);
    if (!device) {
      throw new Error(`Device ${params.deviceId} not found`);
    }

    if (device.householdId !== params.householdId) {
      throw new Error(`Unauthorized: Device is not claimed by household ${params.householdId}`);
    }

    // Auto-unassign active pet assignment if one exists
    const activeAssignment = this.store.getActiveAssignmentForDevice(params.deviceId);
    if (activeAssignment) {
      this.unassignDeviceFromPet({
        deviceId: params.deviceId,
        petId: activeAssignment.petId,
        actorUserId: params.actorUserId,
        reason: 'Device unclaimed by household',
      });
    }

    const now = new Date().toISOString();
    device.householdId = undefined;
    device.operationalStatus = 'UNCLAIMED';
    device.claimedAt = undefined;
    device.claimedBy = undefined;
    device.updatedAt = now;

    this.store.saveDevice(device);

    this.auditLogger.log({
      action: 'DEVICE_UNASSIGNED',
      deviceId: device.deviceId,
      actorUserId: params.actorUserId,
      householdId: params.householdId,
      success: true,
      reason: 'Device unclaimed',
    });

    return device;
  }

  // ==========================================================================
  // 2. DEVICE ASSIGNMENT & HISTORICAL IMMUTABILITY
  // ==========================================================================

  assignDeviceToPet(params: {
    deviceId: DeviceId;
    petId: PetId;
    householdId: HouseholdId;
    actorUserId: UserId;
    reason?: string;
  }): TrackingDeviceAssignment {
    const device = this.store.getDevice(params.deviceId);
    if (!device) {
      throw new Error(`Device ${params.deviceId} not found`);
    }

    if (device.householdId && device.householdId !== params.householdId) {
      throw new Error(`Unauthorized: Device belongs to a different household`);
    }

    const now = new Date().toISOString();

    // 1. Unassign any existing active assignment for this device
    const existingDeviceAssignment = this.store.getActiveAssignmentForDevice(params.deviceId);
    if (existingDeviceAssignment) {
      existingDeviceAssignment.status = 'TERMINATED';
      existingDeviceAssignment.unassignedAt = now;
      existingDeviceAssignment.unassignedBy = params.actorUserId;
      existingDeviceAssignment.reason = 'Reassigned to new pet';
      this.store.saveAssignment(existingDeviceAssignment);

      // Sever live location projection for the old pet so it doesn't display new dog's location
      this.store.removeLiveLocation(existingDeviceAssignment.petId);

      this.auditLogger.log({
        action: 'DEVICE_REASSIGNED_CROSS_PET',
        deviceId: params.deviceId,
        petId: existingDeviceAssignment.petId,
        actorUserId: params.actorUserId,
        householdId: params.householdId,
        success: true,
        reason: `Terminated previous assignment to pet ${existingDeviceAssignment.petId}`,
      });
    }

    // 2. Unassign any existing assignment of the same type for this pet
    const existingPetAssignment = this.store.getActiveAssignmentForPet(params.petId);
    if (existingPetAssignment && existingPetAssignment.deviceId !== params.deviceId) {
      existingPetAssignment.status = 'TERMINATED';
      existingPetAssignment.unassignedAt = now;
      existingPetAssignment.unassignedBy = params.actorUserId;
      existingPetAssignment.reason = 'Replaced by new tracker device';
      this.store.saveAssignment(existingPetAssignment);
    }

    // 3. Create new assignment
    const assignmentId = asTrackingDeviceAssignmentId(`asgn-${generateUUIDv7()}`);
    const assignment: TrackingDeviceAssignment = {
      assignmentId,
      deviceId: params.deviceId,
      petId: params.petId,
      householdId: params.householdId,
      assignedAt: now,
      assignedBy: params.actorUserId,
      status: 'ACTIVE',
      reason: params.reason,
      createdAt: now,
    };

    this.store.saveAssignment(assignment);

    // Update device status to ACTIVE
    device.operationalStatus = 'ACTIVE';
    device.updatedAt = now;
    this.store.saveDevice(device);

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'TrackingDeviceAssigned',
      assignmentId,
      deviceId: params.deviceId,
      petId: params.petId,
      householdId: params.householdId,
      assignedBy: params.actorUserId,
      occurredAt: now,
      aggregateId: assignmentId,
      actorUserId: params.actorUserId,
    });

    this.auditLogger.log({
      action: 'DEVICE_ASSIGNED',
      deviceId: params.deviceId,
      petId: params.petId,
      actorUserId: params.actorUserId,
      householdId: params.householdId,
      success: true,
      reason: params.reason,
    });

    return assignment;
  }

  unassignDeviceFromPet(params: {
    deviceId: DeviceId;
    petId: PetId;
    actorUserId: UserId;
    reason?: string;
  }): TrackingDeviceAssignment {
    const active = this.store.getActiveAssignmentForDevice(params.deviceId);
    if (!active || active.petId !== params.petId) {
      throw new Error(`Device ${params.deviceId} is not actively assigned to pet ${params.petId}`);
    }

    const now = new Date().toISOString();
    active.status = 'TERMINATED';
    active.unassignedAt = now;
    active.unassignedBy = params.actorUserId;
    active.reason = params.reason || 'Manual unassignment';
    this.store.saveAssignment(active);

    // If pet has no other active tracker, clear live location
    const otherAssignment = this.store.getActiveAssignmentForPet(params.petId);
    if (!otherAssignment) {
      this.store.removeLiveLocation(params.petId);
    }

    // Update device operational status
    const device = this.store.getDevice(params.deviceId);
    if (device) {
      device.operationalStatus = 'CLAIMED';
      device.updatedAt = now;
      this.store.saveDevice(device);
    }

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'TrackingDeviceUnassigned',
      assignmentId: active.assignmentId,
      deviceId: params.deviceId,
      petId: params.petId,
      unassignedBy: params.actorUserId,
      reason: params.reason,
      occurredAt: now,
      aggregateId: active.assignmentId,
      actorUserId: params.actorUserId,
    });

    this.auditLogger.log({
      action: 'DEVICE_UNASSIGNED',
      deviceId: params.deviceId,
      petId: params.petId,
      actorUserId: params.actorUserId,
      householdId: active.householdId,
      success: true,
      reason: params.reason,
    });

    return active;
  }

  // ==========================================================================
  // 3. TELEMETRY INGESTION PIPELINE
  // ==========================================================================

  ingestWebhook(params: {
    provider: string;
    rawPayload: unknown;
    signature?: string;
    receivedAt?: string;
  }): { processedCount: number; deduplicatedCount: number; errors: string[] } {
    const receivedAt = params.receivedAt || new Date().toISOString();
    const adapter = this.adapterRegistry.getAdapter(params.provider);

    if (!adapter) {
      const errorMsg = `No vendor adapter registered for provider: ${params.provider}`;
      this.recordDeadLetter({
        provider: params.provider,
        providerEventId: 'UNKNOWN',
        sourceDeviceReference: 'UNKNOWN',
        errorClassification: 'OTHER',
        errorMessage: errorMsg,
        rawPayload: JSON.stringify(params.rawPayload),
        receivedAt,
      });
      return { processedCount: 0, deduplicatedCount: 0, errors: [errorMsg] };
    }

    // Signature verification (simulated secret)
    if (params.signature) {
      const isValid = adapter.verifyWebhookSignature(
        JSON.stringify(params.rawPayload),
        params.signature,
        'simulated_secret_key_petos'
      );

      if (!isValid) {
        const errorMsg = `Invalid HMAC signature for provider ${params.provider}`;
        this.recordDeadLetter({
          provider: params.provider,
          providerEventId: 'SIG_FAILED',
          sourceDeviceReference: 'UNKNOWN',
          errorClassification: 'SIGNATURE_INVALID',
          errorMessage: errorMsg,
          rawPayload: JSON.stringify(params.rawPayload),
          receivedAt,
        });
        return { processedCount: 0, deduplicatedCount: 0, errors: [errorMsg] };
      }
    }

    // Normalize payload
    let envelopes: TelemetryEnvelope[] = [];
    try {
      envelopes = adapter.normalizePayload(params.rawPayload, receivedAt);
    } catch (err) {
      const errorMsg = `Payload normalization failed: ${(err as Error).message}`;
      this.recordDeadLetter({
        provider: params.provider,
        providerEventId: 'NORM_FAILED',
        sourceDeviceReference: 'UNKNOWN',
        errorClassification: 'MALFORMED_COORDINATES',
        errorMessage: errorMsg,
        rawPayload: JSON.stringify(params.rawPayload),
        receivedAt,
      });
      return { processedCount: 0, deduplicatedCount: 0, errors: [errorMsg] };
    }

    let processedCount = 0;
    let deduplicatedCount = 0;
    const errors: string[] = [];

    for (const env of envelopes) {
      // 1. Deduplication check
      if (this.store.isDuplicateIngestion(env.provider, env.providerEventId)) {
        deduplicatedCount++;
        continue;
      }

      // 2. Process single envelope
      try {
        this.processTelemetryEnvelope(env);
        this.store.markIngestionProcessed(env.provider, env.providerEventId);
        processedCount++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    return { processedCount, deduplicatedCount, errors };
  }

  ingestMobileTelemetry(params: {
    walkerUserId: UserId;
    walkSessionId: WalkSessionId;
    phoneDeviceId: DeviceId;
    coordinates: Array<{
      lat: number;
      lng: number;
      accuracyM: number;
      timestamp?: string;
      speedMps?: number;
      altitudeM?: number;
      headingDegrees?: number;
    }>;
  }): { processedCount: number; errors: string[] } {
    const receivedAt = new Date().toISOString();

    // Verify walker authorization & walk session state from DogWalkingStore
    const walkSession = DogWalkingStore.getInstance().findSessionById(params.walkSessionId);
    if (!walkSession) {
      this.auditLogger.log({
        action: 'MOBILE_TELEMETRY_UNAUTHORIZED',
        actorUserId: params.walkerUserId,
        success: false,
        reason: `Walk session ${params.walkSessionId} not found`,
      });
      throw new Error(`Walk session ${params.walkSessionId} not found`);
    }

    if (walkSession.walkerUserId !== params.walkerUserId) {
      this.auditLogger.log({
        action: 'MOBILE_TELEMETRY_UNAUTHORIZED',
        actorUserId: params.walkerUserId,
        householdId: walkSession.householdId,
        success: false,
        reason: `User ${params.walkerUserId} is not the designated walker for this session`,
      });
      throw new Error(`Unauthorized: User is not the assigned walker for this session`);
    }

    // Only allow location ingestion during active walk or pickup
    const allowableStatuses = ['PICKUP_HANDOVER_IN_PROGRESS', 'IN_PROGRESS', 'PAUSED', 'RETURN_HANDOVER_IN_PROGRESS'];
    if (!allowableStatuses.includes(walkSession.status)) {
      this.auditLogger.log({
        action: 'MOBILE_TELEMETRY_UNAUTHORIZED',
        actorUserId: params.walkerUserId,
        householdId: walkSession.householdId,
        success: false,
        reason: `Walk session is not active (status: ${walkSession.status})`,
      });
      throw new Error(`Cannot submit telemetry: Walk session is not active (${walkSession.status})`);
    }

    // Ensure phone device is registered in device registry
    let phoneDev = this.store.getDevice(params.phoneDeviceId);
    if (!phoneDev) {
      phoneDev = this.registerDevice({
        deviceType: 'PHONE_LOCATION_SOURCE',
        provider: 'PET_OS_MOBILE',
        externalDeviceReference: params.phoneDeviceId,
        serialNumber: `MOB-${params.walkerUserId.slice(-6)}`,
        displayName: `Walker Phone (${params.walkerUserId.slice(-4)})`,
        model: 'Smartphone GPS Companion',
      });
    }

    // Get or start tracking session for this walk
    let trackingSession = this.store.findSessionByContext('DOG_WALK', params.walkSessionId);
    if (!trackingSession) {
      const res = this.startTrackingSessionForWalk({
        walkSessionId: params.walkSessionId,
        petIds: walkSession.petIds,
        walkerUserId: params.walkerUserId,
        householdId: walkSession.householdId,
        sourceDeviceId: params.phoneDeviceId,
        sourceType: 'PHONE_LOCATION_SOURCE',
      });
      trackingSession = this.store.getTrackingSession(res.trackingSessionId);
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const pt of params.coordinates) {
      const eventId = `mob-${generateUUIDv7()}`;
      const observedAt = pt.timestamp || receivedAt;

      const envelope: TelemetryEnvelope = {
        ingestionId: asIngestionId(`ing-${generateUUIDv7()}`),
        provider: 'PET_OS_MOBILE',
        sourceDeviceReference: params.phoneDeviceId,
        providerEventId: eventId,
        observedAt,
        receivedAt,
        latitude: pt.lat,
        longitude: pt.lng,
        horizontalAccuracyM: pt.accuracyM,
        speedMps: pt.speedMps,
        altitudeM: pt.altitudeM,
        headingDegrees: pt.headingDegrees,
        signatureVerified: true,
        sourcePayloadVersion: 'mobile-v1.0',
      };

      try {
        // For multi-dog walks, process points for each pet
        for (const petId of walkSession.petIds) {
          this.processPointForPet(envelope, petId, trackingSession?.trackingSessionId);
        }
        this.store.markIngestionProcessed(envelope.provider, envelope.providerEventId);
        processedCount++;
      } catch (err) {
        errors.push((err as Error).message);
      }
    }

    return { processedCount, errors };
  }

  /**
   * Processes a single validated telemetry envelope into the domain model.
   */
  processTelemetryEnvelope(envelope: TelemetryEnvelope): LocationObservation {
    const receivedAt = envelope.receivedAt || new Date().toISOString();

    // 1. Coordinate bounds check [-90, 90], [-180, 180]
    if (!isValidCoordinate(envelope.latitude, envelope.longitude)) {
      this.recordDeadLetter({
        provider: envelope.provider,
        providerEventId: envelope.providerEventId,
        sourceDeviceReference: envelope.sourceDeviceReference,
        errorClassification: 'MALFORMED_COORDINATES',
        errorMessage: `Coordinates out of bounds: lat=${envelope.latitude}, lon=${envelope.longitude}`,
        rawPayload: JSON.stringify(envelope),
        receivedAt,
      });
      throw new Error(`Malformed coordinates: [${envelope.latitude}, ${envelope.longitude}]`);
    }

    // 2. Resolve device
    let device = this.store.findDeviceByExternalReference(
      envelope.provider,
      envelope.sourceDeviceReference
    );
    if (!device) {
      // Auto-register unknown device into registry with UNCLAIMED state
      device = this.registerDevice({
        deviceType: 'THIRD_PARTY_TRACKER',
        provider: envelope.provider,
        externalDeviceReference: envelope.sourceDeviceReference,
        serialNumber: envelope.sourceDeviceReference,
        displayName: `${envelope.provider} Tracker (${envelope.sourceDeviceReference.slice(-4)})`,
        model: 'Auto-Discovered Third Party Tracker',
      });
    }

    // 3. Resolve pet assignment at observedAt time
    const assignment = this.store.resolveAssignmentAtTime(device.deviceId, envelope.observedAt);
    if (!assignment) {
      // Telemetry received for unclaimed/unassigned device: update health only
      this.updateDeviceHealthFromEnvelope(device.deviceId, envelope);
      throw new Error(`No pet assigned to device ${device.deviceId} at time ${envelope.observedAt}`);
    }

    // 4. Check for active tracking session
    const activeSession = this.store.getActiveSessionForPet(assignment.petId);

    return this.processPointForPet(envelope, assignment.petId, activeSession?.trackingSessionId, assignment);
  }

  private processPointForPet(
    envelope: TelemetryEnvelope,
    petId: PetId,
    trackingSessionId?: TrackingSessionId,
    assignment?: TrackingDeviceAssignment
  ): LocationObservation {
    const device = this.store.findDeviceByExternalReference(
      envelope.provider,
      envelope.sourceDeviceReference
    ) || this.store.getDevice(asDeviceId(envelope.sourceDeviceReference));

    const deviceId = device ? device.deviceId : asDeviceId(envelope.sourceDeviceReference);

    // Fetch previous observation for speed / jump anomaly detection
    const previous = this.store.getLatestObservationForDevice(deviceId);

    // Calculate anomalies and clock skew
    const flags = evaluatePointAnomalies(
      {
        latitude: envelope.latitude,
        longitude: envelope.longitude,
        accuracyM: envelope.horizontalAccuracyM,
        observedAt: envelope.observedAt,
        receivedAt: envelope.receivedAt,
      },
      previous
        ? {
            latitude: previous.latitude,
            longitude: previous.longitude,
            accuracyM: previous.accuracyM,
            observedAt: previous.observedAt,
          }
        : undefined
    );

    const quality = classifyQuality(envelope.horizontalAccuracyM, flags);
    const clockSkewMs = Math.abs(
      new Date(envelope.receivedAt).getTime() - new Date(envelope.observedAt).getTime()
    );

    const observationId = asLocationObservationId(`obs-${generateUUIDv7()}`);
    const observation: LocationObservation = {
      locationObservationId: observationId,
      petId,
      assignmentId: assignment?.assignmentId,
      trackingSessionId,
      deviceId,
      sourceType: (envelope.provider === 'PET_OS_MOBILE' ? 'PHONE_LOCATION_SOURCE' : 'TRACKER_DEVICE') as LocationSourceType,
      sourceProvider: envelope.provider,
      observedAt: envelope.observedAt,
      receivedAt: envelope.receivedAt,
      latitude: envelope.latitude,
      longitude: envelope.longitude,
      accuracyM: envelope.horizontalAccuracyM,
      altitudeM: envelope.altitudeM,
      speedMps: envelope.speedMps,
      headingDegrees: envelope.headingDegrees,
      quality,
      clockSkewMs,
      flags,
      ingestionId: envelope.ingestionId,
      sequence: envelope.sequenceNumber,
      createdAt: new Date().toISOString(),
    };

    // Save normalized observation
    this.store.saveObservation(observation);

    // Publish observation event (with data minimization: no raw lat/lon)
    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'LocationObservationRecorded',
      locationObservationId: observationId,
      petId,
      deviceId,
      trackingSessionId,
      observedAt: envelope.observedAt,
      quality,
      hasAnomalies: flags.length > 0,
      occurredAt: new Date().toISOString(),
      aggregateId: observationId,
    });

    // 5. Update Monotonic Live Location Projection
    this.updateMonotonicLiveLocation(observation);

    // 6. Accumulate into active route if session is active
    if (trackingSessionId) {
      this.appendPointToActiveRoute(trackingSessionId, observation);
    }

    // 7. Update Device Health & Battery Alerts
    this.updateDeviceHealthFromEnvelope(deviceId, envelope);

    return observation;
  }

  /**
   * Monotonic Live Location Projection:
   * Late historical packets (out-of-order) MUST NOT regress the current live location state.
   */
  private updateMonotonicLiveLocation(obs: LocationObservation): void {
    const currentLive = this.store.getLiveLocation(obs.petId);
    const obsTimeMs = new Date(obs.observedAt).getTime();
    const nowMs = Date.now();

    if (currentLive) {
      const currentLiveTimeMs = new Date(currentLive.observedAt).getTime();
      // Out-of-order packet: if incoming observation is older than current live, do not overwrite live location!
      if (obsTimeMs < currentLiveTimeMs) {
        return;
      }
    }

    // Calculate freshness
    const ageSeconds = (nowMs - obsTimeMs) / 1000;
    let freshness: LocationFreshness = 'LIVE';
    if (ageSeconds > 3600) {
      freshness = 'OFFLINE_UNKNOWN';
    } else if (ageSeconds > 1200) {
      freshness = 'STALE';
    } else if (ageSeconds > 300) {
      freshness = 'RECENT';
    }

    const liveLocation: PetLiveLocation = {
      petId: obs.petId,
      latestObservationId: obs.locationObservationId,
      observedAt: obs.observedAt,
      latitude: obs.latitude,
      longitude: obs.longitude,
      accuracyM: obs.accuracyM,
      quality: obs.quality,
      source: obs.sourceType,
      deviceId: obs.deviceId,
      trackingSessionId: obs.trackingSessionId,
      freshness,
      flags: obs.flags,
      updatedAt: new Date().toISOString(),
    };

    this.store.saveLiveLocation(liveLocation);

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'PetLiveLocationUpdated',
      petId: obs.petId,
      deviceId: obs.deviceId,
      latestObservationId: obs.locationObservationId,
      observedAt: obs.observedAt,
      freshness,
      quality: obs.quality,
      occurredAt: new Date().toISOString(),
      aggregateId: obs.petId,
    });
  }

  /**
   * Appends a coordinate point to an active LocationRoute and updates distance.
   */
  private appendPointToActiveRoute(sessionId: TrackingSessionId, obs: LocationObservation): void {
    const route = this.store.getRouteForSession(sessionId);
    if (!route || route.status !== 'ACTIVE') return;

    route.simplifiedPoints.push({
      latitude: obs.latitude,
      longitude: obs.longitude,
      observedAt: obs.observedAt,
      accuracyM: obs.accuracyM,
      speedMps: obs.speedMps,
    });

    route.pointCount = route.simplifiedPoints.length;

    // Quality breakdown
    if (obs.quality === 'HIGH') route.qualitySummary.highQualityPoints++;
    else if (obs.quality === 'MEDIUM') route.qualitySummary.mediumQualityPoints++;
    else route.qualitySummary.lowQualityPoints++;

    if (obs.flags.length > 0) {
      route.qualitySummary.anomalyCount++;
    }

    // Recompute filtered distance and duration
    const distCalc = calculateFilteredRouteDistance(route.simplifiedPoints);
    route.distanceMeters = distCalc.distanceMeters;
    route.distanceReliability = distCalc.reliability;

    const startMs = new Date(route.startedAt).getTime();
    const lastMs = new Date(obs.observedAt).getTime();
    route.durationSeconds = Math.max(0, Math.round((lastMs - startMs) / 1000));

    this.store.saveRoute(route);
  }

  /**
   * Diagnostic health tracking & battery threshold alert dispatch.
   */
  private updateDeviceHealthFromEnvelope(deviceId: DeviceId, envelope: TelemetryEnvelope): void {
    const now = new Date().toISOString();
    const batteryPct = envelope.batteryPercent;

    let batteryState: BatteryStatus = 'UNKNOWN';
    if (batteryPct !== undefined) {
      if (batteryPct <= 10) batteryState = 'CRITICAL';
      else if (batteryPct <= 20) batteryState = 'LOW';
      else batteryState = 'NORMAL';
    }

    const connectivityState: DeviceConnectivityStatus = 'ONLINE';

    this.store.saveDeviceHealth({
      deviceId,
      lastSeenAt: envelope.receivedAt,
      lastLocationAt: envelope.observedAt,
      batteryPercent: batteryPct,
      batteryState,
      connectivityState,
      networkType: envelope.connectivityMetadata?.networkType || 'CELLULAR',
      locationSourceState: 'ACTIVE',
      updatedAt: now,
    });

    // Update tracking device aggregate
    const device = this.store.getDevice(deviceId);
    if (device) {
      device.lastSeenAt = envelope.receivedAt;
      device.lastLocationAt = envelope.observedAt;
      device.batteryPercent = batteryPct;
      device.batteryStatus = batteryState;
      device.connectivityStatus = connectivityState;
      device.updatedAt = now;
      this.store.saveDevice(device);

      // Battery notifications with deduplication cooldown (1 hour cooldown)
      if (batteryState === 'LOW' || batteryState === 'CRITICAL') {
        const cooldownKey = `${deviceId}:${batteryState}`;
        const lastAlertTime = this.batteryAlertCooldown.get(cooldownKey) || 0;
        const nowMs = Date.now();

        if (nowMs - lastAlertTime > 60 * 60 * 1000) {
          this.batteryAlertCooldown.set(cooldownKey, nowMs);

          if (batteryState === 'CRITICAL') {
            this.eventBus.publish({
              eventId: generateUUIDv7(),
              eventType: 'DeviceBatteryCritical',
              deviceId,
              batteryPercent: batteryPct!,
              householdId: device.householdId,
              occurredAt: now,
              aggregateId: deviceId,
            });
          } else {
            this.eventBus.publish({
              eventId: generateUUIDv7(),
              eventType: 'DeviceBatteryLow',
              deviceId,
              batteryPercent: batteryPct!,
              batteryStatus: batteryState,
              householdId: device.householdId,
              occurredAt: now,
              aggregateId: deviceId,
            });
          }

          // Trigger in-app notification if device is claimed by a household owner
          if (device.claimedBy) {
            NotificationStore.saveNotification({
              notificationId: asNotificationId(`notif-${generateUUIDv7()}`),
              recipientUserId: device.claimedBy,
              notificationType: 'SECURITY_ALERT',
              sourceType: 'TRACKING_DEVICE',
              sourceId: deviceId,
              title: `${device.displayName}: Battery ${batteryState} (${batteryPct}%)`,
              body: `The battery level for ${device.displayName} is at ${batteryPct}%. Please recharge the tracker to ensure uninterrupted location monitoring.`,
              channel: 'IN_APP',
              priority: batteryState === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
              scheduledAt: now,
              status: 'SENT',
              attemptCount: 1,
              maxAttempts: 3,
              deduplicationKey: `dev-batt-${deviceId}-${Math.floor(nowMs / (60 * 60 * 1000))}`,
              isRead: false,
              isDismissed: false,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }
  }

  // ==========================================================================
  // 4. TRACKING SESSIONS & DOG WALKING / ACTIVITY INTEGRATION
  // ==========================================================================

  startTrackingSessionForWalk(params: {
    walkSessionId: WalkSessionId;
    petIds: PetId[];
    walkerUserId: UserId;
    householdId: HouseholdId;
    sourceDeviceId?: DeviceId;
    sourceType?: LocationSourceType;
  }): { trackingSessionId: TrackingSessionId; routeReference: string } {
    const now = new Date().toISOString();
    const trackingSessionId = asTrackingSessionId(`trksess-${generateUUIDv7()}`);
    const routeReference = `rt-ref-${generateUUIDv7()}`;

    // Create session for primary pet
    const primaryPetId = params.petIds[0];

    const session: TrackingSession = {
      trackingSessionId,
      petId: primaryPetId,
      sourceDeviceId: params.sourceDeviceId,
      sourceType: params.sourceType || 'TRACKER_DEVICE',
      sourceContextType: 'DOG_WALK',
      sourceContextId: params.walkSessionId,
      status: 'ACTIVE',
      startedAt: now,
      trackingMode: 'ACTIVE_SESSION',
      routeReference,
      createdBy: params.walkerUserId,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveTrackingSession(session);

    // Initialize empty LocationRoute
    const routeId = asRouteId(`rt-${generateUUIDv7()}`);
    const route: LocationRoute = {
      routeId,
      petId: primaryPetId,
      trackingSessionId,
      sourceContextType: 'DOG_WALK',
      sourceContextId: params.walkSessionId,
      startedAt: now,
      status: 'ACTIVE',
      pointCount: 0,
      distanceMeters: 0,
      distanceReliability: 'HIGH_CONFIDENCE',
      durationSeconds: 0,
      routeReference,
      simplifiedPoints: [],
      qualitySummary: {
        highQualityPoints: 0,
        mediumQualityPoints: 0,
        lowQualityPoints: 0,
        anomalyCount: 0,
      },
      createdAt: now,
    };

    this.store.saveRoute(route);

    this.eventBus.publish({
      eventId: generateUUIDv7(),
      eventType: 'TrackingSessionStarted',
      trackingSessionId,
      petId: primaryPetId,
      sourceType: session.sourceType,
      sourceContextType: session.sourceContextType,
      sourceContextId: session.sourceContextId,
      routeReference,
      occurredAt: now,
      aggregateId: trackingSessionId,
      actorUserId: params.walkerUserId,
    });

    return { trackingSessionId, routeReference };
  }

  endTrackingSessionForWalk(params: {
    trackingSessionId: TrackingSessionId;
    walkSessionId?: WalkSessionId;
  }): RouteSummary {
    const session = this.store.getTrackingSession(params.trackingSessionId);
    if (!session) {
      throw new Error(`Tracking session ${params.trackingSessionId} not found`);
    }

    const now = new Date().toISOString();
    session.status = 'COMPLETED';
    session.endedAt = now;
    session.updatedAt = now;
    this.store.saveTrackingSession(session);

    const route = this.store.getRouteForSession(params.trackingSessionId);
    if (route) {
      route.status = 'COMPLETED';
      route.endedAt = now;
      route.completedAt = now;

      // Final distance computation
      const finalDist = calculateFilteredRouteDistance(route.simplifiedPoints);
      route.distanceMeters = finalDist.distanceMeters;
      route.distanceReliability = finalDist.reliability;

      const startMs = new Date(route.startedAt).getTime();
      const endMs = new Date(now).getTime();
      route.durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));

      this.store.saveRoute(route);

      // Cross-domain Activity projection: register ActivityRecord in ActivityStore
      // Dog Walking does NOT manage raw GPS coordinates; Activity receives normalized duration & distance.
      const activityId = asActivityId(`act-${generateUUIDv7()}`);
      ActivityStore.saveRecord({
        activityId,
        petId: session.petId,
        householdId: this.store.getDevice(session.sourceDeviceId || asDeviceId(''))?.householdId || ('' as HouseholdId),
        activityType: 'WALK',
        sourceType: 'SERVICE_PROVIDER',
        sourceActorId: session.createdBy,
        startedAt: route.startedAt,
        endedAt: now,
        durationSeconds: route.durationSeconds,
        distanceValue: route.distanceMeters,
        distanceUnit: 'METERS',
        distanceSource: 'GPS_MEASURED',
        routeReference: route.routeReference,
        recordedAt: now,
        createdBy: session.createdBy,
        createdAt: now,
        updatedAt: now,
        verificationStatus: 'VERIFIED',
      });

      this.eventBus.publish({
        eventId: generateUUIDv7(),
        eventType: 'RouteCompleted',
        routeId: route.routeId,
        petId: route.petId,
        trackingSessionId: route.trackingSessionId,
        routeReference: route.routeReference,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        distanceReliability: route.distanceReliability,
        occurredAt: now,
        aggregateId: route.routeId,
      });

      return {
        routeId: route.routeId,
        routeReference: route.routeReference,
        petId: route.petId,
        trackingSessionId: route.trackingSessionId,
        startedAt: route.startedAt,
        endedAt: route.endedAt,
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters,
        distanceReliability: route.distanceReliability,
        pointCount: route.pointCount,
        quality: route.qualitySummary.anomalyCount === 0 ? 'HIGH' : 'MEDIUM',
        interruptionPeriodsCount: 0,
      };
    }

    return {
      routeId: asRouteId(''),
      routeReference: session.routeReference,
      petId: session.petId,
      trackingSessionId: session.trackingSessionId,
      startedAt: session.startedAt,
      endedAt: now,
      durationSeconds: 0,
      distanceMeters: 0,
      distanceReliability: 'UNAVAILABLE',
      pointCount: 0,
      quality: 'UNKNOWN',
      interruptionPeriodsCount: 0,
    };
  }

  // ==========================================================================
  // 5. LOCATION AUTHORIZATION POLICIES & ANTI-STALKING SAFEGUARDS
  // ==========================================================================

  checkLocationAccess(query: LocationAuthorizationQuery): LocationAuthorizationResult {
    // 1. Check if actor is household owner or member with location permission
    const households = IdentityStore.listHouseholdsForUser(query.actorUserId);
    const activeAssignment = this.store.getActiveAssignmentForPet(query.petId);

    // Verify if actor belongs to the pet's household
    if (activeAssignment) {
      const isMember = households.some(h => h.householdId === activeAssignment.householdId);
      if (isMember) {
        const membership = IdentityStore.findMembership(activeAssignment.householdId, query.actorUserId);
        if (membership) {
          this.auditLogger.log({
            action: 'LIVE_LOCATION_ACCESSED',
            actorUserId: query.actorUserId,
            householdId: activeAssignment.householdId,
            petId: query.petId,
            success: true,
            reason: 'Household Owner/Member authorized',
          });
          const household = IdentityStore.findHouseholdById(activeAssignment.householdId);
          const isOwner =
            membership.role === 'HOUSEHOLD_OWNER' ||
            membership.role === 'HOUSEHOLD_ADMIN' ||
            household?.ownerUserId === query.actorUserId;

          return {
            granted: true,
            role: isOwner ? 'PET_OWNER' : 'HOUSEHOLD_MEMBER',
            reason: 'Authorized household member with location access',
            accessWindowValid: true,
          };
        }
      }
    }

    // 2. Check if actor is an active dog walker currently in service window
    if (query.context?.walkSessionId) {
      const walk = DogWalkingStore.getInstance().findSessionById(query.context.walkSessionId);
      if (walk && walk.walkerUserId === query.actorUserId && walk.petIds.includes(query.petId)) {
        const isActiveWalk = ['PICKUP_HANDOVER_IN_PROGRESS', 'IN_PROGRESS', 'PAUSED', 'RETURN_HANDOVER_IN_PROGRESS'].includes(walk.status);

        if (isActiveWalk) {
          this.auditLogger.log({
            action: 'LIVE_LOCATION_ACCESSED',
            actorUserId: query.actorUserId,
            householdId: walk.householdId,
            petId: query.petId,
            success: true,
            reason: 'Active service provider in valid session window',
          });
          return {
            granted: true,
            role: 'ACTIVE_SERVICE_PROVIDER',
            reason: 'Designated service provider during active service session',
            accessWindowValid: true,
          };
        } else {
          this.auditLogger.log({
            action: 'OUT_OF_WINDOW_ACCESS_DENIED',
            actorUserId: query.actorUserId,
            householdId: walk.householdId,
            petId: query.petId,
            success: false,
            reason: `Service session status is ${walk.status} (outside active window)`,
          });
          return {
            granted: false,
            role: 'ACTIVE_SERVICE_PROVIDER',
            reason: 'Service session has concluded. Real-time location access expired.',
            accessWindowValid: false,
          };
        }
      }
    }

    // 3. Deny public / cross-tenant / unauthorized access
    this.auditLogger.log({
      action: 'CROSS_TENANT_ACCESS_DENIED',
      actorUserId: query.actorUserId,
      petId: query.petId,
      success: false,
      reason: 'No valid household membership or active service window',
    });

    return {
      granted: false,
      role: 'PUBLIC_USER',
      reason: 'Unauthorized: Actor lacks permission to view pet location coordinates',
      accessWindowValid: false,
    };
  }

  getPetLiveLocation(petId: PetId, actorUserId: UserId): PetLiveLocation | undefined {
    const auth = this.checkLocationAccess({
      actorUserId,
      petId,
      action: 'VIEW_LIVE',
    });

    if (!auth.granted) {
      throw new Error(`Location access denied: ${auth.reason}`);
    }

    return this.store.getLiveLocation(petId);
  }

  getRouteHistory(petId: PetId, actorUserId: UserId): LocationRoute[] {
    const auth = this.checkLocationAccess({
      actorUserId,
      petId,
      action: 'VIEW_ROUTE_HISTORY',
    });

    if (!auth.granted) {
      throw new Error(`Route history access denied: ${auth.reason}`);
    }

    return this.store.listRoutesForPet(petId);
  }

  // ==========================================================================
  // 6. FUTURE CONTRACTS (GEOFENCING, LOST PET, MODES)
  // ==========================================================================

  getLastKnownLocation(petId: PetId): PetLiveLocation | undefined {
    return this.store.getLiveLocation(petId);
  }

  async requestTrackingMode(
    deviceId: DeviceId,
    mode: TrackingMode,
    actorUserId: UserId
  ): Promise<boolean> {
    if (!deviceId || (typeof deviceId === 'string' && deviceId.trim() === '')) {
      return false;
    }
    const device = this.store.getDevice(deviceId);
    if (!device) {
      return false;
    }

    const adapter = this.adapterRegistry.getAdapter(device.provider);
    if (adapter?.requestDeviceMode) {
      const result = await adapter.requestDeviceMode(device.externalDeviceReference, mode);
      return result;
    }

    return true;
  }

  recordDeadLetter(params: {
    provider: string;
    providerEventId: string;
    sourceDeviceReference: string;
    errorClassification: 'SIGNATURE_INVALID' | 'MALFORMED_COORDINATES' | 'UNKNOWN_DEVICE' | 'RATE_LIMITED' | 'CLOCK_SKEW' | 'OTHER';
    errorMessage: string;
    rawPayload: string;
    receivedAt: string;
  }): void {
    const dlId = asDeadLetterEventId(`dl-${generateUUIDv7()}`);
    this.store.recordDeadLetter({
      deadLetterId: dlId,
      provider: params.provider,
      providerEventId: params.providerEventId,
      sourceDeviceReference: params.sourceDeviceReference,
      errorClassification: params.errorClassification,
      errorMessage: params.errorMessage,
      rawPayload: params.rawPayload,
      receivedAt: params.receivedAt,
      reprocessed: false,
    });
  }

  reprocessDeadLetter(deadLetterId: DeadLetterEventId): boolean {
    const dl = this.store.getDeadLetter(deadLetterId);
    if (!dl || dl.reprocessed) return false;

    try {
      const payload = JSON.parse(dl.rawPayload);
      const res = this.ingestWebhook({
        provider: dl.provider,
        rawPayload: payload,
      });

      if (res.processedCount > 0) {
        this.store.markDeadLetterReprocessed(deadLetterId);
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }
}
