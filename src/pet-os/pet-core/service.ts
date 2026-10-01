/**
 * Pet OS Sprint 3 - Pet Core Application Service
 * Coordinates use cases for Pet Digital Twin, ownership, microchips, photos, and lifecycle transitions.
 * Implements Volume V, VI, XXI, XXVIII, XXX, XXXI.
 */

import { 
  Pet, 
  CreatePetPayload, 
  UpdatePetPayload, 
  RegisterMicrochipPayload, 
  UploadPhotoPayload, 
  PetSummaryDto, 
  PetDetailDto, 
  PetRelationshipType, 
  PetStatus 
} from './types';
import { PetStore } from './store';
import { ReferenceDataService } from './reference-data';
import { LifecycleEngine } from './lifecycle';
import { PetEventFactory } from './events';
import { IdentityStore } from '../identity/store';
import { AuthorizationService } from '../identity/authorization';
import { 
  PetId, 
  HouseholdId, 
  UserId, 
  PetPhotoId, 
  MicrochipId, 
  PetRelationshipId, 
  generateUUIDv7, 
  asPetId, 
  asPetPhotoId, 
  asMicrochipId, 
  asPetRelationshipId 
} from '../kernel/ids';

export class PetCoreService {
  /**
   * Use Case 21: Create Pet Workflow
   * Transactional creation of Pet entity + initial PRIMARY_OWNER relationship + optional Microchip + optional Photo.
   */
  static async createPet(
    actorId: string,
    householdId: HouseholdId,
    payload: CreatePetPayload,
    correlationId?: string
  ): Promise<PetDetailDto> {
    // 1. Authorize actor on household
    const auth = AuthorizationService.checkHouseholdPermission(actorId, householdId, 'pet.create');
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized: Actor lacks pet.create permission on household.');
    }

    // 2. Validate species
    const species = ReferenceDataService.getSpeciesByCode(payload.speciesCode);
    if (!species) {
      throw new Error(`Invalid species code: ${payload.speciesCode}. Must be a supported canonical species.`);
    }

    // 3. Validate breed & species matching
    let finalBreedCode = payload.breedCode;
    let isMixed = !!payload.mixedBreed;
    let isUnknown = !!payload.unknownBreed;

    if (isUnknown) {
      finalBreedCode = payload.speciesCode === 'SPECIES_DOG' ? 'BREED_DOG_UNKNOWN' : 
                       payload.speciesCode === 'SPECIES_CAT' ? 'BREED_CAT_UNKNOWN' : 'BREED_RABBIT_UNKNOWN';
    } else if (isMixed) {
      finalBreedCode = finalBreedCode || (payload.speciesCode === 'SPECIES_DOG' ? 'BREED_DOG_MIXED' : 'BREED_CAT_MIXED');
    } else {
      if (!finalBreedCode) {
        throw new Error('Breed is required when pet is not marked as unknown or mixed breed.');
      }
      // Strictly prevent cross-species mismatch (e.g. cat breed assigned to dog)
      const breedValid = ReferenceDataService.isBreedValidForSpecies(finalBreedCode, payload.speciesCode);
      if (!breedValid) {
        throw new Error(`Breed ${finalBreedCode} does not belong to species ${payload.speciesCode} (PETV-INV-003).`);
      }
    }

    // 4. Validate birthdate & precision
    const precision = payload.birthdatePrecision || (payload.dateOfBirth ? 'EXACT' : 'UNKNOWN');
    if (payload.dateOfBirth) {
      const dateValidation = LifecycleEngine.validateDateOfBirth(payload.dateOfBirth, precision);
      if (!dateValidation.valid) {
        throw new Error(dateValidation.error || 'Invalid date of birth provided.');
      }
    }

    // 5. Derive initial age & lifecycle stage
    const derivedAge = LifecycleEngine.calculateAge(payload.dateOfBirth, precision);
    const lifecycleStage = LifecycleEngine.deriveLifecycleStage(
      payload.speciesCode, 
      derivedAge, 
      payload.sizeClassification || 'MEDIUM'
    );

    // 6. Microchip Pre-validation & Uniqueness Check (if provided)
    let normalizedChipNumber: string | undefined;
    if (payload.microchipNumber) {
      normalizedChipNumber = ReferenceDataService.normalizeMicrochipNumber(payload.microchipNumber);
      if (!ReferenceDataService.validateMicrochipNumber(normalizedChipNumber)) {
        throw new Error('Microchip number must be between 9 and 15 alphanumeric characters.');
      }

      // Check global uniqueness across active pets with privacy-safe error
      const existingChip = PetStore.findActiveMicrochipByNumber(normalizedChipNumber);
      if (existingChip) {
        throw new Error('The supplied microchip identifier is already associated with another record.');
      }
    }

    // 7. Atomic Pet Aggregate Construction
    const petId = asPetId(generateUUIDv7());
    const now = new Date().toISOString();

    const pet: Pet = {
      petId,
      householdId,
      name: payload.name.trim(),
      speciesCode: payload.speciesCode,
      breedCode: finalBreedCode || 'BREED_DOG_UNKNOWN',
      secondaryBreedCode: payload.secondaryBreedCode,
      mixedBreed: isMixed,
      unknownBreed: isUnknown,
      customBreedName: payload.customBreedName,
      sex: payload.sex || 'UNKNOWN',
      reproductiveStatus: payload.reproductiveStatus || 'UNKNOWN',
      dateOfBirth: payload.dateOfBirth,
      birthdatePrecision: precision,
      estimatedBirthdate: precision !== 'EXACT',
      primaryColor: payload.primaryColor.trim(),
      secondaryColor: payload.secondaryColor?.trim(),
      markings: payload.markings?.trim(),
      coatType: payload.coatType?.trim(),
      sizeClassification: payload.sizeClassification || 'MEDIUM',
      lifecycleStage,
      status: 'ACTIVE',
      createdBy: actorId as UserId,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: payload.metadata || {}
    };

    PetStore.savePet(pet);

    // 8. Create Atomic Initial Relationship (Actor as PRIMARY_OWNER)
    const relId = asPetRelationshipId(generateUUIDv7());
    PetStore.saveRelationship({
      relationshipId: relId,
      petId,
      userId: actorId as UserId,
      relationshipType: 'PRIMARY_OWNER',
      isPrimaryContact: true,
      createdAt: now,
      updatedAt: now
    });

    // 9. Attach Initial Microchip if provided
    if (normalizedChipNumber) {
      const chipId = asMicrochipId(generateUUIDv7());
      PetStore.saveMicrochip({
        microchipId: chipId,
        petId,
        microchipNumber: normalizedChipNumber,
        issuer: payload.microchipIssuer,
        verificationStatus: 'UNVERIFIED',
        createdAt: now,
        updatedAt: now
      });

      PetStore.recordOutboxEvent(
        PetEventFactory.petMicrochipRegistered(petId, chipId, normalizedChipNumber, actorId as UserId)
      );
    }

    // 10. Attach Initial Photo if provided
    if (payload.initialPhotoUrl) {
      const photoId = asPetPhotoId(generateUUIDv7());
      PetStore.savePhoto({
        photoId,
        petId,
        storageKey: payload.initialPhotoUrl,
        mimeType: 'image/jpeg',
        fileSize: 1024 * 100, // sample placeholder size
        purpose: 'PROFILE',
        uploadedBy: actorId as UserId,
        uploadedAt: now
      });

      pet.profilePhotoId = photoId;
      PetStore.savePet(pet);
    }

    // 11. Record Audit Event & Emit Domain Event
    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId,
      actorUserId: actorId as UserId,
      action: 'PET_CREATED',
      occurredAt: now,
      correlationId,
      metadata: { name: pet.name, species: pet.speciesCode, breed: pet.breedCode }
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petCreated(petId, householdId, pet.name, pet.speciesCode, pet.breedCode, pet.sex, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 25: Authorized Pet Detail Retrieval
   * Enforces cross-household isolation.
   */
  static async getPetById(actorId: string, petId: PetId): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} was not found.`);
    }

    // Server-side authorization check (must be an active member of the pet's household)
    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.read');
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to pet.');
    }

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 24: List Pets for Current Household
   * Prevents cross-household parameter manipulation.
   */
  static async listPetsForHousehold(
    actorId: string,
    householdId: HouseholdId,
    filter?: { status?: PetStatus; speciesCode?: string; includeArchived?: boolean }
  ): Promise<PetSummaryDto[]> {
    // Authorize caller has access to this household
    const auth = AuthorizationService.checkHouseholdPermission(actorId, householdId, 'pet.read');
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to household pets.');
    }

    const pets = PetStore.listPetsByHousehold(householdId);

    return pets
      .filter(p => {
        // Exclude archived pets by default unless explicitly requested
        if (!filter?.includeArchived && p.status === 'ARCHIVED') return false;
        if (filter?.status && p.status !== filter.status) return false;
        if (filter?.speciesCode && p.speciesCode !== filter.speciesCode) return false;
        return true;
      })
      .map(p => this.getPetSummaryDto(p));
  }

  /**
   * Use Case 22: Controlled Pet Update
   * Rejects mutating immutable fields, handles optimistic concurrency via version.
   */
  static async updatePet(
    actorId: string,
    petId: PetId,
    payload: UpdatePetPayload,
    expectedVersion?: number,
    correlationId?: string
  ): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet with ID ${petId} was not found.`);

    // Authorize
    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.update');
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized: Lacks pet.update permission.');
    }

    // Optimistic Concurrency Check
    if (expectedVersion !== undefined && pet.version !== expectedVersion) {
      throw new Error(`Concurrency Conflict: Pet record was modified by another transaction. Expected version ${expectedVersion}, but found ${pet.version}.`);
    }

    // Archived or Deceased Mutation Guard
    if (pet.status === 'ARCHIVED' || pet.status === 'DECEASED') {
      throw new Error(`Cannot modify profile fields of a pet with status ${pet.status}.`);
    }

    const changedFields: string[] = [];

    // Species / Breed Update Verification
    if (payload.speciesCode && payload.speciesCode !== pet.speciesCode) {
      const species = ReferenceDataService.getSpeciesByCode(payload.speciesCode);
      if (!species) throw new Error(`Invalid species ${payload.speciesCode}`);
      pet.speciesCode = payload.speciesCode;
      changedFields.push('speciesCode');
    }

    if (payload.breedCode !== undefined) {
      if (payload.breedCode) {
        const valid = ReferenceDataService.isBreedValidForSpecies(payload.breedCode, pet.speciesCode);
        if (!valid && !payload.mixedBreed && !payload.unknownBreed) {
          throw new Error(`Breed ${payload.breedCode} does not match species ${pet.speciesCode}.`);
        }
      }
      pet.breedCode = payload.breedCode || pet.breedCode;
      changedFields.push('breedCode');
    }

    if (payload.name && payload.name.trim() !== pet.name) {
      pet.name = payload.name.trim();
      changedFields.push('name');
    }

    if (payload.sex && payload.sex !== pet.sex) {
      pet.sex = payload.sex;
      changedFields.push('sex');
    }

    if (payload.reproductiveStatus && payload.reproductiveStatus !== pet.reproductiveStatus) {
      pet.reproductiveStatus = payload.reproductiveStatus;
      changedFields.push('reproductiveStatus');
    }

    if (payload.mixedBreed !== undefined) pet.mixedBreed = payload.mixedBreed;
    if (payload.unknownBreed !== undefined) pet.unknownBreed = payload.unknownBreed;
    if (payload.customBreedName !== undefined) pet.customBreedName = payload.customBreedName;

    // Date of Birth Update
    if (payload.dateOfBirth !== undefined || payload.birthdatePrecision !== undefined) {
      const newDob = payload.dateOfBirth !== undefined ? payload.dateOfBirth : pet.dateOfBirth;
      const newPrecision = payload.birthdatePrecision || pet.birthdatePrecision;

      if (newDob) {
        const validation = LifecycleEngine.validateDateOfBirth(newDob, newPrecision);
        if (!validation.valid) throw new Error(validation.error);
      }

      pet.dateOfBirth = newDob;
      pet.birthdatePrecision = newPrecision;
      pet.estimatedBirthdate = newPrecision !== 'EXACT';
      changedFields.push('dateOfBirth', 'birthdatePrecision');
    }

    // Physical characteristics
    if (payload.primaryColor) pet.primaryColor = payload.primaryColor.trim();
    if (payload.secondaryColor !== undefined) pet.secondaryColor = payload.secondaryColor?.trim();
    if (payload.markings !== undefined) pet.markings = payload.markings?.trim();
    if (payload.coatType !== undefined) pet.coatType = payload.coatType?.trim();
    if (payload.sizeClassification) pet.sizeClassification = payload.sizeClassification;

    // Recalculate derived lifecycle stage
    const derivedAge = LifecycleEngine.calculateAge(pet.dateOfBirth, pet.birthdatePrecision);
    pet.lifecycleStage = LifecycleEngine.deriveLifecycleStage(pet.speciesCode, derivedAge, pet.sizeClassification);

    pet.updatedAt = new Date().toISOString();
    pet.version += 1;

    PetStore.savePet(pet);

    // Audit & Event
    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_UPDATED',
      changedFields,
      occurredAt: pet.updatedAt,
      correlationId
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petUpdated(petId, pet.householdId, changedFields, pet.version, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 26: Pet Archival
   */
  static async archivePet(actorId: string, petId: PetId, expectedVersion?: number): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.archive');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.archive permission.');

    if (expectedVersion !== undefined && pet.version !== expectedVersion) {
      throw new Error(`Concurrency Conflict: Expected version ${expectedVersion}, found ${pet.version}.`);
    }

    const transition = LifecycleEngine.validateStatusTransition(pet.status, 'ARCHIVED');
    if (!transition.allowed) {
      throw new Error(transition.message || 'Invalid transition to ARCHIVED.');
    }

    pet.status = 'ARCHIVED';
    pet.archivedAt = new Date().toISOString();
    pet.updatedAt = pet.archivedAt;
    pet.version += 1;

    PetStore.savePet(pet);

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_ARCHIVED',
      occurredAt: pet.archivedAt
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petArchived(petId, pet.householdId, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 26 (Restoration): Restore Archived Pet
   */
  static async restorePet(actorId: string, petId: PetId, expectedVersion?: number): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.restore');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.restore permission.');

    if (expectedVersion !== undefined && pet.version !== expectedVersion) {
      throw new Error(`Concurrency Conflict: Expected version ${expectedVersion}, found ${pet.version}.`);
    }

    const transition = LifecycleEngine.validateStatusTransition(pet.status, 'ACTIVE');
    if (!transition.allowed) {
      throw new Error(transition.message || 'Invalid transition to ACTIVE.');
    }

    pet.status = 'ACTIVE';
    pet.archivedAt = undefined;
    pet.updatedAt = new Date().toISOString();
    pet.version += 1;

    PetStore.savePet(pet);

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_RESTORED',
      occurredAt: pet.updatedAt
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petRestored(petId, pet.householdId, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 27: Deceased Pet Workflow
   * Respectful lifecycle milestone.
   */
  static async markDeceased(
    actorId: string,
    petId: PetId,
    deceasedAt: string,
    deceasedNote?: string,
    expectedVersion?: number
  ): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.deceased.mark');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.deceased.mark permission.');

    if (expectedVersion !== undefined && pet.version !== expectedVersion) {
      throw new Error(`Concurrency Conflict: Expected version ${expectedVersion}, found ${pet.version}.`);
    }

    const transition = LifecycleEngine.validateStatusTransition(pet.status, 'DECEASED');
    if (!transition.allowed) {
      throw new Error(transition.message || 'Invalid transition to DECEASED.');
    }

    const now = new Date().toISOString();
    pet.status = 'DECEASED';
    pet.deceasedAt = deceasedAt || now;
    pet.deceasedNote = deceasedNote?.trim();
    pet.updatedAt = now;
    pet.version += 1;

    PetStore.savePet(pet);

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_DECEASED',
      occurredAt: now,
      metadata: { deceasedAt: pet.deceasedAt, note: pet.deceasedNote }
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petMarkedDeceased(petId, pet.householdId, pet.deceasedAt, pet.deceasedNote, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 18 & 19: Microchip Identity Registration & Updates
   * Passive RFID identification technology (NOT GPS / tracker).
   */
  static async registerMicrochip(
    actorId: string,
    petId: PetId,
    payload: RegisterMicrochipPayload
  ): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.microchip.manage');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.microchip.manage permission.');

    const normalized = ReferenceDataService.normalizeMicrochipNumber(payload.microchipNumber);
    if (!ReferenceDataService.validateMicrochipNumber(normalized)) {
      throw new Error('Microchip number must be between 9 and 15 alphanumeric characters.');
    }

    // Privacy-Safe Uniqueness Verification:
    // If microchip belongs to another active pet, never leak who owns it.
    const existing = PetStore.findActiveMicrochipByNumber(normalized);
    if (existing && existing.pet.petId !== petId) {
      throw new Error('The supplied microchip identifier is already associated with another record.');
    }

    const now = new Date().toISOString();
    let microchip = PetStore.findMicrochipByPetId(petId);

    if (microchip) {
      microchip.microchipNumber = normalized;
      microchip.issuer = payload.issuer || microchip.issuer;
      microchip.implantationDate = payload.implantationDate || microchip.implantationDate;
      microchip.registryName = payload.registryName || microchip.registryName;
      microchip.updatedAt = now;
      PetStore.saveMicrochip(microchip);

      PetStore.recordAuditEvent({
        auditId: generateUUIDv7(),
        petId,
        householdId: pet.householdId,
        actorUserId: actorId as UserId,
        action: 'PET_MICROCHIP_UPDATED',
        occurredAt: now
      });
    } else {
      const microchipId = asMicrochipId(generateUUIDv7());
      microchip = {
        microchipId,
        petId,
        microchipNumber: normalized,
        issuer: payload.issuer,
        implantationDate: payload.implantationDate,
        registryName: payload.registryName,
        verificationStatus: 'UNVERIFIED',
        createdAt: now,
        updatedAt: now
      };
      PetStore.saveMicrochip(microchip);

      PetStore.recordAuditEvent({
        auditId: generateUUIDv7(),
        petId,
        householdId: pet.householdId,
        actorUserId: actorId as UserId,
        action: 'PET_MICROCHIP_REGISTERED',
        occurredAt: now
      });

      PetStore.recordOutboxEvent(
        PetEventFactory.petMicrochipRegistered(petId, microchipId, normalized, actorId as UserId)
      );
    }

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 16 & 17: Pet Photo Upload & Profile Photo Assignment
   */
  static async uploadPhoto(
    actorId: string,
    petId: PetId,
    payload: UploadPhotoPayload
  ): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.photo.manage');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.photo.manage permission.');

    // Validate MIME types and file size (Volume V & XXXI)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(payload.mimeType)) {
      throw new Error(`Unsupported file MIME type ${payload.mimeType}. Must be JPEG, PNG, or WebP.`);
    }

    // Max 10MB
    const maxBytes = 10 * 1024 * 1024;
    if (payload.fileSize > maxBytes) {
      throw new Error(`File size ${payload.fileSize} bytes exceeds the maximum allowed 10MB limit.`);
    }

    const photoId = asPetPhotoId(generateUUIDv7());
    const now = new Date().toISOString();

    const photo = {
      photoId,
      petId,
      storageKey: payload.storageKey,
      mimeType: payload.mimeType,
      fileSize: payload.fileSize,
      width: payload.width,
      height: payload.height,
      purpose: payload.purpose || 'GALLERY',
      uploadedBy: actorId as UserId,
      uploadedAt: now
    };

    PetStore.savePhoto(photo);

    if (payload.setAsProfile || !pet.profilePhotoId) {
      pet.profilePhotoId = photoId;
      pet.updatedAt = now;
      PetStore.savePet(pet);

      PetStore.recordOutboxEvent(
        PetEventFactory.petProfilePhotoChanged(petId, photoId, actorId as UserId)
      );
    }

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_PHOTO_UPLOADED',
      occurredAt: now,
      metadata: { photoId, storageKey: payload.storageKey }
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petPhotoUploaded(petId, photoId, payload.storageKey, photo.purpose, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Set Profile Photo
   */
  static async setProfilePhoto(actorId: string, petId: PetId, photoId: PetPhotoId): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.photo.manage');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.photo.manage permission.');

    const photo = PetStore.findPhotoById(photoId);
    if (!photo || photo.petId !== petId) {
      throw new Error('Photo not found for this pet.');
    }

    pet.profilePhotoId = photoId;
    pet.updatedAt = new Date().toISOString();
    PetStore.savePet(pet);

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_PHOTO_PROFILE_CHANGED',
      occurredAt: pet.updatedAt,
      metadata: { photoId }
    });

    PetStore.recordOutboxEvent(
      PetEventFactory.petProfilePhotoChanged(petId, photoId, actorId as UserId)
    );

    return this.getPetDetailDto(pet);
  }

  /**
   * Delete Pet Photo
   */
  static async deletePhoto(actorId: string, petId: PetId, photoId: PetPhotoId): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.photo.manage');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.photo.manage permission.');

    const photo = PetStore.findPhotoById(photoId);
    if (!photo || photo.petId !== petId) {
      throw new Error('Photo not found for this pet.');
    }

    photo.deletedAt = new Date().toISOString();
    PetStore.savePhoto(photo);

    // If this was the current profile photo, clear it
    if (pet.profilePhotoId === photoId) {
      pet.profilePhotoId = undefined;
      pet.updatedAt = photo.deletedAt;
      PetStore.savePet(pet);
    }

    PetStore.recordAuditEvent({
      auditId: generateUUIDv7(),
      petId,
      householdId: pet.householdId,
      actorUserId: actorId as UserId,
      action: 'PET_PHOTO_DELETED',
      occurredAt: photo.deletedAt,
      metadata: { photoId }
    });

    return this.getPetDetailDto(pet);
  }

  /**
   * Use Case 7: Pet Specific Relationship Management
   */
  static async manageRelationship(
    actorId: string,
    petId: PetId,
    targetUserId: UserId,
    relationshipType: PetRelationshipType,
    isPrimaryContact: boolean = false
  ): Promise<PetDetailDto> {
    const pet = PetStore.findPetById(petId);
    if (!pet) throw new Error(`Pet ${petId} not found.`);

    const auth = AuthorizationService.checkPetPermission(actorId, pet.householdId, petId, 'pet.relationship.manage');
    if (!auth.allowed) throw new Error(auth.message || 'Unauthorized: Lacks pet.relationship.manage permission.');

    const now = new Date().toISOString();
    const existing = PetStore.findRelationship(petId, targetUserId);

    if (existing) {
      existing.relationshipType = relationshipType;
      existing.isPrimaryContact = isPrimaryContact;
      existing.updatedAt = now;
      PetStore.saveRelationship(existing);

      PetStore.recordAuditEvent({
        auditId: generateUUIDv7(),
        petId,
        householdId: pet.householdId,
        actorUserId: actorId as UserId,
        action: 'PET_RELATIONSHIP_UPDATED',
        occurredAt: now,
        metadata: { targetUserId, relationshipType }
      });
    } else {
      const relId = asPetRelationshipId(generateUUIDv7());
      PetStore.saveRelationship({
        relationshipId: relId,
        petId,
        userId: targetUserId,
        relationshipType,
        isPrimaryContact,
        createdAt: now,
        updatedAt: now
      });

      PetStore.recordAuditEvent({
        auditId: generateUUIDv7(),
        petId,
        householdId: pet.householdId,
        actorUserId: actorId as UserId,
        action: 'PET_RELATIONSHIP_CREATED',
        occurredAt: now,
        metadata: { targetUserId, relationshipType }
      });

      PetStore.recordOutboxEvent(
        PetEventFactory.petRelationshipCreated(petId, targetUserId, relationshipType, isPrimaryContact)
      );
    }

    return this.getPetDetailDto(pet);
  }

  // --- DTO Converters ---
  private static getPetSummaryDto(pet: Pet): PetSummaryDto {
    const species = ReferenceDataService.getSpeciesByCode(pet.speciesCode);
    const breed = ReferenceDataService.getBreedByCode(pet.breedCode);
    const profilePhoto = pet.profilePhotoId ? PetStore.findPhotoById(pet.profilePhotoId) : undefined;
    const derivedAge = LifecycleEngine.calculateAge(pet.dateOfBirth, pet.birthdatePrecision);

    return {
      petId: pet.petId,
      householdId: pet.householdId,
      name: pet.name,
      speciesCode: pet.speciesCode,
      speciesName: species?.commonName || pet.speciesCode,
      breedName: pet.customBreedName || breed?.name || pet.breedCode,
      mixedBreed: pet.mixedBreed,
      unknownBreed: pet.unknownBreed,
      sex: pet.sex,
      reproductiveStatus: pet.reproductiveStatus,
      lifecycleStage: pet.lifecycleStage,
      status: pet.status,
      derivedAge,
      profilePhotoUrl: profilePhoto?.storageKey,
      primaryColor: pet.primaryColor,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt
    };
  }

  private static getPetDetailDto(pet: Pet): PetDetailDto {
    const species = ReferenceDataService.getSpeciesByCode(pet.speciesCode);
    const breed = ReferenceDataService.getBreedByCode(pet.breedCode);
    const secondaryBreed = pet.secondaryBreedCode ? ReferenceDataService.getBreedByCode(pet.secondaryBreedCode) : undefined;
    const profilePhoto = pet.profilePhotoId ? PetStore.findPhotoById(pet.profilePhotoId) : undefined;
    const derivedAge = LifecycleEngine.calculateAge(pet.dateOfBirth, pet.birthdatePrecision);
    const microchip = PetStore.findMicrochipByPetId(pet.petId);
    const photos = PetStore.listPhotosForPet(pet.petId);
    const relationships = PetStore.listRelationshipsForPet(pet.petId);

    return {
      petId: pet.petId,
      householdId: pet.householdId,
      name: pet.name,
      speciesCode: pet.speciesCode,
      speciesName: species?.commonName || pet.speciesCode,
      breedCode: pet.breedCode,
      breedName: pet.customBreedName || breed?.name || pet.breedCode,
      secondaryBreedCode: pet.secondaryBreedCode,
      secondaryBreedName: secondaryBreed?.name,
      mixedBreed: pet.mixedBreed,
      unknownBreed: pet.unknownBreed,
      customBreedName: pet.customBreedName,
      sex: pet.sex,
      reproductiveStatus: pet.reproductiveStatus,
      dateOfBirth: pet.dateOfBirth,
      birthdatePrecision: pet.birthdatePrecision,
      estimatedBirthdate: pet.estimatedBirthdate,
      derivedAge,
      primaryColor: pet.primaryColor,
      secondaryColor: pet.secondaryColor,
      markings: pet.markings,
      coatType: pet.coatType,
      sizeClassification: pet.sizeClassification,
      profilePhotoId: pet.profilePhotoId,
      profilePhotoUrl: profilePhoto?.storageKey,
      lifecycleStage: pet.lifecycleStage,
      status: pet.status,
      deceasedAt: pet.deceasedAt,
      deceasedNote: pet.deceasedNote,
      archivedAt: pet.archivedAt,
      microchip: microchip ? {
        microchipId: microchip.microchipId,
        microchipNumber: microchip.microchipNumber,
        issuer: microchip.issuer,
        implantationDate: microchip.implantationDate,
        registryName: microchip.registryName,
        verificationStatus: microchip.verificationStatus,
        verifiedAt: microchip.verifiedAt,
        isLocationTracker: false
      } : undefined,
      relationships: relationships.map(r => {
        const user = IdentityStore.findUserById(r.userId);
        const profile = IdentityStore.findProfileByUserId(r.userId);
        return {
          relationshipId: r.relationshipId,
          userId: r.userId,
          userName: profile?.displayName || profile?.firstName || user?.email || 'Caregiver',
          relationshipType: r.relationshipType,
          isPrimaryContact: r.isPrimaryContact
        };
      }),
      photos: photos.map(ph => ({
        photoId: ph.photoId,
        storageKey: ph.storageKey,
        mimeType: ph.mimeType,
        purpose: ph.purpose,
        isProfile: ph.photoId === pet.profilePhotoId,
        uploadedAt: ph.uploadedAt
      })),
      version: pet.version,
      createdBy: pet.createdBy,
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt
    };
  }
}
