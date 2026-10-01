/**
 * Pet OS Sprint 4 - Comprehensive Domain & Invariant Verification Test Suite
 * Validates:
 * - Timeline: occurred_at vs recorded_at, append-only supersession, retraction, deduplication, projection
 * - Documents: secure storage partitioning, MIME/extension validation, virus/script gating, supersession, secure download tokens
 * - Passport: read-model projections, 4 privacy scopes, field-level masking, cryptographic share tokens, revocation, snapshots
 * - Multi-tenant cross-household authorization & strict role matrix enforcement
 */

import { TimelineService } from '../timeline/service';
import { TimelineStore } from '../timeline/store';
import { DocumentService } from '../documents/service';
import { DocumentStore } from '../documents/store';
import { PrivateDocumentStorageEngine } from '../documents/storage';
import { PassportService } from '../passport/service';
import { PassportStore } from '../passport/store';
import { PetCoreService } from '../pet-core/service';
import { PetStore } from '../pet-core/store';
import { IdentityStore } from '../identity/store';
import { AuthorizationService } from '../identity/authorization';
import { InMemoryAuditStore } from '../kernel/audit';
import { 
  asUserId, 
  asHouseholdId, 
  asPetId, 
  generateUUIDv7 
} from '../kernel/ids';

export interface TestResult {
  id: string;
  name: string;
  category: 'TIMELINE' | 'DOCUMENTS' | 'PASSPORT' | 'SECURITY' | 'INTEGRATION';
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export class Sprint4TestSuite {
  /**
   * Runs the complete Sprint 4 verification suite.
   */
  static async runAll(): Promise<{
    results: TestResult[];
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }> {
    const startTime = performance.now();
    const results: TestResult[] = [];

    // Helper to execute test
    const execTest = async (
      id: string,
      name: string,
      category: TestResult['category'],
      fn: () => Promise<void> | void
    ) => {
      const t0 = performance.now();
      try {
        await fn();
        results.push({
          id,
          name,
          category,
          status: 'PASSED',
          durationMs: Math.round(performance.now() - t0),
          message: 'Assertion verified successfully.'
        });
      } catch (err: any) {
        results.push({
          id,
          name,
          category,
          status: 'FAILED',
          durationMs: Math.round(performance.now() - t0),
          message: err.message || 'Unknown test failure',
          details: { error: String(err) }
        });
      }
    };

    // Setup Mock Environment
    PetStore.reset();
    TimelineStore.reset();
    DocumentStore.reset();
    PassportStore.reset();
    PrivateDocumentStorageEngine.reset();
    InMemoryAuditStore.clear();

    const householdAId = asHouseholdId('hh-sprint4-household-a');
    const householdBId = asHouseholdId('hh-sprint4-household-b');
    const ownerAId = asUserId('usr-sprint4-owner-a');
    const caregiverAId = asUserId('usr-sprint4-caregiver-a');
    const outsiderBId = asUserId('usr-sprint4-outsider-b');
    const now = new Date().toISOString();

    // Register Users & Profiles
    IdentityStore.saveUser({
      userId: ownerAId,
      email: 'owner.a@example.com',
      normalizedEmail: 'owner.a@example.com',
      passwordHash: 'hash_a',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveProfile({
      userId: ownerAId,
      displayName: 'Alice Wambui (Owner A)',
      firstName: 'Alice',
      lastName: 'Wambui',
      avatarUrl: undefined,
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    IdentityStore.saveUser({
      userId: caregiverAId,
      email: 'caregiver.a@example.com',
      normalizedEmail: 'caregiver.a@example.com',
      passwordHash: 'hash_b',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveProfile({
      userId: caregiverAId,
      displayName: 'Bob Otieno (Caregiver A)',
      firstName: 'Bob',
      lastName: 'Otieno',
      avatarUrl: undefined,
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    IdentityStore.saveUser({
      userId: outsiderBId,
      email: 'outsider.b@example.com',
      normalizedEmail: 'outsider.b@example.com',
      passwordHash: 'hash_c',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveProfile({
      userId: outsiderBId,
      displayName: 'Charles Njoroge (Outsider B)',
      firstName: 'Charles',
      lastName: 'Njoroge',
      avatarUrl: undefined,
      locale: 'en-KE',
      timezone: 'Africa/Nairobi',
      communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
      privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
      updatedAt: now
    });

    IdentityStore.saveHousehold({
      householdId: householdAId,
      name: 'Wambui Canine Sanctuary',
      status: 'ACTIVE',
      ownerUserId: ownerAId,
      createdAt: now,
      updatedAt: now
    });

    IdentityStore.saveHousehold({
      householdId: householdBId,
      name: 'Njoroge Household',
      status: 'ACTIVE',
      ownerUserId: outsiderBId,
      createdAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: 'mem-1' as any,
      householdId: householdAId,
      userId: ownerAId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: 'mem-2' as any,
      householdId: householdAId,
      userId: caregiverAId,
      role: 'CAREGIVER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: 'mem-3' as any,
      householdId: householdBId,
      userId: outsiderBId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    // Create Initial Pet A in Household A
    const petDto = await PetCoreService.createPet(ownerAId, householdAId, {
      name: 'Simba',
      speciesCode: 'SPECIES_DOG',
      breedCode: 'BREED_DOG_GERMAN_SHEPHERD',
      sex: 'MALE',
      reproductiveStatus: 'INTACT',
      birthdatePrecision: 'EXACT',
      dateOfBirth: '2022-06-15',
      primaryColor: 'SABLE',
      sizeClassification: 'LARGE',
      microchipNumber: '985141001234567',
      microchipIssuer: 'KVA RFID'
    });

    const petId = petDto.petId;

    // --- TIMELINE TESTS ---

    await execTest(
      'TL-001',
      'Historical insertion: occurred_at vs recorded_at distinction',
      'TIMELINE',
      async () => {
        // Record an adoption event that occurred 2 years ago
        const pastDate = '2022-08-10T10:00:00Z';
        const recordedBefore = new Date().toISOString();

        const event = TimelineService.recordEvent({
          petId,
          householdId: householdAId,
          eventType: 'pet.adopted',
          eventCategory: 'LIFECYCLE',
          occurredAt: pastDate,
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'adoption_record',
          sourceEntityId: 'adopt-001',
          sourceActorType: 'USER',
          sourceActorId: ownerAId,
          provenanceType: 'OWNER_ENTERED',
          title: 'Adopted Simba from Shelter',
          summary: 'Simba joined our family at 2 months old.'
        });

        if (event.occurredAt !== pastDate) {
          throw new Error(`Expected occurredAt ${pastDate}, got ${event.occurredAt}`);
        }
        if (new Date(event.recordedAt).getTime() < new Date(recordedBefore).getTime()) {
          throw new Error('recordedAt must reflect current system time, not historical occurredAt');
        }

        // Verify query ordering: historical event should sort in correct historical position
        const query = TimelineService.listPetTimeline(ownerAId, petId, { ascending: true });
        if (query.events.length === 0 || query.events[0].eventType !== 'pet.created' && query.events[0].occurredAt > pastDate) {
          throw new Error('Timeline sorting by occurredAt failed');
        }
      }
    );

    await execTest(
      'TL-002',
      'Deduplication & Idempotency: Duplicate keys return existing entry',
      'TIMELINE',
      async () => {
        const dedupeKey = 'VET_VISIT:consultation-789:health_check';
        const ev1 = TimelineService.recordEvent({
          petId,
          householdId: householdAId,
          eventType: 'health.consultation',
          eventCategory: 'HEALTH',
          occurredAt: '2023-01-15T14:00:00Z',
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'consultation',
          sourceEntityId: 'consultation-789',
          sourceActorType: 'USER',
          sourceActorId: ownerAId,
          provenanceType: 'OWNER_ENTERED',
          title: 'Annual Physical Examination',
          summary: 'Simba is healthy and active.',
          deduplicationKey: dedupeKey
        });

        const ev2 = TimelineService.recordEvent({
          petId,
          householdId: householdAId,
          eventType: 'health.consultation',
          eventCategory: 'HEALTH',
          occurredAt: '2023-01-15T14:00:00Z',
          sourceDomain: 'PET_CORE',
          sourceEntityType: 'consultation',
          sourceEntityId: 'consultation-789',
          sourceActorType: 'USER',
          sourceActorId: ownerAId,
          provenanceType: 'OWNER_ENTERED',
          title: 'Duplicate payload attempt',
          summary: 'Different summary that should be ignored by idempotency.',
          deduplicationKey: dedupeKey
        });

        if (ev1.timelineEventId !== ev2.timelineEventId) {
          throw new Error('Idempotency violation: duplicate deduplicationKey created distinct event IDs');
        }
      }
    );

    await execTest(
      'TL-003',
      'Append-only supersession pattern for historical correction',
      'TIMELINE',
      async () => {
        // Record initial observation
        const obs = TimelineService.recordManualObservation(
          ownerAId,
          petId,
          'Weight Observation',
          'Simba weighed 28kg today.',
          'HEALTH'
        );

        // Supersede observation
        const corrected = TimelineService.supersedeEvent({
          oldEventId: obs.timelineEventId,
          actorId: ownerAId,
          reason: 'Correction: scale was calibrated in lbs instead of kg, true weight is 32kg.',
          updatedData: {
            summary: 'Simba weighed 32kg today (calibrated scale).'
          }
        });

        if (corrected.supersedes !== obs.timelineEventId) {
          throw new Error('Replacement event must reference superseded oldEventId');
        }

        const oldAfter = TimelineStore.findById(obs.timelineEventId);
        if (!oldAfter || oldAfter.status !== 'SUPERSEDED' || oldAfter.supersededBy !== corrected.timelineEventId) {
          throw new Error('Old event must be marked SUPERSEDED with supersededBy link');
        }

        // Active query should exclude superseded by default
        const activeList = TimelineService.listPetTimeline(ownerAId, petId);
        if (activeList.events.some(e => e.timelineEventId === obs.timelineEventId)) {
          throw new Error('Active timeline queries must exclude superseded events by default');
        }
      }
    );

    await execTest(
      'TL-004',
      'Event retraction with recorded reason & audit trail',
      'TIMELINE',
      async () => {
        const errEvent = TimelineService.recordManualObservation(
          ownerAId,
          petId,
          'Accidental Entry',
          'Wrong pet selected by owner.',
          'ACTIVITY'
        );

        const retracted = TimelineService.retractEvent({
          eventId: errEvent.timelineEventId,
          actorId: ownerAId,
          reason: 'Recorded under wrong pet account'
        });

        if (retracted.status !== 'RETRACTED' || !retracted.retractedAt || !retracted.retractedReason) {
          throw new Error('Retracted event must have status RETRACTED and recorded reason');
        }

        const activeList = TimelineService.listPetTimeline(ownerAId, petId);
        if (activeList.events.some(e => e.timelineEventId === errEvent.timelineEventId)) {
          throw new Error('Active timeline queries must exclude retracted events');
        }
      }
    );

    await execTest(
      'TL-005',
      'Cross-household boundary isolation on Timeline query and modification',
      'SECURITY',
      async () => {
        try {
          TimelineService.listPetTimeline(outsiderBId, petId);
          throw new Error('Expected cross-household access to be blocked for outsider');
        } catch (err: any) {
          if (!err.message.includes('boundary') && !err.message.includes('Unauthorized')) {
            throw err;
          }
        }

        try {
          TimelineService.recordManualObservation(
            outsiderBId,
            petId,
            'Malicious Injection',
            'Outsider attempting to add observation.'
          );
          throw new Error('Expected cross-household modification to be rejected');
        } catch (err: any) {
          if (!err.message.includes('Unauthorized') && !err.message.includes('boundary') && !err.message.includes('Cross-household')) {
            throw err;
          }
        }
      }
    );

    // --- DOCUMENTS TESTS ---

    let uploadedDocId: any;

    await execTest(
      'DOC-001',
      'Secure file upload: private partitioning, validation, checksum & timeline projection',
      'DOCUMENTS',
      async () => {
        const dummyPdf = '%PDF-1.4 Simulated valid vaccination certificate content for Simba';
        const doc = await DocumentService.uploadDocument(ownerAId, {
          petId,
          documentType: 'VACCINATION_CERTIFICATE',
          title: 'Rabies Vaccination Certificate 2024',
          description: 'Official 3-year rabies vaccination certificate',
          originalFilename: 'rabies_cert_2024.pdf',
          mediaType: 'application/pdf',
          fileData: dummyPdf,
          issuedAt: '2024-01-10',
          expiresAt: '2027-01-10',
          issuingOrganization: 'Nairobi West Veterinary Clinic',
          provenanceType: 'OWNER_ENTERED'
        });

        uploadedDocId = doc.documentId;

        // Check private storage key format
        if (!doc.storageKey.startsWith(`households/${householdAId}/pets/${petId}/documents/${doc.documentId}/`)) {
          throw new Error(`Invalid private storage key format: ${doc.storageKey}`);
        }

        if (doc.versionNumber !== 1 || doc.documentStatus !== 'ACTIVE' || !doc.checksum) {
          throw new Error('Invalid document initial state');
        }

        // Verify projection in timeline
        const timeline = TimelineService.listPetTimeline(ownerAId, petId, { category: 'DOCUMENT' });
        const docEvent = timeline.events.find(e => e.sourceEntityId === doc.documentId);
        if (!docEvent) {
          throw new Error('Document upload must be projected into Pet Timeline');
        }
      }
    );

    await execTest(
      'DOC-002',
      'Security boundary: rejection of dangerous extensions and script signatures',
      'SECURITY',
      async () => {
        // Disallowed extension
        try {
          await DocumentService.uploadDocument(ownerAId, {
            petId,
            documentType: 'OTHER',
            title: 'Malicious Script',
            originalFilename: 'exploit.sh',
            mediaType: 'application/pdf',
            fileData: 'echo "hello"'
          });
          throw new Error('Expected upload of .sh file to be rejected');
        } catch (err: any) {
          if (!err.message.includes('prohibited') && !err.message.includes('validation')) {
            throw err;
          }
        }

        // Disallowed MIME type
        try {
          await DocumentService.uploadDocument(ownerAId, {
            petId,
            documentType: 'OTHER',
            title: 'Malicious MIME',
            originalFilename: 'file.pdf',
            mediaType: 'application/x-sh',
            fileData: 'binary data'
          });
          throw new Error('Expected invalid MIME type to be rejected');
        } catch (err: any) {
          if (!err.message.includes('MIME type') && !err.message.includes('validation')) {
            throw err;
          }
        }

        // Script tag signature
        try {
          await DocumentService.uploadDocument(ownerAId, {
            petId,
            documentType: 'OTHER',
            title: 'XSS File',
            originalFilename: 'xss.png',
            mediaType: 'image/png',
            fileData: '<script>alert("xss")</script>'
          });
          throw new Error('Expected executable script signature to be rejected by security scan');
        } catch (err: any) {
          if (!err.message.includes('security scan') && !err.message.includes('script signatures')) {
            throw err;
          }
        }
      }
    );

    await execTest(
      'DOC-003',
      'Document versioning & supersession (v1 -> v2)',
      'DOCUMENTS',
      async () => {
        const replacementPdf = '%PDF-1.4 Renewed booster vaccination certificate';
        const docV2 = await DocumentService.replaceDocument(ownerAId, {
          oldDocumentId: uploadedDocId,
          title: 'Rabies Booster Certificate 2024 (Updated)',
          originalFilename: 'rabies_booster_v2.pdf',
          mediaType: 'application/pdf',
          fileData: replacementPdf,
          reason: 'Veterinary clinic issued revised booster date'
        });

        if (docV2.versionNumber !== 2 || docV2.replacedDocumentId !== uploadedDocId) {
          throw new Error('Replaced document must increment versionNumber and point to replacedDocumentId');
        }

        const oldDoc = DocumentStore.findById(uploadedDocId);
        if (!oldDoc || oldDoc.documentStatus !== 'SUPERSEDED') {
          throw new Error('Original document must be marked SUPERSEDED');
        }

        // Active list should show v2, not v1
        const activeDocs = DocumentService.listDocuments(ownerAId, petId);
        if (activeDocs.some(d => d.documentId === uploadedDocId)) {
          throw new Error('Default document list must omit superseded documents');
        }
        if (!activeDocs.some(d => d.documentId === docV2.documentId)) {
          throw new Error('Default document list must include active v2 document');
        }
      }
    );

    await execTest(
      'DOC-004',
      'Secure download tokens: short-lived signed grant (no permanent public URLs)',
      'SECURITY',
      async () => {
        const docs = DocumentService.listDocuments(ownerAId, petId);
        const activeDoc = docs[0];

        const grant = DocumentService.generateSecureDownloadGrant(ownerAId, petId, activeDoc.documentId);

        if (!grant.grantToken || !grant.downloadUrl.includes('token=')) {
          throw new Error('Download grant must include secure signed token and download URL');
        }

        const expiryMs = new Date(grant.expiresAt).getTime() - Date.now();
        if (expiryMs <= 0 || expiryMs > 16 * 60 * 1000) {
          throw new Error('Download grant must have approximately 15 minutes validity');
        }

        // Consume grant
        const blob = DocumentService.consumeDownloadGrant(grant.grantToken, activeDoc.documentId);
        if (!blob || blob.documentId !== activeDoc.documentId) {
          throw new Error('Consuming download grant failed to retrieve stored blob');
        }

        // Outsider cannot generate download grant
        try {
          DocumentService.generateSecureDownloadGrant(outsiderBId, petId, activeDoc.documentId);
          throw new Error('Expected outsider download grant request to be blocked');
        } catch (err: any) {
          if (!err.message.includes('Unauthorized') && !err.message.includes('boundary') && !err.message.includes('Cross-household')) {
            throw err;
          }
        }
      }
    );

    // --- PASSPORT TESTS ---

    await execTest(
      'PASS-001',
      'Passport generation with strict clinical boundary (no fabricated medical data)',
      'PASSPORT',
      async () => {
        const passport = await PassportService.generatePassport(ownerAId, petId, 'PRIVATE');

        if (passport.name !== 'Simba' || passport.breedCode !== 'BREED_DOG_GERMAN_SHEPHERD') {
          throw new Error('Passport identity projection mismatched');
        }

        if (!passport.microchip || passport.microchip.isLocationTracker !== false) {
          throw new Error('ADR-006 violation: Microchip must explicitly declare isLocationTracker: false');
        }

        if (passport.futureHealthNotice.clinicalCareAvailable !== false) {
          throw new Error('Clinical safety boundary violation: clinicalCareAvailable must be false');
        }
      }
    );

    await execTest(
      'PASS-002',
      'Privacy Scopes: FINDER_RECOVERY field-level masking & privacy preservation',
      'PASSPORT',
      async () => {
        const finderPassport = await PassportService.generatePassport(ownerAId, petId, 'FINDER_RECOVERY');

        // Verify privacy boundaries:
        if (finderPassport.contactPathway.emergencyEmail !== undefined) {
          throw new Error('FINDER_RECOVERY scope must redact owner private email');
        }

        if (!finderPassport.contactPathway.notes?.includes('Finder Recovery Mode')) {
          throw new Error('FINDER_RECOVERY scope must route through secure relay');
        }

        if (finderPassport.documents.length !== 0) {
          throw new Error('FINDER_RECOVERY scope must not expose private household documents');
        }

        if (finderPassport.dateOfBirth !== undefined) {
          throw new Error('FINDER_RECOVERY scope must not expose exact birthdate');
        }
      }
    );

    let shareTokenStr = '';
    let shareIdVal: any;

    await execTest(
      'PASS-003',
      'Cryptographic share token creation, resolution, access tracking & revocation',
      'PASSPORT',
      async () => {
        const { shareToken, shareUrl } = await PassportService.createShareToken(ownerAId, {
          petId,
          scope: 'CARE_PROVIDER_SHARE',
          expiresInHours: 48,
          recipientLabel: 'Nairobi Paws Boarding'
        });

        shareTokenStr = shareToken.token;
        shareIdVal = shareToken.shareId;

        if (shareTokenStr.length < 32 || !shareUrl.includes(shareTokenStr)) {
          throw new Error('High entropy token must be generated and returned in shareUrl');
        }

        // Resolve shared passport
        const resolved = await PassportService.resolveSharedPassport(shareTokenStr);
        if (resolved.passport.name !== 'Simba' || resolved.shareMeta.scope !== 'CARE_PROVIDER_SHARE') {
          throw new Error('Shared passport resolution failed or scope mismatched');
        }

        if (resolved.shareMeta.accessCount !== 1) {
          throw new Error(`Expected accessCount to be 1, got ${resolved.shareMeta.accessCount}`);
        }

        // Revoke token
        await PassportService.revokeShareToken(ownerAId, petId, shareIdVal);

        // Attempt resolving revoked token
        try {
          await PassportService.resolveSharedPassport(shareTokenStr);
          throw new Error('Expected resolution of revoked share token to fail');
        } catch (err: any) {
          if (!err.message.includes('revoked')) {
            throw err;
          }
        }
      }
    );

    await execTest(
      'PASS-004',
      'Passport Snapshot Export with point-in-time cryptographic checksum',
      'PASSPORT',
      async () => {
        const exportRec = await PassportService.exportPassportSnapshot(
          ownerAId,
          petId,
          'TRAVEL_EXPORT',
          'JSON'
        );

        if (!exportRec.exportId || !exportRec.dataChecksum.startsWith('SHA256:')) {
          throw new Error('Export record must contain exportId and cryptographic checksum');
        }

        if (exportRec.snapshotPayload.petId !== petId) {
          throw new Error('Snapshot payload petId mismatched');
        }

        // Verify outbox event emitted
        const outbox = PetStore.listOutboxEvents();
        const exportEvent = outbox.find(e => e.eventType === 'passport.exported');
        if (!exportEvent) {
          throw new Error('passport.exported domain event not found in outbox');
        }
      }
    );

    await execTest(
      'PASS-005',
      'Role-based permissions matrix enforcement for Caregiver vs Owner',
      'SECURITY',
      async () => {
        // Caregiver A CAN read timeline and upload documents
        const caregiverTimeline = TimelineService.listPetTimeline(caregiverAId, petId);
        if (!caregiverTimeline) {
          throw new Error('Caregiver must be allowed to read timeline');
        }

        // Caregiver CANNOT export passport (only HOUSEHOLD_OWNER and HOUSEHOLD_ADMIN can export)
        try {
          await PassportService.exportPassportSnapshot(caregiverAId, petId);
          throw new Error('Expected caregiver passport export to be forbidden');
        } catch (err: any) {
          if (!err.message.includes('Unauthorized') && !err.message.includes('lacks required permission') && !err.message.includes('permission')) {
            throw err;
          }
        }
      }
    );

    const totalDuration = Math.round(performance.now() - startTime);
    const passedCount = results.filter(r => r.status === 'PASSED').length;
    const failedCount = results.filter(r => r.status === 'FAILED').length;

    return {
      results,
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      durationMs: totalDuration
    };
  }
}
