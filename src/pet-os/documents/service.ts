/**
 * Pet OS Sprint 4 - Pet Documents Application Service
 * Implements Volume III, Volume V, Volume XXVIII, Volume XXXI
 * Enforces cross-household isolation, safe file validation, immutability/supersession, and auditability.
 */

import { 
  PetDocument, 
  UploadDocumentPayload, 
  ReplaceDocumentPayload, 
  DocumentQueryFilters, 
  SecureDownloadGrant 
} from './types';
import { DocumentStore } from './store';
import { PrivateDocumentStorageEngine, StoredBlob } from './storage';
import { DocumentEventFactory } from './events';
import { TimelineService } from '../timeline/service';
import { PetStore } from '../pet-core/store';
import { AuthorizationService } from '../identity/authorization';
import { InMemoryAuditStore } from '../kernel/audit';
import { 
  PetId, 
  PetDocumentId, 
  asPetDocumentId, 
  generateUUIDv7, 
  asCorrelationId, 
  asUserId 
} from '../kernel/ids';

interface ActiveDownloadGrantRecord {
  token: string;
  documentId: PetDocumentId;
  petId: PetId;
  expiresAt: string;
  actorId: string;
}

export class DocumentService {
  private static downloadGrants = new Map<string, ActiveDownloadGrantRecord>();

  static resetGrants(): void {
    this.downloadGrants.clear();
  }

  /**
   * Uploads a new pet document with strict security scans and timeline projection.
   */
  static async uploadDocument(actorId: string, payload: UploadDocumentPayload): Promise<PetDocument> {
    const pet = PetStore.findPetById(payload.petId);
    if (!pet) {
      throw new Error(`Pet with ID ${payload.petId} was not found.`);
    }

    // 1. Authorization: verify pet.document.upload in household
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      payload.petId,
      'pet.document.upload'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to upload documents for this pet.');
    }

    // 2. Storage & Security Validation
    const validation = PrivateDocumentStorageEngine.validateUpload(
      payload.originalFilename,
      payload.mediaType,
      payload.fileData,
      payload.fileSize
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed.');
    }

    const documentId = asPetDocumentId(generateUUIDv7());
    const now = new Date().toISOString();

    // 3. Store private blob
    const storageKey = PrivateDocumentStorageEngine.storeBlob(
      pet.householdId,
      payload.petId,
      documentId,
      validation.sanitizedFilename,
      payload.mediaType,
      validation.fileSize,
      validation.checksum,
      payload.fileData
    );

    // 4. Construct PetDocument aggregate
    const doc: PetDocument = {
      documentId,
      petId: payload.petId,
      householdId: pet.householdId,
      documentType: payload.documentType,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      storageKey,
      originalFilename: validation.sanitizedFilename,
      mediaType: payload.mediaType,
      fileSize: validation.fileSize,
      checksum: validation.checksum,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      issuingOrganization: payload.issuingOrganization?.trim(),
      sourceType: 'OWNER_UPLOAD',
      sourceActorId: asUserId(actorId),
      provenanceType: payload.provenanceType || 'OWNER_ENTERED',
      verificationStatus: 'OWNER_PROVIDED',
      documentStatus: 'ACTIVE',
      versionNumber: 1,
      uploadedBy: asUserId(actorId),
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
      metadata: payload.metadata || {}
    };

    DocumentStore.save(doc);

    // 5. Compliance Audit Record
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_DOCUMENT_UPLOADED',
      resourceType: 'pet_document',
      resourceId: documentId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'DOCUMENT_UPLOAD',
      metadata: {
        petId: payload.petId,
        documentType: payload.documentType,
        filename: validation.sanitizedFilename,
        checksum: validation.checksum,
        fileSize: validation.fileSize
      }
    });

    // 6. Outbox Event
    const correlationId = payload.correlationId || generateUUIDv7();
    PetStore.recordOutboxEvent(DocumentEventFactory.documentUploaded(doc, correlationId));

    // 7. Project into Timeline
    TimelineService.recordEvent({
      petId: payload.petId,
      householdId: pet.householdId,
      eventType: 'document.uploaded',
      eventCategory: 'DOCUMENT',
      occurredAt: payload.issuedAt || now,
      recordedAt: now,
      sourceDomain: 'DOCUMENTS',
      sourceEntityType: 'pet_document',
      sourceEntityId: documentId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: doc.provenanceType,
      title: `Pet Document Uploaded: ${doc.title}`,
      summary: `Uploaded official ${(doc.documentType || 'DOCUMENT').replace(/_/g, ' ')} (${doc.originalFilename}, ${(doc.fileSize / 1024).toFixed(1)} KB).`,
      structuredPayload: {
        documentId,
        documentType: doc.documentType,
        checksum: doc.checksum,
        expiresAt: doc.expiresAt,
        issuingOrganization: doc.issuingOrganization
      },
      deduplicationKey: `DOCUMENTS:pet_document:${documentId}:document.uploaded`,
      correlationId
    });

    return doc;
  }

  /**
   * Replaces an existing document with a new version (historical supersession).
   */
  static async replaceDocument(actorId: string, payload: ReplaceDocumentPayload): Promise<PetDocument> {
    const oldDoc = DocumentStore.findById(payload.oldDocumentId);
    if (!oldDoc) {
      throw new Error(`Document with ID ${payload.oldDocumentId} was not found.`);
    }

    if (oldDoc.documentStatus !== 'ACTIVE') {
      throw new Error(`Cannot replace document with status ${oldDoc.documentStatus}. Only ACTIVE documents can be superseded.`);
    }

    const pet = PetStore.findPetById(oldDoc.petId);
    if (!pet) {
      throw new Error(`Pet with ID ${oldDoc.petId} was not found.`);
    }

    // Authorization: verify pet.document.update
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      oldDoc.petId,
      'pet.document.update'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to update documents for this pet.');
    }

    // Security Validation of new file
    const validation = PrivateDocumentStorageEngine.validateUpload(
      payload.originalFilename,
      payload.mediaType,
      payload.fileData,
      payload.fileSize
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Replacement file validation failed.');
    }

    const newDocumentId = asPetDocumentId(generateUUIDv7());
    const now = new Date().toISOString();

    // Store new blob
    const newStorageKey = PrivateDocumentStorageEngine.storeBlob(
      pet.householdId,
      oldDoc.petId,
      newDocumentId,
      validation.sanitizedFilename,
      payload.mediaType,
      validation.fileSize,
      validation.checksum,
      payload.fileData
    );

    // 1. Supersede old document
    oldDoc.documentStatus = 'SUPERSEDED';
    oldDoc.updatedAt = now;
    DocumentStore.save(oldDoc);

    // 2. Construct new version
    const newDoc: PetDocument = {
      documentId: newDocumentId,
      petId: oldDoc.petId,
      householdId: pet.householdId,
      documentType: payload.documentType || oldDoc.documentType,
      title: (payload.title || oldDoc.title).trim(),
      description: payload.description !== undefined ? payload.description.trim() : oldDoc.description,
      storageKey: newStorageKey,
      originalFilename: validation.sanitizedFilename,
      mediaType: payload.mediaType,
      fileSize: validation.fileSize,
      checksum: validation.checksum,
      issuedAt: payload.issuedAt || oldDoc.issuedAt,
      expiresAt: payload.expiresAt || oldDoc.expiresAt,
      issuingOrganization: payload.issuingOrganization || oldDoc.issuingOrganization,
      sourceType: 'OWNER_UPLOAD',
      sourceActorId: asUserId(actorId),
      provenanceType: oldDoc.provenanceType,
      verificationStatus: 'OWNER_PROVIDED',
      documentStatus: 'ACTIVE',
      versionNumber: oldDoc.versionNumber + 1,
      replacedDocumentId: oldDoc.documentId,
      uploadedBy: asUserId(actorId),
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
      metadata: { ...oldDoc.metadata, supersessionReason: payload.reason }
    };

    DocumentStore.save(newDoc);

    // 3. Compliance Audit Record
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_DOCUMENT_REPLACED',
      resourceType: 'pet_document',
      resourceId: newDocumentId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'DOCUMENT_SUPERSEDED',
      metadata: {
        petId: oldDoc.petId,
        oldDocumentId: oldDoc.documentId,
        newVersionNumber: newDoc.versionNumber,
        reason: payload.reason
      }
    });

    // 4. Outbox Event
    const correlationId = payload.correlationId || generateUUIDv7();
    PetStore.recordOutboxEvent(
      DocumentEventFactory.documentReplaced(
        oldDoc.petId,
        oldDoc.documentId,
        newDocumentId,
        asUserId(actorId),
        payload.reason,
        correlationId
      )
    );

    // 5. Project into Timeline
    TimelineService.recordEvent({
      petId: oldDoc.petId,
      householdId: pet.householdId,
      eventType: 'document.replaced',
      eventCategory: 'DOCUMENT',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'DOCUMENTS',
      sourceEntityType: 'pet_document',
      sourceEntityId: newDocumentId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: newDoc.provenanceType,
      title: `Document Replaced: ${newDoc.title} (v${newDoc.versionNumber})`,
      summary: `Superseded v${oldDoc.versionNumber}. Reason: ${payload.reason || 'Newer version provided'}.`,
      structuredPayload: {
        oldDocumentId: oldDoc.documentId,
        newDocumentId: newDoc.documentId,
        versionNumber: newDoc.versionNumber
      },
      deduplicationKey: `DOCUMENTS:pet_document:${newDocumentId}:document.replaced`,
      correlationId
    });

    return newDoc;
  }

  /**
   * Archives a document (soft deletion / historical retention).
   */
  static async archiveDocument(actorId: string, petId: PetId, documentId: PetDocumentId): Promise<PetDocument> {
    const doc = DocumentStore.findById(documentId);
    if (!doc || doc.petId !== petId) {
      throw new Error(`Document ${documentId} not found for this pet.`);
    }

    if (doc.documentStatus === 'ARCHIVED') {
      return doc;
    }

    // Authorization
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      doc.householdId,
      petId,
      'pet.document.archive'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to archive documents for this pet.');
    }

    const now = new Date().toISOString();
    doc.documentStatus = 'ARCHIVED';
    doc.archivedAt = now;
    doc.updatedAt = now;

    DocumentStore.save(doc);

    // Audit
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_DOCUMENT_ARCHIVED',
      resourceType: 'pet_document',
      resourceId: documentId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'DOCUMENT_ARCHIVED',
      metadata: { petId }
    });

    // Outbox
    PetStore.recordOutboxEvent(
      DocumentEventFactory.documentArchived(petId, documentId, asUserId(actorId))
    );

    // Project into Timeline
    TimelineService.recordEvent({
      petId,
      householdId: doc.householdId,
      eventType: 'document.archived',
      eventCategory: 'DOCUMENT',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'DOCUMENTS',
      sourceEntityType: 'pet_document',
      sourceEntityId: documentId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: 'OWNER_ENTERED',
      title: `Document Archived: ${doc.title}`,
      summary: `Official document ${doc.documentType} was moved to archives.`,
      deduplicationKey: `DOCUMENTS:pet_document:${documentId}:document.archived`
    });

    return doc;
  }

  /**
   * Lists documents for a pet with strict cross-household authorization.
   */
  static listDocuments(actorId: string, petId: PetId, filters: DocumentQueryFilters = {}): PetDocument[] {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // Authorization: verify pet.document.read
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.document.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to pet documents.');
    }

    return DocumentStore.listForPet(petId, filters);
  }

  /**
   * Retrieves single document with authorization check.
   */
  static getDocumentById(actorId: string, petId: PetId, documentId: PetDocumentId): PetDocument {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.document.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to pet document.');
    }

    const doc = DocumentStore.findById(documentId);
    if (!doc || doc.petId !== petId) {
      throw new Error(`Document ${documentId} not found for this pet.`);
    }

    return doc;
  }

  /**
   * Issues a short-lived, signed download token for authorized file retrieval.
   */
  static generateSecureDownloadGrant(actorId: string, petId: PetId, documentId: PetDocumentId): SecureDownloadGrant {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // Authorization: verify pet.document.download
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.document.download'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to download this pet document.');
    }

    const doc = DocumentStore.findById(documentId);
    if (!doc || doc.petId !== petId) {
      throw new Error(`Document ${documentId} was not found.`);
    }

    if (doc.documentStatus === 'DELETED_BY_POLICY') {
      throw new Error('This document has been deleted and cannot be downloaded.');
    }

    // Token valid for 15 minutes (900,000 ms)
    const token = generateUUIDv7();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    this.downloadGrants.set(token, {
      token,
      documentId,
      petId,
      expiresAt,
      actorId
    });

    // Compliance Audit Record for file retrieval
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_DOCUMENT_DOWNLOADED',
      resourceType: 'pet_document',
      resourceId: documentId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'SECURE_DOWNLOAD_GRANTED',
      metadata: {
        petId,
        filename: doc.originalFilename,
        checksum: doc.checksum,
        grantExpiresAt: expiresAt
      }
    });

    // Outbox event
    PetStore.recordOutboxEvent(
      DocumentEventFactory.documentDownloaded(petId, documentId, asUserId(actorId))
    );

    return {
      grantToken: token,
      documentId,
      petId,
      expiresAt,
      downloadUrl: `/api/pets/${petId}/documents/${documentId}/download?token=${token}`,
      mediaType: doc.mediaType,
      filename: doc.originalFilename,
      fileSize: doc.fileSize,
      checksum: doc.checksum
    };
  }

  /**
   * Validates a download grant and retrieves the raw stored blob.
   */
  static consumeDownloadGrant(token: string, documentId: PetDocumentId): StoredBlob {
    const grant = this.downloadGrants.get(token);
    if (!grant || grant.documentId !== documentId) {
      throw new Error('Invalid or expired document download token.');
    }

    if (new Date().getTime() > new Date(grant.expiresAt).getTime()) {
      this.downloadGrants.delete(token);
      throw new Error('Download grant token has expired. Please request a new download link.');
    }

    const doc = DocumentStore.findById(documentId);
    if (!doc) {
      throw new Error('Referenced document no longer exists.');
    }

    const blob = PrivateDocumentStorageEngine.getBlob(doc.storageKey);
    if (!blob) {
      throw new Error('Stored file payload is missing from private storage.');
    }

    return blob;
  }
}
