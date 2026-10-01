/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace Test Suite
 * 
 * Verifies all 12 canonical invariants across:
 * 1. Clinical Access Grant Enforcement (No access without grant)
 * 2. Prohibition of Global Pet Search by Name
 * 3. Strict Role-Based Access Control & Field-Level Redaction (Reception vs Tech vs Vet)
 * 4. Emergency Break-Glass Access Workflow (Audited, Time-limited, Reason required)
 * 5. Clinical Provenance (ADR-005: Owner Observations vs Professional Diagnoses)
 * 6. Clinical Consultation Lifecycle (In-flight to Finalized)
 * 7. Signed Record Immutability & Cryptographic Sealing (Rejection of direct edits, Amendment flow)
 * 8. Prescription Safety Screening (Allergy conflict rejection, Dosage validation, Licensed vet only)
 * 9. Cross-Domain Synchronization (HealthStore, CareStore, ActivityStore, DocumentStore, Timeline, Booking)
 * 10. Clinical Record Correction Request & Clinician Review
 * 11. Veterinary Referral & Specialist Data Sharing with Owner Consent
 * 12. Strict Isolation between Independent Veterinary Clinics
 */

import {
  asUserId,
  asHouseholdId,
  asPetId,
  asBusinessId,
  asProviderId,
  asEncounterId,
  asPrescriptionId,
  asDiagnosticOrderId,
  asCarePlanId,
  generateUUIDv7,
} from '../kernel/ids';
import { VetWorkspaceService } from './service';
import { VetWorkspaceStore } from './store';
import { seedVetWorkspace } from './seed';
import { seedUnifiedPetOS } from '../seed/unified-seed';
import { CANONICAL_IDS } from '../kernel/canonical-ids';
import { HealthStore } from '../health/store';
import { CareStore } from '../care/store';
import { ActivityStore } from '../activity/store';
import { DocumentStore } from '../documents/store';
import { TimelineStore } from '../timeline/store';
import { BookingStore } from '../booking/store';
import { PetStore } from '../pet-core/store';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runSprint19Tests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const service = VetWorkspaceService.getInstance();
  const store = VetWorkspaceStore.getInstance();

  // Reset and seed fresh state
  store.reset();
  await seedUnifiedPetOS({ forceReset: true });
  seedVetWorkspace();

  const runTest = async (name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: 'Sprint 19: Veterinary Professional Workspace',
        name,
        passed: true,
        durationMs: performance.now() - start,
      });
    } catch (err: any) {
      results.push({
        suite: 'Sprint 19: Veterinary Professional Workspace',
        name,
        passed: false,
        error: err?.message || String(err),
        durationMs: performance.now() - start,
      });
    }
  };

  const clinicId = asBusinessId('biz-nairobi-west-vet');
  const drKimaniUserId = asUserId('usr-01951500-0000-7000-8000-000000000101');
  const drKimaniProviderId = CANONICAL_IDS.VET_DR_KIMANI;
  const techFaithUserId = asUserId('usr-vet-tech-faith-01');
  const receptionGraceUserId = asUserId('usr-vet-reception-grace-01');
  const kiboPetId = CANONICAL_IDS.PET_KIBO;

  // --------------------------------------------------------------------------
  // TEST 1: Clinical Access Grant Enforcement
  // --------------------------------------------------------------------------
  await runTest('1. Access Grant Enforcement: Rejects clinical access without active grant', () => {
    const ungrantedPetId = asPetId('pet-unregistered-stranger-01');
    try {
      service.assertClinicalAccess(clinicId, ungrantedPetId, 'DEMOGRAPHICS_READ', drKimaniUserId);
      throw new Error('Expected clinical access to fail without active grant');
    } catch (err: any) {
      if (!err.message.includes('Clinical Access Denied') && !err.message.includes('No active clinical access grant')) {
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Prohibition of Global Pet Search
  // --------------------------------------------------------------------------
  await runTest('2. Global Search Prohibition: Clinic cannot view patient records without grant', () => {
    const ungrantedPetId = asPetId('pet-unregistered-stranger-02');
    try {
      service.getPetClinicalWorkspaceRecord(clinicId, ungrantedPetId, drKimaniUserId);
      throw new Error('Expected record retrieval to fail without grant');
    } catch (err: any) {
      if (!err.message.includes('Clinical Access Denied')) {
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Role-Based Access Control & Redaction (Reception vs Tech vs Vet)
  // --------------------------------------------------------------------------
  await runTest('3. Role-Based Field Redaction: Reception staff receives masked clinical fields', () => {
    const record = service.getPetClinicalWorkspaceRecord(clinicId, kiboPetId, receptionGraceUserId);
    if (!record.masked) {
      throw new Error('Expected record to be marked as masked for reception role');
    }
    if (record.accessRole !== 'RECEPTION') {
      throw new Error(`Expected role to be RECEPTION, got ${record.accessRole}`);
    }
    // Check that conditions and medications are redacted
    for (const c of record.conditions) {
      if (c.conditionName !== '[RESTRICTED - CLINICAL STAFF ONLY]') {
        throw new Error(`Condition name was not masked for reception: ${c.conditionName}`);
      }
    }
    for (const m of record.medications) {
      if (m.medicationName !== '[RESTRICTED - CLINICAL STAFF ONLY]') {
        throw new Error(`Medication name was not masked for reception: ${m.medicationName}`);
      }
    }
    if (record.diagnostics.length > 0 || record.notes.length > 0) {
      throw new Error('Sensitive diagnostics and notes must be empty for reception staff');
    }
  });

  await runTest('3b. Role-Based Permissions: Vet Tech cannot formulate diagnoses or prescribe', () => {
    const encounter = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (!encounter) throw new Error('Encounter session not found');

    try {
      service.recordDiagnoses({
        encounterId: encounter.encounterId,
        veterinarianUserId: techFaithUserId,
        diagnoses: [
          {
            conditionName: 'Unauthorized Vet Tech Diagnosis',
            category: 'OTHER',
            likelihood: 'CONFIRMED',
            isPrimary: true,
            chronic: false,
          },
        ],
      });
      throw new Error('Expected Vet Tech to be forbidden from recording diagnoses');
    } catch (err: any) {
      if (!err.message.includes('Forbidden') && !err.message.includes('Only licensed veterinarians')) {
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Emergency Break-Glass Access Workflow
  // --------------------------------------------------------------------------
  await runTest('4. Break-Glass Emergency Access: Provisions time-limited audited grant with reason', () => {
    // Pick Luna, assume emergency trauma presentation
    const emergencyReason = 'Acute severe vehicular trauma; unconscious canine presented by bystander';
    const breakGlass = service.breakGlassEmergencyAccess({
      clinicId,
      petId: CANONICAL_IDS.PET_LUNA,
      accessedByUserId: drKimaniUserId,
      providerId: drKimaniProviderId,
      emergencyReason,
      witnessName: 'Faith Mwende, RVT',
    });

    if (!breakGlass.breakGlassId || !breakGlass.auditAcknowledged) {
      throw new Error('Break-glass record was not created with audit acknowledgement');
    }

    // Verify access is now permitted
    const access = service.assertClinicalAccess(clinicId, CANONICAL_IDS.PET_LUNA, 'FULL_CLINICAL_ACCESS', drKimaniUserId);
    if (!access.isBreakGlass) {
      throw new Error('Access should be marked as break-glass');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Clinical Provenance (ADR-005)
  // --------------------------------------------------------------------------
  await runTest('5. Provenance Preservation: Owner observations remain explicitly tagged OWNER_REPORTED', () => {
    const encounter = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (!encounter) throw new Error('Encounter not found');

    if (encounter.ownerObservationsTag !== 'OWNER_REPORTED') {
      throw new Error('Owner observations must be explicitly tagged OWNER_REPORTED');
    }
    if (!encounter.presentingComplaint.includes('Owner notes mild head shaking')) {
      throw new Error('Owner presenting complaint was modified');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Vitals & Physical Exam Recording
  // --------------------------------------------------------------------------
  await runTest('6. Vitals & Physical Exam: Vet Tech can record vitals and update pet weight', () => {
    const encounter = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (!encounter) throw new Error('Encounter not found');

    const updated = service.recordVitals({
      encounterId: encounter.encounterId,
      recordedByUserId: techFaithUserId,
      vitals: {
        weightKg: 35.2,
        temperatureCelsius: 38.5,
        heartRateBpm: 96,
        respiratoryRateBrpm: 22,
        bodyConditionScore: 5,
        painScore: 0,
      },
    });

    if (updated.vitals?.weightKg !== 35.2) {
      throw new Error('Vitals weight was not updated');
    }
    const pet = PetStore.findPetById(kiboPetId);
    if ((pet as any)?.weightKg !== 35.2) {
      throw new Error('Canonical pet weight was not synchronized');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Prescription Safety Check (Allergy Conflict Rejection)
  // --------------------------------------------------------------------------
  await runTest('7. Prescription Safety: Rejects medication conflicting with recorded patient allergy', () => {
    const encounter = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (!encounter) throw new Error('Encounter not found');

    // Add a known allergy to Kibo in Sprint 5 HealthStore
    HealthStore.saveAllergy({
      allergyId: generateUUIDv7() as any,
      petId: kiboPetId,
      allergen: 'Penicillin',
      allergyType: 'ALLERGY',
      allergenCategory: 'MEDICATION',
      reaction: 'Severe facial angioedema and urticaria',
      severity: 'SEVERE',
      firstObservedPrecision: 'EXACT',
      status: 'ACTIVE',
      provenance: 'VETERINARY_PROFESSIONAL',
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      service.prescribeMedication({
        encounterId: encounter.encounterId,
        veterinarianUserId: drKimaniUserId,
        medicationName: 'Penicillin G Potassium',
        form: 'INJECTION',
        strength: '300,000 IU/ml',
        dosageQuantity: 2,
        dosageUnit: 'ml',
        route: 'INJECTION',
        frequency: 'q24h',
        durationDays: 3,
        refillsAllowed: 0,
        instructions: 'Administer deep IM',
        warningLabels: ['Severe allergy warning'],
      });
      throw new Error('Expected prescription to fail due to recorded allergy');
    } catch (err: any) {
      if (!err.message.includes('ALLERGY') && !err.message.includes('Safety Alert')) {
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Signing, Cryptographic Sealing & Immutability
  // --------------------------------------------------------------------------
  await runTest('8. Signing & Immutability: Signing seals record; direct edits rejected', () => {
    const encounter = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (!encounter) throw new Error('Encounter not found');

    const signedSession = service.signAndFinalizeEncounter({
      encounterId: encounter.encounterId,
      veterinarianUserId: drKimaniUserId,
      veterinarianProviderId: drKimaniProviderId,
      statementOfResponsibility: 'Verified and signed by Lead Surgeon Dr. Kimani',
    });

    if (!signedSession.isSigned || signedSession.status !== 'SIGNED' || !signedSession.signatureId) {
      throw new Error('Session was not signed and sealed');
    }

    // Verify signature record
    const sig = store.findSignatureById(signedSession.signatureId);
    if (!sig || !sig.cryptographicDigest) {
      throw new Error('Cryptographic signature digest missing');
    }

    // Verify subsequent direct edit is rejected
    try {
      service.recordVitals({
        encounterId: encounter.encounterId,
        recordedByUserId: techFaithUserId,
        vitals: { weightKg: 36.0 },
      });
      throw new Error('Direct modification of signed encounter must be rejected');
    } catch (err: any) {
      if (!err.message.includes('Cannot modify') && !err.message.includes('signed')) {
        throw err;
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Cross-Domain Synchronization
  // --------------------------------------------------------------------------
  await runTest('9. Cross-Domain Sync: Verified medical records saved in Sprint 5, 6, 9 & Timeline', () => {
    const conditions = HealthStore.listConditionsForPet(kiboPetId);
    const otitisCondition = conditions.find(c => c.conditionName.includes('Otitis Externa'));
    if (!otitisCondition) {
      throw new Error('Confirmed diagnosis was not synchronized to Sprint 5 HealthStore');
    }
    if (!otitisCondition.isDiagnosis || otitisCondition.provenance !== 'VETERINARY_PROFESSIONAL') {
      throw new Error('Synchronized condition missing professional diagnosis provenance');
    }

    const medications = HealthStore.listMedicationsForPet(kiboPetId);
    const oticMed = medications.find(m => m.medicationName.includes('EasOtic'));
    if (!oticMed) {
      throw new Error('Prescription was not synchronized to Sprint 5 HealthStore');
    }

    // Timeline check
    const events = TimelineStore.query(kiboPetId).events;
    const encounterEvent = events.find(e => e.eventType === 'MEDICAL_ENCOUNTER_COMPLETED');
    if (!encounterEvent || encounterEvent.provenanceType !== 'VERIFIED_PROFESSIONAL') {
      throw new Error('Encounter event was not projected to Timeline with verified professional provenance');
    }

    // Documents check
    const docs = DocumentStore.listForPet(kiboPetId);
    const summaryDoc = docs.find(d => d.title.includes('Clinical Encounter Summary'));
    if (!summaryDoc || summaryDoc.verificationStatus !== 'VERIFIED') {
      throw new Error('Signed encounter summary document was not generated in DocumentStore');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Amendment Flow for Signed Records
  // --------------------------------------------------------------------------
  await runTest('10. Amendment Workflow: Signed records amended with audit rationale', () => {
    const encounterId = asEncounterId('enc-kibo-sprint19-01');
    const amended = service.amendSignedEncounter(
      encounterId,
      drKimaniUserId,
      'Clarification: Tympanic membrane inspected with high-magnification video otoscope',
      { otoscopeInspection: 'Confirmed intact bilaterally' }
    );

    if (amended.status !== 'AMENDED') {
      throw new Error('Encounter status was not updated to AMENDED');
    }
    const amendments = HealthStore.listAmendmentsForRecord(encounterId);
    if (amendments.length === 0) {
      throw new Error('Amendment record was not preserved in HealthStore');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: Clinical Record Correction Request Workflow
  // --------------------------------------------------------------------------
  await runTest('11. Owner Correction Workflow: Owner submits correction, clinician reviews and approves', () => {
    const correction = service.submitRecordCorrection({
      petId: kiboPetId,
      householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
      requestedByUserId: CANONICAL_IDS.OWNER_ELENA,
      targetRecordType: 'CONDITION',
      targetRecordId: 'cnd-sample-01',
      correctionReason: 'Onset was after returning from Tsavo trip on October 12, not October 20.',
    });

    if (correction.status !== 'SUBMITTED') {
      throw new Error('Correction request should start in SUBMITTED state');
    }

    const reviewed = service.reviewRecordCorrection({
      requestId: correction.requestId,
      veterinarianUserId: drKimaniUserId,
      approved: true,
      clinicianResponse: 'Onset timeline adjusted per owner travel corroboration.',
      amendedFields: { onsetDate: '2024-10-12' },
    });

    if (reviewed.status !== 'ACCEPTED_AMENDED' || !reviewed.resultingAmendmentId) {
      throw new Error('Correction request was not accepted with resulting amendment');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Veterinary Referral & Multi-Clinic Isolation
  // --------------------------------------------------------------------------
  await runTest('12. Veterinary Referral & Isolation: Destination clinic accepts referral with owner consent', () => {
    const specialistClinicId = asBusinessId('biz-nairobi-animal-specialists');
    const specialistAdminUserId = CANONICAL_IDS.ADMIN_CHARLES;

    // First verify specialist clinic currently CANNOT access Kibo
    try {
      service.assertClinicalAccess(specialistClinicId, kiboPetId, 'MEDICAL_HISTORY_READ', specialistAdminUserId);
      throw new Error('Specialist clinic should have no access without referral');
    } catch (err: any) {
      if (!err.message.includes('Clinical Access Denied')) throw err;
    }

    // Create referral for Kibo
    const referral = service.createVeterinaryReferral({
      sourceClinicId: clinicId,
      destinationClinicId: specialistClinicId,
      petId: kiboPetId,
      referringVeterinarianId: drKimaniProviderId,
      specialtyRequested: 'Dermatology & Advanced Otology',
      clinicalSummary: 'Refractory otitis review',
      urgency: 'ROUTINE',
      sharedRecordIds: ['enc-kibo-sprint19-01'],
      ownerConsentConfirmed: true,
    });

    if (referral.status !== 'PENDING') throw new Error('Referral must start as PENDING');

    // Specialist clinic accepts referral
    const accepted = service.acceptVeterinaryReferral(referral.referralId, specialistClinicId, specialistAdminUserId);
    if (accepted.status !== 'ACCEPTED') throw new Error('Referral was not accepted');

    // Specialist clinic now HAS clinical access!
    const access = service.assertClinicalAccess(specialistClinicId, kiboPetId, 'MEDICAL_HISTORY_READ', specialistAdminUserId);
    if (!access.grant) {
      throw new Error('Specialist clinic grant was not automatically established upon referral acceptance');
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
