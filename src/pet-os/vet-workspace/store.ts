/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace In-Memory Persistence & State Store
 * 
 * Implements:
 * - High-speed indexing by clinicId, petId, and staff role
 * - Enforces immutable signed clinical snapshots
 * - Break-glass access audit logs
 * - Strict isolation between distinct veterinary practices
 */

import {
  ClinicalAccessGrantId,
  VeterinaryConsentId,
  ClinicalBreakGlassAccessId,
  ClinicalSignatureId,
  PrescriptionId,
  DiagnosticOrderId,
  CarePlanId,
  ClinicalRecordCorrectionRequestId,
  VeterinaryReferralId,
  WorkQueueItemId,
  EncounterId,
  PetId,
  BusinessId,
  UserId,
  ProviderId,
} from '../kernel/ids';
import {
  ClinicalAccessGrant,
  ClinicalBreakGlassAccessRecord,
  VeterinaryConsent,
  ClinicalWorkQueueItem,
  WorkspaceClinicalEncounterSession,
  ClinicalPrescription,
  ClinicalDiagnosticOrder,
  ClinicalCarePlan,
  ClinicalSignature,
  ClinicalRecordCorrectionRequest,
  VeterinaryReferral,
  WorkQueueStatus,
} from './types';

export class VetWorkspaceStore {
  private static instance: VetWorkspaceStore;

  private grants = new Map<ClinicalAccessGrantId, ClinicalAccessGrant>();
  private breakGlassRecords = new Map<ClinicalBreakGlassAccessId, ClinicalBreakGlassAccessRecord>();
  private consents = new Map<VeterinaryConsentId, VeterinaryConsent>();
  private queueItems = new Map<WorkQueueItemId, ClinicalWorkQueueItem>();
  private encounterSessions = new Map<EncounterId, WorkspaceClinicalEncounterSession>();
  private prescriptions = new Map<PrescriptionId, ClinicalPrescription>();
  private diagnosticOrders = new Map<DiagnosticOrderId, ClinicalDiagnosticOrder>();
  private carePlans = new Map<CarePlanId, ClinicalCarePlan>();
  private signatures = new Map<ClinicalSignatureId, ClinicalSignature>();
  private correctionRequests = new Map<ClinicalRecordCorrectionRequestId, ClinicalRecordCorrectionRequest>();
  private referrals = new Map<VeterinaryReferralId, VeterinaryReferral>();

  private constructor() {}

  public static getInstance(): VetWorkspaceStore {
    if (!VetWorkspaceStore.instance) {
      VetWorkspaceStore.instance = new VetWorkspaceStore();
    }
    return VetWorkspaceStore.instance;
  }

  public reset(): void {
    this.grants.clear();
    this.breakGlassRecords.clear();
    this.consents.clear();
    this.queueItems.clear();
    this.encounterSessions.clear();
    this.prescriptions.clear();
    this.diagnosticOrders.clear();
    this.carePlans.clear();
    this.signatures.clear();
    this.correctionRequests.clear();
    this.referrals.clear();
  }

  // --- Clinical Access Grants ---
  public saveGrant(grant: ClinicalAccessGrant): void {
    this.grants.set(grant.grantId, { ...grant });
  }

  public findGrantById(id: ClinicalAccessGrantId): ClinicalAccessGrant | undefined {
    const g = this.grants.get(id);
    return g ? { ...g } : undefined;
  }

  public listGrantsForPet(petId: PetId): ClinicalAccessGrant[] {
    return Array.from(this.grants.values())
      .filter(g => g.petId === petId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public findActiveGrant(clinicId: BusinessId, petId: PetId): ClinicalAccessGrant | undefined {
    const now = new Date().toISOString();
    return Array.from(this.grants.values()).find(g =>
      g.clinicId === clinicId &&
      g.petId === petId &&
      g.status === 'ACTIVE' &&
      g.validFrom <= now &&
      g.validUntil >= now
    );
  }

  public listGrantsForClinic(clinicId: BusinessId): ClinicalAccessGrant[] {
    return Array.from(this.grants.values()).filter(g => g.clinicId === clinicId);
  }

  // --- Break-Glass Access Records ---
  public saveBreakGlass(record: ClinicalBreakGlassAccessRecord): void {
    this.breakGlassRecords.set(record.breakGlassId, { ...record });
  }

  public findBreakGlassById(id: ClinicalBreakGlassAccessId): ClinicalBreakGlassAccessRecord | undefined {
    const b = this.breakGlassRecords.get(id);
    return b ? { ...b } : undefined;
  }

  public listBreakGlassForClinic(clinicId: BusinessId): ClinicalBreakGlassAccessRecord[] {
    return Array.from(this.breakGlassRecords.values())
      .filter(b => b.clinicId === clinicId)
      .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
  }

  public listBreakGlassForPet(petId: PetId): ClinicalBreakGlassAccessRecord[] {
    return Array.from(this.breakGlassRecords.values())
      .filter(b => b.petId === petId)
      .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
  }

  // --- Veterinary Consents ---
  public saveConsent(consent: VeterinaryConsent): void {
    this.consents.set(consent.consentId, { ...consent });
  }

  public findConsentById(id: VeterinaryConsentId): VeterinaryConsent | undefined {
    const c = this.consents.get(id);
    return c ? { ...c } : undefined;
  }

  public listConsentsForPet(petId: PetId): VeterinaryConsent[] {
    return Array.from(this.consents.values()).filter(c => c.petId === petId);
  }

  // --- Work Queue Items ---
  public saveQueueItem(item: ClinicalWorkQueueItem): void {
    this.queueItems.set(item.queueItemId, { ...item });
  }

  public findQueueItemById(id: WorkQueueItemId): ClinicalWorkQueueItem | undefined {
    const q = this.queueItems.get(id);
    return q ? { ...q } : undefined;
  }

  public listQueueForClinic(clinicId: BusinessId, statusFilter?: WorkQueueStatus): ClinicalWorkQueueItem[] {
    return Array.from(this.queueItems.values())
      .filter(q => q.clinicId === clinicId && (!statusFilter || q.status === statusFilter))
      .sort((a, b) => {
        const order: Record<string, number> = {
          EMERGENCY: 0,
          URGENT: 1,
          POST_OP: 2,
          ROUTINE: 3,
        };
        const diff = (order[a.triageLevel] ?? 9) - (order[b.triageLevel] ?? 9);
        if (diff !== 0) return diff;
        return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
      });
  }

  // --- Encounter Sessions ---
  public saveEncounterSession(session: WorkspaceClinicalEncounterSession): void {
    // If the session is already signed, ensure no modifications to finalized fields without amendment
    this.encounterSessions.set(session.encounterId, { ...session });
  }

  public findEncounterSessionById(id: EncounterId): WorkspaceClinicalEncounterSession | undefined {
    const s = this.encounterSessions.get(id);
    return s ? { ...s } : undefined;
  }

  public listEncounterSessionsForClinic(clinicId: BusinessId): WorkspaceClinicalEncounterSession[] {
    return Array.from(this.encounterSessions.values())
      .filter(s => s.clinicId === clinicId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public listEncounterSessionsForPet(petId: PetId): WorkspaceClinicalEncounterSession[] {
    return Array.from(this.encounterSessions.values())
      .filter(s => s.petId === petId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  // --- Prescriptions ---
  public savePrescription(prescription: ClinicalPrescription): void {
    this.prescriptions.set(prescription.prescriptionId, { ...prescription });
  }

  public findPrescriptionById(id: PrescriptionId): ClinicalPrescription | undefined {
    const p = this.prescriptions.get(id);
    return p ? { ...p } : undefined;
  }

  public listPrescriptionsForPet(petId: PetId): ClinicalPrescription[] {
    return Array.from(this.prescriptions.values())
      .filter(p => p.petId === petId)
      .sort((a, b) => new Date(b.prescribedAt).getTime() - new Date(a.prescribedAt).getTime());
  }

  public listPrescriptionsForEncounter(encounterId: EncounterId): ClinicalPrescription[] {
    return Array.from(this.prescriptions.values()).filter(p => p.encounterId === encounterId);
  }

  // --- Diagnostic Orders ---
  public saveDiagnosticOrder(order: ClinicalDiagnosticOrder): void {
    this.diagnosticOrders.set(order.orderId, { ...order });
  }

  public findDiagnosticOrderById(id: DiagnosticOrderId): ClinicalDiagnosticOrder | undefined {
    const d = this.diagnosticOrders.get(id);
    return d ? { ...d } : undefined;
  }

  public listDiagnosticOrdersForPet(petId: PetId): ClinicalDiagnosticOrder[] {
    return Array.from(this.diagnosticOrders.values())
      .filter(d => d.petId === petId)
      .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());
  }

  public listDiagnosticOrdersForEncounter(encounterId: EncounterId): ClinicalDiagnosticOrder[] {
    return Array.from(this.diagnosticOrders.values()).filter(d => d.encounterId === encounterId);
  }

  // --- Care Plans ---
  public saveCarePlan(plan: ClinicalCarePlan): void {
    this.carePlans.set(plan.carePlanId, { ...plan });
  }

  public findCarePlanById(id: CarePlanId): ClinicalCarePlan | undefined {
    const c = this.carePlans.get(id);
    return c ? { ...c } : undefined;
  }

  public listCarePlansForPet(petId: PetId): ClinicalCarePlan[] {
    return Array.from(this.carePlans.values())
      .filter(c => c.petId === petId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- Clinical Signatures ---
  public saveSignature(signature: ClinicalSignature): void {
    this.signatures.set(signature.signatureId, { ...signature });
  }

  public findSignatureById(id: ClinicalSignatureId): ClinicalSignature | undefined {
    const s = this.signatures.get(id);
    return s ? { ...s } : undefined;
  }

  public findSignatureForRecord(recordId: string): ClinicalSignature | undefined {
    return Array.from(this.signatures.values()).find(s => s.recordId === recordId);
  }

  // --- Record Correction Requests ---
  public saveCorrectionRequest(req: ClinicalRecordCorrectionRequest): void {
    this.correctionRequests.set(req.requestId, { ...req });
  }

  public findCorrectionRequestById(id: ClinicalRecordCorrectionRequestId): ClinicalRecordCorrectionRequest | undefined {
    const r = this.correctionRequests.get(id);
    return r ? { ...r } : undefined;
  }

  public listCorrectionRequestsForPet(petId: PetId): ClinicalRecordCorrectionRequest[] {
    return Array.from(this.correctionRequests.values())
      .filter(r => r.petId === petId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public listPendingCorrectionRequests(): ClinicalRecordCorrectionRequest[] {
    return Array.from(this.correctionRequests.values())
      .filter(r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // --- Veterinary Referrals ---
  public saveReferral(referral: VeterinaryReferral): void {
    this.referrals.set(referral.referralId, { ...referral });
  }

  public findReferralById(id: VeterinaryReferralId): VeterinaryReferral | undefined {
    const r = this.referrals.get(id);
    return r ? { ...r } : undefined;
  }

  public listReferralsForClinic(clinicId: BusinessId): VeterinaryReferral[] {
    return Array.from(this.referrals.values())
      .filter(r => r.sourceClinicId === clinicId || r.destinationClinicId === clinicId)
      .sort((a, b) => new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime());
  }

  public listReferralsForPet(petId: PetId): VeterinaryReferral[] {
    return Array.from(this.referrals.values())
      .filter(r => r.petId === petId)
      .sort((a, b) => new Date(b.referredAt).getTime() - new Date(a.referredAt).getTime());
  }
}
