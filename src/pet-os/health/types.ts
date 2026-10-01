/**
 * Pet OS Sprint 5 - Veterinary Health & Medical Records Domain Models
 * Implements:
 * - Volume III (Domain-Driven Design Architecture)
 * - Volume VII (Veterinary Health & Medical Records)
 * - Volume XXIV & XXV (AI Safety, Boundaries & Provenance)
 * - Volume XXVIII (API & Integration Specification)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI & XXXII (Security, Privacy & Kenyan Compliance)
 * - ADR-005 (Clinical Provenance Preserved: Owner Observations vs Professional Diagnoses)
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
  ProviderId,
  ClinicId,
  PetDocumentId
} from '../kernel/ids';

// ============================================================================
// ENUMS & VALUE TYPES
// ============================================================================

/**
 * Authoritative record provenance - distinguishes source actor and system origin
 */
export type ClinicalProvenanceType =
  | 'OWNER_ENTERED'
  | 'VETERINARY_PROFESSIONAL'
  | 'CLINIC_SYSTEM'
  | 'IMPORTED_RECORD'
  | 'DOCUMENT_DERIVED'
  | 'SYSTEM_GENERATED';

/**
 * Verification state - strictly orthogonal to provenance
 */
export type ClinicalVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUPERSEDED';

/**
 * Historical date precision for incomplete or imported records
 */
export type ClinicalDatePrecision =
  | 'EXACT'
  | 'ESTIMATED_MONTH_YEAR'
  | 'ESTIMATED_YEAR'
  | 'UNKNOWN';

/**
 * Medical condition states & legal lifecycle transitions
 */
export type ConditionStatus =
  | 'SUSPECTED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'IN_REMISSION'
  | 'HISTORICAL'
  | 'ENTERED_IN_ERROR';

export type ConditionCategory =
  | 'DERMATOLOGY'
  | 'GASTROINTESTINAL'
  | 'ORTHOPEDIC'
  | 'RESPIRATORY'
  | 'CARDIOLOGY'
  | 'NEUROLOGY'
  | 'OPHTHALMOLOGY'
  | 'ENDOCRINE'
  | 'INFECTIOUS'
  | 'DENTAL'
  | 'BEHAVIORAL'
  | 'GENERAL_OBSERVATION'
  | 'OTHER';

/**
 * Allergy / Sensitivity classifications
 */
export type AllergyCategory =
  | 'FOOD'
  | 'ENVIRONMENTAL'
  | 'MEDICATION'
  | 'CONTACT'
  | 'INSECT'
  | 'OTHER';

export type AllergyType =
  | 'ALLERGY'
  | 'INTOLERANCE'
  | 'OWNER_SUSPECTED_SENSITIVITY';

export type AllergySeverity =
  | 'MILD'
  | 'MODERATE'
  | 'SEVERE'
  | 'LIFE_THREATENING'
  | 'UNKNOWN';

export type AllergyStatus =
  | 'ACTIVE'
  | 'RESOLVED'
  | 'SUSPECTED'
  | 'ENTERED_IN_ERROR';

/**
 * Veterinary encounter types and states
 */
export type EncounterType =
  | 'ROUTINE_CHECKUP'
  | 'VACCINATION_VISIT'
  | 'EMERGENCY_VISIT'
  | 'CONSULTATION'
  | 'FOLLOW_UP'
  | 'SURGERY'
  | 'TELECONSULTATION'
  | 'DIAGNOSTIC_APPOINTMENT';

export type EncounterStatus =
  | 'DRAFT'
  | 'COMPLETED'
  | 'AMENDED'
  | 'ENTERED_IN_ERROR';

/**
 * Medication routes, types, and lifecycle states
 */
export type MedicationType =
  | 'PRESCRIPTION'
  | 'OTC'
  | 'SUPPLEMENT'
  | 'PREVENTATIVE';

export type MedicationRoute =
  | 'ORAL'
  | 'TOPICAL'
  | 'INJECTION'
  | 'OPHTHALMIC'
  | 'OTIC'
  | 'INHALATION'
  | 'SUBCUTANEOUS';

export type MedicationStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DISCONTINUED'
  | 'ENTERED_IN_ERROR';

/**
 * Procedures and Surgeries
 */
export type ProcedureType =
  | 'SURGERY'
  | 'DENTAL_CLEANING'
  | 'BIOPSY'
  | 'ENDOSCOPY'
  | 'ULTRASOUND'
  | 'X_RAY'
  | 'MICROCHIP_IMPLANT'
  | 'NEUTER_SPAY'
  | 'WOUND_REPAIR'
  | 'OTHER_PROCEDURE';

export type ProcedureStatus =
  | 'COMPLETED'
  | 'AMENDED'
  | 'ENTERED_IN_ERROR';

/**
 * Diagnostics & Laboratory
 */
export type DiagnosticTestType =
  | 'BLOOD_CHEMISTRY'
  | 'HEMATOLOGY_CBC'
  | 'URINALYSIS'
  | 'FECAL_ANALYSIS'
  | 'CYTOLOGY'
  | 'HISTOPATHOLOGY'
  | 'MICROBIOLOGY'
  | 'RADIOLOGY'
  | 'RAPID_ANTIGEN_TEST'
  | 'OTHER_DIAGNOSTIC';

/**
 * Clinical Note Types preserving authorship and purpose
 */
export type ClinicalNoteType =
  | 'OWNER_NOTE'
  | 'VETERINARY_NOTE'
  | 'STRUCTURED_OBSERVATION'
  | 'ASSESSMENT'
  | 'TREATMENT_PLAN'
  | 'DISCHARGE_INSTRUCTION';

// ============================================================================
// CANONICAL AGGREGATES & ENTITIES
// ============================================================================

/**
 * MedicalCondition Aggregate
 * Distinguishes Owner Observation (isDiagnosis: false) vs Professional Diagnosis (isDiagnosis: true)
 */
export interface MedicalCondition {
  conditionId: ConditionId;
  petId: PetId;
  isDiagnosis: boolean; // false = Owner Observation, true = Professional Diagnosis
  conditionCode?: string; // SNOMED CT / VeNom code where standard exists
  conditionName: string;
  category: ConditionCategory;
  description?: string;
  onsetDate?: string;
  onsetDatePrecision: ClinicalDatePrecision;
  diagnosedAt?: string;
  resolvedAt?: string;
  status: ConditionStatus;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  chronic: boolean;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  recordedBy: UserId;
  verifiedBy?: string; // Clinician license / ID
  veterinaryProviderId?: ProviderId;
  veterinaryClinicId?: ClinicId;
  externalProviderName?: string;
  encounterId?: EncounterId;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: ConditionId;
  archivedAt?: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * PetAllergy / Sensitivity Entity
 */
export interface PetAllergy {
  allergyId: AllergyId;
  petId: PetId;
  allergen: string;
  allergenCategory: AllergyCategory;
  allergyType: AllergyType;
  reaction: string;
  severity: AllergySeverity;
  firstObservedAt?: string;
  firstObservedPrecision: ClinicalDatePrecision;
  status: AllergyStatus;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  confirmedBy?: string;
  clinicalNotes?: string;
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * VeterinaryEncounter Aggregate
 */
export interface VeterinaryEncounter {
  encounterId: EncounterId;
  petId: PetId;
  providerId?: ProviderId;
  clinicId?: ClinicId;
  externalClinicName?: string;
  externalProviderName?: string;
  encounterType: EncounterType;
  occurredAt: string;
  occurredAtPrecision: ClinicalDatePrecision;
  reason: string;
  chiefComplaint?: string;
  outcome?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  status: EncounterStatus;
  provenance: ClinicalProvenanceType;
  recordedBy: UserId;
  verificationStatus: ClinicalVerificationStatus;
  verifiedBy?: string;
  linkedDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * PetVaccination Entity
 */
export interface PetVaccination {
  vaccinationId: VaccinationId;
  petId: PetId;
  vaccineCode: string; // Refers to VaccineCatalogItem.code
  vaccineName: string;
  vaccineType: string;
  targetDiseases: string[];
  administeredAt: string;
  administeredAtPrecision: ClinicalDatePrecision;
  validFrom: string;
  validUntil?: string; // Recorded clinician valid date
  nextDueAt?: string; // Explicit clinician next due date (no inference)
  dose: string;
  batchLotNumber?: string;
  manufacturer?: string;
  veterinaryProviderId?: ProviderId;
  veterinaryClinicId?: ClinicId;
  externalProviderName?: string;
  externalClinicName?: string;
  certificateDocumentId?: string; // Links to Sprint 4 PetDocumentId
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  recordedBy: UserId;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: VaccinationId;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * PetMedication Entity
 */
export interface PetMedication {
  medicationId: MedicationId;
  petId: PetId;
  medicationName: string;
  genericName?: string;
  medicationType: MedicationType;
  dosage: string;
  dosageUnit: string;
  route: MedicationRoute;
  frequency: string;
  startAt: string;
  startAtPrecision: ClinicalDatePrecision;
  endAt?: string;
  status: MedicationStatus;
  prescribingProvider?: string;
  veterinaryClinicId?: ClinicId;
  encounterId?: EncounterId;
  instructions: string;
  reason?: string;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  recordedBy: UserId;
  discontinuedAt?: string;
  discontinuedReason?: string;
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * MedicalProcedure Entity
 */
export interface MedicalProcedure {
  procedureId: ProcedureId;
  petId: PetId;
  procedureType: ProcedureType;
  procedureName: string;
  performedAt: string;
  performedAtPrecision: ClinicalDatePrecision;
  status: ProcedureStatus;
  providerName?: string;
  clinicName?: string;
  reasonIndication?: string;
  outcome?: string;
  complications?: string;
  followUpNotes?: string;
  linkedDocumentIds: string[];
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  recordedBy: UserId;
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * DiagnosticResult Entity (Supports Structured & Document-Only results)
 */
export interface DiagnosticResult {
  resultId: DiagnosticResultId;
  petId: PetId;
  encounterId?: EncounterId;
  testType: DiagnosticTestType;
  testName: string;
  collectedAt: string;
  resultedAt?: string;
  resultSummary: string;
  isDocumentOnly: boolean;
  linkedDocumentId?: string;
  structuredResults?: Array<{
    marker: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    abnormalFlag?: boolean;
  }>;
  laboratoryName?: string;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
  recordedBy: UserId;
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * ClinicalNote Entity
 */
export interface ClinicalNote {
  noteId: ClinicalNoteId;
  petId: PetId;
  encounterId?: EncounterId;
  noteType: ClinicalNoteType;
  authorUserId: UserId;
  authorName: string;
  authorRole: string;
  isConfidentialProfessionalNote: boolean;
  content: string;
  provenance: ClinicalProvenanceType;
  createdAt: string;
  updatedAt: string;
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
}

/**
 * Clinical Amendment & Correction Audit Record
 */
export interface HealthRecordAmendment {
  amendmentId: AmendmentId;
  petId: PetId;
  recordType: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION' | 'ENCOUNTER' | 'PROCEDURE' | 'DIAGNOSTIC' | 'NOTE';
  originalRecordId: string;
  supersedingRecordId?: string;
  amendedBy: UserId;
  amendedAt: string;
  amendmentReason: string;
  actionType: 'AMENDED' | 'SUPERSEDED' | 'ENTERED_IN_ERROR';
  originalSnapshot: Record<string, unknown>;
}

/**
 * Health Document Relationship
 */
export interface HealthDocumentLink {
  linkId: string;
  petId: PetId;
  healthRecordType: 'ENCOUNTER' | 'VACCINATION' | 'PROCEDURE' | 'DIAGNOSTIC' | 'CONDITION';
  healthRecordId: string;
  documentId: string;
  createdAt: string;
  createdBy: UserId;
}

/**
 * Vaccine Catalog Reference Item
 */
export interface VaccineCatalogItem {
  code: string;
  species: 'SPECIES_DOG' | 'SPECIES_CAT' | 'ALL';
  name: string;
  category: 'CORE' | 'NON_CORE' | 'LIFESTYLE';
  targetDiseases: string[];
  standardValidityMonths?: number;
  description: string;
  active: boolean;
}

// ============================================================================
// READ MODELS / PROJECTIONS
// ============================================================================

export interface ActiveConditionSummary {
  conditionId: string;
  name: string;
  isDiagnosis: boolean;
  category: ConditionCategory;
  onsetDate?: string;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
}

export interface ActiveAllergySummary {
  allergyId: string;
  allergen: string;
  category: AllergyCategory;
  severity: AllergySeverity;
  reaction: string;
  allergyType: AllergyType;
}

export interface CurrentMedicationSummary {
  medicationId: string;
  name: string;
  dosage: string;
  dosageUnit: string;
  frequency: string;
  route: MedicationRoute;
  instructions: string;
  startAt: string;
  provenance: ClinicalProvenanceType;
  verificationStatus: ClinicalVerificationStatus;
}

export interface VaccinationSummaryItem {
  vaccinationId: string;
  vaccineName: string;
  vaccineCode: string;
  administeredAt: string;
  validUntil?: string;
  nextDueAt?: string;
  dose: string;
  verificationStatus: ClinicalVerificationStatus;
  provenance: ClinicalProvenanceType;
  hasCertificate: boolean;
  certificateDocumentId?: string;
}

export interface RecentVisitSummary {
  encounterId: string;
  occurredAt: string;
  clinicOrProvider: string;
  reason: string;
  encounterType: EncounterType;
}

export interface HealthCareAlert {
  alertId: string;
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  message: string;
  source: string;
}

export type VaccinationStatus = 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NO_RECORDS';

export interface PetHealthSummary {
  petId: PetId;
  activeConditionsCount: number;
  activeConditions: ActiveConditionSummary[];
  activeAllergiesCount: number;
  activeAllergies: ActiveAllergySummary[];
  currentMedicationsCount: number;
  currentMedications: CurrentMedicationSummary[];
  vaccinationStatus: VaccinationStatus;
  vaccinationSummary: {
    totalRecorded: number;
    lastVaccinationDate?: string;
    lastVaccineName?: string;
    recordedVaccines: VaccinationSummaryItem[];
  };
  lastVeterinaryVisit?: RecentVisitSummary;
  recentProceduresCount: number;
  careAlerts: HealthCareAlert[];
  hasAnyRecords: boolean;
  assembledAt: string;
}

// ============================================================================
// COMMANDS (Write contracts)
// ============================================================================

export interface RecordConditionCommand {
  petId: PetId;
  isDiagnosis: boolean;
  conditionCode?: string;
  conditionName: string;
  category: ConditionCategory;
  description?: string;
  onsetDate?: string;
  onsetDatePrecision?: ClinicalDatePrecision;
  diagnosedAt?: string;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  chronic?: boolean;
  provenance?: ClinicalProvenanceType;
  externalProviderName?: string;
  veterinaryProviderId?: ProviderId;
  veterinaryClinicId?: ClinicId;
  encounterId?: EncounterId;
  notes?: string;
}

export interface UpdateConditionCommand {
  conditionId: ConditionId;
  conditionName?: string;
  category?: ConditionCategory;
  description?: string;
  status?: ConditionStatus;
  resolvedAt?: string;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  chronic?: boolean;
  notes?: string;
}

export interface RecordAllergyCommand {
  petId: PetId;
  allergen: string;
  allergenCategory: AllergyCategory;
  allergyType?: AllergyType;
  reaction: string;
  severity: AllergySeverity;
  firstObservedAt?: string;
  firstObservedPrecision?: ClinicalDatePrecision;
  provenance?: ClinicalProvenanceType;
  clinicalNotes?: string;
}

export interface RecordEncounterCommand {
  petId: PetId;
  encounterType: EncounterType;
  occurredAt: string;
  occurredAtPrecision?: ClinicalDatePrecision;
  reason: string;
  chiefComplaint?: string;
  outcome?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  providerId?: ProviderId;
  clinicId?: ClinicId;
  externalClinicName?: string;
  externalProviderName?: string;
  provenance?: ClinicalProvenanceType;
  linkedDocumentIds?: string[];
}

export interface RecordVaccinationCommand {
  petId: PetId;
  vaccineCode: string;
  vaccineName?: string;
  administeredAt: string;
  administeredAtPrecision?: ClinicalDatePrecision;
  validFrom?: string;
  validUntil?: string;
  nextDueAt?: string;
  dose: string;
  batchLotNumber?: string;
  manufacturer?: string;
  externalProviderName?: string;
  externalClinicName?: string;
  veterinaryProviderId?: ProviderId;
  veterinaryClinicId?: ClinicId;
  certificateDocumentId?: string;
  provenance?: ClinicalProvenanceType;
}

export interface RecordMedicationCommand {
  petId: PetId;
  medicationName: string;
  genericName?: string;
  medicationType: MedicationType;
  dosage: string;
  dosageUnit: string;
  route: MedicationRoute;
  frequency: string;
  startAt: string;
  startAtPrecision?: ClinicalDatePrecision;
  endAt?: string;
  prescribingProvider?: string;
  veterinaryClinicId?: ClinicId;
  encounterId?: EncounterId;
  instructions: string;
  reason?: string;
  provenance?: ClinicalProvenanceType;
}

export interface RecordProcedureCommand {
  petId: PetId;
  procedureType: ProcedureType;
  procedureName: string;
  performedAt: string;
  performedAtPrecision?: ClinicalDatePrecision;
  providerName?: string;
  clinicName?: string;
  reasonIndication?: string;
  outcome?: string;
  complications?: string;
  followUpNotes?: string;
  linkedDocumentIds?: string[];
  provenance?: ClinicalProvenanceType;
}

export interface RecordDiagnosticCommand {
  petId: PetId;
  encounterId?: EncounterId;
  testType: DiagnosticTestType;
  testName: string;
  collectedAt: string;
  resultedAt?: string;
  resultSummary: string;
  isDocumentOnly: boolean;
  linkedDocumentId?: string;
  structuredResults?: Array<{
    marker: string;
    value: string | number;
    unit?: string;
    referenceRange?: string;
    abnormalFlag?: boolean;
  }>;
  laboratoryName?: string;
  provenance?: ClinicalProvenanceType;
}

export interface RecordClinicalNoteCommand {
  petId: PetId;
  encounterId?: EncounterId;
  noteType: ClinicalNoteType;
  authorName: string;
  authorRole: string;
  isConfidentialProfessionalNote?: boolean;
  content: string;
  provenance?: ClinicalProvenanceType;
}

export interface AmendClinicalRecordCommand {
  petId: PetId;
  recordType: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION' | 'ENCOUNTER' | 'PROCEDURE' | 'DIAGNOSTIC' | 'NOTE';
  recordId: string;
  amendmentReason: string;
  updatedFields: Record<string, unknown>;
}

export interface MarkEnteredInErrorCommand {
  petId: PetId;
  recordType: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION' | 'ENCOUNTER' | 'PROCEDURE' | 'DIAGNOSTIC' | 'NOTE';
  recordId: string;
  reason: string;
}

// Convenience DTO aliases
export type PetHealthSummaryDto = PetHealthSummary;
export type PetConditionDto = MedicalCondition;
export type PetAllergyDto = PetAllergy;
export type PetVaccinationDto = PetVaccination;
export type PetMedicationDto = PetMedication;
export type PetEncounterDto = VeterinaryEncounter;
export type PetDiagnosticDto = DiagnosticResult;
export type PetProcedureDto = MedicalProcedure;
export type PetClinicalNoteDto = ClinicalNote;
export type ClinicalSeverity = 'MILD' | 'MODERATE' | 'SEVERE';
export type AllergenCategory = AllergyCategory;

