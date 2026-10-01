/**
 * Pet OS Sprint 9 - Activity, Exercise & Daily Care Bounded Context Types
 * Implements:
 * - Volume III (Domain-Driven Design Architecture)
 * - Volume XI (Activity, Exercise & Daily Care)
 * - Volume XXIV & XXV (AI Safety, Boundaries & Provenance)
 * - Volume XXVIII (API & Integration Specification)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI & XXXII (Security, Privacy & Kenyan Compliance)
 * - ADR-003 (UUIDv7 for Externally Visible Primary IDs)
 * - ADR-004 (Household as Primary Access Boundary)
 * - ADR-005 (Clinical Provenance Preserved)
 * - ADR-008 (Exact Location is RESTRICTED Data: Opaque Route Reference Only)
 */

import {
  PetId,
  HouseholdId,
  UserId,
  ActivityId,
  ActivitySessionId,
  ActivityRoutineId,
  ActivityOccurrenceId,
  ActivityGoalId,
  ProviderId
} from '../kernel/ids';
import { RecurrenceRule } from '../care/types';

// ============================================================================
// TAXONOMY & ENUMS
// ============================================================================

export type ActivityType =
  | 'WALK'
  | 'RUN'
  | 'PLAY'
  | 'TRAINING'
  | 'ENRICHMENT'
  | 'SWIM'
  | 'HIKE'
  | 'FREE_EXERCISE'
  | 'REST'
  | 'OTHER';

export type ActivitySourceType =
  | 'OWNER_RECORDED'
  | 'HOUSEHOLD_CAREGIVER'
  | 'TRAINING_SESSION'
  | 'SERVICE_PROVIDER'
  | 'DEVICE_RECORDED'
  | 'IMPORTED'
  | 'SYSTEM_DERIVED';

export type DistanceMeasurementSource =
  | 'GPS_MEASURED'
  | 'DEVICE_ESTIMATED'
  | 'OWNER_ESTIMATED'
  | 'PROVIDER_RECORDED';

export type DistanceUnit = 'KILOMETERS' | 'MILES' | 'METERS';

export type ActivityIntensity = 'LIGHT' | 'MODERATE' | 'HIGH' | 'UNKNOWN';

export type ActivityLocationContext =
  | 'INDOOR'
  | 'OUTDOOR'
  | 'URBAN'
  | 'TRAIL'
  | 'DOG_PARK'
  | 'HOME'
  | 'WATER'
  | 'MIXED'
  | 'OTHER';

export type LeashStatus = 'ON_LEASH' | 'OFF_LEASH' | 'MIXED';

export type WalkPurpose =
  | 'EXERCISE'
  | 'POTTY'
  | 'TRAINING_WALK'
  | 'LEISURE'
  | 'EXPLORATION';

export type PlayType =
  | 'FETCH'
  | 'TUG'
  | 'CHASE'
  | 'ROUGHHOUSING'
  | 'SOCIAL_PLAY_DOGS'
  | 'SOLO_TOY';

export type EnrichmentType =
  | 'PUZZLE_FEEDER'
  | 'SCENT_WORK'
  | 'SUPERVISED_EXPLORATION'
  | 'COGNITIVE'
  | 'LICK_CHEW_MAT'
  | 'SENSORY_TRAIL';

export type RestType = 'REST_OBSERVED' | 'SLEEP_CONFIRMED';

export type RestEnvironment =
  | 'CRATE'
  | 'DOG_BED'
  | 'SOFA_FURNITURE'
  | 'FLOOR'
  | 'OUTDOOR_SHADE'
  | 'LAP_CARRIER';

export type ActivityVerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'ENTERED_IN_ERROR'
  | 'SUPERSEDED';

export type SessionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NEEDS_REVIEW'
  | 'ABANDONED';

export type RoutineOccurrenceStatus =
  | 'SCHEDULED'
  | 'DUE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'MISSED'
  | 'CANCELLED';

export type GoalMetricType =
  | 'WALK_COUNT'
  | 'ACTIVE_MINUTES'
  | 'TOTAL_DISTANCE'
  | 'PLAY_SESSIONS'
  | 'ROUTINE_COMPLETIONS';

export type GoalPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type ActivityGoalStatus =
  | 'ACTIVE'
  | 'CONSTRAINED'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'CANCELLED';

export type CareDomain = 'ACTIVITY' | 'NUTRITION' | 'CARE' | 'TRAINING';

// ============================================================================
// VALUE OBJECTS & SPECIALIZED ATTRIBUTES
// ============================================================================

export interface WalkDetails {
  leashStatus?: LeashStatus;
  walkPurpose?: WalkPurpose;
  weatherConditions?: string;
  incidentCount?: number;
  incidentNotes?: string;
  pacing?: 'LEISURELY' | 'BRISK' | 'INTERVAL';
}

export interface PlayEnrichmentDetails {
  playType?: PlayType;
  enrichmentType?: EnrichmentType;
  toysUsed?: string[];
  participants?: string[]; // e.g. ["Owner", "Neighbor Dog Buddy"]
  mentalChallengeLevel?: 'MILD' | 'MODERATE' | 'INTENSE';
}

export interface RestDetails {
  restType: RestType;
  environment?: RestEnvironment;
  isCrateRest: boolean;
  qualityNotes?: string;
  interruptedCount?: number;
}

// ============================================================================
// CANONICAL AGGREGATES & ENTITIES
// ============================================================================

/**
 * ActivityRecord Aggregate: Immutable, auditable record of physical activity.
 * Supports manual entries, stopwatch completion, device sync, training sessions, and provider walks.
 */
export interface ActivityRecord {
  activityId: ActivityId;
  petId: PetId;
  householdId: HouseholdId;
  activityType: ActivityType;
  sourceType: ActivitySourceType;
  sourceActorId: UserId;
  providerId?: ProviderId;
  deviceId?: string;
  
  // Timing
  startedAt: string;        // ISO 8601 UTC
  endedAt?: string;          // ISO 8601 UTC
  durationSeconds: number;   // Guaranteed non-negative, integer seconds
  
  // Measurement
  distanceValue?: number;    // Stored in requested units, null if unmeasured
  distanceUnit?: DistanceUnit;
  distanceSource?: DistanceMeasurementSource;
  stepCount?: number;        // Only when provided by device or explicit count, NEVER fabricated
  
  intensity?: ActivityIntensity;
  locationContext?: ActivityLocationContext;
  
  // Domain-specific payloads
  walkDetails?: WalkDetails;
  playDetails?: PlayEnrichmentDetails;
  restDetails?: RestDetails;
  
  notes?: string;
  evidenceId?: string;       // E.g. photo or video reference from Sprint 4
  
  // Linkages
  sourceEntityId?: string;   // E.g. TrainingSessionId, ServiceSessionId, ActivitySessionId
  routineOccurrenceId?: ActivityOccurrenceId;
  routeReference?: string;   // Opaque token linking to future Tracking bounded context (NO RAW GPS in Activity!)
  
  // Audit & Provenance
  recordedAt: string;        // Clock time when the record was registered
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
  verificationStatus: ActivityVerificationStatus;
  
  // Error correction
  enteredInErrorAt?: string;
  enteredInErrorReason?: string;
  enteredInErrorBy?: UserId;
  supersededBy?: ActivityId;
}

/**
 * ActivitySession Aggregate: Real-time active stopwatch session.
 * Enforces single active session concurrency per pet.
 */
export interface ActivitySession {
  activitySessionId: ActivitySessionId;
  petId: PetId;
  householdId: HouseholdId;
  activityType: ActivityType;
  startedAt: string;         // ISO 8601 UTC
  startedBy: UserId;
  status: SessionStatus;
  
  // Stopwatch pause tracking
  lastPausedAt?: string;
  pausedDurationSeconds: number;
  
  // Linked routine if started from scheduled occurrence
  routineOccurrenceId?: ActivityOccurrenceId;
  
  // Review / Correction for abandoned session recovery
  elapsedSecondsAtReview?: number;
  reviewedAt?: string;
  reviewedBy?: UserId;
  reviewNotes?: string;
  
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ActivityRoutine Aggregate: Recurring household care/activity expectation.
 */
export interface ActivityRoutine {
  routineId: ActivityRoutineId;
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  activityType: ActivityType;
  description?: string;
  targetDurationMinutes: number;
  targetTimeOfDay?: string;   // e.g. "07:30", "18:00" (household local)
  assignedToUserId?: UserId;  // Preferred household member
  recurrenceRule: RecurrenceRule;
  instructions?: string;      // E.g. "Use gentle leader harness, avoid school street during 3 PM"
  instructionSource?: 'OWNER_PREFERENCE' | 'PROFESSIONAL_SAFETY';
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/**
 * ActivityOccurrence Entity: Concrete, scheduled daily instance of an ActivityRoutine.
 * Supports idempotent completion and duplicate execution conflict prevention.
 */
export interface ActivityOccurrence {
  occurrenceId: ActivityOccurrenceId;
  routineId: ActivityRoutineId;
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  activityType: ActivityType;
  scheduledFor: string;       // Target date/time (ISO 8601 UTC)
  targetTimeOfDay?: string;
  targetDurationMinutes: number;
  status: RoutineOccurrenceStatus;
  assignedToUserId?: UserId;
  
  // Completion
  completedAt?: string;
  completedBy?: UserId;
  completedActivityRecordId?: ActivityId;
  
  // Skip
  skippedAt?: string;
  skippedBy?: UserId;
  skipReason?: string;
  
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ActivityGoal Aggregate: Defined activity targets with veterinary safety constraints.
 */
export interface ActivityGoal {
  goalId: ActivityGoalId;
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  metricType: GoalMetricType;
  targetValue: number;
  unit: 'COUNT' | 'MINUTES' | 'KILOMETERS' | 'MILES';
  period: GoalPeriod;
  sourceType: 'OWNER_DEFINED' | 'PROFESSIONAL_DEFINED' | 'SYSTEM_TEMPLATE';
  sourceActorId?: UserId;
  startsAt: string;
  endsAt?: string;
  status: ActivityGoalStatus;
  
  // Veterinary constraint & safety protection
  isMedicallyConstrained: boolean;
  medicalRestrictionReason?: string;
  linkedConditionId?: string;
  linkedEncounterId?: string;
  
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

/**
 * ActivityGoalProgress Read Model: Period-level progress calculation.
 */
export interface ActivityGoalProgress {
  goalId: ActivityGoalId;
  petId: PetId;
  title: string;
  metricType: GoalMetricType;
  period: GoalPeriod;
  periodStart: string;
  periodEnd: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  isAchieved: boolean;
  isMedicallyConstrained: boolean;
  medicalRestrictionReason?: string;
}

// ============================================================================
// DAILY CARE AGGREGATOR READ MODELS
// ============================================================================

/**
 * DailyCareItem: Cross-domain unified representation of today's household care responsibilities.
 * Aggregates Activity, Nutrition, Care, and Training tasks into a single actionable view.
 */
export interface DailyCareItem {
  itemId: string;
  petId: PetId;
  householdId: HouseholdId;
  sourceDomain: CareDomain;
  sourceEntityId: string;
  itemType: string;
  title: string;
  scheduledFor: string;
  targetTimeOfDay?: string;
  dueState: 'UPCOMING' | 'DUE' | 'OVERDUE' | 'COMPLETED' | 'SKIPPED';
  assignedToUserId?: UserId;
  assignedToName?: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: UserId;
  completedByName?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionRoute: string; // Navigation route e.g. '/activity', '/nutrition', '/care', '/training'
  instructions?: string;
}

/**
 * HouseholdCareSummary: "Who did what today?" view across household members.
 */
export interface HouseholdCareSummary {
  householdId: HouseholdId;
  date: string; // YYYY-MM-DD
  totalTasksScheduled: number;
  totalTasksCompleted: number;
  completionRatePercent: number;
  memberBreakdown: Array<{
    userId: UserId;
    userName: string;
    completedCount: number;
    assignedPendingCount: number;
  }>;
  unassignedPendingCount: number;
}

/**
 * CaregiverHandoffSummary: Read model for dog walkers, pet sitters, and guest caregivers.
 */
export interface CaregiverHandoffSummary {
  petId: PetId;
  petName: string;
  householdId: HouseholdId;
  generatedAt: string;
  activeMedicalRestrictions: string[];
  dietaryNotes: string[];
  scheduledTasksRemaining: DailyCareItem[];
  completedTasksToday: DailyCareItem[];
  emergencyContact: {
    primaryOwnerName: string;
    contactNote: string;
  };
}

/**
 * WeeklyActivitySummary: Factual, objective weekly activity report without fake health scores.
 */
export interface WeeklyActivitySummary {
  petId: PetId;
  weekStart: string;
  weekEnd: string;
  totalWalksCount: number;
  totalActiveMinutes: number;
  
  // Measured distance transparency (explicitly calls out unmeasured vs measured walks)
  totalDistanceRecordedKm: number;
  walksWithMeasuredDistanceCount: number;
  walksWithoutDistanceCount: number;
  distanceTransparencyNotice: string;
  
  playSessionsCount: number;
  playMinutes: number;
  trainingSessionMinutesContributed: number;
  enrichmentCount: number;
  routineAdherencePercent: number;
  
  // Provenance breakdown
  sourceBreakdown: {
    ownerRecordedMinutes: number;
    caregiverMinutes: number;
    trainingSessionMinutes: number;
    deviceRecordedMinutes: number;
    providerMinutes: number;
  };
  
  // Strictly objective notice
  scientificDisclaimer: string;
}

// ============================================================================
// AUDIT & AMENDMENT
// ============================================================================

export interface ActivityAuditAmendment {
  amendmentId: string;
  activityId: ActivityId;
  petId: PetId;
  amendedBy: UserId;
  amendedAt: string;
  action: 'ENTERED_IN_ERROR' | 'SUPERSEDED' | 'MANUAL_CORRECTION';
  reason: string;
  previousSnapshot: Record<string, unknown>;
}

// ============================================================================
// CONTRACTS WITH FUTURE SPRINT DOMAINS
// ============================================================================

/**
 * Contract for Sprint 13 (Dog Walking Platform).
 * Activity accepts completed walk session payloads with service provenance.
 */
export interface DogWalkerActivityContract {
  serviceSessionId: string;
  providerId: ProviderId;
  walkerUserId: UserId;
  petId: PetId;
  householdId: HouseholdId;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  distanceKm?: number;
  routeReference?: string;
  incidentCount: number;
  incidentNotes?: string;
  walkerNotes?: string;
}

/**
 * Contract for Sprint 19/20 (Tracking & IoT Telemetry).
 * Activity consumes reduced activity summaries; precise lat/lng remains in Tracking.
 */
export interface TrackingActivitySummaryContract {
  deviceId: string;
  petId: PetId;
  householdId: HouseholdId;
  timeWindowStart: string;
  timeWindowEnd: string;
  activeMinutes: number;
  stepCount?: number;
  distanceMeters?: number;
  confidenceScore: number; // 0.0 to 1.0
  routeReference?: string; // Opaque reference to Tracking route
}

/**
 * Reconciliation between device-recorded and manual activity.
 */
export interface ActivityReconciliationContract {
  manualActivityId: ActivityId;
  deviceRecordId: string;
  reconciliationStatus: 'POSSIBLE_DUPLICATE' | 'LINKED' | 'MERGED' | 'SEPARATE';
  overlapDurationSeconds: number;
  reconciledBy?: UserId;
}

// ============================================================================
// COMMANDS (Write contracts)
// ============================================================================

export interface RecordActivityCommand {
  petId: PetId;
  householdId: HouseholdId;
  activityType: ActivityType;
  sourceType?: ActivitySourceType;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  distanceValue?: number;
  distanceUnit?: DistanceUnit;
  distanceSource?: DistanceMeasurementSource;
  stepCount?: number;
  intensity?: ActivityIntensity;
  locationContext?: ActivityLocationContext;
  walkDetails?: WalkDetails;
  playDetails?: PlayEnrichmentDetails;
  restDetails?: RestDetails;
  notes?: string;
  evidenceId?: string;
  routineOccurrenceId?: ActivityOccurrenceId;
  routeReference?: string;
  sourceEntityId?: string;
}

export interface StartActivitySessionCommand {
  petId: PetId;
  householdId: HouseholdId;
  activityType: ActivityType;
  routineOccurrenceId?: ActivityOccurrenceId;
  notes?: string;
}

export interface CompleteActivitySessionCommand {
  activitySessionId: ActivitySessionId;
  notes?: string;
  distanceValue?: number;
  distanceUnit?: DistanceUnit;
  walkDetails?: WalkDetails;
  playDetails?: PlayEnrichmentDetails;
}

export interface RecoverAbandonedSessionCommand {
  activitySessionId: ActivitySessionId;
  actualDurationSeconds: number;
  reviewNotes: string;
  notes?: string;
}

export interface CreateActivityRoutineCommand {
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  activityType: ActivityType;
  description?: string;
  targetDurationMinutes: number;
  targetTimeOfDay?: string;
  assignedToUserId?: UserId;
  recurrenceRule: RecurrenceRule;
  instructions?: string;
  instructionSource?: 'OWNER_PREFERENCE' | 'PROFESSIONAL_SAFETY';
}

export interface CompleteRoutineOccurrenceCommand {
  occurrenceId: ActivityOccurrenceId;
  durationSeconds?: number;
  distanceKm?: number;
  notes?: string;
}

export interface CreateActivityGoalCommand {
  petId: PetId;
  householdId: HouseholdId;
  title: string;
  metricType: GoalMetricType;
  targetValue: number;
  unit: 'COUNT' | 'MINUTES' | 'KILOMETERS' | 'MILES';
  period: GoalPeriod;
  startsAt?: string;
}
