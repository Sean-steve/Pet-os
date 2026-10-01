/**
 * Pet OS Sprint 10 - Provider Platform & Service Marketplace Application Service
 * Enforces business logic, domain boundaries, state transitions, security, and read projections.
 */

import {
  UserId,
  ProviderId,
  BusinessId,
  BusinessMembershipId,
  CredentialId,
  VerificationCaseId,
  ServiceOfferingId,
  ServiceTypeId,
  LocationId,
  ServiceAreaId,
  AvailabilityRuleId,
  AvailabilityExceptionId,
  TrustIndicatorId,
  ProviderReportId,
  generateUUIDv7,
  asProviderId,
  asBusinessId,
  asBusinessMembershipId,
  asCredentialId,
  asVerificationCaseId,
  asServiceOfferingId,
  asLocationId,
  asServiceAreaId,
  asAvailabilityRuleId,
  asAvailabilityExceptionId,
  asTrustIndicatorId,
  asProviderReportId,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import { IdentityStore } from '../identity/store';
import {
  ProviderProfile,
  ServiceBusiness,
  BusinessMembership,
  ProviderCredential,
  VerificationCase,
  ServiceOffering,
  ServiceVariant,
  ProviderLocation,
  ServiceArea,
  ProviderAvailabilityRule,
  ProviderAvailabilityException,
  ProviderTrustIndicator,
  ProviderReport,
  PublicProviderProfile,
  PrivateProviderDashboard,
  BookingOfferingSnapshot,
  ProviderCategory,
  BusinessType,
  BusinessMemberRole,
  CredentialType,
  PricingModel,
  ServiceLocationType,
  LocationCategory,
  ServiceAreaType,
  ReportCategory,
  ProviderOperationalStatus,
  ProviderVisibilityStatus,
} from './types';
import { ProviderStore } from './store';
import { ProviderPolicyEngine, CATEGORY_VERIFICATION_RULES } from './policy';

export class ProviderPlatformService {
  private store: ProviderStore;

  constructor(
    store: ProviderStore = ProviderStore.getInstance()
  ) {
    this.store = store;
  }

  // -------------------------------------------------------------------------
  // Provider Profile Management
  // -------------------------------------------------------------------------

  /**
   * Registers a new professional provider profile linked to an authenticated user account
   */
  createProviderProfile(
    cmd: {
      displayName: string;
      professionalTitle?: string;
      category: ProviderCategory;
      bio: string;
      yearsOfExperience: number;
      languages: string[];
      avatarUrl?: string;
      visibilityStatus?: ProviderVisibilityStatus;
    },
    actorUserId: UserId
  ): ProviderProfile {
    // Assert user exists
    const user = IdentityStore.findUserById(actorUserId);
    if (!user) {
      throw new Error(`Authentication error: User ${actorUserId} not found.`);
    }

    // Check if user already has a provider profile
    const existing = this.store.getProviderByUserId(actorUserId);
    if (existing) {
      throw new Error(`Conflict: User ${actorUserId} already has an active provider profile (${existing.providerId}).`);
    }

    const now = new Date().toISOString();
    const providerId = asProviderId(`prv-${generateUUIDv7()}`);

    const profile: ProviderProfile = {
      providerId,
      userId: actorUserId,
      displayName: cmd.displayName.trim(),
      professionalTitle: cmd.professionalTitle?.trim(),
      category: cmd.category,
      bio: cmd.bio.trim(),
      yearsOfExperience: Math.max(0, cmd.yearsOfExperience),
      languages: cmd.languages.length > 0 ? cmd.languages : ['English'],
      avatarUrl: cmd.avatarUrl,
      verificationStatus: 'DRAFT',
      operationalStatus: 'ACTIVE',
      visibilityStatus: cmd.visibilityStatus || 'PUBLIC',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveProvider(profile);
    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.created',
      timestamp: now,
      actorUserId,
      providerId,
      userId: actorUserId,
      category: cmd.category,
      displayName: cmd.displayName,
    });

    return profile;
  }

  /**
   * Updates provider profile details
   */
  updateProviderProfile(
    cmd: {
      providerId: ProviderId;
      displayName?: string;
      professionalTitle?: string;
      bio?: string;
      yearsOfExperience?: number;
      languages?: string[];
      avatarUrl?: string;
      visibilityStatus?: ProviderVisibilityStatus;
    },
    actorUserId: UserId
  ): ProviderProfile {
    const profile = this.assertAuthorizedProviderAccess(cmd.providerId, actorUserId);
    const now = new Date().toISOString();

    const updated: ProviderProfile = {
      ...profile,
      displayName: cmd.displayName ? cmd.displayName.trim() : profile.displayName,
      professionalTitle: cmd.professionalTitle !== undefined ? cmd.professionalTitle.trim() : profile.professionalTitle,
      bio: cmd.bio !== undefined ? cmd.bio.trim() : profile.bio,
      yearsOfExperience: cmd.yearsOfExperience !== undefined ? Math.max(0, cmd.yearsOfExperience) : profile.yearsOfExperience,
      languages: cmd.languages !== undefined ? cmd.languages : profile.languages,
      avatarUrl: cmd.avatarUrl !== undefined ? cmd.avatarUrl : profile.avatarUrl,
      visibilityStatus: cmd.visibilityStatus !== undefined ? cmd.visibilityStatus : profile.visibilityStatus,
      updatedAt: now,
    };

    this.store.saveProvider(updated);
    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.profile_updated',
      timestamp: now,
      actorUserId,
      providerId: cmd.providerId,
      changes: cmd,
    });

    return updated;
  }

  /**
   * Toggles operational status (e.g., Temporarily Inactive for vacation / hiatus)
   */
  setOperationalStatus(
    providerId: ProviderId,
    status: ProviderOperationalStatus,
    actorUserId: UserId
  ): ProviderProfile {
    const profile = this.assertAuthorizedProviderAccess(providerId, actorUserId);
    if (!ProviderPolicyEngine.validateOperationalTransition(profile.operationalStatus, status)) {
      throw new Error(`Invalid operational transition from '${profile.operationalStatus}' to '${status}'.`);
    }

    const now = new Date().toISOString();
    const updated: ProviderProfile = {
      ...profile,
      operationalStatus: status,
      updatedAt: now,
    };

    this.store.saveProvider(updated);
    return updated;
  }

  // -------------------------------------------------------------------------
  // Credential & Verification Workflow
  // -------------------------------------------------------------------------

  /**
   * Attaches professional credentials (license, certification, insurance, government ID)
   */
  addCredential(
    cmd: {
      providerId: ProviderId;
      credentialType: CredentialType;
      title: string;
      issuingAuthority: string;
      identifierMasked: string;
      issuedDate: string;
      expiryDate?: string;
      evidenceDocumentUrl?: string;
    },
    actorUserId: UserId
  ): ProviderCredential {
    const profile = this.assertAuthorizedProviderAccess(cmd.providerId, actorUserId);
    const now = new Date().toISOString();
    const credentialId = asCredentialId(`crd-${generateUUIDv7()}`);

    const credential: ProviderCredential = {
      credentialId,
      providerId: profile.providerId,
      credentialType: cmd.credentialType,
      title: cmd.title.trim(),
      issuingAuthority: cmd.issuingAuthority.trim(),
      identifierMasked: cmd.identifierMasked.trim(),
      issuedDate: cmd.issuedDate,
      expiryDate: cmd.expiryDate,
      verificationStatus: 'PENDING',
      evidenceDocumentUrl: cmd.evidenceDocumentUrl,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveCredential(credential);
    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.credential_added',
      timestamp: now,
      actorUserId,
      providerId: profile.providerId,
      credentialId,
      credentialType: cmd.credentialType,
    });

    return credential;
  }

  /**
   * Submits verification dossier for official administrative / trust review
   */
  submitVerificationCase(
    providerId: ProviderId,
    credentialIds: CredentialId[],
    actorUserId: UserId
  ): VerificationCase {
    const profile = this.assertAuthorizedProviderAccess(providerId, actorUserId);

    if (credentialIds.length === 0) {
      throw new Error('Cannot submit verification without attaching at least one credential document.');
    }

    // Check readiness against category requirements
    const credentials = this.store.getCredentialsForProvider(providerId);
    const selectedCreds = credentials.filter(c => credentialIds.includes(c.credentialId));
    const readiness = ProviderPolicyEngine.evaluateVerificationReadiness(profile.category, selectedCreds);

    if (!readiness.isReadyToSubmit) {
      throw new Error(
        `Verification readiness check failed for ${profile.category}: Missing mandatory credentials [${readiness.missingMandatory.join(', ')}].`
      );
    }

    const now = new Date().toISOString();
    const caseId = asVerificationCaseId(`vcs-${generateUUIDv7()}`);

    const verificationCase: VerificationCase = {
      caseId,
      targetType: 'PROVIDER',
      providerId,
      applicantUserId: actorUserId,
      category: profile.category,
      status: 'SUBMITTED',
      submittedCredentialIds: credentialIds,
      submittedAt: now,
    };

    this.store.saveVerificationCase(verificationCase);

    // Transition provider status to PENDING_VERIFICATION
    const updatedProfile: ProviderProfile = {
      ...profile,
      verificationStatus: 'PENDING_VERIFICATION',
      updatedAt: now,
    };
    this.store.saveProvider(updatedProfile);

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.verification_submitted',
      timestamp: now,
      actorUserId,
      providerId,
      caseId,
      submittedCredentialCount: credentialIds.length,
    });

    return verificationCase;
  }

  /**
   * Reviews and decides on a verification case.
   * STRICT SECURITY RULE: Provider CANNOT approve their own verification!
   */
  reviewVerificationCase(
    cmd: {
      caseId: VerificationCaseId;
      decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFORMATION';
      notes?: string;
      rejectionReason?: string;
    },
    reviewerUserId: UserId
  ): VerificationCase {
    const caseRecord = this.store.getVerificationCase(cmd.caseId);
    if (!caseRecord) {
      throw new Error(`Verification case ${cmd.caseId} not found.`);
    }

    // MANDATORY SECURITY CHECK: NO SELF-REVIEW
    ProviderPolicyEngine.assertNotSelfReview(caseRecord.applicantUserId, reviewerUserId);

    const now = new Date().toISOString();
    const provider = caseRecord.providerId ? this.store.getProvider(caseRecord.providerId) : undefined;
    if (!provider) {
      throw new Error(`Linked provider profile not found for case ${cmd.caseId}.`);
    }

    if (cmd.decision === 'APPROVED') {
      caseRecord.status = 'APPROVED';
      caseRecord.reviewerUserId = reviewerUserId;
      caseRecord.internalNotes = cmd.notes;
      caseRecord.completedAt = now;

      // Update provider verification status to VERIFIED
      provider.verificationStatus = 'VERIFIED';
      provider.metadata = {
        ...provider.metadata,
        verifiedAt: now,
        rejectionReason: undefined,
      };
      provider.updatedAt = now;
      this.store.saveProvider(provider);

      // Mark submitted credentials as verified
      for (const credId of caseRecord.submittedCredentialIds) {
        const cred = this.store.getCredential(credId);
        if (cred) {
          cred.verificationStatus = 'VERIFIED';
          cred.verifiedAt = now;
          cred.verifiedByUserId = reviewerUserId;
          this.store.saveCredential(cred);

          this.store.publish({
            eventId: generateUUIDv7(),
            eventType: 'provider.credential_verified',
            timestamp: now,
            actorUserId: reviewerUserId,
            providerId: provider.providerId,
            credentialId: cred.credentialId,
            reviewerUserId,
          });
        }
      }

      // Automatically issue verified trust badges
      this.issueTrustBadges(provider, caseRecord.submittedCredentialIds, reviewerUserId);

      this.store.publish({
        eventId: generateUUIDv7(),
        eventType: 'provider.verified',
        timestamp: now,
        actorUserId: reviewerUserId,
        providerId: provider.providerId,
        caseId: caseRecord.caseId,
        reviewerUserId,
      });
    } else if (cmd.decision === 'REJECTED') {
      caseRecord.status = 'REJECTED';
      caseRecord.reviewerUserId = reviewerUserId;
      caseRecord.rejectionReason = cmd.rejectionReason || 'Dossier did not meet verification standards.';
      caseRecord.internalNotes = cmd.notes;
      caseRecord.completedAt = now;

      provider.verificationStatus = 'REJECTED';
      provider.metadata = {
        ...provider.metadata,
        rejectionReason: cmd.rejectionReason,
      };
      provider.updatedAt = now;
      this.store.saveProvider(provider);

      this.store.publish({
        eventId: generateUUIDv7(),
        eventType: 'provider.verification_rejected',
        timestamp: now,
        actorUserId: reviewerUserId,
        providerId: provider.providerId,
        caseId: caseRecord.caseId,
        reviewerUserId,
        rejectionReason: cmd.rejectionReason || 'Rejected',
      });
    } else {
      // NEEDS_INFORMATION
      caseRecord.status = 'NEEDS_INFORMATION';
      caseRecord.reviewerUserId = reviewerUserId;
      caseRecord.internalNotes = cmd.notes;
      caseRecord.reviewedAt = now;

      provider.verificationStatus = 'NEEDS_INFORMATION';
      provider.metadata = {
        ...provider.metadata,
        rejectionReason: cmd.notes,
      };
      provider.updatedAt = now;
      this.store.saveProvider(provider);
    }

    this.store.saveVerificationCase(caseRecord);
    return caseRecord;
  }

  /**
   * Suspends a provider due to safety report or policy infraction.
   * Automatically disables operational availability and live offerings.
   */
  suspendProvider(
    providerId: ProviderId,
    reason: string,
    reviewerUserId: UserId
  ): ProviderProfile {
    const provider = this.store.getProvider(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found.`);

    ProviderPolicyEngine.assertNotSelfReview(provider.userId, reviewerUserId);

    const now = new Date().toISOString();
    provider.verificationStatus = 'SUSPENDED';
    provider.operationalStatus = 'SUSPENDED';
    provider.metadata = {
      ...provider.metadata,
      suspensionReason: reason,
      suspendedAt: now,
    };
    provider.updatedAt = now;
    this.store.saveProvider(provider);

    // Pause all published offerings
    const offerings = this.store.getServiceOfferingsForProvider(providerId);
    for (const offering of offerings) {
      if (offering.status === 'ACTIVE') {
        offering.status = 'SUSPENDED';
        offering.updatedAt = now;
        this.store.saveServiceOffering(offering);
      }
    }

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.suspended',
      timestamp: now,
      actorUserId: reviewerUserId,
      providerId,
      reason,
      reviewerUserId,
    });

    return provider;
  }

  /**
   * Reinstates a suspended provider following trust resolution
   */
  reinstateProvider(providerId: ProviderId, reviewerUserId: UserId): ProviderProfile {
    const provider = this.store.getProvider(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found.`);

    ProviderPolicyEngine.assertNotSelfReview(provider.userId, reviewerUserId);

    const now = new Date().toISOString();
    provider.verificationStatus = 'VERIFIED';
    provider.operationalStatus = 'ACTIVE';
    provider.metadata = {
      ...provider.metadata,
      suspensionReason: undefined,
      suspendedAt: undefined,
    };
    provider.updatedAt = now;
    this.store.saveProvider(provider);

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.reinstated',
      timestamp: now,
      actorUserId: reviewerUserId,
      providerId,
      reviewerUserId,
    });

    return provider;
  }

  /**
   * Periodically checks credential expiries and downgrades status if mandatory credentials lapse
   */
  checkAndProcessCredentialExpiries(currentTime: string = new Date().toISOString()): {
    expiredCount: number;
    restrictedProviders: ProviderId[];
  } {
    let expiredCount = 0;
    const restrictedProviders: ProviderId[] = [];

    const providers = this.store.listProviders();
    for (const provider of providers) {
      const creds = this.store.getCredentialsForProvider(provider.providerId);
      let providerHasExpired = false;

      for (const cred of creds) {
        if (cred.expiryDate && cred.expiryDate < currentTime && cred.verificationStatus !== 'EXPIRED') {
          cred.verificationStatus = 'EXPIRED';
          cred.updatedAt = currentTime;
          this.store.saveCredential(cred);
          expiredCount++;
          providerHasExpired = true;

          this.store.publish({
            eventId: generateUUIDv7(),
            eventType: 'provider.credential_expired',
            timestamp: currentTime,
            actorUserId: provider.userId,
            providerId: provider.providerId,
            credentialId: cred.credentialId,
            credentialType: cred.credentialType,
          });
        }
      }

      if (providerHasExpired && provider.verificationStatus === 'VERIFIED') {
        const readiness = ProviderPolicyEngine.evaluateVerificationReadiness(provider.category, creds, currentTime);
        if (readiness.missingMandatory.length > 0 || readiness.expiredCredentials.length > 0) {
          provider.operationalStatus = 'RESTRICTED';
          provider.updatedAt = currentTime;
          this.store.saveProvider(provider);
          restrictedProviders.push(provider.providerId);
        }
      }
    }

    return { expiredCount, restrictedProviders };
  }

  private issueTrustBadges(
    provider: ProviderProfile,
    credentialIds: CredentialId[],
    reviewerUserId: UserId
  ): void {
    const now = new Date().toISOString();
    const creds = this.store.getCredentialsForProvider(provider.providerId)
      .filter(c => credentialIds.includes(c.credentialId));

    for (const cred of creds) {
      let badgeType: ProviderTrustIndicator['badgeType'] | undefined;
      let title = '';
      let explanation = '';

      if (cred.credentialType === 'GOVERNMENT_ID') {
        badgeType = 'IDENTITY_VERIFIED';
        title = 'Identity Verified';
        explanation = 'Government photo identification validated against official registry.';
      } else if (cred.credentialType === 'VETERINARY_LICENSE') {
        badgeType = 'PROFESSIONAL_LICENSE_VERIFIED';
        title = 'Veterinary License Verified';
        explanation = `Board registration license ${cred.identifierMasked} verified with state veterinary council.`;
      } else if (cred.credentialType === 'TRAINER_CERTIFICATION') {
        badgeType = 'PROFESSIONAL_LICENSE_VERIFIED';
        title = 'Certified Behaviorist / Trainer';
        explanation = `Credentials verified through ${cred.issuingAuthority}.`;
      } else if (cred.credentialType === 'COMMERCIAL_LIABILITY_INSURANCE') {
        badgeType = 'INSURANCE_VERIFIED';
        title = 'Commercial Liability Insured';
        explanation = `Active policy verified through ${cred.issuingAuthority}.`;
      } else if (cred.credentialType === 'BACKGROUND_CHECK') {
        badgeType = 'BACKGROUND_CHECK_CLEARED';
        title = 'Criminal Background Check Cleared';
        explanation = 'Clean criminal background record clearance verified.';
      }

      if (badgeType) {
        const indicatorId = asTrustIndicatorId(`tst-${generateUUIDv7()}`);
        const indicator: ProviderTrustIndicator = {
          indicatorId,
          providerId: provider.providerId,
          businessId: provider.primaryBusinessId,
          badgeType,
          title,
          issuedAt: now,
          verifiedByUserId: reviewerUserId,
          explanation,
          linkedCredentialId: cred.credentialId,
          isValid: true,
        };
        this.store.saveTrustIndicator(indicator);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Service Catalogue & Offerings Management
  // -------------------------------------------------------------------------

  /**
   * Creates a service offering in DRAFT mode
   */
  createServiceOffering(
    cmd: {
      providerId: ProviderId;
      businessId?: BusinessId;
      serviceTypeId: ServiceTypeId;
      title: string;
      description: string;
      category: ProviderCategory;
      pricingModel: PricingModel;
      basePriceMinorUnits: number; // Integer minor units (e.g. 1500 for $15.00)
      currency?: CurrencyCode;
      defaultDurationMinutes: number;
      locationTypes: ServiceLocationType[];
      targetSpecies?: string[];
      sizeRestrictions?: string[];
      variants?: ServiceVariant[];
      prerequisites?: string[];
      maxPetsPerBooking?: number;
    },
    actorUserId: UserId
  ): ServiceOffering {
    const profile = this.assertAuthorizedProviderAccess(cmd.providerId, actorUserId);
    new Money(cmd.basePriceMinorUnits, cmd.currency || 'KES'); // Validates integer

    const now = new Date().toISOString();
    const serviceOfferingId = asServiceOfferingId(`sro-${generateUUIDv7()}`);

    const offering: ServiceOffering = {
      serviceOfferingId,
      providerId: profile.providerId,
      businessId: cmd.businessId || profile.primaryBusinessId,
      serviceTypeId: cmd.serviceTypeId,
      title: cmd.title.trim(),
      description: cmd.description.trim(),
      category: cmd.category,
      status: 'DRAFT',
      pricingModel: cmd.pricingModel,
      basePriceMinorUnits: cmd.basePriceMinorUnits,
      currency: cmd.currency || 'KES',
      defaultDurationMinutes: Math.max(5, cmd.defaultDurationMinutes),
      locationTypes: cmd.locationTypes,
      targetSpecies: cmd.targetSpecies && cmd.targetSpecies.length > 0 ? cmd.targetSpecies : ['DOG'],
      sizeRestrictions: cmd.sizeRestrictions,
      variants: cmd.variants || [],
      prerequisites: cmd.prerequisites,
      maxPetsPerBooking: cmd.maxPetsPerBooking || 1,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveServiceOffering(offering);
    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'service_offering.created',
      timestamp: now,
      actorUserId,
      providerId: profile.providerId,
      serviceOfferingId,
      title: offering.title,
      category: offering.category,
    });

    return offering;
  }

  /**
   * Activates a service offering.
   * MANDATORY POLICY CHECK: Only VERIFIED & ACTIVE providers may activate services!
   */
  activateServiceOffering(
    serviceOfferingId: ServiceOfferingId,
    actorUserId: UserId
  ): ServiceOffering {
    const offering = this.store.getServiceOffering(serviceOfferingId);
    if (!offering) throw new Error(`Service offering ${serviceOfferingId} not found.`);

    const profile = this.assertAuthorizedProviderAccess(offering.providerId, actorUserId);
    const credentials = this.store.getCredentialsForProvider(offering.providerId);

    // Enforce activation eligibility check
    const check = ProviderPolicyEngine.canActivateOffering(profile, credentials);
    if (!check.allowed) {
      throw new Error(`Service activation blocked: ${check.reason}`);
    }

    const now = new Date().toISOString();
    offering.status = 'ACTIVE';
    offering.updatedAt = now;
    this.store.saveServiceOffering(offering);

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'service_offering.activated',
      timestamp: now,
      actorUserId,
      providerId: profile.providerId,
      serviceOfferingId,
    });

    return offering;
  }

  /**
   * Pauses an active service offering
   */
  pauseServiceOffering(
    serviceOfferingId: ServiceOfferingId,
    actorUserId: UserId
  ): ServiceOffering {
    const offering = this.store.getServiceOffering(serviceOfferingId);
    if (!offering) throw new Error(`Service offering ${serviceOfferingId} not found.`);

    const profile = this.assertAuthorizedProviderAccess(offering.providerId, actorUserId);
    const now = new Date().toISOString();
    offering.status = 'PAUSED';
    offering.updatedAt = now;
    this.store.saveServiceOffering(offering);

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'service_offering.paused',
      timestamp: now,
      actorUserId,
      providerId: profile.providerId,
      serviceOfferingId,
    });

    return offering;
  }

  // -------------------------------------------------------------------------
  // Operating Locations & Service Coverage Areas
  // -------------------------------------------------------------------------

  /**
   * Adds an operating location (clinic, facility, or private home base)
   */
  addLocation(
    cmd: {
      providerId?: ProviderId;
      businessId?: BusinessId;
      name: string;
      category: LocationCategory;
      isPublicAddress: boolean;
      fullAddressPrivate: string;
      addressLine1Masked?: string;
      city: string;
      stateOrRegion: string;
      postalCode?: string;
      country: string;
      coordinates: { lat: number; lng: number };
      timezone: string;
      isPrimary?: boolean;
    },
    actorUserId: UserId
  ): ProviderLocation {
    const now = new Date().toISOString();
    const locationId = asLocationId(`loc-${generateUUIDv7()}`);

    // Mask address if private residence
    let masked = cmd.addressLine1Masked;
    if (!cmd.isPublicAddress && !masked) {
      masked = `${cmd.city}, ${cmd.stateOrRegion}`; // shields exact street number
    }

    const loc: ProviderLocation = {
      locationId,
      providerId: cmd.providerId,
      businessId: cmd.businessId,
      name: cmd.name.trim(),
      category: cmd.category,
      isPublicAddress: cmd.isPublicAddress,
      addressLine1Masked: masked || cmd.fullAddressPrivate,
      fullAddressPrivate: cmd.fullAddressPrivate,
      city: cmd.city,
      stateOrRegion: cmd.stateOrRegion,
      postalCode: cmd.postalCode,
      country: cmd.country,
      coordinates: cmd.coordinates,
      timezone: cmd.timezone || 'Africa/Nairobi',
      isPrimary: cmd.isPrimary || false,
      createdAt: now,
    };

    this.store.saveLocation(loc);
    return loc;
  }

  /**
   * Adds a geographic coverage area for mobile / in-home service dispatch
   */
  addServiceArea(
    cmd: {
      providerId: ProviderId;
      businessId?: BusinessId;
      name: string;
      areaType: ServiceAreaType;
      centerLocationId?: LocationId;
      radiusKm?: number;
      postalCodes?: string[];
      districtName?: string;
    },
    actorUserId: UserId
  ): ServiceArea {
    this.assertAuthorizedProviderAccess(cmd.providerId, actorUserId);
    const now = new Date().toISOString();
    const serviceAreaId = asServiceAreaId(`sra-${generateUUIDv7()}`);

    const area: ServiceArea = {
      serviceAreaId,
      providerId: cmd.providerId,
      businessId: cmd.businessId,
      name: cmd.name.trim(),
      areaType: cmd.areaType,
      centerLocationId: cmd.centerLocationId,
      radiusKm: cmd.radiusKm,
      postalCodes: cmd.postalCodes,
      districtName: cmd.districtName,
      isActive: true,
      createdAt: now,
    };

    this.store.saveServiceArea(area);
    return area;
  }

  // -------------------------------------------------------------------------
  // Availability & Scheduling
  // -------------------------------------------------------------------------

  /**
   * Sets weekly repeating availability rules
   */
  setAvailabilityRules(
    providerId: ProviderId,
    rules: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      timezone: string;
      serviceOfferingId?: ServiceOfferingId;
      maxConcurrentCapacity: number;
    }>,
    actorUserId: UserId
  ): ProviderAvailabilityRule[] {
    this.assertAuthorizedProviderAccess(providerId, actorUserId);

    // Remove existing rules
    const existing = this.store.getAvailabilityRulesForProvider(providerId);
    for (const r of existing) {
      this.store.deleteAvailabilityRule(r.ruleId);
    }

    const created: ProviderAvailabilityRule[] = [];
    for (const r of rules) {
      const ruleId = asAvailabilityRuleId(`avr-${generateUUIDv7()}`);
      const rule: ProviderAvailabilityRule = {
        ruleId,
        providerId,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        timezone: r.timezone || 'Africa/Nairobi',
        serviceOfferingId: r.serviceOfferingId,
        maxConcurrentCapacity: Math.max(1, r.maxConcurrentCapacity),
        isActive: true,
      };
      this.store.saveAvailabilityRule(rule);
      created.push(rule);
    }

    return created;
  }

  /**
   * Adds an availability exception (vacation, time-off, public holiday)
   */
  addAvailabilityException(
    cmd: {
      providerId: ProviderId;
      startDate: string;
      endDate: string;
      startTime?: string;
      endTime?: string;
      isAllDay: boolean;
      type: 'TIME_OFF' | 'PUBLIC_HOLIDAY' | 'BUSINESS_CLOSURE' | 'SPECIAL_HOURS';
      reason: string;
    },
    actorUserId: UserId
  ): ProviderAvailabilityException {
    this.assertAuthorizedProviderAccess(cmd.providerId, actorUserId);
    const now = new Date().toISOString();
    const exceptionId = asAvailabilityExceptionId(`ave-${generateUUIDv7()}`);

    const exception: ProviderAvailabilityException = {
      exceptionId,
      providerId: cmd.providerId,
      startDate: cmd.startDate,
      endDate: cmd.endDate,
      startTime: cmd.startTime,
      endTime: cmd.endTime,
      isAllDay: cmd.isAllDay,
      type: cmd.type,
      reason: cmd.reason.trim(),
      createdAt: now,
    };

    this.store.saveAvailabilityException(exception);
    return exception;
  }

  // -------------------------------------------------------------------------
  // Business Organization & Team Management
  // -------------------------------------------------------------------------

  /**
   * Creates a formal business entity (e.g. Clinic, Academy, Salon)
   */
  createBusiness(
    cmd: {
      legalName: string;
      tradingName: string;
      businessType: BusinessType;
      registrationNumber?: string;
      contactEmail: string;
      contactPhone: string;
      websiteUrl?: string;
    },
    ownerUserId: UserId
  ): ServiceBusiness {
    const user = IdentityStore.findUserById(ownerUserId);
    if (!user) throw new Error(`User ${ownerUserId} not found.`);

    const now = new Date().toISOString();
    const businessId = asBusinessId(`biz-${generateUUIDv7()}`);

    const business: ServiceBusiness = {
      businessId,
      legalName: cmd.legalName.trim(),
      tradingName: cmd.tradingName.trim(),
      businessType: cmd.businessType,
      registrationNumber: cmd.registrationNumber,
      ownerUserId,
      verificationStatus: 'UNVERIFIED',
      isActive: true,
      contactEmail: cmd.contactEmail.trim(),
      contactPhone: cmd.contactPhone.trim(),
      websiteUrl: cmd.websiteUrl?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveBusiness(business);

    // Add owner as business member
    const membershipId = asBusinessMembershipId(`bzm-${generateUUIDv7()}`);
    const membership: BusinessMembership = {
      membershipId,
      businessId,
      userId: ownerUserId,
      role: 'OWNER',
      isActive: true,
      canManageServices: true,
      canManageSchedule: true,
      joinedAt: now,
      updatedAt: now,
    };
    this.store.saveBusinessMembership(membership);

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'business.created',
      timestamp: now,
      actorUserId: ownerUserId,
      businessId,
      tradingName: business.tradingName,
      ownerUserId,
    });

    return business;
  }

  /**
   * Adds a staff member or provider to a business team
   */
  addBusinessMember(
    cmd: {
      businessId: BusinessId;
      targetUserId: UserId;
      providerId?: ProviderId;
      role: BusinessMemberRole;
      canManageServices?: boolean;
      canManageSchedule?: boolean;
    },
    actorUserId: UserId
  ): BusinessMembership {
    // Check actor is business owner or admin
    this.assertAuthorizedBusinessManager(cmd.businessId, actorUserId);

    const now = new Date().toISOString();
    const membershipId = asBusinessMembershipId(`bzm-${generateUUIDv7()}`);

    const membership: BusinessMembership = {
      membershipId,
      businessId: cmd.businessId,
      userId: cmd.targetUserId,
      providerId: cmd.providerId,
      role: cmd.role,
      isActive: true,
      canManageServices: cmd.canManageServices ?? (cmd.role === 'OWNER' || cmd.role === 'ADMIN'),
      canManageSchedule: cmd.canManageSchedule ?? true,
      joinedAt: now,
      updatedAt: now,
    };

    this.store.saveBusinessMembership(membership);

    // If target is a provider, update their primaryBusinessId
    if (cmd.providerId) {
      const p = this.store.getProvider(cmd.providerId);
      if (p && !p.primaryBusinessId) {
        p.primaryBusinessId = cmd.businessId;
        p.updatedAt = now;
        this.store.saveProvider(p);
      }
    }

    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'business.member_added',
      timestamp: now,
      actorUserId,
      businessId: cmd.businessId,
      memberUserId: cmd.targetUserId,
      role: cmd.role,
    });

    return membership;
  }

  // -------------------------------------------------------------------------
  // Trust & Safety Reports
  // -------------------------------------------------------------------------

  /**
   * Submits a trust & safety incident or profile inaccuracy report
   */
  submitReport(
    cmd: {
      targetProviderId?: ProviderId;
      targetBusinessId?: BusinessId;
      category: ReportCategory;
      description: string;
      evidenceDocumentUrls?: string[];
    },
    reporterUserId: UserId
  ): ProviderReport {
    const now = new Date().toISOString();
    const reportId = asProviderReportId(`rep-${generateUUIDv7()}`);

    const report: ProviderReport = {
      reportId,
      reporterUserId,
      targetProviderId: cmd.targetProviderId,
      targetBusinessId: cmd.targetBusinessId,
      category: cmd.category,
      description: cmd.description.trim(),
      evidenceDocumentUrls: cmd.evidenceDocumentUrls,
      status: 'OPEN',
      createdAt: now,
    };

    this.store.saveReport(report);
    this.store.publish({
      eventId: generateUUIDv7(),
      eventType: 'provider.report_submitted',
      timestamp: now,
      actorUserId: reporterUserId,
      reportId,
      targetProviderId: cmd.targetProviderId,
      category: cmd.category,
    });

    return report;
  }

  /**
   * Resolves a trust & safety report
   */
  resolveReport(
    reportId: ProviderReportId,
    status: 'RESOLVED' | 'DISMISSED' | 'ACTION_REQUIRED',
    notes: string,
    reviewerUserId: UserId
  ): ProviderReport {
    const report = this.store.getReport(reportId);
    if (!report) throw new Error(`Report ${reportId} not found.`);

    const now = new Date().toISOString();
    report.status = status;
    report.assignedReviewerUserId = reviewerUserId;
    report.resolutionNotes = notes;
    report.resolvedAt = now;

    this.store.saveReport(report);
    return report;
  }

  // -------------------------------------------------------------------------
  // Read Projections: Public vs Private Segregation
  // -------------------------------------------------------------------------

  /**
   * Public marketplace projection.
   * Completely sanitized: zero credential numbers, no personal residential street address,
   * no internal review notes, no linked account credentials.
   */
  getPublicProviderProfile(providerId: ProviderId): PublicProviderProfile | null {
    const provider = this.store.getProvider(providerId);
    if (!provider) return null;

    // Must be discoverable or requested directly
    const offerings = this.store.getServiceOfferingsForProvider(providerId);
    const activeOfferings = offerings
      .filter(o => o.status === 'ACTIVE')
      .map(o => ({
        serviceOfferingId: o.serviceOfferingId,
        title: o.title,
        description: o.description,
        category: o.category,
        pricingModel: o.pricingModel,
        basePriceMinorUnits: o.basePriceMinorUnits,
        currency: o.currency,
        defaultDurationMinutes: o.defaultDurationMinutes,
        locationTypes: o.locationTypes,
        targetSpecies: o.targetSpecies,
        variants: o.variants,
      }));

    const trustBadges = this.store.getTrustIndicatorsForProvider(providerId)
      .map(t => ({
        badgeType: t.badgeType,
        title: t.title,
        explanation: t.explanation,
        issuedAt: t.issuedAt,
      }));

    const serviceAreas = this.store.getServiceAreasForProvider(providerId)
      .map(a => ({
        name: a.name,
        areaType: a.areaType,
        radiusKm: a.radiusKm,
        districtName: a.districtName,
      }));

    const publicLocations = this.store.getLocationsForProvider(providerId)
      .filter(l => l.isPublicAddress) // Only public clinics/facilities
      .map(l => ({
        locationId: l.locationId,
        name: l.name,
        category: l.category,
        city: l.city,
        stateOrRegion: l.stateOrRegion,
        country: l.country,
        coordinates: l.coordinates,
        timezone: l.timezone,
      }));

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const availabilityRules = this.store.getAvailabilityRulesForProvider(providerId);
    const operatingHoursSummary = availabilityRules.map(r => ({
      dayOfWeek: r.dayOfWeek,
      dayName: days[r.dayOfWeek] || 'Unknown',
      startTime: r.startTime,
      endTime: r.endTime,
      timezone: r.timezone,
    }));

    let primaryBusiness: PublicProviderProfile['primaryBusiness'] = undefined;
    if (provider.primaryBusinessId) {
      const b = this.store.getBusiness(provider.primaryBusinessId);
      if (b && b.isActive) {
        primaryBusiness = {
          businessId: b.businessId,
          tradingName: b.tradingName,
          businessType: b.businessType,
        };
      }
    }

    return {
      providerId: provider.providerId,
      displayName: provider.displayName,
      professionalTitle: provider.professionalTitle,
      category: provider.category,
      bio: provider.bio,
      yearsOfExperience: provider.yearsOfExperience,
      languages: provider.languages,
      avatarUrl: provider.avatarUrl,
      verificationStatus: provider.verificationStatus,
      primaryBusiness,
      trustIndicators: trustBadges,
      activeOfferings,
      serviceAreas,
      publicLocations,
      operatingHoursSummary,
    };
  }

  /**
   * Private operational dashboard projection.
   * Full data model accessible only to the provider themselves, business managers, or admin.
   */
  getPrivateProviderDashboard(
    providerId: ProviderId,
    actorUserId: UserId
  ): PrivateProviderDashboard {
    const provider = this.assertAuthorizedProviderAccess(providerId, actorUserId);
    const credentials = this.store.getCredentialsForProvider(providerId);
    const verificationCases = this.store.getVerificationCasesForProvider(providerId);
    const offerings = this.store.getServiceOfferingsForProvider(providerId);
    const locations = this.store.getLocationsForProvider(providerId);
    const serviceAreas = this.store.getServiceAreasForProvider(providerId);
    const availabilityRules = this.store.getAvailabilityRulesForProvider(providerId);
    const availabilityExceptions = this.store.getAvailabilityExceptionsForProvider(providerId);
    const trustIndicators = this.store.getTrustIndicatorsForProvider(providerId);
    const reports = this.store.getReportsForProvider(providerId);

    const memberships = this.store.getUserBusinessMemberships(provider.userId);
    let primaryBusiness: ServiceBusiness | undefined;
    if (provider.primaryBusinessId) {
      primaryBusiness = this.store.getBusiness(provider.primaryBusinessId);
    }

    const activationEligibility = ProviderPolicyEngine.canActivateOffering(provider, credentials);
    const directoryEligibility = ProviderPolicyEngine.canBePubliclyListed(provider, offerings);

    return {
      profile: provider,
      linkedUser: { userId: provider.userId },
      businessMemberships: memberships,
      primaryBusiness,
      credentials,
      verificationCases,
      offerings,
      locations,
      serviceAreas,
      availabilityRules,
      availabilityExceptions,
      trustIndicators,
      activeReportsCount: reports.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length,
      eligibilityToActivateServices: {
        isEligible: activationEligibility.allowed,
        missingPrerequisites: activationEligibility.reason ? [activationEligibility.reason] : [],
      },
      eligibilityForPublicDirectory: {
        isEligible: directoryEligibility.eligible,
        missingPrerequisites: directoryEligibility.missingPrerequisites,
      },
    };
  }

  /**
   * Search discoverable providers in the public marketplace
   */
  searchDiscoverableProviders(query?: {
    category?: ProviderCategory;
    species?: string;
    city?: string;
  }): PublicProviderProfile[] {
    const providers = this.store.listProviders({ category: query?.category, activeOnly: true });
    const results: PublicProviderProfile[] = [];

    for (const p of providers) {
      const offerings = this.store.getServiceOfferingsForProvider(p.providerId);
      const isPubliclyListable = ProviderPolicyEngine.canBePubliclyListed(p, offerings);

      if (isPubliclyListable.eligible) {
        const publicProfile = this.getPublicProviderProfile(p.providerId);
        if (publicProfile) {
          if (query?.species) {
            const matchesSpecies = publicProfile.activeOfferings.some(o =>
              o.targetSpecies.includes(query.species!)
            );
            if (!matchesSpecies) continue;
          }
          results.push(publicProfile);
        }
      }
    }

    return results;
  }

  /**
   * Future Integration Contract: Creates an immutable booking snapshot of an offering
   */
  getBookingSnapshot(
    offeringId: ServiceOfferingId,
    variantId?: string
  ): BookingOfferingSnapshot {
    const offering = this.store.getServiceOffering(offeringId);
    if (!offering) throw new Error(`Service offering ${offeringId} not found.`);
    if (offering.status !== 'ACTIVE') {
      throw new Error(`Cannot book offering: status is '${offering.status}'. Must be 'ACTIVE'.`);
    }

    let price = offering.basePriceMinorUnits;
    let duration = offering.defaultDurationMinutes;
    let variantTitle: string | undefined;

    if (variantId) {
      const v = offering.variants.find(item => item.variantId === variantId);
      if (!v) throw new Error(`Variant ${variantId} not found on offering ${offeringId}.`);
      price = v.priceMinorUnits;
      duration = v.durationMinutes;
      variantTitle = v.title;
    }

    return {
      serviceOfferingId: offering.serviceOfferingId,
      providerId: offering.providerId,
      businessId: offering.businessId,
      title: offering.title,
      category: offering.category,
      variantId,
      variantTitle,
      durationMinutes: duration,
      priceMinorUnits: price,
      currency: offering.currency,
      pricingModel: offering.pricingModel,
      locationType: offering.locationTypes[0] || 'CLIENT_LOCATION',
      snapshotTimestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Authorization Guards
  // -------------------------------------------------------------------------

  private assertAuthorizedProviderAccess(providerId: ProviderId, actorUserId: UserId): ProviderProfile {
    const provider = this.store.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider profile ${providerId} not found.`);
    }

    // Direct owner check
    if (provider.userId === actorUserId) {
      return provider;
    }

    // Business manager check (if provider belongs to a business managed by actor)
    if (provider.primaryBusinessId) {
      const memberships = this.store.getBusinessMemberships(provider.primaryBusinessId);
      const actorMember = memberships.find(m => m.userId === actorUserId);
      if (actorMember && (actorMember.role === 'OWNER' || actorMember.role === 'ADMIN' || actorMember.role === 'MANAGER')) {
        return provider;
      }
    }

    throw new Error(
      `Access denied: Actor ${actorUserId} is not authorized to manage provider profile ${providerId}.`
    );
  }

  private assertAuthorizedBusinessManager(businessId: BusinessId, actorUserId: UserId): ServiceBusiness {
    const business = this.store.getBusiness(businessId);
    if (!business) {
      throw new Error(`Business ${businessId} not found.`);
    }

    if (business.ownerUserId === actorUserId) {
      return business;
    }

    const memberships = this.store.getBusinessMemberships(businessId);
    const actorMember = memberships.find(m => m.userId === actorUserId);
    if (actorMember && (actorMember.role === 'OWNER' || actorMember.role === 'ADMIN')) {
      return business;
    }

    throw new Error(
      `Access denied: Actor ${actorUserId} is not an owner or admin of business ${businessId}.`
    );
  }
}
