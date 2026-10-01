/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster, Adoption & Animal Welfare Seed Data
 * 
 * Provides canonical reference data for:
 * - Nairobi Animal Rescue & Care (Verified Shelter)
 * - Westlands Central Shelter & Karen Foster Haven
 * - Intakes, Temporary Rescue Animals, Custody records
 * - Foster Network Profiles & Placements
 * - Adoption Profiles (Strictly Non-Commercial)
 * - Confidential Welfare Cases & Authority Escalations
 */

import {
  asRescueOrganizationId,
  asRescueOrganizationMembershipId,
  asRescueFacilityId,
  asAnimalIntakeCaseId,
  asRescueAnimalId,
  asRescueCustodyRecordId,
  asShelterPlacementId,
  asFosterProfileId,
  asFosterPlacementId,
  asAnimalWelfareCaseId,
  asWelfareEvidenceId,
  asWelfareActionId,
  asAdoptionCaseId,
  asAdoptionProfileId,
  asAdoptionApplicationId,
  asPublicFoundPetProfileId,
  asUserId,
  asHouseholdId,
} from '../kernel/ids';
import { CANONICAL_IDS } from '../kernel/canonical-ids';
import { RescueStore } from './store';
import {
  RescueOrganization,
  RescueOrganizationMembership,
  RescueFacility,
  AnimalIntakeCase,
  RescueAnimal,
  RescueCustodyRecord,
  ShelterPlacement,
  FosterProfile,
  FosterPlacement,
  AnimalWelfareCase,
  WelfareEvidence,
  WelfareAction,
  AdoptionCase,
  AdoptionProfile,
  AdoptionApplication,
  PublicFoundPetProfile,
} from './types';

export function seedSprint18RescueData(): void {
  const store = RescueStore.getInstance();
  const now = new Date().toISOString();
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
  const tenDaysAgo = new Date(Date.now() - 864000000).toISOString();

  const orgNairobiId = CANONICAL_IDS.RESCUE_ORG_NAIROBI;
  const facWestlandsId = CANONICAL_IDS.RESCUE_FACILITY_WESTLANDS;
  const facKarenId = CANONICAL_IDS.RESCUE_FACILITY_KAREN;

  // 1. Organizations
  const orgNairobi: RescueOrganization = {
    organizationId: orgNairobiId,
    name: 'Nairobi Animal Rescue & Care Shelter',
    slug: 'nairobi-animal-rescue',
    type: 'SHELTER',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    verifiedAt: tenDaysAgo,
    verifiedBy: CANONICAL_IDS.ADMIN_CHARLES,
    registrationNumber: 'NGO-REG-2024-NAIROBI-0891',
    taxOrNgoId: 'KRA-PIN-P051239841K',
    missionStatement: 'Dedicated to ethical animal rescue, shelter rehabilitation, compassionate foster care, and transparent welfare adoption across Kenya.',
    publicContactEmail: 'rescue@nairobianimalcare.or.ke',
    publicContactPhone: '+254-711-234-567',
    websiteUrl: 'https://nairobianimalcare.or.ke',
    headquartersCity: 'Nairobi',
    jurisdictionCountry: 'KE',
    standardHoldPeriodHours: 168, // 7 days statutory hold
    standardAdoptionFeeAmount: 5000,
    standardAdoptionFeeCurrency: 'KES',
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.organizations.set(orgNairobiId, orgNairobi);

  const orgKspcaId = CANONICAL_IDS.RESCUE_ORG_KSPCA;
  const orgKspca: RescueOrganization = {
    organizationId: orgKspcaId,
    name: 'Kenya Animal Welfare & Enforcement Society',
    slug: 'kspca-enforcement',
    type: 'ANIMAL_WELFARE_ORGANIZATION',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    verifiedAt: tenDaysAgo,
    verifiedBy: CANONICAL_IDS.ADMIN_CHARLES,
    registrationNumber: 'KSPCA-STATUTORY-REG-001',
    publicContactEmail: 'enforcement@kspca-kenya.org',
    publicContactPhone: '+254-722-123-456',
    headquartersCity: 'Nairobi',
    jurisdictionCountry: 'KE',
    standardHoldPeriodHours: 168,
    standardAdoptionFeeAmount: 6000,
    standardAdoptionFeeCurrency: 'KES',
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.organizations.set(orgKspcaId, orgKspca);

  // 2. Memberships
  const elenaMembership: RescueOrganizationMembership = {
    membershipId: asRescueOrganizationMembershipId('mem-elena-owner-001'),
    organizationId: orgNairobiId,
    userId: CANONICAL_IDS.OWNER_ELENA,
    role: 'OWNER',
    isActive: true,
    joinedAt: tenDaysAgo,
    updatedAt: now,
  };
  store.memberships.set(elenaMembership.membershipId, elenaMembership);

  const sarahMembership: RescueOrganizationMembership = {
    membershipId: asRescueOrganizationMembershipId('mem-sarah-intake-001'),
    organizationId: orgNairobiId,
    userId: CANONICAL_IDS.WALKER_SARAH_USER,
    role: 'INTAKE_OFFICER',
    isActive: true,
    assignedFacilityId: facWestlandsId,
    joinedAt: tenDaysAgo,
    updatedAt: now,
  };
  store.memberships.set(sarahMembership.membershipId, sarahMembership);

  // 3. Facilities
  const facWestlands: RescueFacility = {
    facilityId: facWestlandsId,
    organizationId: orgNairobiId,
    name: 'Westlands Central Rescue Facility',
    type: 'PUBLIC_FACILITY',
    isPubliclyVisible: true,
    publicAddressLine: '14 Mvuli Way, Westlands, Nairobi',
    city: 'Nairobi',
    region: 'Nairobi County',
    internalCoordinateLat: -1.2655,
    internalCoordinateLng: 36.8045,
    capacityBySpecies: { DOG: 35, CAT: 25 },
    currentOccupancyBySpecies: { DOG: 12, CAT: 8 },
    quarantineCapacity: 6,
    quarantineOccupancy: 2,
    speciesSupported: ['DOG', 'CAT'],
    operationalStatus: 'ACTIVE',
    contactPhone: '+254-711-234-567',
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.facilities.set(facWestlandsId, facWestlands);

  const facKaren: RescueFacility = {
    facilityId: facKarenId,
    organizationId: orgNairobiId,
    name: 'Karen Sanctuary & Foster Base',
    type: 'INTERNAL_OPERATIONAL_LOCATION',
    isPubliclyVisible: false, // Internal operational location - no public address
    city: 'Nairobi',
    region: 'Karen',
    capacityBySpecies: { DOG: 20, CAT: 15 },
    currentOccupancyBySpecies: { DOG: 4, CAT: 2 },
    quarantineCapacity: 4,
    quarantineOccupancy: 0,
    speciesSupported: ['DOG', 'CAT'],
    operationalStatus: 'ACTIVE',
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.facilities.set(facKarenId, facKaren);

  // 4. Animal 1: Baraka (Ready for Adoption, Non-Commercial Profile)
  const animalBarakaId = asRescueAnimalId('animal-baraka-001');
  const intakeBarakaId = asAnimalIntakeCaseId('intake-baraka-001');
  const custodyBarakaId = asRescueCustodyRecordId('custody-baraka-001');

  const animalBaraka: RescueAnimal = {
    rescueAnimalId: animalBarakaId,
    organizationId: orgNairobiId,
    intakeCaseId: intakeBarakaId,
    temporaryName: 'Baraka',
    species: 'DOG',
    apparentBreed: 'Golden African Basenji Mix',
    sex: 'MALE',
    isSpayedOrNeutered: true,
    estimatedAgeYears: 2,
    colorAndMarkings: 'Rich fawn coat with pristine white chest star and socks',
    size: 'MEDIUM',
    distinguishingFeatures: 'White chest star, upright attentive ears',
    observedMicrochipNumber: 'CHIP-KE-982000412891',
    photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
    identityStatus: 'NEW_UNOWNED_ANIMAL',
    currentCustodyRecordId: custodyBarakaId,
    currentPlacementType: 'SHELTER',
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.rescueAnimals.set(animalBarakaId, animalBaraka);

  const intakeBaraka: AnimalIntakeCase = {
    intakeCaseId: intakeBarakaId,
    organizationId: orgNairobiId,
    intakeType: 'FOUND',
    status: 'ADOPTION_EVALUATION',
    intakeAt: tenDaysAgo,
    intakeLocationDescription: 'Found wandering near Lower Kabete Road greenway',
    receivedByUserId: CANONICAL_IDS.WALKER_SARAH_USER,
    temporaryAnimalId: animalBarakaId,
    intakeNotes: 'Gentle, friendly temperament. Underwent full 7-day statutory hold with zero owner claims.',
    initialHealthObservations: 'Healthy, minor burrs in coat. Clear bloodwork, vaccinated and neutered.',
    holdExpiresAt: threeDaysAgoIso(tenDaysAgo, 7),
    isQuarantineRequired: false,
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.intakeCases.set(intakeBarakaId, intakeBaraka);

  const custodyBaraka: RescueCustodyRecord = {
    custodyRecordId: custodyBarakaId,
    rescueAnimalId: animalBarakaId,
    organizationId: orgNairobiId,
    custodyState: 'SHELTER_CUSTODY',
    custodianType: 'FACILITY',
    facilityId: facWestlandsId,
    effectiveFrom: tenDaysAgo,
    authorizedByUserId: CANONICAL_IDS.WALKER_SARAH_USER,
    handoverNotes: 'Initial intake and shelter care placement in Unit Dog-04',
    isCurrent: true,
    createdAt: tenDaysAgo,
  };
  store.custodyRecords.set(custodyBarakaId, custodyBaraka);

  const placementBaraka: ShelterPlacement = {
    placementId: asShelterPlacementId('place-baraka-001'),
    rescueAnimalId: animalBarakaId,
    facilityId: facWestlandsId,
    kennelOrUnitReference: 'UNIT-DOG-04',
    isQuarantine: false,
    startedAt: tenDaysAgo,
    careInstructions: '2x daily walks, high-protein kibble, enjoys puzzle toys.',
    status: 'ACTIVE',
    assignedStaffUserId: CANONICAL_IDS.WALKER_SARAH_USER,
    createdAt: tenDaysAgo,
  };
  store.shelterPlacements.set(placementBaraka.placementId, placementBaraka);

  // Adoption Case & Profile for Baraka
  const adoptionCaseBarakaId = asAdoptionCaseId('adop-case-baraka-001');
  const adoptionProfileBarakaId = asAdoptionProfileId('adop-prof-baraka-001');

  const adoptionCaseBaraka: AdoptionCase = {
    adoptionCaseId: adoptionCaseBarakaId,
    rescueAnimalId: animalBarakaId,
    organizationId: orgNairobiId,
    status: 'AVAILABLE',
    statutoryHoldCompleted: true,
    veterinaryCleared: true,
    welfareCleared: true,
    adoptionFeeAmount: 5000,
    adoptionFeeCurrency: 'KES',
    publishedProfileId: adoptionProfileBarakaId,
    createdAt: twoDaysAgo,
    updatedAt: now,
  };
  store.adoptionCases.set(adoptionCaseBarakaId, adoptionCaseBaraka);

  const adoptionProfileBaraka: AdoptionProfile = {
    profileId: adoptionProfileBarakaId,
    adoptionCaseId: adoptionCaseBarakaId,
    publicAnimalName: 'Baraka',
    species: 'DOG',
    breedDisplay: 'Golden African Mix',
    sex: 'MALE',
    ageDisplay: '2 years young',
    size: 'Medium (18 kg)',
    storyMarkdown: 'Baraka was rescued gently along Lower Kabete Road. He has shown boundless warmth, great leash manners, and a deeply affectionate nature. Fully vaccinated, microchipped, and neutered.',
    photoUrls: [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
      'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&q=80&w=600',
    ],
    temperamentObservations: ['Playful & Eager to Learn', 'Quiet in Kennel', 'Gentle with handlers', 'Loves Outdoor Trails'],
    compatibilitySummary: {
      goodWithDogs: true,
      goodWithCats: true,
      goodWithKids: true,
      requiresExperiencedOwner: false,
    },
    specialCareSummary: 'Thrives on daily 30-minute walks and enrichment puzzles.',
    organizationName: orgNairobi.name,
    organizationVerificationBadge: true,
    generalCityRegion: 'Westlands, Nairobi',
    standardWelfareAdoptionFee: {
      amount: 5000,
      currency: 'KES',
      description: 'Covers statutory rabies/DHPP vaccinations, neutering surgery, full clinical checkup, and lifetime microchip registry.',
    },
    isAvailableForApplications: true,
    publishedAt: twoDaysAgo,
    updatedAt: now,
  };
  store.adoptionProfiles.set(adoptionProfileBarakaId, adoptionProfileBaraka);

  // Sample Adoption Application for Baraka from Michael (Adopter)
  const applicationMichael: AdoptionApplication = {
    applicationId: asAdoptionApplicationId('app-michael-baraka-001'),
    adoptionCaseId: adoptionCaseBarakaId,
    applicantUserId: asUserId('usr-adopter-michael-001'),
    applicantHouseholdId: asHouseholdId('hh-michael-adopter-001'),
    status: 'UNDER_REVIEW',
    housingType: 'OWNED_HOUSE',
    hasFencedYard: true,
    householdMembersSummary: '2 adults (remote professionals), no children',
    existingPetsSummary: 'None currently; had family Golden Retrievers for 12 years',
    dailyAloneHours: 2,
    veterinaryReferenceName: 'Dr. Amani Kimani Veterinary Clinic',
    veterinaryReferenceContact: '+254-722-000-111',
    personalReferenceName: 'David Kariuki',
    personalReferenceContact: '+254-722-999-888',
    applicantStatement: 'We have a secure fenced home garden in Lavington and love outdoor walks. Seeking a lifelong companion.',
    screeningConsentAccepted: true,
    consentVersion: '2026.1_ADOPTION_SCREENING',
    submittedAt: oneDayAgo,
    createdAt: oneDayAgo,
    updatedAt: now,
  };
  store.adoptionApplications.set(applicationMichael.applicationId, applicationMichael);

  // 5. Animal 2: Zawadi (In Foster Care with Karen Foster Home)
  const animalZawadiId = asRescueAnimalId('animal-zawadi-002');
  const intakeZawadiId = asAnimalIntakeCaseId('intake-zawadi-002');
  const fosterProfileKarenId = asFosterProfileId('foster-prof-karen-001');
  const fosterPlacementZawadiId = asFosterPlacementId('foster-place-zawadi-001');
  const custodyZawadiId = asRescueCustodyRecordId('custody-zawadi-002');

  const fosterProfileKaren: FosterProfile = {
    fosterProfileId: fosterProfileKarenId,
    userId: asUserId('usr-foster-karen-001'),
    organizationId: orgNairobiId,
    status: 'APPROVED',
    maxActiveAnimals: 2,
    speciesPreference: ['CAT', 'DOG'],
    sizePreference: ['SMALL', 'MEDIUM'],
    hasFencedYard: true,
    hasOtherPets: true,
    hasChildrenInHome: false,
    experienceLevel: 'EXPERIENCED',
    privateResidenceAddress: 'House 42, Karen Plains Road (Confidential)',
    emergencyContactPhone: '+254-722-888-777',
    notesInternal: 'Vetted foster home since 2024. Ideal for shy or post-surgical recovery animals.',
    activePlacementCount: 1,
    approvedAt: tenDaysAgo,
    approvedByUserId: CANONICAL_IDS.OWNER_ELENA,
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.fosterProfiles.set(fosterProfileKarenId, fosterProfileKaren);

  const animalZawadi: RescueAnimal = {
    rescueAnimalId: animalZawadiId,
    organizationId: orgNairobiId,
    intakeCaseId: intakeZawadiId,
    temporaryName: 'Zawadi',
    species: 'CAT',
    apparentBreed: 'Calico Domestic Shorthair',
    sex: 'FEMALE',
    isSpayedOrNeutered: true,
    estimatedAgeYears: 1,
    colorAndMarkings: 'Distinctive tricolor calico with white bib and whiskers',
    size: 'SMALL',
    distinguishingFeatures: 'Green eyes, split orange-black face mask',
    observedMicrochipNumber: 'CHIP-KE-982000888123',
    photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=600',
    identityStatus: 'NEW_UNOWNED_ANIMAL',
    currentCustodyRecordId: custodyZawadiId,
    currentPlacementType: 'FOSTER',
    createdAt: fiveDaysAgoIso(tenDaysAgo),
    updatedAt: now,
  };
  store.rescueAnimals.set(animalZawadiId, animalZawadi);

  const intakeZawadi: AnimalIntakeCase = {
    intakeCaseId: intakeZawadiId,
    organizationId: orgNairobiId,
    intakeType: 'OWNER_RELINQUISHMENT',
    status: 'UNDER_CARE',
    intakeAt: fiveDaysAgoIso(tenDaysAgo),
    intakeLocationDescription: 'Surrendered to shelter due to owner emergency medical relocation',
    receivedByUserId: CANONICAL_IDS.WALKER_SARAH_USER,
    temporaryAnimalId: animalZawadiId,
    intakeNotes: 'Affectionate indoor cat. Needed quiet foster transition away from busy kennel noise.',
    initialHealthObservations: 'Healthy, up to date on feline vaccinations.',
    isQuarantineRequired: false,
    createdAt: fiveDaysAgoIso(tenDaysAgo),
    updatedAt: now,
  };
  store.intakeCases.set(intakeZawadiId, intakeZawadi);

  const custodyZawadi: RescueCustodyRecord = {
    custodyRecordId: custodyZawadiId,
    rescueAnimalId: animalZawadiId,
    organizationId: orgNairobiId,
    custodyState: 'FOSTER_CUSTODY',
    custodianType: 'FOSTER_HOME',
    fosterProfileId: fosterProfileKarenId,
    effectiveFrom: twoDaysAgo,
    authorizedByUserId: CANONICAL_IDS.OWNER_ELENA,
    handoverNotes: 'Placed in quiet foster care for socialization and preparation for adoption',
    isCurrent: true,
    createdAt: twoDaysAgo,
  };
  store.custodyRecords.set(custodyZawadiId, custodyZawadi);

  const placementZawadi: FosterPlacement = {
    placementId: fosterPlacementZawadiId,
    rescueAnimalId: animalZawadiId,
    fosterProfileId: fosterProfileKarenId,
    organizationId: orgNairobiId,
    status: 'ACTIVE',
    startsAt: twoDaysAgo,
    carePlanInstructions: 'Keep in quiet sunroom initially. Wet food morning, dry kibble evening. Brushing daily.',
    feedingScheduleSummary: '1/2 can wet food 07:30, 1/4 cup dry food 19:00',
    behaviorNotes: 'Shy for first 24 hours, now purring and greeting handler warmly.',
    emergencyContact: '+254-711-234-567 (Shelter Hotline)',
    followUpScheduleDays: [3, 7, 14, 30],
    createdAt: twoDaysAgo,
    updatedAt: now,
  };
  store.fosterPlacements.set(fosterPlacementZawadiId, placementZawadi);

  // 6. Confidential Animal Welfare Case (Restricted Authority Escalation)
  const welfareCaseId = asAnimalWelfareCaseId('welfare-case-001');
  const welfareCase: AnimalWelfareCase = {
    welfareCaseId,
    organizationId: orgNairobiId,
    category: 'MISTREATMENT_ALLEGATION',
    priority: 'URGENT',
    status: 'ESCALATED_TO_AUTHORITY',
    openedAt: twoDaysAgo,
    assignedOfficerUserId: CANONICAL_IDS.OWNER_ELENA,
    allegationSummary: 'Commercial backyard breeder operation alleged to be operating in unzoned residential area with confined breeding pens.',
    locationDescription: 'Compound off Ngong Road, Nairobi',
    reportedBySource: 'COMMUNITY_REPORT',
    confidentialReporterReference: 'anon_rpt_0921',
    isEscalatedToAuthority: true,
    escalatedAuthorityName: 'KSPCA Inspectorate & Nairobi City County Veterinary Health Directorate',
    createdAt: twoDaysAgo,
    updatedAt: now,
  };
  store.welfareCases.set(welfareCaseId, welfareCase);

  const evidenceId = asWelfareEvidenceId('welfare-ev-001');
  const evidence: WelfareEvidence = {
    evidenceId,
    welfareCaseId,
    documentType: 'PHOTOGRAPH',
    description: 'Timestamped photograph documenting overcrowded exterior enclosures without adequate ventilation',
    capturedAt: twoDaysAgo,
    capturedByUserId: CANONICAL_IDS.OWNER_ELENA,
    hashDigest: 'sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    isConfidential: true,
    createdAt: twoDaysAgo,
  };
  store.welfareEvidences.set(evidenceId, evidence);

  const actionId = asWelfareActionId('welfare-act-001');
  const action: WelfareAction = {
    actionId,
    welfareCaseId,
    actionType: 'ESCALATE_TO_AUTHORITY',
    performedByUserId: CANONICAL_IDS.OWNER_ELENA,
    performedAt: oneDayAgo,
    outcomeNotes: 'Formal dossier submitted to KSPCA Inspectorate. Joint inspection scheduled under Animal Diseases Act cap 364.',
    nextFollowUpDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: oneDayAgo,
  };
  store.welfareActions.set(actionId, action);

  // 7. Privacy-Safe Public Found Pet Notice
  const foundNoticeId = asPublicFoundPetProfileId('found-notice-001');
  const foundNotice: PublicFoundPetProfile = {
    publicFoundId: foundNoticeId,
    intakeCaseId: intakeBarakaId,
    organizationId: orgNairobiId,
    species: 'DOG',
    apparentBreed: 'Golden African Mix',
    colorAndMarkings: 'Golden brown with distinctive white chest star',
    approximateFoundArea: 'Lower Kabete / Karura Greenbelt, Nairobi',
    foundDate: tenDaysAgo.split('T')[0],
    photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600',
    organizationName: orgNairobi.name,
    organizationContactPhone: orgNairobi.publicContactPhone ?? '+254-711-234-567',
    isActive: true,
    holdExpiresAt: threeDaysAgoIso(tenDaysAgo, 7),
    createdAt: tenDaysAgo,
    updatedAt: now,
  };
  store.publicFoundPetProfiles.set(foundNoticeId, foundNotice);
}

function threeDaysAgoIso(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function fiveDaysAgoIso(baseIso: string): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + 5);
  return d.toISOString();
}
