/**
 * Pet OS Sprint 15 - Geofencing & Lost Pet Recovery Platform Test Suite
 */

import { RecoveryService } from './service';
import { RecoveryStore } from './store';
import { PetStore } from '../pet-core/store';
import {
  asHouseholdId,
  asUserId,
  asPetId,
  generateUUIDv7
} from '../kernel/ids';
import { EventEnvelope } from '../kernel/events';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export class Sprint15RecoveryTestSuite {
  private service = RecoveryService.getInstance();
  private store = RecoveryStore.getInstance();

  private emittedEvents: EventEnvelope[] = [];

  constructor() {
    this.service.addEventListener((evt) => {
      this.emittedEvents.push(evt);
    });
  }

  public async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const runTest = async (name: string, fn: () => Promise<void> | void) => {
      try {
        await fn();
        results.push({ name, passed: true });
      } catch (err: any) {
        results.push({ name, passed: false, error: err?.message || String(err) });
      }
    };

    const householdId = asHouseholdId(generateUUIDv7());
    const ownerId = asUserId(generateUUIDv7());
    const petId = asPetId(generateUUIDv7());

    // Setup seed pet in PetStore for test
    PetStore.savePet({
      petId,
      householdId,
      name: 'Kibo Recovery Test',
      species: 'CANINE',
      breed: 'Rhodesian Ridgeback',
      dateOfBirth: '2021-06-15',
      sex: 'MALE_NEUTERED',
      weightKg: 38.5,
      microchipNumber: '985141002345678', // Sensitive private
      status: 'ACTIVE',
      avatarUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    // 1. Safe Zone creation and Geofence hysteresis test
    await runTest('Safe Zone creation with debounce hysteresis', () => {
      const zone = this.service.createSafeZone({
        householdId,
        petId,
        name: 'Elena Nairobi Compound',
        zoneType: 'HOME',
        centerLatitude: -1.286389,
        centerLongitude: 36.817223,
        radiusMeters: 50,
        hysteresisBufferMeters: 25,
        alertOnExit: true,
      });

      if (!zone.safeZoneId || zone.radiusMeters !== 50 || zone.hysteresisBufferMeters !== 25) {
        throw new Error('Failed to create safe zone with valid geometry');
      }

      // Inside safe zone (at center)
      const insideTransitions = this.service.evaluateGeofenceTransitions({
        petId,
        latitude: -1.286389,
        longitude: 36.817223,
        accuracyMeters: 5,
      });
      if (insideTransitions.length !== 0) {
        throw new Error('Inside safe zone should not trigger exit transition');
      }

      // 60m away (past 50m radius, but within 50 + 25 = 75m hysteresis buffer)
      // Lat shift ~0.0005 deg is ~55m
      const nearBufferTransitions = this.service.evaluateGeofenceTransitions({
        petId,
        latitude: -1.286889,
        longitude: 36.817223,
        accuracyMeters: 5,
      });
      if (nearBufferTransitions.length !== 0) {
        throw new Error('Within hysteresis buffer (exit debounce) should not trigger false alarm');
      }

      // 150m away (outside radius + buffer)
      // Lat shift 0.0015 deg is ~166m
      const outsideTransitions = this.service.evaluateGeofenceTransitions({
        petId,
        latitude: -1.287889,
        longitude: 36.817223,
        accuracyMeters: 5,
      });
      if (outsideTransitions.length === 0 || outsideTransitions[0].transitionType !== 'EXIT') {
        throw new Error('Outside safe zone boundary must trigger EXIT transition event');
      }
    });

    // 2. Report Lost Pet Incident and verify strict public minimization
    let incidentId: any;
    let recoveryToken: string = '';

    await runTest('Report Lost Pet Incident & Strict Public Minimization', () => {
      const { incident, recoveryProfile } = this.service.reportLostPetIncident({
        householdId,
        reportedByUserId: ownerId,
        petId,
        missingSince: new Date().toISOString(),
        lastKnownLocation: {
          latitude: -1.286389,
          longitude: 36.817223,
          accuracyMeters: 8,
          coarseDescription: 'Kilimani, Ring Road near Yaya Centre, Nairobi',
        },
        coarseSearchArea: {
          neighborhood: 'Kilimani',
          district: 'Dagoretti North',
          city: 'Nairobi',
          county: 'Nairobi County',
          centerLatitude: -1.2900,
          centerLongitude: 36.7850,
          radiusKm: 3.5,
        },
        ownerInstructions: 'Friendly dog, approach with treats. Please call or report sighting.',
        emergencyMedicalNotes: 'Requires daily anti-inflammatory medication.',
      });

      incidentId = incident.lostPetIncidentId;
      recoveryToken = recoveryProfile.publicToken;

      if (!incidentId || incident.status !== 'ACTIVE') {
        throw new Error('Lost pet incident was not activated');
      }

      // Verify Public Profile minimization
      const publicView = this.service.getPublicRecoveryProfileByToken(recoveryToken);
      if (!publicView) {
        throw new Error('Public recovery profile not found by token');
      }

      // CRITICAL PRIVACY CHECKS:
      // 1. microchip must NOT be present on public recovery profile
      if ((publicView as any).microchipNumber !== undefined) {
        throw new Error('Privacy failure: Microchip exposed on public recovery profile');
      }
      // 2. exact tracker coordinates must NOT be present
      if ((publicView as any).latitude !== undefined || (publicView as any).lastKnownLocation !== undefined) {
        throw new Error('Privacy failure: Exact tracker coordinates exposed on public recovery profile');
      }
      // 3. householdId must NOT be present
      if ((publicView as any).householdId !== undefined) {
        throw new Error('Privacy failure: Household ID exposed on public recovery profile');
      }
      // 4. coarse area is allowed
      if (!publicView.coarseMissingArea.includes('Kilimani')) {
        throw new Error('Coarse missing area should be present');
      }
    });

    // 3. Request Community Alert & Event Emission
    await runTest('Request Community Alert and verify CommunityLostPetAlertRequested event', () => {
      this.emittedEvents = [];
      const updated = this.service.activateCommunityAlert(incidentId, ownerId);

      if (!updated.isCommunityAlertRequested) {
        throw new Error('Community alert flag was not set on incident');
      }

      const alertRequestedEvent = this.emittedEvents.find(
        (e) => e.eventType === 'CommunityLostPetAlertRequested'
      );
      if (!alertRequestedEvent) {
        throw new Error('CommunityLostPetAlertRequested event was not emitted');
      }
      if (alertRequestedEvent.payload.lostPetIncidentId !== incidentId) {
        throw new Error('Event payload does not match incident ID');
      }
    });

    // 4. Structured Sighting Reporting with Extortion/Anti-Scam Check
    await runTest('Report Sighting with Extortion Detection', () => {
      // Normal legitimate sighting
      const validSighting = this.service.reportSighting({
        lostPetIncidentId: incidentId,
        sightingTimestamp: new Date().toISOString(),
        latitude: -1.2885,
        longitude: 36.7870,
        coarseDescription: 'Spotted near Adlife Plaza crossing towards Chania Ave',
        notes: 'Looked like Kibo walking slowly near the parking lot',
        reportedVia: 'COMMUNITY_ALERT',
      });

      if (validSighting.status !== 'PENDING_REVIEW' || validSighting.flaggedExtortionAttempt) {
        throw new Error('Legitimate sighting should be PENDING_REVIEW without extortion flag');
      }

      // Extortion attempt
      const extortionSighting = this.service.reportSighting({
        lostPetIncidentId: incidentId,
        sightingTimestamp: new Date().toISOString(),
        latitude: -1.2885,
        longitude: 36.7870,
        coarseDescription: 'Somewhere nearby',
        notes: 'I have your dog. Send money western union or bitcoin ransom before I give address.',
        reportedVia: 'PUBLIC_RECOVERY_PAGE',
      });

      if (!extortionSighting.flaggedExtortionAttempt || extortionSighting.status !== 'FLAGGED_ABUSIVE') {
        throw new Error('Extortion attempt should be flagged as abusive and intercepted');
      }
    });

    // 5. Confirm Recovery & Public Revocation
    await runTest('Confirm Recovery & Revoke Public Tokens', () => {
      this.emittedEvents = [];
      const recoveredIncident = this.service.confirmRecovery({
        incidentId,
        actorUserId: ownerId,
        resolutionNotes: 'Kibo was safely found near friend compound and brought home!',
      });

      if (recoveredIncident.status !== 'RECOVERED') {
        throw new Error('Incident status should be RECOVERED');
      }

      // Public token must now fail closed (return null)
      const expiredPublicView = this.service.getPublicRecoveryProfileByToken(recoveryToken);
      if (expiredPublicView !== null) {
        throw new Error('Public recovery profile must fail closed after incident is RECOVERED');
      }

      // CommunityLostPetAlertClosed event must be emitted
      const alertClosedEvent = this.emittedEvents.find(
        (e) => e.eventType === 'CommunityLostPetAlertClosed'
      );
      if (!alertClosedEvent) {
        throw new Error('CommunityLostPetAlertClosed event was not emitted on recovery');
      }

      // New sightings rejected after recovery
      try {
        this.service.reportSighting({
          lostPetIncidentId: incidentId,
          sightingTimestamp: new Date().toISOString(),
          latitude: -1.2885,
          longitude: 36.7870,
          coarseDescription: 'Spotted after recovery',
          notes: 'Test',
          reportedVia: 'COMMUNITY_ALERT',
        });
        throw new Error('Should have rejected sighting for closed incident');
      } catch (err: any) {
        if (!err.message.includes('Incident is closed')) {
          throw err;
        }
      }
    });

    return results;
  }
}

export async function runSprint15RecoveryTests(): Promise<{ total: number; passed: number; results: TestResult[] }> {
  const suite = new Sprint15RecoveryTestSuite();
  const results = await suite.runAllTests();
  const passed = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed,
    results,
  };
}
