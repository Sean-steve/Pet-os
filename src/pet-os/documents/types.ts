/**
 * Pet OS Sprint 4 - Pet Documents Domain Models & Metadata Catalog
 * Implements Volume III, Volume V, Volume XXVIII, Volume XXX, Volume XXXI
 * Controlled document type catalogue, provenance, verification states, and lifecycle rules.
 */

import { PetId, HouseholdId, PetDocumentId, UserId, CorrelationId } from '../kernel/ids';

export type PetDocumentType =
  | 'VACCINATION_CERTIFICATE'
  | 'VET_REPORT'
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'MICROCHIP_CERTIFICATE'
  | 'ADOPTION_DOCUMENT'
  | 'OWNERSHIP_DOCUMENT'
  | 'INSURANCE_DOCUMENT'
  | 'TRAVEL_DOCUMENT'
  | 'OTHER';

export type DocumentStatus =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'ARCHIVED'
  | 'REJECTED'
  | 'DELETED_BY_POLICY';

export type DocumentVerificationStatus =
  | 'UNVERIFIED'
  | 'OWNER_PROVIDED'
  | 'PROVIDER_PROVIDED'
  | 'VERIFIED'
  | 'REJECTED';

export type DocumentProvenanceType =
  | 'OWNER_ENTERED'
  | 'PROVIDER_ENTERED'
  | 'SYSTEM_GENERATED'
  | 'DOCUMENT_DERIVED'
  | 'VERIFIED_PROFESSIONAL';

export interface PetDocument {
  documentId: PetDocumentId;
  petId: PetId;
  householdId: HouseholdId;
  documentType: PetDocumentType;
  title: string;
  description?: string;
  storageKey: string; // Tenant & pet partitioned private storage path
  originalFilename: string;
  mediaType: string; // MIME type
  fileSize: number; // bytes
  checksum: string; // SHA-256
  issuedAt?: string; // Date document was officially issued
  expiresAt?: string; // Date document validity lapses (e.g. rabies cert)
  issuingOrganization?: string;
  sourceType: 'OWNER_UPLOAD' | 'PROVIDER_UPLOAD' | 'SYSTEM_GENERATED';
  sourceActorId: UserId;
  provenanceType: DocumentProvenanceType;
  verificationStatus: DocumentVerificationStatus;
  documentStatus: DocumentStatus;
  versionNumber: number;
  replacedDocumentId?: PetDocumentId;
  uploadedBy: UserId;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentPayload {
  petId: PetId;
  documentType: PetDocumentType;
  title: string;
  description?: string;
  issuedAt?: string;
  expiresAt?: string;
  issuingOrganization?: string;
  provenanceType?: DocumentProvenanceType;
  // File data
  originalFilename: string;
  mediaType: string;
  fileData: string | Uint8Array; // Base64 or byte array
  fileSize?: number;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export interface ReplaceDocumentPayload {
  oldDocumentId: PetDocumentId;
  documentType?: PetDocumentType;
  title?: string;
  description?: string;
  issuedAt?: string;
  expiresAt?: string;
  issuingOrganization?: string;
  originalFilename: string;
  mediaType: string;
  fileData: string | Uint8Array;
  fileSize?: number;
  reason?: string;
  correlationId?: string;
}

export interface DocumentQueryFilters {
  documentType?: PetDocumentType;
  documentStatus?: DocumentStatus;
  verificationStatus?: DocumentVerificationStatus;
  search?: string;
  includeSuperseded?: boolean;
  includeArchived?: boolean;
}

export interface SecureDownloadGrant {
  grantToken: string;
  documentId: PetDocumentId;
  petId: PetId;
  expiresAt: string;
  downloadUrl: string;
  mediaType: string;
  filename: string;
  fileSize: number;
  checksum: string;
}

/**
 * Derived helper to determine if a document is expired based on current timestamp
 */
export function isDocumentExpired(doc: PetDocument, now = new Date()): boolean {
  if (!doc.expiresAt) return false;
  return new Date(doc.expiresAt).getTime() < now.getTime();
}

/**
 * Derived helper to determine if a document is expiring soon (within windowDays)
 */
export function isDocumentExpiringSoon(doc: PetDocument, windowDays = 30, now = new Date()): boolean {
  if (!doc.expiresAt) return false;
  const expTime = new Date(doc.expiresAt).getTime();
  const nowTime = now.getTime();
  if (expTime < nowTime) return false; // Already expired
  const daysDiff = (expTime - nowTime) / (1000 * 60 * 60 * 24);
  return daysDiff <= windowDays;
}
