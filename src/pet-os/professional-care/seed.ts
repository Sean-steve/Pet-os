/**
 * Pet OS Sprint 21 - Professional Care Workspaces Canonical Seed Data
 * 
 * Sets up realistic vetted groomers, pet sitters, boarding facility operators,
 * boarding kennel/condo units, active care engagements, instruction snapshots,
 * protected home-access secrets, and scheduled visits.
 */

import {
  asUserId,
  asProviderId,
  asBusinessId,
  asBookingId,
  asServiceOfferingId,
  asHouseholdId,
  asPetId,
  generateUUIDv7,
} from '../kernel/ids';

import { CANONICAL_IDS } from '../seed/unified-seed';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { BookingStore } from '../booking/store';
import { BookingAggregate } from '../booking/types';
import { ProfessionalCareStore } from './store';
import { ProfessionalCareService } from './service';

export const SEED_CARE_USERS = {
  GROOMER_CHLOE: asUserId('usr-01951500-0000-7000-8000-000000000108'),
  SITTER_SARAH: asUserId('usr-01951500-0000-7000-8000-000000000102'), // Sarah Mwangi also does in-home pet sitting
  BOARDING_DAVID: asUserId('usr-01951500-0000-7000-8000-000000000109'),
  BOARDING_STAFF_FAITH: asUserId('usr-01951500-0000-7000-8000-000000000110'),
};

export const SEED_CARE_PROVIDERS = {
  CHLOE_GROOMER: asProviderId('prv-chloe-groomer-001'),
  SARAH_SITTER: asProviderId('prv-sarah-walker-001'),
  DAVID_BOARDING: asProviderId('prv-david-boarding-001'),
};

export const SEED_CARE_BUSINESSES = {
  APEX_GROOMING_LOFT: asBusinessId('biz-apex-grooming-loft'),
  NAIROBI_PET_HAVEN: asBusinessId('biz-nairobi-pet-haven'),
};

export const SEED_CARE_OFFERINGS = {
  FULL_GROOM_DELUXE: asServiceOfferingId('sro-grooming-deluxe-01'),
  IN_HOME_SITTING_VISIT: asServiceOfferingId('sro-pet-sitting-visit-01'),
  OVERNIGHT_BOARDING: asServiceOfferingId('sro-boarding-overnight-01'),
};

export const SEED_CARE_BOOKINGS = {
  KIBO_GROOMING: asBookingId('bok-kibo-grooming-001'),
  LUNA_SITTING: asBookingId('bok-luna-sitting-001'),
  MAX_BOARDING: asBookingId('bok-max-boarding-001'),
};

export function seedProfessionalCareData(): void {
  const store = ProfessionalCareStore.getInstance();
  const service = ProfessionalCareService.getInstance();
  const bookingStore = BookingStore.getInstance();

  store.reset();

  const now = new Date();
  const nowIso = now.toISOString();
  const pastHourIso = new Date(now.getTime() - 3600000).toISOString();
  const futureHourIso = new Date(now.getTime() + 7200000).toISOString();
  const tomorrowIso = new Date(now.getTime() + 86400000).toISOString();

  // 0. Ensure Canonical Household and Owner exist
  if (!IdentityStore.findUserById(CANONICAL_IDS.OWNER_ELENA)) {
    IdentityStore.saveUser({
      userId: CANONICAL_IDS.OWNER_ELENA,
      email: 'elena.vance@petos.internal',
      normalizedEmail: 'elena.vance@petos.internal',
      phoneNumber: '+254700000001',
      passwordHash: 'seed_argon2_hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      policyAcceptedAt: nowIso,
      policyVersion: '1.0',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    IdentityStore.saveProfile({
      userId: CANONICAL_IDS.OWNER_ELENA,
      displayName: 'Elena Vance (Household Owner)',
      firstName: 'Elena',
      lastName: 'Vance',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: {
        emailNotifications: true,
        smsNotifications: true,
        emergencyAlerts: true,
      },
      privacyPreferences: {
        profileVisibility: 'HOUSEHOLD_ONLY',
        shareActivityWithHousehold: true,
      },
      updatedAt: nowIso,
    });
  }

  if (!IdentityStore.findHouseholdById(CANONICAL_IDS.MAIN_HOUSEHOLD)) {
    IdentityStore.saveHousehold({
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Vance & Kamau Household (Kilimani, Nairobi)',
      status: 'ACTIVE',
      ownerUserId: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // Ensure Canonical Pets in PetStore
  const requiredPets = [
    {
      petId: CANONICAL_IDS.PET_KIBO,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
      status: 'ACTIVE' as const,
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    },
    {
      petId: CANONICAL_IDS.PET_LUNA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Luna',
      speciesCode: 'CAT',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'FEMALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2020-03-10',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Calico',
      sizeClassification: 'SMALL' as const,
      lifecycleStage: 'ADULT' as const,
      status: 'ACTIVE' as const,
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    },
    {
      petId: CANONICAL_IDS.PET_SIMBA,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Simba',
      speciesCode: 'DOG',
      breedCode: 'GOLDEN_RETRIEVER',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'STERILIZED' as const,
      dateOfBirth: '2022-04-12',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Golden',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
      status: 'ACTIVE' as const,
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    },
    {
      petId: CANONICAL_IDS.PET_MAX,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      name: 'Max',
      speciesCode: 'DOG',
      breedCode: 'GERMAN_SHEPHERD',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE' as const,
      reproductiveStatus: 'INTACT' as const,
      dateOfBirth: '2019-11-20',
      birthdatePrecision: 'EXACT' as const,
      estimatedBirthdate: false,
      primaryColor: 'Black and Tan',
      sizeClassification: 'LARGE' as const,
      lifecycleStage: 'ADULT' as const,
      status: 'ACTIVE' as const,
      createdBy: CANONICAL_IDS.OWNER_ELENA,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      metadata: {},
    },
  ];

  for (const p of requiredPets) {
    if (!PetStore.findPetById(p.petId)) {
      PetStore.savePet(p);
    }
  }

  // 1. Ensure user profiles in IdentityStore
  const careUsers = [
    {
      userId: SEED_CARE_USERS.GROOMER_CHLOE,
      email: 'chloe.wanjiku@apexgrooming.ke',
      displayName: 'Chloe Wanjiku (Master Stylist)',
      firstName: 'Chloe',
      lastName: 'Wanjiku',
      phone: '+254711889900',
    },
    {
      userId: SEED_CARE_USERS.BOARDING_DAVID,
      email: 'david.kiprono@pethaven.ke',
      displayName: 'David Kiprono (Facility Director)',
      firstName: 'David',
      lastName: 'Kiprono',
      phone: '+254722889911',
    },
    {
      userId: SEED_CARE_USERS.BOARDING_STAFF_FAITH,
      email: 'faith.mutua@pethaven.ke',
      displayName: 'Faith Mutua (Shift Lead)',
      firstName: 'Faith',
      lastName: 'Mutua',
      phone: '+254733889922',
    },
  ];

  for (const u of careUsers) {
    if (!IdentityStore.findUserById(u.userId)) {
      IdentityStore.saveUser({
        userId: u.userId,
        email: u.email,
        normalizedEmail: u.email.toLowerCase(),
        phoneNumber: u.phone,
        passwordHash: 'seed_argon2_hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: nowIso,
        policyVersion: '1.0',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      IdentityStore.saveProfile({
        userId: u.userId,
        displayName: u.displayName,
        firstName: u.firstName,
        lastName: u.lastName,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: nowIso,
      });
    }
  }

  // Helper to build compliant seed bookings
  const createSeedBooking = (params: {
    bookingId: any;
    serviceOfferingId: any;
    providerId: any;
    businessId?: any;
    petIds: any[];
    startAt: string;
    endAt: string;
    amountMinor: number;
    title: string;
  }): BookingAggregate => ({
    bookingId: params.bookingId,
    serviceOfferingId: params.serviceOfferingId,
    providerId: params.providerId,
    businessId: params.businessId,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: params.petIds,
    ownerUserId: CANONICAL_IDS.OWNER_ELENA,
    status: 'CONFIRMED',
    confirmationMode: 'INSTANT_CONFIRM',
    startAt: params.startAt,
    endAt: params.endAt,
    serviceDurationMinutes: 60,
    timezone: 'Africa/Nairobi',
    petCount: params.petIds.length,
    petSnapshots: [],
    serviceSnapshot: {
      title: params.title,
      serviceType: 'GROOMING',
    } as any,
    priceSnapshot: {
      amountMinorUnits: params.amountMinor,
      currency: 'KES',
      pricingModel: 'FIXED',
      baseAmountMinorUnits: params.amountMinor,
      petCount: params.petIds.length,
      taxIncluded: true,
      feeBasisReference: 'FEE-SEED',
    },
    cancellationPolicySnapshot: {
      policyTier: 'STANDARD',
      freeCancellationCutoffHours: 24,
      lateCancellationNotice: 'Notice required',
      description: 'Standard cancellation policy',
    },
    instructions: {
      emergencyContactName: 'Elena Vance',
      emergencyContactPhone: '+254 700 112233',
    },
    concurrencyVersion: 1,
    requestedAt: nowIso,
    confirmedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // 2. Ensure Bookings in BookingStore
  const seedBookings: BookingAggregate[] = [
    createSeedBooking({
      bookingId: SEED_CARE_BOOKINGS.KIBO_GROOMING,
      serviceOfferingId: SEED_CARE_OFFERINGS.FULL_GROOM_DELUXE,
      providerId: SEED_CARE_PROVIDERS.CHLOE_GROOMER,
      businessId: SEED_CARE_BUSINESSES.APEX_GROOMING_LOFT,
      petIds: [CANONICAL_IDS.PET_KIBO],
      startAt: pastHourIso,
      endAt: futureHourIso,
      amountMinor: 450000,
      title: 'Full Coat Groom & De-shed',
    }),
    createSeedBooking({
      bookingId: SEED_CARE_BOOKINGS.LUNA_SITTING,
      serviceOfferingId: SEED_CARE_OFFERINGS.IN_HOME_SITTING_VISIT,
      providerId: SEED_CARE_PROVIDERS.SARAH_SITTER,
      petIds: [CANONICAL_IDS.PET_LUNA, CANONICAL_IDS.PET_SIMBA],
      startAt: pastHourIso,
      endAt: tomorrowIso,
      amountMinor: 600000,
      title: 'In-Home Sitter Visit',
    }),
    createSeedBooking({
      bookingId: SEED_CARE_BOOKINGS.MAX_BOARDING,
      serviceOfferingId: SEED_CARE_OFFERINGS.OVERNIGHT_BOARDING,
      providerId: SEED_CARE_PROVIDERS.DAVID_BOARDING,
      businessId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
      petIds: [CANONICAL_IDS.PET_MAX],
      startAt: pastHourIso,
      endAt: tomorrowIso,
      amountMinor: 850000,
      title: 'Overnight Kennel Suite Boarding',
    }),
  ];

  for (const b of seedBookings) {
    bookingStore.saveBooking(b);
  }

  // 3. Register Boarding Units for Nairobi Pet Haven
  const suite101 = service.registerBoardingUnit({
    facilityId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    unitNumber: 'K-101',
    unitType: 'KENNEL_DELUXE',
    maxCapacity: 2,
  });

  const suite102 = service.registerBoardingUnit({
    facilityId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    unitNumber: 'K-102',
    unitType: 'KENNEL_STANDARD',
    maxCapacity: 1,
  });

  const condo201 = service.registerBoardingUnit({
    facilityId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    unitNumber: 'C-201',
    unitType: 'CAT_CONDO',
    maxCapacity: 2,
  });

  // 4. Create Care Engagements
  // Engagement A: Grooming for Kibo
  const groomingEngagement = service.createEngagement({
    bookingId: SEED_CARE_BOOKINGS.KIBO_GROOMING,
    serviceType: 'GROOMING',
    serviceOfferingId: SEED_CARE_OFFERINGS.FULL_GROOM_DELUXE,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_KIBO],
    providerId: SEED_CARE_PROVIDERS.CHLOE_GROOMER,
    businessId: SEED_CARE_BUSINESSES.APEX_GROOMING_LOFT,
    assignedStaffId: SEED_CARE_USERS.GROOMER_CHLOE,
    scheduledStartAt: pastHourIso,
    scheduledEndAt: futureHourIso,
  });

  // Capture instruction snapshot
  service.captureInstructionSnapshot({
    engagementId: groomingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_KIBO,
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    stylingPreferences: 'Teddy bear face trim, hygiene clip, round paw trim',
    specialInstructions: 'Do not use eucalyptus scents. Paw pads sensitive.',
  });

  // Initialize Grooming Session
  const groomingSession = service.initializeGroomingSession({
    engagementId: groomingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_KIBO,
    coatType: 'Medium Double Coat',
    stylingPreferences: 'Teddy bear face, tidy feathering',
    sensitiveAreas: ['Paw pads sensitive', 'Right ear sensitive to high velocity dryer'],
    handlingNotes: 'Loves liver treats. Enjoys chin scratches.',
    procedures: ['BATH', 'DRY', 'BRUSH', 'DE_SHED', 'NAIL_TRIM', 'EAR_CLEANING', 'SANITARY_TRIM'],
  });

  // Execute intake handover
  service.executeHandover({
    engagementId: groomingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_KIBO,
    handoverType: 'OWNER_TO_PROVIDER',
    fromActorId: CANONICAL_IDS.OWNER_ELENA,
    toActorId: SEED_CARE_USERS.GROOMER_CHLOE,
    recipientName: 'Chloe Wanjiku',
    checklist: {
      collarAndTagVerified: true,
      leashOrCarrierSecure: true,
      petPhysicalStateObserved: true,
      personalBelongingsTransferred: true,
      emergencyContactConfirmed: true,
    },
    notes: 'Kibo arrived happy and relaxed in secure harness.',
  });

  // Complete some procedures
  service.completeGroomingProcedure({
    sessionId: groomingSession.sessionId,
    procedureType: 'BATH',
    notes: 'Used hypoallergenic oatmeal shampoo. Pet was calm in warm water.',
  });
  service.completeGroomingProcedure({
    sessionId: groomingSession.sessionId,
    procedureType: 'DRY',
    notes: 'Low velocity dryer used around face and ears.',
  });
  service.completeGroomingProcedure({
    sessionId: groomingSession.sessionId,
    procedureType: 'BRUSH',
    notes: 'Undercoat brushed out gently.',
  });

  // Record factual observation
  service.recordObservation({
    engagementId: groomingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_KIBO,
    category: 'COAT_SKIN',
    observationText: 'Mild redness observed on inner right paw pad. No open lesion or swelling. Cleaned gently.',
    recordedBy: SEED_CARE_USERS.GROOMER_CHLOE,
    severityIndicator: 'NORMAL',
  });

  // Engagement B: In-Home Pet Sitting for Luna & Simba
  const sittingEngagement = service.createEngagement({
    bookingId: SEED_CARE_BOOKINGS.LUNA_SITTING,
    serviceType: 'PET_SITTING_VISIT',
    serviceOfferingId: SEED_CARE_OFFERINGS.IN_HOME_SITTING_VISIT,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_LUNA, CANONICAL_IDS.PET_SIMBA],
    providerId: SEED_CARE_PROVIDERS.SARAH_SITTER,
    assignedStaffId: SEED_CARE_USERS.SITTER_SARAH,
    scheduledStartAt: pastHourIso,
    scheduledEndAt: futureHourIso,
  });

  service.captureInstructionSnapshot({
    engagementId: sittingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_LUNA,
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    specialInstructions: 'Water fountain in kitchen. Feed dry food in blue ceramic bowl.',
  });

  // Register protected Home Access Secret
  service.registerHomeAccessSecret({
    engagementId: sittingEngagement.engagementId,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    secretType: 'DOOR_KEYPAD_CODE',
    title: 'Front Entrance Keypad',
    maskedDisplay: '•••• 4892',
    unencryptedSecret: '4892#',
    instructions: 'Touch pad with palm to activate, enter code followed by #. Lock behind you by pressing any key.',
    accessWindowStart: pastHourIso,
    accessWindowEnd: futureHourIso,
  });

  // Schedule visits
  const visit1 = service.scheduleSitterVisit({
    engagementId: sittingEngagement.engagementId,
    petIds: [CANONICAL_IDS.PET_LUNA, CANONICAL_IDS.PET_SIMBA],
    visitNumber: 1,
    totalVisits: 2,
    scheduledStartAt: pastHourIso,
    scheduledEndAt: futureHourIso,
  });
  service.checkInSitterVisit(visit1.visitId);

  // Engagement C: Boarding Stay for Max
  const boardingEngagement = service.createEngagement({
    bookingId: SEED_CARE_BOOKINGS.MAX_BOARDING,
    serviceType: 'BOARDING',
    serviceOfferingId: SEED_CARE_OFFERINGS.OVERNIGHT_BOARDING,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    petIds: [CANONICAL_IDS.PET_MAX],
    providerId: SEED_CARE_PROVIDERS.DAVID_BOARDING,
    businessId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    assignedStaffId: SEED_CARE_USERS.BOARDING_DAVID,
    scheduledStartAt: pastHourIso,
    scheduledEndAt: tomorrowIso,
  });

  service.captureInstructionSnapshot({
    engagementId: boardingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_MAX,
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    specialInstructions: 'Bring favorite blue blanket into kennel suite.',
  });

  // Check in boarding stay
  const boardingStay = service.checkInBoardingStay({
    bookingId: SEED_CARE_BOOKINGS.MAX_BOARDING,
    engagementId: boardingEngagement.engagementId,
    facilityId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    petIds: [CANONICAL_IDS.PET_MAX],
    unitId: suite101.unitId,
    unitName: 'Deluxe Kennel K-101',
    scheduledCheckInAt: pastHourIso,
    scheduledCheckOutAt: tomorrowIso,
    primaryStaffId: SEED_CARE_USERS.BOARDING_DAVID,
  });

  // Execute intake handover
  service.executeHandover({
    engagementId: boardingEngagement.engagementId,
    petId: CANONICAL_IDS.PET_MAX,
    handoverType: 'OWNER_TO_FACILITY',
    fromActorId: CANONICAL_IDS.OWNER_ELENA,
    toActorId: SEED_CARE_USERS.BOARDING_DAVID,
    recipientName: 'David Kiprono (Nairobi Pet Haven)',
    checklist: {
      collarAndTagVerified: true,
      leashOrCarrierSecure: true,
      petPhysicalStateObserved: true,
      personalBelongingsTransferred: true,
      emergencyContactConfirmed: true,
    },
    notes: 'Max checked in smoothly with own food and favorite blanket.',
  });

  // Record daily care log
  service.recordDailyBoardingCare({
    stayId: boardingStay.stayId,
    date: now.toISOString().split('T')[0],
    mealsFed: 1,
    waterRefreshedCount: 2,
    medicationDosesAdministered: 0,
    outdoorExerciseMinutes: 45,
    groupPlayParticipation: false,
    restAndSleepObservation: 'Resting comfortably on elevated bed with blanket.',
    dailyNotes: 'Max settled in well, drank water immediately, explored courtyard happily.',
    loggedBy: SEED_CARE_USERS.BOARDING_DAVID,
  });

  // Seed a shift handover
  const shift = service.executeShiftHandover({
    facilityId: SEED_CARE_BUSINESSES.NAIROBI_PET_HAVEN,
    outgoingStaffId: SEED_CARE_USERS.BOARDING_DAVID,
    incomingStaffId: SEED_CARE_USERS.BOARDING_STAFF_FAITH,
    activePetIds: [CANONICAL_IDS.PET_MAX],
    outstandingMeals: ['Evening meal for Max (K-101) due at 18:30'],
    medicationsDue: [],
    openIncidents: [],
    shiftNotes: 'All pets settled. Max in K-101 walked at 15:00. Evening walk scheduled for 19:30.',
  });
  service.acknowledgeShiftHandover(shift.shiftHandoverId, SEED_CARE_USERS.BOARDING_STAFF_FAITH);
}
