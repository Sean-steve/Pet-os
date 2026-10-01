/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster & Welfare Store
 * Implements Volume XXX (Database Schema & Technical Data Dictionary).
 */

import {
  RescueOrganizationId,
  RescueOrganizationMembershipId,
  RescueFacilityId,
  AnimalIntakeCaseId,
  RescueAnimalId,
  RescueCustodyRecordId,
  ShelterPlacementId,
  FosterProfileId,
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
  ReunificationCase,
  ReunificationClaim,
  OwnershipEvidence,
  AdoptionCase,
  AdoptionProfile,
  AdoptionApplication,
  HomeCheckCase,
  AdoptionAgreement,
  AdoptionPlacement,
  AdoptionReturnCase,
  RescueAnimalOutcome,
  PublicFoundPetProfile,
} from './types';

export interface RescueAuditRecord {
  auditId: string;
  action: string;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  details?: Record<string, any>;
}

export class RescueStore {
  private static instance: RescueStore;

  public organizations = new Map<RescueOrganizationId, RescueOrganization>();
  public memberships = new Map<RescueOrganizationMembershipId, RescueOrganizationMembership>();
  public facilities = new Map<RescueFacilityId, RescueFacility>();
  public intakeCases = new Map<AnimalIntakeCaseId, AnimalIntakeCase>();
  public rescueAnimals = new Map<RescueAnimalId, RescueAnimal>();
  public custodyRecords = new Map<RescueCustodyRecordId, RescueCustodyRecord>();
  public shelterPlacements = new Map<ShelterPlacementId, ShelterPlacement>();
  public fosterProfiles = new Map<FosterProfileId, FosterProfile>();
  public fosterPlacements = new Map<FosterPlacementId, FosterPlacement>();
  public welfareCases = new Map<AnimalWelfareCaseId, AnimalWelfareCase>();
  public welfareEvidences = new Map<WelfareEvidenceId, WelfareEvidence>();
  public welfareActions = new Map<WelfareActionId, WelfareAction>();
  public reunificationCases = new Map<ReunificationCaseId, ReunificationCase>();
  public reunificationClaims = new Map<ReunificationClaimId, ReunificationClaim>();
  public ownershipEvidences = new Map<OwnershipEvidenceId, OwnershipEvidence>();
  public adoptionCases = new Map<AdoptionCaseId, AdoptionCase>();
  public adoptionProfiles = new Map<AdoptionProfileId, AdoptionProfile>();
  public adoptionApplications = new Map<AdoptionApplicationId, AdoptionApplication>();
  public homeCheckCases = new Map<HomeCheckCaseId, HomeCheckCase>();
  public adoptionAgreements = new Map<AdoptionAgreementId, AdoptionAgreement>();
  public adoptionPlacements = new Map<AdoptionPlacementId, AdoptionPlacement>();
  public adoptionReturns = new Map<AdoptionReturnCaseId, AdoptionReturnCase>();
  public outcomes = new Map<RescueAnimalOutcomeId, RescueAnimalOutcome>();
  public publicFoundPetProfiles = new Map<PublicFoundPetProfileId, PublicFoundPetProfile>();
  public auditLogs: RescueAuditRecord[] = [];

  private constructor() {}

  public static getInstance(): RescueStore {
    if (!RescueStore.instance) {
      RescueStore.instance = new RescueStore();
    }
    return RescueStore.instance;
  }

  public reset(): void {
    this.organizations.clear();
    this.memberships.clear();
    this.facilities.clear();
    this.intakeCases.clear();
    this.rescueAnimals.clear();
    this.custodyRecords.clear();
    this.shelterPlacements.clear();
    this.fosterProfiles.clear();
    this.fosterPlacements.clear();
    this.welfareCases.clear();
    this.welfareEvidences.clear();
    this.welfareActions.clear();
    this.reunificationCases.clear();
    this.reunificationClaims.clear();
    this.ownershipEvidences.clear();
    this.adoptionCases.clear();
    this.adoptionProfiles.clear();
    this.adoptionApplications.clear();
    this.homeCheckCases.clear();
    this.adoptionAgreements.clear();
    this.adoptionPlacements.clear();
    this.adoptionReturns.clear();
    this.outcomes.clear();
    this.publicFoundPetProfiles.clear();
    this.auditLogs = [];
  }

  public logAudit(record: Omit<RescueAuditRecord, 'auditId' | 'timestamp'>): void {
    this.auditLogs.push({
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...record,
    });
  }
}
