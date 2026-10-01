/**
 * Pet OS Sprint 3 - Pet Core, Digital Twin, Ownership & Identity Domain Types
 * Implements Volume 0, I, II, III, IV, V, VI, XXI, XXVIII, XXX, XXXI, XXXVIII, XLI.
 */

import { UserId, HouseholdId, PetId, PetPhotoId, MicrochipId, PetRelationshipId } from '../kernel/ids';

export type Sex = 'MALE' | 'FEMALE' | 'UNKNOWN';

export type ReproductiveStatus = 'INTACT' | 'STERILIZED' | 'UNKNOWN';

export type BirthdatePrecision = 
  | 'EXACT' 
  | 'ESTIMATED_MONTH_YEAR' 
  | 'ESTIMATED_YEAR' 
  | 'UNKNOWN';

export type SizeClassification = 
  | 'TOY' 
  | 'SMALL' 
  | 'MEDIUM' 
  | 'LARGE' 
  | 'GIANT' 
  | 'NOT_APPLICABLE' 
  | 'UNKNOWN';

export type LifecycleStage = 
  | 'PUPPY' 
  | 'KITTEN' 
  | 'JUVENILE' 
  | 'ADOLESCENT' 
  | 'ADULT' 
  | 'SENIOR' 
  | 'UNKNOWN';

export type PetStatus = 
  | 'ACTIVE' 
  | 'MISSING' 
  | 'ARCHIVED' 
  | 'DECEASED';

export type MicrochipVerificationStatus = 
  | 'UNVERIFIED' 
  | 'VERIFIED' 
  | 'PENDING';

export type PhotoPurpose = 
  | 'PROFILE' 
  | 'IDENTIFICATION' 
  | 'GALLERY';

export type PetRelationshipType = 
  | 'PRIMARY_OWNER' 
  | 'CO_OWNER' 
  | 'CAREGIVER' 
  | 'TEMPORARY_CAREGIVER' 
  | 'VIEW_ONLY';

export interface DerivedAge {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  display: string;
  isEstimated: boolean;
  precision: BirthdatePrecision;
}

export interface Species {
  code: string;
  commonName: string;
  scientificName: string;
  description: string;
  active: boolean;
  supportedSizeClassifications: SizeClassification[];
}

export interface Breed {
  code: string;
  speciesCode: string;
  name: string;
  sizeCategory: SizeClassification;
  coatType?: string;
  origin?: string;
  aliases: string[];
  active: boolean;
  isSpecial?: boolean; // For unknown / mixed markers
}

export interface PetMicrochip {
  microchipId: MicrochipId;
  petId: PetId;
  microchipNumber: string; // Normalized ISO 11784/11785
  issuer?: string;
  implantationDate?: string;
  registryName?: string;
  verificationStatus: MicrochipVerificationStatus;
  verifiedBy?: UserId;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PetPhoto {
  photoId: PetPhotoId;
  petId: PetId;
  storageKey: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSize: number;
  width?: number;
  height?: number;
  purpose: PhotoPurpose;
  uploadedBy: UserId;
  uploadedAt: string;
  deletedAt?: string;
}

export interface PetRelationship {
  relationshipId: PetRelationshipId;
  petId: PetId;
  userId: UserId;
  relationshipType: PetRelationshipType;
  isPrimaryContact: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Canonical Pet Aggregate Root (Volume V & XXX)
 */
export interface Pet {
  petId: PetId;
  householdId: HouseholdId;
  name: string;
  speciesCode: string;
  breedCode: string;
  secondaryBreedCode?: string;
  mixedBreed: boolean;
  unknownBreed: boolean;
  customBreedName?: string;
  sex: Sex;
  reproductiveStatus: ReproductiveStatus;
  dateOfBirth?: string; // ISO 8601 (YYYY-MM-DD)
  birthdatePrecision: BirthdatePrecision;
  estimatedBirthdate: boolean;
  primaryColor: string;
  secondaryColor?: string;
  markings?: string;
  coatType?: string;
  sizeClassification: SizeClassification;
  profilePhotoId?: PetPhotoId;
  lifecycleStage: LifecycleStage;
  status: PetStatus;
  deceasedAt?: string;
  deceasedNote?: string;
  archivedAt?: string;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
  version: number;
  metadata: Record<string, unknown>;
}

// Request Payloads
export interface CreatePetPayload {
  name: string;
  speciesCode: string;
  breedCode?: string;
  secondaryBreedCode?: string;
  mixedBreed?: boolean;
  unknownBreed?: boolean;
  customBreedName?: string;
  sex: Sex;
  reproductiveStatus?: ReproductiveStatus;
  dateOfBirth?: string;
  birthdatePrecision?: BirthdatePrecision;
  primaryColor: string;
  secondaryColor?: string;
  markings?: string;
  coatType?: string;
  sizeClassification?: SizeClassification;
  microchipNumber?: string;
  microchipIssuer?: string;
  initialPhotoUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePetPayload {
  name?: string;
  speciesCode?: string;
  breedCode?: string;
  secondaryBreedCode?: string;
  mixedBreed?: boolean;
  unknownBreed?: boolean;
  customBreedName?: string;
  sex?: Sex;
  reproductiveStatus?: ReproductiveStatus;
  dateOfBirth?: string;
  birthdatePrecision?: BirthdatePrecision;
  primaryColor?: string;
  secondaryColor?: string;
  markings?: string;
  coatType?: string;
  sizeClassification?: SizeClassification;
  metadata?: Record<string, unknown>;
}

export interface RegisterMicrochipPayload {
  microchipNumber: string;
  issuer?: string;
  implantationDate?: string;
  registryName?: string;
}

export interface UploadPhotoPayload {
  storageKey: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSize: number;
  width?: number;
  height?: number;
  purpose?: PhotoPurpose;
  setAsProfile?: boolean;
}

// Read DTOs (Safe representations)
export interface PetSummaryDto {
  petId: PetId;
  householdId: HouseholdId;
  name: string;
  speciesCode: string;
  speciesName: string;
  breedName: string;
  mixedBreed: boolean;
  unknownBreed: boolean;
  sex: Sex;
  reproductiveStatus: ReproductiveStatus;
  lifecycleStage: LifecycleStage;
  status: PetStatus;
  derivedAge: DerivedAge;
  profilePhotoUrl?: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface PetDetailDto {
  petId: PetId;
  householdId: HouseholdId;
  name: string;
  speciesCode: string;
  speciesName: string;
  breedCode: string;
  breedName: string;
  secondaryBreedCode?: string;
  secondaryBreedName?: string;
  mixedBreed: boolean;
  unknownBreed: boolean;
  customBreedName?: string;
  sex: Sex;
  reproductiveStatus: ReproductiveStatus;
  dateOfBirth?: string;
  birthdatePrecision: BirthdatePrecision;
  estimatedBirthdate: boolean;
  derivedAge: DerivedAge;
  primaryColor: string;
  secondaryColor?: string;
  markings?: string;
  coatType?: string;
  sizeClassification: SizeClassification;
  profilePhotoId?: PetPhotoId;
  profilePhotoUrl?: string;
  lifecycleStage: LifecycleStage;
  status: PetStatus;
  deceasedAt?: string;
  deceasedNote?: string;
  archivedAt?: string;
  microchip?: {
    microchipId: MicrochipId;
    microchipNumber: string;
    issuer?: string;
    implantationDate?: string;
    registryName?: string;
    verificationStatus: MicrochipVerificationStatus;
    verifiedAt?: string;
    isLocationTracker: false; // Explicit contract invariant: Passive RFID ONLY
  };
  relationships: Array<{
    relationshipId: PetRelationshipId;
    userId: UserId;
    userName: string;
    relationshipType: PetRelationshipType;
    isPrimaryContact: boolean;
  }>;
  photos: Array<{
    photoId: PetPhotoId;
    storageKey: string;
    mimeType: string;
    purpose: PhotoPurpose;
    isProfile: boolean;
    uploadedAt: string;
  }>;
  version: number;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface PetAuditEvent {
  auditId: string;
  petId: PetId;
  householdId: HouseholdId;
  actorUserId: UserId;
  action: 
    | 'PET_CREATED'
    | 'PET_UPDATED'
    | 'PET_ARCHIVED'
    | 'PET_RESTORED'
    | 'PET_DECEASED'
    | 'PET_RELATIONSHIP_CREATED'
    | 'PET_RELATIONSHIP_UPDATED'
    | 'PET_RELATIONSHIP_REMOVED'
    | 'PET_MICROCHIP_REGISTERED'
    | 'PET_MICROCHIP_UPDATED'
    | 'PET_PHOTO_UPLOADED'
    | 'PET_PHOTO_PROFILE_CHANGED'
    | 'PET_PHOTO_DELETED';
  changedFields?: string[];
  occurredAt: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
