/**
 * Pet OS Sprint 10 - Provider Verification & Marketplace Policy Engine
 * Implements Volume XII & Volume XXVIII:
 * - Category-specific credential requirements
 * - Operational vs Verification status guards
 * - Strict prohibition against self-verification
 * - Credential validity & expiry checks
 * - Standard taxonomy definitions
 */

import {
  ProviderCategory,
  ProviderVerificationStatus,
  ProviderOperationalStatus,
  CredentialType,
  ProviderCredential,
  ProviderProfile,
  ServiceOffering,
  ServiceTypeDefinition,
} from './types';
import { UserId, asServiceTypeId } from '../kernel/ids';

export interface CategoryVerificationRule {
  category: ProviderCategory;
  displayName: string;
  mandatoryCredentialTypes: CredentialType[];
  recommendedCredentialTypes: CredentialType[];
  requiresActiveInsurance: boolean;
  minYearsExperience: number;
}

export const CATEGORY_VERIFICATION_RULES: Record<ProviderCategory, CategoryVerificationRule> = {
  VETERINARIAN: {
    category: 'VETERINARIAN',
    displayName: 'Veterinarian (DVM / BVSc)',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'VETERINARY_LICENSE'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE'],
    requiresActiveInsurance: true,
    minYearsExperience: 1,
  },
  VETERINARY_TECHNICIAN: {
    category: 'VETERINARY_TECHNICIAN',
    displayName: 'Veterinary Technician / Nurse',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'VET_TECH_CERTIFICATION'],
    recommendedCredentialTypes: ['PET_FIRST_AID_CERTIFICATION'],
    requiresActiveInsurance: false,
    minYearsExperience: 0,
  },
  DOG_WALKER: {
    category: 'DOG_WALKER',
    displayName: 'Professional Dog Walker',
    mandatoryCredentialTypes: ['GOVERNMENT_ID'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE', 'PET_FIRST_AID_CERTIFICATION', 'BACKGROUND_CHECK'],
    requiresActiveInsurance: true,
    minYearsExperience: 0,
  },
  TRAINER: {
    category: 'TRAINER',
    displayName: 'Animal Behaviorist & Trainer',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'TRAINER_CERTIFICATION'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE', 'PET_FIRST_AID_CERTIFICATION'],
    requiresActiveInsurance: false,
    minYearsExperience: 1,
  },
  GROOMER: {
    category: 'GROOMER',
    displayName: 'Professional Pet Groomer',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'ANIMAL_HANDLING_CERTIFICATION'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE', 'BUSINESS_REGISTRATION'],
    requiresActiveInsurance: false,
    minYearsExperience: 0,
  },
  PET_SITTER: {
    category: 'PET_SITTER',
    displayName: 'In-Home Pet Sitter',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'BACKGROUND_CHECK'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE', 'PET_FIRST_AID_CERTIFICATION'],
    requiresActiveInsurance: false,
    minYearsExperience: 0,
  },
  BOARDING_PROVIDER: {
    category: 'BOARDING_PROVIDER',
    displayName: 'Boarding Facility Operator',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'BUSINESS_REGISTRATION', 'COMMERCIAL_LIABILITY_INSURANCE'],
    recommendedCredentialTypes: ['PET_FIRST_AID_CERTIFICATION'],
    requiresActiveInsurance: true,
    minYearsExperience: 1,
  },
  DAYCARE_PROVIDER: {
    category: 'DAYCARE_PROVIDER',
    displayName: 'Daycare Center Operator',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'BUSINESS_REGISTRATION', 'COMMERCIAL_LIABILITY_INSURANCE'],
    recommendedCredentialTypes: ['ANIMAL_HANDLING_CERTIFICATION'],
    requiresActiveInsurance: true,
    minYearsExperience: 1,
  },
  PET_TRANSPORT: {
    category: 'PET_TRANSPORT',
    displayName: 'Pet Transport / Pet Taxi',
    mandatoryCredentialTypes: ['GOVERNMENT_ID', 'SPECIALIZED_TRANSPORT_PERMIT'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE'],
    requiresActiveInsurance: true,
    minYearsExperience: 0,
  },
  PET_PHOTOGRAPHER: {
    category: 'PET_PHOTOGRAPHER',
    displayName: 'Pet Lifestyle Photographer',
    mandatoryCredentialTypes: ['GOVERNMENT_ID'],
    recommendedCredentialTypes: ['COMMERCIAL_LIABILITY_INSURANCE'],
    requiresActiveInsurance: false,
    minYearsExperience: 0,
  },
};

export const STANDARD_SERVICE_TAXONOMY: ServiceTypeDefinition[] = [
  {
    serviceTypeId: asServiceTypeId('st-dog-walk'),
    category: 'DOG_WALKER',
    code: 'DOG_WALK',
    name: 'Scheduled Dog Walk',
    description: 'Structured outdoor physical activity and enrichment with leash safety and GPS logging',
    defaultDurationMinutes: 45,
    allowedLocationTypes: ['OUTDOOR_PUBLIC', 'CLIENT_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: false,
  },
  {
    serviceTypeId: asServiceTypeId('st-vet-consult'),
    category: 'VETERINARIAN',
    code: 'VET_CONSULT',
    name: 'Veterinary General Consultation',
    description: 'Comprehensive physical examination, clinical review, and care plan assessment',
    defaultDurationMinutes: 30,
    allowedLocationTypes: ['COMMERCIAL_CLINIC', 'REMOTE_VIRTUAL', 'CLIENT_LOCATION'] as any,
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-behavior-training'),
    category: 'TRAINER',
    code: 'BEHAVIOR_TRAINING',
    name: 'Behavioral & Obedience Training Session',
    description: 'Positive-reinforcement training focused on specific commands, socialization, or leash reactivity',
    defaultDurationMinutes: 60,
    allowedLocationTypes: ['CLIENT_LOCATION', 'OUTDOOR_PUBLIC', 'PROVIDER_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-pet-grooming-full'),
    category: 'GROOMER',
    code: 'GROOMING_FULL',
    name: 'Full Coat Grooming & Spa',
    description: 'Bath, brush, haircut, nail trim, ear cleaning, and coat conditioning',
    defaultDurationMinutes: 90,
    allowedLocationTypes: ['PROVIDER_LOCATION', 'CLIENT_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-pet-sitting-dropin'),
    category: 'PET_SITTER',
    code: 'PET_SITTING_DROPIN',
    name: 'Drop-in Pet Sitting Visit',
    description: 'Feeding, hydration check, medication administration, playtime, and litter/waste cleanup',
    defaultDurationMinutes: 30,
    allowedLocationTypes: ['CLIENT_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-boarding-overnight'),
    category: 'BOARDING_PROVIDER',
    code: 'BOARDING_OVERNIGHT',
    name: 'Overnight Kennel or Suite Boarding',
    description: 'Secure overnight accommodation with supervised social groups and regular feedings',
    defaultDurationMinutes: 1440,
    allowedLocationTypes: ['PROVIDER_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-daycare-fullday'),
    category: 'DAYCARE_PROVIDER',
    code: 'DAYCARE_FULLDAY',
    name: 'Full Day Social Daycare',
    description: 'Supervised group play, rest intervals, and stimulation in a secure facility',
    defaultDurationMinutes: 480,
    allowedLocationTypes: ['PROVIDER_LOCATION'],
    allowsVariants: false,
    requiresSpeciesSelection: true,
  },
  {
    serviceTypeId: asServiceTypeId('st-pet-transport'),
    category: 'PET_TRANSPORT',
    code: 'PET_TRANSPORT_ONEWAY',
    name: 'Safe Pet Transport Trip',
    description: 'Climate-controlled crated or harnessed vehicular transit between home and clinic/groomer',
    defaultDurationMinutes: 45,
    allowedLocationTypes: ['CLIENT_LOCATION'],
    allowsVariants: true,
    requiresSpeciesSelection: true,
  },
];

export class ProviderPolicyEngine {
  /**
   * Evaluates missing verification requirements for a provider based on their category
   */
  static evaluateVerificationReadiness(
    category: ProviderCategory,
    credentials: ProviderCredential[],
    currentTime: string = new Date().toISOString()
  ): {
    isReadyToSubmit: boolean;
    missingMandatory: CredentialType[];
    expiredCredentials: CredentialType[];
    validCredentials: ProviderCredential[];
  } {
    const rules = CATEGORY_VERIFICATION_RULES[category];
    if (!rules) {
      return {
        isReadyToSubmit: false,
        missingMandatory: [],
        expiredCredentials: [],
        validCredentials: [],
      };
    }

    const validCredentials = credentials.filter(c => {
      if (c.expiryDate && c.expiryDate < currentTime) return false;
      return true;
    });

    const expiredCredentials = credentials
      .filter(c => c.expiryDate && c.expiryDate < currentTime)
      .map(c => c.credentialType);

    const providedTypes = new Set(validCredentials.map(c => c.credentialType));
    const missingMandatory = rules.mandatoryCredentialTypes.filter(type => !providedTypes.has(type));

    return {
      isReadyToSubmit: missingMandatory.length === 0,
      missingMandatory,
      expiredCredentials,
      validCredentials,
    };
  }

  /**
   * Enforces self-verification prohibition.
   * A provider or applicant user CANNOT approve or review their own verification case.
   */
  static assertNotSelfReview(applicantUserId: UserId, reviewerUserId: UserId): void {
    if (applicantUserId === reviewerUserId) {
      throw new Error(
        `Security violation (Volume XXVIII / Trust Separation): Provider applicant ${applicantUserId} cannot review or approve their own verification.`
      );
    }
  }

  /**
   * Evaluates whether a service offering can be activated.
   * INVARIANT: Only VERIFIED providers with ACTIVE operational status can activate offerings.
   */
  static canActivateOffering(
    profile: ProviderProfile,
    credentials: ProviderCredential[],
    currentTime: string = new Date().toISOString()
  ): { allowed: boolean; reason?: string } {
    if (profile.verificationStatus !== 'VERIFIED') {
      return {
        allowed: false,
        reason: `Cannot activate service offering: Provider verification status is '${profile.verificationStatus}'. Must be 'VERIFIED'.`,
      };
    }

    if (profile.operationalStatus !== 'ACTIVE') {
      return {
        allowed: false,
        reason: `Cannot activate service offering: Provider operational status is '${profile.operationalStatus}'. Must be 'ACTIVE'.`,
      };
    }

    // Check if mandatory credentials have expired in the meantime
    const readiness = this.evaluateVerificationReadiness(profile.category, credentials, currentTime);
    if (readiness.expiredCredentials.length > 0) {
      return {
        allowed: false,
        reason: `Cannot activate service offering: Required credentials (${readiness.expiredCredentials.join(', ')}) have expired.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluates whether a provider can appear in the public marketplace directory.
   */
  static canBePubliclyListed(
    profile: ProviderProfile,
    activeOfferings: ServiceOffering[]
  ): { eligible: boolean; missingPrerequisites: string[] } {
    const missing: string[] = [];

    if (profile.verificationStatus !== 'VERIFIED') {
      missing.push(`Verification status is '${profile.verificationStatus}' (requires 'VERIFIED')`);
    }

    if (profile.operationalStatus !== 'ACTIVE') {
      missing.push(`Operational status is '${profile.operationalStatus}' (requires 'ACTIVE')`);
    }

    if (profile.visibilityStatus !== 'PUBLIC') {
      missing.push(`Visibility is '${profile.visibilityStatus}' (requires 'PUBLIC')`);
    }

    const liveOfferings = activeOfferings.filter(o => o.status === 'ACTIVE');
    if (liveOfferings.length === 0) {
      missing.push('No published and active service offerings found');
    }

    return {
      eligible: missing.length === 0,
      missingPrerequisites: missing,
    };
  }

  /**
   * Validates legal verification status transitions
   */
  static validateVerificationTransition(
    current: ProviderVerificationStatus,
    target: ProviderVerificationStatus
  ): boolean {
    if (current === target) return true;

    const allowedTransitions: Record<ProviderVerificationStatus, ProviderVerificationStatus[]> = {
      DRAFT: ['PENDING_VERIFICATION'],
      PENDING_VERIFICATION: ['UNDER_REVIEW', 'DRAFT'],
      UNDER_REVIEW: ['VERIFIED', 'NEEDS_INFORMATION', 'REJECTED'],
      NEEDS_INFORMATION: ['UNDER_REVIEW', 'DRAFT'],
      VERIFIED: ['SUSPENDED', 'UNDER_REVIEW'],
      REJECTED: ['PENDING_VERIFICATION', 'DRAFT'],
      SUSPENDED: ['UNDER_REVIEW', 'VERIFIED'],
    };

    return (allowedTransitions[current] || []).includes(target);
  }

  /**
   * Validates legal operational status transitions
   */
  static validateOperationalTransition(
    current: ProviderOperationalStatus,
    target: ProviderOperationalStatus
  ): boolean {
    if (current === target) return true;

    const allowedTransitions: Record<ProviderOperationalStatus, ProviderOperationalStatus[]> = {
      ACTIVE: ['TEMPORARILY_INACTIVE', 'RESTRICTED', 'SUSPENDED', 'ARCHIVED'],
      TEMPORARILY_INACTIVE: ['ACTIVE', 'RESTRICTED', 'ARCHIVED'],
      RESTRICTED: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
      SUSPENDED: ['RESTRICTED', 'ACTIVE', 'ARCHIVED'],
      ARCHIVED: ['RESTRICTED', 'ACTIVE'],
    };

    return (allowedTransitions[current] || []).includes(target);
  }
}
