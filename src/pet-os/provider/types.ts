/**
 * Pet OS Sprint 10 - Provider Platform & Professional Identity Domain Types
 * Implements Volume II (Enterprise Architecture), Volume IV (Identity),
 * Volume XII (Pet Services Marketplace), Volume XIV (Workspaces), Volume XXVIII (Security)
 * 
 * Enforces:
 * - Decoupled User vs Provider vs Business identities
 * - Verification status separated from Operational status
 * - Explicit Verification workflow (no inferring from profile completeness)
 * - Public vs Private projection segregation (Zero credential or private address leaks)
 * - Strict Money minor-units representation
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
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';

export type ProviderCategory =
  | 'VETERINARIAN'
  | 'VETERINARY_TECHNICIAN'
  | 'DOG_WALKER'
  | 'TRAINER'
  | 'GROOMER'
  | 'PET_SITTER'
  | 'BOARDING_PROVIDER'
  | 'DAYCARE_PROVIDER'
  | 'PET_TRANSPORT'
  | 'PET_PHOTOGRAPHER';

export type ProviderVerificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'NEEDS_INFORMATION'
  | 'REJECTED'
  | 'SUSPENDED';

export type ProviderOperationalStatus =
  | 'ACTIVE'
  | 'TEMPORARILY_INACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type ProviderVisibilityStatus =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'UNLISTED';

export type BusinessType =
  | 'VETERINARY_CLINIC'
  | 'TRAINING_BUSINESS'
  | 'GROOMING_BUSINESS'
  | 'BOARDING_FACILITY'
  | 'DAYCARE'
  | 'WALKING_SERVICE'
  | 'PET_SITTING_SERVICE'
  | 'TRANSPORT_SERVICE'
  | 'MULTI_SERVICE_BUSINESS';

export type BusinessVerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'SUSPENDED';

export type BusinessMemberRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'PROVIDER'
  | 'STAFF';

export type CredentialType =
  | 'VETERINARY_LICENSE'
  | 'VET_TECH_CERTIFICATION'
  | 'TRAINER_CERTIFICATION'
  | 'GOVERNMENT_ID'
  | 'BACKGROUND_CHECK'
  | 'BUSINESS_REGISTRATION'
  | 'COMMERCIAL_LIABILITY_INSURANCE'
  | 'PET_FIRST_AID_CERTIFICATION'
  | 'ANIMAL_HANDLING_CERTIFICATION'
  | 'SPECIALIZED_TRANSPORT_PERMIT';

export type CredentialVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type VerificationCaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ServiceOfferingStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'RETIRED'
  | 'SUSPENDED';

export type PricingModel =
  | 'FIXED'
  | 'STARTING_FROM'
  | 'PER_HOUR'
  | 'PER_NIGHT'
  | 'PER_PET';

export type ServiceLocationType =
  | 'CLIENT_LOCATION'
  | 'PROVIDER_LOCATION'
  | 'OUTDOOR_PUBLIC'
  | 'REMOTE_VIRTUAL';

export type LocationCategory =
  | 'COMMERCIAL_CLINIC'
  | 'COMMERCIAL_FACILITY'
  | 'PRIVATE_RESIDENCE'
  | 'PUBLIC_PARK'
  | 'MOBILE_UNIT';

export type ServiceAreaType =
  | 'RADIUS_AROUND_LOCATION'
  | 'POSTAL_CODE_LIST'
  | 'ADMIN_DISTRICT';

export type TrustBadgeType =
  | 'IDENTITY_VERIFIED'
  | 'PROFESSIONAL_LICENSE_VERIFIED'
  | 'BUSINESS_VERIFIED'
  | 'INSURANCE_VERIFIED'
  | 'BACKGROUND_CHECK_CLEARED';

export type ReportCategory =
  | 'SAFETY_CONCERN'
  | 'FRAUD_MISREPRESENTATION'
  | 'MISCONDUCT'
  | 'ANIMAL_WELFARE'
  | 'INACCURATE_PROFILE';

export type ReportStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'RESOLVED'
  | 'DISMISSED';

// Core Aggregate: ProviderProfile
export interface ProviderProfile {
  providerId: ProviderId;
  userId: UserId; // Linked user account (Identity bounded context)
  displayName: string;
  professionalTitle?: string;
  category: ProviderCategory;
  bio: string;
  yearsOfExperience: number;
  languages: string[];
  avatarUrl?: string;
  verificationStatus: ProviderVerificationStatus;
  operationalStatus: ProviderOperationalStatus;
  visibilityStatus: ProviderVisibilityStatus;
  primaryBusinessId?: BusinessId;
  metadata: {
    insurancePolicyNumber?: string;
    taxIdentifierMasked?: string;
    onboardingStep?: string;
    rejectionReason?: string;
    suspensionReason?: string;
    suspendedAt?: string;
    verifiedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Core Aggregate: ServiceBusiness
export interface ServiceBusiness {
  businessId: BusinessId;
  legalName: string;
  tradingName: string;
  businessType: BusinessType;
  registrationNumber?: string;
  taxNumberMasked?: string;
  ownerUserId: UserId;
  verificationStatus: BusinessVerificationStatus;
  isActive: boolean;
  contactEmail: string;
  contactPhone: string;
  websiteUrl?: string;
  primaryLocationId?: LocationId;
  createdAt: string;
  updatedAt: string;
}

// Business Membership (Organization Team Management)
export interface BusinessMembership {
  membershipId: BusinessMembershipId;
  businessId: BusinessId;
  userId: UserId;
  providerId?: ProviderId; // Optional if non-provider staff
  role: BusinessMemberRole;
  isActive: boolean;
  canManageServices: boolean;
  canManageSchedule: boolean;
  joinedAt: string;
  updatedAt: string;
}

// Provider Credential Document Record
export interface ProviderCredential {
  credentialId: CredentialId;
  providerId?: ProviderId;
  businessId?: BusinessId;
  credentialType: CredentialType;
  title: string;
  issuingAuthority: string;
  identifierMasked: string; // e.g. "VET-****-8842"
  issuedDate: string;
  expiryDate?: string;
  verificationStatus: CredentialVerificationStatus;
  evidenceDocumentUrl?: string; // Private document link
  evidenceStorageKey?: string;
  verifiedAt?: string;
  verifiedByUserId?: UserId;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Verification Case Workflow
export interface VerificationCase {
  caseId: VerificationCaseId;
  targetType: 'PROVIDER' | 'BUSINESS';
  providerId?: ProviderId;
  businessId?: BusinessId;
  applicantUserId: UserId;
  category: ProviderCategory | BusinessType;
  status: VerificationCaseStatus;
  submittedCredentialIds: CredentialId[];
  reviewerUserId?: UserId;
  internalNotes?: string;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  completedAt?: string;
}

// Service Taxonomy Definition
export interface ServiceTypeDefinition {
  serviceTypeId: ServiceTypeId;
  category: ProviderCategory;
  code: string;
  name: string;
  description: string;
  defaultDurationMinutes: number;
  allowedLocationTypes: ServiceLocationType[];
  allowsVariants: boolean;
  requiresSpeciesSelection: boolean;
}

// Service Offering (Individual service with variants & pricing)
export interface ServiceOffering {
  serviceOfferingId: ServiceOfferingId;
  providerId: ProviderId;
  businessId?: BusinessId;
  serviceTypeId: ServiceTypeId;
  title: string;
  description: string;
  category: ProviderCategory;
  status: ServiceOfferingStatus;
  pricingModel: PricingModel;
  basePriceMinorUnits: number; // Integer minor units (ADR-012)
  currency: CurrencyCode;
  defaultDurationMinutes: number;
  locationTypes: ServiceLocationType[];
  targetSpecies: string[]; // e.g. ["DOG", "CAT"]
  sizeRestrictions?: string[]; // e.g. ["SMALL", "MEDIUM", "LARGE"]
  variants: ServiceVariant[];
  prerequisites?: string[];
  maxPetsPerBooking?: number;
  createdAt: string;
  updatedAt: string;
}

// Service Variant (e.g. 30min walk, 60min walk, puppy consultation)
export interface ServiceVariant {
  variantId: string;
  title: string;
  description?: string;
  durationMinutes: number;
  priceMinorUnits: number;
  currency: CurrencyCode;
  speciesRestriction?: string[];
  sizeRestriction?: string[];
}

// Operating Location
export interface ProviderLocation {
  locationId: LocationId;
  businessId?: BusinessId;
  providerId?: ProviderId;
  name: string;
  category: LocationCategory;
  isPublicAddress: boolean; // Commercial clinics = true, Private residence = false
  addressLine1Masked?: string; // e.g. "Kilimani, Nairobi" for private; full address for commercial
  fullAddressPrivate?: string; // Private storage only
  city: string;
  stateOrRegion: string;
  postalCode?: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  timezone: string;
  isPrimary: boolean;
  createdAt: string;
}

// Service Area (Coverage bounds for mobile/in-home services)
export interface ServiceArea {
  serviceAreaId: ServiceAreaId;
  providerId: ProviderId;
  businessId?: BusinessId;
  name: string;
  areaType: ServiceAreaType;
  centerLocationId?: LocationId;
  radiusKm?: number;
  postalCodes?: string[];
  districtName?: string;
  isActive: boolean;
  createdAt: string;
}

// Weekly Availability Rule
export interface ProviderAvailabilityRule {
  ruleId: AvailabilityRuleId;
  providerId: ProviderId;
  businessId?: BusinessId;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  startTime: string; // "08:00"
  endTime: string; // "17:00"
  timezone: string;
  serviceOfferingId?: ServiceOfferingId; // Optional specific offering override
  maxConcurrentCapacity: number;
  isActive: boolean;
}

// Availability Exception (Time-off, Holiday, Temporary Closure)
export interface ProviderAvailabilityException {
  exceptionId: AvailabilityExceptionId;
  providerId: ProviderId;
  businessId?: BusinessId;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  startTime?: string; // "00:00"
  endTime?: string; // "23:59"
  isAllDay: boolean;
  type: 'TIME_OFF' | 'PUBLIC_HOLIDAY' | 'BUSINESS_CLOSURE' | 'SPECIAL_HOURS';
  reason: string;
  createdAt: string;
}

// Verified Trust Indicator (Badges)
export interface ProviderTrustIndicator {
  indicatorId: TrustIndicatorId;
  providerId: ProviderId;
  businessId?: BusinessId;
  badgeType: TrustBadgeType;
  title: string;
  issuedAt: string;
  verifiedByUserId: UserId;
  explanation: string;
  linkedCredentialId?: CredentialId;
  isValid: boolean;
}

// Trust & Safety Incident / Report
export interface ProviderReport {
  reportId: ProviderReportId;
  reporterUserId: UserId;
  targetProviderId?: ProviderId;
  targetBusinessId?: BusinessId;
  category: ReportCategory;
  description: string;
  evidenceDocumentUrls?: string[];
  status: ReportStatus;
  assignedReviewerUserId?: UserId;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Read Projections: Public vs Private Segregation (Mandatory Security Rule)
// ---------------------------------------------------------------------------

/**
 * PublicProviderProfile
 * Publicly queryable marketplace projection.
 * Sanitized of all internal notes, personal address details, background check
 * documents, and user account credentials.
 */
export interface PublicProviderProfile {
  providerId: ProviderId;
  displayName: string;
  professionalTitle?: string;
  category: ProviderCategory;
  bio: string;
  yearsOfExperience: number;
  languages: string[];
  avatarUrl?: string;
  verificationStatus: ProviderVerificationStatus;
  primaryBusiness?: {
    businessId: BusinessId;
    tradingName: string;
    businessType: BusinessType;
  };
  trustIndicators: Array<{
    badgeType: TrustBadgeType;
    title: string;
    explanation: string;
    issuedAt: string;
  }>;
  activeOfferings: Array<{
    serviceOfferingId: ServiceOfferingId;
    title: string;
    description: string;
    category: ProviderCategory;
    pricingModel: PricingModel;
    basePriceMinorUnits: number;
    currency: CurrencyCode;
    defaultDurationMinutes: number;
    locationTypes: ServiceLocationType[];
    targetSpecies: string[];
    variants: ServiceVariant[];
  }>;
  serviceAreas: Array<{
    name: string;
    areaType: ServiceAreaType;
    radiusKm?: number;
    districtName?: string;
  }>;
  publicLocations: Array<{
    locationId: LocationId;
    name: string;
    category: LocationCategory;
    city: string;
    stateOrRegion: string;
    country: string;
    coordinates: { lat: number; lng: number };
    timezone: string;
  }>;
  operatingHoursSummary: Array<{
    dayOfWeek: number;
    dayName: string;
    startTime: string;
    endTime: string;
    timezone: string;
  }>;
}

/**
 * PrivateProviderDashboard
 * Full operational picture accessible only to the provider themselves,
 * their business managers, or platform trust reviewers.
 */
export interface PrivateProviderDashboard {
  profile: ProviderProfile;
  linkedUser: {
    userId: UserId;
  };
  businessMemberships: BusinessMembership[];
  primaryBusiness?: ServiceBusiness;
  credentials: ProviderCredential[];
  verificationCases: VerificationCase[];
  offerings: ServiceOffering[];
  locations: ProviderLocation[];
  serviceAreas: ServiceArea[];
  availabilityRules: ProviderAvailabilityRule[];
  availabilityExceptions: ProviderAvailabilityException[];
  trustIndicators: ProviderTrustIndicator[];
  activeReportsCount: number;
  eligibilityToActivateServices: {
    isEligible: boolean;
    missingPrerequisites: string[];
  };
  eligibilityForPublicDirectory: {
    isEligible: boolean;
    missingPrerequisites: string[];
  };
}

// Future integration snapshot contract (for Booking / Payouts)
export interface BookingOfferingSnapshot {
  serviceOfferingId: ServiceOfferingId;
  providerId: ProviderId;
  businessId?: BusinessId;
  title: string;
  category: ProviderCategory;
  variantId?: string;
  variantTitle?: string;
  durationMinutes: number;
  priceMinorUnits: number;
  currency: CurrencyCode;
  pricingModel: PricingModel;
  locationType: ServiceLocationType;
  snapshotTimestamp: string;
}
