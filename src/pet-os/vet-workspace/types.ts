/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace Domain Types
 * 
 * Implements:
 * - Volume XIV (Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces)
 * - Volume VII (Veterinary Health & Medical Records)
 * - Volume IV (Identity, Organizations & RBAC)
 * - Volume XII (Pet Services Marketplace & Appointment Handoffs)
 * - Volume XXIV & XXV (AI Safety, Non-Diagnostic Governance & Clinical Provenance)
 * - Volume XXVIII (API Specification)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI & XXXII (Security, Medical Privacy & Kenyan Regulatory Compliance - KVB)
 * - ADR-005 (Clinical Provenance Preserved: Owner Observations vs Professional Diagnoses)
 * 
 * Normative Rules:
 * 1. Sprint 5 is authoritative for clinical medical records. DO NOT duplicate canonical entities.
 * 2. Strict credential verification: only verified veterinarians with active licenses can diagnose and prescribe.
 * 3. Explicit clinical access grants: NO global pet access by name.
 * 4. Signed records are immutable: corrections require explicit amendments.
 * 5. Role-based field masking: Reception cannot view detailed diagnoses or sensitive lab results.
 * 6. ZERO autonomous AI diagnosis, prescribing, or clinical decision-making.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  BusinessId,
  ProviderId,
  EncounterId,
  ConditionId,
  AllergyId,
  VaccinationId,
  MedicationId,
  ProcedureId,
  DiagnosticResultId,
  ClinicalNoteId,
  AmendmentId,
  PetDocumentId,
  BookingId,
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
} from '../kernel/ids';
import {
  ConditionCategory,
  ConditionStatus,
  AllergyCategory,
  AllergySeverity,
  AllergyType,
  EncounterType,
  MedicationRoute,
  DiagnosticTestType,
  ProcedureType,
  ClinicalDatePrecision,
  ClinicalProvenanceType,
} from '../health/types';

// ============================================================================
// CLINICAL ROLES & PERMISSIONS
// ============================================================================

export type ClinicalStaffRole =
  | 'CLINIC_OWNER'
  | 'CLINIC_ADMIN'
  | 'VETERINARIAN'
  | 'VETERINARY_TECHNICIAN'
  | 'VETERINARY_NURSE'
  | 'RECEPTION';

export type ClinicalAccessScope =
  | 'DEMOGRAPHICS_READ'
  | 'BASIC_VITALS_WRITE'
  | 'MEDICAL_HISTORY_READ'
  | 'MEDICAL_HISTORY_WRITE'
  | 'DIAGNOSES_WRITE'
  | 'PRESCRIPTIONS_WRITE'
  | 'LAB_ORDERS_WRITE'
  | 'SURGERY_WRITE'
  | 'CONFIDENTIAL_NOTES_READ'
  | 'FULL_CLINICAL_ACCESS';

export type ClinicalRelationshipType =
  | 'PRIMARY_CARE'
  | 'SPECIALIST_REFERRAL'
  | 'EMERGENCY'
  | 'HOSPITALIZATION'
  | 'TELECONSULTATION'
  | 'SHELTER_WELFARE_CARE';

// ============================================================================
// CLINICAL ACCESS GRANT & BREAK-GLASS
// ============================================================================

export interface ClinicalAccessGrant {
  grantId: ClinicalAccessGrantId;
  clinicId: BusinessId;
  petId: PetId;
  householdId: HouseholdId;
  grantedByUserId: UserId;
  relationshipType: ClinicalRelationshipType;
  allowedScopes: ClinicalAccessScope[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  validFrom: string;
  validUntil: string;
  consentId?: VeterinaryConsentId;
  purposeDescription: string;
  isBreakGlass?: boolean;
  revokedAt?: string;
  revocationReason?: string;
  revokedByUserId?: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalBreakGlassAccessRecord {
  breakGlassId: ClinicalBreakGlassAccessId;
  clinicId: BusinessId;
  petId: PetId;
  accessedByUserId: UserId;
  providerId?: ProviderId;
  emergencyReason: string;
  witnessName?: string;
  initiatedAt: string;
  expiresAt: string;
  auditAcknowledged: boolean;
  grantId: ClinicalAccessGrantId;
  auditLogId: string;
}

// ============================================================================
// VETERINARY CONSENT
// ============================================================================

export type VeterinaryConsentType =
  | 'GENERAL_TREATMENT'
  | 'SURGICAL_ANESTHESIA'
  | 'EUTHANASIA'
  | 'DATA_SHARING_REFERRAL'
  | 'OFF_LABEL_MEDICATION';

export interface VeterinaryConsent {
  consentId: VeterinaryConsentId;
  petId: PetId;
  householdId: HouseholdId;
  clinicId: BusinessId;
  consentType: VeterinaryConsentType;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  consentingUserId: UserId;
  consentingPartyName: string;
  consentingPartyRelationship: 'OWNER' | 'AUTHORIZED_AGENT' | 'RESCUE_CUSTODIAN';
  risksDisclosed: string[];
  clinicalScopeNotes: string;
  signedAt: string;
  documentStorageKey?: string;
  ipAddressMasked?: string;
}

// ============================================================================
// WORK QUEUE & CLINICAL FLOW
// ============================================================================

export type WorkQueueStatus =
  | 'SCHEDULED_TODAY'
  | 'CHECKED_IN'
  | 'TRIAGED'
  | 'IN_CONSULTATION'
  | 'AWAITING_DIAGNOSTICS'
  | 'READY_FOR_SIGNATURE'
  | 'DISCHARGED'
  | 'NO_SHOW';

export type TriageUrgencyLevel = 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'POST_OP';

export interface ClinicalWorkQueueItem {
  queueItemId: WorkQueueItemId;
  clinicId: BusinessId;
  petId: PetId;
  petName: string;
  species: string;
  breed: string;
  householdId: HouseholdId;
  ownerName: string;
  ownerPhone: string;
  assignedVeterinarianId?: ProviderId;
  assignedVeterinarianName?: string;
  assignedTechnicianId?: UserId;
  assignedTechnicianName?: string;
  status: WorkQueueStatus;
  triageLevel: TriageUrgencyLevel;
  checkInTime: string;
  bookingId?: BookingId;
  encounterId?: EncounterId;
  chiefComplaint: string;
  roomNumber?: string;
  estimatedWaitMinutes?: number;
  notes?: string;
  updatedAt: string;
}

// ============================================================================
// VITALS & PHYSICAL EXAMINATION
// ============================================================================

export type MucousMembraneColor = 'PINK' | 'PALE' | 'CYANOTIC' | 'ICTERIC' | 'CONGESTED' | 'BRICK_RED';

export interface VitalsMeasurement {
  weightKg?: number;
  temperatureCelsius?: number;
  heartRateBpm?: number;
  respiratoryRateBrpm?: number;
  bodyConditionScore?: number; // 1 to 9
  mucousMembraneColor?: MucousMembraneColor;
  capillaryRefillTimeSeconds?: number;
  bloodPressureSystolic?: number;
  painScore?: number; // 0 to 4
  recordedByUserId: UserId;
  recordedByName: string;
  recordedByRole: ClinicalStaffRole;
  recordedAt: string;
  notes?: string;
}

export type BodySystemName =
  | 'GENERAL_APPEARANCE'
  | 'CARDIOVASCULAR'
  | 'RESPIRATORY'
  | 'GASTROINTESTINAL'
  | 'MUSCULOSKELETAL'
  | 'NEUROLOGICAL'
  | 'DERMATOLOGICAL'
  | 'OPHTHALMIC'
  | 'OTIC'
  | 'ORAL_DENTAL'
  | 'UROGENITAL'
  | 'LYMPH_NODES';

export type ExamFindingStatus = 'NORMAL' | 'ABNORMAL' | 'NOT_EXAMINED';

export interface PhysicalExamSystem {
  system: BodySystemName;
  status: ExamFindingStatus;
  findings?: string;
}

// ============================================================================
// CLINICAL ASSESSMENT & DIAGNOSES
// ============================================================================

export type DiagnosisLikelihood = 'CONFIRMED' | 'LIKELY' | 'SUSPECTED' | 'RULED_OUT';

export interface ClinicalDifferentialDiagnosis {
  conditionName: string;
  conditionCode?: string; // VeNom / SNOMED CT
  category: ConditionCategory;
  likelihood: DiagnosisLikelihood;
  rationale?: string;
  isPrimary: boolean;
  chronic: boolean;
  resolvedAt?: string;
}

// ============================================================================
// PRESCRIPTIONS & MEDICATION SAFETY
// ============================================================================

export type MedicationForm = 'TABLET' | 'CAPSULE' | 'LIQUID' | 'INJECTION' | 'TOPICAL' | 'DROPS' | 'PASTE';

export interface ClinicalPrescription {
  prescriptionId: PrescriptionId;
  encounterId: EncounterId;
  petId: PetId;
  clinicId: BusinessId;
  prescribingProviderId: ProviderId;
  prescribingVeterinarianName: string;
  veterinarianLicenseNumber: string;
  medicationName: string;
  genericName?: string;
  form: MedicationForm;
  strength: string; // e.g. "50mg"
  dosageQuantity: number;
  dosageUnit: string; // e.g. "mg", "ml", "tablets"
  route: MedicationRoute;
  frequency: string; // e.g. "Every 12 hours with food"
  durationDays: number;
  refillsAllowed: number;
  refillsRemaining: number;
  instructions: string;
  warningLabels: string[];
  safetyCheckPassed: boolean;
  safetyCheckNotes?: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED' | 'CANCELLED';
  prescribedAt: string;
  expiresAt: string;
  discontinuedAt?: string;
  discontinuedReason?: string;
}

// ============================================================================
// DIAGNOSTIC ORDERS
// ============================================================================

export type DiagnosticOrderStatus =
  | 'ORDERED'
  | 'SAMPLE_COLLECTED'
  | 'PROCESSING'
  | 'RESULTED'
  | 'CANCELLED';

export interface ClinicalDiagnosticOrder {
  orderId: DiagnosticOrderId;
  encounterId: EncounterId;
  petId: PetId;
  clinicId: BusinessId;
  orderedByProviderId: ProviderId;
  orderedByName: string;
  testType: DiagnosticTestType;
  testName: string;
  specimenSource?: string;
  clinicalIndication: string;
  status: DiagnosticOrderStatus;
  orderedAt: string;
  collectedAt?: string;
  collectedByUserId?: UserId;
  resultId?: DiagnosticResultId;
  resultSummary?: string;
  laboratoryName?: string;
}

// ============================================================================
// CARE PLANS & DISCHARGE INSTRUCTIONS
// ============================================================================

export type ActivityRestrictionLevel =
  | 'STRICT_CRATE_REST'
  | 'SHORT_LEASH_WALKS_ONLY'
  | 'NO_HIGH_IMPACT'
  | 'NORMAL_ACTIVITY';

export interface ClinicalCarePlan {
  carePlanId: CarePlanId;
  encounterId: EncounterId;
  petId: PetId;
  clinicId: BusinessId;
  authorProviderId: ProviderId;
  authorName: string;
  title: string;
  diagnosisSummary: string;
  ownerInstructions: string;
  dietaryGuidance?: string;
  activityRestrictions?: ActivityRestrictionLevel;
  activityRestrictionDays?: number;
  woundCareInstructions?: string;
  warningSignsEmergency: string[];
  recheckRequired: boolean;
  recheckDate?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'SUPERSEDED';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CLINICAL SIGNATURE & RECORD IMMUTABILITY
// ============================================================================

export type ClinicalSignableRecordType =
  | 'ENCOUNTER'
  | 'PRESCRIPTION'
  | 'DISCHARGE_CARE_PLAN'
  | 'VACCINATION_CERTIFICATE';

export interface ClinicalSignature {
  signatureId: ClinicalSignatureId;
  recordType: ClinicalSignableRecordType;
  recordId: string;
  signerUserId: UserId;
  signerProviderId: ProviderId;
  signerName: string;
  licenseNumber: string;
  signingRole: 'LICENSED_VETERINARIAN';
  cryptographicDigest: string;
  signedAt: string;
  statementOfResponsibility: string;
}

// ============================================================================
// CLINICAL AMENDMENT & RECORD CORRECTION REQUESTS
// ============================================================================

export type CorrectionRequestStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED_AMENDED'
  | 'DECLINED';

export interface ClinicalRecordCorrectionRequest {
  requestId: ClinicalRecordCorrectionRequestId;
  petId: PetId;
  householdId: HouseholdId;
  requestedByUserId: UserId;
  requestedByName: string;
  targetRecordType: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION' | 'ENCOUNTER' | 'PROCEDURE';
  targetRecordId: string;
  correctionReason: string;
  status: CorrectionRequestStatus;
  clinicianResponse?: string;
  reviewedByUserId?: UserId;
  reviewedByName?: string;
  reviewedAt?: string;
  resultingAmendmentId?: AmendmentId;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// VETERINARY REFERRAL & SPECIALIST HANDOFF
// ============================================================================

export type ReferralUrgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

export interface VeterinaryReferral {
  referralId: VeterinaryReferralId;
  sourceClinicId: BusinessId;
  sourceClinicName: string;
  destinationClinicId: BusinessId;
  destinationClinicName: string;
  petId: PetId;
  petName: string;
  householdId: HouseholdId;
  referringVeterinarianId: ProviderId;
  referringVeterinarianName: string;
  specialtyRequested: string;
  clinicalSummary: string;
  urgency: ReferralUrgency;
  sharedRecordIds: string[];
  ownerConsentConfirmed: boolean;
  status: ReferralStatus;
  referredAt: string;
  acceptedAt?: string;
  completedAt?: string;
  declinedReason?: string;
}

// ============================================================================
// WORKSPACE ENCOUNTER STATE (In-Flight Consultation Session)
// ============================================================================

export type WorkspaceEncounterStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'AWAITING_DIAGNOSTICS'
  | 'READY_FOR_REVIEW'
  | 'SIGNED'
  | 'AMENDED'
  | 'ENTERED_IN_ERROR'
  | 'CLOSED';

export interface WorkspaceClinicalEncounterSession {
  encounterId: EncounterId;
  clinicId: BusinessId;
  petId: PetId;
  householdId: HouseholdId;
  bookingId?: BookingId;
  queueItemId?: WorkQueueItemId;
  status: WorkspaceEncounterStatus;
  encounterType: EncounterType;
  primaryVeterinarianId: ProviderId;
  primaryVeterinarianName: string;
  attendingTechnicianId?: UserId;
  attendingTechnicianName?: string;
  
  // Presenting complaints & History (Explicitly Owner Reported)
  presentingComplaint: string;
  ownerReportedHistory: string;
  ownerObservationsTag: 'OWNER_REPORTED';

  // Professional Vitals & Physical Examination
  vitals?: VitalsMeasurement;
  physicalExam: PhysicalExamSystem[];
  
  // Clinical Assessment & Diagnoses
  diagnoses: ClinicalDifferentialDiagnosis[];
  clinicalSummaryAssessment?: string;
  
  // Interventions & Orders
  vaccinationAdministered?: {
    vaccineCode: string;
    vaccineName: string;
    lotNumber: string;
    manufacturer: string;
    route: string;
    site: string;
    administeredByUserId: UserId;
    administeredByName: string;
    validUntil: string;
    nextDueAt?: string;
  };
  prescriptions: PrescriptionId[];
  diagnosticOrders: DiagnosticOrderId[];
  proceduresPerformed: Array<{
    procedureType: ProcedureType;
    procedureName: string;
    outcome?: string;
    anesthesiaProtocol?: string;
    complications?: string;
  }>;
  carePlan?: CarePlanId;
  
  // Governance & Sealing
  isSigned: boolean;
  signedAt?: string;
  signatureId?: ClinicalSignatureId;
  generatedDocumentIds: PetDocumentId[];
  
  // Timestamps
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// COMMAND CONTRACTS (Write Operations)
// ============================================================================

export interface CreateClinicalAccessGrantCommand {
  clinicId: BusinessId;
  petId: PetId;
  householdId: HouseholdId;
  grantedByUserId: UserId;
  relationshipType: ClinicalRelationshipType;
  allowedScopes: ClinicalAccessScope[];
  durationDays?: number;
  consentId?: VeterinaryConsentId;
  purposeDescription: string;
}

export interface BreakGlassEmergencyAccessCommand {
  clinicId: BusinessId;
  petId: PetId;
  accessedByUserId: UserId;
  providerId?: ProviderId;
  emergencyReason: string;
  witnessName?: string;
}

export interface RecordVeterinaryConsentCommand {
  petId: PetId;
  householdId: HouseholdId;
  clinicId: BusinessId;
  consentType: VeterinaryConsentType;
  consentingUserId: UserId;
  consentingPartyName: string;
  consentingPartyRelationship: 'OWNER' | 'AUTHORIZED_AGENT' | 'RESCUE_CUSTODIAN';
  risksDisclosed: string[];
  clinicalScopeNotes: string;
}

export interface CheckInPatientCommand {
  clinicId: BusinessId;
  petId: PetId;
  householdId: HouseholdId;
  chiefComplaint: string;
  triageLevel?: TriageUrgencyLevel;
  bookingId?: BookingId;
  assignedVeterinarianId?: ProviderId;
  assignedTechnicianId?: UserId;
  roomNumber?: string;
  checkInByUserId: UserId;
}

export interface StartEncounterSessionCommand {
  queueItemId?: WorkQueueItemId;
  clinicId: BusinessId;
  petId: PetId;
  householdId: HouseholdId;
  veterinarianId: ProviderId;
  veterinarianUserId: UserId;
  encounterType: EncounterType;
  presentingComplaint: string;
  ownerReportedHistory?: string;
}

export interface RecordVitalsCommand {
  encounterId: EncounterId;
  recordedByUserId: UserId;
  vitals: Omit<VitalsMeasurement, 'recordedByUserId' | 'recordedByName' | 'recordedByRole' | 'recordedAt'>;
}

export interface RecordPhysicalExamCommand {
  encounterId: EncounterId;
  recordedByUserId: UserId;
  systems: PhysicalExamSystem[];
}

export interface RecordDiagnosesCommand {
  encounterId: EncounterId;
  veterinarianUserId: UserId;
  diagnoses: ClinicalDifferentialDiagnosis[];
  clinicalAssessmentSummary?: string;
}

export interface PrescribeMedicationCommand {
  encounterId: EncounterId;
  veterinarianUserId: UserId;
  medicationName: string;
  genericName?: string;
  form: MedicationForm;
  strength: string;
  dosageQuantity: number;
  dosageUnit: string;
  route: MedicationRoute;
  frequency: string;
  durationDays: number;
  refillsAllowed: number;
  instructions: string;
  warningLabels: string[];
}

export interface OrderDiagnosticCommand {
  encounterId: EncounterId;
  orderedByUserId: UserId;
  testType: DiagnosticTestType;
  testName: string;
  specimenSource?: string;
  clinicalIndication: string;
}

export interface RecordCarePlanCommand {
  encounterId: EncounterId;
  veterinarianUserId: UserId;
  title: string;
  ownerInstructions: string;
  dietaryGuidance?: string;
  activityRestrictions?: ActivityRestrictionLevel;
  activityRestrictionDays?: number;
  woundCareInstructions?: string;
  warningSignsEmergency: string[];
  recheckRequired: boolean;
  recheckDate?: string;
}

export interface SignAndFinalizeEncounterCommand {
  encounterId: EncounterId;
  veterinarianUserId: UserId;
  veterinarianProviderId: ProviderId;
  statementOfResponsibility?: string;
}

export interface SubmitRecordCorrectionCommand {
  petId: PetId;
  householdId: HouseholdId;
  requestedByUserId: UserId;
  targetRecordType: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION' | 'ENCOUNTER' | 'PROCEDURE';
  targetRecordId: string;
  correctionReason: string;
}

export interface ReviewRecordCorrectionCommand {
  requestId: ClinicalRecordCorrectionRequestId;
  veterinarianUserId: UserId;
  approved: boolean;
  clinicianResponse: string;
  amendedFields?: Record<string, unknown>;
}

export interface CreateVeterinaryReferralCommand {
  sourceClinicId: BusinessId;
  destinationClinicId: BusinessId;
  petId: PetId;
  referringVeterinarianId: ProviderId;
  specialtyRequested: string;
  clinicalSummary: string;
  urgency: ReferralUrgency;
  sharedRecordIds: string[];
  ownerConsentConfirmed: boolean;
}
