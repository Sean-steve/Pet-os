/**
 * Pet OS Sprint 13 - Dog Walking In-Memory Store
 * 
 * Provides transactional state storage, indexing, and reactive UI subscriptions.
 */

import {
  WalkSessionId,
  HandoverId,
  WalkIncidentId,
  WalkCompletionReportId,
  OfflineSyncEventId,
  BookingId,
  HouseholdId,
  UserId,
} from '../kernel/ids';
import {
  DogWalkSession,
  HandoverRecord,
  WalkTelemetryWaypoint,
  WalkPottyEvent,
  WalkBehaviorObservation,
  WalkIncident,
  WalkMedia,
  WalkCompletionReport,
  OfflineSyncEvent,
} from './types';

export class DogWalkingStore {
  private static instance: DogWalkingStore;

  private sessions: Map<string, DogWalkSession> = new Map();
  private handovers: Map<string, HandoverRecord> = new Map();
  private waypoints: Map<string, WalkTelemetryWaypoint[]> = new Map();
  private pottyEvents: Map<string, WalkPottyEvent[]> = new Map();
  private behaviors: Map<string, WalkBehaviorObservation[]> = new Map();
  private incidents: Map<string, WalkIncident> = new Map();
  private mediaItems: Map<string, WalkMedia[]> = new Map();
  private completionReports: Map<string, WalkCompletionReport> = new Map();
  private offlineSyncQueues: Map<string, OfflineSyncEvent[]> = new Map();

  private subscribers: Set<() => void> = new Set();

  static getInstance(): DogWalkingStore {
    if (!DogWalkingStore.instance) {
      DogWalkingStore.instance = new DogWalkingStore();
    }
    return DogWalkingStore.instance;
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('DogWalkingStore subscriber error:', err);
      }
    });
  }

  reset(): void {
    this.sessions.clear();
    this.handovers.clear();
    this.waypoints.clear();
    this.pottyEvents.clear();
    this.behaviors.clear();
    this.incidents.clear();
    this.mediaItems.clear();
    this.completionReports.clear();
    this.offlineSyncQueues.clear();
    this.notify();
  }

  // ==========================================================================
  // SESSIONS
  // ==========================================================================

  saveSession(session: DogWalkSession): void {
    this.sessions.set(session.walkSessionId, { ...session });
    this.notify();
  }

  findSessionById(id: WalkSessionId): DogWalkSession | undefined {
    const s = this.sessions.get(id);
    return s ? { ...s } : undefined;
  }

  findSessionByBookingId(bookingId: BookingId): DogWalkSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.bookingId === bookingId) {
        return { ...s };
      }
    }
    return undefined;
  }

  listSessionsForWalker(walkerUserId: UserId): DogWalkSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.walkerUserId === walkerUserId)
      .sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }

  listSessionsForHousehold(householdId: HouseholdId): DogWalkSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.householdId === householdId)
      .sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }

  listAllSessions(): DogWalkSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }

  // ==========================================================================
  // HANDOVERS
  // ==========================================================================

  saveHandover(handover: HandoverRecord): void {
    this.handovers.set(handover.handoverId, { ...handover });
    this.notify();
  }

  findHandoverById(id: HandoverId): HandoverRecord | undefined {
    const h = this.handovers.get(id);
    return h ? { ...h } : undefined;
  }

  listHandoversForSession(walkSessionId: WalkSessionId): HandoverRecord[] {
    return Array.from(this.handovers.values())
      .filter(h => h.walkSessionId === walkSessionId)
      .sort((a, b) => new Date(a.transferredAt).getTime() - new Date(b.transferredAt).getTime());
  }

  // ==========================================================================
  // WAYPOINTS & TELEMETRY
  // ==========================================================================

  addWaypoint(waypoint: WalkTelemetryWaypoint): void {
    const list = this.waypoints.get(waypoint.walkSessionId) || [];
    list.push({ ...waypoint });
    this.waypoints.set(waypoint.walkSessionId, list);
    this.notify();
  }

  getWaypointsForSession(walkSessionId: WalkSessionId): WalkTelemetryWaypoint[] {
    const list = this.waypoints.get(walkSessionId) || [];
    return [...list].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  // ==========================================================================
  // POTTY EVENTS
  // ==========================================================================

  addPottyEvent(event: WalkPottyEvent): void {
    const list = this.pottyEvents.get(event.walkSessionId) || [];
    list.push({ ...event });
    this.pottyEvents.set(event.walkSessionId, list);
    this.notify();
  }

  getPottyEventsForSession(walkSessionId: WalkSessionId): WalkPottyEvent[] {
    const list = this.pottyEvents.get(walkSessionId) || [];
    return [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ==========================================================================
  // BEHAVIORS
  // ==========================================================================

  addBehaviorObservation(obs: WalkBehaviorObservation): void {
    const list = this.behaviors.get(obs.walkSessionId) || [];
    list.push({ ...obs });
    this.behaviors.set(obs.walkSessionId, list);
    this.notify();
  }

  getBehaviorObservationsForSession(walkSessionId: WalkSessionId): WalkBehaviorObservation[] {
    const list = this.behaviors.get(walkSessionId) || [];
    return [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ==========================================================================
  // INCIDENTS
  // ==========================================================================

  saveIncident(incident: WalkIncident): void {
    this.incidents.set(incident.incidentId, { ...incident });
    this.notify();
  }

  findIncidentById(id: WalkIncidentId): WalkIncident | undefined {
    const inc = this.incidents.get(id);
    return inc ? { ...inc } : undefined;
  }

  listIncidentsForSession(walkSessionId: WalkSessionId): WalkIncident[] {
    return Array.from(this.incidents.values())
      .filter(i => i.walkSessionId === walkSessionId)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  listAllIncidents(): WalkIncident[] {
    return Array.from(this.incidents.values())
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  // ==========================================================================
  // MEDIA
  // ==========================================================================

  addMedia(item: WalkMedia): void {
    const list = this.mediaItems.get(item.walkSessionId) || [];
    list.push({ ...item });
    this.mediaItems.set(item.walkSessionId, list);
    this.notify();
  }

  getMediaForSession(walkSessionId: WalkSessionId): WalkMedia[] {
    const list = this.mediaItems.get(walkSessionId) || [];
    return [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ==========================================================================
  // COMPLETION REPORTS
  // ==========================================================================

  saveCompletionReport(report: WalkCompletionReport): void {
    this.completionReports.set(report.reportId, { ...report });
    this.notify();
  }

  findCompletionReportById(id: WalkCompletionReportId): WalkCompletionReport | undefined {
    const r = this.completionReports.get(id);
    return r ? { ...r } : undefined;
  }

  findCompletionReportBySessionId(walkSessionId: WalkSessionId): WalkCompletionReport | undefined {
    for (const r of this.completionReports.values()) {
      if (r.walkSessionId === walkSessionId) {
        return { ...r };
      }
    }
    return undefined;
  }

  // ==========================================================================
  // OFFLINE SYNC QUEUE
  // ==========================================================================

  queueOfflineEvent(event: OfflineSyncEvent): void {
    const list = this.offlineSyncQueues.get(event.walkSessionId) || [];
    list.push({ ...event });
    this.offlineSyncQueues.set(event.walkSessionId, list);
    this.notify();
  }

  getOfflineEventsForSession(walkSessionId: WalkSessionId): OfflineSyncEvent[] {
    const list = this.offlineSyncQueues.get(walkSessionId) || [];
    return [...list].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  }

  markOfflineEventSynced(walkSessionId: WalkSessionId, syncEventId: OfflineSyncEventId): void {
    const list = this.offlineSyncQueues.get(walkSessionId) || [];
    const item = list.find(e => e.syncEventId === syncEventId);
    if (item) {
      item.syncStatus = 'SYNCED';
      item.syncedAt = new Date().toISOString();
      this.notify();
    }
  }
}
