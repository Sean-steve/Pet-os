/**
 * Pet OS Sprint 18 - Rescue & Animal Welfare Domain Events
 * Implements Volume XXIX (Event, Command & Asynchronous Architecture).
 */

import {
  RescueOrganizationId,
  AnimalIntakeCaseId,
  RescueAnimalId,
  RescueCustodyRecordId,
  FosterPlacementId,
  AnimalWelfareCaseId,
  ReunificationCaseId,
  ReunificationClaimId,
  AdoptionCaseId,
  AdoptionApplicationId,
  AdoptionPlacementId,
  RescueAnimalOutcomeId,
  PetId,
  HouseholdId,
  UserId,
  LostPetIncidentId,
} from '../kernel/ids';

export interface RescueOrganizationVerifiedPayload {
  organizationId: RescueOrganizationId;
  verifiedBy: UserId;
  verifiedAt: string;
}

export interface AnimalIntakeCreatedPayload {
  intakeCaseId: AnimalIntakeCaseId;
  organizationId: RescueOrganizationId;
  temporaryAnimalId: RescueAnimalId;
  intakeType: string;
  isQuarantineRequired: boolean;
  receivedByUserId: UserId;
}

export interface RescueAnimalIdentityMatchedPayload {
  rescueAnimalId: RescueAnimalId;
  intakeCaseId: AnimalIntakeCaseId;
  outcome: string;
  matchedPetId?: PetId;
  linkedLostPetIncidentId?: LostPetIncidentId;
  confidenceScore: number;
}

export interface RescueCustodyTransferredPayload {
  custodyRecordId: RescueCustodyRecordId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  previousCustodyState?: string;
  newCustodyState: string;
  effectiveFrom: string;
  authorizedByUserId: UserId;
}

export interface FosterPlacementStartedPayload {
  placementId: FosterPlacementId;
  rescueAnimalId: RescueAnimalId;
  fosterUserId: UserId;
  organizationId: RescueOrganizationId;
  startsAt: string;
}

export interface FosterPlacementEndedPayload {
  placementId: FosterPlacementId;
  rescueAnimalId: RescueAnimalId;
  reason: string;
  endedAt: string;
}

export interface WelfareCaseOpenedPayload {
  welfareCaseId: AnimalWelfareCaseId;
  organizationId: RescueOrganizationId;
  category: string;
  priority: string;
  assignedOfficerUserId: UserId;
  isEscalatedToAuthority: boolean;
}

export interface ReunificationClaimSubmittedPayload {
  claimId: ReunificationClaimId;
  reunificationCaseId: ReunificationCaseId;
  claimantUserId: UserId;
}

export interface ReunificationApprovedPayload {
  reunificationCaseId: ReunificationCaseId;
  claimId: ReunificationClaimId;
  verifiedOwnerUserId: UserId;
  rescueAnimalId: RescueAnimalId;
  matchedPetId?: PetId;
  linkedLostPetIncidentId?: LostPetIncidentId;
}

export interface PetReunitedPayload {
  reunificationCaseId: ReunificationCaseId;
  rescueAnimalId: RescueAnimalId;
  petId?: PetId;
  householdId?: HouseholdId;
  ownerUserId: UserId;
  reunitedAt: string;
  linkedLostPetIncidentId?: LostPetIncidentId;
}

export interface AdoptionProfilePublishedPayload {
  adoptionCaseId: AdoptionCaseId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  publicAnimalName: string;
  publishedAt: string;
}

export interface AdoptionApplicationSubmittedPayload {
  applicationId: AdoptionApplicationId;
  adoptionCaseId: AdoptionCaseId;
  applicantUserId: UserId;
  submittedAt: string;
}

export interface AdoptionApplicationApprovedPayload {
  applicationId: AdoptionApplicationId;
  adoptionCaseId: AdoptionCaseId;
  applicantUserId: UserId;
  approvedByUserId: UserId;
}

export interface AdoptionPlacementCompletedPayload {
  placementId: AdoptionPlacementId;
  adoptionCaseId: AdoptionCaseId;
  adopterUserId: UserId;
  targetHouseholdId: HouseholdId;
  resultingPetId?: PetId;
  effectiveDate: string;
}

export interface AdoptionReturnedPayload {
  returnCaseId: string;
  adoptionCaseId: AdoptionCaseId;
  organizationId: RescueOrganizationId;
  reasonCategory: string;
  requestedAt: string;
}

export interface RescueAnimalOutcomeRecordedPayload {
  outcomeId: RescueAnimalOutcomeId;
  rescueAnimalId: RescueAnimalId;
  organizationId: RescueOrganizationId;
  outcomeType: string;
  outcomeDate: string;
}
