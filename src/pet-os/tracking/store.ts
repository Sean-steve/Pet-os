/**
 * Pet OS Sprint 14 - Tracking & Location Platform Repository / Store
 * In-memory canonical persistence with query indexes and historical preservation.
 */

import {
  DeviceId,
  PetId,
  HouseholdId,
  TrackingDeviceAssignmentId,
  TrackingSessionId,
  LocationObservationId,
  RouteId,
  IntegrationCredentialId,
  DeadLetterEventId,
} from '../kernel/ids';
import {
  TrackingDevice,
  TrackingDeviceAssignment,
  TrackingSession,
  LocationObservation,
  PetLiveLocation,
  LocationRoute,
  DeviceHealth,
  TrackerIntegration,
  DeadLetterEvent,
} from './types';

export class TrackingStore {
  private static instance: TrackingStore;

  private devices = new Map<DeviceId, TrackingDevice>();
  private deviceByExternalRef = new Map<string, DeviceId>(); // `${provider}:${externalRef}` -> DeviceId

  private assignments = new Map<TrackingDeviceAssignmentId, TrackingDeviceAssignment>();
  private assignmentsByDevice = new Map<DeviceId, TrackingDeviceAssignmentId[]>();
  private assignmentsByPet = new Map<PetId, TrackingDeviceAssignmentId[]>();

  private trackingSessions = new Map<TrackingSessionId, TrackingSession>();
  private sessionsByPet = new Map<PetId, TrackingSessionId[]>();

  private observations = new Map<LocationObservationId, LocationObservation>();
  private observationsByPet = new Map<PetId, LocationObservationId[]>();
  private observationsBySession = new Map<TrackingSessionId, LocationObservationId[]>();
  private observationsByDevice = new Map<DeviceId, LocationObservationId[]>();

  private liveLocations = new Map<PetId, PetLiveLocation>();

  private routes = new Map<RouteId, LocationRoute>();
  private routesByReference = new Map<string, RouteId>();
  private routesBySession = new Map<TrackingSessionId, RouteId>();

  private deviceHealth = new Map<DeviceId, DeviceHealth>();

  private integrations = new Map<IntegrationCredentialId, TrackerIntegration>();
  private integrationsByHousehold = new Map<HouseholdId, IntegrationCredentialId[]>();

  private deadLetters = new Map<DeadLetterEventId, DeadLetterEvent>();

  // Telemetry deduplication cache: `${provider}:${providerEventId}`
  private deduplicationCache = new Set<string>();

  private listeners = new Set<() => void>();

  private constructor() {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  static getInstance(): TrackingStore {
    if (!TrackingStore.instance) {
      TrackingStore.instance = new TrackingStore();
    }
    return TrackingStore.instance;
  }

  static reset(): void {
    TrackingStore.getInstance().clear();
  }

  clear(): void {
    this.devices.clear();
    this.deviceByExternalRef.clear();
    this.assignments.clear();
    this.assignmentsByDevice.clear();
    this.assignmentsByPet.clear();
    this.trackingSessions.clear();
    this.sessionsByPet.clear();
    this.observations.clear();
    this.observationsByPet.clear();
    this.observationsBySession.clear();
    this.observationsByDevice.clear();
    this.liveLocations.clear();
    this.routes.clear();
    this.routesByReference.clear();
    this.routesBySession.clear();
    this.deviceHealth.clear();
    this.integrations.clear();
    this.integrationsByHousehold.clear();
    this.deadLetters.clear();
    this.deduplicationCache.clear();
  }

  // ==========================================================================
  // DEVICE REGISTRY
  // ==========================================================================

  saveDevice(device: TrackingDevice): void {
    this.devices.set(device.deviceId, { ...device });
    const extKey = `${device.provider.toUpperCase()}:${device.externalDeviceReference}`;
    this.deviceByExternalRef.set(extKey, device.deviceId);
    this.notify();
  }

  getDevice(deviceId: DeviceId): TrackingDevice | undefined {
    const d = this.devices.get(deviceId);
    return d ? { ...d } : undefined;
  }

  findDeviceByExternalReference(provider: string, externalReference: string): TrackingDevice | undefined {
    const extKey = `${provider.toUpperCase()}:${externalReference}`;
    const id = this.deviceByExternalRef.get(extKey);
    return id ? this.getDevice(id) : undefined;
  }

  listDevices(): TrackingDevice[] {
    return Array.from(this.devices.values()).map(d => ({ ...d }));
  }

  listDevicesForHousehold(householdId: HouseholdId): TrackingDevice[] {
    return Array.from(this.devices.values())
      .filter(d => d.householdId === householdId)
      .map(d => ({ ...d }));
  }

  // ==========================================================================
  // ASSIGNMENTS & HISTORICAL RESOLUTION
  // ==========================================================================

  saveAssignment(assignment: TrackingDeviceAssignment): void {
    this.assignments.set(assignment.assignmentId, { ...assignment });

    const devList = this.assignmentsByDevice.get(assignment.deviceId) || [];
    if (!devList.includes(assignment.assignmentId)) {
      devList.push(assignment.assignmentId);
      this.assignmentsByDevice.set(assignment.deviceId, devList);
    }

    const petList = this.assignmentsByPet.get(assignment.petId) || [];
    if (!petList.includes(assignment.assignmentId)) {
      petList.push(assignment.assignmentId);
      this.assignmentsByPet.set(assignment.petId, petList);
    }
    this.notify();
  }

  listAllAssignments(): TrackingDeviceAssignment[] {
    return Array.from(this.assignments.values()).map(a => ({ ...a }));
  }

  getAssignment(assignmentId: TrackingDeviceAssignmentId): TrackingDeviceAssignment | undefined {
    const a = this.assignments.get(assignmentId);
    return a ? { ...a } : undefined;
  }

  getActiveAssignmentForDevice(deviceId: DeviceId): TrackingDeviceAssignment | undefined {
    const ids = this.assignmentsByDevice.get(deviceId) || [];
    for (const id of ids) {
      const a = this.assignments.get(id);
      if (a && a.status === 'ACTIVE' && !a.unassignedAt) {
        return { ...a };
      }
    }
    return undefined;
  }

  getActiveAssignmentForPet(petId: PetId): TrackingDeviceAssignment | undefined {
    const ids = this.assignmentsByPet.get(petId) || [];
    for (const id of ids) {
      const a = this.assignments.get(id);
      if (a && a.status === 'ACTIVE' && !a.unassignedAt) {
        return { ...a };
      }
    }
    return undefined;
  }

  getAssignmentsForPet(petId: PetId): TrackingDeviceAssignment[] {
    const ids = this.assignmentsByPet.get(petId) || [];
    return ids
      .map(id => this.assignments.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
      .map(a => ({ ...a }));
  }

  /**
   * Resolves the pet associated with a device at a specific historical point in time.
   * Ensures historical telemetry stays with the pet that wore the collar back then!
   */
  resolveAssignmentAtTime(deviceId: DeviceId, observedAt: string): TrackingDeviceAssignment | undefined {
    const targetMs = new Date(observedAt).getTime();
    const ids = this.assignmentsByDevice.get(deviceId) || [];

    for (const id of ids) {
      const a = this.assignments.get(id);
      if (!a) continue;

      const startMs = new Date(a.assignedAt).getTime();
      const endMs = a.unassignedAt ? new Date(a.unassignedAt).getTime() : Infinity;

      if (startMs <= targetMs && targetMs <= endMs) {
        return { ...a };
      }
    }

    // Fallback to currently active assignment if observedAt is slightly in future/clock-drift
    return this.getActiveAssignmentForDevice(deviceId);
  }

  // ==========================================================================
  // TRACKING SESSIONS
  // ==========================================================================

  saveTrackingSession(session: TrackingSession): void {
    this.trackingSessions.set(session.trackingSessionId, { ...session });
    const list = this.sessionsByPet.get(session.petId) || [];
    if (!list.includes(session.trackingSessionId)) {
      list.push(session.trackingSessionId);
      this.sessionsByPet.set(session.petId, list);
    }
  }

  getTrackingSession(sessionId: TrackingSessionId): TrackingSession | undefined {
    const s = this.trackingSessions.get(sessionId);
    return s ? { ...s } : undefined;
  }

  getActiveSessionForPet(petId: PetId): TrackingSession | undefined {
    const ids = this.sessionsByPet.get(petId) || [];
    for (const id of ids) {
      const s = this.trackingSessions.get(id);
      if (s && s.status === 'ACTIVE') {
        return { ...s };
      }
    }
    return undefined;
  }

  findSessionByContext(sourceContextType: string, sourceContextId: string): TrackingSession | undefined {
    for (const s of this.trackingSessions.values()) {
      if (s.sourceContextType === sourceContextType && s.sourceContextId === sourceContextId) {
        return { ...s };
      }
    }
    return undefined;
  }

  // ==========================================================================
  // NORMALIZED OBSERVATIONS
  // ==========================================================================

  saveObservation(observation: LocationObservation): void {
    this.observations.set(observation.locationObservationId, { ...observation });

    const petList = this.observationsByPet.get(observation.petId) || [];
    petList.push(observation.locationObservationId);
    this.observationsByPet.set(observation.petId, petList);

    if (observation.trackingSessionId) {
      const sessList = this.observationsBySession.get(observation.trackingSessionId) || [];
      sessList.push(observation.locationObservationId);
      this.observationsBySession.set(observation.trackingSessionId, sessList);
    }

    const devList = this.observationsByDevice.get(observation.deviceId) || [];
    devList.push(observation.locationObservationId);
    this.observationsByDevice.set(observation.deviceId, devList);
  }

  getObservation(id: LocationObservationId): LocationObservation | undefined {
    const o = this.observations.get(id);
    return o ? { ...o } : undefined;
  }

  getObservationsForPet(petId: PetId, limit = 500): LocationObservation[] {
    const ids = this.observationsByPet.get(petId) || [];
    return ids
      .map(id => this.observations.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())
      .slice(-limit)
      .map(o => ({ ...o }));
  }

  getObservationsForSession(sessionId: TrackingSessionId): LocationObservation[] {
    const ids = this.observationsBySession.get(sessionId) || [];
    return ids
      .map(id => this.observations.get(id)!)
      .filter(Boolean)
      .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())
      .map(o => ({ ...o }));
  }

  getLatestObservationForDevice(deviceId: DeviceId): LocationObservation | undefined {
    const ids = this.observationsByDevice.get(deviceId) || [];
    if (ids.length === 0) return undefined;
    const all = ids.map(id => this.observations.get(id)!).filter(Boolean);
    all.sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime());
    return all[0] ? { ...all[0] } : undefined;
  }

  // ==========================================================================
  // LIVE LOCATION PROJECTION
  // ==========================================================================

  saveLiveLocation(live: PetLiveLocation): void {
    this.liveLocations.set(live.petId, { ...live });
    this.notify();
  }

  getLiveLocation(petId: PetId): PetLiveLocation | undefined {
    const l = this.liveLocations.get(petId);
    return l ? { ...l } : undefined;
  }

  removeLiveLocation(petId: PetId): void {
    this.liveLocations.delete(petId);
    this.notify();
  }

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  saveRoute(route: LocationRoute): void {
    this.routes.set(route.routeId, { ...route });
    this.routesByReference.set(route.routeReference, route.routeId);
    this.routesBySession.set(route.trackingSessionId, route.routeId);
    this.notify();
  }

  getRoute(routeId: RouteId): LocationRoute | undefined {
    const r = this.routes.get(routeId);
    return r ? { ...r } : undefined;
  }

  getRouteByReference(routeReference: string): LocationRoute | undefined {
    const id = this.routesByReference.get(routeReference);
    return id ? this.getRoute(id) : undefined;
  }

  getRouteForSession(sessionId: TrackingSessionId): LocationRoute | undefined {
    const id = this.routesBySession.get(sessionId);
    return id ? this.getRoute(id) : undefined;
  }

  listRoutesForPet(petId: PetId): LocationRoute[] {
    return Array.from(this.routes.values())
      .filter(r => r.petId === petId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .map(r => ({ ...r }));
  }

  // ==========================================================================
  // DEVICE HEALTH
  // ==========================================================================

  saveDeviceHealth(health: DeviceHealth): void {
    this.deviceHealth.set(health.deviceId, { ...health });
  }

  getDeviceHealth(deviceId: DeviceId): DeviceHealth | undefined {
    const h = this.deviceHealth.get(deviceId);
    return h ? { ...h } : undefined;
  }

  // ==========================================================================
  // INTEGRATIONS & CREDENTIALS
  // ==========================================================================

  saveIntegration(integration: TrackerIntegration): void {
    this.integrations.set(integration.integrationId, { ...integration });
    const list = this.integrationsByHousehold.get(integration.householdId) || [];
    if (!list.includes(integration.integrationId)) {
      list.push(integration.integrationId);
      this.integrationsByHousehold.set(integration.householdId, list);
    }
  }

  getIntegration(id: IntegrationCredentialId): TrackerIntegration | undefined {
    const i = this.integrations.get(id);
    return i ? { ...i } : undefined;
  }

  listIntegrationsForHousehold(householdId: HouseholdId): TrackerIntegration[] {
    const ids = this.integrationsByHousehold.get(householdId) || [];
    return ids.map(id => this.integrations.get(id)!).filter(Boolean).map(i => ({ ...i }));
  }

  // ==========================================================================
  // DEDUPLICATION & DEAD LETTERS
  // ==========================================================================

  isDuplicateIngestion(provider: string, providerEventId: string): boolean {
    const key = `${provider.toUpperCase()}:${providerEventId}`;
    return this.deduplicationCache.has(key);
  }

  markIngestionProcessed(provider: string, providerEventId: string): void {
    const key = `${provider.toUpperCase()}:${providerEventId}`;
    this.deduplicationCache.add(key);
  }

  recordDeadLetter(deadLetter: DeadLetterEvent): void {
    this.deadLetters.set(deadLetter.deadLetterId, { ...deadLetter });
  }

  getDeadLetter(id: DeadLetterEventId): DeadLetterEvent | undefined {
    const dl = this.deadLetters.get(id);
    return dl ? { ...dl } : undefined;
  }

  listDeadLetters(): DeadLetterEvent[] {
    return Array.from(this.deadLetters.values()).map(dl => ({ ...dl }));
  }

  markDeadLetterReprocessed(id: DeadLetterEventId): void {
    const dl = this.deadLetters.get(id);
    if (dl) {
      dl.reprocessed = true;
      dl.reprocessedAt = new Date().toISOString();
      this.deadLetters.set(id, dl);
    }
  }
}
