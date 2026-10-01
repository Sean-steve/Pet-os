/**
 * Pet OS Sprint 4 - Pet Documents In-Memory Repository
 * Implements Volume III, Volume V, Volume XXX
 */

import { PetDocument, DocumentQueryFilters } from './types';
import { PetId, PetDocumentId } from '../kernel/ids';

export class DocumentStore {
  private static documents = new Map<string, PetDocument>();

  static reset(): void {
    this.documents.clear();
  }

  static save(doc: PetDocument): void {
    this.documents.set(doc.documentId, { ...doc, metadata: { ...doc.metadata } });
  }

  static findById(documentId: PetDocumentId): PetDocument | undefined {
    const doc = this.documents.get(documentId);
    return doc ? { ...doc, metadata: { ...doc.metadata } } : undefined;
  }

  static listForPet(petId: PetId, filters: DocumentQueryFilters = {}): PetDocument[] {
    const list: PetDocument[] = [];

    for (const doc of this.documents.values()) {
      if (doc.petId !== petId) continue;

      if (!filters.includeArchived && doc.documentStatus === 'ARCHIVED') continue;
      if (!filters.includeSuperseded && doc.documentStatus === 'SUPERSEDED') continue;
      if (filters.documentStatus && doc.documentStatus !== filters.documentStatus) continue;
      if (filters.documentType && doc.documentType !== filters.documentType) continue;
      if (filters.verificationStatus && doc.verificationStatus !== filters.verificationStatus) continue;

      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matches =
          doc.title.toLowerCase().includes(query) ||
          (doc.description && doc.description.toLowerCase().includes(query)) ||
          doc.originalFilename.toLowerCase().includes(query) ||
          (doc.issuingOrganization && doc.issuingOrganization.toLowerCase().includes(query));
        if (!matches) continue;
      }

      list.push({ ...doc, metadata: { ...doc.metadata } });
    }

    // Sort descending by uploadedAt
    return list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  static getActiveReferencedStorageKeys(): Set<string> {
    const keys = new Set<string>();
    for (const doc of this.documents.values()) {
      if (doc.documentStatus !== 'DELETED_BY_POLICY') {
        keys.add(doc.storageKey);
      }
    }
    return keys;
  }
}
