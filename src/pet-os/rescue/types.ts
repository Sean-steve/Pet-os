/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster, Reunification, Adoption & Animal Welfare Platform
 * 
 * Implements:
 * - Volume XXIII (Rescue, Adoption & Animal Welfare Architecture)
 * - Volume IV (Identity, Accounts, Households & Access Control)
 * - Volume V (Pet Identity & Digital Twin)
 * - Volume VII (Veterinary Health Access Boundaries)
 * - Volume XX (Location & Lost-Pet Recovery Integration)
 * - Volume XXI (QR, NFC, Microchip & Identity Resolution)
 * - Volume XXXI (Security, Privacy, Trust & Abuse Prevention)
 * - Volume XXXII (Kenyan Privacy & Welfare Regulatory Compliance)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  LostPetIncidentId,
  TagTokenId,
  RescueOrganizationId,
  RescueOrganizationMembershipId,
  RescueFacilityId,
  AnimalIntakeCaseId,
  RescueAnimalId,
  RescueCustodyRecordId,
  ShelterPlacementId,
  FosterProfileId,
  FosterApplicationId,
  FosterPlacementId,
  AnimalWelfareCaseId,
  WelfareEvidenceId,
  WelfareActionId,
  ReunificationCaseId,
  ReunificationClaimId,
  OwnershipEvidenceId,
  AdoptionCaseId,
  AdoptionProfileId,
  AdoptionApplicationId,
  HomeCheckCaseId,
  AdoptionAgreementId,
  AdoptionPlacementId,
  AdoptionReturnCaseId,
  RescueAnimalOutcomeId,
  PublicFoundPetProfileId,
} from '../kernel/ids';

// ============================================================================
// RESCUE ORGANIZATION & MEMBERSHIP
// ============================================================================

export type RescueOrganizationType =
  | 'RESCUE'
  | 'SHELTER'
  | 'FOSTER_NETWORK'
  | 'ANIMAL_WELFARE_ORGANIZATION'
  | 'MUNICIPAL_SHELTER'
  | 'VETERINARY_RESCUE_PARTNER'
  | 'SANCTUARY';

export type OrganizationVerificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REVOKED';

export type OrganizationOperationalStatus =
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type RescueRole =
  | 'OWNER'
  | 'ADMIN'
  | 'INTAKE_OFFICER'
  | 'CASE_WORKER'
  | 'FOSTER_COORDINATOR'
  | 'ADOPTION_COORDINATOR'
  | 'WELFARE_OFFICER'
  | 'VET_PARTNER'
  | 'VOLUNTEER'
  | 'VIEWER';

export interface RescueOrganization {
  organizationId: RescueOrganizationId;
  name: string;
  slug: string;
  type: RescueOrganizationType;
  verificationStatus: OrganizationVerificationStatus;
  operationalStatus: OrganizationOperationalStatus;
  verifiedAt?: string;
  verifiedBy?: UserId;
  registrationNumber?: string;
  taxOrNgoId?: string;
  missionStatement?: string;
  publicContactEmail: string;
  publicContactPhone?: string;
  websiteUrl?: string;
  headquartersCity: string;
  jurisdictionCountry: string; // e.g. "KE"
  standardHoldPeriodHours: number; // e.g. 168 (7 days) statutory hold
  standardAdoptionFeeAmount?: number;
  standardAdoptionFeeCurrency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RescueOrganizationMembership {
  membershipId: RescueOrganizationMembershipId;
  organizationId: RescueOrganizationId;
  userId: UserId;
  role: RescueRole;
  customPermissions?: string[];
  isActive: boolean;
  assignedFacilityId?: RescueFacilityId;
  joinedAt: string;
  updatedAt: string;
}

// ============================================================================
// FACILITIES & PRIVACY BOUNDARIES
// ============================================================================

export type FacilityType =
  | 'PUBLIC_FACILITY'
  | 'PRIVATE_FOSTER_LOCATION'
  | 'INTERNAL_OPERATIONAL_LOCATION';

export interface RescueFacility {
  facilityId: RescueFacilityId;
  organizationId: RescueOrganizationId;
  name: string;
  type: FacilityType;
  isPubliclyVisible: boolean;
  // Public addresses only shown for PUBLIC_FACILITY
  publicAddressLine?: string;
  city: string;
  region: string;
  // Precise coordinates kept internal
  internalCoordinateLat?: number;
  internalCoordinateLng?: number;
  capacityBySpecies: Record<string, number>; // e.g. { 'DOG': 30, 'CAT': 20 }
  currentOccupancyBySpecies: Record<string, number>;
  quarantineCapacity: number;
  quarantineOccupancy: number;
  speciesSupported: string[];
  operationalStatus: 'ACTIVE' | 'AT_CAPACITY' | 'MAINTENANCE' | 'CLOSED';
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ANIMAL INTAKE & TEMPORARY IDENTITY
// ============================================================================

export type IntakeType =
  | 'FOUND'
  | 'STRAY'
  | 'OWNER_RELINQUISHMENT'
  | 'TRANSFER_IN'
  | 'WELFARE_SEIZURE_OR_PROTECTIVE_INTAKE'
  | 'EMERGENCY'
  | 'ABANDONED'
  | 'OTHER';

export type IntakeCaseStatus =
  | 'REPORTED'
  | 'AWAITING_RECEIPT'
  | 'RECEIVED'
  | 'IDENTIFICATION_IN_PROGRESS'
  | 'UNDER_CARE'
  | 'REUNIFICATION_PENDING'
  | 'ADOPTION_EVALUATION'
  | 'TRANSFER_PENDING'
  | 'CLOSED';

export interface AnimalIntakeCase {
  intakeCaseId: AnimalIntakeCaseId;
  organizationId: RescueOrganizationId;
  intakeType: IntakeType;
  status: IntakeCaseStatus;
  intakeAt: string;
  intakeLocationDescription: string;
  reportedByUserId?: UserId;
  receivedByUserId: UserId;
  temporaryAnimalId: RescueAnimalId;
  matchedPetId?: PetId;
  linkedLostPetIncidentId?: LostPetIncidentId;
  intakeNotes: string;
  initialHealthObservations?: string;
  holdExpiresAt?: string; // statutory reunification hold
  isQuarantineRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export type IdentityResolutionOutcome =
  | 'MATCHED_EXISTING_PET'
  | 'MATCHED_LOST_PET_INCIDENT'
  | 'NEW_UNOWNED_ANIMAL'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'
  | 'POSSIBLE_MATCH';

export interface RescueAnimal {
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  intakeCaseId: AnimalIntakeCaseId;
  temporaryName: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  apparentBreed?: string;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  isSpayedOrNeutered?: boolean;
  estimatedAgeYears?: number;
  estimatedAgeMonths?: number;
  colorAndMarkings: string;
  size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
  distinguishingFeatures?: string;
  observedMicrochipNumber?: string;
  observedTagToken?: string;
  photoUrl?: string;
  identityStatus: IdentityResolutionOutcome;
  matchedPetId?: PetId;
  currentCustodyRecordId?: RescueCustodyRecordId;
  currentPlacementType?: 'SHELTER' | 'FOSTER' | 'ADOPTION_PENDING' | 'REUNITED' | 'RELEASED';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CUSTODY & SHELTER PLACEMENT
// ============================================================================

export type CustodyState =
  | 'INTAKE_CUSTODY'
  | 'SHELTER_CUSTODY'
  | 'FOSTER_CUSTODY'
  | 'TRANSFER_CUSTODY'
  | 'OWNER_CLAIM_PENDING'
  | 'ADOPTION_PLACEMENT_PENDING'
  | 'RELEASED';

export interface RescueCustodyRecord {
  custodyRecordId: RescueCustodyRecordId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  custodyState: CustodyState;
  custodianType: 'FACILITY' | 'FOSTER_HOME' | 'RESCUE_TRANSFER' | 'OWNER' | 'ADOPTER';
  facilityId?: RescueFacilityId;
  fosterProfileId?: FosterProfileId;
  externalHolderName?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  authorizedByUserId: UserId;
  handoverNotes?: string;
  handoverVerificationHash?: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface ShelterPlacement {
  placementId: ShelterPlacementId;
  rescueAnimalId: RescueAnimalId;
  facilityId: RescueFacilityId;
  kennelOrUnitReference: string;
  isQuarantine: boolean;
  startedAt: string;
  endedAt?: string;
  careInstructions?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  assignedStaffUserId?: UserId;
  createdAt: string;
}

// ============================================================================
// FOSTER NETWORK & PLACEMENTS
// ============================================================================

export type FosterApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'DECLINED'
  | 'SUSPENDED'
  | 'EXPIRED';

export interface FosterProfile {
  fosterProfileId: FosterProfileId;
  userId: UserId;
  organizationId: RescueOrganizationId;
  status: FosterApplicationStatus;
  maxActiveAnimals: number;
  speciesPreference: string[];
  sizePreference: string[];
  hasFencedYard: boolean;
  hasOtherPets: boolean;
  hasChildrenInHome: boolean;
  experienceLevel: 'FIRST_TIME' | 'INTERMEDIATE' | 'EXPERIENCED' | 'MEDICAL_SPECIALIST';
  // Strictly confidential address
  privateResidenceAddress: string;
  emergencyContactPhone: string;
  notesInternal?: string;
  activePlacementCount: number;
  approvedAt?: string;
  approvedByUserId?: UserId;
  createdAt: string;
  updatedAt: string;
}

export type FosterPlacementStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'RETURN_REQUESTED'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'TRANSFERRED';

export interface FosterPlacement {
  placementId: FosterPlacementId;
  rescueAnimalId: RescueAnimalId;
  fosterProfileId: FosterProfileId;
  organizationId: RescueOrganizationId;
  status: FosterPlacementStatus;
  startsAt: string;
  expectedEndsAt?: string;
  actualEndsAt?: string;
  carePlanInstructions: string;
  feedingScheduleSummary?: string;
  behaviorNotes?: string;
  emergencyContact: string;
  followUpScheduleDays: number[]; // e.g. [3, 7, 14, 30]
  returnReason?: string;
  returnRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ANIMAL WELFARE CASES & RESTRICTED GOVERNANCE
// ============================================================================

export type WelfareCategory =
  | 'NEGLECT_CONCERN'
  | 'INJURY_CONCERN'
  | 'ABANDONMENT'
  | 'UNSAFE_LIVING_CONDITION'
  | 'MISTREATMENT_ALLEGATION'
  | 'HOARDING_CONCERN'
  | 'OTHER';

export type WelfarePriority =
  | 'ROUTINE'
  | 'PRIORITY'
  | 'URGENT'
  | 'CRITICAL';

export type WelfareCaseStatus =
  | 'OPENED'
  | 'UNDER_INVESTIGATION'
  | 'ACTION_REQUIRED'
  | 'ESCALATED_TO_AUTHORITY'
  | 'RESOLVED_PROTECTION_SECURED'
  | 'CLOSED_UNSUBSTANTIATED'
  | 'CLOSED_RESOLVED';

export interface AnimalWelfareCase {
  welfareCaseId: AnimalWelfareCaseId;
  organizationId: RescueOrganizationId;
  rescueAnimalId?: RescueAnimalId;
  petId?: PetId;
  category: WelfareCategory;
  priority: WelfarePriority;
  status: WelfareCaseStatus;
  openedAt: string;
  assignedOfficerUserId: UserId;
  allegationSummary: string;
  locationDescription: string;
  reportedBySource: 'COMMUNITY_REPORT' | 'PROVIDER_REPORT' | 'INTAKE_DISCOVERY' | 'SHELTER_ESCALATION';
  confidentialReporterReference?: string;
  isEscalatedToAuthority: boolean;
  escalatedAuthorityName?: string; // e.g. "KSPCA Enforcement / Kenya Police Directorate"
  resolutionSummary?: string;
  closedAt?: string;
  closedByUserId?: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface WelfareEvidence {
  evidenceId: WelfareEvidenceId;
  welfareCaseId: AnimalWelfareCaseId;
  mediaUrl?: string;
  documentType: 'PHOTOGRAPH' | 'VET_SUMMARY_REF' | 'STATEMENT' | 'INCIDENT_REPORT';
  description: string;
  capturedAt: string;
  capturedByUserId: UserId;
  hashDigest: string; // immutability seal
  isConfidential: boolean;
  createdAt: string;
}

export type WelfareActionType =
  | 'FOLLOW_UP'
  | 'REQUEST_VETERINARY_REVIEW'
  | 'TEMPORARY_PLACEMENT'
  | 'OWNER_CONTACT'
  | 'ESCALATE_TO_AUTHORITY'
  | 'CLOSE_NO_ACTION';

export interface WelfareAction {
  actionId: WelfareActionId;
  welfareCaseId: AnimalWelfareCaseId;
  actionType: WelfareActionType;
  performedByUserId: UserId;
  performedAt: string;
  outcomeNotes: string;
  nextFollowUpDate?: string;
  createdAt: string;
}

// ============================================================================
// LOST PET REUNIFICATION & PROOF OF OWNERSHIP
// ============================================================================

export type ReunificationCaseStatus =
  | 'POTENTIAL_MATCH'
  | 'CLAIM_SUBMITTED'
  | 'CLAIM_UNDER_REVIEW'
  | 'IDENTITY_VERIFIED'
  | 'OWNERSHIP_VERIFIED'
  | 'HANDOVER_SCHEDULED'
  | 'REUNITED'
  | 'CLAIM_REJECTED'
  | 'CANCELLED';

export interface ReunificationCase {
  reunificationCaseId: ReunificationCaseId;
  organizationId: RescueOrganizationId;
  rescueAnimalId: RescueAnimalId;
  matchedPetId?: PetId;
  linkedLostPetIncidentId?: LostPetIncidentId;
  status: ReunificationCaseStatus;
  initiatedAt: string;
  holdExpiresAt?: string;
  verifiedOwnerUserId?: UserId;
  resolutionNotes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClaimStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface ReunificationClaim {
  claimId: ReunificationClaimId;
  reunificationCaseId: ReunificationCaseId;
  claimantUserId: UserId;
  status: ClaimStatus;
  claimantStatement: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedByUserId?: UserId;
  decisionReason?: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
}

export type OwnershipEvidenceType =
  | 'CANONICAL_PET_CORE_REGISTRATION'
  | 'MICROCHIP_REGISTRATION_CERTIFICATE'
  | 'VETERINARY_HISTORY_RECORDS'
  | 'TIMESTAMPED_PHOTOS'
  | 'GOVERNMENT_PET_LICENSE'
  | 'DISTINCTIVE_FEATURE_KNOWLEDGE';

export interface OwnershipEvidence {
  evidenceId: OwnershipEvidenceId;
  claimId: ReunificationClaimId;
  evidenceType: OwnershipEvidenceType;
  description: string;
  documentUrl?: string;
  verifiedStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  verificationNotes?: string;
  createdAt: string;
}

// ============================================================================
// ADOPTION CASES, PROFILES & NON-COMMERCIAL RE-HOMING
// ============================================================================

export type AdoptionCaseStatus =
  | 'EVALUATING'
  | 'NOT_ELIGIBLE'
  | 'PREPARING'
  | 'AVAILABLE'
  | 'APPLICATION_PENDING'
  | 'MATCH_SELECTED'
  | 'PLACEMENT_PENDING'
  | 'ADOPTED'
  | 'PAUSED'
  | 'WITHDRAWN'
  | 'RETURNED';

export interface AdoptionCase {
  adoptionCaseId: AdoptionCaseId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  status: AdoptionCaseStatus;
  statutoryHoldCompleted: boolean;
  veterinaryCleared: boolean;
  welfareCleared: boolean;
  adoptionFeeAmount: number; // Transparent welfare recovery fee (spay/neuter, vaccines)
  adoptionFeeCurrency: string;
  publishedProfileId?: AdoptionProfileId;
  selectedApplicationId?: AdoptionApplicationId;
  activePlacementId?: AdoptionPlacementId;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public Adoption Profile Projection
 * STRICTLY NON-COMMERCIAL:
 * - NO SALE PRICE
 * - NO BIDDING / AUCTION
 * - NO BUY NOW / MAKE OFFER
 * - NO EXPOSURE OF PRIOR OWNER, FOSTER ADDRESS, OR WELFARE RECORDS
 */
export interface AdoptionProfile {
  profileId: AdoptionProfileId;
  adoptionCaseId: AdoptionCaseId;
  publicAnimalName: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  breedDisplay: string;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  ageDisplay: string;
  size: string;
  storyMarkdown: string;
  photoUrls: string[];
  temperamentObservations: string[]; // Factual observations only
  compatibilitySummary: {
    goodWithDogs?: boolean;
    goodWithCats?: boolean;
    goodWithKids?: boolean;
    requiresExperiencedOwner?: boolean;
  };
  specialCareSummary?: string;
  organizationName: string;
  organizationVerificationBadge: boolean;
  generalCityRegion: string;
  standardWelfareAdoptionFee: {
    amount: number;
    currency: string;
    description: string; // e.g. "Covers vaccination, spay/neuter & microchip registration"
  };
  isAvailableForApplications: boolean;
  publishedAt: string;
  updatedAt: string;
}

export type AdoptionApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'APPROVED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'SELECTED';

export interface AdoptionApplication {
  applicationId: AdoptionApplicationId;
  adoptionCaseId: AdoptionCaseId;
  applicantUserId: UserId;
  status: AdoptionApplicationStatus;
  applicantHouseholdId?: HouseholdId;
  housingType: 'OWNED_HOUSE' | 'RENTED_APARTMENT' | 'RENTED_HOUSE' | 'OTHER';
  landlordApprovalVerified?: boolean;
  hasFencedYard: boolean;
  householdMembersSummary: string;
  existingPetsSummary: string;
  dailyAloneHours: number;
  veterinaryReferenceName?: string;
  veterinaryReferenceContact?: string;
  personalReferenceName?: string;
  personalReferenceContact?: string;
  applicantStatement: string;
  screeningConsentAccepted: boolean;
  consentVersion: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedByUserId?: UserId;
  reviewerNotesInternal?: string; // Strictly confidential to org staff
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type HomeCheckStatus =
  | 'REQUESTED'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'FOLLOW_UP_REQUIRED'
  | 'PASSED'
  | 'NOT_APPROVED';

export interface HomeCheckCase {
  homeCheckId: HomeCheckCaseId;
  applicationId: AdoptionApplicationId;
  organizationId: RescueOrganizationId;
  assignedOfficerUserId: UserId;
  status: HomeCheckStatus;
  scheduledFor?: string;
  completedAt?: string;
  observationsMarkdown?: string;
  recommendation?: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'DO_NOT_APPROVE';
  createdAt: string;
  updatedAt: string;
}

export interface AdoptionAgreement {
  agreementId: AdoptionAgreementId;
  adoptionCaseId: AdoptionCaseId;
  applicationId: AdoptionApplicationId;
  organizationId: RescueOrganizationId;
  adopterUserId: UserId;
  termsVersion: string; // e.g. "PET_OS_WELFARE_AGREEMENT_2026_V1"
  agreedToSpayNeuterClause: boolean;
  agreedToWelfareReturnClause: boolean; // Must return to rescue if unable to care
  agreedToNoResaleClause: boolean; // Strictly prohibits commercial reselling
  signedAt: string;
  adopterIpOrSignatureHash: string;
  organizationSignatoryUserId: UserId;
  createdAt: string;
}

export interface AdoptionPlacement {
  placementId: AdoptionPlacementId;
  adoptionCaseId: AdoptionCaseId;
  adopterUserId: UserId;
  targetHouseholdId: HouseholdId;
  effectiveDate: string;
  resultingPetId?: PetId; // Linked or newly created Digital Twin
  agreementReferenceId: AdoptionAgreementId;
  adoptionFeeReceiptReference?: string;
  followUpScheduleDays: number[]; // e.g. [2, 7, 30]
  status: 'PENDING_HANDOVER' | 'COMPLETED' | 'RETURNED';
  handoverCompletedAt?: string;
  handoverOfficerUserId: UserId;
  handoverNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdoptionReturnCase {
  returnCaseId: AdoptionReturnCaseId;
  adoptionCaseId: AdoptionCaseId;
  originalPlacementId: AdoptionPlacementId;
  organizationId: RescueOrganizationId;
  adopterUserId: UserId;
  reasonCategory: 'INCOMPATIBILITY' | 'HOUSING_CHANGE' | 'CARE_CHALLENGE' | 'BEHAVIOR_CONCERN' | 'MEDICAL_COST' | 'OTHER';
  reasonDetails: string;
  requestedAt: string;
  acceptedAt?: string;
  acceptedByUserId?: UserId;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED_INTO_SHELTER' | 'RESOLVED_RETAINED';
  intakeCaseId?: AnimalIntakeCaseId;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// OUTCOMES & PUBLIC FOUND PET PROFILES
// ============================================================================

export type OutcomeType =
  | 'ADOPTED'
  | 'REUNITED'
  | 'TRANSFERRED'
  | 'LONG_TERM_FOSTER'
  | 'SANCTUARY'
  | 'RETURNED_TO_OWNER';

export interface RescueAnimalOutcome {
  outcomeId: RescueAnimalOutcomeId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  outcomeType: OutcomeType;
  outcomeDate: string;
  resultingHouseholdId?: HouseholdId;
  resultingPetId?: PetId;
  notes?: string;
  recordedByUserId: UserId;
  createdAt: string;
}

export interface PublicFoundPetProfile {
  publicFoundId: PublicFoundPetProfileId;
  intakeCaseId: AnimalIntakeCaseId;
  organizationId: RescueOrganizationId;
  species: 'DOG' | 'CAT' | 'OTHER';
  apparentBreed?: string;
  colorAndMarkings: string;
  approximateFoundArea: string; // Coarse location only (e.g. "Westlands, Nairobi")
  foundDate: string;
  photoUrl?: string;
  organizationName: string;
  organizationContactPhone: string;
  isActive: boolean;
  holdExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}
