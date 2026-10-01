/**
 * Pet OS Sprint 13 - Dog Walking Platform Types
 * 
 * Implements:
 * - Volume XIII (Dog Walking Execution Platform)
 * - Volume XIX & XX (Safety, Incidents & Emergency Protocols)
 * - Volume XXVI (Notifications & Real-time Alerts)
 * - Volume XXVII (Identity, Custody & Access Boundaries)
 * - Volume XXIX (Events & Auditing)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI (Security, Privacy & Kenyan Location Compliance)
 * - ADR-003 (UUIDv7 Primary IDs)
 * - ADR-004 (Household as Primary Access Boundary)
 * - ADR-008 (Exact Location Privacy: Opaque Route Reference Outside Access Window)
 */

import {
  PetId,
  HouseholdId,
  UserId,
  ProviderId,
  BookingId,
  BookingAccessGrantId,
  WalkSessionId,
  HandoverId,
  WalkIncidentId,
  WalkTelemetryId,
  WalkCompletionReportId,
  WalkMediaId,
  OfflineSyncEventId,
  ActivityId,
} from '../kernel/ids';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type DogWalkStatus =
  | 'SCHEDULED'
  | 'READY_FOR_HANDOVER'
  | 'PICKUP_HANDOVER_IN_PROGRESS'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'RETURN_HANDOVER_IN_PROGRESS'
  | 'PENDING_COMPLETION_REVIEW'
  | 'COMPLETED'
  | 'ABORTED_EMERGENCY'
  | 'CANCELLED';

export type CustodyState =
  | 'CUSTODY_WITH_HOUSEHOLD'
  | 'CUSTODY_WITH_PROVIDER';

export type WalkPauseReason =
  | 'WEATHER'
  | 'FATIGUE_REST'
  | 'EQUIPMENT_ADJUSTMENT'
  | 'SAFETY_PRECAUTION'
  | 'POTTY_BREAK'
  | 'HYDRATION'
  | 'OTHER';

export type HandoverType = 'PICKUP' | 'RETURN';

export type HandoverVerificationMethod =
  | 'SECURE_OTP'
  | 'QR_CODE'
  | 'PROXIMITY_DIGITAL_SIGNATURE'
  | 'PHOTO_EVIDENCE';

export type HandoverVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'BYPASSED_WITH_OVERRIDE';

export type IncidentClassification =
  | 'OFF_LEASH_ESCAPE'
  | 'DOG_FIGHT_OR_BITE'
  | 'INJURY_OR_LAMENESS'
  | 'HEAT_EXHAUSTION'
  | 'INGESTED_HAZARD'
  | 'EQUIPMENT_FAILURE'
  | 'MEDICAL_EMERGENCY'
  | 'WEATHER_ABORT';

export type IncidentSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL_EMERGENCY';

export type IncidentStatus =
  | 'OPEN'
  | 'CONTAINED'
  | 'REFERRED_TO_VET'
  | 'RESOLVED';

export type PottyType = 'PEE' | 'POOP' | 'BOTH';

export type PoopConsistency =
  | 'NORMAL_FIRM'
  | 'SOFT'
  | 'LOOSE_WATERY'
  | 'HARD_DRY';

export type BehaviorTag =
  | 'CALM_LOOSE_LEASH'
  | 'PULLING_ON_LEASH'
  | 'REACTIVE_TO_DOGS'
  | 'PLAYFUL_AND_CURIOUS'
  | 'ANXIOUS_OR_TIMID'
  | 'HIGH_ENERGY'
  | 'SLOW_TIRED';

export type OfflineSyncEventType =
  | 'WAYPOINT_RECORDED'
  | 'POTTY_LOGGED'
  | 'BEHAVIOR_OBSERVED'
  | 'PAUSE_TOGGLED'
  | 'PHOTO_CAPTURED'
  | 'INCIDENT_FILED';

export type SyncStatus = 'QUEUED' | 'SYNCED' | 'REJECTED_CONFLICT';

// ============================================================================
// CORE AGGREGATES & ENTITIES
// ============================================================================

/**
 * DogWalkSession Aggregate: Authoritative execution state of an active dog walk.
 * Separate aggregate from Booking to ensure domain boundary decoupling.
 */
export interface DogWalkSession {
  walkSessionId: WalkSessionId;
  bookingId: BookingId;
  providerId: ProviderId;
  walkerUserId: UserId;
  householdId: HouseholdId;
  petIds: PetId[];
  
  status: DogWalkStatus;
  activeCustodyState: CustodyState;
  
  // Timing
  scheduledStartAt: string; // ISO 8601 UTC
  scheduledEndAt: string;   // ISO 8601 UTC
  scheduledDurationMinutes: number;
  actualStartedAt?: string;
  actualEndedAt?: string;
  
  // Duration tracking
  totalElapsedDurationSeconds: number;
  totalPausedDurationSeconds: number;
  lastPausedAt?: string;
  pauseReason?: WalkPauseReason;
  
  // Route & Telemetry
  routeReference: string; // Opaque token linking to waypoints
  totalDistanceMeters: number;
  stepCount?: number;
  averagePaceMinPerKm?: number;
  
  // Handover links
  pickupHandoverId?: HandoverId;
  returnHandoverId?: HandoverId;
  
  // Completion & Activity link
  completionReportId?: WalkCompletionReportId;
  activityRecordId?: ActivityId;
  
  // Security & Privacy
  accessGrantId: BookingAccessGrantId;
  concurrencyVersion: number;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Handover Checklist
 */
export interface HandoverChecklist {
  leashAndHarnessSecure: boolean;
  collarTagVerified: boolean;
  temperamentAssessed: boolean;
  waterHydrationConfirmed: boolean;
  pawsInspectedAndCleaned?: boolean;
  feedingAdministered?: boolean;
  keysReturnedOrSecured?: boolean;
}

/**
 * Handover Record: Immutable proof of custody transfer between Owner and Walker.
 */
export interface HandoverRecord {
  handoverId: HandoverId;
  walkSessionId: WalkSessionId;
  type: HandoverType;
  verificationMethod: HandoverVerificationMethod;
  verificationCode: string; // 6-digit OTP or digital token
  verificationStatus: HandoverVerificationStatus;
  transferredAt: string;
  releasingActorId: UserId;
  acceptingActorId: UserId;
  checklistConfirmed: HandoverChecklist;
  custodyFrom: CustodyState;
  custodyTo: CustodyState;
  locationMaskedReference: string;
  photoEvidenceUrl?: string;
  notes?: string;
  createdAt: string;
}

/**
 * Live GPS Telemetry Waypoint (Internal to Dog Walking domain)
 */
export interface WalkTelemetryWaypoint {
  telemetryId: WalkTelemetryId;
  walkSessionId: WalkSessionId;
  sequenceNumber: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMps?: number;
  altitudeMeters?: number;
  isSignificantWaypoint: boolean;
}

/**
 * Potty & Hydration Observation
 */
export interface WalkPottyEvent {
  eventId: string;
  walkSessionId: WalkSessionId;
  petId: PetId;
  timestamp: string;
  type: PottyType;
  poopConsistency?: PoopConsistency;
  hydrationGiven: boolean;
  notes?: string;
  photoUrl?: string;
}

/**
 * Behavioral Observation during walk
 */
export interface WalkBehaviorObservation {
  observationId: string;
  walkSessionId: WalkSessionId;
  petId: PetId;
  timestamp: string;
  tag: BehaviorTag;
  notes: string;
}

/**
 * Incident Record
 */
export interface WalkIncident {
  incidentId: WalkIncidentId;
  walkSessionId: WalkSessionId;
  petId: PetId;
  reportedBy: UserId;
  type: IncidentClassification;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  occurredAt: string;
  locationMasked: string;
  vetReferralRequired: boolean;
  vetClinicId?: string;
  emergencyContactsNotified: boolean;
  actionTaken: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

/**
 * Walk Media Evidence (Photo / Video watermarked reference)
 */
export interface WalkMedia {
  mediaId: WalkMediaId;
  walkSessionId: WalkSessionId;
  petId: PetId;
  url: string;
  caption?: string;
  timestamp: string;
  isWatermarked: boolean;
  gpsReferenceOpaque?: string;
}

/**
 * Walk Completion Report
 */
export interface WalkCompletionReport {
  reportId: WalkCompletionReportId;
  walkSessionId: WalkSessionId;
  bookingId: BookingId;
  providerId: ProviderId;
  householdId: HouseholdId;
  petIds: PetId[];
  completedAt: string;
  totalDurationMinutes: number;
  totalDistanceKm: number;
  summaryText: string;
  pottySummary: {
    peeCount: number;
    poopCount: number;
    hydrationProvided: boolean;
    consistencyNotes?: string;
  };
  behaviorNotes: string;
  mediaCount: number;
  mediaEvidence: WalkMedia[];
  returnInspectionPassed: boolean;
  ownerRating?: number;
  ownerFeedback?: string;
}

/**
 * Offline Sync Event Queue Item
 */
export interface OfflineSyncEvent {
  syncEventId: OfflineSyncEventId;
  walkSessionId: WalkSessionId;
  sequenceNumber: number;
  eventType: OfflineSyncEventType;
  payload: any;
  clientTimestamp: string;
  syncStatus: SyncStatus;
  syncedAt?: string;
}

// ============================================================================
// READINESS & VALIDATION VALUE OBJECTS
// ============================================================================

export interface PetMedicalRestriction {
  petId: PetId;
  petName: string;
  restrictionType: string;
  description: string;
  severity: 'WARNING' | 'BLOCKING';
}

export interface WalkReadinessAssessment {
  isReady: boolean;
  bookingConfirmed: boolean;
  accessGrantActive: boolean;
  walkerVerified: boolean;
  petsEligible: boolean;
  medicalClearance: boolean;
  restrictions: PetMedicalRestriction[];
  weatherAdvisory?: {
    severity: 'NORMAL' | 'CAUTION' | 'HAZARD';
    temperatureCelsius: number;
    description: string;
  };
  equipmentChecklist: Array<{ item: string; required: boolean; confirmed: boolean }>;
  rejectionReasons: string[];
  readinessScore: number; // 0 - 100
}

// ============================================================================
// PROJECTION READ MODELS
// ============================================================================

export interface OwnerLiveWalkProjection {
  walkSessionId: WalkSessionId;
  bookingId: BookingId;
  walkerDisplayName: string;
  walkerAvatarUrl?: string;
  status: DogWalkStatus;
  activeCustodyState: CustodyState;
  pets: Array<{ petId: PetId; name: string; breed?: string }>;
  scheduledWindow: { startAt: string; endAt: string; durationMinutes: number };
  actualStartedAt?: string;
  elapsedDurationFormatted: string;
  isPaused: boolean;
  pauseReason?: string;
  distanceKm: number;
  pottyEvents: WalkPottyEvent[];
  recentBehaviors: WalkBehaviorObservation[];
  recentMedia: WalkMedia[];
  latestWaypointsCount: number;
  openIncidentsCount: number;
  routeReference: string;
  canVerifyReturn: boolean;
  pickupOtp?: string; // Revealed only to owner for verification!
  returnOtp?: string;
}

export interface WalkerExecutionDashboardProjection {
  walkSessionId: WalkSessionId;
  bookingId: BookingId;
  ownerName: string;
  destinationAddressMasked: string;
  status: DogWalkStatus;
  activeCustodyState: CustodyState;
  pets: Array<{
    petId: PetId;
    name: string;
    breed?: string;
    leashNotes?: string;
    behaviorConsiderations?: string[];
  }>;
  emergencyContact: { name: string; phone: string };
  elapsedSeconds: number;
  distanceMeters: number;
  isPaused: boolean;
  offlineQueueCount: number;
  canStartPickup: boolean;
  canStartWalk: boolean;
  canCompleteWalk: boolean;
}
