/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace Canonical Seed Data
 * 
 * Populates:
 * - Nairobi West Veterinary Clinic staff roles (Dr. Kimani, Vet Tech Faith Mwende, Receptionist Grace Wanjiku)
 * - Clinical access grants for Kibo, Simba, and Luna
 * - Veterinary consent agreements
 * - Active outpatient work queue with triage priorities
 * - Clinical encounters in various states (checked-in, in-consultation, finalized & signed)
 * - Prescriptions, diagnostic orders, care plans
 * - Pre-configured correction request and specialist referral
 */

import {
  asUserId,
  asHouseholdId,
  asPetId,
  asBusinessId,
  asProviderId,
  asEncounterId,
  asClinicalAccessGrantId,
  asVeterinaryConsentId,
  asPrescriptionId,
  asDiagnosticOrderId,
  asCarePlanId,
  asClinicalSignatureId,
  asWorkQueueItemId,
  asVeterinaryReferralId,
  asClinicalRecordCorrectionRequestId,
  asBusinessMembershipId,
} from '../kernel/ids';
import { VetWorkspaceStore } from './store';
import { ProviderStore } from '../provider/store';
import { PetStore } from '../pet-core/store';
import { CANONICAL_IDS } from '../kernel/canonical-ids';

export function seedVetWorkspace(): void {
  const store = VetWorkspaceStore.getInstance();
  const providerStore = ProviderStore.getInstance();

  const now = new Date();
  const todayIso = now.toISOString();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Canonical IDs
  const clinicId = asBusinessId('biz-nairobi-west-vet');
  const drKimaniUserId = asUserId('usr-01951500-0000-7000-8000-000000000101');
  const drKimaniProviderId = CANONICAL_IDS.VET_DR_KIMANI;

  // New staff users
  const techFaithUserId = asUserId('usr-vet-tech-faith-01');
  const techFaithProviderId = asProviderId('prv-vet-tech-faith-01');
  const receptionGraceUserId = asUserId('usr-vet-reception-grace-01');

  // Register Faith Mwende (Registered Veterinary Technician)
  providerStore.saveProvider({
    providerId: techFaithProviderId,
    userId: techFaithUserId,
    displayName: 'Faith Mwende, RVT',
    professionalTitle: 'Registered Veterinary Technician',
    category: 'VETERINARY_TECHNICIAN',
    bio: 'Experienced veterinary nurse specializing in feline low-stress handling, clinical triage, surgical prep, and anesthesia monitoring.',
    yearsOfExperience: 4,
    languages: ['English', 'Swahili'],
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    visibilityStatus: 'PUBLIC',
    primaryBusinessId: clinicId,
    metadata: {},
    createdAt: pastMonth,
    updatedAt: todayIso,
  });
  providerStore.saveBusinessMembership({
    membershipId: asBusinessMembershipId('bzm-faith-01'),
    businessId: clinicId,
    userId: techFaithUserId,
    providerId: techFaithProviderId,
    role: 'STAFF',
    isActive: true,
    canManageServices: false,
    canManageSchedule: true,
    joinedAt: pastMonth,
    updatedAt: todayIso,
  });

  // Register Grace Wanjiku (Clinic Reception & Patient Coordinator)
  providerStore.saveBusinessMembership({
    membershipId: asBusinessMembershipId('bzm-grace-01'),
    businessId: clinicId,
    userId: receptionGraceUserId,
    role: 'STAFF',
    isActive: true,
    canManageServices: false,
    canManageSchedule: true,
    joinedAt: pastMonth,
    updatedAt: todayIso,
  });

  // 1. Clinical Access Grants
  // Grant for Kibo (Elena Vance)
  const grantKiboId = asClinicalAccessGrantId('cag-kibo-nairobi-west-01');
  store.saveGrant({
    grantId: grantKiboId,
    clinicId,
    petId: CANONICAL_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    grantedByUserId: CANONICAL_IDS.OWNER_ELENA,
    relationshipType: 'PRIMARY_CARE',
    allowedScopes: ['FULL_CLINICAL_ACCESS'],
    status: 'ACTIVE',
    validFrom: pastMonth,
    validUntil: thirtyDaysLater,
    purposeDescription: 'Primary veterinary wellness care, vaccinations, and preventive health management.',
    createdAt: pastMonth,
    updatedAt: todayIso,
  });

  // Grant for Simba (Amina Hassan)
  const grantSimbaId = asClinicalAccessGrantId('cag-simba-nairobi-west-01');
  store.saveGrant({
    grantId: grantSimbaId,
    clinicId,
    petId: CANONICAL_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.BOOKING_HOUSEHOLD,
    grantedByUserId: CANONICAL_IDS.MEMBER_AMINA,
    relationshipType: 'PRIMARY_CARE',
    allowedScopes: ['FULL_CLINICAL_ACCESS'],
    status: 'ACTIVE',
    validFrom: pastMonth,
    validUntil: thirtyDaysLater,
    purposeDescription: 'Feline wellness evaluation, dental staging, and nutritional review.',
    createdAt: pastMonth,
    updatedAt: todayIso,
  });

  // Grant for Luna (David Kim)
  const grantLunaId = asClinicalAccessGrantId('cag-luna-nairobi-west-01');
  store.saveGrant({
    grantId: grantLunaId,
    clinicId,
    petId: CANONICAL_IDS.PET_LUNA,
    householdId: asHouseholdId('hh-kim-household-01'),
    grantedByUserId: asUserId('usr-david-kim-01'),
    relationshipType: 'PRIMARY_CARE',
    allowedScopes: ['FULL_CLINICAL_ACCESS'],
    status: 'ACTIVE',
    validFrom: pastWeek,
    validUntil: thirtyDaysLater,
    purposeDescription: 'Orthopedic gait analysis and stifle joint evaluation post-exercise.',
    createdAt: pastWeek,
    updatedAt: todayIso,
  });

  // 2. Veterinary Consents
  const consentKiboId = asVeterinaryConsentId('vct-kibo-general-01');
  store.saveConsent({
    consentId: consentKiboId,
    petId: CANONICAL_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    clinicId,
    consentType: 'GENERAL_TREATMENT',
    status: 'ACTIVE',
    consentingUserId: CANONICAL_IDS.OWNER_ELENA,
    consentingPartyName: 'Elena Vance',
    consentingPartyRelationship: 'OWNER',
    risksDisclosed: ['Minor injection site soreness', 'Temporary lethargy post-vaccination'],
    clinicalScopeNotes: 'General wellness check, vital sign acquisition, preventative parasite management.',
    signedAt: pastMonth,
    ipAddressMasked: '102.217.144.***',
  });

  // 3. Work Queue Items
  const queueItem1 = asWorkQueueItemId('wqi-kibo-today');
  store.saveQueueItem({
    queueItemId: queueItem1,
    clinicId,
    petId: CANONICAL_IDS.PET_KIBO,
    petName: 'Kibo',
    species: 'DOG',
    breed: 'Rhodesian Ridgeback',
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    ownerName: 'Elena Vance',
    ownerPhone: '+254 712 345678',
    assignedVeterinarianId: drKimaniProviderId,
    assignedVeterinarianName: 'Dr. Amani Kimani, BVSc',
    assignedTechnicianId: techFaithUserId,
    assignedTechnicianName: 'Faith Mwende, RVT',
    status: 'IN_CONSULTATION',
    triageLevel: 'ROUTINE',
    checkInTime: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    chiefComplaint: 'Annual physical examination, DHPP booster, and subtle left ear scratching.',
    roomNumber: 'Exam Room 2',
    updatedAt: todayIso,
  });

  const queueItem2 = asWorkQueueItemId('wqi-simba-today');
  store.saveQueueItem({
    queueItemId: queueItem2,
    clinicId,
    petId: CANONICAL_IDS.PET_SIMBA,
    petName: 'Simba',
    species: 'CAT',
    breed: 'Domestic Shorthair',
    householdId: CANONICAL_IDS.BOOKING_HOUSEHOLD,
    ownerName: 'Amina Hassan',
    ownerPhone: '+254 723 456789',
    assignedVeterinarianId: drKimaniProviderId,
    assignedVeterinarianName: 'Dr. Amani Kimani, BVSc',
    status: 'CHECKED_IN',
    triageLevel: 'URGENT',
    checkInTime: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    chiefComplaint: 'Vomiting hairballs with mild lethargy over the past 24 hours.',
    roomNumber: 'Waiting Area - Feline Quiet Bay',
    updatedAt: todayIso,
  });

  // 4. In-Flight Clinical Encounter for Kibo
  const encounterId = asEncounterId('enc-kibo-sprint19-01');
  const prescriptionId = asPrescriptionId('rx-kibo-easotic-01');
  const diagnosticOrderId = asDiagnosticOrderId('dxo-kibo-ear-cytology-01');
  const carePlanId = asCarePlanId('cpl-kibo-ear-recovery-01');

  // Diagnostic Order
  store.saveDiagnosticOrder({
    orderId: diagnosticOrderId,
    encounterId,
    petId: CANONICAL_IDS.PET_KIBO,
    clinicId,
    orderedByProviderId: drKimaniProviderId,
    orderedByName: 'Dr. Amani Kimani, BVSc',
    testType: 'CYTOLOGY',
    testName: 'Bilateral Ear Swab Cytology',
    specimenSource: 'Left and Right External Auditory Canal',
    clinicalIndication: 'Erythematous left pinna, mild ceruminous discharge, head shaking.',
    status: 'ORDERED',
    orderedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
  });

  // Prescription
  store.savePrescription({
    prescriptionId,
    encounterId,
    petId: CANONICAL_IDS.PET_KIBO,
    clinicId,
    prescribingProviderId: drKimaniProviderId,
    prescribingVeterinarianName: 'Dr. Amani Kimani, BVSc',
    veterinarianLicenseNumber: 'KVB-2024-0982',
    medicationName: 'EasOtic Otic Suspension',
    genericName: 'Hydrocortisone aceponate / Miconazole nitrate / Gentamicin sulfate',
    form: 'DROPS',
    strength: '1.11mg/15.1mg/1.5mg per ml',
    dosageQuantity: 1,
    dosageUnit: 'dose (1 ml)',
    route: 'TOPICAL',
    frequency: 'Once Daily for 5 consecutive days',
    durationDays: 5,
    refillsAllowed: 0,
    refillsRemaining: 0,
    instructions: 'Administer one pump into the left external ear canal once daily for 5 days. Massage ear base gently after application.',
    warningLabels: ['Do not administer if tympanic membrane is ruptured', 'Veterinary use only', 'Store below 25°C'],
    safetyCheckPassed: true,
    safetyCheckNotes: 'No recorded patient allergies. Tympanic membrane visualized intact prior to prescribing.',
    status: 'ACTIVE',
    prescribedAt: todayIso,
    expiresAt: new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString(),
  });

  // Care Plan
  store.saveCarePlan({
    carePlanId,
    encounterId,
    petId: CANONICAL_IDS.PET_KIBO,
    clinicId,
    authorProviderId: drKimaniProviderId,
    authorName: 'Dr. Amani Kimani, BVSc',
    title: 'Otitis Externa Management & Activity Guidance',
    diagnosisSummary: 'Mild Unilateral Otitis Externa (Left Ear), Otherwise Healthy',
    ownerInstructions: 'Keep ears clean and dry. Avoid swimming or bathing during treatment. Complete the full 5-day course of topical drops even if scratching ceases early.',
    dietaryGuidance: 'Continue standard balanced adult canine diet; no dietary changes indicated.',
    activityRestrictions: 'NORMAL_ACTIVITY',
    activityRestrictionDays: 0,
    woundCareInstructions: 'Wipe excess exudate from outer pinna with clean damp gauze before daily medication application.',
    warningSignsEmergency: [
      'Development of head tilt or loss of balance (vestibular signs)',
      'Severe pain upon touching ear or persistent whining',
      'Purulent or foul-smelling discharge increasing in volume',
    ],
    recheckRequired: true,
    recheckDate: new Date(now.getTime() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    createdAt: todayIso,
    updatedAt: todayIso,
  });

  // Encounter Session
  store.saveEncounterSession({
    encounterId,
    clinicId,
    petId: CANONICAL_IDS.PET_KIBO,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    queueItemId: queueItem1,
    status: 'IN_PROGRESS',
    encounterType: 'ROUTINE_CHECKUP',
    primaryVeterinarianId: drKimaniProviderId,
    primaryVeterinarianName: 'Dr. Amani Kimani, BVSc',
    attendingTechnicianId: techFaithUserId,
    attendingTechnicianName: 'Faith Mwende, RVT',
    presentingComplaint: 'Owner notes mild head shaking and left ear scratching since yesterday.',
    ownerReportedHistory: 'No prior history of chronic ear infections. Diet unchanged. Swam in garden pond two days ago.',
    ownerObservationsTag: 'OWNER_REPORTED',
    vitals: {
      weightKg: 34.8,
      temperatureCelsius: 38.6,
      heartRateBpm: 92,
      respiratoryRateBrpm: 24,
      bodyConditionScore: 5,
      mucousMembraneColor: 'PINK',
      capillaryRefillTimeSeconds: 1.5,
      painScore: 1,
      recordedByUserId: techFaithUserId,
      recordedByName: 'Faith Mwende, RVT',
      recordedByRole: 'VETERINARY_TECHNICIAN',
      recordedAt: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
      notes: 'Patient calm and cooperative. Ridgeback temperament relaxed.',
    },
    physicalExam: [
      { system: 'GENERAL_APPEARANCE', status: 'NORMAL', findings: 'Bright, alert, responsive, good body condition.' },
      { system: 'CARDIOVASCULAR', status: 'NORMAL', findings: 'Strong synchronous femoral pulses, no murmurs heard.' },
      { system: 'RESPIRATORY', status: 'NORMAL', findings: 'Clear lung sounds bilaterally, no crackles or wheezes.' },
      { system: 'OTIC', status: 'ABNORMAL', findings: 'Left pinna mildly erythematous; small amount of ceruminous discharge in vertical canal. Tympanic membrane intact bilaterally. Right ear clean.' },
      { system: 'ORAL_DENTAL', status: 'NORMAL', findings: 'Grade 1 mild dental tartar on upper carnassials, gums healthy.' },
      { system: 'MUSCULOSKELETAL', status: 'NORMAL', findings: 'Good muscle symmetry, no joint effusion or lameness noted.' },
    ],
    diagnoses: [
      {
        conditionName: 'Otitis Externa (Left Ear, Acute Unilateral)',
        conditionCode: 'VEN-OT-001',
        category: 'OTHER',
        likelihood: 'CONFIRMED',
        rationale: 'Erythema and ceruminous discharge isolated to left canal. Cytology underway to rule out yeast vs bacterial overgrowth.',
        isPrimary: true,
        chronic: false,
      },
    ],
    clinicalSummaryAssessment: 'Acute mild left-sided otitis externa likely secondary to moisture retention following swimming. Tympanum intact. Favorable prognosis with targeted topical therapy.',
    prescriptions: [prescriptionId],
    diagnosticOrders: [diagnosticOrderId],
    proceduresPerformed: [],
    carePlan: carePlanId,
    isSigned: false,
    generatedDocumentIds: [],
    startedAt: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
    createdAt: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
    updatedAt: todayIso,
  });

  // 5. Historic Finalized and Signed Encounter (Simba past checkup)
  const pastEncounterId = asEncounterId('enc-simba-historic-01');
  const pastSignatureId = asClinicalSignatureId('sig-simba-historic-01');
  store.saveSignature({
    signatureId: pastSignatureId,
    recordType: 'ENCOUNTER',
    recordId: pastEncounterId,
    signerUserId: drKimaniUserId,
    signerProviderId: drKimaniProviderId,
    signerName: 'Dr. Amani Kimani, BVSc',
    licenseNumber: 'KVB-2024-0982',
    signingRole: 'LICENSED_VETERINARIAN',
    cryptographicDigest: 'sha256-simba-historical-record-sealing-0982',
    signedAt: pastMonth,
    statementOfResponsibility: 'I confirm that I am a licensed veterinary professional. I have personally evaluated this animal, verified these clinical findings, and authorized all included medications and care plans.',
  });

  store.saveEncounterSession({
    encounterId: pastEncounterId,
    clinicId,
    petId: CANONICAL_IDS.PET_SIMBA,
    householdId: CANONICAL_IDS.BOOKING_HOUSEHOLD,
    status: 'SIGNED',
    encounterType: 'ROUTINE_CHECKUP',
    primaryVeterinarianId: drKimaniProviderId,
    primaryVeterinarianName: 'Dr. Amani Kimani, BVSc',
    presentingComplaint: 'Routine feline wellness and vaccination booster.',
    ownerReportedHistory: 'Indoor feline. Occasional grass ingestion on balcony.',
    ownerObservationsTag: 'OWNER_REPORTED',
    vitals: {
      weightKg: 4.6,
      temperatureCelsius: 38.3,
      heartRateBpm: 180,
      respiratoryRateBrpm: 32,
      bodyConditionScore: 5,
      mucousMembraneColor: 'PINK',
      capillaryRefillTimeSeconds: 1.0,
      recordedByUserId: drKimaniUserId,
      recordedByName: 'Dr. Amani Kimani, BVSc',
      recordedByRole: 'VETERINARIAN',
      recordedAt: pastMonth,
    },
    physicalExam: [
      { system: 'GENERAL_APPEARANCE', status: 'NORMAL', findings: 'Coat glossy, hydration status normal.' },
      { system: 'CARDIOVASCULAR', status: 'NORMAL', findings: 'Regular rhythm, no gallop sounds.' },
      { system: 'ORAL_DENTAL', status: 'NORMAL', findings: 'Clean teeth, no gingival inflammation.' },
    ],
    diagnoses: [
      {
        conditionName: 'Healthy Feline Wellness Exam',
        category: 'OTHER',
        likelihood: 'CONFIRMED',
        isPrimary: true,
        chronic: false,
      },
    ],
    prescriptions: [],
    diagnosticOrders: [],
    proceduresPerformed: [],
    isSigned: true,
    signedAt: pastMonth,
    signatureId: pastSignatureId,
    generatedDocumentIds: [],
    startedAt: pastMonth,
    completedAt: pastMonth,
    createdAt: pastMonth,
    updatedAt: pastMonth,
  });

  // 6. Correction Request Sample
  const correctionRequestId = asClinicalRecordCorrectionRequestId('cor-luna-ortho-01');
  store.saveCorrectionRequest({
    requestId: correctionRequestId,
    petId: CANONICAL_IDS.PET_LUNA,
    householdId: asHouseholdId('hh-kim-household-01'),
    requestedByUserId: asUserId('usr-david-kim-01'),
    requestedByName: 'David Kim',
    targetRecordType: 'CONDITION',
    targetRecordId: 'cnd-luna-hip-01',
    correctionReason: 'The onset date was recorded as January 2024, but Luna first showed stiffness after agility trials in November 2023.',
    status: 'SUBMITTED',
    createdAt: pastWeek,
    updatedAt: pastWeek,
  });

  // 7. Veterinary Referral Sample
  const specialistClinicId = asBusinessId('biz-nairobi-animal-specialists');
  // Register Destination Referral Hospital
  providerStore.saveBusiness({
    businessId: specialistClinicId,
    legalName: 'Nairobi Veterinary Specialist & Imaging Referral Hospital Ltd',
    tradingName: 'Nairobi Animal Referral Specialists',
    businessType: 'VETERINARY_CLINIC',
    registrationNumber: 'CPR/2020/99812',
    ownerUserId: CANONICAL_IDS.ADMIN_CHARLES,
    verificationStatus: 'VERIFIED',
    isActive: true,
    contactEmail: 'referrals@nairobiequinesmall.ke',
    contactPhone: '+254 700 889900',
    createdAt: pastMonth,
    updatedAt: todayIso,
  });

  const referralId = asVeterinaryReferralId('ref-luna-ortho-specialist-01');
  store.saveReferral({
    referralId,
    sourceClinicId: clinicId,
    sourceClinicName: 'Nairobi West Veterinary Clinic',
    destinationClinicId: specialistClinicId,
    destinationClinicName: 'Nairobi Animal Referral Specialists',
    petId: CANONICAL_IDS.PET_LUNA,
    petName: 'Luna',
    householdId: asHouseholdId('hh-kim-household-01'),
    referringVeterinarianId: drKimaniProviderId,
    referringVeterinarianName: 'Dr. Amani Kimani, BVSc',
    specialtyRequested: 'Orthopedic Surgery & CT Stifle Evaluation',
    clinicalSummary: 'Recurrent grade II left hindlimb lameness. Suspected cranial cruciate ligament partial tear.',
    urgency: 'URGENT',
    sharedRecordIds: ['cag-luna-nairobi-west-01', 'dx-luna-radiographs-01'],
    ownerConsentConfirmed: true,
    status: 'PENDING',
    referredAt: pastWeek,
  });
}
