/**
 * Pet OS Sprint 22 — Pet Transport Store
 * In-Memory Database and Outbox Store for Transport Domain
 */

import {
  TransportDriverProfileId,
  TransportVehicleId,
  TransportTripId,
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
  BookingId,
  PetId,
  UserId,
  BusinessId,
} from '../kernel/ids';
import {
  TransportDriverProfile,
  TransportVehicle,
  TransportTrip,
  TransportStop,
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
} from './types';
import { TransportEvent } from './events';

export interface TransportAuditEntry {
  auditId: string;
  tripId?: TransportTripId;
  action: string;
  actorUserId: UserId;
  details: Record<string, unknown>;
  timestamp: string;
}

export class TransportStore {
  private static instance: TransportStore;

  private drivers = new Map<TransportDriverProfileId, TransportDriverProfile>();
  private vehicles = new Map<TransportVehicleId, TransportVehicle>();
  private trips = new Map<TransportTripId, TransportTrip>();
  private stops = new Map<TransportStopId, TransportStop>();
  private snapshots = new Map<TransportInstructionSnapshotId, TransportInstructionSnapshot>();
  private containmentAssignments = new Map<TransportContainmentAssignmentId, TransportPetContainmentAssignment>();
  private custodyRecords = new Map<TransportCustodyRecordId, TransportCustodyRecord>();
  private handoverRecords = new Map<TransportHandoverRecordId, TransportHandoverRecord>();
  private delays = new Map<TransportDelayId, TransportDelay>();
  private observations = new Map<TransportEnvironmentObservationId, TransportEnvironmentObservation>();
  private safetyAlerts = new Map<TransportSafetyAlertId, TransportSafetyAlert>();
  private incidents = new Map<TransportIncidentId, TransportIncident>();
  private belongings = new Map<TransportBelongingItemId, TransportBelongingItem>();
  private welfareChecks = new Map<string, TransportWelfareCheck>();
  private completionEvidences = new Map<TransportCompletionEvidenceId, TransportCompletionEvidence>();
  private outboxEvents: TransportEvent[] = [];
  private auditLogs: TransportAuditEntry[] = [];
  private subscribers: ((event: TransportEvent) => void)[] = [];

  private constructor() {}

  public static getInstance(): TransportStore {
    if (!TransportStore.instance) {
      TransportStore.instance = new TransportStore();
    }
    return TransportStore.instance;
  }

  public reset(): void {
    this.drivers.clear();
    this.vehicles.clear();
    this.trips.clear();
    this.stops.clear();
    this.snapshots.clear();
    this.containmentAssignments.clear();
    this.custodyRecords.clear();
    this.handoverRecords.clear();
    this.delays.clear();
    this.observations.clear();
    this.safetyAlerts.clear();
    this.incidents.clear();
    this.belongings.clear();
    this.welfareChecks.clear();
    this.completionEvidences.clear();
    this.outboxEvents = [];
    this.auditLogs = [];
  }

  // Drivers
  public saveDriver(driver: TransportDriverProfile): void {
    this.drivers.set(driver.driverProfileId, { ...driver });
  }

  public getDriver(id: TransportDriverProfileId): TransportDriverProfile | undefined {
    const d = this.drivers.get(id);
    return d ? { ...d } : undefined;
  }

  public getDriverByUserId(userId: UserId): TransportDriverProfile | undefined {
    for (const d of this.drivers.values()) {
      if (d.userId === userId) return { ...d };
    }
    return undefined;
  }

  public listDrivers(): TransportDriverProfile[] {
    return Array.from(this.drivers.values()).map(d => ({ ...d }));
  }

  // Vehicles
  public saveVehicle(vehicle: TransportVehicle): void {
    this.vehicles.set(vehicle.vehicleId, { ...vehicle });
  }

  public getVehicle(id: TransportVehicleId): TransportVehicle | undefined {
    const v = this.vehicles.get(id);
    return v ? { ...v } : undefined;
  }

  public listVehicles(businessId?: BusinessId): TransportVehicle[] {
    const list = Array.from(this.vehicles.values());
    if (businessId) {
      return list.filter(v => v.businessId === businessId).map(v => ({ ...v }));
    }
    return list.map(v => ({ ...v }));
  }

  // Trips
  public saveTrip(trip: TransportTrip): void {
    this.trips.set(trip.tripId, { ...trip, pets: [...trip.pets], stops: [...trip.stops] });
  }

  public getTrip(id: TransportTripId): TransportTrip | undefined {
    const t = this.trips.get(id);
    return t ? { ...t, pets: [...t.pets], stops: [...t.stops] } : undefined;
  }

  public getTripByBookingId(bookingId: BookingId): TransportTrip | undefined {
    for (const t of this.trips.values()) {
      if (t.bookingId === bookingId) {
        return { ...t, pets: [...t.pets], stops: [...t.stops] };
      }
    }
    return undefined;
  }

  public listTrips(): TransportTrip[] {
    return Array.from(this.trips.values()).map(t => ({
      ...t,
      pets: [...t.pets],
      stops: [...t.stops],
    }));
  }

  // Stops
  public saveStop(stop: TransportStop): void {
    this.stops.set(stop.stopId, { ...stop });
  }

  public getStop(id: TransportStopId): TransportStop | undefined {
    const s = this.stops.get(id);
    return s ? { ...s } : undefined;
  }

  public getStopsForTrip(tripId: TransportTripId): TransportStop[] {
    return Array.from(this.stops.values())
      .filter(s => s.tripId === tripId)
      .sort((a, b) => a.sequence - b.sequence)
      .map(s => ({ ...s }));
  }

  // Snapshots
  public saveSnapshot(snapshot: TransportInstructionSnapshot): void {
    this.snapshots.set(snapshot.snapshotId, { ...snapshot });
  }

  public getSnapshot(id: TransportInstructionSnapshotId): TransportInstructionSnapshot | undefined {
    const s = this.snapshots.get(id);
    return s ? { ...s } : undefined;
  }

  public getSnapshotsForTrip(tripId: TransportTripId): TransportInstructionSnapshot[] {
    return Array.from(this.snapshots.values())
      .filter(s => s.tripId === tripId)
      .map(s => ({ ...s }));
  }

  // Containment
  public saveContainment(assignment: TransportPetContainmentAssignment): void {
    this.containmentAssignments.set(assignment.assignmentId, { ...assignment });
  }

  public getContainment(id: TransportContainmentAssignmentId): TransportPetContainmentAssignment | undefined {
    const c = this.containmentAssignments.get(id);
    return c ? { ...c } : undefined;
  }

  public getContainmentsForTrip(tripId: TransportTripId): TransportPetContainmentAssignment[] {
    return Array.from(this.containmentAssignments.values())
      .filter(c => c.tripId === tripId)
      .map(c => ({ ...c }));
  }

  // Custody
  public saveCustodyRecord(record: TransportCustodyRecord): void {
    this.custodyRecords.set(record.custodyRecordId, { ...record });
  }

  public getCustodyRecordsForTrip(tripId: TransportTripId): TransportCustodyRecord[] {
    return Array.from(this.custodyRecords.values())
      .filter(c => c.tripId === tripId)
      .sort((a, b) => a.transferredAt.localeCompare(b.transferredAt))
      .map(c => ({ ...c }));
  }

  public getLatestCustodyRecordForPet(petId: PetId): TransportCustodyRecord | undefined {
    const list = Array.from(this.custodyRecords.values())
      .filter(c => c.petId === petId)
      .sort((a, b) => b.transferredAt.localeCompare(a.transferredAt));
    return list[0] ? { ...list[0] } : undefined;
  }

  // Handovers
  public saveHandoverRecord(record: TransportHandoverRecord): void {
    this.handoverRecords.set(record.handoverId, { ...record });
  }

  public getHandoverRecordsForTrip(tripId: TransportTripId): TransportHandoverRecord[] {
    return Array.from(this.handoverRecords.values())
      .filter(h => h.tripId === tripId)
      .map(h => ({ ...h }));
  }

  // Delays
  public saveDelay(delay: TransportDelay): void {
    this.delays.set(delay.delayId, { ...delay });
  }

  public getDelaysForTrip(tripId: TransportTripId): TransportDelay[] {
    return Array.from(this.delays.values())
      .filter(d => d.tripId === tripId)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map(d => ({ ...d }));
  }

  // Environment
  public saveObservation(observation: TransportEnvironmentObservation): void {
    this.observations.set(observation.observationId, { ...observation });
  }

  public getObservationsForTrip(tripId: TransportTripId): TransportEnvironmentObservation[] {
    return Array.from(this.observations.values())
      .filter(o => o.tripId === tripId)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      .map(o => ({ ...o }));
  }

  public saveSafetyAlert(alert: TransportSafetyAlert): void {
    this.safetyAlerts.set(alert.alertId, { ...alert });
  }

  public getSafetyAlertsForTrip(tripId: TransportTripId): TransportSafetyAlert[] {
    return Array.from(this.safetyAlerts.values())
      .filter(a => a.tripId === tripId)
      .map(a => ({ ...a }));
  }

  // Incidents
  public saveIncident(incident: TransportIncident): void {
    this.incidents.set(incident.incidentId, { ...incident, petIds: [...incident.petIds] });
  }

  public getIncident(id: TransportIncidentId): TransportIncident | undefined {
    const i = this.incidents.get(id);
    return i ? { ...i, petIds: [...i.petIds] } : undefined;
  }

  public getIncidentsForTrip(tripId: TransportTripId): TransportIncident[] {
    return Array.from(this.incidents.values())
      .filter(i => i.tripId === tripId)
      .map(i => ({ ...i, petIds: [...i.petIds] }));
  }

  // Belongings
  public saveBelonging(item: TransportBelongingItem): void {
    this.belongings.set(item.itemId, { ...item });
  }

  public getBelongingsForTrip(tripId: TransportTripId): TransportBelongingItem[] {
    return Array.from(this.belongings.values())
      .filter(b => b.tripId === tripId)
      .map(b => ({ ...b }));
  }

  // Welfare Checks
  public saveWelfareCheck(check: TransportWelfareCheck): void {
    this.welfareChecks.set(check.checkId, { ...check });
  }

  public getWelfareChecksForTrip(tripId: TransportTripId): TransportWelfareCheck[] {
    return Array.from(this.welfareChecks.values())
      .filter(w => w.tripId === tripId)
      .map(w => ({ ...w }));
  }

  // Completion Evidence
  public saveCompletionEvidence(evidence: TransportCompletionEvidence): void {
    this.completionEvidences.set(evidence.completionEvidenceId, { ...evidence, petIds: [...evidence.petIds] });
  }

  public getCompletionEvidence(tripId: TransportTripId): TransportCompletionEvidence | undefined {
    for (const e of this.completionEvidences.values()) {
      if (e.tripId === tripId) {
        return { ...e, petIds: [...e.petIds] };
      }
    }
    return undefined;
  }

  // Audit
  public recordAudit(entry: TransportAuditEntry): void {
    this.auditLogs.push({ ...entry });
  }

  public getAuditLogs(tripId?: TransportTripId): TransportAuditEntry[] {
    if (tripId) {
      return this.auditLogs.filter(a => a.tripId === tripId);
    }
    return [...this.auditLogs];
  }

  // Outbox & Events
  public emitEvent(event: TransportEvent): void {
    this.outboxEvents.push(event);
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('Transport event subscriber error:', err);
      }
    }
  }

  public subscribe(callback: (event: TransportEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const idx = this.subscribers.indexOf(callback);
      if (idx >= 0) this.subscribers.splice(idx, 1);
    };
  }

  public getOutboxEvents(): TransportEvent[] {
    return [...this.outboxEvents];
  }
}
