/**
 * Pet OS Kernel - Canonical Identifiers
 * 
 * Provides single source of truth for canonical test and domain identifiers
 * across households, users, providers, and pets.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  asUserId,
  asHouseholdId,
  asPetId,
  asServiceOfferingId,
  asProviderId,
} from './ids';

export const CANONICAL_IDS = {
  // Households
  MAIN_HOUSEHOLD: asHouseholdId('hh-01951500-0000-7000-8000-000000000001'),
  BOOKING_HOUSEHOLD: asHouseholdId('hh-01955000-0001-7000-8000-000000000001'),
  LEGACY_HOUSEHOLD_001: asHouseholdId('household-001'),
  LEGACY_HOUSEHOLD_SPRINT4: asHouseholdId('hh-sprint4-main'),
  OUTSIDER_HOUSEHOLD: asHouseholdId('hh-01951500-0000-7000-8000-000000000099'),
  OUTSIDER_HOUSEHOLD_LEGACY: asHouseholdId('household-002'),

  // Users
  OWNER_ELENA: asUserId('usr-01951500-0000-7000-8000-000000000001'),
  CAREGIVER_SEAN: asUserId('usr-01951500-0000-7000-8000-000000000002'),
  MEMBER_AMINA: asUserId('usr-01951500-0000-7000-8000-000000000003'),
  ADMIN_CHARLES: asUserId('usr-01951500-0000-7000-8000-000000000099'),
  OUTSIDER_BRIAN: asUserId('usr-01951500-0000-7000-8000-000000000088'),

  // Legacy user ID aliases
  LEGACY_OWNER_USER: asUserId('user-owner-001'),
  LEGACY_ALICE_OWNER: asUserId('usr-alice-owner'),
  LEGACY_BOB_CAREGIVER: asUserId('usr-bob-caregiver'),
  LEGACY_CHARLIE_OUTSIDER: asUserId('usr-charlie-outsider'),

  // Providers
  VET_DR_KIMANI: asProviderId('prv-kimani-vet-001'),
  WALKER_SARAH: asProviderId('prv-sarah-walker-001'),
  WALKER_SARAH_USER: asUserId('usr-01951500-0000-7000-8000-000000000102'),
  PROVIDER_SARAH: asUserId('usr-01951500-0000-7000-8000-000000000102'),
  TRAINER_JUMA: asProviderId('prv-juma-trainer-001'),

  // Service Offerings
  OFFERING_DOG_WALK: asServiceOfferingId('sro-dog-walk-01'),
  OFFERING_VET_CONSULT: asServiceOfferingId('sro-vet-consult-01'),
  OFFERING_TRAINING: asServiceOfferingId('sro-behavior-training-01'),

  // Pets
  PET_KIBO: asPetId('pet-kibo-001'),
  BUDDY: asPetId('pet-kibo-001'),
  PET_SIMBA: asPetId('pet-001'),
  PET_LUNA: asPetId('pet-luna-002'),
  LUNA: asPetId('pet-luna-002'),
  PET_LUNA_ALIAS: asPetId('pet-01951500-0000-7000-8000-000000000002'),
  PET_MAX: asPetId('pet-01951500-0000-7000-8000-000000000001'),

  // Sprint 18 - Rescue Organizations & Shelters
  RESCUE_ORG_NAIROBI: 'org-01951800-0000-7000-8000-000000000001' as any,
  RESCUE_ORG_KSPCA: 'org-01951800-0000-7000-8000-000000000002' as any,
  RESCUE_FACILITY_WESTLANDS: 'fac-01951800-0000-7000-8000-000000000001' as any,
  RESCUE_FACILITY_KAREN: 'fac-01951800-0000-7000-8000-000000000002' as any,
};

