/**
 * Pet OS Sprint 4 - Digital Pet Passport Domain Models & Scopes
 * Implements Volume III, Volume V, Volume XXVIII, Volume XXXI
 * Controlled read-model projections, cryptographic share tokens, privacy-scoped field masking.
 */

import { PetId, HouseholdId, PassportShareId, PassportExportId, UserId } from '../kernel/ids';

export type PassportShareScope =
  | 'PRIVATE' // Full household view
  | 'CARE_PROVIDER_SHARE' // Sitter / Groomer / Boarding view
  | 'FINDER_RECOVERY' // Public lost-pet finder view (privacy-preserving)
  | 'TRAVEL_EXPORT'; // Official transport / travel snapshot

export interface PassportMicrochipSummary {
  microchipNumber: string;
  issuer?: string;
  implantedAt?: string;
  verificationStatus: string;
  isLocationTracker: false; // Explicit domain invariant (ADR-006)
}

export interface PassportContactPathway {
  householdName: string;
  primaryCaregiverName: string;
  emergencyPhone?: string;
  emergencyEmail?: string;
  relayActive: boolean;
  notes?: string;
}

export interface PassportVerifiedDocumentItem {
  documentId: string;
  title: string;
  documentType: string;
  verificationStatus: string;
  originalFilename: string;
  mediaType: string;
  fileSize: number;
  checksum: string;
  issuedAt?: string;
  expiresAt?: string;
  issuingOrganization?: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface PetPassportReadModel {
  petId: PetId;
  passportVersion: number;
  name: string;
  status: string;
  profilePhotoUrl?: string;
  speciesCode: string;
  speciesName: string;
  breedCode: string;
  breedName: string;
  secondaryBreedName?: string;
  mixedBreed: boolean;
  sex: string;
  reproductiveStatus: string;
  dateOfBirth?: string;
  birthdatePrecision: string;
  ageDisplay: string;
  lifecycleStage: string;
  primaryColor: string;
  secondaryColor?: string;
  markings?: string;
  coatType?: string;
  sizeClassification: string;
  microchip?: PassportMicrochipSummary;
  contactPathway: PassportContactPathway;
  documents: PassportVerifiedDocumentItem[];
  // Safety & Medical Boundary: strictly no fabricated clinical information
  futureHealthNotice: {
    clinicalCareAvailable: false;
    message: string;
  };
  assembledAt: string;
  scope: PassportShareScope;
}

export interface PassportShareToken {
  shareId: PassportShareId;
  petId: PetId;
  householdId: HouseholdId;
  token: string; // Plain token returned only upon creation
  tokenHash: string; // Stored hash for lookup
  scope: PassportShareScope;
  permittedDocumentIds?: string[];
  recipientLabel?: string;
  expiresAt: string;
  revokedAt?: string;
  revokedBy?: UserId;
  accessCount: number;
  lastAccessedAt?: string;
  createdBy: UserId;
  createdAt: string;
}

export interface CreatePassportShareCommand {
  petId: PetId;
  scope: PassportShareScope;
  expiresInHours?: number; // default 72
  recipientLabel?: string;
  permittedDocumentIds?: string[];
  correlationId?: string;
}

export interface PassportExportRecord {
  exportId: PassportExportId;
  petId: PetId;
  householdId: HouseholdId;
  generatedAt: string;
  generatedBy: UserId;
  dataVersion: number;
  dataChecksum: string;
  scope: PassportShareScope;
  format: 'JSON' | 'PRINTABLE_HTML';
  snapshotPayload: PetPassportReadModel;
}
