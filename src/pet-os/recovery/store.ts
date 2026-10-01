/**
 * Pet OS Sprint 15 - Recovery & Geofencing In-Memory Store
 */

import {
  SafeZoneId,
  GeofenceTransitionEventId,
  LostPetIncidentId,
  LostPetSightingId,
  PublicRecoveryProfileId,
  TagTokenId,
  ContactRelaySessionId,
  PetId,
  HouseholdId
} from '../kernel/ids';
import {
  SafeZone,
  GeofenceTransitionEvent,
  LostPetIncident,
  PublicRecoveryProfile,
  LostPetSighting,
  ContactRelaySession
} from './types';

export class RecoveryStore {
  private static instance: RecoveryStore;

  public safeZones = new Map<SafeZoneId, SafeZone>();
  public geofenceEvents = new Map<GeofenceTransitionEventId, GeofenceTransitionEvent>();
  public lostPetIncidents = new Map<LostPetIncidentId, LostPetIncident>();
  public recoveryProfiles = new Map<PublicRecoveryProfileId, PublicRecoveryProfile>();
  public tokenToProfileMap = new Map<string, PublicRecoveryProfileId>();
  public sightings = new Map<LostPetSightingId, LostPetSighting>();
  public contactRelaySessions = new Map<ContactRelaySessionId, ContactRelaySession>();

  private constructor() {}

  public static getInstance(): RecoveryStore {
    if (!RecoveryStore.instance) {
      RecoveryStore.instance = new RecoveryStore();
    }
    return RecoveryStore.instance;
  }

  public clear(): void {
    this.safeZones.clear();
    this.geofenceEvents.clear();
    this.lostPetIncidents.clear();
    this.recoveryProfiles.clear();
    this.tokenToProfileMap.clear();
    this.sightings.clear();
    this.contactRelaySessions.clear();
  }

  // Queries
  public getActiveIncidentByPetId(petId: PetId): LostPetIncident | undefined {
    return Array.from(this.lostPetIncidents.values()).find(
      inc => inc.petId === petId && (inc.status === 'REPORTED' || inc.status === 'ACTIVE' || inc.status === 'SEARCH_IN_PROGRESS')
    );
  }

  public getSightingsByIncidentId(incidentId: LostPetIncidentId): LostPetSighting[] {
    return Array.from(this.sightings.values()).filter(s => s.lostPetIncidentId === incidentId);
  }

  public getSafeZonesByPetId(petId: PetId): SafeZone[] {
    return Array.from(this.safeZones.values()).filter(sz => sz.petId === petId && sz.isActive);
  }
}
