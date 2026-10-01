/**
 * Pet OS Sprint 21 - Professional Care Workspace In-Memory Store
 */

import {
  CareEngagementId,
  CareInstructionSnapshotId,
  CareAccessGrantId,
  CareHandoverId,
  CareAccessSecretId,
  CareServiceIncidentId,
  CareCompletionEvidenceId,
  CareShiftHandoverId,
  CareServiceObservationId,
  GroomingSessionId,
  SitterVisitId,
  BoardingStayId,
  BoardingUnitId,
  BookingId,
  PetId,
  UserId,
  BusinessId,
} from '../kernel/ids';

import {
  ProfessionalCareEngagement,
  CareInstructionSnapshot,
  CareAccessGrant,
  CareAccessSecret,
  CareHandover,
  CareServiceObservation,
  CareServiceIncident,
  GroomingSession,
  SitterVisit,
  BoardingStay,
  BoardingUnit,
  CareShiftHandover,
  CareCompletionEvidence,
} from './types';

import { CareWorkspaceDomainEvent } from './events';

export class ProfessionalCareStore {
  private static instance: ProfessionalCareStore;

  private engagements = new Map<CareEngagementId, ProfessionalCareEngagement>();
  private snapshots = new Map<CareInstructionSnapshotId, CareInstructionSnapshot>();
  private accessGrants = new Map<CareAccessGrantId, CareAccessGrant>();
  private accessSecrets = new Map<CareAccessSecretId, CareAccessSecret>();
  private handovers = new Map<CareHandoverId, CareHandover>();
  private observations = new Map<CareServiceObservationId, CareServiceObservation>();
  private incidents = new Map<CareServiceIncidentId, CareServiceIncident>();
  private groomingSessions = new Map<GroomingSessionId, GroomingSession>();
  private sitterVisits = new Map<SitterVisitId, SitterVisit>();
  private boardingStays = new Map<BoardingStayId, BoardingStay>();
  private boardingUnits = new Map<BoardingUnitId, BoardingUnit>();
  private shiftHandovers = new Map<CareShiftHandoverId, CareShiftHandover>();
  private completionEvidences = new Map<CareCompletionEvidenceId, CareCompletionEvidence>();

  private eventListeners: Array<(event: CareWorkspaceDomainEvent) => void> = [];
  private eventLog: CareWorkspaceDomainEvent[] = [];

  public static getInstance(): ProfessionalCareStore {
    if (!ProfessionalCareStore.instance) {
      ProfessionalCareStore.instance = new ProfessionalCareStore();
    }
    return ProfessionalCareStore.instance;
  }

  public reset(): void {
    this.engagements.clear();
    this.snapshots.clear();
    this.accessGrants.clear();
    this.accessSecrets.clear();
    this.handovers.clear();
    this.observations.clear();
    this.incidents.clear();
    this.groomingSessions.clear();
    this.sitterVisits.clear();
    this.boardingStays.clear();
    this.boardingUnits.clear();
    this.shiftHandovers.clear();
    this.completionEvidences.clear();
    this.eventLog = [];
  }

  // Event Pub/Sub
  public subscribe(listener: (event: CareWorkspaceDomainEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  public emitEvent(event: CareWorkspaceDomainEvent): void {
    this.eventLog.push(event);
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in ProfessionalCare event listener:', err);
      }
    }
  }

  public getEventLog(): CareWorkspaceDomainEvent[] {
    return [...this.eventLog];
  }

  // Engagements
  public saveEngagement(engagement: ProfessionalCareEngagement): void {
    this.engagements.set(engagement.engagementId, { ...engagement });
  }

  public getEngagement(id: CareEngagementId): ProfessionalCareEngagement | undefined {
    const e = this.engagements.get(id);
    return e ? { ...e } : undefined;
  }

  public getEngagementByBookingId(bookingId: BookingId): ProfessionalCareEngagement | undefined {
    for (const e of this.engagements.values()) {
      if (e.bookingId === bookingId) return { ...e };
    }
    return undefined;
  }

  public listEngagements(): ProfessionalCareEngagement[] {
    return Array.from(this.engagements.values()).map((e) => ({ ...e }));
  }

  // Snapshots
  public saveSnapshot(snapshot: CareInstructionSnapshot): void {
    this.snapshots.set(snapshot.snapshotId, { ...snapshot });
  }

  public getSnapshot(id: CareInstructionSnapshotId): CareInstructionSnapshot | undefined {
    const s = this.snapshots.get(id);
    return s ? { ...s } : undefined;
  }

  public getSnapshotForEngagement(engagementId: CareEngagementId): CareInstructionSnapshot | undefined {
    for (const s of this.snapshots.values()) {
      if (s.engagementId === engagementId) return { ...s };
    }
    return undefined;
  }

  // Grants
  public saveGrant(grant: CareAccessGrant): void {
    this.accessGrants.set(grant.grantId, { ...grant });
  }

  public getGrant(id: CareAccessGrantId): CareAccessGrant | undefined {
    const g = this.accessGrants.get(id);
    return g ? { ...g } : undefined;
  }

  // Secrets
  public saveSecret(secret: CareAccessSecret): void {
    this.accessSecrets.set(secret.secretId, { ...secret });
  }

  public getSecret(id: CareAccessSecretId): CareAccessSecret | undefined {
    const s = this.accessSecrets.get(id);
    return s ? { ...s } : undefined;
  }

  public getSecretByEngagementId(engagementId: CareEngagementId): CareAccessSecret | undefined {
    for (const s of this.accessSecrets.values()) {
      if (s.engagementId === engagementId) return { ...s };
    }
    return undefined;
  }

  // Handovers
  public saveHandover(handover: CareHandover): void {
    this.handovers.set(handover.handoverId, { ...handover });
  }

  public getHandover(id: CareHandoverId): CareHandover | undefined {
    const h = this.handovers.get(id);
    return h ? { ...h } : undefined;
  }

  public listHandoversForEngagement(engagementId: CareEngagementId): CareHandover[] {
    return Array.from(this.handovers.values())
      .filter((h) => h.engagementId === engagementId)
      .map((h) => ({ ...h }));
  }

  // Observations
  public saveObservation(observation: CareServiceObservation): void {
    this.observations.set(observation.observationId, { ...observation });
  }

  public listObservationsForEngagement(engagementId: CareEngagementId): CareServiceObservation[] {
    return Array.from(this.observations.values())
      .filter((o) => o.engagementId === engagementId)
      .map((o) => ({ ...o }));
  }

  // Incidents
  public saveIncident(incident: CareServiceIncident): void {
    this.incidents.set(incident.incidentId, { ...incident });
  }

  public getIncident(id: CareServiceIncidentId): CareServiceIncident | undefined {
    const inc = this.incidents.get(id);
    return inc ? { ...inc } : undefined;
  }

  public listIncidentsForEngagement(engagementId: CareEngagementId): CareServiceIncident[] {
    return Array.from(this.incidents.values())
      .filter((i) => i.engagementId === engagementId)
      .map((i) => ({ ...i }));
  }

  public listAllIncidents(): CareServiceIncident[] {
    return Array.from(this.incidents.values()).map((i) => ({ ...i }));
  }

  // Grooming Sessions
  public saveGroomingSession(session: GroomingSession): void {
    this.groomingSessions.set(session.sessionId, { ...session });
  }

  public getGroomingSession(id: GroomingSessionId): GroomingSession | undefined {
    const g = this.groomingSessions.get(id);
    return g ? { ...g } : undefined;
  }

  public getGroomingSessionByEngagementId(engagementId: CareEngagementId): GroomingSession | undefined {
    for (const g of this.groomingSessions.values()) {
      if (g.engagementId === engagementId) return { ...g };
    }
    return undefined;
  }

  // Sitter Visits
  public saveSitterVisit(visit: SitterVisit): void {
    this.sitterVisits.set(visit.visitId, { ...visit });
  }

  public getSitterVisit(id: SitterVisitId): SitterVisit | undefined {
    const v = this.sitterVisits.get(id);
    return v ? { ...v } : undefined;
  }

  public listSitterVisitsForEngagement(engagementId: CareEngagementId): SitterVisit[] {
    return Array.from(this.sitterVisits.values())
      .filter((v) => v.engagementId === engagementId)
      .sort((a, b) => a.visitNumber - b.visitNumber)
      .map((v) => ({ ...v }));
  }

  // Boarding Units
  public saveBoardingUnit(unit: BoardingUnit): void {
    this.boardingUnits.set(unit.unitId, { ...unit });
  }

  public getBoardingUnit(id: BoardingUnitId): BoardingUnit | undefined {
    const u = this.boardingUnits.get(id);
    return u ? { ...u } : undefined;
  }

  public listBoardingUnits(facilityId?: BusinessId): BoardingUnit[] {
    const units = Array.from(this.boardingUnits.values());
    if (facilityId) return units.filter((u) => u.facilityId === facilityId);
    return units.map((u) => ({ ...u }));
  }

  // Boarding Stays
  public saveBoardingStay(stay: BoardingStay): void {
    this.boardingStays.set(stay.stayId, { ...stay });
  }

  public getBoardingStay(id: BoardingStayId): BoardingStay | undefined {
    const s = this.boardingStays.get(id);
    return s ? { ...s } : undefined;
  }

  public getBoardingStayByEngagementId(engagementId: CareEngagementId): BoardingStay | undefined {
    for (const s of this.boardingStays.values()) {
      if (s.engagementId === engagementId) return { ...s };
    }
    return undefined;
  }

  public listBoardingStays(facilityId?: BusinessId): BoardingStay[] {
    const stays = Array.from(this.boardingStays.values());
    if (facilityId) return stays.filter((s) => s.facilityId === facilityId);
    return stays.map((s) => ({ ...s }));
  }

  // Shift Handovers
  public saveShiftHandover(handover: CareShiftHandover): void {
    this.shiftHandovers.set(handover.shiftHandoverId, { ...handover });
  }

  public getShiftHandover(id: CareShiftHandoverId): CareShiftHandover | undefined {
    const s = this.shiftHandovers.get(id);
    return s ? { ...s } : undefined;
  }

  public listShiftHandovers(facilityId: BusinessId): CareShiftHandover[] {
    return Array.from(this.shiftHandovers.values())
      .filter((s) => s.facilityId === facilityId)
      .map((s) => ({ ...s }));
  }

  // Completion Evidence
  public saveCompletionEvidence(evidence: CareCompletionEvidence): void {
    this.completionEvidences.set(evidence.evidenceId, { ...evidence });
  }

  public getCompletionEvidence(id: CareCompletionEvidenceId): CareCompletionEvidence | undefined {
    const ev = this.completionEvidences.get(id);
    return ev ? { ...ev } : undefined;
  }
}
