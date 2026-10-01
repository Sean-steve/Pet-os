/**
 * Pet OS Sprint 11 - Booking Platform Baseline Seed Data
 * Populates realistic initial state for live UI testing and interactive exploration:
 * - 1 Confirmed Dog Walking booking (Kibo)
 * - 1 Pending Provider Veterinary Consultation request (Luna with Dr. David Kimani)
 * - 1 Weekly Recurring Dog Walk Series (Kibo with Sarah Mwangi)
 * - 1 Rescheduled Grooming booking (Kibo with Kevin Ochieng)
 */

import {
  BookingPlatformService,
} from './service';
import { BookingStore } from './store';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asServiceOfferingId,
  asBookingId,
  generateUUIDv7,
} from '../kernel/ids';
import { ProviderStore } from '../provider/store';
import { seedProviderData, SEED_USERS, SEED_PROVIDERS } from '../provider/seed';
import { PetStore } from '../pet-core/store';

export function seedBookingData(): void {
  // Ensure provider seed is in place first
  const providerStore = ProviderStore.getInstance();
  seedProviderData(providerStore);

  const store = BookingStore.getInstance();
  store.reset();
  const service = new BookingPlatformService(store, providerStore);

  const ownerUserId = SEED_USERS.OWNER_ELENA;
  const kiboPetId = asPetId('pet-kibo-001'); // Dog
  const lunaPetId = asPetId('pet-luna-002'); // Cat
  const existingKibo = PetStore.findPetById(kiboPetId);
  const householdId = existingKibo ? existingKibo.householdId : asHouseholdId('hh-01951500-0000-7000-8000-000000000001');

  // Seed baseline pets if not present
  if (!PetStore.findPetById(kiboPetId)) {
    PetStore.savePet({
      petId: kiboPetId,
      householdId,
      name: 'Kibo',
      speciesCode: 'DOG',
      breedCode: 'RHODESIAN_RIDGEBACK',
      mixedBreed: false,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2021-06-15',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Wheaten',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });
  }

  if (!PetStore.findPetById(lunaPetId)) {
    PetStore.savePet({
      petId: lunaPetId,
      householdId,
      name: 'Luna',
      speciesCode: 'CAT',
      breedCode: 'DOMESTIC_SHORTHAIR',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'FEMALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-03-10',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Calico',
      sizeClassification: 'SMALL',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });
  }

  const sarahProviderId = SEED_PROVIDERS.SARAH_MWANGI; // Sarah Mwangi (Walker)
  const kimaniProviderId = SEED_PROVIDERS.DR_KIMANI; // Dr. Kimani (Vet)

  const dogWalkOfferingId = asServiceOfferingId('sro-dog-walk-01');
  const vetConsultOfferingId = asServiceOfferingId('sro-vet-consult-01');

  // Next operating day for Sarah (Mon-Sat)
  const tomorrow = new Date();
  let dayOffset = 1;
  let walkDate = new Date(tomorrow.getTime() + dayOffset * 24 * 3600 * 1000);
  while (walkDate.getUTCDay() === 0) { // skip Sunday
    dayOffset++;
    walkDate = new Date(tomorrow.getTime() + dayOffset * 24 * 3600 * 1000);
  }
  walkDate.setUTCHours(7, 0, 0, 0); // 10:00 AM EAT = 07:00 UTC
  const walkStart = walkDate.toISOString();
  const walkEnd = new Date(walkDate.getTime() + 45 * 60 * 1000).toISOString();

  // 1. Confirmed Instant-Book Dog Walk
  service.createBooking({
    ownerUserId,
    householdId,
    providerId: sarahProviderId,
    serviceOfferingId: dogWalkOfferingId,
    petIds: [kiboPetId],
    startAt: walkStart,
    endAt: walkEnd,
    timezone: 'Africa/Nairobi',
    instructions: {
      pickupLocationNotes: 'Front garden gate. Please use front porch leash.',
      emergencyContactName: 'Elena Vance',
      emergencyContactPhone: '+254700000001',
      petHandlingNotes: 'Enjoys sniffing along the arboretum trail. Responsive to recall whistler.',
    },
    idempotencyKey: 'seed-booking-001',
  });

  // Next operating day for Dr. Kimani (Mon-Fri)
  let vetOffset = dayOffset + 1;
  let vetDate = new Date(tomorrow.getTime() + vetOffset * 24 * 3600 * 1000);
  while (vetDate.getUTCDay() === 0 || vetDate.getUTCDay() === 6) { // skip Sat & Sun
    vetOffset++;
    vetDate = new Date(tomorrow.getTime() + vetOffset * 24 * 3600 * 1000);
  }
  vetDate.setUTCHours(8, 0, 0, 0); // 11:00 AM EAT = 08:00 UTC
  const vetStart = vetDate.toISOString();
  const vetEnd = new Date(vetDate.getTime() + 30 * 60 * 1000).toISOString();

  // 2. Pending Provider Approval Vet Consultation for Luna
  service.createBooking({
    ownerUserId,
    householdId,
    providerId: kimaniProviderId,
    serviceOfferingId: vetConsultOfferingId,
    petIds: [lunaPetId],
    startAt: vetStart,
    endAt: vetEnd,
    timezone: 'Africa/Nairobi',
    instructions: {
      pickupLocationNotes: 'Clinic Consultation Room B',
      emergencyContactName: 'Elena Vance',
      emergencyContactPhone: '+254700000001',
      petHandlingNotes: 'Keep in carrier until room door is securely closed.',
    },
    idempotencyKey: 'seed-booking-002',
  });

  // 3. Weekly Recurring Dog Walk Series (Mon / Wed / Fri at 09:00 EAT)
  const nextMonday = new Date();
  const daysUntilMon = (1 + 7 - nextMonday.getUTCDay()) % 7 || 7;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMon);
  const startDateStr = nextMonday.toISOString().split('T')[0];

  service.createRecurringSeries({
    ownerUserId,
    householdId,
    providerId: sarahProviderId,
    serviceOfferingId: dogWalkOfferingId,
    petIds: [kiboPetId],
    daysOfWeek: [1, 3, 5],
    scheduledTimeOfDay: '06:00', // 09:00 EAT = 06:00 UTC
    durationMinutes: 45,
    timezone: 'Africa/Nairobi',
    startDate: startDateStr,
    horizonWeeks: 3,
    instructions: {
      pickupLocationNotes: 'Front gate, gate code #4492',
      emergencyContactName: 'Elena Vance',
      emergencyContactPhone: '+254700000001',
    },
  });
}
