/**
 * Pet OS Sprint 5 - Veterinary Health & Medical Records Service
 * Implements:
 * - Volume VII (Veterinary Health & Medical Records)
 * - Volume XXIV & XXV (AI Safety, Clinical Provenance & Non-Diagnostic Principles)
 * - ADR-005 (Clinical Provenance Preserved: Owner Observations vs Professional Diagnoses)
 * - Volume XXVIII & XXX (API Specification & Data Governance)
 *
 * Core Invariants:
 * 1. Owner observations must NEVER silently become professional diagnoses.
 * 2. Provenance and verification status are strictly decoupled and tracked.
 * 3. Append-only immutability: records are NEVER casually hard-deleted.
 * 4. Corrections and supersessions create verifiable audit amendments.
 * 5. Health events project cleanly and idempotently into the Unified Pet Timeline.
 */

import {
  PetId,
  HouseholdId,
  UserId,
  ConditionId,
  AllergyId,
  EncounterId,
  VaccinationId,
  MedicationId,
  ProcedureId,
  DiagnosticResultId,
  ClinicalNoteId,
  AmendmentId,
  generateUUIDv7,
  asConditionId,
  asAllergyId,
  asEncounterId,
  asVaccinationId,
  asMedicationId,
  asProcedureId,
  asDiagnosticResultId,
  asClinicalNoteId,
  asAmendmentId,
  asCorrelationId
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
  PetHealthSummary,
  HealthCareAlert,
  RecordConditionCommand,
  UpdateConditionCommand,
  RecordAllergyCommand,
  RecordEncounterCommand,
  RecordVaccinationCommand,
  RecordMedicationCommand,
  RecordProcedureCommand,
  RecordDiagnosticCommand,
  RecordClinicalNoteCommand,
  AmendClinicalRecordCommand,
  MarkEnteredInErrorCommand,
  ClinicalProvenanceType,
  ClinicalVerificationStatus
} from './types';
import { HealthStore } from './store';
import { HealthEventFactory } from './events';
import { getVaccineByCode } from './vaccines';
import { PetStore } from '../pet-core/store';
import { AuthorizationService } from '../identity/authorization';
import { InMemoryAuditStore } from '../kernel/audit';
import { TimelineService } from '../timeline/service';
import { TimelineProvenanceType } from '../timeline/types';

export class HealthService {
  /**
   * Helper to map clinical provenance to timeline provenance
   */
  private static mapToTimelineProvenance(p: ClinicalProvenanceType): TimelineProvenanceType {
    switch (p) {
      case 'OWNER_ENTERED':
        return 'OWNER_ENTERED';
      case 'VETERINARY_PROFESSIONAL':
      case 'CLINIC_SYSTEM':
        return 'VERIFIED_PROFESSIONAL';
      case 'IMPORTED_RECORD':
        return 'IMPORTED';
      case 'DOCUMENT_DERIVED':
        return 'DOCUMENT_DERIVED';
      case 'SYSTEM_GENERATED':
        return 'SYSTEM_GENERATED';
      default:
        return 'OWNER_ENTERED';
    }
  }

  /**
   * Helper to authorize pet access
   */
  private static verifyPetAuthorization(
    actorId: string,
    petId: PetId,
    permission: any
  ): { pet: ReturnType<typeof PetStore.findPetById>; allowed: boolean } {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      permission
    );

    if (!auth.allowed) {
      throw new Error(auth.message || `Unauthorized for permission ${permission}.`);
    }

    return { pet, allowed: true };
  }

  // ==========================================================================
  // 1. MEDICAL CONDITIONS (Owner Observations vs Professional Diagnoses)
  // ==========================================================================

  static recordCondition(
    actorId: string,
    command: RecordConditionCommand
  ): MedicalCondition {
    const { pet } = this.verifyPetAuthorization(
      actorId,
      command.petId,
      command.isDiagnosis ? 'pet.health.manage_condition' : 'pet.health.create_owner_record'
    );

    // INVARIANT: Owner observations must NEVER be flagged as formal diagnoses
    const provenance: ClinicalProvenanceType =
      command.provenance || (command.isDiagnosis ? 'VETERINARY_PROFESSIONAL' : 'OWNER_ENTERED');
    const verificationStatus: ClinicalVerificationStatus =
      command.isDiagnosis && provenance === 'VETERINARY_PROFESSIONAL'
        ? 'VERIFIED'
        : 'UNVERIFIED';

    const conditionId = asConditionId(generateUUIDv7());
    const now = new Date().toISOString();

    const condition: MedicalCondition = {
      conditionId,
      petId: command.petId,
      isDiagnosis: command.isDiagnosis,
      conditionCode: command.conditionCode,
      conditionName: command.conditionName.trim(),
      category: command.category,
      description: command.description,
      onsetDate: command.onsetDate || now,
      onsetDatePrecision: command.onsetDatePrecision || 'EXACT',
      diagnosedAt: command.diagnosedAt,
      status: command.isDiagnosis ? 'ACTIVE' : 'SUSPECTED',
      severity: command.severity,
      chronic: !!command.chronic,
      provenance,
      verificationStatus,
      recordedBy: actorId as UserId,
      veterinaryProviderId: command.veterinaryProviderId,
      veterinaryClinicId: command.veterinaryClinicId,
      externalProviderName: command.externalProviderName,
      encounterId: command.encounterId,
      notes: command.notes,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveCondition(condition);

    // Audit log
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_CONDITION_RECORDED',
      resourceType: 'health_record',
      resourceId: conditionId,
      classification: 'CONFIDENTIAL',
      reasonCode: command.isDiagnosis ? 'DIAGNOSIS_LOGGED' : 'OBSERVATION_LOGGED',
      metadata: {
        petId: command.petId,
        conditionName: condition.conditionName,
        isDiagnosis: condition.isDiagnosis,
        provenance: condition.provenance
      }
    });

    // Domain event
    const eventEnvelope = HealthEventFactory.conditionRecorded(condition);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    // Project to Unified Timeline
    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: condition.isDiagnosis ? 'health.diagnosis.recorded' : 'health.observation.recorded',
      eventCategory: 'HEALTH',
      occurredAt: condition.onsetDate || now,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'medical_condition',
      sourceEntityId: conditionId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: condition.isDiagnosis
        ? `Clinical Diagnosis: ${condition.conditionName}`
        : `Observed Symptom / Condition: ${condition.conditionName}`,
      summary: condition.description || `${condition.isDiagnosis ? 'Diagnosed' : 'Reported'} under category ${condition.category}. Status: ${condition.status}.`,
      structuredPayload: {
        conditionId,
        isDiagnosis: condition.isDiagnosis,
        category: condition.category,
        chronic: condition.chronic,
        status: condition.status
      },
      deduplicationKey: `VETERINARY_HEALTH:condition:${conditionId}:recorded`
    });

    return condition;
  }

  static updateCondition(
    actorId: string,
    petId: PetId,
    command: UpdateConditionCommand
  ): MedicalCondition {
    const { pet } = this.verifyPetAuthorization(actorId, petId, 'pet.health.manage_condition');

    const existing = HealthStore.findConditionById(command.conditionId);
    if (!existing || existing.petId !== petId) {
      throw new Error(`Condition ${command.conditionId} not found for this pet.`);
    }

    const now = new Date().toISOString();
    const updated: MedicalCondition = {
      ...existing,
      conditionName: command.conditionName !== undefined ? command.conditionName.trim() : existing.conditionName,
      category: command.category !== undefined ? command.category : existing.category,
      description: command.description !== undefined ? command.description : existing.description,
      status: command.status !== undefined ? command.status : existing.status,
      resolvedAt: command.resolvedAt !== undefined ? command.resolvedAt : existing.resolvedAt,
      severity: command.severity !== undefined ? command.severity : existing.severity,
      chronic: command.chronic !== undefined ? command.chronic : existing.chronic,
      notes: command.notes !== undefined ? command.notes : existing.notes,
      updatedAt: now
    };

    HealthStore.saveCondition(updated);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_CONDITION_UPDATED',
      resourceType: 'health_record',
      resourceId: updated.conditionId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'CONDITION_STATUS_CHANGE',
      metadata: {
        petId,
        newStatus: updated.status,
        resolvedAt: updated.resolvedAt
      }
    });

    // Domain event
    const eventEnvelope = HealthEventFactory.conditionUpdated(updated, actorId);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    // If resolved, project resolution to timeline
    if (command.status === 'RESOLVED') {
      TimelineService.recordEvent({
        petId,
        householdId: pet.householdId,
        eventType: 'health.condition.resolved',
        eventCategory: 'HEALTH',
        occurredAt: updated.resolvedAt || now,
        sourceDomain: 'VETERINARY_HEALTH',
        sourceEntityType: 'medical_condition',
        sourceEntityId: updated.conditionId,
        sourceActorType: 'USER',
        sourceActorId: actorId,
        provenanceType: this.mapToTimelineProvenance(updated.provenance),
        title: `Condition Resolved: ${updated.conditionName}`,
        summary: `Marked as resolved on ${updated.resolvedAt || now}.`,
        deduplicationKey: `VETERINARY_HEALTH:condition:${updated.conditionId}:resolved`
      });
    }

    return updated;
  }

  // ==========================================================================
  // 2. ALLERGIES & SENSITIVITIES
  // ==========================================================================

  static recordAllergy(
    actorId: string,
    command: RecordAllergyCommand
  ): PetAllergy {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_allergy');

    const allergyId = asAllergyId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'OWNER_ENTERED';

    const allergy: PetAllergy = {
      allergyId,
      petId: command.petId,
      allergen: command.allergen.trim(),
      allergenCategory: command.allergenCategory,
      allergyType: command.allergyType || 'ALLERGY',
      reaction: command.reaction.trim(),
      severity: command.severity,
      firstObservedAt: command.firstObservedAt || now,
      firstObservedPrecision: command.firstObservedPrecision || 'EXACT',
      status: 'ACTIVE',
      provenance,
      verificationStatus: provenance === 'VETERINARY_PROFESSIONAL' ? 'VERIFIED' : 'UNVERIFIED',
      clinicalNotes: command.clinicalNotes,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveAllergy(allergy);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_ALLERGY_RECORDED',
      resourceType: 'health_record',
      resourceId: allergyId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'ALLERGY_DECLARED',
      metadata: {
        petId: command.petId,
        allergen: allergy.allergen,
        severity: allergy.severity
      }
    });

    const eventEnvelope = HealthEventFactory.allergyRecorded(allergy);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.allergy.recorded',
      eventCategory: 'HEALTH',
      occurredAt: allergy.firstObservedAt || now,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'pet_allergy',
      sourceEntityId: allergyId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Allergy Recorded: ${allergy.allergen} (${allergy.severity})`,
      summary: `Reaction: ${allergy.reaction}. Classified as ${allergy.allergyType}.`,
      structuredPayload: {
        allergen: allergy.allergen,
        category: allergy.allergenCategory,
        severity: allergy.severity
      },
      deduplicationKey: `VETERINARY_HEALTH:allergy:${allergyId}:recorded`
    });

    return allergy;
  }

  // ==========================================================================
  // 3. VETERINARY ENCOUNTERS & VISITS
  // ==========================================================================

  static recordEncounter(
    actorId: string,
    command: RecordEncounterCommand
  ): VeterinaryEncounter {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_encounter');

    const encounterId = asEncounterId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'VETERINARY_PROFESSIONAL';

    const encounter: VeterinaryEncounter = {
      encounterId,
      petId: command.petId,
      providerId: command.providerId,
      clinicId: command.clinicId,
      externalClinicName: command.externalClinicName,
      externalProviderName: command.externalProviderName,
      encounterType: command.encounterType,
      occurredAt: command.occurredAt,
      occurredAtPrecision: command.occurredAtPrecision || 'EXACT',
      reason: command.reason.trim(),
      chiefComplaint: command.chiefComplaint,
      outcome: command.outcome,
      followUpRequired: !!command.followUpRequired,
      followUpDate: command.followUpDate,
      status: 'COMPLETED',
      provenance,
      recordedBy: actorId as UserId,
      verificationStatus: provenance === 'VETERINARY_PROFESSIONAL' ? 'VERIFIED' : 'UNVERIFIED',
      linkedDocumentIds: command.linkedDocumentIds || [],
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveEncounter(encounter);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_ENCOUNTER_RECORDED',
      resourceType: 'health_record',
      resourceId: encounterId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'ENCOUNTER_LOGGED',
      metadata: {
        petId: command.petId,
        encounterType: encounter.encounterType,
        clinic: encounter.externalClinicName || 'Clinic'
      }
    });

    const eventEnvelope = HealthEventFactory.encounterRecorded(encounter);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    const clinicLabel = encounter.externalClinicName || encounter.externalProviderName || 'Veterinary Clinic';
    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.encounter.completed',
      eventCategory: 'HEALTH',
      occurredAt: encounter.occurredAt,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'veterinary_encounter',
      sourceEntityId: encounterId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Vet Visit: ${(encounter.encounterType || 'VISIT').replace(/_/g, ' ')} (${clinicLabel})`,
      summary: `Reason: ${encounter.reason}. ${encounter.outcome ? `Outcome: ${encounter.outcome}` : ''}`,
      structuredPayload: {
        encounterId,
        encounterType: encounter.encounterType,
        clinic: clinicLabel,
        followUpRequired: encounter.followUpRequired,
        followUpDate: encounter.followUpDate
      },
      deduplicationKey: `VETERINARY_HEALTH:encounter:${encounterId}:recorded`
    });

    return encounter;
  }

  // ==========================================================================
  // 4. VACCINATIONS & IMMUNIZATION PROVENANCE
  // ==========================================================================

  static recordVaccination(
    actorId: string,
    command: RecordVaccinationCommand
  ): PetVaccination {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_vaccination');

    const vaccinationId = asVaccinationId(generateUUIDv7());
    const now = new Date().toISOString();
    const catalogItem = getVaccineByCode(command.vaccineCode);

    const vaccineName = command.vaccineName || (catalogItem ? catalogItem.name : command.vaccineCode);
    const vaccineType = catalogItem ? catalogItem.category : 'STANDARD';
    const targetDiseases = catalogItem ? catalogItem.targetDiseases : [vaccineName];

    // Calculate default validUntil if not provided and validity period exists
    let validUntil = command.validUntil;
    if (!validUntil && catalogItem?.standardValidityMonths) {
      const adminDate = new Date(command.administeredAt);
      if (!isNaN(adminDate.getTime())) {
        const exp = new Date(adminDate);
        exp.setMonth(exp.getMonth() + catalogItem.standardValidityMonths);
        validUntil = exp.toISOString().slice(0, 10);
      }
    }

    const provenance: ClinicalProvenanceType = command.provenance || 'VETERINARY_PROFESSIONAL';
    const verificationStatus: ClinicalVerificationStatus =
      provenance === 'VETERINARY_PROFESSIONAL' || command.certificateDocumentId
        ? 'VERIFIED'
        : 'UNVERIFIED';

    const vaccination: PetVaccination = {
      vaccinationId,
      petId: command.petId,
      vaccineCode: command.vaccineCode,
      vaccineName,
      vaccineType,
      targetDiseases,
      administeredAt: command.administeredAt,
      administeredAtPrecision: command.administeredAtPrecision || 'EXACT',
      validFrom: command.validFrom || command.administeredAt,
      validUntil,
      nextDueAt: command.nextDueAt || validUntil,
      dose: command.dose || '1.0 mL',
      batchLotNumber: command.batchLotNumber,
      manufacturer: command.manufacturer,
      veterinaryProviderId: command.veterinaryProviderId,
      veterinaryClinicId: command.veterinaryClinicId,
      externalProviderName: command.externalProviderName,
      externalClinicName: command.externalClinicName,
      certificateDocumentId: command.certificateDocumentId,
      provenance,
      verificationStatus,
      recordedBy: actorId as UserId,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveVaccination(vaccination);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_VACCINATION_RECORDED',
      resourceType: 'health_record',
      resourceId: vaccinationId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'VACCINE_ADMINISTERED',
      metadata: {
        petId: command.petId,
        vaccineName,
        administeredAt: vaccination.administeredAt,
        nextDueAt: vaccination.nextDueAt
      }
    });

    const eventEnvelope = HealthEventFactory.vaccinationRecorded(vaccination);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.vaccination.administered',
      eventCategory: 'PREVENTIVE_CARE',
      occurredAt: vaccination.administeredAt,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'pet_vaccination',
      sourceEntityId: vaccinationId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Vaccination: ${vaccineName}`,
      summary: `Dose ${vaccination.dose}${vaccination.batchLotNumber ? ` (Lot: ${vaccination.batchLotNumber})` : ''}. ${vaccination.nextDueAt ? `Next booster due: ${vaccination.nextDueAt}.` : ''}`,
      structuredPayload: {
        vaccineCode: vaccination.vaccineCode,
        vaccineName,
        administeredAt: vaccination.administeredAt,
        validUntil: vaccination.validUntil,
        nextDueAt: vaccination.nextDueAt,
        batchLotNumber: vaccination.batchLotNumber
      },
      deduplicationKey: `VETERINARY_HEALTH:vaccination:${vaccinationId}:recorded`
    });

    return vaccination;
  }

  // ==========================================================================
  // 5. MEDICATIONS & DOSAGE
  // ==========================================================================

  static recordMedication(
    actorId: string,
    command: RecordMedicationCommand
  ): PetMedication {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_medication');

    const medicationId = asMedicationId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'VETERINARY_PROFESSIONAL';

    const medication: PetMedication = {
      medicationId,
      petId: command.petId,
      medicationName: command.medicationName.trim(),
      genericName: command.genericName,
      medicationType: command.medicationType,
      dosage: command.dosage.trim(),
      dosageUnit: command.dosageUnit.trim(),
      route: command.route,
      frequency: command.frequency.trim(),
      startAt: command.startAt,
      startAtPrecision: command.startAtPrecision || 'EXACT',
      endAt: command.endAt,
      status: 'ACTIVE',
      prescribingProvider: command.prescribingProvider,
      veterinaryClinicId: command.veterinaryClinicId,
      encounterId: command.encounterId,
      instructions: command.instructions.trim(),
      reason: command.reason,
      provenance,
      verificationStatus: provenance === 'VETERINARY_PROFESSIONAL' ? 'VERIFIED' : 'UNVERIFIED',
      recordedBy: actorId as UserId,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveMedication(medication);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_MEDICATION_RECORDED',
      resourceType: 'health_record',
      resourceId: medicationId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'MEDICATION_PRESCRIBED',
      metadata: {
        petId: command.petId,
        medicationName: medication.medicationName,
        dosage: `${medication.dosage} ${medication.dosageUnit}`,
        frequency: medication.frequency
      }
    });

    const eventEnvelope = HealthEventFactory.medicationRecorded(medication);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.medication.started',
      eventCategory: 'MEDICATION',
      occurredAt: medication.startAt,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'pet_medication',
      sourceEntityId: medicationId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Medication Started: ${medication.medicationName}`,
      summary: `${medication.dosage} ${medication.dosageUnit} via ${medication.route}, ${medication.frequency}. Instructions: ${medication.instructions}`,
      structuredPayload: {
        medicationName: medication.medicationName,
        dosage: `${medication.dosage} ${medication.dosageUnit}`,
        frequency: medication.frequency,
        route: medication.route,
        startAt: medication.startAt,
        endAt: medication.endAt
      },
      deduplicationKey: `VETERINARY_HEALTH:medication:${medicationId}:started`
    });

    return medication;
  }

  static stopMedication(
    actorId: string,
    petId: PetId,
    medicationId: MedicationId,
    reason: string
  ): PetMedication {
    const { pet } = this.verifyPetAuthorization(actorId, petId, 'pet.health.manage_medication');

    const med = HealthStore.findMedicationById(medicationId);
    if (!med || med.petId !== petId) {
      throw new Error(`Medication ${medicationId} not found.`);
    }

    const now = new Date().toISOString();
    const updated: PetMedication = {
      ...med,
      status: 'DISCONTINUED',
      discontinuedAt: now,
      discontinuedReason: reason,
      updatedAt: now
    };

    HealthStore.saveMedication(updated);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_MEDICATION_STOPPED',
      resourceType: 'health_record',
      resourceId: medicationId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'MEDICATION_DISCONTINUED',
      metadata: { petId, reason }
    });

    TimelineService.recordEvent({
      petId,
      householdId: pet.householdId,
      eventType: 'health.medication.discontinued',
      eventCategory: 'MEDICATION',
      occurredAt: now,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'pet_medication',
      sourceEntityId: medicationId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(updated.provenance),
      title: `Medication Discontinued: ${updated.medicationName}`,
      summary: `Discontinued: ${reason}`,
      deduplicationKey: `VETERINARY_HEALTH:medication:${medicationId}:discontinued`
    });

    return updated;
  }

  // ==========================================================================
  // 6. PROCEDURES & SURGERIES
  // ==========================================================================

  static recordProcedure(
    actorId: string,
    command: RecordProcedureCommand
  ): MedicalProcedure {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_procedure');

    const procedureId = asProcedureId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'VETERINARY_PROFESSIONAL';

    const procedure: MedicalProcedure = {
      procedureId,
      petId: command.petId,
      procedureType: command.procedureType,
      procedureName: command.procedureName.trim(),
      performedAt: command.performedAt,
      performedAtPrecision: command.performedAtPrecision || 'EXACT',
      status: 'COMPLETED',
      providerName: command.providerName,
      clinicName: command.clinicName,
      reasonIndication: command.reasonIndication,
      outcome: command.outcome,
      complications: command.complications,
      followUpNotes: command.followUpNotes,
      linkedDocumentIds: command.linkedDocumentIds || [],
      provenance,
      verificationStatus: provenance === 'VETERINARY_PROFESSIONAL' ? 'VERIFIED' : 'UNVERIFIED',
      recordedBy: actorId as UserId,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveProcedure(procedure);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_PROCEDURE_RECORDED',
      resourceType: 'health_record',
      resourceId: procedureId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'PROCEDURE_LOGGED',
      metadata: { petId: command.petId, name: procedure.procedureName }
    });

    const eventEnvelope = HealthEventFactory.procedureRecorded(procedure);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.procedure.performed',
      eventCategory: 'HEALTH',
      occurredAt: procedure.performedAt,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'medical_procedure',
      sourceEntityId: procedureId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Procedure: ${procedure.procedureName}`,
      summary: `${(procedure.procedureType || 'PROCEDURE').replace(/_/g, ' ')} performed at ${procedure.clinicName || 'Clinic'}. ${procedure.outcome ? `Outcome: ${procedure.outcome}` : ''}`,
      structuredPayload: {
        procedureId,
        type: procedure.procedureType,
        clinic: procedure.clinicName,
        performedAt: procedure.performedAt
      },
      deduplicationKey: `VETERINARY_HEALTH:procedure:${procedureId}:recorded`
    });

    return procedure;
  }

  // ==========================================================================
  // 7. DIAGNOSTICS & LABORATORY RESULTS
  // ==========================================================================

  static recordDiagnostic(
    actorId: string,
    command: RecordDiagnosticCommand
  ): DiagnosticResult {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_diagnostic');

    const resultId = asDiagnosticResultId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'VETERINARY_PROFESSIONAL';

    const diagnostic: DiagnosticResult = {
      resultId,
      petId: command.petId,
      encounterId: command.encounterId,
      testType: command.testType,
      testName: command.testName.trim(),
      collectedAt: command.collectedAt,
      resultedAt: command.resultedAt || now,
      resultSummary: command.resultSummary.trim(),
      isDocumentOnly: command.isDocumentOnly,
      linkedDocumentId: command.linkedDocumentId,
      structuredResults: command.structuredResults,
      laboratoryName: command.laboratoryName,
      provenance,
      verificationStatus: provenance === 'VETERINARY_PROFESSIONAL' ? 'VERIFIED' : 'UNVERIFIED',
      recordedBy: actorId as UserId,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveDiagnostic(diagnostic);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_DIAGNOSTIC_RECORDED',
      resourceType: 'health_record',
      resourceId: resultId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'LAB_RESULT_LOGGED',
      metadata: { petId: command.petId, testName: diagnostic.testName }
    });

    const eventEnvelope = HealthEventFactory.diagnosticRecorded(diagnostic);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'health.diagnostic.resulted',
      eventCategory: 'HEALTH',
      occurredAt: diagnostic.resultedAt || diagnostic.collectedAt,
      sourceDomain: 'VETERINARY_HEALTH',
      sourceEntityType: 'diagnostic_result',
      sourceEntityId: resultId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: this.mapToTimelineProvenance(provenance),
      title: `Lab Test: ${diagnostic.testName}`,
      summary: `${diagnostic.resultSummary} (${(diagnostic.testType || 'DIAGNOSTIC').replace(/_/g, ' ')})`,
      structuredPayload: {
        resultId,
        testType: diagnostic.testType,
        isDocumentOnly: diagnostic.isDocumentOnly,
        resultsCount: diagnostic.structuredResults ? diagnostic.structuredResults.length : 0
      },
      deduplicationKey: `VETERINARY_HEALTH:diagnostic:${resultId}:recorded`
    });

    return diagnostic;
  }

  // ==========================================================================
  // 8. CLINICAL NOTES
  // ==========================================================================

  static recordClinicalNote(
    actorId: string,
    command: RecordClinicalNoteCommand
  ): ClinicalNote {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.read');

    const noteId = asClinicalNoteId(generateUUIDv7());
    const now = new Date().toISOString();
    const provenance: ClinicalProvenanceType = command.provenance || 'OWNER_ENTERED';

    const note: ClinicalNote = {
      noteId,
      petId: command.petId,
      encounterId: command.encounterId,
      noteType: command.noteType,
      authorUserId: actorId as UserId,
      authorName: command.authorName.trim(),
      authorRole: command.authorRole.trim(),
      isConfidentialProfessionalNote: !!command.isConfidentialProfessionalNote,
      content: command.content.trim(),
      provenance,
      createdAt: now,
      updatedAt: now
    };

    HealthStore.saveClinicalNote(note);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_NOTE_RECORDED',
      resourceType: 'health_record',
      resourceId: noteId,
      classification: note.isConfidentialProfessionalNote ? 'RESTRICTED' : 'CONFIDENTIAL',
      reasonCode: 'CLINICAL_NOTE_LOGGED',
      metadata: { petId: command.petId, noteType: note.noteType }
    });

    const eventEnvelope = HealthEventFactory.clinicalNoteRecorded(note);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    return note;
  }

  // ==========================================================================
  // 9. CORRECTIONS, SUPERSEDING & ENTERED_IN_ERROR IMMUTABILITY
  // ==========================================================================

  static markRecordEnteredInError(
    actorId: string,
    command: MarkEnteredInErrorCommand
  ): HealthRecordAmendment {
    const { pet } = this.verifyPetAuthorization(actorId, command.petId, 'pet.health.manage_condition');

    const now = new Date().toISOString();
    const amendmentId = asAmendmentId(generateUUIDv7());
    let originalSnapshot: Record<string, unknown> = {};

    switch (command.recordType) {
      case 'CONDITION': {
        const c = HealthStore.findConditionById(command.recordId as ConditionId);
        if (!c || c.petId !== command.petId) throw new Error(`Condition ${command.recordId} not found.`);
        originalSnapshot = { ...c };
        c.status = 'ENTERED_IN_ERROR';
        c.enteredInErrorAt = now;
        c.enteredInErrorReason = command.reason;
        c.enteredInErrorBy = actorId as UserId;
        c.updatedAt = now;
        HealthStore.saveCondition(c);
        break;
      }
      case 'ALLERGY': {
        const a = HealthStore.findAllergyById(command.recordId as AllergyId);
        if (!a || a.petId !== command.petId) throw new Error(`Allergy ${command.recordId} not found.`);
        originalSnapshot = { ...a };
        a.status = 'ENTERED_IN_ERROR';
        a.enteredInErrorAt = now;
        a.enteredInErrorReason = command.reason;
        a.enteredInErrorBy = actorId as UserId;
        a.updatedAt = now;
        HealthStore.saveAllergy(a);
        break;
      }
      case 'VACCINATION': {
        const v = HealthStore.findVaccinationById(command.recordId as VaccinationId);
        if (!v || v.petId !== command.petId) throw new Error(`Vaccination ${command.recordId} not found.`);
        originalSnapshot = { ...v };
        v.enteredInErrorAt = now;
        v.enteredInErrorReason = command.reason;
        v.enteredInErrorBy = actorId as UserId;
        v.updatedAt = now;
        HealthStore.saveVaccination(v);
        break;
      }
      case 'MEDICATION': {
        const m = HealthStore.findMedicationById(command.recordId as MedicationId);
        if (!m || m.petId !== command.petId) throw new Error(`Medication ${command.recordId} not found.`);
        originalSnapshot = { ...m };
        m.status = 'ENTERED_IN_ERROR';
        m.enteredInErrorAt = now;
        m.enteredInErrorReason = command.reason;
        m.enteredInErrorBy = actorId as UserId;
        m.updatedAt = now;
        HealthStore.saveMedication(m);
        break;
      }
      case 'ENCOUNTER': {
        const e = HealthStore.findEncounterById(command.recordId as EncounterId);
        if (!e || e.petId !== command.petId) throw new Error(`Encounter ${command.recordId} not found.`);
        originalSnapshot = { ...e };
        e.status = 'ENTERED_IN_ERROR';
        e.enteredInErrorAt = now;
        e.enteredInErrorReason = command.reason;
        e.enteredInErrorBy = actorId as UserId;
        e.updatedAt = now;
        HealthStore.saveEncounter(e);
        break;
      }
      case 'PROCEDURE': {
        const p = HealthStore.findProcedureById(command.recordId as ProcedureId);
        if (!p || p.petId !== command.petId) throw new Error(`Procedure ${command.recordId} not found.`);
        originalSnapshot = { ...p };
        p.status = 'ENTERED_IN_ERROR';
        p.enteredInErrorAt = now;
        p.enteredInErrorReason = command.reason;
        p.enteredInErrorBy = actorId as UserId;
        p.updatedAt = now;
        HealthStore.saveProcedure(p);
        break;
      }
      case 'DIAGNOSTIC': {
        const d = HealthStore.findDiagnosticById(command.recordId as DiagnosticResultId);
        if (!d || d.petId !== command.petId) throw new Error(`Diagnostic ${command.recordId} not found.`);
        originalSnapshot = { ...d };
        d.enteredInErrorAt = now;
        d.enteredInErrorReason = command.reason;
        d.enteredInErrorBy = actorId as UserId;
        d.updatedAt = now;
        HealthStore.saveDiagnostic(d);
        break;
      }
      case 'NOTE': {
        const n = HealthStore.findClinicalNoteById(command.recordId as ClinicalNoteId);
        if (!n || n.petId !== command.petId) throw new Error(`Note ${command.recordId} not found.`);
        originalSnapshot = { ...n };
        n.enteredInErrorAt = now;
        n.enteredInErrorReason = command.reason;
        n.enteredInErrorBy = actorId as UserId;
        n.updatedAt = now;
        HealthStore.saveClinicalNote(n);
        break;
      }
    }

    const amendment: HealthRecordAmendment = {
      amendmentId,
      petId: command.petId,
      recordType: command.recordType,
      originalRecordId: command.recordId,
      amendedBy: actorId as UserId,
      amendedAt: now,
      amendmentReason: command.reason,
      actionType: 'ENTERED_IN_ERROR',
      originalSnapshot
    };

    HealthStore.saveAmendment(amendment);

    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'HEALTH_RECORD_ENTERED_IN_ERROR',
      resourceType: 'health_record',
      resourceId: command.recordId,
      classification: 'RESTRICTED',
      reasonCode: 'CLINICAL_ERROR_RECTIFICATION',
      metadata: {
        petId: command.petId,
        recordType: command.recordType,
        reason: command.reason
      }
    });

    const eventEnvelope = HealthEventFactory.recordAmended(amendment);
    HealthStore.publishDomainEvent(eventEnvelope);
    PetStore.recordOutboxEvent(eventEnvelope);

    return amendment;
  }

  // ==========================================================================
  // 10. COMPOSITE READ MODEL & SUMMARY ASSEMBLY
  // ==========================================================================

  static assembleHealthSummary(
    actorId: string,
    petId: PetId
  ): PetHealthSummary {
    const { pet } = this.verifyPetAuthorization(actorId, petId, 'pet.health.read_summary');

    const conditions = HealthStore.listConditionsForPet(petId, false);
    const allergies = HealthStore.listAllergiesForPet(petId, false);
    const encounters = HealthStore.listEncountersForPet(petId, false);
    const vaccinations = HealthStore.listVaccinationsForPet(petId, false);
    const medications = HealthStore.listMedicationsForPet(petId, false);
    const procedures = HealthStore.listProceduresForPet(petId, false);
    const diagnostics = HealthStore.listDiagnosticsForPet(petId, false);

    // Active conditions
    const activeConditions = conditions
      .filter((c) => c.status === 'ACTIVE' || c.status === 'SUSPECTED')
      .map((c) => ({
        conditionId: c.conditionId,
        name: c.conditionName,
        isDiagnosis: c.isDiagnosis,
        category: c.category,
        onsetDate: c.onsetDate,
        provenance: c.provenance,
        verificationStatus: c.verificationStatus
      }));

    // Active allergies
    const activeAllergies = allergies
      .filter((a) => a.status === 'ACTIVE' || a.status === 'SUSPECTED')
      .map((a) => ({
        allergyId: a.allergyId,
        allergen: a.allergen,
        category: a.allergenCategory,
        severity: a.severity,
        reaction: a.reaction,
        allergyType: a.allergyType
      }));

    // Current medications
    const currentMedications = medications
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        medicationId: m.medicationId,
        name: m.medicationName,
        dosage: m.dosage,
        dosageUnit: m.dosageUnit,
        frequency: m.frequency,
        route: m.route,
        instructions: m.instructions,
        startAt: m.startAt,
        provenance: m.provenance,
        verificationStatus: m.verificationStatus
      }));

    // Vaccinations summary
    const recordedVaccines = vaccinations.map((v) => ({
      vaccinationId: v.vaccinationId,
      vaccineName: v.vaccineName,
      vaccineCode: v.vaccineCode,
      administeredAt: v.administeredAt,
      validUntil: v.validUntil,
      nextDueAt: v.nextDueAt,
      dose: v.dose,
      verificationStatus: v.verificationStatus,
      provenance: v.provenance,
      hasCertificate: !!v.certificateDocumentId,
      certificateDocumentId: v.certificateDocumentId
    }));

    const lastVaccine = vaccinations.length > 0 ? vaccinations[0] : undefined;

    // Last vet visit
    const lastVisit = encounters.length > 0 ? encounters[0] : undefined;

    // Care alerts computation
    const careAlerts: HealthCareAlert[] = [];

    // Check severe allergies
    for (const al of activeAllergies) {
      if (al.severity === 'SEVERE' || al.severity === 'LIFE_THREATENING') {
        careAlerts.push({
          alertId: `alert-allergy-${al.allergyId}`,
          severity: 'HIGH',
          message: `Critical Allergy: ${al.allergen} (${al.reaction}) - ${al.severity}`,
          source: 'Allergies'
        });
      }
    }

    // Check overdue vaccines
    const nowMs = Date.now();
    for (const vac of recordedVaccines) {
      if (vac.validUntil) {
        const expTime = new Date(vac.validUntil).getTime();
        if (expTime < nowMs) {
          careAlerts.push({
            alertId: `alert-vac-overdue-${vac.vaccinationId}`,
            severity: 'MEDIUM',
            message: `Booster Overdue: ${vac.vaccineName} expired on ${vac.validUntil.slice(0, 10)}`,
            source: 'Vaccinations'
          });
        }
      }
    }

    // Check unverified owner-entered observations
    const unverifiedObservations = activeConditions.filter(
      (c) => !c.isDiagnosis && c.verificationStatus === 'UNVERIFIED'
    );
    if (unverifiedObservations.length > 0) {
      careAlerts.push({
        alertId: 'alert-unverified-obs',
        severity: 'INFO',
        message: `${unverifiedObservations.length} owner-observed symptom(s) awaiting clinical veterinary review.`,
        source: 'Conditions'
      });
    }

    // Compute overall vaccination status
    let vaccinationStatus: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NO_RECORDS' = 'UP_TO_DATE';
    if (recordedVaccines.length === 0) {
      vaccinationStatus = 'NO_RECORDS';
    } else {
      let hasOverdue = false;
      let hasDueSoon = false;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      for (const vac of recordedVaccines) {
        if (vac.validUntil) {
          const expTime = new Date(vac.validUntil).getTime();
          if (expTime < nowMs) {
            hasOverdue = true;
          } else if (expTime - nowMs < thirtyDaysMs) {
            hasDueSoon = true;
          }
        }
      }
      if (hasOverdue) {
        vaccinationStatus = 'OVERDUE';
      } else if (hasDueSoon) {
        vaccinationStatus = 'DUE_SOON';
      }
    }

    const hasAnyRecords =
      conditions.length > 0 ||
      allergies.length > 0 ||
      encounters.length > 0 ||
      vaccinations.length > 0 ||
      medications.length > 0 ||
      procedures.length > 0 ||
      diagnostics.length > 0;

    return {
      petId,
      activeConditionsCount: activeConditions.length,
      activeConditions,
      activeAllergiesCount: activeAllergies.length,
      activeAllergies,
      currentMedicationsCount: currentMedications.length,
      currentMedications,
      vaccinationStatus,
      vaccinationSummary: {
        totalRecorded: recordedVaccines.length,
        lastVaccinationDate: lastVaccine ? lastVaccine.administeredAt : undefined,
        lastVaccineName: lastVaccine ? lastVaccine.vaccineName : undefined,
        recordedVaccines
      },
      lastVeterinaryVisit: lastVisit
        ? {
            encounterId: lastVisit.encounterId,
            occurredAt: lastVisit.occurredAt,
            clinicOrProvider:
              lastVisit.externalClinicName || lastVisit.externalProviderName || 'Veterinary Clinic',
            reason: lastVisit.reason,
            encounterType: lastVisit.encounterType
          }
        : undefined,
      recentProceduresCount: procedures.length,
      careAlerts,
      hasAnyRecords,
      assembledAt: new Date().toISOString()
    };
  }
}
