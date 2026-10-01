/**
 * Pet OS Sprint 5 - Comprehensive Veterinary Health Test Suite
 * Validates Volume VII, Volume XXIV, Volume XXVIII, ADR-005, and Sprint 5 requirements
 */

import { HealthService } from './service';
import { HealthStore } from './store';
import { PetStore } from '../pet-core/store';
import { PetCoreService } from '../pet-core/service';
import { IdentityStore } from '../identity/store';
import { TimelineService } from '../timeline/service';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  generateUUIDv7,
  ConditionId,
  MedicationId,
  VaccinationId
} from '../kernel/ids';

export interface TestResult {
  code: string;
  name: string;
  category: 'PROVENANCE' | 'VERIFICATION' | 'ALLERGIES' | 'VACCINATIONS' | 'MEDICATIONS' | 'ENCOUNTERS' | 'IMMUTABILITY' | 'AUTHORIZATION' | 'SUMMARY' | 'TIMELINE';
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export class Sprint5HealthTestSuite {
  static async runAllTests(): Promise<{
    results: TestResult[];
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    const execTest = async (
      code: string,
      name: string,
      category: TestResult['category'],
      fn: () => Promise<void> | void
    ) => {
      const t0 = Date.now();
      try {
        await fn();
        results.push({
          code,
          name,
          category,
          passed: true,
          durationMs: Date.now() - t0
        });
      } catch (err: any) {
        results.push({
          code,
          name,
          category,
          passed: false,
          durationMs: Date.now() - t0,
          error: err.message || String(err)
        });
      }
    };

    // --- SETUP FIXTURES ---
    const now = new Date().toISOString();
    const ownerUserId = asUserId(`test-usr-owner-${Date.now()}`);
    const outsiderUserId = asUserId(`test-usr-outsider-${Date.now()}`);
    const tempCaregiverId = asUserId(`test-usr-temp-${Date.now()}`);
    const householdId = asHouseholdId(`test-hh-health-${Date.now()}`);
    const outsiderHhId = asHouseholdId(`test-hh-outsider-${Date.now()}`);

    // Identity fixtures
    IdentityStore.saveUser({
      userId: ownerUserId,
      email: `owner-${Date.now()}@health.test`,
      normalizedEmail: `owner-${Date.now()}@health.test`,
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveUser({
      userId: outsiderUserId,
      email: `outsider-${Date.now()}@health.test`,
      normalizedEmail: `outsider-${Date.now()}@health.test`,
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveUser({
      userId: tempCaregiverId,
      email: `temp-${Date.now()}@health.test`,
      normalizedEmail: `temp-${Date.now()}@health.test`,
      passwordHash: 'hash',
      accountStatus: 'ACTIVE',
      failedLoginAttempts: 0,
      createdAt: now,
      updatedAt: now,
      policyAcceptedAt: now,
      policyVersion: '1.0'
    });

    IdentityStore.saveHousehold({
      householdId,
      name: 'Health Test Household',
      status: 'ACTIVE',
      ownerUserId,
      createdAt: now,
      updatedAt: now
    });

    IdentityStore.saveHousehold({
      householdId: outsiderHhId,
      name: 'Outsider Test Household',
      status: 'ACTIVE',
      ownerUserId: outsiderUserId,
      createdAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: `mem-owner-${Date.now()}` as any,
      householdId,
      userId: ownerUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: `mem-temp-${Date.now()}` as any,
      householdId,
      userId: tempCaregiverId,
      role: 'TEMPORARY_CAREGIVER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    IdentityStore.saveMembership({
      membershipId: `mem-out-${Date.now()}` as any,
      householdId: outsiderHhId,
      userId: outsiderUserId,
      role: 'HOUSEHOLD_OWNER',
      status: 'ACTIVE',
      joinedAt: now,
      updatedAt: now
    });

    // Create test pet
    const chipNum = `985${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const testPetDto = await PetCoreService.createPet(ownerUserId, householdId, {
      name: 'Kibo',
      speciesCode: 'SPECIES_DOG',
      breedCode: 'BREED_DOG_RHODESIAN_RIDGEBACK',
      sex: 'MALE',
      reproductiveStatus: 'INTACT',
      birthdatePrecision: 'EXACT',
      dateOfBirth: '2022-03-10',
      primaryColor: 'RED_WHEATEN',
      sizeClassification: 'LARGE',
      microchipNumber: chipNum
    });
    const petId = testPetDto.petId;

    // --- TEST 1: PROVENANCE - OWNER OBSERVATION VS PROFESSIONAL DIAGNOSIS ---
    await execTest(
      'HLT-001',
      'Clinical Provenance: Owner Observation must never be labeled as Diagnosis',
      'PROVENANCE',
      () => {
        const observation = HealthService.recordCondition(ownerUserId, {
          petId,
          isDiagnosis: false,
          conditionName: 'Scratching left flank intermittently',
          category: 'DERMATOLOGY',
          provenance: 'OWNER_ENTERED'
        });

        if (observation.isDiagnosis !== false) {
          throw new Error('Owner observation was incorrectly marked as a diagnosis.');
        }
        if (observation.provenance !== 'OWNER_ENTERED') {
          throw new Error('Provenance was not set to OWNER_ENTERED.');
        }
        if (observation.verificationStatus !== 'UNVERIFIED') {
          throw new Error('Owner observation must default to UNVERIFIED.');
        }

        const diagnosis = HealthService.recordCondition(ownerUserId, {
          petId,
          isDiagnosis: true,
          conditionName: 'Canine Atopic Dermatitis',
          category: 'DERMATOLOGY',
          provenance: 'VETERINARY_PROFESSIONAL',
          externalProviderName: 'Dr. Kimani, KVB #8812'
        });

        if (diagnosis.isDiagnosis !== true) {
          throw new Error('Clinical diagnosis was not marked as diagnosis.');
        }
        if (diagnosis.provenance !== 'VETERINARY_PROFESSIONAL') {
          throw new Error('Clinical diagnosis provenance should be VETERINARY_PROFESSIONAL.');
        }
        if (diagnosis.verificationStatus !== 'VERIFIED') {
          throw new Error('Veterinary diagnosis should be VERIFIED.');
        }
      }
    );

    // --- TEST 2: ALLERGIES & SEVERITY CLASSIFICATION ---
    await execTest(
      'HLT-002',
      'Allergy Registration: Correct categorization, severity and reaction',
      'ALLERGIES',
      () => {
        const allergy = HealthService.recordAllergy(ownerUserId, {
          petId,
          allergen: 'Beef Protein',
          allergenCategory: 'FOOD',
          allergyType: 'ALLERGY',
          reaction: 'Severe urticaria, periorbital edema and facial swelling',
          severity: 'SEVERE',
          clinicalNotes: 'Confirmed by elimination dietary challenge.'
        });

        if (allergy.allergen !== 'Beef Protein') throw new Error('Allergen name mismatch');
        if (allergy.severity !== 'SEVERE') throw new Error('Severity mismatch');
        if (allergy.allergenCategory !== 'FOOD') throw new Error('Allergen category mismatch');
      }
    );

    // --- TEST 3: VETERINARY ENCOUNTER & FOLLOW-UP ---
    await execTest(
      'HLT-003',
      'Veterinary Encounter: Records clinic, provider, reason and follow-up plan',
      'ENCOUNTERS',
      () => {
        const encounter = HealthService.recordEncounter(ownerUserId, {
          petId,
          encounterType: 'ROUTINE_CHECKUP',
          occurredAt: '2024-05-10T11:00:00Z',
          reason: 'Annual Wellness & Core Vaccination Check',
          externalClinicName: 'Nairobi Animal Clinic',
          externalProviderName: 'Dr. Kimani',
          followUpRequired: true,
          followUpDate: '2024-11-10'
        });

        if (encounter.status !== 'COMPLETED') throw new Error('Encounter status should be COMPLETED');
        if (!encounter.followUpRequired) throw new Error('Follow-up flag missing');
        if (encounter.externalClinicName !== 'Nairobi Animal Clinic') throw new Error('Clinic name mismatch');
      }
    );

    // --- TEST 4: VACCINATION & BATCH/LOT TRACKING ---
    let vacId: VaccinationId;
    await execTest(
      'HLT-004',
      'Vaccination: Target diseases, validity dates, batch/lot tracking',
      'VACCINATIONS',
      () => {
        const vac = HealthService.recordVaccination(ownerUserId, {
          petId,
          vaccineCode: 'CANINE_RABIES',
          administeredAt: '2024-01-15',
          validFrom: '2024-01-15',
          validUntil: '2027-01-15',
          nextDueAt: '2027-01-15',
          dose: '1.0 mL',
          batchLotNumber: 'LOT-99881',
          manufacturer: 'MSD Animal Health',
          externalClinicName: 'Nairobi Animal Clinic'
        });

        vacId = vac.vaccinationId;
        if (!vac.targetDiseases.some(d => d.includes('Rabies'))) {
          throw new Error('Target diseases should include Rabies');
        }
        if (vac.batchLotNumber !== 'LOT-99881') throw new Error('Batch lot number mismatch');
        if (vac.verificationStatus !== 'VERIFIED') throw new Error('Vaccination should be VERIFIED');
      }
    );

    // --- TEST 5: OVERDUE VACCINATION DETECTION IN SUMMARY ---
    await execTest(
      'HLT-005',
      'Health Summary Alert: Detects expired vaccine and raises overdue booster alert',
      'SUMMARY',
      () => {
        // Record an already-expired vaccine
        HealthService.recordVaccination(ownerUserId, {
          petId,
          vaccineCode: 'CANINE_BORDETELLA',
          administeredAt: '2023-01-01',
          validUntil: '2024-01-01', // Expired
          dose: '0.5 mL',
          batchLotNumber: 'BOR-OLD-1'
        });

        const summary = HealthService.assembleHealthSummary(ownerUserId, petId);
        const overdueAlert = summary.careAlerts.find(a => a.source === 'Vaccinations');
        if (!overdueAlert) {
          throw new Error('Expected an overdue vaccination alert in careAlerts.');
        }
      }
    );

    // --- TEST 6: MEDICATION LIFECYCLE (START, DOSAGE, DISCONTINUATION) ---
    let medId: MedicationId;
    await execTest(
      'HLT-006',
      'Medication Lifecycle: Active status, dosage instructions, and reasoned discontinuation',
      'MEDICATIONS',
      () => {
        const med = HealthService.recordMedication(ownerUserId, {
          petId,
          medicationName: 'Prednisolone 5mg',
          medicationType: 'PRESCRIPTION',
          dosage: '5',
          dosageUnit: 'mg',
          route: 'ORAL',
          frequency: 'Once Daily in Morning',
          startAt: '2024-06-01',
          instructions: 'Administer with food. Do not stop abruptly.'
        });

        medId = med.medicationId;
        if (med.status !== 'ACTIVE') throw new Error('Medication should be ACTIVE upon creation');

        const stopped = HealthService.stopMedication(
          ownerUserId,
          petId,
          med.medicationId,
          'Tapering schedule completed. Pruritus resolved.'
        );

        if (stopped.status !== 'DISCONTINUED') throw new Error('Medication should be DISCONTINUED');
        if (!stopped.discontinuedReason) throw new Error('Discontinued reason missing');
      }
    );

    // --- TEST 7: DIAGNOSTIC RESULTS WITH STRUCTURED MARKERS ---
    await execTest(
      'HLT-007',
      'Diagnostic Results: Structured panel with reference ranges and abnormal flags',
      'SUMMARY',
      () => {
        const diag = HealthService.recordDiagnostic(ownerUserId, {
          petId,
          testType: 'HEMATOLOGY_CBC',
          testName: 'Complete Blood Count',
          collectedAt: '2024-05-10T11:30:00Z',
          resultSummary: 'Normocytic, normochromic RBCs. Mild eosinophilia.',
          isDocumentOnly: false,
          structuredResults: [
            { marker: 'RBC', value: 6.8, unit: 'M/uL', referenceRange: '5.5 - 8.5', abnormalFlag: false },
            { marker: 'Eosinophils', value: 1.6, unit: 'K/uL', referenceRange: '0.1 - 1.2', abnormalFlag: true }
          ]
        });

        if (!diag.structuredResults || diag.structuredResults.length !== 2) {
          throw new Error('Structured results count mismatch');
        }
        const eosinophils = diag.structuredResults.find(r => r.marker === 'Eosinophils');
        if (!eosinophils?.abnormalFlag) {
          throw new Error('Eosinophils should be flagged as abnormal');
        }
      }
    );

    // --- TEST 8: PROCEDURES & SURGICAL RECORDS ---
    await execTest(
      'HLT-008',
      'Medical Procedures: Surgical and diagnostic interventions recorded with clinical indications',
      'SUMMARY',
      () => {
        const proc = HealthService.recordProcedure(ownerUserId, {
          petId,
          procedureType: 'NEUTER_SPAY',
          procedureName: 'Elective Pre-scrotal Orchiectomy (Neuter)',
          performedAt: '2023-10-15',
          clinicName: 'Nairobi Animal Clinic',
          providerName: 'Dr. Kimani',
          reasonIndication: 'Elective sterilization and prevention of testicular neoplasia',
          outcome: 'Surgery uneventful. Recovery smooth. Subcuticular absorbable sutures placed.'
        });

        if (proc.procedureType !== 'NEUTER_SPAY') throw new Error('Procedure type mismatch');
        if (proc.status !== 'COMPLETED') throw new Error('Procedure status should be COMPLETED');
      }
    );

    // --- TEST 9: IMMUTABILITY & ENTERED_IN_ERROR AMENDMENT AUDIT ---
    await execTest(
      'HLT-009',
      'Append-Only Immutability: Records marked ENTERED_IN_ERROR preserve snapshot and reason',
      'IMMUTABILITY',
      () => {
        // Create an errant condition
        const errantCondition = HealthService.recordCondition(ownerUserId, {
          petId,
          isDiagnosis: false,
          conditionName: 'Accidental duplicate entry',
          category: 'OTHER'
        });

        const amendment = HealthService.markRecordEnteredInError(ownerUserId, {
          petId,
          recordType: 'CONDITION',
          recordId: errantCondition.conditionId,
          reason: 'Duplicate entry entered accidentally by caregiver.'
        });

        if (amendment.actionType !== 'ENTERED_IN_ERROR') throw new Error('Amendment action type mismatch');
        if (!amendment.originalSnapshot) throw new Error('Original snapshot not preserved in amendment audit');

        const reloaded = HealthStore.findConditionById(errantCondition.conditionId);
        if (reloaded?.status !== 'ENTERED_IN_ERROR') {
          throw new Error('Condition status was not updated to ENTERED_IN_ERROR');
        }

        // Active list should not return entered in error records by default
        const activeConditions = HealthStore.listConditionsForPet(petId, false);
        if (activeConditions.some(c => c.conditionId === errantCondition.conditionId)) {
          throw new Error('Entered in error record was returned in active query');
        }
      }
    );

    // --- TEST 10: TIMELINE PROJECTION IDEMPOTENCY ---
    await execTest(
      'HLT-010',
      'Timeline Integration: Health events idempotently project into Unified Pet Timeline',
      'TIMELINE',
      () => {
        const timelineResult = TimelineService.listPetTimeline(ownerUserId, petId);
        const healthEvents = timelineResult.events.filter(e => e.sourceDomain === 'VETERINARY_HEALTH');

        if (healthEvents.length === 0) {
          throw new Error('No timeline events projected from health domain.');
        }

        // Check deduplication key format
        for (const ev of healthEvents) {
          if (!ev.deduplicationKey.startsWith('VETERINARY_HEALTH:')) {
            throw new Error(`Invalid deduplication key format: ${ev.deduplicationKey}`);
          }
        }
      }
    );

    // --- TEST 11: MULTI-TENANT CROSS-HOUSEHOLD AUTHORIZATION ---
    await execTest(
      'HLT-011',
      'Cross-Household Isolation: Unauthorized outsider blocked from reading or writing health records',
      'AUTHORIZATION',
      () => {
        let blocked = false;
        try {
          HealthService.assembleHealthSummary(outsiderUserId, petId);
        } catch {
          blocked = true;
        }

        if (!blocked) {
          throw new Error('Outsider was not blocked from reading pet health summary!');
        }

        let writeBlocked = false;
        try {
          HealthService.recordCondition(outsiderUserId, {
            petId,
            isDiagnosis: false,
            conditionName: 'Malicious observation',
            category: 'OTHER'
          });
        } catch {
          writeBlocked = true;
        }

        if (!writeBlocked) {
          throw new Error('Outsider was not blocked from writing health records!');
        }
      }
    );

    // --- TEST 12: TEMPORARY CAREGIVER MINIMUM NECESSARY PRIVILEGE ---
    await execTest(
      'HLT-012',
      'Role-Based Scope: Temporary caregiver can view emergency summary but cannot add diagnoses',
      'AUTHORIZATION',
      () => {
        // Temporary caregiver has pet.health.read_summary
        const summary = HealthService.assembleHealthSummary(tempCaregiverId, petId);
        if (!summary) {
          throw new Error('Temporary caregiver could not read emergency health summary');
        }

        // But temporary caregiver lacks pet.health.manage_condition
        let writeBlocked = false;
        try {
          HealthService.recordCondition(tempCaregiverId, {
            petId,
            isDiagnosis: true,
            conditionName: 'Unauthorized clinical diagnosis',
            category: 'OTHER'
          });
        } catch {
          writeBlocked = true;
        }

        if (!writeBlocked) {
          throw new Error('Temporary caregiver should NOT be allowed to enter diagnoses!');
        }
      }
    );

    // --- TEST 13: COMPOSITE HEALTH SUMMARY VERIFICATION ---
    await execTest(
      'HLT-013',
      'Composite Health Summary Read Model: Correct counts, active medications, and care alerts',
      'SUMMARY',
      () => {
        const summary = HealthService.assembleHealthSummary(ownerUserId, petId);

        if (summary.activeConditionsCount === 0) throw new Error('Active conditions count should be > 0');
        if (summary.activeAllergiesCount === 0) throw new Error('Active allergies count should be > 0');
        if (summary.careAlerts.length === 0) throw new Error('Care alerts should contain critical allergy or vaccine warnings');
        if (!summary.hasAnyRecords) throw new Error('hasAnyRecords should be true');
      }
    );

    const durationMs = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
      results,
      total: results.length,
      passed,
      failed,
      durationMs
    };
  }
}
