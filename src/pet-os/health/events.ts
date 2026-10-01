/**
 * Pet OS Sprint 5 - Health Domain Events & Event Factory
 * Implements Volume XXI (Event-Driven Architecture & Outbox Pattern) & Volume VII
 */

import { EventEnvelope, createEventEnvelope } from '../kernel/events';
import { CorrelationId, PetId } from '../kernel/ids';
import {
  MedicalCondition,
  PetAllergy,
  VeterinaryEncounter,
  PetVaccination,
  PetMedication,
  MedicalProcedure,
  DiagnosticResult,
  ClinicalNote,
  HealthRecordAmendment
} from './types';

export class HealthEventFactory {
  static conditionRecorded(
    condition: MedicalCondition,
    correlationId?: CorrelationId
  ): EventEnvelope<MedicalCondition> {
    return createEventEnvelope(
      'pet.health.condition_recorded',
      'pet_condition',
      condition.petId,
      condition,
      1,
      correlationId,
      condition.recordedBy
    );
  }

  static conditionUpdated(
    condition: MedicalCondition,
    actorId: string,
    correlationId?: CorrelationId
  ): EventEnvelope<MedicalCondition> {
    return createEventEnvelope(
      'pet.health.condition_updated',
      'pet_condition',
      condition.petId,
      condition,
      1,
      correlationId,
      actorId
    );
  }

  static allergyRecorded(
    allergy: PetAllergy,
    correlationId?: CorrelationId
  ): EventEnvelope<PetAllergy> {
    return createEventEnvelope(
      'pet.health.allergy_recorded',
      'pet_allergy',
      allergy.petId,
      allergy,
      1,
      correlationId,
      allergy.enteredInErrorBy || 'SYSTEM'
    );
  }

  static encounterRecorded(
    encounter: VeterinaryEncounter,
    correlationId?: CorrelationId
  ): EventEnvelope<VeterinaryEncounter> {
    return createEventEnvelope(
      'pet.health.encounter_recorded',
      'pet_encounter',
      encounter.petId,
      encounter,
      1,
      correlationId,
      encounter.recordedBy
    );
  }

  static vaccinationRecorded(
    vaccination: PetVaccination,
    correlationId?: CorrelationId
  ): EventEnvelope<PetVaccination> {
    return createEventEnvelope(
      'pet.health.vaccination_recorded',
      'pet_vaccination',
      vaccination.petId,
      vaccination,
      1,
      correlationId,
      vaccination.recordedBy
    );
  }

  static medicationRecorded(
    medication: PetMedication,
    correlationId?: CorrelationId
  ): EventEnvelope<PetMedication> {
    return createEventEnvelope(
      'pet.health.medication_recorded',
      'pet_medication',
      medication.petId,
      medication,
      1,
      correlationId,
      medication.recordedBy
    );
  }

  static procedureRecorded(
    procedure: MedicalProcedure,
    correlationId?: CorrelationId
  ): EventEnvelope<MedicalProcedure> {
    return createEventEnvelope(
      'pet.health.procedure_recorded',
      'pet_procedure',
      procedure.petId,
      procedure,
      1,
      correlationId,
      procedure.recordedBy
    );
  }

  static diagnosticRecorded(
    diagnostic: DiagnosticResult,
    correlationId?: CorrelationId
  ): EventEnvelope<DiagnosticResult> {
    return createEventEnvelope(
      'pet.health.diagnostic_recorded',
      'pet_diagnostic',
      diagnostic.petId,
      diagnostic,
      1,
      correlationId,
      diagnostic.recordedBy
    );
  }

  static clinicalNoteRecorded(
    note: ClinicalNote,
    correlationId?: CorrelationId
  ): EventEnvelope<ClinicalNote> {
    return createEventEnvelope(
      'pet.health.clinical_note_recorded',
      'pet_clinical_note',
      note.petId,
      note,
      1,
      correlationId,
      note.authorUserId
    );
  }

  static recordAmended(
    amendment: HealthRecordAmendment,
    correlationId?: CorrelationId
  ): EventEnvelope<HealthRecordAmendment> {
    return createEventEnvelope(
      'pet.health.record_amended',
      'pet_health_amendment',
      amendment.petId,
      amendment,
      1,
      correlationId,
      amendment.amendedBy
    );
  }
}
