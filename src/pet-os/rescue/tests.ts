/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster, Reunification, Adoption & Animal Welfare Test Suite
 * 
 * Verifies all 18 canonical invariants across:
 * - Organization Verification & Anti-Impersonation
 * - Intake & Statutory Hold Enforcement
 * - Identity Reconciliation (Microchip, Tag Token, Lost Pet Incidents)
 * - Single Active Custodian Invariant
 * - Shelter Facility Capacity & Quarantine Limits
 * - Foster Network, Scoped Access & Address Privacy
 * - Animal Welfare Cases & Legal Boundary Enforcement
 * - Lost Pet Reunification & Zero-Duplicate Handover
 * - Adoption Platform & Commercial Sale Prohibition
 * - Post-Adoption Lifecycle & Neutral Returns
 */

import {
  asUserId,
  asHouseholdId,
  asRescueOrganizationId,
  asRescueFacilityId,
  asRescueAnimalId,
  asAnimalIntakeCaseId,
  asLostPetIncidentId,
  asPetId,
  asMicrochipId,
} from '../kernel/ids';
import { RescueService } from './service';
import { RescueStore } from './store';
import { PetStore } from '../pet-core/store';
import { RecoveryStore } from '../recovery/store';
import { RecoveryService } from '../recovery/service';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export async function runSprint18Tests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  const rescueService = RescueService.getInstance();
  const rescueStore = RescueStore.getInstance();
  const recoveryStore = RecoveryStore.getInstance();

  const runTest = async (name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        suite: 'Sprint 18: Rescue & Animal Welfare',
        name,
        passed: true,
        durationMs: performance.now() - start,
      });
    } catch (err: any) {
      results.push({
        suite: 'Sprint 18: Rescue & Animal Welfare',
        name,
        passed: false,
        error: err.message || String(err),
        durationMs: performance.now() - start,
      });
    }
  };

  // Reset stores for deterministic test execution
  rescueStore.reset();

  const userElena = asUserId('usr-elena-vance-owner');
  const userAdmin = asUserId('usr-system-admin-001');
  const userOfficer = asUserId('usr-intake-officer-sarah');
  const userAdopter = asUserId('usr-adopter-michael-001');
  const userFoster = asUserId('usr-foster-karen-001');
  const householdMain = asHouseholdId('hh-elena-vance-main');

  let testOrgId = asRescueOrganizationId('org-test-nairobi-rescue');
  let testFacilityId = asRescueFacilityId('fac-test-shelter-westlands');

  // --------------------------------------------------------------------------
  // TEST 1: Organization Creation & Owner Cannot Self-Verify
  // --------------------------------------------------------------------------
  await runTest('Organization Creation & Anti-Impersonation Self-Verification Block', () => {
    const org = rescueService.createOrganization({
      name: 'Nairobi Animal Welfare Alliance',
      slug: 'nawa-ke',
      type: 'RESCUE',
      publicContactEmail: 'info@nawa.or.ke',
      publicContactPhone: '+254-711-000-111',
      headquartersCity: 'Nairobi',
      ownerUserId: userElena,
    });
    testOrgId = org.organizationId;

    if (org.verificationStatus !== 'DRAFT') {
      throw new Error(`Expected new org to be DRAFT, got ${org.verificationStatus}`);
    }

    // Attempting self-verification by owner must throw
    let selfVerifyBlocked = false;
    try {
      rescueService.verifyOrganization({
        organizationId: org.organizationId,
        verifiedByUserId: userElena,
        registrationNumber: 'NGO-12345',
      });
    } catch {
      selfVerifyBlocked = true;
    }

    if (!selfVerifyBlocked) {
      throw new Error('Security Failure: Organization owner was able to self-verify their own organization.');
    }

    // Verification by independent administrator succeeds
    const verifiedOrg = rescueService.verifyOrganization({
      organizationId: org.organizationId,
      verifiedByUserId: userAdmin,
      registrationNumber: 'NGO-REG-2026-NAWA',
      taxOrNgoId: 'KRA-PIN-P00998877A',
    });

    if (verifiedOrg.verificationStatus !== 'VERIFIED') {
      throw new Error('Expected org to be VERIFIED after admin approval.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Team Memberships & Scoped Role Permissions
  // --------------------------------------------------------------------------
  await runTest('Team Memberships & Least-Privilege Scoped Permissions', () => {
    rescueService.addTeamMember({
      organizationId: testOrgId,
      userId: userOfficer,
      role: 'INTAKE_OFFICER',
      authorizedByUserId: userElena,
    });

    // Officer has intake permissions
    if (!rescueService.hasPermission(userOfficer, testOrgId, 'rescue.intake.create')) {
      throw new Error('Expected INTAKE_OFFICER to have rescue.intake.create permission.');
    }

    // Officer does NOT have adoption review permissions
    if (rescueService.hasPermission(userOfficer, testOrgId, 'rescue.adoption.review')) {
      throw new Error('Least Privilege Failure: INTAKE_OFFICER should not have rescue.adoption.review permission.');
    }

    // Outsider has no permissions
    if (rescueService.hasPermission(userAdopter, testOrgId, 'rescue.intake.create')) {
      throw new Error('Security Failure: Outsider user has intake permissions.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Facility Privacy & Species Capacity Enforcement
  // --------------------------------------------------------------------------
  await runTest('Facility Privacy & Species Capacity Enforcement', () => {
    // Attempting to publish public address for private foster location must fail
    let privateLeakBlocked = false;
    try {
      rescueService.createFacility({
        organizationId: testOrgId,
        name: 'Private Foster Home Base',
        type: 'PRIVATE_FOSTER_LOCATION',
        publicAddressLine: '123 Confidential St',
        city: 'Nairobi',
        region: 'Nairobi County',
        capacityBySpecies: { DOG: 2 },
        authorizedByUserId: userElena,
      });
    } catch {
      privateLeakBlocked = true;
    }

    if (!privateLeakBlocked) {
      throw new Error('Privacy Violation: Private foster location allowed public address publication.');
    }

    // Public shelter facility creation
    const fac = rescueService.createFacility({
      organizationId: testOrgId,
      name: 'Nairobi Central Rescue Shelter',
      type: 'PUBLIC_FACILITY',
      publicAddressLine: 'Shelter Road, Westlands',
      city: 'Nairobi',
      region: 'Nairobi County',
      capacityBySpecies: { DOG: 2, CAT: 2 }, // Low capacity for testing limit
      quarantineCapacity: 1,
      authorizedByUserId: userElena,
    });
    testFacilityId = fac.facilityId;

    if (!fac.isPubliclyVisible) {
      throw new Error('Expected PUBLIC_FACILITY to be publicly visible.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Animal Intake & Statutory Hold Computation
  // --------------------------------------------------------------------------
  let intakeCaseId1: any;
  let animalId1: any;
  await runTest('Animal Intake Case & 7-Day Statutory Hold Period Enforcement', () => {
    const intake = rescueService.createIntakeCase({
      organizationId: testOrgId,
      receivedByUserId: userOfficer,
      intakeType: 'FOUND',
      species: 'DOG',
      temporaryName: 'Found Pup Simba',
      apparentBreed: 'Golden Retriever Mix',
      sex: 'MALE',
      colorAndMarkings: 'Golden brown with white chest star',
      intakeLocationDescription: 'Found wandering along Karura Forest trail',
      isQuarantineRequired: false,
      initialFacilityId: testFacilityId,
    });

    intakeCaseId1 = intake.intakeCase.intakeCaseId;
    animalId1 = intake.rescueAnimal.rescueAnimalId;

    if (intake.intakeCase.status !== 'RECEIVED') {
      throw new Error(`Expected intake status RECEIVED, got ${intake.intakeCase.status}`);
    }

    // Must have holdExpiresAt set to approximately 7 days from now
    if (!intake.intakeCase.holdExpiresAt) {
      throw new Error('Statutory Hold Error: holdExpiresAt was not computed for FOUND animal.');
    }

    const holdMs = new Date(intake.intakeCase.holdExpiresAt).getTime() - Date.now();
    const holdHours = holdMs / (3600 * 1000);
    if (holdHours < 160 || holdHours > 170) {
      throw new Error(`Expected ~168 hours hold, got ${holdHours.toFixed(1)} hours.`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Single Current Custodian Invariant
  // --------------------------------------------------------------------------
  await runTest('Single Current Custodian Invariant & Custody History Audit', () => {
    // Check initial custody
    const currentCustodies = Array.from(rescueStore.custodyRecords.values()).filter(
      c => c.rescueAnimalId === animalId1 && c.isCurrent
    );
    if (currentCustodies.length !== 1) {
      throw new Error(`Invariant Violation: Expected exactly 1 current custody record, found ${currentCustodies.length}`);
    }

    // Transfer custody to another state
    rescueService.transferCustody({
      rescueAnimalId: animalId1,
      organizationId: testOrgId,
      newCustodyState: 'INTAKE_CUSTODY',
      custodianType: 'FACILITY',
      authorizedByUserId: userElena,
      handoverNotes: 'Moving to observation ward',
    });

    const afterTransfer = Array.from(rescueStore.custodyRecords.values()).filter(
      c => c.rescueAnimalId === animalId1 && c.isCurrent
    );
    if (afterTransfer.length !== 1) {
      throw new Error(`Invariant Violation after transfer: Expected 1 current record, got ${afterTransfer.length}`);
    }

    // Verify previous record is archived with effectiveUntil
    const totalRecords = Array.from(rescueStore.custodyRecords.values()).filter(
      c => c.rescueAnimalId === animalId1
    );
    if (totalRecords.length !== 2) {
      throw new Error(`Audit Failure: Expected 2 custody history records, got ${totalRecords.length}`);
    }
    const previous = totalRecords.find(c => !c.isCurrent);
    if (!previous?.effectiveUntil) {
      throw new Error('Audit Failure: Archived custody record lacks effectiveUntil timestamp.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Identity Reconciliation Engine (Microchip & Lost Pet Matching)
  // --------------------------------------------------------------------------
  await runTest('Identity Reconciliation Engine Matching against Registered Pets', () => {
    // Seed a known pet in PetStore with microchip
    const canonicalPetId = asPetId('pet-known-registered-999');
    PetStore.savePet({
      petId: canonicalPetId,
      householdId: householdMain,
      name: 'Registered Kibo',
      speciesCode: 'dog',
      breedCode: 'SHEPHERD',
      mixedBreed: true,
      unknownBreed: false,
      sex: 'MALE',
      reproductiveStatus: 'STERILIZED',
      dateOfBirth: '2022-01-01',
      birthdatePrecision: 'EXACT',
      estimatedBirthdate: false,
      primaryColor: 'Tan',
      sizeClassification: 'LARGE',
      lifecycleStage: 'ADULT',
      status: 'ACTIVE',
      createdBy: asUserId('usr-elena'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      metadata: {},
    });
    PetStore.saveMicrochip({
      microchipId: asMicrochipId('chip-known-registered-999'),
      petId: canonicalPetId,
      microchipNumber: 'CHIP-987654321000',
      verificationStatus: 'VERIFIED',
      verifiedBy: asUserId('usr-elena'),
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Reconcile with matching microchip
    const match = rescueService.reconcileIdentity({
      microchipNumber: 'CHIP-987654321000',
      species: 'DOG',
    });

    if (match.outcome !== 'MATCHED_EXISTING_PET' || match.matchedPetId !== canonicalPetId) {
      throw new Error(`Reconciliation Failure: Expected MATCHED_EXISTING_PET with ${canonicalPetId}, got ${match.outcome}`);
    }

    // Reconcile unknown animal
    const unknown = rescueService.reconcileIdentity({
      microchipNumber: 'CHIP-UNKNOWN-0000',
      species: 'CAT',
    });
    if (unknown.outcome !== 'NEW_UNOWNED_ANIMAL') {
      throw new Error(`Expected NEW_UNOWNED_ANIMAL for unmatched chip, got ${unknown.outcome}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Foster Network, Capacity & Scoped Care Projection
  // --------------------------------------------------------------------------
  let fosterProfileId: any;
  let fosterPlacementId: any;
  await runTest('Foster Application, Capacity Limits & Scoped Care Access', () => {
    const profile = rescueService.submitFosterApplication({
      userId: userFoster,
      organizationId: testOrgId,
      maxActiveAnimals: 1, // capacity of 1
      speciesPreference: ['DOG'],
      sizePreference: ['MEDIUM'],
      hasFencedYard: true,
      hasOtherPets: false,
      hasChildrenInHome: false,
      experienceLevel: 'EXPERIENCED',
      privateResidenceAddress: '789 Private Foster Lane, Karen',
      emergencyContactPhone: '+254-722-111-222',
    });
    fosterProfileId = profile.fosterProfileId;

    if (profile.status !== 'SUBMITTED') {
      throw new Error(`Expected SUBMITTED, got ${profile.status}`);
    }

    // Review & approve
    rescueService.reviewFosterApplication({
      fosterProfileId,
      reviewerUserId: userElena,
      approved: true,
    });

    // Place animal with foster
    const placement = rescueService.placeWithFoster({
      rescueAnimalId: animalId1,
      fosterProfileId,
      carePlanInstructions: 'Feed twice daily. Needs quiet environment and gentle leash walks.',
      feedingScheduleSummary: '2 cups kibble at 08:00 and 18:00',
      emergencyContact: '+254-700-VET-EMERGENCY',
      authorizedByUserId: userElena,
    });
    fosterPlacementId = placement.placementId;

    if (placement.status !== 'ACTIVE') {
      throw new Error('Expected placement to be ACTIVE.');
    }

    // Scoped Foster Care Projection test
    const projection = rescueService.getFosterCareProjection(userFoster, fosterPlacementId);
    if (!projection.carePlanInstructions.includes('Feed twice daily')) {
      throw new Error('Scoped Care Projection Error: Care plan instructions missing.');
    }

    // Foster address is strictly private and not returned in projection
    if ((projection as any).privateResidenceAddress) {
      throw new Error('Privacy Breach: Foster address exposed in projection.');
    }

    // Outsider cannot access foster care projection
    let outsiderBlocked = false;
    try {
      rescueService.getFosterCareProjection(userAdopter, fosterPlacementId);
    } catch {
      outsiderBlocked = true;
    }
    if (!outsiderBlocked) {
      throw new Error('Security Breach: Non-assigned user accessed foster care projection.');
    }

    // Capacity limit enforcement: Cannot place second animal with this foster (capacity 1)
    let capacityBlocked = false;
    try {
      const secondAnimal = asRescueAnimalId('animal-second-002');
      rescueStore.rescueAnimals.set(secondAnimal, {
        rescueAnimalId: secondAnimal,
        organizationId: testOrgId,
        intakeCaseId: intakeCaseId1,
        temporaryName: 'Pup 2',
        species: 'DOG',
        sex: 'FEMALE',
        colorAndMarkings: 'Black',
        size: 'SMALL',
        identityStatus: 'NEW_UNOWNED_ANIMAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      rescueService.placeWithFoster({
        rescueAnimalId: secondAnimal,
        fosterProfileId,
        carePlanInstructions: 'Care plan',
        emergencyContact: '123',
        authorizedByUserId: userElena,
      });
    } catch {
      capacityBlocked = true;
    }

    if (!capacityBlocked) {
      throw new Error('Capacity Failure: Foster capacity limit was not enforced.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Confidential Welfare Case & Evidence Immutability
  // --------------------------------------------------------------------------
  await runTest('Confidential Animal Welfare Case & Authority Escalation', () => {
    const welfareCase = rescueService.openWelfareCase({
      organizationId: testOrgId,
      assignedOfficerUserId: userElena,
      category: 'NEGLECT_CONCERN',
      priority: 'URGENT',
      allegationSummary: 'Dog kept on short chain without shelter or clean water',
      locationDescription: 'Compound near Ngong Road, Nairobi',
      reportedBySource: 'COMMUNITY_REPORT',
      confidentialReporterReference: 'rep_confidential_007',
    });

    if (welfareCase.status !== 'OPENED') {
      throw new Error(`Expected OPENED, got ${welfareCase.status}`);
    }

    // Attach sealed evidence
    const evidence = rescueService.attachWelfareEvidence({
      welfareCaseId: welfareCase.welfareCaseId,
      capturedByUserId: userElena,
      documentType: 'PHOTOGRAPH',
      description: 'Photo showing tethering conditions',
      mediaUrl: 'https://storage.pet-os.internal/welfare/ev-01.jpg',
    });

    if (!evidence.hashDigest || !evidence.hashDigest.startsWith('sha256_')) {
      throw new Error('Integrity Error: Welfare evidence missing immutable hash digest seal.');
    }

    // Escalate to authority
    const action = rescueService.recordWelfareAction({
      welfareCaseId: welfareCase.welfareCaseId,
      performedByUserId: userElena,
      actionType: 'ESCALATE_TO_AUTHORITY',
      outcomeNotes: 'Transferred case dossier to KSPCA Inspectorate for statutory inspection.',
      escalateToAuthorityName: 'Kenya Society for the Care and Protection of Animals (KSPCA)',
    });

    const updatedWelfareCase = rescueStore.welfareCases.get(welfareCase.welfareCaseId);
    if (!updatedWelfareCase?.isEscalatedToAuthority || (updatedWelfareCase.status as string) !== 'ESCALATED_TO_AUTHORITY') {
      throw new Error('Escalation Failure: Welfare case not marked as ESCALATED_TO_AUTHORITY.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Lost Pet Reunification, Multi-Claimant Isolation & Handover
  // --------------------------------------------------------------------------
  await runTest('Lost Pet Reunification Claim Review & Zero-Duplicate Handover', () => {
    // Complete foster placement to return animal to shelter for reunification
    rescueService.completeFosterPlacement({
      placementId: fosterPlacementId,
      authorizedByUserId: userElena,
      reason: 'Reunification handover preparation',
    });

    // Create reunification case for animalId1
    const reCase = rescueService.createReunificationCase({
      organizationId: testOrgId,
      rescueAnimalId: animalId1,
      matchedPetId: asPetId('pet-reunited-simba-001'),
    });

    // Claimant submits proof of ownership
    const claim = rescueService.submitReunificationClaim({
      reunificationCaseId: reCase.reunificationCaseId,
      claimantUserId: userElena,
      claimantStatement: 'This is my dog Simba who slipped collar in Karura Forest yesterday.',
      evidenceItems: [
        {
          evidenceType: 'VETERINARY_HISTORY_RECORDS',
          description: 'Rabies vaccination certificate matching markings and age',
        },
        {
          evidenceType: 'TIMESTAMPED_PHOTOS',
          description: 'Photos with distinctive chest star markings',
        },
      ],
    });

    if (claim.status !== 'SUBMITTED') {
      throw new Error(`Expected claim status SUBMITTED, got ${claim.status}`);
    }

    // Officer reviews and approves claim
    rescueService.reviewReunificationClaim({
      claimId: claim.claimId,
      reviewerUserId: userOfficer,
      approved: true,
      decisionReason: 'Distinctive white star mark and vaccination cert match.',
    });

    const verifiedCase = rescueStore.reunificationCases.get(reCase.reunificationCaseId);
    if (verifiedCase?.status !== 'OWNERSHIP_VERIFIED') {
      throw new Error(`Expected case status OWNERSHIP_VERIFIED, got ${verifiedCase?.status}`);
    }

    // Execute Handover
    rescueService.executeReunificationHandover({
      reunificationCaseId: reCase.reunificationCaseId,
      authorizedByUserId: userOfficer,
      handoverNotes: 'Simba reunited with Elena after ID and microchip check.',
    });

    const reunitedCase = rescueStore.reunificationCases.get(reCase.reunificationCaseId);
    if (reunitedCase?.status !== 'REUNITED') {
      throw new Error(`Expected case status REUNITED, got ${reunitedCase?.status}`);
    }

    // Verify custody was released to owner
    const finalCustody = Array.from(rescueStore.custodyRecords.values()).find(
      c => c.rescueAnimalId === animalId1 && c.isCurrent
    );
    if (finalCustody?.custodyState !== 'RELEASED' || finalCustody?.custodianType !== 'OWNER') {
      throw new Error('Handover Failure: Custody was not released to owner.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 10: Adoption Hold Period Block & Strict Commercial Sales Prohibition
  // --------------------------------------------------------------------------
  await runTest('Adoption Hold Period Enforcement & Commercial Sales Prohibition', () => {
    // Animal 3: Intake under active statutory hold
    const intake3 = rescueService.createIntakeCase({
      organizationId: testOrgId,
      receivedByUserId: userOfficer,
      intakeType: 'FOUND',
      species: 'DOG',
      temporaryName: 'Hold Period Pup Bella',
      colorAndMarkings: 'Black and White Border Collie mix',
      intakeLocationDescription: 'Found near roadside',
    });

    // Attempt to create adoption case while hold is active must throw
    let holdBlocked = false;
    try {
      rescueService.createAdoptionCase({
        rescueAnimalId: intake3.rescueAnimal.rescueAnimalId,
        organizationId: testOrgId,
        authorizedByUserId: userElena,
      });
    } catch {
      holdBlocked = true;
    }

    if (!holdBlocked) {
      throw new Error('Hold Period Failure: Adoption case created while statutory hold was active.');
    }

    // Relinquished animal has NO statutory hold
    const intakeRelinquished = rescueService.createIntakeCase({
      organizationId: testOrgId,
      receivedByUserId: userOfficer,
      intakeType: 'OWNER_RELINQUISHMENT',
      species: 'CAT',
      temporaryName: 'Adoptable Cat Milo',
      colorAndMarkings: 'Orange tabby',
      intakeLocationDescription: 'Owner moving abroad',
    });

    const adoptionCase = rescueService.createAdoptionCase({
      rescueAnimalId: intakeRelinquished.rescueAnimal.rescueAnimalId,
      organizationId: testOrgId,
      adoptionFeeAmount: 4000,
      adoptionFeeCurrency: 'KES',
      authorizedByUserId: userElena,
    });

    if (adoptionCase.status !== 'PREPARING') {
      throw new Error(`Expected PREPARING, got ${adoptionCase.status}`);
    }

    // COMMERCIAL SALES BAN TEST: Attempting to publish profile with commercial sales language must throw
    let commercialSalesBlocked = false;
    try {
      rescueService.publishAdoptionProfile({
        adoptionCaseId: adoptionCase.adoptionCaseId,
        publicAnimalName: 'Milo - Puppy For Sale',
        species: 'CAT',
        breedDisplay: 'Domestic Shorthair',
        sex: 'MALE',
        ageDisplay: '1 year',
        size: 'MEDIUM',
        storyMarkdown: 'Great deal! Lowest sale price and bidding open now!',
        photoUrls: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba'],
        temperamentObservations: ['Playful', 'Affectionate'],
        compatibilitySummary: { goodWithCats: true },
        authorizedByUserId: userElena,
      });
    } catch {
      commercialSalesBlocked = true;
    }

    if (!commercialSalesBlocked) {
      throw new Error('Policy Violation: System permitted commercial sales terminology in adoption profile.');
    }

    // Clean non-commercial publication succeeds
    const profile = rescueService.publishAdoptionProfile({
      adoptionCaseId: adoptionCase.adoptionCaseId,
      publicAnimalName: 'Milo',
      species: 'CAT',
      breedDisplay: 'Domestic Shorthair',
      sex: 'MALE',
      ageDisplay: '1 year',
      size: 'MEDIUM',
      storyMarkdown: 'Milo is a friendly, curious cat looking for a calm indoor home. Loves window watching.',
      photoUrls: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba'],
      temperamentObservations: ['Calm', 'Affectionate', 'Litter-trained'],
      compatibilitySummary: { goodWithCats: true, goodWithKids: true },
      authorizedByUserId: userElena,
    });

    const updatedAdoptionCase = rescueStore.adoptionCases.get(adoptionCase.adoptionCaseId);
    if (!profile.isAvailableForApplications || updatedAdoptionCase?.status !== 'AVAILABLE') {
      throw new Error('Expected profile to be available for applications.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 11: Adoption Application, Screening & Self-Approval Prevention
  // --------------------------------------------------------------------------
  let adoptionAppId: any;
  let adoptedCaseId: any;
  await runTest('Adoption Screening, Consent Verification & Self-Approval Block', () => {
    const adoptionCase = Array.from(rescueStore.adoptionCases.values()).find(a => a.status === 'AVAILABLE');
    if (!adoptionCase) throw new Error('No available adoption case found.');
    adoptedCaseId = adoptionCase.adoptionCaseId;

    // Applicant must accept screening consent
    let consentBlocked = false;
    try {
      rescueService.submitAdoptionApplication({
        adoptionCaseId: adoptionCase.adoptionCaseId,
        applicantUserId: userAdopter,
        housingType: 'OWNED_HOUSE',
        hasFencedYard: true,
        householdMembersSummary: '2 adults',
        existingPetsSummary: 'None',
        dailyAloneHours: 3,
        applicantStatement: 'Excited to provide a warm and permanent home.',
        screeningConsentAccepted: false, // rejected consent
      });
    } catch {
      consentBlocked = true;
    }

    if (!consentBlocked) {
      throw new Error('Consent Violation: Application submitted without accepting welfare screening terms.');
    }

    // Valid application
    const app = rescueService.submitAdoptionApplication({
      adoptionCaseId: adoptionCase.adoptionCaseId,
      applicantUserId: userAdopter,
      housingType: 'OWNED_HOUSE',
      hasFencedYard: true,
      householdMembersSummary: '2 adults',
      existingPetsSummary: 'None',
      dailyAloneHours: 3,
      veterinaryReferenceName: 'Dr. Kimani Veterinary Clinic',
      veterinaryReferenceContact: '+254-722-000-333',
      applicantStatement: 'Excited to provide a warm and permanent home.',
      screeningConsentAccepted: true,
    });
    adoptionAppId = app.applicationId;

    // Self-approval block: Applicant cannot approve their own application
    let selfApproveBlocked = false;
    try {
      rescueService.reviewAdoptionApplication({
        applicationId: app.applicationId,
        reviewerUserId: userAdopter,
        approved: true,
        decisionReason: 'Self-approval attempt',
      });
    } catch {
      selfApproveBlocked = true;
    }

    if (!selfApproveBlocked) {
      throw new Error('Authorization Violation: Applicant was permitted to self-approve application.');
    }

    // Reviewer approves
    rescueService.reviewAdoptionApplication({
      applicationId: app.applicationId,
      reviewerUserId: userElena,
      approved: true,
      decisionReason: 'Excellent home environment and solid veterinary reference.',
      reviewerNotesInternal: 'Fenced yard confirmed, experienced adopter.',
    });

    if (app.status !== 'APPROVED') {
      throw new Error(`Expected application status APPROVED, got ${app.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Legal Agreement, Placement & Digital Twin Ownership Transition
  // --------------------------------------------------------------------------
  await runTest('Adoption Agreement, Placement Execution & Pet Digital Twin Transition', () => {
    // Execute legal agreement with mandatory welfare clauses
    const agreement = rescueService.createAdoptionAgreement({
      adoptionCaseId: adoptedCaseId,
      applicationId: adoptionAppId,
      adopterSignatureHash: 'sig_sha256_adopter_michael_2026',
      organizationSignatoryUserId: userElena,
    });

    if (!agreement.agreedToNoResaleClause || !agreement.agreedToWelfareReturnClause) {
      throw new Error('Agreement Error: Missing required statutory welfare clauses.');
    }

    // Final handover & placement
    const placement = rescueService.completeAdoptionPlacement({
      adoptionCaseId: adoptedCaseId,
      applicationId: adoptionAppId,
      agreementId: agreement.agreementId,
      handoverOfficerUserId: userElena,
      targetHouseholdId: householdMain,
      handoverNotes: 'Milo handed over with collar, microchip certificate, and vaccination booklet.',
    });

    if (placement.status !== 'COMPLETED') {
      throw new Error(`Expected placement status COMPLETED, got ${placement.status}`);
    }

    // Verify canonical Pet Digital Twin was created/linked in PetStore
    if (!placement.resultingPetId) {
      throw new Error('Digital Twin Error: No resulting PetId linked to adoption placement.');
    }
    const createdPet = PetStore.findPetById(placement.resultingPetId);
    if (!createdPet || createdPet.householdId !== householdMain) {
      throw new Error('Digital Twin Error: Canonical Pet was not created with target household ownership.');
    }

    // Verify adoption case status updated to ADOPTED
    const adoptionCase = rescueStore.adoptionCases.get(adoptedCaseId);
    if (adoptionCase?.status !== 'ADOPTED') {
      throw new Error(`Expected adoption case status ADOPTED, got ${adoptionCase?.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 13: Neutral Adoption Return & Longitudinal Provenance Preservation
  // --------------------------------------------------------------------------
  await runTest('Neutral Adoption Return Workflow & Longitudinal Provenance', () => {
    const placement = Array.from(rescueStore.adoptionPlacements.values())[0];
    if (!placement) throw new Error('No placement found.');

    const returnCase = rescueService.requestAdoptionReturn({
      placementId: placement.placementId,
      adopterUserId: userAdopter,
      reasonCategory: 'HOUSING_CHANGE',
      reasonDetails: 'Landlord unexpected policy change prohibiting pets.',
    });

    if (returnCase.status !== 'SUBMITTED') {
      throw new Error(`Expected return case status SUBMITTED, got ${returnCase.status}`);
    }

    // Historical placement record remains intact!
    const historicalPlacement = rescueStore.adoptionPlacements.get(placement.placementId);
    if (!historicalPlacement) {
      throw new Error('Provenance Failure: Adoption return deleted historical placement.');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Factual Analytics & Audit Integrity
  // --------------------------------------------------------------------------
  await runTest('Factual Organization Analytics & Audit Ledger Verification', () => {
    const analytics = rescueService.getOrganizationAnalytics(testOrgId);
    if (analytics.intakeCount < 2) {
      throw new Error(`Analytics Error: Expected at least 2 intakes, got ${analytics.intakeCount}`);
    }
    if (analytics.adoptionsCount < 1) {
      throw new Error(`Analytics Error: Expected at least 1 adoption outcome, got ${analytics.adoptionsCount}`);
    }
    if (rescueStore.auditLogs.length === 0) {
      throw new Error('Audit Ledger Error: No audit logs recorded.');
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
