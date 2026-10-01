/**
 * Pet OS Sprint 15 - Geofencing, Safe Zones & Lost Pet Recovery Platform
 * 
 * Implements:
 * - Volume XX (Location, Geofencing & Lost-Pet Recovery Architecture)
 * - Volume XXI (QR, NFC, Microchip & Pet Identity Network)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - Volume XXXII (Kenyan Location Data Protection & Regulatory Compliance)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  SafeZoneId,
  GeofenceTransitionEventId,
  LostPetIncidentId,
  LostPetSightingId,
  PublicRecoveryProfileId,
  TagTokenId,
  ContactRelaySessionId,
} from '../kernel/ids';

export type SafeZoneType = 'HOME' | 'PARK' | 'DAYCARE' | 'VET_CLINIC' | 'CUSTOM';

export interface SafeZone {
  safeZoneId: SafeZoneId;
  householdId: HouseholdId;
  petId: PetId;
  name: string;
  zoneType: SafeZoneType;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  hysteresisBufferMeters: number; // e.g. 25m debounce
  polygonCoordinates?: Array<{ latitude: number; longitude: number }>;
  isActive: boolean;
  alertOnExit: boolean;
  alertOnEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GeofenceTransitionType = 'ENTRY' | 'EXIT' | 'DWELL';

export interface GeofenceTransitionEvent {
  transitionId: GeofenceTransitionEventId;
  safeZoneId: SafeZoneId;
  petId: PetId;
  householdId: HouseholdId;
  transitionType: GeofenceTransitionType;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  suppressedByHysteresis: boolean;
}

export type LostPetIncidentStatus =
  | 'REPORTED'
  | 'ACTIVE'
  | 'SEARCH_IN_PROGRESS'
  | 'RECOVERED'
  | 'CANCELLED';

export interface CoarseSearchArea {
  neighborhood: string;
  district: string;
  city: string;
  county: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
}

export interface LostPetIncident {
  lostPetIncidentId: LostPetIncidentId;
  petId: PetId;
  householdId: HouseholdId;
  reportedByUserId: UserId;
  status: LostPetIncidentStatus;
  missingSince: string;
  lastKnownLocation: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    coarseDescription: string;
  };
  coarseSearchArea: CoarseSearchArea;
  recoveryProfileReference: PublicRecoveryProfileId;
  isCommunityAlertRequested: boolean;
  communityAlertActivatedAt?: string;
  recoveredAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicRecoveryProfile {
  profileId: PublicRecoveryProfileId;
  lostPetIncidentId: LostPetIncidentId;
  petId: PetId;
  publicToken: string; // opaque URL token
  petDisplayName: string;
  photoUrl?: string;
  species: string;
  breed: string;
  sex?: string;
  ageYears?: number;
  coarseMissingArea: string; // e.g., "Kileleshwa / Arboretum area, Nairobi"
  ownerInstructions: string;
  emergencyMedicalNotes?: string; // e.g., "Deaf / Needs daily medication"
  contactRelaySessionId?: ContactRelaySessionId;
  isActive: boolean;
  qrTagTokenId?: TagTokenId;
  nfcTagTokenId?: TagTokenId;
  createdAt: string;
  updatedAt: string;
}

export type SightingStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'FLAGGED_ABUSIVE';
export type SightingVerificationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type SightingChannel = 'COMMUNITY_ALERT' | 'PUBLIC_RECOVERY_PAGE' | 'QR_TAG_SCAN' | 'DIRECT';

export interface LostPetSighting {
  sightingId: LostPetSightingId;
  lostPetIncidentId: LostPetIncidentId;
  reporterUserId?: UserId; // authenticated community reporter if logged in
  reporterName?: string;
  reporterContactMasked?: string;
  sightingTimestamp: string;
  location: {
    latitude: number; // exact for owner review
    longitude: number;
    coarseDescription: string; // public safe
  };
  notes: string;
  photoUrl?: string;
  status: SightingStatus;
  confidence: SightingVerificationConfidence;
  reportedVia: SightingChannel;
  flaggedExtortionAttempt?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRelaySession {
  sessionId: ContactRelaySessionId;
  lostPetIncidentId: LostPetIncidentId;
  ownerUserId: UserId;
  anonymousRelayToken: string;
  expiresAt: string;
  isActive: boolean;
  messagesSentCount: number;
}
