/**
 * Pet OS Sprint 22 — Pet Transport Canonical Seed Data
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
  asTransportTripPetId,
  asTransportInstructionSnapshotId,
  asTransportCustodyRecordId,
  asTransportContainmentAssignmentId,
  asTransportEnvironmentObservationId,
  asTransportBelongingItemId,
} from '../kernel/ids';
import { TransportStore } from './store';
import {
  TransportDriverProfile,
  TransportVehicle,
  TransportTrip,
  TransportStop,
  TransportInstructionSnapshot,
  TransportPetContainmentAssignment,
  TransportCustodyRecord,
  TransportTripPet,
} from './types';

export function seedTransportData(): void {
  const store = TransportStore.getInstance();
  store.reset();

  const now = new Date();
  const nowIso = now.toISOString();

  // Canonical Actors & Businesses
  const businessId = asBusinessId('biz-nairobi-pet-transport');
  const providerId = asProviderId('prov-safari-transit');
  const adminUserId = asUserId('usr-transport-dispatch-admin');

  // ==========================================
  // DRIVERS
  // ==========================================

  const driver1Id = asTransportDriverProfileId('drv-juma-omondi');
  const driver1: TransportDriverProfile = {
    driverProfileId: driver1Id,
    userId: asUserId('usr-juma-omondi'),
    providerId,
    businessId,
    fullName: 'Juma Omondi',
    phoneNumberMasked: '+254 712 *** 890',
    operationalStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    drivingLicenseRefMasked: 'DL-KE-***921',
    approvedServiceTypes: ['ONE_WAY', 'RETURN', 'MULTI_STOP', 'WAIT_AND_RETURN', 'VET_TRANSFER'],
    verificationDate: new Date(now.getTime() - 86400000 * 30).toISOString(),
    verifiedByUserId: adminUserId,
    emergencyContact: '+254 722 000 111',
    createdAt: new Date(now.getTime() - 86400000 * 30).toISOString(),
    updatedAt: nowIso,
  };
  store.saveDriver(driver1);

  const driver2Id = asTransportDriverProfileId('drv-grace-muthoni');
  const driver2: TransportDriverProfile = {
    driverProfileId: driver2Id,
    userId: asUserId('usr-grace-muthoni'),
    providerId,
    businessId,
    fullName: 'Grace Muthoni',
    phoneNumberMasked: '+254 733 *** 456',
    operationalStatus: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    drivingLicenseRefMasked: 'DL-KE-***408',
    approvedServiceTypes: ['ONE_WAY', 'RETURN', 'RESCUE_TRANSFER', 'FACILITY_TRANSFER'],
    verificationDate: new Date(now.getTime() - 86400000 * 15).toISOString(),
    verifiedByUserId: adminUserId,
    emergencyContact: '+254 733 999 888',
    createdAt: new Date(now.getTime() - 86400000 * 15).toISOString(),
    updatedAt: nowIso,
  };
  store.saveDriver(driver2);

  const driver3Id = asTransportDriverProfileId('drv-kevin-otieno');
  const driver3: TransportDriverProfile = {
    driverProfileId: driver3Id,
    userId: asUserId('usr-kevin-otieno'),
    providerId,
    businessId,
    fullName: 'Kevin Otieno',
    phoneNumberMasked: '+254 788 *** 123',
    operationalStatus: 'PENDING',
    verificationStatus: 'UNVERIFIED',
    drivingLicenseRefMasked: 'DL-KE-***771',
    approvedServiceTypes: ['ONE_WAY'],
    emergencyContact: '+254 788 111 222',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.saveDriver(driver3);

  // ==========================================
  // VEHICLES
  // ==========================================

  const vehicle1Id = asTransportVehicleId('veh-toyota-petvan-01');
  const vehicle1: TransportVehicle = {
    vehicleId: vehicle1Id,
    businessId,
    providerId,
    displayName: 'Toyota HiAce Climate Pet Shuttle #01',
    registrationNumber: 'KDA 342P',
    makeModel: 'Toyota HiAce Climate Spec',
    vehicleType: 'SPECIALIZED_PET_VAN',
    operationalStatus: 'AVAILABLE',
    verificationStatus: 'VERIFIED',
    capacity: {
      maxPets: 4,
      maxWeightKg: 120,
      allowedSpecies: ['DOG', 'CAT'],
      crateSlots: [
        { slotId: 'CRATE-A1', slotName: 'Lower Left XL Secure Crate', size: 'EXTRA_LARGE', capability: 'CRATE' },
        { slotId: 'CRATE-A2', slotName: 'Lower Right Large Secure Crate', size: 'LARGE', capability: 'CRATE' },
        { slotId: 'CRATE-B1', slotName: 'Upper Left Medium Crate', size: 'MEDIUM', capability: 'CRATE' },
        { slotId: 'CRATE-B2', slotName: 'Upper Right Medium Crate', size: 'MEDIUM', capability: 'CRATE' },
      ],
    },
    sensorCapabilities: ['TEMPERATURE_CARGO', 'HUMIDITY_CARGO', 'VENTILATION_MONITOR'],
    lastInspectionDate: new Date(now.getTime() - 86400000 * 10).toISOString(),
    insuranceValidUntil: new Date(now.getTime() + 86400000 * 300).toISOString(),
    createdAt: new Date(now.getTime() - 86400000 * 60).toISOString(),
    updatedAt: nowIso,
  };
  store.saveVehicle(vehicle1);

  const vehicle2Id = asTransportVehicleId('veh-nissan-transit-02');
  const vehicle2: TransportVehicle = {
    vehicleId: vehicle2Id,
    businessId,
    providerId,
    displayName: 'Nissan NV200 Multi-Pet Transit #02',
    registrationNumber: 'KDK 891B',
    makeModel: 'Nissan NV200 Cargo',
    vehicleType: 'VAN',
    operationalStatus: 'AVAILABLE',
    verificationStatus: 'VERIFIED',
    capacity: {
      maxPets: 3,
      maxWeightKg: 80,
      allowedSpecies: ['DOG', 'CAT', 'SMALL_MAMMAL'],
      crateSlots: [
        { slotId: 'SLOT-1', slotName: 'Rear Left Large Crate', size: 'LARGE', capability: 'CRATE' },
        { slotId: 'SLOT-2', slotName: 'Rear Right Medium Crate', size: 'MEDIUM', capability: 'CRATE' },
        { slotId: 'SLOT-3', slotName: 'Front Partition Carrier Rack', size: 'SMALL', capability: 'CARRIER' },
      ],
    },
    sensorCapabilities: ['TEMPERATURE_CARGO'],
    lastInspectionDate: new Date(now.getTime() - 86400000 * 14).toISOString(),
    insuranceValidUntil: new Date(now.getTime() + 86400000 * 200).toISOString(),
    createdAt: new Date(now.getTime() - 86400000 * 45).toISOString(),
    updatedAt: nowIso,
  };
  store.saveVehicle(vehicle2);

  // ==========================================
  // TRIP 1: IN-TRANSIT VET & RETURN TRIP
  // Pet: Luna (Golden Retriever)
  // Owner: Elena Vance
  // Driver: Juma Omondi
  // Vehicle: Toyota HiAce (KDA 342P)
  // ==========================================

  const trip1Id = asTransportTripId('trp-luna-vet-return');
  const pet1Id = asPetId('pet-luna-golden');
  const booking1Id = asBookingId('bok-transport-luna-vet');
  const household1Id = asHouseholdId('hh-elena-vance');
  const elenaUserId = asUserId('usr-elena-vance');

  // Stops
  const stop1Id = asTransportStopId('stp-luna-pickup');
  const stop1: TransportStop = {
    stopId: stop1Id,
    tripId: trip1Id,
    sequence: 1,
    stopType: 'PICKUP',
    title: 'Elena Vance Residence — Kilimani',
    addressPublicSnippet: 'Ring Road, Kilimani, Nairobi',
    exactAddressEncrypted: 'Apt 4B, Acacia Court, 14 Ring Road Kilimani, Nairobi (Gate Code #4492)',
    addressAccessWindowStartIso: new Date(now.getTime() - 3600000 * 2).toISOString(),
    addressAccessWindowEndIso: new Date(now.getTime() + 3600000 * 4).toISOString(),
    scheduledArrival: new Date(now.getTime() - 3600000).toISOString(),
    actualArrival: new Date(now.getTime() - 3400000).toISOString(),
    actualDeparture: new Date(now.getTime() - 3100000).toISOString(),
    recipientContactName: 'Elena Vance',
    recipientContactPhoneMasked: '+254 722 *** 101',
    status: 'COMPLETED',
    petIdsBoarding: [pet1Id],
    petIdsExiting: [],
    requiredActions: ['VERIFY_PET_IDENTITY', 'CHECK_COLLAR_LEAD', 'CONFIRM_CONTAINMENT'],
  };
  store.saveStop(stop1);

  const stop2Id = asTransportStopId('stp-luna-vet');
  const stop2: TransportStop = {
    stopId: stop2Id,
    tripId: trip1Id,
    sequence: 2,
    stopType: 'VETERINARY_STOP',
    title: 'Nairobi West Veterinary Centre',
    addressPublicSnippet: 'Langata Rd, Nairobi West',
    exactAddressEncrypted: 'Unit 3, Medical Plaza, Langata Road, Nairobi West',
    addressAccessWindowStartIso: new Date(now.getTime() - 3600000).toISOString(),
    addressAccessWindowEndIso: new Date(now.getTime() + 3600000 * 5).toISOString(),
    scheduledArrival: new Date(now.getTime() + 1200000).toISOString(), // 20 min from now
    recipientContactName: 'Dr. Kimani (Attending Vet)',
    recipientContactPhoneMasked: '+254 733 *** 902',
    status: 'EN_ROUTE',
    petIdsBoarding: [],
    petIdsExiting: [],
    requiredActions: ['TEMP_CUSTODY_TRANSFER', 'WAIT_OR_SERVICE_HANDOFF'],
    notes: 'Wait-and-return appointment: Wait 45 mins during routine ultrasound checkup',
  };
  store.saveStop(stop2);

  const stop3Id = asTransportStopId('stp-luna-return');
  const stop3: TransportStop = {
    stopId: stop3Id,
    tripId: trip1Id,
    sequence: 3,
    stopType: 'RETURN_ORIGIN_STOP',
    title: 'Elena Vance Residence — Return Drop-Off',
    addressPublicSnippet: 'Ring Road, Kilimani, Nairobi',
    exactAddressEncrypted: 'Apt 4B, Acacia Court, 14 Ring Road Kilimani, Nairobi (Gate Code #4492)',
    addressAccessWindowStartIso: new Date(now.getTime() - 3600000).toISOString(),
    addressAccessWindowEndIso: new Date(now.getTime() + 3600000 * 6).toISOString(),
    scheduledArrival: new Date(now.getTime() + 5400000).toISOString(),
    recipientContactName: 'Elena Vance',
    recipientContactPhoneMasked: '+254 722 *** 101',
    status: 'PENDING',
    petIdsBoarding: [],
    petIdsExiting: [pet1Id],
    requiredActions: ['VERIFY_OWNER_PIN', 'RELEASE_CONTAINMENT', 'RETURN_BELONGINGS'],
  };
  store.saveStop(stop3);

  // Instruction Snapshot (Minimum Necessary Health Data)
  const snap1Id = asTransportInstructionSnapshotId('snp-luna-vet-transit');
  const snap1: TransportInstructionSnapshot = {
    snapshotId: snap1Id,
    tripId: trip1Id,
    petId: pet1Id,
    petName: 'Luna',
    species: 'DOG',
    breed: 'Golden Retriever',
    sizeClassification: 'LARGE',
    pickupInstructions: 'Elena will bring Luna down to the front security lobby. Luna is leash-friendly and calm.',
    destinationInstructions: 'Hand over to reception desk at Nairobi West Vet Centre. Reference Dr. Kimani booking #VET-9821.',
    authorizedRecipientName: 'Elena Vance / Dr. Kimani',
    authorizedRecipientPhoneMasked: '+254 722 *** 101',
    emergencyContactPhone: '+254 722 999 000',
    mobilityAssistanceNotes: 'Mild hip stiffness when jumping into tall vehicles; ramp or gentle assist preferred.',
    motionSicknessWarning: false,
    transportRestrictions: ['MUST_USE_CRATE_OR_HARNESS', 'DO_NOT_FEED_HEAVY_MEAL_DURING_TRANSIT'],
    criticalMedicationTiming: [
      { medicationName: 'Joint Supplement Chew', scheduledTime: '12:00 PM', instructions: 'Given by clinic with water' },
    ],
    crateOrCarrierRequirements: 'Lower Left XL Secure Crate (CRATE-A1)',
    feedingHydrationInstructions: 'Offer fresh water if transit exceeds 45 mins.',
    capturedAt: new Date(now.getTime() - 7200000).toISOString(),
    versionRef: 'SNAP_V1',
  };
  store.saveSnapshot(snap1);

  // Containment Assignment
  const cont1Id = asTransportContainmentAssignmentId('cnt-luna-crate-a1');
  const cont1: TransportPetContainmentAssignment = {
    assignmentId: cont1Id,
    tripId: trip1Id,
    petId: pet1Id,
    vehicleId: vehicle1Id,
    slotId: 'CRATE-A1',
    containmentType: 'CRATE',
    providedBy: 'PROVIDER',
    confirmedAt: new Date(now.getTime() - 3200000).toISOString(),
    confirmedByDriverId: driver1Id,
  };
  store.saveContainment(cont1);

  // Custody Record (Accepted by Juma at Pickup)
  const cust1Id = asTransportCustodyRecordId('cst-luna-juma');
  const cust1: TransportCustodyRecord = {
    custodyRecordId: cust1Id,
    tripId: trip1Id,
    petId: pet1Id,
    fromActorUserId: elenaUserId,
    fromActorRole: 'HOUSEHOLD_OWNER',
    toActorUserId: driver1.userId,
    toActorRole: 'TRANSPORT_DRIVER',
    stopId: stop1Id,
    transferredAt: new Date(now.getTime() - 3200000).toISOString(),
    verificationMethod: 'OWNER_PIN',
    notes: 'Elena Vance presented owner OTP 7821; Luna securely transferred.',
    immutableSignature: 'SIG_PICKUP_LUNA_7821_VERIFIED',
  };
  store.saveCustodyRecord(cust1);

  // Trip Pet
  const tripPet1: TransportTripPet = {
    tripPetId: asTransportTripPetId('tpet-luna-01'),
    tripId: trip1Id,
    petId: pet1Id,
    petName: 'Luna',
    speciesCode: 'DOG',
    sizeClassification: 'LARGE',
    containmentAssignment: cont1,
    custodyStatus: 'DRIVER',
    currentCustodianUserId: driver1.userId,
    boardStopSequence: 1,
    exitStopSequence: 3,
    notes: 'Comfortable in CRATE-A1',
  };

  // Trip Aggregate
  const trip1: TransportTrip = {
    tripId: trip1Id,
    bookingId: booking1Id,
    householdId: household1Id,
    businessId,
    providerId,
    assignedDriverId: driver1Id,
    assignedVehicleId: vehicle1Id,
    status: 'IN_TRANSIT',
    tripType: 'WAIT_AND_RETURN',
    pets: [tripPet1],
    stops: [stop1, stop2, stop3],
    scheduledPickupAt: new Date(now.getTime() - 3600000).toISOString(),
    actualPickupAt: new Date(now.getTime() - 3100000).toISOString(),
    scheduledCompletionAt: new Date(now.getTime() + 5400000).toISOString(),
    timezone: 'Africa/Nairobi',
    trackingSessionId: 'TRK_SES_LUNA_TRANSIT_LIVE',
    routeReference: 'RT_KLM_WEST_09',
    currentStopSequence: 2,
    overallCustodyStatus: 'DRIVER',
    activeIncidentCount: 0,
    instructionSnapshotIds: [snap1Id],
    createdAt: new Date(now.getTime() - 86400000).toISOString(),
    updatedAt: nowIso,
    version: 4,
  };
  store.saveTrip(trip1);

  // Add Environmental Observation for Trip 1
  store.saveObservation({
    observationId: asTransportEnvironmentObservationId('obs-temp-01'),
    tripId: trip1Id,
    vehicleId: vehicle1Id,
    sensorId: 'SENSOR-CARGO-TEMP-A',
    observationType: 'CARGO_TEMPERATURE',
    value: 23.4,
    unit: 'CELSIUS',
    observedAt: nowIso,
    receivedAt: nowIso,
    source: 'VEHICLE_SENSOR_TELEMATICS',
    quality: 'GOOD',
  });

  // Add Belongings for Trip 1
  store.saveBelonging({
    itemId: asTransportBelongingItemId('blg-luna-blanket'),
    tripId: trip1Id,
    petId: pet1Id,
    description: 'Fleece Pet Comfort Blanket',
    category: 'OTHER',
    acceptedAtPickup: true,
    releasedAtHandover: false,
  });

  store.saveBelonging({
    itemId: asTransportBelongingItemId('blg-luna-vet-card'),
    tripId: trip1Id,
    petId: pet1Id,
    description: 'Vaccination & Medical Passport Booklet',
    category: 'DOCUMENT',
    acceptedAtPickup: true,
    releasedAtHandover: false,
  });
}
