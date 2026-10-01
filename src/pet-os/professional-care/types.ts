/**
 * Pet OS Sprint 21 - Groomer, Pet Sitter & Boarding Professional Workspaces Domain Types
 * 
 * Implements:
 * - Volume XIV (Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces)
 * - Volume XII (Pet Services Marketplace & Booking Handoffs)
 * - Volume XIII (Dog Walking & Care Custody Handover)
 * - Volume IX (Nutrition, Feeding & Hydration Execution)
 * - Volume VIII (Training, Handling & Behavior Observations)
 * - Volume VI (Care Occurrence Execution)
 * - Volume V (Veterinary Prescriptions & Medication Administration Boundaries)
 * - Volume XV & XX (Lost Pet Incident Escalation)
 * - Volume IV & XXXI (Security, Privacy, Home-Access Secrets & RBAC)
 * 
 * Normative Invariants:
 * 1. Do NOT duplicate canonical domain truth (Nutrition, Health, Care, Activity, Booking).
 * 2. Do NOT grant a sitter or groomer full Veterinary Health history.
 * 3. Do NOT allow a groomer or sitter to diagnose skin/ear/medical conditions.
 * 4. Do NOT infer or modify medication dosages or instructions.
 * 5. Do NOT silently modify owner care plans.
 * 6. Do NOT complete a care service merely because scheduled time expired.
 * 7. Do NOT expose home-access secrets outside the authorized service window.
 * 8. Booking = reservation/commercial intent. CareEngagement = real-world execution.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  BusinessId,
  ProviderId,
  BookingId,
  ServiceOfferingId,
  MealOccurrenceId,
  FoodId,
  CareOccurrenceId,
  MedicationId,
  ActivityId,
  TimelineEventId,
  CareEngagementId,
  CareInstructionSnapshotId,
  CareAccessGrantId,
  CareHandoverId,
  CareAccessSecretId,
  CareServiceIncidentId,
  CareCompletionEvidenceId,
  CareShiftHandoverId,
  CareServiceUpdateId,
  CareServiceObservationId,
  CareServiceMediaId,
  GroomingSessionId,
  GroomingProcedureId,
  SitterVisitId,
  BoardingStayId,
  BoardingUnitId,
  BoardingUnitAssignmentId,
  BoardingDailyLogId,
  BoardingStayExtensionId,
} from '../kernel/ids';

// ============================================================================
// SERVICE TYPES & EXECUTION STATES
// ============================================================================

export type CareServiceType =
  | 'GROOMING'
  | 'PET_SITTING_VISIT'
  | 'PET_SITTING_MULTI_VISIT'
  | 'OVERNIGHT_SITTING'
  | 'BOARDING'
  | 'DAYCARE';

export type CareEngagementStatus =
  | 'SCHEDULED'
  | 'READY_FOR_HANDOVER'
  | 'IN_CARE'
  | 'RETURN_PENDING'
  | 'COMPLETION_PENDING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'CANCELLED'
  | 'INCIDENT_ACTIVE';

export type CareCustodyStatus =
  | 'OWNER_CUSTODY'
  | 'PROVIDER_CUSTODY'
  | 'FACILITY_CUSTODY'
  | 'STAFF_CUSTODY'
  | 'RETURN_PENDING'
  | 'RETURNED';

export type CareStaffRole =
  | 'CARE_BUSINESS_OWNER'
  | 'FACILITY_MANAGER'
  | 'SENIOR_GROOMER'
  | 'GROOMER'
  | 'PET_SITTER'
  | 'BOARDING_SUPERVISOR'
  | 'KENNEL_ATTENDANT'
  | 'SHIFT_LEAD';

// ============================================================================
// SCOPED CARE ACCESS GRANTS & HOME-ACCESS SECRETS
// ============================================================================

export type CareAccessScope =
  | 'CARE_IDENTITY_READ'
  | 'CARE_INSTRUCTIONS_READ'
  | 'FEEDING_EXECUTE'
  | 'HYDRATION_EXECUTE'
  | 'MEDICATION_EXECUTE'
  | 'ACTIVITY_EXECUTE'
  | 'CARE_TASK_EXECUTE'
  | 'CARE_OBSERVATION_CREATE'
  | 'MEDIA_CREATE'
  | 'INCIDENT_CREATE'
  | 'HANDOVER_EXECUTE';

export interface CareAccessGrant {
  grantId: CareAccessGrantId;
  engagementId: CareEngagementId;
  providerId: ProviderId;
  businessId?: BusinessId;
  assignedStaffId: UserId;
  petIds: PetId[];
  scopes: CareAccessScope[];
  accessWindowStart: string; // Pre-service prep window (e.g. 2 hours prior)
  accessWindowEnd: string;   // Service end + grace period (e.g. 2 hours post)
  isActive: boolean;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
}

export type HomeAccessSecretType =
  | 'DOOR_KEYPAD_CODE'
  | 'LOCKBOX_LOCATION_CODE'
  | 'ALARM_DISARM_CODE'
  | 'GATE_REMOTE_INSTRUCTION'
  | 'CONCIERGE_KEY_PICKUP';

export interface SecretAccessAuditEntry {
  actorUserId: UserId;
  revealedAt: string;
  ipAddress?: string;
  accessReason: string;
}

export interface CareAccessSecret {
  secretId: CareAccessSecretId;
  engagementId: CareEngagementId;
  householdId: HouseholdId;
  secretType: HomeAccessSecretType;
  title: string;
  maskedDisplay: string; // e.g. "•••• 4892" or "Key in lockbox on side porch"
  encryptedValue: string; // Revealed ONLY during active service window
  instructions?: string;
  accessWindowStart: string;
  accessWindowEnd: string;
  auditLog: SecretAccessAuditEntry[];
  revoked: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// IMMUTABLE CARE INSTRUCTION SNAPSHOT
// ============================================================================

export interface CareInstructionAmendment {
  amendmentId: string;
  amendedAt: string;
  amendedBy: UserId;
  changeSummary: string;
  targetCategory: 'FEEDING' | 'MEDICATION' | 'HANDLING' | 'ACCESS' | 'EMERGENCY';
  previousValue: string;
  newValue: string;
}

export interface SnapshotMedicationItem {
  medicationId: MedicationId;
  medicationName: string;
  dosage: string;
  dosageUnit: string;
  route: string;
  scheduleTiming: string; // e.g. "Morning with food (08:00)"
  instructions: string;
  warnings: string;
}

export interface SnapshotFeedingItem {
  foodName: string;
  portionSize: string;
  frequency: string;
  specialInstructions?: string;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
  vetClinicName?: string;
  vetPhone?: string;
}

export interface CareInstructionSnapshot {
  snapshotId: CareInstructionSnapshotId;
  engagementId: CareEngagementId;
  petId: PetId;
  householdId: HouseholdId;
  capturedAt: string;
  sourceVersions: {
    petCoreVersion: number;
    nutritionPlanVersion?: number;
    carePlanVersion?: number;
  };
  feedingPlan: SnapshotFeedingItem[];
  waterInstructions: string;
  medications: SnapshotMedicationItem[];
  knownAllergies: string[];
  sensitiveAreas: string[];
  handlingNotes: string;
  toiletingPreferences: string;
  exercisePreferences: string;
  emergencyContacts: EmergencyContact[];
  groomingPreferences?: string;
  ownerSpecialInstructions?: string;
  amendments: CareInstructionAmendment[];
  isImmutable: boolean;
}

// ============================================================================
// READINESS EVALUATION
// ============================================================================

export type ReadinessCheckStatus = 'SATISFIED' | 'NOT_SATISFIED' | 'UNKNOWN' | 'REQUIRES_REVIEW';

export interface CareReadinessItem {
  code:
    | 'BOOKING_CONFIRMED'
    | 'PROVIDER_VETTED'
    | 'PET_IDENTIFIED'
    | 'INSTRUCTIONS_SNAPSHOT_CAPTURED'
    | 'ACCESS_GRANT_ACTIVE'
    | 'EMERGENCY_CONTACT_PROVIDED'
    | 'MEDICATION_INSTRUCTIONS_CLEAR'
    | 'FEEDING_PLAN_READY'
    | 'FACILITY_CAPACITY_CONFIRMED'
    | 'VACCINATIONS_VERIFIED';
  status: ReadinessCheckStatus;
  message: string;
  blocking: boolean;
}

export interface CareReadinessEvaluation {
  isReadyForService: boolean;
  evaluatedAt: string;
  items: CareReadinessItem[];
  blockingReasons: string[];
}

// ============================================================================
// PET HANDOVER & CUSTODY
// ============================================================================

export type HandoverType =
  | 'OWNER_TO_PROVIDER'
  | 'OWNER_TO_FACILITY'
  | 'PROVIDER_TO_OWNER'
  | 'FACILITY_TO_OWNER'
  | 'STAFF_TO_STAFF'
  | 'HOME_ACCESS_ENTRY'
  | 'HOME_ACCESS_EXIT';

export interface HandoverSafetyChecklist {
  collarAndTagVerified: boolean;
  leashOrCarrierSecure: boolean;
  petPhysicalStateObserved: boolean;
  personalBelongingsTransferred: boolean; // food, harness, medication container
  emergencyContactConfirmed: boolean;
}

export interface CareHandover {
  handoverId: CareHandoverId;
  engagementId: CareEngagementId;
  petId: PetId;
  handoverType: HandoverType;
  fromActorId: UserId;
  toActorId: UserId;
  timestamp: string;
  verificationMethod: 'MUTUAL_CONFIRMATION' | 'ONE_TIME_CODE' | 'QR_SCAN' | 'SECURE_PIN';
  verificationCode?: string;
  checklist: HandoverSafetyChecklist;
  notes?: string;
  recipientName: string;
  recipientPhone?: string;
  verified: boolean;
}

// ============================================================================
// FACTUAL CARE OBSERVATIONS (STRICT MEDICAL BOUNDARY)
// ============================================================================

export type ObservationCategory =
  | 'FEEDING'
  | 'HYDRATION'
  | 'TOILETING'
  | 'REST_SLEEP'
  | 'BEHAVIOR_HANDLING'
  | 'COAT_SKIN'
  | 'EAR_EYE_PAW'
  | 'HOME_SAFETY'
  | 'GENERAL';

export interface CareServiceObservation {
  observationId: CareServiceObservationId;
  engagementId: CareEngagementId;
  petId: PetId;
  category: ObservationCategory;
  observationText: string;
  observedAt: string;
  recordedBy: UserId;
  severityIndicator: 'NORMAL' | 'ATTENTION_REQUIRED' | 'UNUSUAL_OBSERVATION';
  tags: string[];
}

// ============================================================================
// CARE SERVICE INCIDENTS & EMERGENCY ESCALATIONS
// ============================================================================

export type CareIncidentCategory =
  | 'PET_INJURY_OBSERVED'
  | 'PET_ILLNESS_OBSERVED'
  | 'ESCAPE'
  | 'LOST_PET'
  | 'DOG_DOG_INCIDENT'
  | 'DOG_HUMAN_INCIDENT'
  | 'MEDICATION_ERROR'
  | 'FEEDING_ERROR'
  | 'ACCESS_SECURITY_INCIDENT'
  | 'EQUIPMENT_FAILURE'
  | 'GROOMING_INJURY'
  | 'FACILITY_INCIDENT'
  | 'PROPERTY_DAMAGE'
  | 'OTHER';

export type CareIncidentSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type CareIncidentStatus =
  | 'OPEN'
  | 'OWNER_NOTIFIED'
  | 'ESCALATED'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export interface CareServiceIncident {
  incidentId: CareServiceIncidentId;
  engagementId: CareEngagementId;
  petId: PetId;
  category: CareIncidentCategory;
  severity: CareIncidentSeverity;
  status: CareIncidentStatus;
  details: string;
  actionsTaken: string[];
  ownerNotified: boolean;
  ownerNotifiedAt?: string;
  veterinaryConsulted: boolean;
  emergencyEscalated: boolean;
  lostPetAlertEmitted: boolean;
  reportedBy: UserId;
  reportedAt: string;
  resolvedAt?: string;
  resolutionSummary?: string;
}

// ============================================================================
// GROOMING WORKSPACE ENTITIES
// ============================================================================

export type GroomingProcedureType =
  | 'BATH'
  | 'DRY'
  | 'BRUSH'
  | 'DE_SHED'
  | 'TRIM'
  | 'CLIP'
  | 'NAIL_TRIM'
  | 'EAR_CLEANING'
  | 'PAW_CARE'
  | 'SANITARY_TRIM';

export interface GroomingProcedureItem {
  procedureId: GroomingProcedureId;
  procedureType: GroomingProcedureType;
  label: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface GroomingProductUsed {
  productName: string;
  productType: 'SHAMPOO' | 'CONDITIONER' | 'DETANGLER' | 'EAR_CLEANER' | 'PAW_BALM' | 'COLOGNE';
  allergensChecked: boolean;
  safeWithAllergies: boolean;
}

export interface GroomingSession {
  sessionId: GroomingSessionId;
  engagementId: CareEngagementId;
  petId: PetId;
  coatType: string; // e.g. "Double Coat", "Wire", "Short Smooth", "Curly/Poodle"
  stylingPreferences: string;
  sensitiveAreas: string[];
  handlingNotes: string;
  plannedProcedures: GroomingProcedureItem[];
  productsUsed: GroomingProductUsed[];
  observations: CareServiceObservation[];
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  safetyStopped: boolean;
  safetyStopReason?: string;
  completionSummary?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PET SITTING WORKSPACE ENTITIES
// ============================================================================

export type SitterVisitStatus =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETION_PENDING'
  | 'COMPLETED'
  | 'MISSED'
  | 'ABORTED'
  | 'CANCELLED';

export interface SitterVisit {
  visitId: SitterVisitId;
  engagementId: CareEngagementId;
  petIds: PetId[];
  visitNumber: number;
  totalVisits: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  actualCheckInAt?: string;
  actualCheckOutAt?: string;
  status: SitterVisitStatus;
  completedTasks: string[];
  observations: CareServiceObservation[];
  incidentIds: CareServiceIncidentId[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// BOARDING & DAYCARE WORKSPACE ENTITIES
// ============================================================================

export type BoardingUnitType =
  | 'KENNEL_STANDARD'
  | 'KENNEL_DELUXE'
  | 'CAT_CONDO'
  | 'PRIVATE_SUITE';

export interface BoardingUnit {
  unitId: BoardingUnitId;
  facilityId: BusinessId;
  unitNumber: string;
  unitType: BoardingUnitType;
  maxCapacity: number;
  currentOccupancy: number;
  isActive: boolean;
}

export type BoardingStayStatus =
  | 'EXPECTED'
  | 'CHECKED_IN'
  | 'ACTIVE'
  | 'EXTENSION_PENDING'
  | 'CHECKOUT_PENDING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'CANCELLED'
  | 'INCIDENT_ACTIVE';

export interface BoardingDailyCareLog {
  logId: BoardingDailyLogId;
  stayId: BoardingStayId;
  date: string; // YYYY-MM-DD
  mealsFed: number;
  waterRefreshedCount: number;
  medicationDosesAdministered: number;
  outdoorExerciseMinutes: number;
  groupPlayParticipation: boolean;
  restAndSleepObservation: string;
  dailyNotes: string;
  loggedBy: UserId;
}

export interface BoardingStay {
  stayId: BoardingStayId;
  bookingId: BookingId;
  engagementId: CareEngagementId;
  facilityId: BusinessId;
  petIds: PetId[];
  unitId: BoardingUnitId;
  unitName: string;
  scheduledCheckInAt: string;
  scheduledCheckOutAt: string;
  actualCheckInAt?: string;
  actualCheckOutAt?: string;
  status: BoardingStayStatus;
  primaryStaffId: UserId;
  incidentStatus: 'NONE' | 'ACTIVE_INCIDENT' | 'RESOLVED_INCIDENT';
  dailyLogs: BoardingDailyCareLog[];
  createdAt: string;
  updatedAt: string;
}

export interface CareShiftHandover {
  shiftHandoverId: CareShiftHandoverId;
  facilityId: BusinessId;
  outgoingStaffId: UserId;
  incomingStaffId: UserId;
  handoverTimestamp: string;
  activePetIds: PetId[];
  outstandingMeals: string[];
  medicationsDue: string[];
  openIncidents: string[];
  shiftNotes: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

// ============================================================================
// SERVICE COMPLETION EVIDENCE & OUTCOMES
// ============================================================================

export interface CareCompletionEvidence {
  evidenceId: CareCompletionEvidenceId;
  engagementId: CareEngagementId;
  petIds: PetId[];
  serviceType: CareServiceType;
  completedTasks: string[];
  feedingCount: number;
  medicationCount: number;
  activityCount: number;
  observationsCount: number;
  returnHandoverVerified: boolean;
  returnedToName: string;
  finalizedAt: string;
  outcome: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'ABORTED';
  summaryNotes: string;
}

// ============================================================================
// ROOT AGGREGATE: ProfessionalCareEngagement
// ============================================================================

export interface ProfessionalCareEngagement {
  engagementId: CareEngagementId;
  bookingId: BookingId;
  serviceType: CareServiceType;
  serviceOfferingId: ServiceOfferingId;
  householdId: HouseholdId;
  petIds: PetId[];
  providerId: ProviderId;
  businessId?: BusinessId;
  assignedStaffId: UserId;
  status: CareEngagementStatus;
  custodyStatus: CareCustodyStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  actualStartAt?: string;
  actualEndAt?: string;
  timezone: string;
  instructionSnapshotId?: CareInstructionSnapshotId;
  accessGrantId?: CareAccessGrantId;
  activeIncidentCount: number;
  completionEvidenceId?: CareCompletionEvidenceId;
  concurrencyVersion: number;
  createdAt: string;
  updatedAt: string;
}
