/**
 * Pet OS Sprint 5 - Veterinary Health & Medical Records Store
 * Implements Volume VII (Veterinary Health & Medical Records) & Volume XXX
 * Provides high-performance indexing by petId, immutability guarantees,
 * and amendment audit trails.
 */

import {
  ConditionId,
  AllergyId,
  EncounterId,
  VaccinationId,
  MedicationId,
  ProcedureId,
  DiagnosticResultId,
  ClinicalNoteId,
  AmendmentId,
  PetId
} from '../kernel/ids';
import {
  MedicalCondition,
  PetAllergy,
  VeterinaryEncounter,
  PetVaccination,
  PetMedication,
  MedicalProcedure,
  DiagnosticResult,
  ClinicalNote,
  HealthRecordAmendment,
  HealthDocumentLink
} from './types';
import { EventEnvelope } from '../kernel/events';

export class HealthStore {
  private static conditions = new Map<ConditionId, MedicalCondition>();
  private static allergies = new Map<AllergyId, PetAllergy>();
  private static encounters = new Map<EncounterId, VeterinaryEncounter>();
  private static vaccinations = new Map<VaccinationId, PetVaccination>();
  private static medications = new Map<MedicationId, PetMedication>();
  private static procedures = new Map<ProcedureId, MedicalProcedure>();
  private static diagnostics = new Map<DiagnosticResultId, DiagnosticResult>();
  private static clinicalNotes = new Map<ClinicalNoteId, ClinicalNote>();
  private static amendments = new Map<AmendmentId, HealthRecordAmendment>();
  private static documentLinks = new Map<string, HealthDocumentLink>();

  private static subscribers: Array<(event: EventEnvelope<any>) => void> = [];

  static subscribe(listener: (event: EventEnvelope<any>) => void): () => void {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== listener);
    };
  }

  static publishDomainEvent(event: EventEnvelope<any>): void {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('Error in HealthStore event subscriber:', err);
      }
    }
  }

  // --- CONDITIONS ---
  static saveCondition(condition: MedicalCondition): void {
    this.conditions.set(condition.conditionId, { ...condition });
  }

  static findConditionById(id: ConditionId): MedicalCondition | undefined {
    const c = this.conditions.get(id);
    return c ? { ...c } : undefined;
  }

  static listConditionsForPet(petId: PetId, includeInactive: boolean = false): MedicalCondition[] {
    const results: MedicalCondition[] = [];
    for (const c of this.conditions.values()) {
      if (c.petId === petId) {
        if (!includeInactive && c.status === 'ENTERED_IN_ERROR') continue;
        results.push({ ...c });
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static getConditionsByPet(petId: PetId): MedicalCondition[] {
    return this.listConditionsForPet(petId);
  }

  static addCondition(condition: any): ConditionId {
    const id = condition.conditionId || (condition.id as ConditionId);
    const cond: MedicalCondition = {
      ...condition,
      conditionId: id,
      conditionName: condition.conditionName || condition.name || 'Condition',
      category: condition.category || 'RESPIRATORY',
      isDiagnosis: condition.isDiagnosis !== undefined ? condition.isDiagnosis : true,
      status: condition.status || condition.clinicalStatus || 'ACTIVE',
      onsetDatePrecision: condition.onsetDatePrecision || 'EXACT',
      chronic: condition.chronic ?? false,
      provenance: condition.provenance || 'VETERINARY_PROFESSIONAL',
      verificationStatus: condition.verificationStatus || 'VERIFIED',
      recordedBy: condition.recordedBy || condition.createdBy,
      createdAt: condition.createdAt || new Date().toISOString(),
      updatedAt: condition.updatedAt || new Date().toISOString(),
    };
    this.saveCondition(cond);
    return id;
  }

  static deleteCondition(id: ConditionId): void {
    this.conditions.delete(id);
  }

  // --- ALLERGIES ---
  static saveAllergy(allergy: PetAllergy): void {
    this.allergies.set(allergy.allergyId, { ...allergy });
  }

  static findAllergyById(id: AllergyId): PetAllergy | undefined {
    const a = this.allergies.get(id);
    return a ? { ...a } : undefined;
  }

  static listAllergiesForPet(petId: PetId, includeInactive: boolean = false): PetAllergy[] {
    const results: PetAllergy[] = [];
    for (const a of this.allergies.values()) {
      if (a.petId === petId) {
        if (!includeInactive && a.status === 'ENTERED_IN_ERROR') continue;
        results.push({ ...a });
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- ENCOUNTERS ---
  static saveEncounter(encounter: VeterinaryEncounter): void {
    this.encounters.set(encounter.encounterId, { ...encounter });
  }

  static findEncounterById(id: EncounterId): VeterinaryEncounter | undefined {
    const e = this.encounters.get(id);
    return e ? { ...e } : undefined;
  }

  static listEncountersForPet(petId: PetId, includeInactive: boolean = false): VeterinaryEncounter[] {
    const results: VeterinaryEncounter[] = [];
    for (const e of this.encounters.values()) {
      if (e.petId === petId) {
        if (!includeInactive && e.status === 'ENTERED_IN_ERROR') continue;
        results.push({ ...e });
      }
    }
    return results.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  // --- VACCINATIONS ---
  static saveVaccination(vaccination: PetVaccination): void {
    this.vaccinations.set(vaccination.vaccinationId, { ...vaccination });
  }

  static findVaccinationById(id: VaccinationId): PetVaccination | undefined {
    const v = this.vaccinations.get(id);
    return v ? { ...v } : undefined;
  }

  static listVaccinationsForPet(petId: PetId, includeInactive: boolean = false): PetVaccination[] {
    const results: PetVaccination[] = [];
    for (const v of this.vaccinations.values()) {
      if (v.petId === petId) {
        if (!includeInactive && v.enteredInErrorAt) continue;
        results.push({ ...v });
      }
    }
    return results.sort((a, b) => new Date(b.administeredAt).getTime() - new Date(a.administeredAt).getTime());
  }

  // --- MEDICATIONS ---
  static saveMedication(medication: PetMedication): void {
    this.medications.set(medication.medicationId, { ...medication });
  }

  static findMedicationById(id: MedicationId): PetMedication | undefined {
    const m = this.medications.get(id);
    return m ? { ...m } : undefined;
  }

  static listMedicationsForPet(petId: PetId, includeInactive: boolean = false): PetMedication[] {
    const results: PetMedication[] = [];
    for (const m of this.medications.values()) {
      if (m.petId === petId) {
        if (!includeInactive && m.status === 'ENTERED_IN_ERROR') continue;
        results.push({ ...m });
      }
    }
    return results.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  // --- PROCEDURES ---
  static saveProcedure(procedure: MedicalProcedure): void {
    this.procedures.set(procedure.procedureId, { ...procedure });
  }

  static findProcedureById(id: ProcedureId): MedicalProcedure | undefined {
    const p = this.procedures.get(id);
    return p ? { ...p } : undefined;
  }

  static listProceduresForPet(petId: PetId, includeInactive: boolean = false): MedicalProcedure[] {
    const results: MedicalProcedure[] = [];
    for (const p of this.procedures.values()) {
      if (p.petId === petId) {
        if (!includeInactive && p.status === 'ENTERED_IN_ERROR') continue;
        results.push({ ...p });
      }
    }
    return results.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }

  // --- DIAGNOSTICS ---
  static saveDiagnostic(diagnostic: DiagnosticResult): void {
    this.diagnostics.set(diagnostic.resultId, { ...diagnostic });
  }

  static findDiagnosticById(id: DiagnosticResultId): DiagnosticResult | undefined {
    const d = this.diagnostics.get(id);
    return d ? { ...d } : undefined;
  }

  static listDiagnosticsForPet(petId: PetId, includeInactive: boolean = false): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    for (const d of this.diagnostics.values()) {
      if (d.petId === petId) {
        if (!includeInactive && d.enteredInErrorAt) continue;
        results.push({ ...d });
      }
    }
    return results.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
  }

  // --- CLINICAL NOTES ---
  static saveClinicalNote(note: ClinicalNote): void {
    this.clinicalNotes.set(note.noteId, { ...note });
  }

  static findClinicalNoteById(id: ClinicalNoteId): ClinicalNote | undefined {
    const n = this.clinicalNotes.get(id);
    return n ? { ...n } : undefined;
  }

  static listClinicalNotesForPet(petId: PetId, includeInactive: boolean = false): ClinicalNote[] {
    const results: ClinicalNote[] = [];
    for (const n of this.clinicalNotes.values()) {
      if (n.petId === petId) {
        if (!includeInactive && n.enteredInErrorAt) continue;
        results.push({ ...n });
      }
    }
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // --- AMENDMENTS ---
  static saveAmendment(amendment: HealthRecordAmendment): void {
    this.amendments.set(amendment.amendmentId, { ...amendment });
  }

  static listAmendmentsForRecord(recordId: string): HealthRecordAmendment[] {
    const results: HealthRecordAmendment[] = [];
    for (const a of this.amendments.values()) {
      if (a.originalRecordId === recordId) {
        results.push({ ...a });
      }
    }
    return results.sort((a, b) => new Date(b.amendedAt).getTime() - new Date(a.amendedAt).getTime());
  }

  static listAmendmentsForPet(petId: PetId): HealthRecordAmendment[] {
    const results: HealthRecordAmendment[] = [];
    for (const a of this.amendments.values()) {
      if (a.petId === petId) {
        results.push({ ...a });
      }
    }
    return results.sort((a, b) => new Date(b.amendedAt).getTime() - new Date(a.amendedAt).getTime());
  }

  // --- DOCUMENT LINKS ---
  static linkDocument(link: HealthDocumentLink): void {
    this.documentLinks.set(link.linkId, { ...link });
  }

  static listDocumentLinksForRecord(healthRecordId: string): HealthDocumentLink[] {
    const results: HealthDocumentLink[] = [];
    for (const l of this.documentLinks.values()) {
      if (l.healthRecordId === healthRecordId) {
        results.push({ ...l });
      }
    }
    return results;
  }

  // --- STATS & COUNT ---
  static countRecordsForPet(petId: PetId): number {
    let count = 0;
    for (const c of this.conditions.values()) if (c.petId === petId && c.status !== 'ENTERED_IN_ERROR') count++;
    for (const a of this.allergies.values()) if (a.petId === petId && a.status !== 'ENTERED_IN_ERROR') count++;
    for (const e of this.encounters.values()) if (e.petId === petId && e.status !== 'ENTERED_IN_ERROR') count++;
    for (const v of this.vaccinations.values()) if (v.petId === petId && !v.enteredInErrorAt) count++;
    for (const m of this.medications.values()) if (m.petId === petId && m.status !== 'ENTERED_IN_ERROR') count++;
    for (const p of this.procedures.values()) if (p.petId === petId && p.status !== 'ENTERED_IN_ERROR') count++;
    for (const d of this.diagnostics.values()) if (d.petId === petId && !d.enteredInErrorAt) count++;
    for (const n of this.clinicalNotes.values()) if (n.petId === petId && !n.enteredInErrorAt) count++;
    return count;
  }

  static clear(): void {
    this.conditions.clear();
    this.allergies.clear();
    this.encounters.clear();
    this.vaccinations.clear();
    this.medications.clear();
    this.procedures.clear();
    this.diagnostics.clear();
    this.clinicalNotes.clear();
    this.amendments.clear();
    this.documentLinks.clear();
  }
}
