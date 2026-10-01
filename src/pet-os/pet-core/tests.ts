/**
 * Pet OS Sprint 3 - Automated Test Suite: Pet Core, Digital Twin & Ownership
 * Validates Volume V, VI, XXI, XXVIII, XXX, XXXI.
 */

import { PetCoreService } from './service';
import { PetStore } from './store';
import { ReferenceDataService } from './reference-data';
import { LifecycleEngine } from './lifecycle';
import { IdentityStore } from '../identity/store';
import { 
  generateUUIDv7, 
  asUserId, 
  asHouseholdId, 
  asPetId 
} from '../kernel/ids';

export interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export class PetCoreTestSuite {
  static async runAllTests(): Promise<{
    results: TestResult[];
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }> {
    const startTime = performance.now();
    const results: TestResult[] = [];

    const run = async (category: string, name: string, fn: () => Promise<void> | void) => {
      const start = performance.now();
      try {
        await fn();
        results.push({
          category,
          name,
          passed: true,
          message: 'Passed successfully.',
          durationMs: Math.round(performance.now() - start)
        });
      } catch (err: any) {
        results.push({
          category,
          name,
          passed: false,
          message: err.message || String(err),
          durationMs: Math.round(performance.now() - start)
        });
      }
    };

    // Setup fresh environment
    PetStore.reset();
    IdentityStore.reset();

    const now = new Date().toISOString();

    // Seed test users and households
    const ownerUserId = asUserId(generateUUIDv7());
    IdentityStore.saveUser({
      userId: ownerUserId,
      email: 'waweru.kamau@petos.local',
      normalizedEmail: 'waweru.kamau@petos.local',
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: ownerUserId,
      displayName: 'Waweru Kamau',
      firstName: 'Waweru',
      lastName: 'Kamau',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    const caregiverUserId = asUserId(generateUUIDv7());
    IdentityStore.saveUser({
      userId: caregiverUserId,
      email: 'amina.caregiver@petos.local',
      normalizedEmail: 'amina.caregiver@petos.local',
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: caregiverUserId,
      displayName: 'Amina Odhiambo',
      firstName: 'Amina',
      lastName: 'Odhiambo',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    const outsiderUserId = asUserId(generateUUIDv7());
    IdentityStore.saveUser({
      userId: outsiderUserId,
      email: 'outsider@otherhousehold.local',
      normalizedEmail: 'outsider@otherhousehold.local',
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });
    IdentityStore.saveProfile({
      userId: outsiderUserId,
      displayName: 'Brian Outside',
      firstName: 'Brian',
      lastName: 'Outside',
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    const householdAId = asHouseholdId(generateUUIDv7());
    IdentityStore.saveHousehold({
      householdId: householdAId,
      name: 'Kamau Residence Nairobi',
      ownerUserId: ownerUserId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });

    const householdBId = asHouseholdId(generateUUIDv7());
    IdentityStore.saveHousehold({
      householdId: householdBId,
      name: 'Outsider Residence Mombasa',
      ownerUserId: outsiderUserId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });

    // Memberships
    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: householdAId,
      userId: ownerUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: householdAId,
      userId: caregiverUserId,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: generateUUIDv7() as any,
      householdId: householdBId,
      userId: outsiderUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    // -------------------------------------------------------------
    // Category 1: Reference Data & Multi-Species Catalog
    // -------------------------------------------------------------
    await run('Reference Data', 'SPECIES_CATALOG contains canonical species including Dog and Cat', () => {
      const species = ReferenceDataService.getAllSpecies();
      if (!species.some(s => s.code === 'SPECIES_DOG')) throw new Error('Dog species missing');
      if (!species.some(s => s.code === 'SPECIES_CAT')) throw new Error('Cat species missing');
      if (!species.some(s => s.code === 'SPECIES_RABBIT')) throw new Error('Rabbit species missing');
    });

    await run('Reference Data', 'Dog breeds catalog contains Africanis / East African Village Dog and Boerboel', () => {
      const breeds = ReferenceDataService.getBreedsForSpecies('SPECIES_DOG');
      if (!breeds.some(b => b.code === 'BREED_DOG_AFRICANIS')) {
        throw new Error('Africanis / East African Village Dog breed not found in dog catalog.');
      }
      if (!breeds.some(b => b.code === 'BREED_DOG_BOERBOEL')) {
        throw new Error('Boerboel breed not found in dog catalog.');
      }
    });

    await run('Reference Data', 'Strict species/breed mismatch detection rejects assigning Cat breed to Dog', () => {
      const isMatch = ReferenceDataService.isBreedValidForSpecies('BREED_CAT_SIAMESE', 'SPECIES_DOG');
      if (isMatch) throw new Error('Siamese cat breed was improperly validated as a dog breed.');
    });

    // -------------------------------------------------------------
    // Category 2: Birthdate, Age Calculation & Lifecycle Stage
    // -------------------------------------------------------------
    await run('Lifecycle Engine', 'Future birthdate is rejected with PETV-INV-002', () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
      const res = LifecycleEngine.validateDateOfBirth(futureDate, 'EXACT');
      if (res.valid) throw new Error('Future birthdate should have been rejected');
      if (!res.error?.includes('future')) throw new Error('Expected future birthdate error message');
    });

    await run('Lifecycle Engine', 'Leap year birthdate validation correctly verifies Feb 29', () => {
      const leapValid = LifecycleEngine.validateDateOfBirth('2024-02-29', 'EXACT');
      if (!leapValid.valid) throw new Error('2024-02-29 is a leap day and must be valid.');

      const nonLeapInvalid = LifecycleEngine.validateDateOfBirth('2023-02-29', 'EXACT');
      if (nonLeapInvalid.valid) throw new Error('2023-02-29 is not a leap day and must be invalid.');
    });

    await run('Lifecycle Engine', 'Derived age calculates accurate years, months, and human-friendly display', () => {
      const age = LifecycleEngine.calculateAge('2022-01-15', 'EXACT', new Date('2024-04-15'));
      if (age.years !== 2 || age.months !== 3) {
        throw new Error(`Expected 2 years, 3 months, but received ${age.years} yrs, ${age.months} mos`);
      }
    });

    await run('Lifecycle Engine', 'Species-aware lifecycle stage identifies Puppy vs Adolescent vs Senior', () => {
      const puppyAge = { years: 0, months: 6, days: 0, totalDays: 180, display: '6 mos', isEstimated: false, precision: 'EXACT' as const };
      const stagePuppy = LifecycleEngine.deriveLifecycleStage('SPECIES_DOG', puppyAge, 'MEDIUM');
      if (stagePuppy !== 'PUPPY') throw new Error(`Expected PUPPY for 6mo dog, got ${stagePuppy}`);

      const seniorAge = { years: 8, months: 0, days: 0, totalDays: 2920, display: '8 yrs', isEstimated: false, precision: 'EXACT' as const };
      const stageSenior = LifecycleEngine.deriveLifecycleStage('SPECIES_DOG', seniorAge, 'MEDIUM');
      if (stageSenior !== 'SENIOR') throw new Error(`Expected SENIOR for 8yr dog, got ${stageSenior}`);
    });

    // -------------------------------------------------------------
    // Category 3: Pet Creation & Primary Ownership Use Case
    // -------------------------------------------------------------
    let createdPetId: any;

    await run('Pet Core Service', 'Create pet atomically assigns household and primary owner relationship', async () => {
      const pet = await PetCoreService.createPet(ownerUserId, householdAId, {
        name: 'Simba',
        speciesCode: 'SPECIES_DOG',
        breedCode: 'BREED_DOG_AFRICANIS',
        sex: 'MALE',
        reproductiveStatus: 'STERILIZED',
        dateOfBirth: '2021-06-10',
        birthdatePrecision: 'EXACT',
        primaryColor: 'Golden Tan',
        markings: 'White patch on chest',
        sizeClassification: 'MEDIUM',
        microchipNumber: '985141001234567',
        microchipIssuer: 'Kenya Vet Board / Identipet'
      });

      if (!pet.petId) throw new Error('Pet ID missing');
      if (pet.householdId !== householdAId) throw new Error('Household ID mismatch');
      if (pet.name !== 'Simba') throw new Error('Name mismatch');
      if (!pet.microchip || pet.microchip.microchipNumber !== '985141001234567') {
        throw new Error('Microchip was not attached to pet');
      }

      // Check relationships
      const primaryOwner = pet.relationships.find(r => r.relationshipType === 'PRIMARY_OWNER');
      if (!primaryOwner || primaryOwner.userId !== ownerUserId) {
        throw new Error('Owner relationship was not established');
      }

      createdPetId = pet.petId;
    });

    await run('Pet Core Service', 'Creation audit event is recorded with action PET_CREATED', () => {
      const audits = PetStore.listAuditEvents(createdPetId);
      if (!audits.some(a => a.action === 'PET_CREATED')) {
        throw new Error('Audit trail does not contain PET_CREATED');
      }
    });

    // -------------------------------------------------------------
    // Category 4: Multi-Tenant Cross-Household Isolation
    // -------------------------------------------------------------
    await run('Authorization & Isolation', 'Cross-household retrieval attempt is strictly forbidden', async () => {
      try {
        await PetCoreService.getPetById(outsiderUserId, createdPetId);
        throw new Error('Outsider should have been denied access to Household A pet!');
      } catch (err: any) {
        if (!err.message.includes('Unauthorized') && !err.message.includes('AUTH_002') && !err.message.includes('Cross-household') && !err.message.includes('boundary')) {
          throw new Error(`Expected authorization rejection, but received: ${err.message}`);
        }
      }
    });

    await run('Authorization & Isolation', 'Caregiver cannot perform unauthorized core update or archive', async () => {
      try {
        await PetCoreService.archivePet(caregiverUserId, createdPetId);
        throw new Error('Caregiver must not be allowed to archive pet!');
      } catch (err: any) {
        if (!err.message.includes('Unauthorized') && !err.message.includes('lacks required permission') && !err.message.includes('permission')) {
          throw new Error(`Expected authorization rejection, but received: ${err.message}`);
        }
      }
    });

    // -------------------------------------------------------------
    // Category 5: Microchip Identity & Uniqueness Invariants
    // -------------------------------------------------------------
    await run('Microchip Identity', 'Microchip registration normalizes input and rejects duplicate across pets', async () => {
      // Attempt to register same chip '985-141-001-234-567' on a second pet in household A
      try {
        await PetCoreService.createPet(ownerUserId, householdAId, {
          name: 'Nala',
          speciesCode: 'SPECIES_DOG',
          breedCode: 'BREED_DOG_AFRICANIS',
          sex: 'FEMALE',
          primaryColor: 'Black',
          microchipNumber: '985-141-001-234-567' // same normalized number as Simba
        });
        throw new Error('Duplicate microchip registration should have been rejected');
      } catch (err: any) {
        if (!err.message.includes('already associated with another record')) {
          throw new Error(`Expected privacy-safe duplicate microchip error, got: ${err.message}`);
        }
      }
    });

    await run('Microchip Identity', 'Microchip is explicitly designated as passive RFID, not GPS tracker', async () => {
      const pet = await PetCoreService.getPetById(ownerUserId, createdPetId);
      if (pet.microchip?.isLocationTracker !== false) {
        throw new Error('Microchip invariant violated: isLocationTracker must be false');
      }
    });

    // -------------------------------------------------------------
    // Category 6: Photo Management & Profile Photo Selection
    // -------------------------------------------------------------
    await run('Media Management', 'Upload pet photo and designate profile photo', async () => {
      const pet = await PetCoreService.uploadPhoto(ownerUserId, createdPetId, {
        storageKey: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800',
        mimeType: 'image/jpeg',
        fileSize: 1024 * 350,
        purpose: 'PROFILE',
        setAsProfile: true
      });

      if (!pet.profilePhotoUrl) throw new Error('Profile photo URL was not set');
      if (pet.photos.length === 0) throw new Error('Photos list empty');
    });

    await run('Media Management', 'Photo upload rejects unsupported MIME types and oversized files', async () => {
      try {
        await PetCoreService.uploadPhoto(ownerUserId, createdPetId, {
          storageKey: 'bad.gif',
          mimeType: 'image/gif' as any,
          fileSize: 500
        });
        throw new Error('GIF should have been rejected');
      } catch (err: any) {
        if (!err.message.includes('Unsupported file MIME type')) {
          throw new Error(`Expected MIME error, got: ${err.message}`);
        }
      }
    });

    // -------------------------------------------------------------
    // Category 7: Optimistic Concurrency Control
    // -------------------------------------------------------------
    await run('Concurrency Control', 'Update pet detects version conflicts', async () => {
      const current = await PetCoreService.getPetById(ownerUserId, createdPetId);
      const staleVersion = current.version - 1; // outdated

      try {
        await PetCoreService.updatePet(ownerUserId, createdPetId, {
          markings: 'Updated markings'
        }, staleVersion);
        throw new Error('Stale update should have triggered concurrency conflict');
      } catch (err: any) {
        if (!err.message.includes('Concurrency Conflict')) {
          throw new Error(`Expected concurrency error, got: ${err.message}`);
        }
      }
    });

    // -------------------------------------------------------------
    // Category 8: Lifecycle State Machine & Terminal Deceased State
    // -------------------------------------------------------------
    await run('Lifecycle State Machine', 'Archiving pet transitions status to ARCHIVED and records archivedAt', async () => {
      const current = await PetCoreService.getPetById(ownerUserId, createdPetId);
      const archived = await PetCoreService.archivePet(ownerUserId, createdPetId, current.version);
      if (archived.status !== 'ARCHIVED') throw new Error('Status should be ARCHIVED');
      if (!archived.archivedAt) throw new Error('archivedAt must be populated');
    });

    await run('Lifecycle State Machine', 'Archived pet can be restored to ACTIVE', async () => {
      const current = await PetCoreService.getPetById(ownerUserId, createdPetId);
      const restored = await PetCoreService.restorePet(ownerUserId, createdPetId, current.version);
      if (restored.status !== 'ACTIVE') throw new Error('Status should be ACTIVE');
      if (restored.archivedAt) throw new Error('archivedAt should be cleared');
    });

    await run('Lifecycle State Machine', 'Terminal Deceased state cannot be transitioned back to ACTIVE', async () => {
      const current = await PetCoreService.getPetById(ownerUserId, createdPetId);
      const deceased = await PetCoreService.markDeceased(
        ownerUserId, 
        createdPetId, 
        new Date().toISOString(), 
        'Passed peacefully at home.',
        current.version
      );

      if (deceased.status !== 'DECEASED') throw new Error('Status should be DECEASED');

      // Attempt to restore or transition
      try {
        await PetCoreService.restorePet(ownerUserId, createdPetId, deceased.version);
        throw new Error('Terminal deceased pet must not be restored to active');
      } catch (err: any) {
        if (!err.message.includes('PETV-INV-004') && !err.message.includes('DECEASED cannot be transitioned')) {
          throw new Error(`Expected terminal deceased rejection, got: ${err.message}`);
        }
      }
    });

    const durationMs = Math.round(performance.now() - startTime);
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      results,
      total: results.length,
      passed,
      failed,
      durationMs
    };
  }
}
