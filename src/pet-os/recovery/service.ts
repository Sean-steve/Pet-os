/**
 * Pet OS Sprint 15 - Geofencing & Lost Pet Recovery Platform Service
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
  asSafeZoneId,
  asGeofenceTransitionEventId,
  asLostPetIncidentId,
  asLostPetSightingId,
  asPublicRecoveryProfileId,
  asContactRelaySessionId,
  asTagTokenId,
  generateUUIDv7
} from '../kernel/ids';
import { createEventEnvelope, EventEnvelope } from '../kernel/events';
import {
  SafeZone,
  SafeZoneType,
  GeofenceTransitionEvent,
  LostPetIncident,
  LostPetIncidentStatus,
  PublicRecoveryProfile,
  LostPetSighting,
  SightingChannel,
  ContactRelaySession,
  CoarseSearchArea
} from './types';
import { RecoveryStore } from './store';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';

// Haversine distance in meters
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class RecoveryService {
  private static instance: RecoveryService;
  private store: RecoveryStore;

  // Domain event listeners for decoupling and outbox
  private eventListeners: Array<(event: EventEnvelope) => void> = [];

  private constructor() {
    this.store = RecoveryStore.getInstance();
  }

  public static getInstance(): RecoveryService {
    if (!RecoveryService.instance) {
      RecoveryService.instance = new RecoveryService();
    }
    return RecoveryService.instance;
  }

  public addEventListener(listener: (event: EventEnvelope) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(event: EventEnvelope): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in recovery event listener:', err);
      }
    }
  }

  // ============================================================================
  // GEOFENCING & SAFE ZONES
  // ============================================================================

  public createSafeZone(params: {
    householdId: HouseholdId;
    petId: PetId;
    name: string;
    zoneType: SafeZoneType;
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
    hysteresisBufferMeters?: number;
    alertOnExit?: boolean;
    alertOnEntry?: boolean;
  }): SafeZone {
    const id = asSafeZoneId(generateUUIDv7());
    const safeZone: SafeZone = {
      safeZoneId: id,
      householdId: params.householdId,
      petId: params.petId,
      name: params.name,
      zoneType: params.zoneType,
      centerLatitude: params.centerLatitude,
      centerLongitude: params.centerLongitude,
      radiusMeters: params.radiusMeters,
      hysteresisBufferMeters: params.hysteresisBufferMeters ?? 25,
      isActive: true,
      alertOnExit: params.alertOnExit ?? true,
      alertOnEntry: params.alertOnEntry ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.safeZones.set(id, safeZone);
    return safeZone;
  }

  public evaluateGeofenceTransitions(params: {
    petId: PetId;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  }): GeofenceTransitionEvent[] {
    const zones = this.store.getSafeZonesByPetId(params.petId);
    const events: GeofenceTransitionEvent[] = [];

    for (const zone of zones) {
      const distance = haversineDistanceMeters(
        params.latitude,
        params.longitude,
        zone.centerLatitude,
        zone.centerLongitude
      );

      // Check exit with hysteresis
      const exitThreshold = zone.radiusMeters + zone.hysteresisBufferMeters;
      const isOutside = distance > exitThreshold;

      if (isOutside && zone.alertOnExit) {
        const transitionId = asGeofenceTransitionEventId(generateUUIDv7());
        const event: GeofenceTransitionEvent = {
          transitionId,
          safeZoneId: zone.safeZoneId,
          petId: params.petId,
          householdId: zone.householdId,
          transitionType: 'EXIT',
          timestamp: new Date().toISOString(),
          latitude: params.latitude,
          longitude: params.longitude,
          accuracyMeters: params.accuracyMeters,
          suppressedByHysteresis: false,
        };
        this.store.geofenceEvents.set(transitionId, event);
        events.push(event);

        this.emitEvent(
          createEventEnvelope(
            'GeofenceExited',
            'SafeZone',
            zone.safeZoneId,
            { petId: params.petId, safeZoneId: zone.safeZoneId, distanceMeters: distance },
            1,
            undefined,
            undefined,
            zone.householdId
          )
        );
      }
    }

    return events;
  }

  // ============================================================================
  // LOST PET INCIDENT LIFECYCLE
  // ============================================================================

  public reportLostPetIncident(params: {
    householdId: HouseholdId;
    reportedByUserId: UserId;
    petId: PetId;
    missingSince: string;
    lastKnownLocation: {
      latitude: number;
      longitude: number;
      accuracyMeters?: number;
      coarseDescription: string;
    };
    coarseSearchArea: CoarseSearchArea;
    ownerInstructions: string;
    emergencyMedicalNotes?: string;
  }): { incident: LostPetIncident; recoveryProfile: PublicRecoveryProfile } {
    const pet = PetStore.findPetById(params.petId);
    if (!pet) {
      throw new Error(`Pet not found: ${params.petId}`);
    }

    const incidentId = asLostPetIncidentId(generateUUIDv7());
    const profileId = asPublicRecoveryProfileId(generateUUIDv7());
    const relaySessionId = asContactRelaySessionId(generateUUIDv7());
    const publicToken = 'rec_' + generateUUIDv7().replace(/-/g, '').substring(0, 16);

    const relaySession: ContactRelaySession = {
      sessionId: relaySessionId,
      lostPetIncidentId: incidentId,
      ownerUserId: params.reportedByUserId,
      anonymousRelayToken: 'relay_' + generateUUIDv7().replace(/-/g, '').substring(0, 12),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      messagesSentCount: 0,
    };
    this.store.contactRelaySessions.set(relaySessionId, relaySession);

    // Strictly minimized PublicRecoveryProfile:
    // NO exact tracker coordinates, NO microchip, NO household members, NO exact home street address
    const recoveryProfile: PublicRecoveryProfile = {
      profileId,
      lostPetIncidentId: incidentId,
      petId: params.petId,
      publicToken,
      petDisplayName: pet.name,
      photoUrl: (pet as any).avatarUrl || (pet as any).photoUrl,
      species: (pet as any).species || pet.speciesCode,
      breed: (pet as any).breed || pet.customBreedName || pet.breedCode || 'Mixed Breed',
      sex: pet.sex,
      coarseMissingArea: params.lastKnownLocation.coarseDescription,
      ownerInstructions: params.ownerInstructions,
      emergencyMedicalNotes: params.emergencyMedicalNotes,
      contactRelaySessionId: relaySessionId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const incident: LostPetIncident = {
      lostPetIncidentId: incidentId,
      petId: params.petId,
      householdId: params.householdId,
      reportedByUserId: params.reportedByUserId,
      status: 'ACTIVE',
      missingSince: params.missingSince,
      lastKnownLocation: params.lastKnownLocation,
      coarseSearchArea: params.coarseSearchArea,
      recoveryProfileReference: profileId,
      isCommunityAlertRequested: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.recoveryProfiles.set(profileId, recoveryProfile);
    this.store.tokenToProfileMap.set(publicToken, profileId);
    this.store.lostPetIncidents.set(incidentId, incident);

    this.emitEvent(
      createEventEnvelope(
        'LostPetIncidentReported',
        'LostPetIncident',
        incidentId,
        {
          incidentId,
          petId: params.petId,
          householdId: params.householdId,
          recoveryProfileId: profileId,
          publicToken,
        },
        1,
        undefined,
        params.reportedByUserId,
        params.householdId
      )
    );

    return { incident, recoveryProfile };
  }

  public activateCommunityAlert(incidentId: LostPetIncidentId, userId: UserId): LostPetIncident {
    const incident = this.store.lostPetIncidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    if (incident.status === 'RECOVERED' || incident.status === 'CANCELLED') {
      throw new Error(`Cannot request community alert for closed incident with status: ${incident.status}`);
    }

    incident.isCommunityAlertRequested = true;
    incident.communityAlertActivatedAt = new Date().toISOString();
    incident.updatedAt = new Date().toISOString();

    const profile = this.store.recoveryProfiles.get(incident.recoveryProfileReference);

    // Emits the canonical CommunityLostPetAlertRequested event consumed by Sprint 16
    this.emitEvent(
      createEventEnvelope(
        'CommunityLostPetAlertRequested',
        'LostPetIncident',
        incidentId,
        {
          lostPetIncidentId: incidentId,
          recoveryProfileReference: incident.recoveryProfileReference,
          publicToken: profile?.publicToken,
          petDisplayName: profile?.petDisplayName,
          species: profile?.species,
          breed: profile?.breed,
          coarseTargetArea: incident.coarseSearchArea,
          photoUrl: profile?.photoUrl,
          requestedAt: incident.communityAlertActivatedAt,
          ownerInstructions: profile?.ownerInstructions,
        },
        1,
        undefined,
        userId,
        incident.householdId
      )
    );

    return incident;
  }

  // ============================================================================
  // SIGHTINGS SUBMISSION & EXTORTION SAFEGUARDS
  // ============================================================================

  public reportSighting(params: {
    lostPetIncidentId: LostPetIncidentId;
    reporterUserId?: UserId;
    reporterName?: string;
    reporterContactMasked?: string;
    sightingTimestamp: string;
    latitude: number;
    longitude: number;
    coarseDescription: string;
    notes: string;
    photoUrl?: string;
    reportedVia: SightingChannel;
  }): LostPetSighting {
    const incident = this.store.lostPetIncidents.get(params.lostPetIncidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${params.lostPetIncidentId}`);
    }

    if (incident.status === 'RECOVERED' || incident.status === 'CANCELLED') {
      throw new Error(`Incident is closed; new sightings cannot be accepted.`);
    }

    // Anti-Scam & Extortion Analysis:
    // Check for extortion/ransom keywords
    const lowerNotes = params.notes.toLowerCase();
    const extortionKeywords = [
      'ransom',
      'send money',
      'wire funds',
      'bitcoin',
      'crypto',
      'pay me first',
      'cash reward before',
      'deposit into account',
      'western union',
      'mpesa to this number before i give',
    ];
    const flaggedExtortion = extortionKeywords.some(kw => lowerNotes.includes(kw));

    const sightingId = asLostPetSightingId(generateUUIDv7());
    const sighting: LostPetSighting = {
      sightingId,
      lostPetIncidentId: params.lostPetIncidentId,
      reporterUserId: params.reporterUserId,
      reporterName: params.reporterName,
      reporterContactMasked: params.reporterContactMasked,
      sightingTimestamp: params.sightingTimestamp,
      location: {
        latitude: params.latitude,
        longitude: params.longitude,
        coarseDescription: params.coarseDescription,
      },
      notes: params.notes,
      photoUrl: params.photoUrl,
      status: flaggedExtortion ? 'FLAGGED_ABUSIVE' : 'PENDING_REVIEW',
      confidence: flaggedExtortion ? 'LOW' : 'MEDIUM',
      reportedVia: params.reportedVia,
      flaggedExtortionAttempt: flaggedExtortion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.sightings.set(sightingId, sighting);

    this.emitEvent(
      createEventEnvelope(
        'LostPetSightingReported',
        'LostPetSighting',
        sightingId,
        {
          sightingId,
          lostPetIncidentId: params.lostPetIncidentId,
          coarseDescription: params.coarseDescription,
          flaggedExtortion,
          status: sighting.status,
        },
        1,
        undefined,
        params.reporterUserId,
        incident.householdId
      )
    );

    return sighting;
  }

  // ============================================================================
  // RECOVERY CLOSURE & PRIVACY REVOCATION
  // ============================================================================

  public confirmRecovery(params: {
    incidentId: LostPetIncidentId;
    actorUserId: UserId;
    resolutionNotes?: string;
  }): LostPetIncident {
    const incident = this.store.lostPetIncidents.get(params.incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${params.incidentId}`);
    }

    incident.status = 'RECOVERED';
    incident.recoveredAt = new Date().toISOString();
    incident.resolutionNotes = params.resolutionNotes ?? 'Pet successfully recovered safely.';
    incident.updatedAt = new Date().toISOString();

    // Revoke public recovery profile token so public links expire/fail closed
    const profile = this.store.recoveryProfiles.get(incident.recoveryProfileReference);
    if (profile) {
      profile.isActive = false;
      profile.updatedAt = new Date().toISOString();
    }

    // Revoke contact relay session
    if (profile?.contactRelaySessionId) {
      const relay = this.store.contactRelaySessions.get(profile.contactRelaySessionId);
      if (relay) {
        relay.isActive = false;
      }
    }

    // Emit LostPetRecovered and CommunityLostPetAlertClosed
    this.emitEvent(
      createEventEnvelope(
        'LostPetRecovered',
        'LostPetIncident',
        params.incidentId,
        {
          incidentId: params.incidentId,
          petId: incident.petId,
          recoveredAt: incident.recoveredAt,
        },
        1,
        undefined,
        params.actorUserId,
        incident.householdId
      )
    );

    this.emitEvent(
      createEventEnvelope(
        'CommunityLostPetAlertClosed',
        'LostPetIncident',
        params.incidentId,
        {
          lostPetIncidentId: params.incidentId,
          status: 'CLOSED',
          reason: 'RECOVERED',
          closedAt: incident.recoveredAt,
        },
        1,
        undefined,
        params.actorUserId,
        incident.householdId
      )
    );

    return incident;
  }

  // ============================================================================
  // PUBLIC QUERY PROJECTIONS
  // ============================================================================

  public getPublicRecoveryProfileByToken(token: string): PublicRecoveryProfile | null {
    const profileId = this.store.tokenToProfileMap.get(token);
    if (!profileId) return null;
    const profile = this.store.recoveryProfiles.get(profileId);
    if (!profile || !profile.isActive) return null;
    return profile;
  }

  public getIncidentById(incidentId: LostPetIncidentId): LostPetIncident | undefined {
    return this.store.lostPetIncidents.get(incidentId);
  }

  public getActiveIncidents(): LostPetIncident[] {
    return Array.from(this.store.lostPetIncidents.values()).filter(
      (i) => i.status === 'ACTIVE' || i.status === 'SEARCH_IN_PROGRESS' || i.status === 'REPORTED'
    );
  }

  public getSafeZonesForHousehold(householdId: HouseholdId): SafeZone[] {
    return Array.from(this.store.safeZones.values()).filter(
      (z) => z.householdId === householdId
    );
  }

  public getSafeZones(): SafeZone[] {
    return Array.from(this.store.safeZones.values());
  }

  public getPublicProfileById(profileId: PublicRecoveryProfileId): PublicRecoveryProfile | undefined {
    return this.store.recoveryProfiles.get(profileId);
  }

  public getSightingsForIncident(incidentId: LostPetIncidentId): LostPetSighting[] {
    return this.store.getSightingsByIncidentId(incidentId);
  }
}
