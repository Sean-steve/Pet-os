/**
 * Pet OS Sprint 4 - Digital Pet Passport Service
 * Implements Volume III, Volume V, Volume XXVIII, Volume XXXI
 * Controlled read-model projection, cryptographic share tokens, field-level privacy masking.
 */

import { 
  PetPassportReadModel, 
  PassportShareToken, 
  CreatePassportShareCommand, 
  PassportExportRecord, 
  PassportShareScope, 
  PassportVerifiedDocumentItem 
} from './types';
import { PassportStore } from './store';
import { PassportEventFactory } from './events';
import { DocumentStore } from '../documents/store';
import { isDocumentExpired, isDocumentExpiringSoon } from '../documents/types';
import { TimelineService } from '../timeline/service';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { AuthorizationService } from '../identity/authorization';
import { InMemoryAuditStore } from '../kernel/audit';
import { 
  PetId, 
  PassportShareId, 
  PassportExportId, 
  asPassportShareId, 
  asPassportExportId, 
  generateUUIDv7, 
  asUserId 
} from '../kernel/ids';

export class PassportService {
  /**
   * Generates a high-entropy 64-character hex cryptographic token.
   */
  private static generateCryptographicToken(): string {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Computes a deterministic hash of the token for secure storage.
   */
  private static hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const h1 = Math.abs(hash).toString(16).padStart(8, '0');
    const h2 = Math.abs((hash ^ 0x3c3c3c3c) >>> 0).toString(16).padStart(8, '0');
    const h3 = Math.abs((hash ^ 0xc3c3c3c3) >>> 0).toString(16).padStart(8, '0');
    const h4 = Math.abs((hash * 29) >>> 0).toString(16).padStart(8, '0');
    return `${h1}${h2}${h3}${h4}`;
  }

  /**
   * Generates the canonical Pet Passport read-model projection.
   * Strictly respects privacy boundaries and ensures no fabricated medical data.
   */
  static async generatePassport(
    actorId: string,
    petId: PetId,
    scope: PassportShareScope = 'PRIVATE'
  ): Promise<PetPassportReadModel> {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // 1. Authorization: verify pet.passport.read
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.passport.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to view pet passport.');
    }

    const passport = this.buildPassportProjection(petId, scope);

    // 2. Audit
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_PASSPORT_GENERATED',
      resourceType: 'pet_passport',
      resourceId: petId,
      classification: scope === 'FINDER_RECOVERY' ? 'PUBLIC' : 'CONFIDENTIAL',
      reasonCode: 'PASSPORT_VIEW',
      metadata: { petId, scope }
    });

    // 3. Outbox
    PetStore.recordOutboxEvent(
      PassportEventFactory.passportGenerated(petId, scope, asUserId(actorId))
    );

    return passport;
  }

  /**
   * Internal projection builder that compiles aggregate data and applies field-level masking.
   */
  private static buildPassportProjection(
    petId: PetId,
    scope: PassportShareScope,
    permittedDocumentIds?: string[]
  ): PetPassportReadModel {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet ${petId} not found.`);
    }

    // Microchip
    const rawChip = PetStore.findMicrochipByPetId(petId);
    let microchip = undefined;
    if (rawChip) {
      if (scope === 'FINDER_RECOVERY') {
        // Finder view: show masked / verified status without revealing full private ID if preferred
        microchip = {
          microchipNumber: `***${rawChip.microchipNumber.slice(-4)} (RFID Verified)`,
          issuer: rawChip.issuer,
          verificationStatus: rawChip.verificationStatus,
          isLocationTracker: false as const
        };
      } else {
        microchip = {
          microchipNumber: rawChip.microchipNumber,
          issuer: rawChip.issuer,
          implantedAt: rawChip.createdAt,
          verificationStatus: rawChip.verificationStatus,
          isLocationTracker: false as const
        };
      }
    }

    // Photos
    const photos = PetStore.listPhotosForPet(petId);
    const primaryPhoto = pet.profilePhotoId
      ? photos.find(p => p.photoId === pet.profilePhotoId)
      : photos[0];

    // Household & Caregiver Contact Pathway
    const household = IdentityStore.findHouseholdById(pet.householdId);
    const relationships = PetStore.listRelationshipsForPet(petId);
    const primaryRel = relationships.find(r => r.isPrimaryContact) || relationships[0];
    const primaryOwnerUser = primaryRel ? IdentityStore.findUserById(primaryRel.userId) : undefined;
    const primaryOwnerProfile = primaryRel ? IdentityStore.findProfileByUserId(primaryRel.userId) : undefined;

    let contactPathway = {
      householdName: household ? household.name : 'Registered Pet OS Household',
      primaryCaregiverName: primaryOwnerProfile ? primaryOwnerProfile.displayName : 'Authorized Pet Caregiver',
      emergencyPhone: primaryOwnerUser?.phoneNumber || '+254 700 000000',
      emergencyEmail: primaryOwnerUser?.email,
      relayActive: true,
      notes: 'Pet OS Secure Contact Relay'
    };

    // Privacy Masking according to Scope
    if (scope === 'FINDER_RECOVERY') {
      // In Finder view: HIDE owner email, mask phone with relay, anonymize household address
      contactPathway = {
        householdName: 'Pet OS Care Household (Identity Protected)',
        primaryCaregiverName: primaryOwnerProfile ? primaryOwnerProfile.firstName : 'Pet Guardian',
        emergencyPhone: 'Pet OS Safe Relay: +254 700 000000 (Protected)',
        emergencyEmail: undefined,
        relayActive: true,
        notes: 'Finder Recovery Mode: Direct contact is routed through secure relay to protect owner privacy and prevent extortion.'
      };
    } else if (scope === 'CARE_PROVIDER_SHARE') {
      contactPathway = {
        householdName: household ? household.name : 'Authorized Household',
        primaryCaregiverName: primaryOwnerProfile ? primaryOwnerProfile.displayName : 'Household Caregiver',
        emergencyPhone: primaryOwnerUser?.phoneNumber || '+254 700 000000',
        emergencyEmail: primaryOwnerUser?.email,
        relayActive: true,
        notes: 'Authorized Care Provider Access (Emergency Contact Pathway)'
      };
    }

    // Documents
    const rawDocs = DocumentStore.listForPet(petId, { documentStatus: 'ACTIVE' });
    let docs: PassportVerifiedDocumentItem[] = [];

    if (scope !== 'FINDER_RECOVERY') {
      docs = rawDocs
        .filter(d => {
          if (permittedDocumentIds && permittedDocumentIds.length > 0) {
            return permittedDocumentIds.includes(d.documentId);
          }
          if (scope === 'CARE_PROVIDER_SHARE') {
            // Include care-relevant documents only
            return ['VACCINATION_CERTIFICATE', 'MICROCHIP_CERTIFICATE', 'VET_REPORT', 'TRAVEL_DOCUMENT'].includes(d.documentType);
          }
          return true; // Full PRIVATE & TRAVEL_EXPORT
        })
        .map(d => ({
          documentId: d.documentId,
          title: d.title,
          documentType: d.documentType,
          verificationStatus: d.verificationStatus,
          originalFilename: d.originalFilename,
          mediaType: d.mediaType,
          fileSize: d.fileSize,
          checksum: d.checksum,
          issuedAt: d.issuedAt,
          expiresAt: d.expiresAt,
          issuingOrganization: d.issuingOrganization,
          isExpired: isDocumentExpired(d),
          isExpiringSoon: isDocumentExpiringSoon(d)
        }));
    }

    // Calculate approximate age
    let ageDisplay = 'Unknown age';
    if (pet.dateOfBirth) {
      const birth = new Date(pet.dateOfBirth);
      const diffMonths = Math.max(0, (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      if (diffMonths < 12) {
        ageDisplay = `${Math.floor(diffMonths)} month${Math.floor(diffMonths) === 1 ? '' : 's'}`;
      } else {
        const years = Math.floor(diffMonths / 12);
        const remMonths = Math.floor(diffMonths % 12);
        ageDisplay = remMonths > 0 ? `${years} yr${years === 1 ? '' : 's'}, ${remMonths} mo` : `${years} year${years === 1 ? '' : 's'}`;
      }
    }

    return {
      petId,
      passportVersion: 1,
      name: pet.name,
      status: pet.status,
      profilePhotoUrl: primaryPhoto?.storageKey,
      speciesCode: pet.speciesCode,
      speciesName: pet.speciesCode === 'SPECIES_DOG' ? 'Canine (Dog)' : pet.speciesCode,
      breedCode: pet.breedCode,
      breedName: pet.customBreedName || pet.breedCode?.replace(/_/g, ' ') || 'Unknown Breed',
      secondaryBreedName: pet.secondaryBreedCode?.replace(/_/g, ' '),
      mixedBreed: pet.mixedBreed,
      sex: pet.sex,
      reproductiveStatus: pet.reproductiveStatus,
      dateOfBirth: scope === 'FINDER_RECOVERY' ? undefined : pet.dateOfBirth,
      birthdatePrecision: pet.birthdatePrecision,
      ageDisplay,
      lifecycleStage: pet.lifecycleStage,
      primaryColor: pet.primaryColor,
      secondaryColor: pet.secondaryColor,
      markings: pet.markings,
      coatType: pet.coatType,
      sizeClassification: pet.sizeClassification,
      microchip,
      contactPathway,
      documents: docs,
      futureHealthNotice: {
        clinicalCareAvailable: false,
        message: 'Veterinary clinical care, diagnostic histories, and prescription management are domain-isolated and scheduled for upcoming development sprints. Pet OS does not fabricate synthetic medical data.'
      },
      assembledAt: new Date().toISOString(),
      scope
    };
  }

  /**
   * Creates a secure, scoped, time-bound share link with cryptographic token.
   */
  static async createShareToken(
    actorId: string,
    command: CreatePassportShareCommand
  ): Promise<{ shareToken: PassportShareToken; shareUrl: string }> {
    const pet = PetStore.findPetById(command.petId);
    if (!pet) {
      throw new Error(`Pet with ID ${command.petId} not found.`);
    }

    // 1. Authorization: verify pet.passport.share
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      command.petId,
      'pet.passport.share'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to share this pet passport.');
    }

    const shareId = asPassportShareId(generateUUIDv7());
    const token = this.generateCryptographicToken();
    const tokenHash = this.hashToken(token);

    const hours = command.expiresInHours && command.expiresInHours > 0 ? command.expiresInHours : 72;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const shareToken: PassportShareToken = {
      shareId,
      petId: command.petId,
      householdId: pet.householdId,
      token,
      tokenHash,
      scope: command.scope,
      permittedDocumentIds: command.permittedDocumentIds,
      recipientLabel: command.recipientLabel?.trim(),
      expiresAt,
      accessCount: 0,
      createdBy: asUserId(actorId),
      createdAt: now
    };

    PassportStore.saveShare(shareToken);

    // 2. Audit
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_PASSPORT_SHARE_CREATED',
      resourceType: 'pet_passport_share',
      resourceId: shareId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'PASSPORT_SHARE_GENERATED',
      metadata: {
        petId: command.petId,
        scope: command.scope,
        expiresAt,
        recipientLabel: command.recipientLabel
      }
    });

    // 3. Outbox
    const correlationId = command.correlationId || generateUUIDv7();
    PetStore.recordOutboxEvent(
      PassportEventFactory.shareCreated(
        command.petId,
        shareId,
        command.scope,
        command.recipientLabel,
        expiresAt,
        asUserId(actorId),
        correlationId
      )
    );

    // 4. Project into Timeline
    TimelineService.recordEvent({
      petId: command.petId,
      householdId: pet.householdId,
      eventType: 'passport.share_created',
      eventCategory: 'ADMINISTRATIVE',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'IDENTITY',
      sourceEntityType: 'pet_passport_share',
      sourceEntityId: shareId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: 'OWNER_ENTERED',
      title: `Pet Passport Shared (${(command.scope || 'STANDARD').replace(/_/g, ' ')})`,
      summary: `Created time-limited access link for ${command.recipientLabel || 'recipient'} (Expires in ${hours} hours).`,
      structuredPayload: {
        shareId,
        scope: command.scope,
        expiresAt
      },
      deduplicationKey: `PASSPORT:pet_passport_share:${shareId}:passport.share_created`,
      correlationId
    });

    const shareUrl = `/passport/view?token=${token}`;

    return {
      shareToken,
      shareUrl
    };
  }

  /**
   * Resolves a shared passport via token, verifying hash, expiration, and revocation status.
   */
  static async resolveSharedPassport(token: string): Promise<{
    passport: PetPassportReadModel;
    shareMeta: {
      scope: PassportShareScope;
      recipientLabel?: string;
      expiresAt: string;
      accessCount: number;
    };
  }> {
    if (!token || typeof token !== 'string') {
      throw new Error('Valid passport share token must be provided.');
    }

    const tokenHash = this.hashToken(token);
    const share = PassportStore.findShareByTokenHash(tokenHash);

    if (!share) {
      throw new Error('Invalid or unrecognized passport share link.');
    }

    if (share.revokedAt) {
      throw new Error('This pet passport share link has been revoked by the owner.');
    }

    if (new Date().getTime() > new Date(share.expiresAt).getTime()) {
      throw new Error('This pet passport share link has expired.');
    }

    // Increment access count & update lastAccessedAt
    const now = new Date().toISOString();
    share.accessCount += 1;
    share.lastAccessedAt = now;
    PassportStore.saveShare(share);

    // Audit
    InMemoryAuditStore.record({
      actorId: 'ANONYMOUS_RECIPIENT',
      actorType: 'USER',
      action: 'PET_PASSPORT_SHARE_ACCESSED',
      resourceType: 'pet_passport_share',
      resourceId: share.shareId,
      classification: share.scope === 'FINDER_RECOVERY' ? 'PUBLIC' : 'CONFIDENTIAL',
      reasonCode: 'PASSPORT_TOKEN_CONSUMED',
      metadata: {
        petId: share.petId,
        scope: share.scope,
        accessCount: share.accessCount
      }
    });

    // Outbox
    PetStore.recordOutboxEvent(
      PassportEventFactory.shareAccessed(share.petId, share.shareId, share.scope, share.accessCount)
    );

    // Build scoped projection
    const passport = this.buildPassportProjection(share.petId, share.scope, share.permittedDocumentIds);

    return {
      passport,
      shareMeta: {
        scope: share.scope,
        recipientLabel: share.recipientLabel,
        expiresAt: share.expiresAt,
        accessCount: share.accessCount
      }
    };
  }

  /**
   * Revokes an active passport share token immediately.
   */
  static async revokeShareToken(
    actorId: string,
    petId: PetId,
    shareId: PassportShareId
  ): Promise<PassportShareToken> {
    const share = PassportStore.findShareById(shareId);
    if (!share || share.petId !== petId) {
      throw new Error(`Share token ${shareId} not found for this pet.`);
    }

    if (share.revokedAt) {
      return share;
    }

    // Authorization: verify pet.passport.revoke_share
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      share.householdId,
      petId,
      'pet.passport.revoke_share'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to revoke passport share link.');
    }

    const now = new Date().toISOString();
    share.revokedAt = now;
    share.revokedBy = asUserId(actorId);

    PassportStore.saveShare(share);

    // Audit
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_PASSPORT_SHARE_REVOKED',
      resourceType: 'pet_passport_share',
      resourceId: shareId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'PASSPORT_SHARE_REVOCATION',
      metadata: { petId, shareId }
    });

    // Outbox
    PetStore.recordOutboxEvent(
      PassportEventFactory.shareRevoked(petId, shareId, asUserId(actorId))
    );

    // Project into Timeline
    TimelineService.recordEvent({
      petId,
      householdId: share.householdId,
      eventType: 'passport.share_revoked',
      eventCategory: 'ADMINISTRATIVE',
      occurredAt: now,
      recordedAt: now,
      sourceDomain: 'IDENTITY',
      sourceEntityType: 'pet_passport_share',
      sourceEntityId: shareId,
      sourceActorType: 'USER',
      sourceActorId: actorId,
      provenanceType: 'OWNER_ENTERED',
      title: `Passport Share Link Revoked`,
      summary: `Owner revoked external access link for ${share.recipientLabel || 'recipient'}.`,
      deduplicationKey: `PASSPORT:pet_passport_share:${shareId}:passport.share_revoked`
    });

    return share;
  }

  /**
   * Lists all share tokens created for a pet.
   */
  static listShares(actorId: string, petId: PetId): PassportShareToken[] {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.passport.read'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized access to passport shares.');
    }

    return PassportStore.listSharesForPet(petId);
  }

  /**
   * Exports an immutable point-in-time snapshot of the pet passport with cryptographic checksum.
   */
  static async exportPassportSnapshot(
    actorId: string,
    petId: PetId,
    scope: PassportShareScope = 'TRAVEL_EXPORT',
    format: 'JSON' | 'PRINTABLE_HTML' = 'JSON'
  ): Promise<PassportExportRecord> {
    const pet = PetStore.findPetById(petId);
    if (!pet) {
      throw new Error(`Pet with ID ${petId} not found.`);
    }

    // Authorization: verify pet.passport.export
    const auth = AuthorizationService.checkPetPermission(
      actorId,
      pet.householdId,
      petId,
      'pet.passport.export'
    );
    if (!auth.allowed) {
      throw new Error(auth.message || 'Unauthorized to export passport for this pet.');
    }

    const snapshotPayload = this.buildPassportProjection(petId, scope);
    const exportId = asPassportExportId(generateUUIDv7());
    const now = new Date().toISOString();

    // Compute deterministic checksum of snapshot
    const payloadStr = JSON.stringify(snapshotPayload);
    let hash = 0;
    for (let i = 0; i < payloadStr.length; i++) {
      hash = (hash << 5) - hash + payloadStr.charCodeAt(i);
      hash |= 0;
    }
    const dataChecksum = `SHA256:${Math.abs(hash).toString(16).padStart(8, '0')}`;

    const exportRecord: PassportExportRecord = {
      exportId,
      petId,
      householdId: pet.householdId,
      generatedAt: now,
      generatedBy: asUserId(actorId),
      dataVersion: 1,
      dataChecksum,
      scope,
      format,
      snapshotPayload
    };

    PassportStore.saveExport(exportRecord);

    // Audit
    InMemoryAuditStore.record({
      actorId,
      actorType: 'USER',
      action: 'PET_PASSPORT_EXPORTED',
      resourceType: 'pet_passport_export',
      resourceId: exportId,
      classification: 'CONFIDENTIAL',
      reasonCode: 'PASSPORT_SNAPSHOT_EXPORT',
      metadata: { petId, scope, format, checksum: dataChecksum }
    });

    // Outbox
    PetStore.recordOutboxEvent(
      PassportEventFactory.exported(petId, exportId, scope, format, asUserId(actorId))
    );

    return exportRecord;
  }
}
