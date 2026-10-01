/**
 * Pet OS Sprint 22 — Pet Transport Professional Workspace
 * Domain Types, Enums, Aggregate Definitions, and Contracts
 */

import {
  UserId,
  HouseholdId,
  PetId,
  ProviderId,
  BusinessId,
  BookingId,
  TransportDriverProfileId,
  TransportVehicleId,
  TransportTripId,
  TransportTripPetId,
  TransportStopId,
  TransportLegId,
  TransportCustodyRecordId,
  TransportInstructionSnapshotId,
  TransportContainmentAssignmentId,
  TransportDelayId,
  TransportEnvironmentObservationId,
  TransportSafetyAlertId,
  TransportIncidentId,
  TransportHandoverRecordId,
  TransportCompletionEvidenceId,
  TransportBelongingItemId,
} from '../kernel/ids';

// ==========================================
// DRIVER DOMAIN TYPES
// ==========================================

export type DriverOperationalStatus =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'INACTIVE';

export type DriverVerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REJECTED';

export type TransportServiceType =
  | 'ONE_WAY'
  | 'RETURN'
  | 'MULTI_STOP'
  | 'WAIT_AND_RETURN'
  | 'FACILITY_TRANSFER'
  | 'RESCUE_TRANSFER'
  | 'VET_TRANSFER'
  | 'OTHER_APPROVED';

export interface TransportDriverProfile {
  driverProfileId: TransportDriverProfileId;
  userId: UserId;
  providerId: ProviderId;
  businessId: BusinessId;
  fullName: string;
  phoneNumberMasked: string;
  operationalStatus: DriverOperationalStatus;
  verificationStatus: DriverVerificationStatus;
  drivingLicenseRefMasked: string;
  approvedServiceTypes: TransportServiceType[];
  assignedVehicleId?: TransportVehicleId;
  verificationDate?: string;
  verifiedByUserId?: UserId;
  currentActiveTripId?: TransportTripId;
  emergencyContact: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// VEHICLE DOMAIN TYPES
// ==========================================

export type VehicleType =
  | 'CAR'
  | 'VAN'
  | 'SPECIALIZED_PET_VAN'
  | 'OTHER_APPROVED';

export type VehicleOperationalStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'MAINTENANCE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'RETIRED';

export type VehicleVerificationStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'REJECTED';

export type ContainmentCapability =
  | 'CRATE'
  | 'CARRIER'
  | 'SEPARATED_COMPARTMENT'
  | 'HARNESS_RESTRAINT'
  | 'OTHER_CANONICAL';

export type SensorCapability =
  | 'TEMPERATURE_CARGO'
  | 'HUMIDITY_CARGO'
  | 'VENTILATION_MONITOR';

export interface VehicleCrateSlot {
  slotId: string;
  slotName: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
  capability: ContainmentCapability;
  occupiedByPetId?: PetId;
}

export interface VehicleCapacity {
  maxPets: number;
  maxWeightKg: number;
  allowedSpecies: ('DOG' | 'CAT' | 'BIRD' | 'SMALL_MAMMAL')[];
  crateSlots: VehicleCrateSlot[];
}

export interface TransportVehicle {
  vehicleId: TransportVehicleId;
  businessId: BusinessId;
  providerId: ProviderId;
  displayName: string;
  registrationNumber: string;
  makeModel: string;
  vehicleType: VehicleType;
  operationalStatus: VehicleOperationalStatus;
  verificationStatus: VehicleVerificationStatus;
  capacity: VehicleCapacity;
  sensorCapabilities: SensorCapability[];
  activeTripId?: TransportTripId;
  lastInspectionDate: string;
  insuranceValidUntil: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// TRIP AND STOP MODELS
// ==========================================

export type TripStatus =
  | 'SCHEDULED'
  | 'READY'
  | 'DRIVER_EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'PICKUP_VERIFICATION'
  | 'PET_IN_CUSTODY'
  | 'IN_TRANSIT'
  | 'STOP_IN_PROGRESS'
  | 'ARRIVED_AT_DESTINATION'
  | 'HANDOVER_PENDING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'CANCELLED'
  | 'INCIDENT_ACTIVE';

export type TransportStopType =
  | 'PICKUP'
  | 'DROP_OFF'
  | 'VETERINARY_STOP'
  | 'BOARDING_STOP'
  | 'GROOMING_STOP'
  | 'RESCUE_STOP'
  | 'REST_STOP'
  | 'TRANSFER_STOP'
  | 'RETURN_ORIGIN_STOP';

export type TransportStopStatus =
  | 'PENDING'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'ACTION_REQUIRED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'FAILED';

export interface TransportStop {
  stopId: TransportStopId;
  tripId: TransportTripId;
  sequence: number;
  stopType: TransportStopType;
  title: string;
  addressPublicSnippet: string; // Public safe area e.g. "Kilimani, Nairobi"
  exactAddressEncrypted: string; // Only decipherable during authorized pre-trip window
  addressAccessWindowStartIso: string;
  addressAccessWindowEndIso: string;
  scheduledArrival: string;
  actualArrival?: string;
  scheduledDeparture?: string;
  actualDeparture?: string;
  recipientContactName: string;
  recipientContactPhoneMasked: string;
  status: TransportStopStatus;
  petIdsBoarding: PetId[];
  petIdsExiting: PetId[];
  requiredActions: string[];
  notes?: string;
}

export type TransportCustodyStatus =
  | 'OWNER'
  | 'DRIVER'
  | 'INTERMEDIATE_PROVIDER'
  | 'RECIPIENT'
  | 'RELEASED'
  | 'LOST_INCIDENT';

export interface TransportTripPet {
  tripPetId: TransportTripPetId;
  tripId: TransportTripId;
  petId: PetId;
  petName: string;
  speciesCode: string;
  sizeClassification: string;
  containmentAssignment?: TransportPetContainmentAssignment;
  custodyStatus: TransportCustodyStatus;
  currentCustodianUserId: UserId;
  boardStopSequence: number;
  exitStopSequence: number;
  handoverEvidenceId?: TransportHandoverRecordId;
  notes?: string;
}

export interface TransportTrip {
  tripId: TransportTripId;
  bookingId: BookingId;
  householdId: HouseholdId;
  businessId: BusinessId;
  providerId: ProviderId;
  assignedDriverId?: TransportDriverProfileId;
  assignedVehicleId?: TransportVehicleId;
  status: TripStatus;
  tripType: TransportServiceType;
  pets: TransportTripPet[];
  stops: TransportStop[];
  scheduledPickupAt: string;
  actualPickupAt?: string;
  scheduledCompletionAt: string;
  actualCompletionAt?: string;
  timezone: string;
  trackingSessionId?: string;
  routeReference?: string;
  currentStopSequence: number;
  overallCustodyStatus: TransportCustodyStatus;
  activeIncidentCount: number;
  instructionSnapshotIds: TransportInstructionSnapshotId[];
  offlineQueuePending?: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ==========================================
// INSTRUCTIONS & HEALTH DATA MINIMIZATION
// ==========================================

export interface TransportInstructionSnapshot {
  snapshotId: TransportInstructionSnapshotId;
  tripId: TransportTripId;
  petId: PetId;
  petName: string;
  species: string;
  breed: string;
  sizeClassification: string;
  pickupInstructions: string;
  destinationInstructions: string;
  authorizedRecipientName: string;
  authorizedRecipientPhoneMasked: string;
  emergencyContactPhone: string;
  // Minimum Necessary Health Data Only:
  mobilityAssistanceNotes?: string;
  motionSicknessWarning?: boolean;
  transportRestrictions?: string[];
  criticalMedicationTiming?: {
    medicationName: string;
    scheduledTime: string;
    instructions: string;
  }[];
  crateOrCarrierRequirements?: string;
  feedingHydrationInstructions?: string;
  capturedAt: string;
  versionRef: string;
}

// ==========================================
// CONTAINMENT ASSIGNMENT
// ==========================================

export interface TransportPetContainmentAssignment {
  assignmentId: TransportContainmentAssignmentId;
  tripId: TransportTripId;
  petId: PetId;
  vehicleId: TransportVehicleId;
  slotId: string;
  containmentType: ContainmentCapability;
  providedBy: 'OWNER' | 'PROVIDER';
  confirmedAt?: string;
  confirmedByDriverId?: TransportDriverProfileId;
}

// ==========================================
// CHAIN OF CUSTODY & HANDOVER
// ==========================================

export type RecipientVerificationMethod =
  | 'OWNER_PIN'
  | 'ID_DOCUMENT'
  | 'RESCUE_STAFF_BADGE'
  | 'CLINIC_STAFF_BADGE'
  | 'AUTHORIZED_CONTACT_CODE'
  | 'ALTERNATE_RECIPIENT_AUTHORIZATION';

export interface TransportCustodyRecord {
  custodyRecordId: TransportCustodyRecordId;
  tripId: TransportTripId;
  petId: PetId;
  fromActorUserId: UserId;
  fromActorRole: string;
  toActorUserId: UserId;
  toActorRole: string;
  stopId: TransportStopId;
  transferredAt: string;
  verificationMethod: RecipientVerificationMethod;
  notes?: string;
  immutableSignature: string;
}

export interface TransportHandoverRecord {
  handoverId: TransportHandoverRecordId;
  tripId: TransportTripId;
  stopId: TransportStopId;
  petId: PetId;
  recipientName: string;
  recipientRole: string;
  recipientUserId?: UserId;
  verificationMethod: RecipientVerificationMethod;
  verifiedAt: string;
  belongingsHandedOver: string[];
  recipientSignatureOrOtp: string;
  notes?: string;
}

// ==========================================
// DELAYS & ROUTE PROGRESS
// ==========================================

export type DelayReason =
  | 'TRAFFIC'
  | 'WEATHER'
  | 'VEHICLE_ISSUE'
  | 'FACILITY_DELAY'
  | 'PET_WELFARE_STOP'
  | 'ROAD_INCIDENT'
  | 'OTHER';

export interface TransportDelay {
  delayId: TransportDelayId;
  tripId: TransportTripId;
  recordedAt: string;
  recordedByDriverId: TransportDriverProfileId;
  reason: DelayReason;
  delayMinutes: number;
  revisedEta: string;
  notes?: string;
}

// ==========================================
// ENVIRONMENTAL SENSORS & SAFETY ALERTS
// ==========================================

export interface TransportEnvironmentObservation {
  observationId: TransportEnvironmentObservationId;
  tripId: TransportTripId;
  vehicleId: TransportVehicleId;
  sensorId: string;
  observationType: 'CARGO_TEMPERATURE' | 'CARGO_HUMIDITY' | 'VENTILATION_STATE';
  value: number;
  unit: 'CELSIUS' | 'PERCENT' | 'BOOLEAN';
  observedAt: string;
  receivedAt: string;
  source: 'VEHICLE_SENSOR_TELEMATICS' | 'MANUAL_CALIBRATION';
  quality: 'GOOD' | 'DEGRADED' | 'FAILED';
}

export interface TransportSafetyAlert {
  alertId: TransportSafetyAlertId;
  tripId: TransportTripId;
  observationId?: TransportEnvironmentObservationId;
  alertType: 'TEMPERATURE_HIGH' | 'TEMPERATURE_LOW' | 'HUMIDITY_HIGH';
  thresholdValue: number;
  observedValue: number;
  message: string;
  raisedAt: string;
  acknowledgedAt?: string;
}

// ==========================================
// FACTUAL PET WELFARE CHECKS
// ==========================================

export interface TransportWelfareCheck {
  checkId: string;
  tripId: TransportTripId;
  petId: PetId;
  checkedAt: string;
  checkedByDriverId: TransportDriverProfileId;
  responsiveness: 'ALERT' | 'RESTING' | 'VISIBLE_DISTRESS';
  hydrationOffered: boolean;
  waterConsumedObserved: boolean;
  containmentIntact: boolean;
  factualNotes?: string;
}

// ==========================================
// INCIDENTS & EMERGENCIES
// ==========================================

export type IncidentCategory =
  | 'VEHICLE_BREAKDOWN'
  | 'ROAD_ACCIDENT'
  | 'PET_ESCAPE'
  | 'PET_INJURY_OBSERVED'
  | 'PET_ILLNESS_OBSERVED'
  | 'PET_DISTRESS_OBSERVED'
  | 'CONTAINMENT_FAILURE'
  | 'DRIVER_UNAVAILABLE'
  | 'ROUTE_BLOCKED'
  | 'ENVIRONMENTAL_ALERT'
  | 'HANDOVER_FAILURE'
  | 'WRONG_PET_ATTEMPT'
  | 'SECURITY_INCIDENT'
  | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type IncidentState =
  | 'OPEN'
  | 'MITIGATING'
  | 'ESCALATED'
  | 'OWNER_NOTIFIED'
  | 'TRANSFER_IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface TransportIncident {
  incidentId: TransportIncidentId;
  tripId: TransportTripId;
  category: IncidentCategory;
  severity: IncidentSeverity;
  state: IncidentState;
  petIds: PetId[];
  reportedAt: string;
  reportedByDriverId: TransportDriverProfileId;
  description: string;
  actionTaken: string;
  lastKnownTrackingRef?: string;
  lostPetCaseId?: string;
  emergencyClinicId?: string;
  replacementVehicleId?: TransportVehicleId;
  replacementDriverId?: TransportDriverProfileId;
  resolutionNotes?: string;
  resolvedAt?: string;
}

// ==========================================
// BELONGINGS IN TRANSIT
// ==========================================

export interface TransportBelongingItem {
  itemId: TransportBelongingItemId;
  tripId: TransportTripId;
  petId: PetId;
  description: string;
  category: 'CRATE' | 'MEDICATION' | 'FOOD_WATER' | 'LEAD_HARNESS' | 'DOCUMENT' | 'OTHER';
  acceptedAtPickup: boolean;
  releasedAtHandover: boolean;
}

// ==========================================
// COMPLETION EVIDENCE
// ==========================================

export interface TransportCompletionEvidence {
  completionEvidenceId: TransportCompletionEvidenceId;
  tripId: TransportTripId;
  bookingId: BookingId;
  driverId: TransportDriverProfileId;
  vehicleId: TransportVehicleId;
  petIds: PetId[];
  actualStartAt: string;
  actualEndAt: string;
  routeReference: string;
  totalStopsCompleted: number;
  allPetsAccountedFor: boolean;
  incidentsCount: number;
  custodySignoffCount: number;
  verifiedAt: string;
}

// ==========================================
// READINESS CHECK RESULT
// ==========================================

export interface TransportReadinessResult {
  isReady: boolean;
  blockers: string[];
  warnings: string[];
  checkedAt: string;
}

// ==========================================
// OWNER LIVE TRIP PROJECTION
// ==========================================

export interface OwnerTripLiveProjection {
  tripId: TransportTripId;
  status: TripStatus;
  petNames: string[];
  driverName: string;
  driverPhoneRelay: string;
  vehicleDescription: string;
  currentStopName: string;
  nextStopName?: string;
  eta: string;
  overallCustody: TransportCustodyStatus;
  trackingFreshness: 'LIVE' | 'STALE' | 'OFFLINE_UNAVAILABLE';
  lastLocationTimestampIso?: string;
  staleMinutesElapsed?: number;
  recentDelayMessage?: string;
  hasActiveIncident: boolean;
  cargoTemperatureObservedCelsius?: number; // Only if actual sensor present
  canTrackDriverLocation: boolean; // Privacy boundary: strictly false before pickup or after destination handover
}
