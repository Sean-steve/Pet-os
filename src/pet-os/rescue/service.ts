/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster, Reunification, Adoption & Animal Welfare Platform Service
 * 
 * Implements:
 * - Volume XXIII (Rescue, Adoption & Animal Welfare Architecture)
 * - Volume IV (Identity, Accounts, Households & Access Control)
 * - Volume V (Pet Identity & Digital Twin Integration)
 * - Volume XX (Location & Lost-Pet Recovery Integration)
 * - Volume XXI (QR, NFC, Microchip & Identity Network)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - Volume XXXII (Kenyan Privacy & Welfare Regulatory Compliance)
 */

import {
  UserId,
  HouseholdId,
  PetId,
  LostPetIncidentId,
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
  asReunificationCaseId,
  asReunificationClaimId,
  asOwnershipEvidenceId,
  asAdoptionCaseId,
  asAdoptionProfileId,
  asAdoptionApplicationId,
  asHomeCheckCaseId,
  asAdoptionAgreementId,
  asAdoptionPlacementId,
  asAdoptionReturnCaseId,
  asRescueAnimalOutcomeId,
  asPublicFoundPetProfileId,
  asPetId,
  asMicrochipId,
  asHouseholdId,
  generateUUIDv7,
} from '../kernel/ids';
import { createEventEnvelope, EventEnvelope } from '../kernel/events';
import { PetStore } from '../pet-core/store';
import { Pet, PetRelationship } from '../pet-core/types';
import { RecoveryService } from '../recovery/service';
import { RecoveryStore } from '../recovery/store';
import { RescueStore } from './store';
import {
  RescueOrganization,
  RescueOrganizationType,
  RescueOrganizationMembership,
  RescueRole,
  RescueFacility,
  FacilityType,
  AnimalIntakeCase,
  IntakeType,
  IntakeCaseStatus,
  RescueAnimal,
  IdentityResolutionOutcome,
  RescueCustodyRecord,
  CustodyState,
  ShelterPlacement,
  FosterProfile,
  FosterPlacement,
  AnimalWelfareCase,
  WelfareCategory,
  WelfarePriority,
  WelfareEvidence,
  WelfareAction,
  WelfareActionType,
  ReunificationCase,
  ReunificationClaim,
  OwnershipEvidence,
  OwnershipEvidenceType,
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

// Role-to-Permissions Mapping enforcing Least Privilege
const ROLE_PERMISSIONS: Record<RescueRole, string[]> = {
  OWNER: [
    'rescue.organization.read',
    'rescue.organization.manage',
    'rescue.team.manage',
    'rescue.intake.create',
    'rescue.intake.manage',
    'rescue.animal.read',
    'rescue.custody.manage',
    'rescue.identity.resolve',
    'rescue.reunification.manage',
    'rescue.foster.manage',
    'rescue.adoption.manage',
    'rescue.adoption.review',
    'rescue.welfare.read',
    'rescue.welfare.manage',
    'rescue.publication.manage',
  ],
  ADMIN: [
    'rescue.organization.read',
    'rescue.organization.manage',
    'rescue.team.manage',
    'rescue.intake.create',
    'rescue.intake.manage',
    'rescue.animal.read',
    'rescue.custody.manage',
    'rescue.identity.resolve',
    'rescue.reunification.manage',
    'rescue.foster.manage',
    'rescue.adoption.manage',
    'rescue.adoption.review',
    'rescue.welfare.read',
    'rescue.welfare.manage',
    'rescue.publication.manage',
  ],
  INTAKE_OFFICER: [
    'rescue.organization.read',
    'rescue.intake.create',
    'rescue.intake.manage',
    'rescue.animal.read',
    'rescue.custody.manage',
    'rescue.identity.resolve',
    'rescue.reunification.manage',
  ],
  CASE_WORKER: [
    'rescue.organization.read',
    'rescue.animal.read',
    'rescue.reunification.manage',
    'rescue.adoption.manage',
    'rescue.adoption.review',
  ],
  FOSTER_COORDINATOR: [
    'rescue.organization.read',
    'rescue.animal.read',
    'rescue.foster.manage',
    'rescue.custody.manage',
  ],
  ADOPTION_COORDINATOR: [
    'rescue.organization.read',
    'rescue.animal.read',
    'rescue.adoption.manage',
    'rescue.adoption.review',
    'rescue.publication.manage',
  ],
  WELFARE_OFFICER: [
    'rescue.organization.read',
    'rescue.animal.read',
    'rescue.welfare.read',
    'rescue.welfare.manage',
    'rescue.custody.manage',
  ],
  VET_PARTNER: [
    'rescue.organization.read',
    'rescue.animal.read',
    'rescue.intake.create',
    'rescue.identity.resolve',
    'rescue.welfare.read',
  ],
  VOLUNTEER: [
    'rescue.organization.read',
    'rescue.animal.read',
  ],
  VIEWER: [
    'rescue.organization.read',
  ],
};

export class RescueService {
  private static instance: RescueService;
  private store: RescueStore;
  private eventListeners: Array<(event: EventEnvelope) => void> = [];

  private constructor() {
    this.store = RescueStore.getInstance();
  }

  public static getInstance(): RescueService {
    if (!RescueService.instance) {
      RescueService.instance = new RescueService();
    }
    return RescueService.instance;
  }

  public addEventListener(listener: (event: EventEnvelope) => void): void {
    this.eventListeners.push(listener);
  }

  private emitEvent(eventType: string, payload: any): void {
    const envelope = createEventEnvelope(
      eventType,
      'Rescue',
      payload.rescueAnimalId || payload.organizationId || payload.welfareCaseId || 'global',
      payload
    );
    for (const listener of this.eventListeners) {
      try {
        listener(envelope);
      } catch (err) {
        console.error(`Error in event listener for ${eventType}:`, err);
      }
    }
  }

  // ==========================================================================
  // AUTHORIZATION & LEAST PRIVILEGE
  // ==========================================================================

  public hasPermission(userId: UserId, organizationId: RescueOrganizationId, permission: string): boolean {
    const membership = Array.from(this.store.memberships.values()).find(
      m => m.userId === userId && m.organizationId === organizationId && m.isActive
    );
    if (!membership) return false;

    const rolePerms = ROLE_PERMISSIONS[membership.role] || [];
    if (rolePerms.includes(permission)) return true;

    return membership.customPermissions?.includes(permission) ?? false;
  }

  public assertPermission(userId: UserId, organizationId: RescueOrganizationId, permission: string): void {
    if (!this.hasPermission(userId, organizationId, permission)) {
      throw new Error(`Forbidden: User ${userId} lacks permission '${permission}' for organization ${organizationId}`);
    }
  }

  // ==========================================================================
  // 1. RESCUE ORGANIZATION LIFECYCLE & VERIFICATION
  // ==========================================================================

  public createOrganization(params: {
    name: string;
    slug: string;
    type: RescueOrganizationType;
    publicContactEmail: string;
    publicContactPhone?: string;
    headquartersCity: string;
    jurisdictionCountry?: string;
    standardHoldPeriodHours?: number;
    standardAdoptionFeeAmount?: number;
    standardAdoptionFeeCurrency?: string;
    ownerUserId: UserId;
  }): RescueOrganization {
    const organizationId = asRescueOrganizationId(generateUUIDv7());
    const now = new Date().toISOString();

    const org: RescueOrganization = {
      organizationId,
      name: params.name,
      slug: params.slug,
      type: params.type,
      verificationStatus: 'DRAFT',
      operationalStatus: 'ACTIVE',
      publicContactEmail: params.publicContactEmail,
      publicContactPhone: params.publicContactPhone,
      headquartersCity: params.headquartersCity,
      jurisdictionCountry: params.jurisdictionCountry ?? 'KE',
      standardHoldPeriodHours: params.standardHoldPeriodHours ?? 168, // 7 days canonical hold
      standardAdoptionFeeAmount: params.standardAdoptionFeeAmount ?? 5000,
      standardAdoptionFeeCurrency: params.standardAdoptionFeeCurrency ?? 'KES',
      createdAt: now,
      updatedAt: now,
    };

    this.store.organizations.set(organizationId, org);

    // Add initial owner membership
    const membershipId = asRescueOrganizationMembershipId(generateUUIDv7());
    const membership: RescueOrganizationMembership = {
      membershipId,
      organizationId,
      userId: params.ownerUserId,
      role: 'OWNER',
      isActive: true,
      joinedAt: now,
      updatedAt: now,
    };
    this.store.memberships.set(membershipId, membership);

    this.store.logAudit({
      action: 'RESCUE_ORGANIZATION_CREATED',
      actorUserId: params.ownerUserId,
      resourceType: 'RescueOrganization',
      resourceId: organizationId,
      details: { name: params.name, type: params.type },
    });

    return org;
  }

  public verifyOrganization(params: {
    organizationId: RescueOrganizationId;
    verifiedByUserId: UserId;
    registrationNumber: string;
    taxOrNgoId?: string;
  }): RescueOrganization {
    const org = this.store.organizations.get(params.organizationId);
    if (!org) throw new Error(`Organization ${params.organizationId} not found`);

    // Anti-impersonation: A user cannot verify their own organization
    const membership = Array.from(this.store.memberships.values()).find(
      m => m.organizationId === params.organizationId && m.userId === params.verifiedByUserId
    );
    if (membership && membership.role === 'OWNER') {
      throw new Error(`Security Violation: Organization owner cannot self-verify organization.`);
    }

    const now = new Date().toISOString();
    org.verificationStatus = 'VERIFIED';
    org.verifiedAt = now;
    org.verifiedBy = params.verifiedByUserId;
    org.registrationNumber = params.registrationNumber;
    org.taxOrNgoId = params.taxOrNgoId;
    org.updatedAt = now;

    this.store.logAudit({
      action: 'RESCUE_ORGANIZATION_VERIFIED',
      actorUserId: params.verifiedByUserId,
      resourceType: 'RescueOrganization',
      resourceId: params.organizationId,
      details: { registrationNumber: params.registrationNumber },
    });

    this.emitEvent('RescueOrganizationVerified', {
      organizationId: params.organizationId,
      verifiedBy: params.verifiedByUserId,
      verifiedAt: now,
    });

    return org;
  }

  public addTeamMember(params: {
    organizationId: RescueOrganizationId;
    userId: UserId;
    role: RescueRole;
    assignedFacilityId?: RescueFacilityId;
    authorizedByUserId: UserId;
  }): RescueOrganizationMembership {
    this.assertPermission(params.authorizedByUserId, params.organizationId, 'rescue.team.manage');

    const existing = Array.from(this.store.memberships.values()).find(
      m => m.organizationId === params.organizationId && m.userId === params.userId
    );
    if (existing && existing.isActive) {
      throw new Error(`User ${params.userId} is already an active member of organization ${params.organizationId}`);
    }

    const membershipId = asRescueOrganizationMembershipId(generateUUIDv7());
    const now = new Date().toISOString();
    const membership: RescueOrganizationMembership = {
      membershipId,
      organizationId: params.organizationId,
      userId: params.userId,
      role: params.role,
      assignedFacilityId: params.assignedFacilityId,
      isActive: true,
      joinedAt: now,
      updatedAt: now,
    };

    this.store.memberships.set(membershipId, membership);

    this.store.logAudit({
      action: 'TEAM_MEMBER_ADDED',
      actorUserId: params.authorizedByUserId,
      resourceType: 'RescueOrganizationMembership',
      resourceId: membershipId,
      details: { role: params.role, memberUserId: params.userId },
    });

    return membership;
  }

  // ==========================================================================
  // 2. FACILITIES & PRIVACY BOUNDARIES
  // ==========================================================================

  public createFacility(params: {
    organizationId: RescueOrganizationId;
    name: string;
    type: FacilityType;
    city: string;
    region: string;
    publicAddressLine?: string;
    internalCoordinateLat?: number;
    internalCoordinateLng?: number;
    capacityBySpecies: Record<string, number>;
    quarantineCapacity?: number;
    speciesSupported?: string[];
    authorizedByUserId: UserId;
  }): RescueFacility {
    this.assertPermission(params.authorizedByUserId, params.organizationId, 'rescue.organization.manage');

    // Privacy boundary: Private foster/home locations must never have public address lines
    if (params.type === 'PRIVATE_FOSTER_LOCATION' && params.publicAddressLine) {
      throw new Error('Privacy Violation: Private foster locations cannot have public address lines published.');
    }

    const facilityId = asRescueFacilityId(generateUUIDv7());
    const now = new Date().toISOString();

    const facility: RescueFacility = {
      facilityId,
      organizationId: params.organizationId,
      name: params.name,
      type: params.type,
      isPubliclyVisible: params.type === 'PUBLIC_FACILITY',
      publicAddressLine: params.type === 'PUBLIC_FACILITY' ? params.publicAddressLine : undefined,
      city: params.city,
      region: params.region,
      internalCoordinateLat: params.internalCoordinateLat,
      internalCoordinateLng: params.internalCoordinateLng,
      capacityBySpecies: params.capacityBySpecies,
      currentOccupancyBySpecies: {},
      quarantineCapacity: params.quarantineCapacity ?? 5,
      quarantineOccupancy: 0,
      speciesSupported: params.speciesSupported ?? ['DOG', 'CAT'],
      operationalStatus: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.store.facilities.set(facilityId, facility);
    return facility;
  }

  // ==========================================================================
  // 3. INTAKE & TEMPORARY RESCUE ANIMAL IDENTITY
  // ==========================================================================

  public createIntakeCase(params: {
    organizationId: RescueOrganizationId;
    receivedByUserId: UserId;
    intakeType: IntakeType;
    species: 'DOG' | 'CAT' | 'OTHER';
    temporaryName: string;
    apparentBreed?: string;
    sex?: 'MALE' | 'FEMALE' | 'UNKNOWN';
    estimatedAgeYears?: number;
    colorAndMarkings: string;
    size?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT';
    distinguishingFeatures?: string;
    observedMicrochipNumber?: string;
    observedTagToken?: string;
    photoUrl?: string;
    intakeLocationDescription: string;
    initialHealthObservations?: string;
    intakeNotes?: string;
    isQuarantineRequired?: boolean;
    initialFacilityId?: RescueFacilityId;
  }): { intakeCase: AnimalIntakeCase; rescueAnimal: RescueAnimal; reunificationCase?: ReunificationCase } {
    this.assertPermission(params.receivedByUserId, params.organizationId, 'rescue.intake.create');

    const org = this.store.organizations.get(params.organizationId);
    if (!org) throw new Error(`Organization ${params.organizationId} not found`);

    const intakeCaseId = asAnimalIntakeCaseId(generateUUIDv7());
    const rescueAnimalId = asRescueAnimalId(generateUUIDv7());
    const now = new Date().toISOString();

    // Calculate statutory hold expiration (e.g. 7 days for stray/found)
    const holdHours = params.intakeType === 'FOUND' || params.intakeType === 'STRAY' || params.intakeType === 'ABANDONED'
      ? org.standardHoldPeriodHours
      : 0;
    const holdExpiresAt = holdHours > 0
      ? new Date(Date.now() + holdHours * 3600 * 1000).toISOString()
      : undefined;

    // Run identity reconciliation
    const reconciliation = this.reconcileIdentity({
      microchipNumber: params.observedMicrochipNumber,
      tagToken: params.observedTagToken,
      species: params.species,
      colorAndMarkings: params.colorAndMarkings,
    });

    const temporaryAnimal: RescueAnimal = {
      rescueAnimalId,
      organizationId: params.organizationId,
      intakeCaseId,
      temporaryName: params.temporaryName,
      species: params.species,
      apparentBreed: params.apparentBreed,
      sex: params.sex ?? 'UNKNOWN',
      estimatedAgeYears: params.estimatedAgeYears,
      colorAndMarkings: params.colorAndMarkings,
      size: params.size ?? 'MEDIUM',
      distinguishingFeatures: params.distinguishingFeatures,
      observedMicrochipNumber: params.observedMicrochipNumber,
      observedTagToken: params.observedTagToken,
      photoUrl: params.photoUrl,
      identityStatus: reconciliation.outcome,
      matchedPetId: reconciliation.matchedPetId,
      createdAt: now,
      updatedAt: now,
    };
    this.store.rescueAnimals.set(rescueAnimalId, temporaryAnimal);

    const intakeCase: AnimalIntakeCase = {
      intakeCaseId,
      organizationId: params.organizationId,
      intakeType: params.intakeType,
      status: 'RECEIVED',
      intakeAt: now,
      intakeLocationDescription: params.intakeLocationDescription,
      receivedByUserId: params.receivedByUserId,
      temporaryAnimalId: rescueAnimalId,
      matchedPetId: reconciliation.matchedPetId,
      linkedLostPetIncidentId: reconciliation.linkedLostPetIncidentId,
      intakeNotes: params.intakeNotes ?? '',
      initialHealthObservations: params.initialHealthObservations,
      holdExpiresAt,
      isQuarantineRequired: params.isQuarantineRequired ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.intakeCases.set(intakeCaseId, intakeCase);

    // Initial custody assignment: Exactly one active custodian
    const custodyRecordId = asRescueCustodyRecordId(generateUUIDv7());
    const custodyRecord: RescueCustodyRecord = {
      custodyRecordId,
      rescueAnimalId,
      organizationId: params.organizationId,
      custodyState: params.initialFacilityId ? 'SHELTER_CUSTODY' : 'INTAKE_CUSTODY',
      custodianType: 'FACILITY',
      facilityId: params.initialFacilityId,
      effectiveFrom: now,
      authorizedByUserId: params.receivedByUserId,
      handoverNotes: `Initial intake receipt via ${params.intakeType}`,
      isCurrent: true,
      createdAt: now,
    };
    this.store.custodyRecords.set(custodyRecordId, custodyRecord);
    temporaryAnimal.currentCustodyRecordId = custodyRecordId;
    temporaryAnimal.currentPlacementType = params.initialFacilityId ? 'SHELTER' : undefined;

    // If placed directly in a shelter facility, record placement & occupancy
    if (params.initialFacilityId) {
      this.placeInShelter({
        rescueAnimalId,
        facilityId: params.initialFacilityId,
        kennelOrUnitReference: 'INTAKE-BAY-1',
        isQuarantine: params.isQuarantineRequired ?? false,
        assignedStaffUserId: params.receivedByUserId,
      });
    }

    // If an existing pet or active Lost Pet incident is matched or potentially matched,
    // automatically open a ReunificationCase
    let reunificationCase: ReunificationCase | undefined;
    if (reconciliation.outcome === 'MATCHED_LOST_PET_INCIDENT' || reconciliation.outcome === 'POSSIBLE_MATCH' || reconciliation.outcome === 'MATCHED_EXISTING_PET') {
      const reCaseId = asReunificationCaseId(generateUUIDv7());
      reunificationCase = {
        reunificationCaseId: reCaseId,
        organizationId: params.organizationId,
        rescueAnimalId,
        matchedPetId: reconciliation.matchedPetId,
        linkedLostPetIncidentId: reconciliation.linkedLostPetIncidentId,
        status: reconciliation.outcome === 'MATCHED_LOST_PET_INCIDENT' ? 'POTENTIAL_MATCH' : 'POTENTIAL_MATCH',
        initiatedAt: now,
        holdExpiresAt,
        createdAt: now,
        updatedAt: now,
      };
      this.store.reunificationCases.set(reCaseId, reunificationCase);
      intakeCase.status = 'REUNIFICATION_PENDING';
    }

    this.store.logAudit({
      action: 'ANIMAL_INTAKE_CREATED',
      actorUserId: params.receivedByUserId,
      resourceType: 'AnimalIntakeCase',
      resourceId: intakeCaseId,
      details: { intakeType: params.intakeType, species: params.species, identityOutcome: reconciliation.outcome },
    });

    this.emitEvent('AnimalIntakeCreated', {
      intakeCaseId,
      organizationId: params.organizationId,
      temporaryAnimalId: rescueAnimalId,
      intakeType: params.intakeType,
      isQuarantineRequired: params.isQuarantineRequired ?? false,
      receivedByUserId: params.receivedByUserId,
    });

    return { intakeCase, rescueAnimal: temporaryAnimal, reunificationCase };
  }

  // ==========================================================================
  // 4. IDENTITY RECONCILIATION ENGINE
  // ==========================================================================

  public reconcileIdentity(params: {
    microchipNumber?: string;
    tagToken?: string;
    species?: string;
    colorAndMarkings?: string;
  }): {
    outcome: IdentityResolutionOutcome;
    matchedPetId?: PetId;
    linkedLostPetIncidentId?: LostPetIncidentId;
    confidence: number;
    matchDetails: string[];
  } {
    const details: string[] = [];
    const recoveryStore = RecoveryStore.getInstance();

    // 1. Tag Token match (QR / NFC)
    if (params.tagToken) {
      const activeIncidents = Array.from(recoveryStore.lostPetIncidents.values()).filter(
        i => i.status === 'REPORTED' || i.status === 'ACTIVE' || i.status === 'SEARCH_IN_PROGRESS'
      );
      for (const incident of activeIncidents) {
        const profile = recoveryStore.recoveryProfiles.get(incident.recoveryProfileReference);
        if (profile?.publicToken === params.tagToken) {
          details.push(`Direct tag token match: ${params.tagToken}`);
          return {
            outcome: 'MATCHED_LOST_PET_INCIDENT',
            matchedPetId: incident.petId,
            linkedLostPetIncidentId: incident.lostPetIncidentId,
            confidence: 0.98,
            matchDetails: details,
          };
        }
      }
    }

    // 2. Microchip match in PetStore & RecoveryStore
    if (params.microchipNumber) {
      const cleanChip = params.microchipNumber.trim().toUpperCase();
      const match = PetStore.findActiveMicrochipByNumber(cleanChip);
      if (match) {
        const pet = match.pet;
        details.push(`Microchip matches Pet Core: ${pet.name} (${pet.petId})`);
        // Check if pet currently has an active Lost Pet incident
        const activeIncidents = Array.from(recoveryStore.lostPetIncidents.values()).filter(
          i => i.status === 'REPORTED' || i.status === 'ACTIVE' || i.status === 'SEARCH_IN_PROGRESS'
        );
        const incident = activeIncidents.find(i => i.petId === pet.petId);
        if (incident) {
          details.push(`Pet has active Lost Pet incident: ${incident.lostPetIncidentId}`);
          return {
            outcome: 'MATCHED_LOST_PET_INCIDENT',
            matchedPetId: pet.petId,
            linkedLostPetIncidentId: incident.lostPetIncidentId,
            confidence: 0.99,
            matchDetails: details,
          };
        }
        return {
          outcome: 'MATCHED_EXISTING_PET',
          matchedPetId: pet.petId,
          confidence: 0.95,
          matchDetails: details,
        };
      }
    }

    // 3. Active Lost Pet Incident check (visual/species resemblance)
    if (params.species) {
      const activeIncidents = Array.from(recoveryStore.lostPetIncidents.values()).filter(
        i => i.status === 'REPORTED' || i.status === 'ACTIVE' || i.status === 'SEARCH_IN_PROGRESS'
      );
      const possibleIncidents = activeIncidents.filter(i => {
        const pet = PetStore.findPetById(i.petId);
        return pet && pet.speciesCode?.toUpperCase() === params.species?.toUpperCase();
      });

      if (possibleIncidents.length === 1) {
        details.push(`Single active lost pet candidate of matching species: ${possibleIncidents[0].petId}`);
        return {
          outcome: 'POSSIBLE_MATCH',
          matchedPetId: possibleIncidents[0].petId,
          linkedLostPetIncidentId: possibleIncidents[0].lostPetIncidentId,
          confidence: 0.65,
          matchDetails: details,
        };
      } else if (possibleIncidents.length > 1) {
        details.push(`Multiple active lost pets matching species: ${possibleIncidents.length} candidates`);
        return {
          outcome: 'AMBIGUOUS',
          confidence: 0.4,
          matchDetails: details,
        };
      }
    }

    return {
      outcome: 'NEW_UNOWNED_ANIMAL',
      confidence: 0.1,
      matchDetails: ['No identity signals matched existing registry or lost pet records.'],
    };
  }

  // ==========================================================================
  // 5. CUSTODY MANAGEMENT & INVARIANTS
  // ==========================================================================

  public transferCustody(params: {
    rescueAnimalId: RescueAnimalId;
    organizationId: RescueOrganizationId;
    newCustodyState: CustodyState;
    custodianType: 'FACILITY' | 'FOSTER_HOME' | 'RESCUE_TRANSFER' | 'OWNER' | 'ADOPTER';
    facilityId?: RescueFacilityId;
    fosterProfileId?: FosterProfileId;
    externalHolderName?: string;
    authorizedByUserId: UserId;
    handoverNotes?: string;
  }): RescueCustodyRecord {
    this.assertPermission(params.authorizedByUserId, params.organizationId, 'rescue.custody.manage');

    const animal = this.store.rescueAnimals.get(params.rescueAnimalId);
    if (!animal) throw new Error(`RescueAnimal ${params.rescueAnimalId} not found`);

    const now = new Date().toISOString();

    // 1-Current-Custodian Invariant: Ensure previous current record is retired
    const currentRecords = Array.from(this.store.custodyRecords.values()).filter(
      c => c.rescueAnimalId === params.rescueAnimalId && c.isCurrent
    );
    for (const record of currentRecords) {
      record.isCurrent = false;
      record.effectiveUntil = now;
    }

    const custodyRecordId = asRescueCustodyRecordId(generateUUIDv7());
    const newRecord: RescueCustodyRecord = {
      custodyRecordId,
      rescueAnimalId: params.rescueAnimalId,
      organizationId: params.organizationId,
      custodyState: params.newCustodyState,
      custodianType: params.custodianType,
      facilityId: params.facilityId,
      fosterProfileId: params.fosterProfileId,
      externalHolderName: params.externalHolderName,
      effectiveFrom: now,
      authorizedByUserId: params.authorizedByUserId,
      handoverNotes: params.handoverNotes,
      isCurrent: true,
      createdAt: now,
    };

    this.store.custodyRecords.set(custodyRecordId, newRecord);
    animal.currentCustodyRecordId = custodyRecordId;
    animal.updatedAt = now;

    this.store.logAudit({
      action: 'CUSTODY_TRANSFERRED',
      actorUserId: params.authorizedByUserId,
      resourceType: 'RescueCustodyRecord',
      resourceId: custodyRecordId,
      details: { newState: params.newCustodyState, custodianType: params.custodianType },
    });

    this.emitEvent('RescueCustodyTransferred', {
      custodyRecordId,
      rescueAnimalId: params.rescueAnimalId,
      organizationId: params.organizationId,
      newCustodyState: params.newCustodyState,
      effectiveFrom: now,
      authorizedByUserId: params.authorizedByUserId,
    });

    return newRecord;
  }

  // ==========================================================================
  // 6. SHELTER PLACEMENT
  // ==========================================================================

  public placeInShelter(params: {
    rescueAnimalId: RescueAnimalId;
    facilityId: RescueFacilityId;
    kennelOrUnitReference: string;
    isQuarantine: boolean;
    careInstructions?: string;
    assignedStaffUserId?: UserId;
  }): ShelterPlacement {
    const facility = this.store.facilities.get(params.facilityId);
    if (!facility) throw new Error(`Facility ${params.facilityId} not found`);

    const animal = this.store.rescueAnimals.get(params.rescueAnimalId);
    if (!animal) throw new Error(`RescueAnimal ${params.rescueAnimalId} not found`);

    // Capacity verification
    const currentSpeciesCount = facility.currentOccupancyBySpecies[animal.species] || 0;
    const maxCapacity = facility.capacityBySpecies[animal.species] || 50;
    if (currentSpeciesCount >= maxCapacity) {
      throw new Error(`Facility ${facility.name} is at capacity for species ${animal.species} (${currentSpeciesCount}/${maxCapacity})`);
    }

    // Quarantine verification
    if (params.isQuarantine && facility.quarantineOccupancy >= facility.quarantineCapacity) {
      throw new Error(`Facility quarantine bay is at capacity (${facility.quarantineOccupancy}/${facility.quarantineCapacity})`);
    }

    const placementId = asShelterPlacementId(generateUUIDv7());
    const now = new Date().toISOString();

    const placement: ShelterPlacement = {
      placementId,
      rescueAnimalId: params.rescueAnimalId,
      facilityId: params.facilityId,
      kennelOrUnitReference: params.kennelOrUnitReference,
      isQuarantine: params.isQuarantine,
      startedAt: now,
      careInstructions: params.careInstructions,
      status: 'ACTIVE',
      assignedStaffUserId: params.assignedStaffUserId,
      createdAt: now,
    };

    this.store.shelterPlacements.set(placementId, placement);

    // Update facility occupancy
    facility.currentOccupancyBySpecies[animal.species] = currentSpeciesCount + 1;
    if (params.isQuarantine) {
      facility.quarantineOccupancy += 1;
    }
    animal.currentPlacementType = 'SHELTER';

    return placement;
  }

  // ==========================================================================
  // 7. FOSTER NETWORK & PLACEMENTS
  // ==========================================================================

  public submitFosterApplication(params: {
    userId: UserId;
    organizationId: RescueOrganizationId;
    maxActiveAnimals?: number;
    speciesPreference: string[];
    sizePreference: string[];
    hasFencedYard: boolean;
    hasOtherPets: boolean;
    hasChildrenInHome: boolean;
    experienceLevel: 'FIRST_TIME' | 'INTERMEDIATE' | 'EXPERIENCED' | 'MEDICAL_SPECIALIST';
    privateResidenceAddress: string;
    emergencyContactPhone: string;
    notesInternal?: string;
  }): FosterProfile {
    const fosterProfileId = asFosterProfileId(generateUUIDv7());
    const now = new Date().toISOString();

    const profile: FosterProfile = {
      fosterProfileId,
      userId: params.userId,
      organizationId: params.organizationId,
      status: 'SUBMITTED',
      maxActiveAnimals: params.maxActiveAnimals ?? 2,
      speciesPreference: params.speciesPreference,
      sizePreference: params.sizePreference,
      hasFencedYard: params.hasFencedYard,
      hasOtherPets: params.hasOtherPets,
      hasChildrenInHome: params.hasChildrenInHome,
      experienceLevel: params.experienceLevel,
      privateResidenceAddress: params.privateResidenceAddress, // Strictly confidential!
      emergencyContactPhone: params.emergencyContactPhone,
      notesInternal: params.notesInternal,
      activePlacementCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.store.fosterProfiles.set(fosterProfileId, profile);
    return profile;
  }

  public reviewFosterApplication(params: {
    fosterProfileId: FosterProfileId;
    reviewerUserId: UserId;
    approved: boolean;
    maxActiveAnimals?: number;
  }): FosterProfile {
    const profile = this.store.fosterProfiles.get(params.fosterProfileId);
    if (!profile) throw new Error(`Foster profile ${params.fosterProfileId} not found`);

    this.assertPermission(params.reviewerUserId, profile.organizationId, 'rescue.foster.manage');

    const now = new Date().toISOString();
    profile.status = params.approved ? 'APPROVED' : 'DECLINED';
    profile.approvedAt = params.approved ? now : undefined;
    profile.approvedByUserId = params.approved ? params.reviewerUserId : undefined;
    if (params.maxActiveAnimals !== undefined) {
      profile.maxActiveAnimals = params.maxActiveAnimals;
    }
    profile.updatedAt = now;

    this.store.logAudit({
      action: params.approved ? 'FOSTER_APPLICATION_APPROVED' : 'FOSTER_APPLICATION_DECLINED',
      actorUserId: params.reviewerUserId,
      resourceType: 'FosterProfile',
      resourceId: params.fosterProfileId,
    });

    return profile;
  }

  public placeWithFoster(params: {
    rescueAnimalId: RescueAnimalId;
    fosterProfileId: FosterProfileId;
    carePlanInstructions: string;
    feedingScheduleSummary?: string;
    behaviorNotes?: string;
    emergencyContact: string;
    followUpScheduleDays?: number[];
    authorizedByUserId: UserId;
  }): FosterPlacement {
    const profile = this.store.fosterProfiles.get(params.fosterProfileId);
    if (!profile) throw new Error(`Foster profile ${params.fosterProfileId} not found`);
    if (profile.status !== 'APPROVED') {
      throw new Error(`Cannot place animal: Foster profile status is ${profile.status}, not APPROVED`);
    }
    if (profile.activePlacementCount >= profile.maxActiveAnimals) {
      throw new Error(`Foster capacity reached (${profile.activePlacementCount}/${profile.maxActiveAnimals})`);
    }

    this.assertPermission(params.authorizedByUserId, profile.organizationId, 'rescue.foster.manage');

    const animal = this.store.rescueAnimals.get(params.rescueAnimalId);
    if (!animal) throw new Error(`RescueAnimal ${params.rescueAnimalId} not found`);

    const placementId = asFosterPlacementId(generateUUIDv7());
    const now = new Date().toISOString();

    const placement: FosterPlacement = {
      placementId,
      rescueAnimalId: params.rescueAnimalId,
      fosterProfileId: params.fosterProfileId,
      organizationId: profile.organizationId,
      status: 'ACTIVE',
      startsAt: now,
      carePlanInstructions: params.carePlanInstructions,
      feedingScheduleSummary: params.feedingScheduleSummary,
      behaviorNotes: params.behaviorNotes,
      emergencyContact: params.emergencyContact,
      followUpScheduleDays: params.followUpScheduleDays ?? [3, 7, 14, 30],
      createdAt: now,
      updatedAt: now,
    };

    this.store.fosterPlacements.set(placementId, placement);
    profile.activePlacementCount += 1;
    profile.updatedAt = now;

    // Update custody
    this.transferCustody({
      rescueAnimalId: params.rescueAnimalId,
      organizationId: profile.organizationId,
      newCustodyState: 'FOSTER_CUSTODY',
      custodianType: 'FOSTER_HOME',
      fosterProfileId: params.fosterProfileId,
      authorizedByUserId: params.authorizedByUserId,
      handoverNotes: `Placed in foster care with profile ${params.fosterProfileId}`,
    });

    animal.currentPlacementType = 'FOSTER';

    this.emitEvent('FosterPlacementStarted', {
      placementId,
      rescueAnimalId: params.rescueAnimalId,
      fosterUserId: profile.userId,
      organizationId: profile.organizationId,
      startsAt: now,
    });

    return placement;
  }

  public requestFosterReturn(params: {
    placementId: FosterPlacementId;
    fosterUserId: UserId;
    reason: string;
  }): FosterPlacement {
    const placement = this.store.fosterPlacements.get(params.placementId);
    if (!placement) throw new Error(`Placement ${params.placementId} not found`);

    const profile = this.store.fosterProfiles.get(placement.fosterProfileId);
    if (!profile || profile.userId !== params.fosterUserId) {
      throw new Error(`Unauthorized: Only assigned foster can request foster return.`);
    }

    const now = new Date().toISOString();
    placement.status = 'RETURN_REQUESTED';
    placement.returnReason = params.reason;
    placement.returnRequestedAt = now;
    placement.updatedAt = now;

    return placement;
  }

  public completeFosterPlacement(params: {
    placementId: FosterPlacementId;
    authorizedByUserId: UserId;
    reason: string;
  }): FosterPlacement {
    const placement = this.store.fosterPlacements.get(params.placementId);
    if (!placement) throw new Error(`Placement ${params.placementId} not found`);

    this.assertPermission(params.authorizedByUserId, placement.organizationId, 'rescue.foster.manage');

    const profile = this.store.fosterProfiles.get(placement.fosterProfileId);
    if (profile && profile.activePlacementCount > 0) {
      profile.activePlacementCount -= 1;
      profile.updatedAt = new Date().toISOString();
    }

    const now = new Date().toISOString();
    placement.status = 'COMPLETED';
    placement.actualEndsAt = now;
    placement.updatedAt = now;

    this.emitEvent('FosterPlacementEnded', {
      placementId: params.placementId,
      rescueAnimalId: placement.rescueAnimalId,
      reason: params.reason,
      endedAt: now,
    });

    return placement;
  }

  // Scoped foster care projection: strictly limits foster's view to care information
  public getFosterCareProjection(fosterUserId: UserId, placementId: FosterPlacementId): {
    animalName: string;
    species: string;
    apparentBreed?: string;
    carePlanInstructions: string;
    feedingScheduleSummary?: string;
    behaviorNotes?: string;
    emergencyContact: string;
  } {
    const placement = this.store.fosterPlacements.get(placementId);
    if (!placement) throw new Error(`Placement ${placementId} not found`);

    const profile = this.store.fosterProfiles.get(placement.fosterProfileId);
    if (!profile || profile.userId !== fosterUserId) {
      throw new Error(`Access Denied: Scoped foster access restricted to assigned foster.`);
    }
    if (placement.status !== 'ACTIVE' && placement.status !== 'RETURN_REQUESTED') {
      throw new Error(`Access Denied: Placement is no longer active.`);
    }

    const animal = this.store.rescueAnimals.get(placement.rescueAnimalId);
    return {
      animalName: animal?.temporaryName ?? 'Foster Animal',
      species: animal?.species ?? 'DOG',
      apparentBreed: animal?.apparentBreed,
      carePlanInstructions: placement.carePlanInstructions,
      feedingScheduleSummary: placement.feedingScheduleSummary,
      behaviorNotes: placement.behaviorNotes,
      emergencyContact: placement.emergencyContact,
    };
  }

  // ==========================================================================
  // 8. ANIMAL WELFARE CASES (RESTRICTED GOVERNANCE)
  // ==========================================================================

  public openWelfareCase(params: {
    organizationId: RescueOrganizationId;
    assignedOfficerUserId: UserId;
    category: WelfareCategory;
    priority: WelfarePriority;
    allegationSummary: string;
    locationDescription: string;
    reportedBySource: 'COMMUNITY_REPORT' | 'PROVIDER_REPORT' | 'INTAKE_DISCOVERY' | 'SHELTER_ESCALATION';
    confidentialReporterReference?: string;
    rescueAnimalId?: RescueAnimalId;
    petId?: PetId;
  }): AnimalWelfareCase {
    this.assertPermission(params.assignedOfficerUserId, params.organizationId, 'rescue.welfare.manage');

    const welfareCaseId = asAnimalWelfareCaseId(generateUUIDv7());
    const now = new Date().toISOString();

    const welfareCase: AnimalWelfareCase = {
      welfareCaseId,
      organizationId: params.organizationId,
      rescueAnimalId: params.rescueAnimalId,
      petId: params.petId,
      category: params.category,
      priority: params.priority,
      status: 'OPENED',
      openedAt: now,
      assignedOfficerUserId: params.assignedOfficerUserId,
      allegationSummary: params.allegationSummary,
      locationDescription: params.locationDescription,
      reportedBySource: params.reportedBySource,
      confidentialReporterReference: params.confidentialReporterReference,
      isEscalatedToAuthority: false,
      createdAt: now,
      updatedAt: now,
    };

    this.store.welfareCases.set(welfareCaseId, welfareCase);

    this.store.logAudit({
      action: 'WELFARE_CASE_OPENED',
      actorUserId: params.assignedOfficerUserId,
      resourceType: 'AnimalWelfareCase',
      resourceId: welfareCaseId,
      details: { category: params.category, priority: params.priority },
    });

    this.emitEvent('WelfareCaseOpened', {
      welfareCaseId,
      organizationId: params.organizationId,
      category: params.category,
      priority: params.priority,
      assignedOfficerUserId: params.assignedOfficerUserId,
      isEscalatedToAuthority: false,
    });

    return welfareCase;
  }

  public attachWelfareEvidence(params: {
    welfareCaseId: AnimalWelfareCaseId;
    capturedByUserId: UserId;
    documentType: 'PHOTOGRAPH' | 'VET_SUMMARY_REF' | 'STATEMENT' | 'INCIDENT_REPORT';
    description: string;
    mediaUrl?: string;
  }): WelfareEvidence {
    const welfareCase = this.store.welfareCases.get(params.welfareCaseId);
    if (!welfareCase) throw new Error(`Welfare case ${params.welfareCaseId} not found`);

    this.assertPermission(params.capturedByUserId, welfareCase.organizationId, 'rescue.welfare.manage');

    const evidenceId = asWelfareEvidenceId(generateUUIDv7());
    const now = new Date().toISOString();
    const hashDigest = `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const evidence: WelfareEvidence = {
      evidenceId,
      welfareCaseId: params.welfareCaseId,
      mediaUrl: params.mediaUrl,
      documentType: params.documentType,
      description: params.description,
      capturedAt: now,
      capturedByUserId: params.capturedByUserId,
      hashDigest,
      isConfidential: true, // Never public
      createdAt: now,
    };

    this.store.welfareEvidences.set(evidenceId, evidence);
    return evidence;
  }

  public recordWelfareAction(params: {
    welfareCaseId: AnimalWelfareCaseId;
    performedByUserId: UserId;
    actionType: WelfareActionType;
    outcomeNotes: string;
    nextFollowUpDate?: string;
    escalateToAuthorityName?: string;
  }): WelfareAction {
    const welfareCase = this.store.welfareCases.get(params.welfareCaseId);
    if (!welfareCase) throw new Error(`Welfare case ${params.welfareCaseId} not found`);

    this.assertPermission(params.performedByUserId, welfareCase.organizationId, 'rescue.welfare.manage');

    const actionId = asWelfareActionId(generateUUIDv7());
    const now = new Date().toISOString();

    const action: WelfareAction = {
      actionId,
      welfareCaseId: params.welfareCaseId,
      actionType: params.actionType,
      performedByUserId: params.performedByUserId,
      performedAt: now,
      outcomeNotes: params.outcomeNotes,
      nextFollowUpDate: params.nextFollowUpDate,
      createdAt: now,
    };

    this.store.welfareActions.set(actionId, action);

    if (params.actionType === 'ESCALATE_TO_AUTHORITY') {
      welfareCase.isEscalatedToAuthority = true;
      welfareCase.escalatedAuthorityName = params.escalateToAuthorityName ?? 'Kenya Society for the Care and Protection of Animals (KSPCA)';
      welfareCase.status = 'ESCALATED_TO_AUTHORITY';
      welfareCase.updatedAt = now;

      this.emitEvent('WelfareCaseEscalated', {
        welfareCaseId: params.welfareCaseId,
        authorityName: welfareCase.escalatedAuthorityName,
        escalatedByUserId: params.performedByUserId,
      });
    } else {
      welfareCase.status = 'ACTION_REQUIRED';
      welfareCase.updatedAt = now;
    }

    return action;
  }

  // ==========================================================================
  // 9. LOST PET REUNIFICATION & PROOF OF OWNERSHIP
  // ==========================================================================

  public createReunificationCase(params: {
    organizationId: RescueOrganizationId;
    rescueAnimalId: RescueAnimalId;
    matchedPetId?: PetId;
    linkedLostPetIncidentId?: LostPetIncidentId;
    holdExpiresAt?: string;
  }): ReunificationCase {
    const reCaseId = asReunificationCaseId(generateUUIDv7());
    const now = new Date().toISOString();
    const reunificationCase: ReunificationCase = {
      reunificationCaseId: reCaseId,
      organizationId: params.organizationId,
      rescueAnimalId: params.rescueAnimalId,
      matchedPetId: params.matchedPetId,
      linkedLostPetIncidentId: params.linkedLostPetIncidentId,
      status: 'POTENTIAL_MATCH',
      initiatedAt: now,
      holdExpiresAt: params.holdExpiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.store.reunificationCases.set(reCaseId, reunificationCase);
    return reunificationCase;
  }

  public submitReunificationClaim(params: {
    reunificationCaseId: ReunificationCaseId;
    claimantUserId: UserId;
    claimantStatement: string;
    evidenceItems: Array<{
      evidenceType: OwnershipEvidenceType;
      description: string;
      documentUrl?: string;
    }>;
  }): ReunificationClaim {
    const reCase = this.store.reunificationCases.get(params.reunificationCaseId);
    if (!reCase) throw new Error(`Reunification case ${params.reunificationCaseId} not found`);

    // Prevent duplicate active claims from same user
    const existing = Array.from(this.store.reunificationClaims.values()).find(
      c => c.reunificationCaseId === params.reunificationCaseId && c.claimantUserId === params.claimantUserId && c.status === 'SUBMITTED'
    );
    if (existing) {
      throw new Error(`You already have a pending ownership claim for this case.`);
    }

    const claimId = asReunificationClaimId(generateUUIDv7());
    const now = new Date().toISOString();

    const evidenceRefs: string[] = [];
    for (const item of params.evidenceItems) {
      const evidenceId = asOwnershipEvidenceId(generateUUIDv7());
      const evidence: OwnershipEvidence = {
        evidenceId,
        claimId,
        evidenceType: item.evidenceType,
        description: item.description,
        documentUrl: item.documentUrl,
        verifiedStatus: 'PENDING',
        createdAt: now,
      };
      this.store.ownershipEvidences.set(evidenceId, evidence);
      evidenceRefs.push(evidenceId);
    }

    const claim: ReunificationClaim = {
      claimId,
      reunificationCaseId: params.reunificationCaseId,
      claimantUserId: params.claimantUserId,
      status: 'SUBMITTED',
      claimantStatement: params.claimantStatement,
      submittedAt: now,
      evidenceReferences: evidenceRefs,
      createdAt: now,
      updatedAt: now,
    };

    this.store.reunificationClaims.set(claimId, claim);
    reCase.status = 'CLAIM_SUBMITTED';
    reCase.updatedAt = now;

    this.emitEvent('ReunificationClaimSubmitted', {
      claimId,
      reunificationCaseId: params.reunificationCaseId,
      claimantUserId: params.claimantUserId,
    });

    return claim;
  }

  public reviewReunificationClaim(params: {
    claimId: ReunificationClaimId;
    reviewerUserId: UserId;
    approved: boolean;
    decisionReason: string;
  }): ReunificationClaim {
    const claim = this.store.reunificationClaims.get(params.claimId);
    if (!claim) throw new Error(`Claim ${params.claimId} not found`);

    const reCase = this.store.reunificationCases.get(claim.reunificationCaseId);
    if (!reCase) throw new Error(`Reunification case ${claim.reunificationCaseId} not found`);

    this.assertPermission(params.reviewerUserId, reCase.organizationId, 'rescue.reunification.manage');

    const now = new Date().toISOString();
    claim.status = params.approved ? 'APPROVED' : 'REJECTED';
    claim.reviewedAt = now;
    claim.reviewedByUserId = params.reviewerUserId;
    claim.decisionReason = params.decisionReason;
    claim.updatedAt = now;

    if (params.approved) {
      reCase.status = 'OWNERSHIP_VERIFIED';
      reCase.verifiedOwnerUserId = claim.claimantUserId;
      reCase.updatedAt = now;

      this.emitEvent('ReunificationApproved', {
        reunificationCaseId: reCase.reunificationCaseId,
        claimId: claim.claimId,
        verifiedOwnerUserId: claim.claimantUserId,
        rescueAnimalId: reCase.rescueAnimalId,
        matchedPetId: reCase.matchedPetId,
        linkedLostPetIncidentId: reCase.linkedLostPetIncidentId,
      });
    }

    return claim;
  }

  public executeReunificationHandover(params: {
    reunificationCaseId: ReunificationCaseId;
    authorizedByUserId: UserId;
    handoverNotes?: string;
  }): ReunificationCase {
    const reCase = this.store.reunificationCases.get(params.reunificationCaseId);
    if (!reCase) throw new Error(`Reunification case ${params.reunificationCaseId} not found`);
    if (reCase.status !== 'OWNERSHIP_VERIFIED' || !reCase.verifiedOwnerUserId) {
      throw new Error(`Cannot execute handover: Ownership is not verified (status: ${reCase.status})`);
    }

    this.assertPermission(params.authorizedByUserId, reCase.organizationId, 'rescue.reunification.manage');

    const now = new Date().toISOString();

    // Release custody back to owner
    this.transferCustody({
      rescueAnimalId: reCase.rescueAnimalId,
      organizationId: reCase.organizationId,
      newCustodyState: 'RELEASED',
      custodianType: 'OWNER',
      authorizedByUserId: params.authorizedByUserId,
      handoverNotes: params.handoverNotes ?? `Returned to verified owner ${reCase.verifiedOwnerUserId}`,
    });

    reCase.status = 'REUNITED';
    reCase.completedAt = now;
    reCase.updatedAt = now;

    // Close intake case
    const animal = this.store.rescueAnimals.get(reCase.rescueAnimalId);
    if (animal) {
      animal.currentPlacementType = 'REUNITED';
      const intakeCase = this.store.intakeCases.get(animal.intakeCaseId);
      if (intakeCase) {
        intakeCase.status = 'CLOSED';
        intakeCase.updatedAt = now;
      }
    }

    // Recover Sprint 15 Lost Pet Incident if linked
    if (reCase.linkedLostPetIncidentId) {
      try {
        const recoveryService = RecoveryService.getInstance();
        recoveryService.confirmRecovery({
          incidentId: reCase.linkedLostPetIncidentId,
          actorUserId: params.authorizedByUserId,
          resolutionNotes: `Reunited through rescue intake case ${animal?.intakeCaseId}`,
        });
      } catch (err) {
        console.warn('Failed to call RecoveryService.confirmRecovery:', err);
      }
    }

    // Record Outcome
    const outcomeId = asRescueAnimalOutcomeId(generateUUIDv7());
    this.store.outcomes.set(outcomeId, {
      outcomeId,
      rescueAnimalId: reCase.rescueAnimalId,
      organizationId: reCase.organizationId,
      outcomeType: 'REUNITED',
      outcomeDate: now,
      resultingPetId: reCase.matchedPetId,
      recordedByUserId: params.authorizedByUserId,
      notes: `Reunited with verified owner ${reCase.verifiedOwnerUserId}`,
      createdAt: now,
    });

    this.emitEvent('PetReunited', {
      reunificationCaseId: reCase.reunificationCaseId,
      rescueAnimalId: reCase.rescueAnimalId,
      petId: reCase.matchedPetId,
      ownerUserId: reCase.verifiedOwnerUserId,
      reunitedAt: now,
      linkedLostPetIncidentId: reCase.linkedLostPetIncidentId,
    });

    return reCase;
  }

  // ==========================================================================
  // 10. ADOPTION CASES, PROFILES & RE-HOMING PLATFORM
  // ==========================================================================

  public evaluateAdoptionEligibility(rescueAnimalId: RescueAnimalId): {
    isEligible: boolean;
    reasons: string[];
    holdExpiresAt?: string;
  } {
    const animal = this.store.rescueAnimals.get(rescueAnimalId);
    if (!animal) throw new Error(`RescueAnimal ${rescueAnimalId} not found`);

    const intakeCase = this.store.intakeCases.get(animal.intakeCaseId);
    const reasons: string[] = [];

    // Statutory hold verification
    if (intakeCase?.holdExpiresAt) {
      const expires = new Date(intakeCase.holdExpiresAt).getTime();
      if (Date.now() < expires) {
        reasons.push(`Statutory reunification hold active until ${intakeCase.holdExpiresAt}`);
      }
    }

    // Check active reunification case
    const reCase = Array.from(this.store.reunificationCases.values()).find(
      r => r.rescueAnimalId === rescueAnimalId && (r.status === 'POTENTIAL_MATCH' || r.status === 'CLAIM_UNDER_REVIEW' || r.status === 'OWNERSHIP_VERIFIED')
    );
    if (reCase) {
      reasons.push(`Active reunification case pending in status ${reCase.status}`);
    }

    return {
      isEligible: reasons.length === 0,
      reasons,
      holdExpiresAt: intakeCase?.holdExpiresAt,
    };
  }

  public createAdoptionCase(params: {
    rescueAnimalId: RescueAnimalId;
    organizationId: RescueOrganizationId;
    adoptionFeeAmount?: number;
    adoptionFeeCurrency?: string;
    authorizedByUserId: UserId;
  }): AdoptionCase {
    this.assertPermission(params.authorizedByUserId, params.organizationId, 'rescue.adoption.manage');

    const eligibility = this.evaluateAdoptionEligibility(params.rescueAnimalId);
    if (!eligibility.isEligible) {
      throw new Error(`Animal is not eligible for adoption: ${eligibility.reasons.join('; ')}`);
    }

    const org = this.store.organizations.get(params.organizationId);
    const adoptionCaseId = asAdoptionCaseId(generateUUIDv7());
    const now = new Date().toISOString();

    const adoptionCase: AdoptionCase = {
      adoptionCaseId,
      rescueAnimalId: params.rescueAnimalId,
      organizationId: params.organizationId,
      status: 'PREPARING',
      statutoryHoldCompleted: true,
      veterinaryCleared: true,
      welfareCleared: true,
      adoptionFeeAmount: params.adoptionFeeAmount ?? org?.standardAdoptionFeeAmount ?? 5000,
      adoptionFeeCurrency: params.adoptionFeeCurrency ?? org?.standardAdoptionFeeCurrency ?? 'KES',
      createdAt: now,
      updatedAt: now,
    };

    this.store.adoptionCases.set(adoptionCaseId, adoptionCase);
    return adoptionCase;
  }

  public publishAdoptionProfile(params: {
    adoptionCaseId: AdoptionCaseId;
    publicAnimalName: string;
    species: 'DOG' | 'CAT' | 'OTHER';
    breedDisplay: string;
    sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
    ageDisplay: string;
    size: string;
    storyMarkdown: string;
    photoUrls: string[];
    temperamentObservations: string[];
    compatibilitySummary: {
      goodWithDogs?: boolean;
      goodWithCats?: boolean;
      goodWithKids?: boolean;
      requiresExperiencedOwner?: boolean;
    };
    specialCareSummary?: string;
    authorizedByUserId: UserId;
  }): AdoptionProfile {
    const adoptionCase = this.store.adoptionCases.get(params.adoptionCaseId);
    if (!adoptionCase) throw new Error(`Adoption case ${params.adoptionCaseId} not found`);

    this.assertPermission(params.authorizedByUserId, adoptionCase.organizationId, 'rescue.publication.manage');

    const org = this.store.organizations.get(adoptionCase.organizationId);
    if (!org || org.verificationStatus !== 'VERIFIED') {
      throw new Error(`Trust & Safety Violation: Only verified rescue organizations can publish public adoption profiles.`);
    }

    const eligibility = this.evaluateAdoptionEligibility(adoptionCase.rescueAnimalId);
    if (!eligibility.isEligible) {
      throw new Error(`Publication Blocked: Reunification hold period or claim is active.`);
    }

    // STRICT NON-COMMERCIAL VALIDATION
    // Ensure no commercial sales terms exist in the profile payload
    const serializedStory = `${params.storyMarkdown} ${params.publicAnimalName}`.toLowerCase();
    const bannedSalesPhrases = ['sale price', 'buy now', 'make offer', 'bidding', 'puppy for sale', 'auction'];
    for (const phrase of bannedSalesPhrases) {
      if (serializedStory.includes(phrase)) {
        throw new Error(`Policy Violation: Adoption profiles cannot include commercial sales terminology ('${phrase}').`);
      }
    }

    const profileId = asAdoptionProfileId(generateUUIDv7());
    const now = new Date().toISOString();

    const profile: AdoptionProfile = {
      profileId,
      adoptionCaseId: params.adoptionCaseId,
      publicAnimalName: params.publicAnimalName,
      species: params.species,
      breedDisplay: params.breedDisplay,
      sex: params.sex,
      ageDisplay: params.ageDisplay,
      size: params.size,
      storyMarkdown: params.storyMarkdown,
      photoUrls: params.photoUrls,
      temperamentObservations: params.temperamentObservations,
      compatibilitySummary: params.compatibilitySummary,
      specialCareSummary: params.specialCareSummary,
      organizationName: org.name,
      organizationVerificationBadge: true,
      generalCityRegion: org.headquartersCity,
      standardWelfareAdoptionFee: {
        amount: adoptionCase.adoptionFeeAmount,
        currency: adoptionCase.adoptionFeeCurrency,
        description: 'Covers essential veterinary rehabilitation, spay/neuter, vaccinations and microchipping.',
      },
      isAvailableForApplications: true,
      publishedAt: now,
      updatedAt: now,
    };

    this.store.adoptionProfiles.set(profileId, profile);
    adoptionCase.status = 'AVAILABLE';
    adoptionCase.publishedProfileId = profileId;
    adoptionCase.updatedAt = now;

    this.emitEvent('AdoptionProfilePublished', {
      adoptionCaseId: params.adoptionCaseId,
      rescueAnimalId: adoptionCase.rescueAnimalId,
      organizationId: adoptionCase.organizationId,
      publicAnimalName: params.publicAnimalName,
      publishedAt: now,
    });

    return profile;
  }

  public submitAdoptionApplication(params: {
    adoptionCaseId: AdoptionCaseId;
    applicantUserId: UserId;
    applicantHouseholdId?: HouseholdId;
    housingType: 'OWNED_HOUSE' | 'RENTED_APARTMENT' | 'RENTED_HOUSE' | 'OTHER';
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
    consentVersion?: string;
  }): AdoptionApplication {
    const adoptionCase = this.store.adoptionCases.get(params.adoptionCaseId);
    if (!adoptionCase || adoptionCase.status !== 'AVAILABLE') {
      throw new Error(`Adoption case ${params.adoptionCaseId} is not available for applications.`);
    }

    if (!params.screeningConsentAccepted) {
      throw new Error(`Consent Required: You must accept the welfare screening consent terms to apply.`);
    }

    // Duplicate check: One active application per applicant per animal
    const existing = Array.from(this.store.adoptionApplications.values()).find(
      a => a.adoptionCaseId === params.adoptionCaseId && a.applicantUserId === params.applicantUserId && a.status === 'SUBMITTED'
    );
    if (existing) {
      throw new Error(`You have already submitted an active application for this pet.`);
    }

    const applicationId = asAdoptionApplicationId(generateUUIDv7());
    const now = new Date().toISOString();

    const application: AdoptionApplication = {
      applicationId,
      adoptionCaseId: params.adoptionCaseId,
      applicantUserId: params.applicantUserId,
      applicantHouseholdId: params.applicantHouseholdId,
      status: 'SUBMITTED',
      housingType: params.housingType,
      hasFencedYard: params.hasFencedYard,
      householdMembersSummary: params.householdMembersSummary,
      existingPetsSummary: params.existingPetsSummary,
      dailyAloneHours: params.dailyAloneHours,
      veterinaryReferenceName: params.veterinaryReferenceName,
      veterinaryReferenceContact: params.veterinaryReferenceContact,
      personalReferenceName: params.personalReferenceName,
      personalReferenceContact: params.personalReferenceContact,
      applicantStatement: params.applicantStatement,
      screeningConsentAccepted: true,
      consentVersion: params.consentVersion ?? '2026.1_ADOPTION_SCREENING',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.store.adoptionApplications.set(applicationId, application);
    adoptionCase.status = 'APPLICATION_PENDING';
    adoptionCase.updatedAt = now;

    this.emitEvent('AdoptionApplicationSubmitted', {
      applicationId,
      adoptionCaseId: params.adoptionCaseId,
      applicantUserId: params.applicantUserId,
      submittedAt: now,
    });

    return application;
  }

  public reviewAdoptionApplication(params: {
    applicationId: AdoptionApplicationId;
    reviewerUserId: UserId;
    approved: boolean;
    decisionReason: string;
    reviewerNotesInternal?: string;
  }): AdoptionApplication {
    const app = this.store.adoptionApplications.get(params.applicationId);
    if (!app) throw new Error(`Application ${params.applicationId} not found`);

    const adoptionCase = this.store.adoptionCases.get(app.adoptionCaseId);
    if (!adoptionCase) throw new Error(`Adoption case ${app.adoptionCaseId} not found`);

    this.assertPermission(params.reviewerUserId, adoptionCase.organizationId, 'rescue.adoption.review');

    // Security: Applicant cannot approve their own application
    if (app.applicantUserId === params.reviewerUserId) {
      throw new Error(`Authorization Violation: Applicant cannot review or approve their own application.`);
    }

    const now = new Date().toISOString();
    app.status = params.approved ? 'APPROVED' : 'DECLINED';
    app.reviewedAt = now;
    app.reviewedByUserId = params.reviewerUserId;
    app.decisionReason = params.decisionReason;
    app.reviewerNotesInternal = params.reviewerNotesInternal; // Kept internal!
    app.updatedAt = now;

    if (params.approved) {
      adoptionCase.status = 'MATCH_SELECTED';
      adoptionCase.selectedApplicationId = app.applicationId;
      adoptionCase.updatedAt = now;

      this.emitEvent('AdoptionApplicationApproved', {
        applicationId: app.applicationId,
        adoptionCaseId: adoptionCase.adoptionCaseId,
        applicantUserId: app.applicantUserId,
        approvedByUserId: params.reviewerUserId,
      });
    }

    return app;
  }

  public createAdoptionAgreement(params: {
    adoptionCaseId: AdoptionCaseId;
    applicationId: AdoptionApplicationId;
    termsVersion?: string;
    adopterSignatureHash: string;
    organizationSignatoryUserId: UserId;
  }): AdoptionAgreement {
    const adoptionCase = this.store.adoptionCases.get(params.adoptionCaseId);
    if (!adoptionCase) throw new Error(`Adoption case ${params.adoptionCaseId} not found`);

    const app = this.store.adoptionApplications.get(params.applicationId);
    if (!app || app.status !== 'APPROVED') {
      throw new Error(`Application must be APPROVED before executing adoption agreement.`);
    }

    this.assertPermission(params.organizationSignatoryUserId, adoptionCase.organizationId, 'rescue.adoption.manage');

    const agreementId = asAdoptionAgreementId(generateUUIDv7());
    const now = new Date().toISOString();

    const agreement: AdoptionAgreement = {
      agreementId,
      adoptionCaseId: params.adoptionCaseId,
      applicationId: params.applicationId,
      organizationId: adoptionCase.organizationId,
      adopterUserId: app.applicantUserId,
      termsVersion: params.termsVersion ?? 'PET_OS_WELFARE_AGREEMENT_2026_V1',
      agreedToSpayNeuterClause: true,
      agreedToWelfareReturnClause: true,
      agreedToNoResaleClause: true,
      signedAt: now,
      adopterIpOrSignatureHash: params.adopterSignatureHash,
      organizationSignatoryUserId: params.organizationSignatoryUserId,
      createdAt: now,
    };

    this.store.adoptionAgreements.set(agreementId, agreement);
    return agreement;
  }

  public completeAdoptionPlacement(params: {
    adoptionCaseId: AdoptionCaseId;
    applicationId: AdoptionApplicationId;
    agreementId: AdoptionAgreementId;
    handoverOfficerUserId: UserId;
    targetHouseholdId: HouseholdId;
    handoverNotes?: string;
  }): AdoptionPlacement {
    const adoptionCase = this.store.adoptionCases.get(params.adoptionCaseId);
    if (!adoptionCase) throw new Error(`Adoption case ${params.adoptionCaseId} not found`);

    const agreement = this.store.adoptionAgreements.get(params.agreementId);
    if (!agreement) throw new Error(`Agreement ${params.agreementId} not found`);

    const app = this.store.adoptionApplications.get(params.applicationId);
    if (!app) throw new Error(`Application ${params.applicationId} not found`);

    this.assertPermission(params.handoverOfficerUserId, adoptionCase.organizationId, 'rescue.adoption.manage');

    const animal = this.store.rescueAnimals.get(adoptionCase.rescueAnimalId);
    if (!animal) throw new Error(`Animal ${adoptionCase.rescueAnimalId} not found`);

    const now = new Date().toISOString();
    const placementId = asAdoptionPlacementId(generateUUIDv7());

    // 1. Ownership / Custody Transfer to Adopter
    this.transferCustody({
      rescueAnimalId: animal.rescueAnimalId,
      organizationId: adoptionCase.organizationId,
      newCustodyState: 'RELEASED',
      custodianType: 'ADOPTER',
      authorizedByUserId: params.handoverOfficerUserId,
      handoverNotes: params.handoverNotes ?? `Final adoption placement with adopter ${app.applicantUserId}`,
    });

    // 2. Canonical Pet Digital Twin Transition or Creation
    let resultingPetId: PetId;
    if (animal.matchedPetId) {
      // Transfer relationship of existing canonical pet to adopter household
      resultingPetId = animal.matchedPetId;
      const pet = PetStore.findPetById(resultingPetId);
      if (pet) {
        pet.householdId = params.targetHouseholdId;
        PetStore.savePet(pet);
      }
    } else {
      // Create new Pet Digital Twin from rescue animal provenance
      resultingPetId = asPetId(`pet_${generateUUIDv7()}`);
      const newPet: Pet = {
        petId: resultingPetId,
        householdId: params.targetHouseholdId,
        name: animal.temporaryName,
        speciesCode: animal.species.toLowerCase(),
        breedCode: 'MIXED',
        mixedBreed: true,
        unknownBreed: !animal.apparentBreed,
        customBreedName: animal.apparentBreed,
        sex: animal.sex === 'MALE' ? 'MALE' : animal.sex === 'FEMALE' ? 'FEMALE' : 'UNKNOWN',
        reproductiveStatus: animal.isSpayedOrNeutered ? 'STERILIZED' : 'UNKNOWN',
        dateOfBirth: new Date(Date.now() - (animal.estimatedAgeYears || 2) * 365 * 86400000).toISOString().split('T')[0],
        birthdatePrecision: 'ESTIMATED_YEAR',
        estimatedBirthdate: true,
        primaryColor: animal.colorAndMarkings || 'Fawn',
        sizeClassification: animal.size || 'MEDIUM',
        lifecycleStage: 'ADULT',
        status: 'ACTIVE',
        createdBy: params.handoverOfficerUserId,
        createdAt: now,
        updatedAt: now,
        version: 1,
        metadata: {
          adoptionOrigin: 'RESCUE_INTAKE',
          rescueAnimalId: animal.rescueAnimalId,
          intakeCaseId: animal.intakeCaseId,
          photoUrl: animal.photoUrl,
        },
      };
      PetStore.savePet(newPet);

      if (animal.observedMicrochipNumber) {
        PetStore.saveMicrochip({
          microchipId: asMicrochipId(`chip_${generateUUIDv7()}`),
          petId: resultingPetId,
          microchipNumber: animal.observedMicrochipNumber,
          verificationStatus: 'VERIFIED',
          verifiedBy: params.handoverOfficerUserId,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const placement: AdoptionPlacement = {
      placementId,
      adoptionCaseId: params.adoptionCaseId,
      adopterUserId: app.applicantUserId,
      targetHouseholdId: params.targetHouseholdId,
      effectiveDate: now,
      resultingPetId,
      agreementReferenceId: params.agreementId,
      followUpScheduleDays: [2, 7, 30],
      status: 'COMPLETED',
      handoverCompletedAt: now,
      handoverOfficerUserId: params.handoverOfficerUserId,
      handoverNotes: params.handoverNotes,
      createdAt: now,
      updatedAt: now,
    };

    this.store.adoptionPlacements.set(placementId, placement);
    adoptionCase.status = 'ADOPTED';
    adoptionCase.activePlacementId = placementId;
    adoptionCase.updatedAt = now;

    animal.currentPlacementType = 'ADOPTION_PENDING'; // Now placed

    // Record Outcome
    const outcomeId = asRescueAnimalOutcomeId(generateUUIDv7());
    this.store.outcomes.set(outcomeId, {
      outcomeId,
      rescueAnimalId: animal.rescueAnimalId,
      organizationId: adoptionCase.organizationId,
      outcomeType: 'ADOPTED',
      outcomeDate: now,
      resultingHouseholdId: params.targetHouseholdId,
      resultingPetId,
      recordedByUserId: params.handoverOfficerUserId,
      notes: `Successfully placed with adopter ${app.applicantUserId}`,
      createdAt: now,
    });

    this.emitEvent('AdoptionPlacementCompleted', {
      placementId,
      adoptionCaseId: params.adoptionCaseId,
      adopterUserId: app.applicantUserId,
      targetHouseholdId: params.targetHouseholdId,
      resultingPetId,
      effectiveDate: now,
    });

    return placement;
  }

  public requestAdoptionReturn(params: {
    placementId: AdoptionPlacementId;
    adopterUserId: UserId;
    reasonCategory: 'INCOMPATIBILITY' | 'HOUSING_CHANGE' | 'CARE_CHALLENGE' | 'BEHAVIOR_CONCERN' | 'MEDICAL_COST' | 'OTHER';
    reasonDetails: string;
  }): AdoptionReturnCase {
    const placement = this.store.adoptionPlacements.get(params.placementId);
    if (!placement) throw new Error(`Placement ${params.placementId} not found`);
    if (placement.adopterUserId !== params.adopterUserId) {
      throw new Error(`Unauthorized: Only adopting user can initiate adoption return.`);
    }

    const adoptionCase = this.store.adoptionCases.get(placement.adoptionCaseId);
    if (!adoptionCase) throw new Error(`Adoption case ${placement.adoptionCaseId} not found`);

    const returnCaseId = asAdoptionReturnCaseId(generateUUIDv7());
    const now = new Date().toISOString();

    const returnCase: AdoptionReturnCase = {
      returnCaseId,
      adoptionCaseId: placement.adoptionCaseId,
      originalPlacementId: params.placementId,
      organizationId: adoptionCase.organizationId,
      adopterUserId: params.adopterUserId,
      reasonCategory: params.reasonCategory,
      reasonDetails: params.reasonDetails,
      requestedAt: now,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now,
    };

    this.store.adoptionReturns.set(returnCaseId, returnCase);

    this.emitEvent('AdoptionReturned', {
      returnCaseId,
      adoptionCaseId: placement.adoptionCaseId,
      organizationId: adoptionCase.organizationId,
      reasonCategory: params.reasonCategory,
      requestedAt: now,
    });

    return returnCase;
  }

  // ==========================================================================
  // 11. PUBLIC FOUND PET NOTICES (PRIVACY-SAFE)
  // ==========================================================================

  public publishFoundPetNotice(params: {
    intakeCaseId: AnimalIntakeCaseId;
    approximateFoundArea: string;
    photoUrl?: string;
    authorizedByUserId: UserId;
  }): PublicFoundPetProfile {
    const intakeCase = this.store.intakeCases.get(params.intakeCaseId);
    if (!intakeCase) throw new Error(`Intake case ${params.intakeCaseId} not found`);

    this.assertPermission(params.authorizedByUserId, intakeCase.organizationId, 'rescue.publication.manage');

    const animal = this.store.rescueAnimals.get(intakeCase.temporaryAnimalId);
    const org = this.store.organizations.get(intakeCase.organizationId);

    const publicFoundId = asPublicFoundPetProfileId(generateUUIDv7());
    const now = new Date().toISOString();

    const foundProfile: PublicFoundPetProfile = {
      publicFoundId,
      intakeCaseId: params.intakeCaseId,
      organizationId: intakeCase.organizationId,
      species: animal?.species ?? 'DOG',
      apparentBreed: animal?.apparentBreed,
      colorAndMarkings: animal?.colorAndMarkings ?? 'Unknown',
      approximateFoundArea: params.approximateFoundArea, // Coarse only!
      foundDate: intakeCase.intakeAt.split('T')[0],
      photoUrl: params.photoUrl ?? animal?.photoUrl,
      organizationName: org?.name ?? 'Animal Rescue',
      organizationContactPhone: org?.publicContactPhone ?? '+254-700-000-000',
      isActive: true,
      holdExpiresAt: intakeCase.holdExpiresAt,
      createdAt: now,
      updatedAt: now,
    };

    this.store.publicFoundPetProfiles.set(publicFoundId, foundProfile);
    return foundProfile;
  }

  // ==========================================================================
  // 12. FACTUAL RESCUE ANALYTICS
  // ==========================================================================

  public getOrganizationAnalytics(organizationId: RescueOrganizationId): {
    intakeCount: number;
    activeAnimalsInCare: number;
    reunificationsCount: number;
    fosterPlacementsCount: number;
    adoptionsCount: number;
    returnCount: number;
    welfareCasesCount: number;
  } {
    const intakes = Array.from(this.store.intakeCases.values()).filter(i => i.organizationId === organizationId);
    const animals = Array.from(this.store.rescueAnimals.values()).filter(a => a.organizationId === organizationId);
    const activeAnimals = animals.filter(a => a.currentPlacementType === 'SHELTER' || a.currentPlacementType === 'FOSTER');
    const reunifications = Array.from(this.store.outcomes.values()).filter(o => o.organizationId === organizationId && o.outcomeType === 'REUNITED');
    const adoptions = Array.from(this.store.outcomes.values()).filter(o => o.organizationId === organizationId && o.outcomeType === 'ADOPTED');
    const fosters = Array.from(this.store.fosterPlacements.values()).filter(f => f.organizationId === organizationId);
    const returns = Array.from(this.store.adoptionReturns.values()).filter(r => r.organizationId === organizationId);
    const welfare = Array.from(this.store.welfareCases.values()).filter(w => w.organizationId === organizationId);

    return {
      intakeCount: intakes.length,
      activeAnimalsInCare: activeAnimals.length,
      reunificationsCount: reunifications.length,
      fosterPlacementsCount: fosters.length,
      adoptionsCount: adoptions.length,
      returnCount: returns.length,
      welfareCasesCount: welfare.length,
    };
  }

  public getStore(): RescueStore {
    return this.store;
  }
}
