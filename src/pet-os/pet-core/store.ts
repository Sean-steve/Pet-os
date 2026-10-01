/**
 * Pet OS Sprint 3 - Pet Core In-Memory Transactional Store & Repository
 * Implements Volume V (Pet Identity) & Volume XXX (Database Schema).
 */

import { 
  Pet, 
  PetRelationship, 
  PetPhoto, 
  PetMicrochip, 
  PetAuditEvent 
} from './types';
import { PetId, HouseholdId, UserId, PetPhotoId, MicrochipId, PetRelationshipId } from '../kernel/ids';
import { EventEnvelope } from '../kernel/events';

export class PetStore {
  private static pets = new Map<string, Pet>();
  private static petRelationships = new Map<string, PetRelationship>();
  private static petPhotos = new Map<string, PetPhoto>();
  private static petMicrochips = new Map<string, PetMicrochip>();
  private static outboxEvents: EventEnvelope<any>[] = [];
  private static auditEvents: PetAuditEvent[] = [];
  private static subscribers: ((event: EventEnvelope<any>) => void)[] = [];

  /**
   * Resets all store state (primarily for automated testing)
   */
  static reset(): void {
    this.pets.clear();
    this.petRelationships.clear();
    this.petPhotos.clear();
    this.petMicrochips.clear();
    this.outboxEvents = [];
    this.auditEvents = [];
  }

  static subscribe(listener: (event: EventEnvelope<any>) => void): () => void {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== listener);
    };
  }

  // --- Pets ---
  static savePet(pet: Pet): void {
    this.pets.set(pet.petId, { ...pet, metadata: { ...pet.metadata } });
  }

  static findPetById(petId: PetId): Pet | undefined {
    const p = this.pets.get(petId);
    return p ? { ...p, metadata: { ...p.metadata } } : undefined;
  }

  static listPetsByHousehold(householdId: HouseholdId): Pet[] {
    const list: Pet[] = [];
    for (const pet of this.pets.values()) {
      if (pet.householdId === householdId) {
        list.push({ ...pet, metadata: { ...pet.metadata } });
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static findAllPets(): Pet[] {
    return Array.from(this.pets.values()).map(pet => ({ ...pet, metadata: { ...pet.metadata } }));
  }

  // --- Microchips ---
  static saveMicrochip(microchip: PetMicrochip): void {
    this.petMicrochips.set(microchip.microchipId, { ...microchip });
  }

  static findMicrochipByPetId(petId: PetId): PetMicrochip | undefined {
    for (const m of this.petMicrochips.values()) {
      if (m.petId === petId) {
        return { ...m };
      }
    }
    return undefined;
  }

  /**
   * Finds microchip by normalized number.
   * Enforces global uniqueness across active pets.
   */
  static findActiveMicrochipByNumber(normalizedNumber: string): { microchip: PetMicrochip; pet: Pet } | undefined {
    for (const m of this.petMicrochips.values()) {
      if (m.microchipNumber === normalizedNumber) {
        const pet = this.findPetById(m.petId);
        // Only active / missing / archived pets count against uniqueness (not deceased or deleted)
        if (pet && pet.status !== 'DECEASED') {
          return { microchip: { ...m }, pet };
        }
      }
    }
    return undefined;
  }

  // --- Photos ---
  static savePhoto(photo: PetPhoto): void {
    this.petPhotos.set(photo.photoId, { ...photo });
  }

  static findPhotoById(photoId: PetPhotoId): PetPhoto | undefined {
    const ph = this.petPhotos.get(photoId);
    return ph && !ph.deletedAt ? { ...ph } : undefined;
  }

  static listPhotosForPet(petId: PetId): PetPhoto[] {
    const list: PetPhoto[] = [];
    for (const photo of this.petPhotos.values()) {
      if (photo.petId === petId && !photo.deletedAt) {
        list.push({ ...photo });
      }
    }
    return list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  // --- Relationships ---
  static saveRelationship(rel: PetRelationship): void {
    this.petRelationships.set(rel.relationshipId, { ...rel });
  }

  static findRelationship(petId: PetId, userId: UserId): PetRelationship | undefined {
    for (const rel of this.petRelationships.values()) {
      if (rel.petId === petId && rel.userId === userId) {
        return { ...rel };
      }
    }
    return undefined;
  }

  static listRelationshipsForPet(petId: PetId): PetRelationship[] {
    const list: PetRelationship[] = [];
    for (const rel of this.petRelationships.values()) {
      if (rel.petId === petId) {
        list.push({ ...rel });
      }
    }
    return list;
  }

  static deleteRelationship(relationshipId: PetRelationshipId): void {
    this.petRelationships.delete(relationshipId);
  }

  // --- Outbox & Audit ---
  static recordOutboxEvent(event: EventEnvelope<any>): void {
    this.outboxEvents.push(event);
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('Error invoking outbox event subscriber:', err);
      }
    }
  }

  static listOutboxEvents(): EventEnvelope<any>[] {
    return [...this.outboxEvents];
  }

  static recordAuditEvent(audit: PetAuditEvent): void {
    this.auditEvents.push(audit);
  }

  static listAuditEvents(petId?: PetId): PetAuditEvent[] {
    if (petId) {
      return this.auditEvents.filter(a => a.petId === petId);
    }
    return [...this.auditEvents];
  }
}
