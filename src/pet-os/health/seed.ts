/**
 * Pet OS Sprint 5 - Veterinary Health Canonical Seed Data
 * Implements Volume VII (Veterinary Health & Medical Records) & Volume XXVIII
 * Pre-populates realistic clinical records demonstrating:
 * - Clear distinction between Owner Observations vs Professional Diagnoses
 * - Clinical Provenance tracking (Veterinarian vs Owner)
 * - Chronic conditions, active allergies, and severity ratings
 * - Completed encounters with Kenyan veterinary clinics
 * - Core and lifestyle vaccinations (valid and expired to demonstrate care alerts)
 * - Current and discontinued medications with precise dosages
 * - Structured diagnostic laboratory results (CBC, Biochemistry)
 * - Surgical and diagnostic procedures
 * - Author-attributed clinical notes
 */

import { PetId, UserId, asPetId, asUserId } from '../kernel/ids';
import { HealthService } from './service';
import { HealthStore } from './store';
import { PetStore } from '../pet-core/store';

export async function seedSprint5HealthData(ownerUserId: UserId, petId: PetId): Promise<void> {
  // Check if records already exist for this pet
  if (HealthStore.countRecordsForPet(petId) > 0) {
    return;
  }

  const pet = PetStore.findPetById(petId);
  if (!pet) return;

  const now = new Date();
  const pastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Professional Diagnosis (Veterinarian Verified)
  HealthService.recordCondition(ownerUserId, {
    petId,
    isDiagnosis: true,
    conditionCode: 'SNOMED-400130008',
    conditionName: 'Atopic Dermatitis (Canine Environmental Allergy)',
    category: 'DERMATOLOGY',
    description: 'Chronic allergic pruritus affecting ventral abdomen and paws. Seasonal flare-ups during dry dust seasons.',
    onsetDate: pastYear,
    diagnosedAt: pastYear,
    severity: 'MODERATE',
    chronic: true,
    provenance: 'VETERINARY_PROFESSIONAL',
    externalProviderName: 'Dr. Kiprono Mutai (KVB #VET-7821)',
    notes: 'Prescribed daily Apoquel and medicated chlorhexidine baths bi-weekly.'
  });

  // 2. Owner Observation (UNVERIFIED - Never mistaken for a diagnosis)
  HealthService.recordCondition(ownerUserId, {
    petId,
    isDiagnosis: false,
    conditionName: 'Intermittent Limping on Right Hind Leg',
    category: 'ORTHOPEDIC',
    description: 'Owner noticed favoring of right hind leg after intense frisbee play at Karura Forest.',
    onsetDate: twoWeeksAgo,
    severity: 'MILD',
    chronic: false,
    provenance: 'OWNER_ENTERED',
    notes: 'Resting recommended for 5 days. Monitor if swelling or heat appears.'
  });

  // 3. Allergies
  HealthService.recordAllergy(ownerUserId, {
    petId,
    allergen: 'Chicken Protein & Poultry By-Products',
    allergenCategory: 'FOOD',
    allergyType: 'ALLERGY',
    reaction: 'Severe pruritus, intense paw-licking, erythematous skin lesions',
    severity: 'SEVERE',
    firstObservedAt: pastYear,
    provenance: 'VETERINARY_PROFESSIONAL',
    clinicalNotes: 'Confirmed via elimination diet trial. Pet shifted to hydrolyzed salmon diet.'
  });

  HealthService.recordAllergy(ownerUserId, {
    petId,
    allergen: 'Kikuyu Grass Pollen',
    allergenCategory: 'ENVIRONMENTAL',
    allergyType: 'INTOLERANCE',
    reaction: 'Mild seasonal ocular discharge and sneezing',
    severity: 'MILD',
    firstObservedAt: sixMonthsAgo,
    provenance: 'OWNER_ENTERED',
    clinicalNotes: 'Wipe paws and muzzle with damp cloth after outdoor walks.'
  });

  // 4. Veterinary Encounter
  const encounter = HealthService.recordEncounter(ownerUserId, {
    petId,
    encounterType: 'ROUTINE_CHECKUP',
    occurredAt: sixMonthsAgo,
    reason: 'Annual Comprehensive Physical Examination & Booster Vaccination',
    chiefComplaint: 'Healthy presentation; routine booster immunization and dental inspection',
    outcome: 'Overall robust health. Grade 1 tartar on upper molars. Weight stable at 32.4 kg. Skin quiescent under Apoquel.',
    followUpRequired: true,
    followUpDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    externalClinicName: 'Nairobi Veterinary Hospital, Karen Centre',
    externalProviderName: 'Dr. Kiprono Mutai, BVM',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // 5. Vaccinations (Core & Overdue demo)
  HealthService.recordVaccination(ownerUserId, {
    petId,
    vaccineCode: 'CANINE_RABIES',
    vaccineName: 'Rabies Virus Vaccine (Nobivac Rabies)',
    administeredAt: sixMonthsAgo.slice(0, 10),
    validFrom: sixMonthsAgo.slice(0, 10),
    validUntil: new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    nextDueAt: new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dose: '1.0 mL SubQ',
    batchLotNumber: 'KVB-RB-9981',
    manufacturer: 'MSD Animal Health',
    externalClinicName: 'Nairobi Veterinary Hospital',
    externalProviderName: 'Dr. Kiprono Mutai (KVB #7821)',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  HealthService.recordVaccination(ownerUserId, {
    petId,
    vaccineCode: 'CANINE_DHPP',
    vaccineName: 'DHPP 5-in-1 Vanguard Plus 5 (Distemper/Parvo)',
    administeredAt: sixMonthsAgo.slice(0, 10),
    validFrom: sixMonthsAgo.slice(0, 10),
    validUntil: new Date(now.getTime() + 185 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    nextDueAt: new Date(now.getTime() + 185 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dose: '1.0 mL SubQ',
    batchLotNumber: 'DHPP-5524',
    manufacturer: 'Zoetis',
    externalClinicName: 'Nairobi Veterinary Hospital',
    externalProviderName: 'Dr. Kiprono Mutai',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // Expired vaccine to demonstrate care alert engine
  HealthService.recordVaccination(ownerUserId, {
    petId,
    vaccineCode: 'CANINE_BORDETELLA',
    vaccineName: 'Bordetella bronchiseptica (Kennel Cough Intranasal)',
    administeredAt: pastYear.slice(0, 10),
    validFrom: pastYear.slice(0, 10),
    validUntil: twoWeeksAgo.slice(0, 10), // Expired!
    nextDueAt: twoWeeksAgo.slice(0, 10),
    dose: '0.5 mL Intranasal',
    batchLotNumber: 'BOR-2201',
    manufacturer: 'Boehringer Ingelheim',
    externalClinicName: 'Nairobi West Vet Centre',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // 6. Current Medications
  HealthService.recordMedication(ownerUserId, {
    petId,
    medicationName: 'Apoquel (Oclacitinib Maleate)',
    genericName: 'Oclacitinib',
    medicationType: 'PRESCRIPTION',
    dosage: '16',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'Once Daily (Every 24h)',
    startAt: threeMonthsAgo.slice(0, 10),
    instructions: 'Administer 1 tablet in the morning with or without food. Do not skip doses.',
    reason: 'Management of pruritus associated with allergic dermatitis',
    prescribingProvider: 'Dr. Kiprono Mutai',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // Discontinued medication
  const oldMed = HealthService.recordMedication(ownerUserId, {
    petId,
    medicationName: 'Cephalexin 500mg Capsules',
    genericName: 'Cephalexin Monohydrate',
    medicationType: 'PRESCRIPTION',
    dosage: '500',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'Twice Daily (Every 12h)',
    startAt: pastYear.slice(0, 10),
    instructions: 'Complete full 14-day antibiotic course.',
    reason: 'Secondary superficial pyoderma treatment',
    prescribingProvider: 'Dr. Kiprono Mutai',
    provenance: 'VETERINARY_PROFESSIONAL'
  });
  HealthService.stopMedication(ownerUserId, petId, oldMed.medicationId, 'Full 14-day course successfully completed. Lesions resolved.');

  // 7. Medical Procedures
  HealthService.recordProcedure(ownerUserId, {
    petId,
    procedureType: 'DENTAL_CLEANING',
    procedureName: 'Ultrasonic Dental Scaling & Fluoride Polishing',
    performedAt: pastYear.slice(0, 10),
    providerName: 'Dr. Kiprono Mutai',
    clinicName: 'Nairobi Veterinary Hospital',
    reasonIndication: 'Calculus accumulation on upper carnassial teeth',
    outcome: 'Full plaque removal, no extractions required, gum margins healthy',
    followUpNotes: 'Annual dental check advised.',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // 8. Diagnostic Laboratory Results
  HealthService.recordDiagnostic(ownerUserId, {
    petId,
    encounterId: encounter.encounterId,
    testType: 'HEMATOLOGY_CBC',
    testName: 'Complete Blood Count (CBC) Differential Panel',
    collectedAt: sixMonthsAgo,
    resultedAt: sixMonthsAgo,
    resultSummary: 'Normocytic, normochromic RBCs. Mild eosinophilia consistent with known allergic dermatitis. Platelets adequate.',
    isDocumentOnly: false,
    laboratoryName: 'Central Veterinary Diagnostic Laboratories, Nairobi',
    structuredResults: [
      { marker: 'RBC (Red Blood Cells)', value: 7.2, unit: 'M/uL', referenceRange: '5.5 - 8.5', abnormalFlag: false },
      { marker: 'Hemoglobin', value: 16.4, unit: 'g/dL', referenceRange: '12.0 - 18.0', abnormalFlag: false },
      { marker: 'Hematocrit (HCT)', value: 48.2, unit: '%', referenceRange: '37.0 - 55.0', abnormalFlag: false },
      { marker: 'WBC (White Blood Cells)', value: 11.8, unit: 'K/uL', referenceRange: '6.0 - 17.0', abnormalFlag: false },
      { marker: 'Eosinophils', value: 1.4, unit: 'K/uL', referenceRange: '0.1 - 1.2', abnormalFlag: true },
      { marker: 'Platelets', value: 290, unit: 'K/uL', referenceRange: '200 - 500', abnormalFlag: false }
    ],
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  // 9. Clinical Notes
  HealthService.recordClinicalNote(ownerUserId, {
    petId,
    encounterId: encounter.encounterId,
    noteType: 'VETERINARY_NOTE',
    authorName: 'Dr. Kiprono Mutai, BVM',
    authorRole: 'Lead Veterinary Surgeon',
    isConfidentialProfessionalNote: false,
    content:
      'Patient Simba presented in excellent body condition (BCS 5/9). Dermatologic exam shows quiescent skin with mild erythema at interdigital spaces. Heart and lungs auscultate clear with normal sinus rhythm. Continued maintenance on Apoquel recommended.',
    provenance: 'VETERINARY_PROFESSIONAL'
  });

  HealthService.recordClinicalNote(ownerUserId, {
    petId,
    noteType: 'OWNER_NOTE',
    authorName: 'Alice Wambui',
    authorRole: 'Household Primary Owner',
    isConfidentialProfessionalNote: false,
    content:
      'Noticed slight ear itching after rainy weekend walks. Cleaned with prescribed cleanser on Sunday evening. Symptoms improved by Tuesday.',
    provenance: 'OWNER_ENTERED'
  });
}
