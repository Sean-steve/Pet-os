/**
 * Pet OS Sprint 22 — Pet Transport Test Suite
 * Comprehensive Verification of Domain Invariants, Safety Workflows, and Cross-Sprint Integrations
 */

import {
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asBusinessId,
  asBookingId,
  asTransportDriverProfileId,
  asTransportVehicleId,
  asTransportTripId,
  asTransportStopId,
  asTransportIncidentId,
} from '../kernel/ids';
import { TransportStore } from './store';
import { TransportService } from './service';
import { seedTransportData } from './seed';

export interface TransportTestResult {
  testName: string;
  category: 'DRIVER' | 'VEHICLE' | 'PRIVACY' | 'PICKUP' | 'CONTAINMENT' | 'TELEMETRY' | 'INCIDENT' | 'COMPLETION';
  passed: boolean;
  message: string;
  durationMs: number;
}

export function runAllTransportTests(): TransportTestResult[] {
  const results: TransportTestResult[] = [];

  function record(
    testName: string,
    category: TransportTestResult['category'],
    fn: () => void
  ) {
    const start = performance.now();
    try {
      fn();
      results.push({
        testName,
        category,
        passed: true,
        message: 'Assertion verified successfully.',
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        testName,
        category,
        passed: false,
        message: err?.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  const store = TransportStore.getInstance();
  const service = TransportService.getInstance();

  // Test 1: Driver verification invariant — Driver CANNOT self-verify
  record('Driver cannot self-verify credentials', 'DRIVER', () => {
    seedTransportData();
    const pendingDriver = service.registerDriver({
      userId: asUserId('usr-test-driver-01'),
      providerId: asProviderId('prov-safari-transit'),
      businessId: asBusinessId('biz-nairobi-pet-transport'),
      fullName: 'Test Driver 01',
      phoneNumberMasked: '+254 700 *** 111',
      drivingLicenseRefMasked: 'DL-KE-***111',
      approvedServiceTypes: ['ONE_WAY'],
      emergencyContact: '+254 700 000 000',
    });

    let threw = false;
    try {
      service.verifyDriver({
        driverProfileId: pendingDriver.driverProfileId,
        verifiedByUserId: asUserId('usr-test-driver-01'), // Self-verification attempt!
      });
    } catch (err: any) {
      threw = true;
      if (!err.message.includes('Security Violation: Driver cannot self-verify')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!threw) {
      throw new Error('Expected self-verification to be blocked with security exception!');
    }

    // Now verify by authorized admin
    const verified = service.verifyDriver({
      driverProfileId: pendingDriver.driverProfileId,
      verifiedByUserId: asUserId('usr-admin-verifier'),
    });
    if (verified.verificationStatus !== 'VERIFIED' || verified.operationalStatus !== 'ACTIVE') {
      throw new Error('Authorized verification failed to activate driver.');
    }
  });

  // Test 2: Vehicle verification and capacity validation
  record('Vehicle verification and capacity enforcement', 'VEHICLE', () => {
    seedTransportData();
    const smallVehicle = service.registerVehicle({
      businessId: asBusinessId('biz-nairobi-pet-transport'),
      providerId: asProviderId('prov-safari-transit'),
      displayName: 'Small Sedan Spec',
      registrationNumber: 'KDB 100Z',
      makeModel: 'Toyota Vitz',
      vehicleType: 'CAR',
      capacity: {
        maxPets: 1,
        maxWeightKg: 15,
        allowedSpecies: ['CAT'],
        crateSlots: [
          { slotId: 'SLOT-CAT-1', slotName: 'Backseat Crate', size: 'SMALL', capability: 'CARRIER' },
        ],
      },
      sensorCapabilities: [],
      insuranceValidUntil: '2027-01-01T00:00:00Z',
      lastInspectionDate: '2026-08-01T00:00:00Z',
      actorUserId: asUserId('usr-admin'),
    });

    // Create a trip with a Dog
    const trip = service.createTripFromBooking({
      bookingId: asBookingId('bok-capacity-test'),
      householdId: asHouseholdId('hh-test'),
      businessId: asBusinessId('biz-nairobi-pet-transport'),
      providerId: asProviderId('prov-safari-transit'),
      tripType: 'ONE_WAY',
      pets: [
        {
          petId: asPetId('pet-large-dog'),
          petName: 'Rocky',
          speciesCode: 'DOG',
          sizeClassification: 'LARGE',
          instructions: {
            pickupInstructions: 'Gate 1',
            destinationInstructions: 'Clinic',
            authorizedRecipientName: 'Clinic Staff',
            authorizedRecipientPhoneMasked: '+254 700 *** 000',
            emergencyContactPhone: '+254 700 000 000',
          },
        },
      ],
      stops: [
        {
          sequence: 1,
          stopType: 'PICKUP',
          title: 'Pickup',
          addressPublicSnippet: 'Kilimani',
          exactAddressEncrypted: 'Apt 1',
          addressAccessWindowStartIso: '2026-09-16T08:00:00Z',
          addressAccessWindowEndIso: '2026-09-16T12:00:00Z',
          scheduledArrival: '2026-09-16T09:00:00Z',
          recipientContactName: 'Elena',
          recipientContactPhoneMasked: '+254 700 *** 000',
          petIdsBoarding: [asPetId('pet-large-dog')],
          petIdsExiting: [],
          requiredActions: [],
        },
        {
          sequence: 2,
          stopType: 'DROP_OFF',
          title: 'Destination',
          addressPublicSnippet: 'Westlands',
          exactAddressEncrypted: 'Clinic 2',
          addressAccessWindowStartIso: '2026-09-16T08:00:00Z',
          addressAccessWindowEndIso: '2026-09-16T12:00:00Z',
          scheduledArrival: '2026-09-16T10:00:00Z',
          recipientContactName: 'Dr. John',
          recipientContactPhoneMasked: '+254 700 *** 000',
          petIdsBoarding: [],
          petIdsExiting: [asPetId('pet-large-dog')],
          requiredActions: [],
        },
      ],
      scheduledPickupAt: '2026-09-16T09:00:00Z',
      scheduledCompletionAt: '2026-09-16T10:00:00Z',
      actorUserId: asUserId('usr-admin'),
    });

    // Attempting to assign vehicle with only CAT allowed must fail
    let speciesBlocked = false;
    try {
      service.assignVehicle({
        tripId: trip.tripId,
        vehicleId: smallVehicle.vehicleId,
        actorUserId: asUserId('usr-admin'),
      });
    } catch (err: any) {
      speciesBlocked = true;
      if (!err.message.includes('does not permit species DOG')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    if (!speciesBlocked) {
      throw new Error('Expected vehicle assignment to fail due to species mismatch!');
    }
  });

  // Test 3: Driver double-booking guard
  record('Driver double-booking guard blocks overlapping active trips', 'DRIVER', () => {
    seedTransportData();
    const activeTrip = store.getTrip(asTransportTripId('trp-luna-vet-return'));
    if (!activeTrip) throw new Error('Active seed trip not found.');

    // Attempting to assign Juma Omondi to a new trip while active on trip1 must fail
    const newTrip = service.createTripFromBooking({
      bookingId: asBookingId('bok-driver-conflict'),
      householdId: asHouseholdId('hh-test'),
      businessId: asBusinessId('biz-nairobi-pet-transport'),
      providerId: asProviderId('prov-safari-transit'),
      tripType: 'ONE_WAY',
      pets: [
        {
          petId: asPetId('pet-cat-milo'),
          petName: 'Milo',
          speciesCode: 'CAT',
          sizeClassification: 'SMALL',
          instructions: {
            pickupInstructions: 'Pick from owner',
            destinationInstructions: 'Drop off',
            authorizedRecipientName: 'Owner',
            authorizedRecipientPhoneMasked: '+254 700 *** 000',
            emergencyContactPhone: '+254 700 000 000',
          },
        },
      ],
      stops: [
        {
          sequence: 1,
          stopType: 'PICKUP',
          title: 'Pickup',
          addressPublicSnippet: 'Snippet',
          exactAddressEncrypted: 'Secret',
          addressAccessWindowStartIso: '2026-09-16T08:00:00Z',
          addressAccessWindowEndIso: '2026-09-16T12:00:00Z',
          scheduledArrival: '2026-09-16T09:00:00Z',
          recipientContactName: 'Elena',
          recipientContactPhoneMasked: '+254 700 *** 000',
          petIdsBoarding: [asPetId('pet-cat-milo')],
          petIdsExiting: [],
          requiredActions: [],
        },
        {
          sequence: 2,
          stopType: 'DROP_OFF',
          title: 'Drop',
          addressPublicSnippet: 'Snippet',
          exactAddressEncrypted: 'Secret',
          addressAccessWindowStartIso: '2026-09-16T08:00:00Z',
          addressAccessWindowEndIso: '2026-09-16T12:00:00Z',
          scheduledArrival: '2026-09-16T10:00:00Z',
          recipientContactName: 'Recipient',
          recipientContactPhoneMasked: '+254 700 *** 000',
          petIdsBoarding: [],
          petIdsExiting: [asPetId('pet-cat-milo')],
          requiredActions: [],
        },
      ],
      scheduledPickupAt: '2026-09-16T09:00:00Z',
      scheduledCompletionAt: '2026-09-16T10:00:00Z',
      actorUserId: asUserId('usr-admin'),
    });

    let doubleBookBlocked = false;
    try {
      service.assignDriver({
        tripId: newTrip.tripId,
        driverProfileId: activeTrip.assignedDriverId!,
        actorUserId: asUserId('usr-admin'),
      });
    } catch (err: any) {
      doubleBookBlocked = true;
      if (!err.message.includes('Concurrency Conflict: Driver Juma Omondi is currently active')) {
        throw new Error(`Unexpected message: ${err.message}`);
      }
    }

    if (!doubleBookBlocked) {
      throw new Error('Expected driver double-booking to be blocked!');
    }
  });

  // Test 4: Address Privacy Access Window & Post-Trip Revocation
  record('Address privacy access window and post-trip revocation', 'PRIVACY', () => {
    seedTransportData();
    const trip = store.getTrip(asTransportTripId('trp-luna-vet-return'))!;
    const driver = store.getDriver(trip.assignedDriverId!)!;
    const stop2 = trip.stops[1];

    // During valid window, assigned driver gets exact address
    const inWindow = service.getStopExactAddress({
      stopId: stop2.stopId,
      requestingUserId: driver.userId,
      currentTimeIso: new Date().toISOString(),
    });
    if (!inWindow.accessGranted || inWindow.address !== stop2.exactAddressEncrypted) {
      throw new Error('Assigned driver was improperly denied address access during active window.');
    }

    // Unauthorized user gets only public snippet
    const unauthorized = service.getStopExactAddress({
      stopId: stop2.stopId,
      requestingUserId: asUserId('usr-random-stranger'),
      currentTimeIso: new Date().toISOString(),
    });
    if (unauthorized.accessGranted || unauthorized.address !== stop2.addressPublicSnippet) {
      throw new Error('Unauthorized user should only receive public address snippet.');
    }

    // Expired window
    const pastWindow = service.getStopExactAddress({
      stopId: stop2.stopId,
      requestingUserId: driver.userId,
      currentTimeIso: '2028-01-01T00:00:00Z', // Distant future
    });
    if (pastWindow.accessGranted || pastWindow.reason !== 'WINDOW_EXPIRED') {
      throw new Error('Driver should be blocked when outside access window.');
    }
  });

  // Test 5: Positive Pet Identity Verification & Wrong Pet Rejection
  record('Positive Pet identity verification and wrong Pet pickup rejection', 'PICKUP', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const petId = asPetId('pet-luna-golden');
    const driverUserId = asUserId('usr-juma-omondi');

    // Matching identification
    const verified = service.verifyPetIdentity({
      tripId,
      petId,
      presentedPetIdentifier: 'pet-luna-golden',
      verificationMethod: 'MICROCHIP_SCAN',
      actorUserId: driverUserId,
    });
    if (!verified) throw new Error('Valid Pet identity failed verification.');

    // Wrong Pet presented (e.g. Stray or different dog)
    const mismatch = service.verifyPetIdentity({
      tripId,
      petId,
      presentedPetIdentifier: 'pet-random-unknown-dog',
      verificationMethod: 'PHOTO_CHECK',
      actorUserId: driverUserId,
    });
    if (mismatch) throw new Error('Wrong Pet identifier should have failed verification!');
  });

  // Test 6: Custody Transfer & Containment Confirmation
  record('Custody record immutability and containment assignment', 'CONTAINMENT', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const custodyRecords = store.getCustodyRecordsForTrip(tripId);
    if (custodyRecords.length === 0) throw new Error('Expected initial custody record in seed data.');

    const initial = custodyRecords[0];
    if (initial.fromActorRole !== 'HOUSEHOLD_OWNER' || initial.toActorRole !== 'TRANSPORT_DRIVER') {
      throw new Error('Initial custody roles mismatch.');
    }
    if (!initial.immutableSignature) {
      throw new Error('Custody record must contain an immutable cryptographic signature.');
    }

    const containments = store.getContainmentsForTrip(tripId);
    if (containments.length === 0) throw new Error('Expected containment assignment.');
    if (containments[0].slotId !== 'CRATE-A1' || containments[0].containmentType !== 'CRATE') {
      throw new Error('Containment slot mapping mismatch.');
    }
  });

  // Test 7: Environmental Telemetry Provenance & Safety Alert
  record('Environmental telemetry provenance (cargo != pet body temp) and safety alert', 'TELEMETRY', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');

    // Record normal cargo temperature
    const obsNormal = service.recordEnvironmentObservation({
      tripId,
      sensorId: 'SENSOR-CARGO-TEMP-A',
      observationType: 'CARGO_TEMPERATURE',
      value: 22.0,
      unit: 'CELSIUS',
    });
    if (obsNormal.observationType !== 'CARGO_TEMPERATURE') {
      throw new Error('Telemetry must be categorized strictly as vehicle CARGO_TEMPERATURE.');
    }

    // Record extreme high cargo temperature (> 28°C)
    const obsHigh = service.recordEnvironmentObservation({
      tripId,
      sensorId: 'SENSOR-CARGO-TEMP-A',
      observationType: 'CARGO_TEMPERATURE',
      value: 31.5,
      unit: 'CELSIUS',
    });

    const alerts = store.getSafetyAlertsForTrip(tripId);
    const highAlert = alerts.find(a => a.alertType === 'TEMPERATURE_HIGH');
    if (!highAlert) {
      throw new Error('Expected high temperature safety alert to be raised!');
    }
    if (!highAlert.message.includes('compartment ambient temperature exceeded')) {
      throw new Error(`Unexpected safety alert message wording: ${highAlert.message}`);
    }
  });

  // Test 8: Incident Workflow — Vehicle Breakdown & Replacement Vehicle
  record('Vehicle breakdown mitigation and replacement vehicle capacity check', 'INCIDENT', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const driverUserId = asUserId('usr-juma-omondi');

    // Report breakdown
    const incident = service.reportIncident({
      tripId,
      driverUserId,
      category: 'VEHICLE_BREAKDOWN',
      severity: 'HIGH',
      description: 'Cooling radiator malfunction on highway shoulder; parked safely with ventilation on.',
      actionTaken: 'Halted in shade, emergency dispatch alerted.',
      petIds: [asPetId('pet-luna-golden')],
    });

    const tripAfterIncident = store.getTrip(tripId)!;
    if (tripAfterIncident.status !== 'INCIDENT_ACTIVE') {
      throw new Error(`Expected trip status INCIDENT_ACTIVE, got ${tripAfterIncident.status}`);
    }

    // Reassign replacement vehicle
    const replacementVehicleId = asTransportVehicleId('veh-nissan-transit-02');
    const tripReassigned = service.reassignVehicleAfterBreakdown({
      tripId,
      newVehicleId: replacementVehicleId,
      incidentId: incident.incidentId,
      actorUserId: asUserId('usr-dispatch-admin'),
      reason: 'Replacement van dispatched to highway mile marker 14',
    });

    if (tripReassigned.assignedVehicleId !== replacementVehicleId) {
      throw new Error('Failed to reassign replacement vehicle.');
    }
    if (tripReassigned.status !== 'IN_TRANSIT') {
      throw new Error('Trip did not resume IN_TRANSIT after replacement vehicle assigned.');
    }
  });

  // Test 9: Pet Escape Incident -> Exactly ONE LostPetIncidentRequested event
  record('Pet escape incident triggers LostPetIncidentRequested with custody context', 'INCIDENT', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const driverUserId = asUserId('usr-juma-omondi');
    const petId = asPetId('pet-luna-golden');

    const outboxBefore = store.getOutboxEvents().filter(e => e.eventType === 'LostPetIncidentRequested');

    // Report escape
    const escapeIncident = service.reportIncident({
      tripId,
      driverUserId,
      category: 'PET_ESCAPE',
      severity: 'CRITICAL',
      description: 'Harness slipped during emergency road stop near roundabout.',
      actionTaken: 'Perimeter secured, animal control notified.',
      petIds: [petId],
      lastKnownTrackingRef: 'GPS_LAT_-1.2921_LNG_36.8219',
    });

    const outboxAfter = store.getOutboxEvents().filter(e => e.eventType === 'LostPetIncidentRequested');
    if (outboxAfter.length !== outboxBefore.length + 1) {
      throw new Error(`Expected exactly one new LostPetIncidentRequested event, got ${outboxAfter.length - outboxBefore.length}`);
    }

    const escapeEvent = outboxAfter[outboxAfter.length - 1] as any;
    if (escapeEvent.petId !== petId || !escapeEvent.custodianAtTimeOfEscape.includes('Juma Omondi')) {
      throw new Error('Escape event payload missing required custody/driver context.');
    }

    const trip = store.getTrip(tripId)!;
    const petInTrip = trip.pets.find(p => p.petId === petId)!;
    if (petInTrip.custodyStatus !== 'LOST_INCIDENT') {
      throw new Error(`Pet custody status must reflect LOST_INCIDENT, got ${petInTrip.custodyStatus}`);
    }
  });

  // Test 10: Destination Handover, Failed Handover Fallback & Return-to-Origin
  record('Destination recipient verification and failed handover return-to-origin', 'COMPLETION', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const driverUserId = asUserId('usr-juma-omondi');
    const stop2 = store.getStop(asTransportStopId('stp-luna-vet'))!;

    // Trigger failed handover at destination (recipient unavailable)
    const tripWithReturn = service.handleFailedHandover({
      tripId,
      stopId: stop2.stopId,
      reason: 'Veterinary clinic power outage and staff evacuation; closed until tomorrow.',
      actionTaken: 'RETURN_TO_ORIGIN',
      driverUserId,
    });

    const returnStop = tripWithReturn.stops.find(s => s.stopType === 'RETURN_ORIGIN_STOP');
    if (!returnStop) {
      throw new Error('Expected dynamic RETURN_ORIGIN_STOP appended to trip stops.');
    }
    if (tripWithReturn.status !== 'IN_TRANSIT') {
      throw new Error('Trip status should remain IN_TRANSIT returning pet safely to origin.');
    }
  });

  // Test 11: End-to-End Trip Completion, Tracking Finalization & Idempotency
  record('End-to-end trip completion, tracking finalization, and idempotency', 'COMPLETION', () => {
    seedTransportData();
    const tripId = asTransportTripId('trp-luna-vet-return');
    const driverUserId = asUserId('usr-juma-omondi');
    const petId = asPetId('pet-luna-golden');
    const stop3 = store.getStop(asTransportStopId('stp-luna-return'))!;

    // Hand over pet back to Elena Vance
    service.executeDestinationHandover({
      tripId,
      stopId: stop3.stopId,
      petId,
      recipientName: 'Elena Vance',
      recipientRole: 'HOUSEHOLD_OWNER',
      recipientUserId: asUserId('usr-elena-vance'),
      verificationMethod: 'OWNER_PIN',
      recipientSignatureOrOtp: '7821',
      driverUserId,
      notes: 'Elena greeted Luna at lobby; all blankets and records returned.',
    });

    // Complete trip
    const evidence1 = service.completeTrip({
      tripId,
      driverUserId,
    });

    if (!evidence1.allPetsAccountedFor || evidence1.totalStopsCompleted !== 3) {
      throw new Error('Completion evidence failed verification.');
    }

    const tripCompleted = store.getTrip(tripId)!;
    if (tripCompleted.status !== 'COMPLETED') {
      throw new Error(`Expected trip status COMPLETED, got ${tripCompleted.status}`);
    }

    // Verify TrackingSessionCompleted and ServiceExecutionCompleted events
    const outbox = store.getOutboxEvents();
    const trkDone = outbox.find(e => e.eventType === 'TrackingSessionCompleted');
    if (!trkDone) throw new Error('Expected TrackingSessionCompleted event.');

    const serviceDone = outbox.find(e => e.eventType === 'ServiceExecutionCompleted');
    if (!serviceDone) throw new Error('Expected ServiceExecutionCompleted event.');

    // Test Idempotency: Calling completeTrip again returns identical evidence without errors
    const evidence2 = service.completeTrip({
      tripId,
      driverUserId,
    });

    if (evidence1.completionEvidenceId !== evidence2.completionEvidenceId) {
      throw new Error('Idempotency failure: new completion evidence created on repeated call.');
    }
  });

  return results;
}
