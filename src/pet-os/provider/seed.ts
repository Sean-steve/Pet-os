/**
 * Pet OS Sprint 10 - Provider Platform Canonical Seed Data
 * Sets up realistic vetted veterinarians, dog walkers, behavioral trainers,
 * business organizations, credentials, service offerings with variants, service areas,
 * locations, availability schedules, and trust records.
 */

import {
  UserId,
  asUserId,
  asProviderId,
  asBusinessId,
  asBusinessMembershipId,
  asCredentialId,
  asVerificationCaseId,
  asServiceOfferingId,
  asServiceTypeId,
  asLocationId,
  asServiceAreaId,
  asAvailabilityRuleId,
  asAvailabilityExceptionId,
  asTrustIndicatorId,
  asProviderReportId,
} from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { ProviderStore } from './store';
import { STANDARD_SERVICE_TAXONOMY } from './policy';

export const SEED_USERS = {
  ADMIN: asUserId('usr-01951500-0000-7000-8000-000000000099'),
  VET_DR_KIMANI: asUserId('usr-01951500-0000-7000-8000-000000000101'),
  WALKER_SARAH: asUserId('usr-01951500-0000-7000-8000-000000000102'),
  TRAINER_JUMA: asUserId('usr-01951500-0000-7000-8000-000000000103'),
  APPLICANT_JANE: asUserId('usr-01951500-0000-7000-8000-000000000104'),
  SUSPENDED_KEVIN: asUserId('usr-01951500-0000-7000-8000-000000000105'),
  OWNER_ELENA: asUserId('usr-01951500-0000-7000-8000-000000000001'),
};

export const SEED_PROVIDERS = {
  DR_KIMANI: asProviderId('prv-kimani-vet-001'),
  SARAH_MWANGI: asProviderId('prv-sarah-walker-001'),
  JUMA_OCHIENG: asProviderId('prv-juma-trainer-001'),
  JANE_DOE: asProviderId('prv-jane-applicant-001'),
  KEVIN_KIPRONO: asProviderId('prv-kevin-suspended-001'),
};

export const SEED_BUSINESSES = {
  NAIROBI_WEST_VET: asBusinessId('biz-nairobi-west-vet'),
  HAPPY_PAWS_WALKERS: asBusinessId('biz-happy-paws-walkers'),
  APEX_K9_ACADEMY: asBusinessId('biz-apex-k9-academy'),
};

export function seedProviderData(
  store: ProviderStore = ProviderStore.getInstance()
): void {
  const now = new Date().toISOString();
  const pastYear = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  // 1. Ensure baseline user identities in IdentityStore
  const baselineUsers = [
    { id: SEED_USERS.ADMIN, email: 'trust.admin@petos.internal', name: 'Dr. Charles Maina (Trust Officer)', phone: '+254700000099' },
    { id: SEED_USERS.VET_DR_KIMANI, email: 'dr.kimani@nairobiwestvet.co.ke', name: 'Dr. Amani Kimani, BVSc', phone: '+254711223344' },
    { id: SEED_USERS.WALKER_SARAH, email: 'sarah@happypawswalkers.ke', name: 'Sarah Mwangi', phone: '+254722334455' },
    { id: SEED_USERS.TRAINER_JUMA, email: 'juma@apexk9.ke', name: 'Juma Ochieng', phone: '+254733445566' },
    { id: SEED_USERS.APPLICANT_JANE, email: 'jane.applicant@gmail.com', name: 'Jane Doe', phone: '+254744556677' },
    { id: SEED_USERS.SUSPENDED_KEVIN, email: 'kevin.k@yahoo.com', name: 'Kevin Kiprono', phone: '+254755667788' },
    { id: SEED_USERS.OWNER_ELENA, email: 'elena.vance@example.com', name: 'Elena Vance (Pet Owner)', phone: '+254700000001' },
  ];

  for (const u of baselineUsers) {
    if (!IdentityStore.findUserById(u.id)) {
      IdentityStore.saveUser({
        userId: u.id,
        email: u.email,
        normalizedEmail: u.email.toLowerCase().trim(),
        phoneNumber: u.phone,
        passwordHash: 'argon2id_mock_hash_seed',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        policyAcceptedAt: pastYear,
        policyVersion: '1.0',
        createdAt: pastYear,
        updatedAt: now,
      });

      const parts = u.name.split(' ');
      const firstName = parts[0] || 'User';
      const lastName = parts.slice(1).join(' ') || 'Provider';

      IdentityStore.saveProfile({
        userId: u.id,
        displayName: u.name,
        firstName,
        lastName,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: {
          emailNotifications: true,
          smsNotifications: true,
          emergencyAlerts: true,
        },
        privacyPreferences: {
          profileVisibility: 'HOUSEHOLD_ONLY',
          shareActivityWithHousehold: true,
        },
        updatedAt: now,
      });
    }
  }

  // 2. Businesses
  // 2a. Nairobi West Animal Hospital
  store.saveBusiness({
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    legalName: 'Nairobi West Veterinary Services Limited',
    tradingName: 'Nairobi West Animal Hospital',
    businessType: 'VETERINARY_CLINIC',
    registrationNumber: 'CPR/2018/98214',
    taxNumberMasked: 'P051****82Z',
    ownerUserId: SEED_USERS.VET_DR_KIMANI,
    verificationStatus: 'VERIFIED',
    isActive: true,
    contactEmail: 'reception@nairobiwestvet.co.ke',
    contactPhone: '+254 20 6005500',
    websiteUrl: 'https://nairobiwestvet.co.ke',
    createdAt: pastYear,
    updatedAt: now,
  });

  store.saveBusinessMembership({
    membershipId: asBusinessMembershipId('bzm-kimani-01'),
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    userId: SEED_USERS.VET_DR_KIMANI,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    role: 'OWNER',
    isActive: true,
    canManageServices: true,
    canManageSchedule: true,
    joinedAt: pastYear,
    updatedAt: now,
  });

  // 2b. Happy Paws Walkers Ltd
  store.saveBusiness({
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    legalName: 'Happy Paws Canine Care Limited',
    tradingName: 'Happy Paws Urban Dog Walkers',
    businessType: 'WALKING_SERVICE',
    registrationNumber: 'BN-882941',
    ownerUserId: SEED_USERS.WALKER_SARAH,
    verificationStatus: 'VERIFIED',
    isActive: true,
    contactEmail: 'hello@happypawswalkers.ke',
    contactPhone: '+254 722 334455',
    websiteUrl: 'https://happypawswalkers.ke',
    createdAt: pastYear,
    updatedAt: now,
  });

  store.saveBusinessMembership({
    membershipId: asBusinessMembershipId('bzm-sarah-01'),
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    userId: SEED_USERS.WALKER_SARAH,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    role: 'OWNER',
    isActive: true,
    canManageServices: true,
    canManageSchedule: true,
    joinedAt: pastYear,
    updatedAt: now,
  });

  // 2c. Apex K9 Academy
  store.saveBusiness({
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    legalName: 'Apex K9 Behavioral Institute Limited',
    tradingName: 'Apex K9 Training Academy',
    businessType: 'TRAINING_BUSINESS',
    registrationNumber: 'CPR/2021/44912',
    ownerUserId: SEED_USERS.TRAINER_JUMA,
    verificationStatus: 'VERIFIED',
    isActive: true,
    contactEmail: 'train@apexk9.ke',
    contactPhone: '+254 733 445566',
    websiteUrl: 'https://apexk9.ke',
    createdAt: pastYear,
    updatedAt: now,
  });

  store.saveBusinessMembership({
    membershipId: asBusinessMembershipId('bzm-juma-01'),
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    userId: SEED_USERS.TRAINER_JUMA,
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    role: 'OWNER',
    isActive: true,
    canManageServices: true,
    canManageSchedule: true,
    joinedAt: pastYear,
    updatedAt: now,
  });

  // 3. Provider Profiles
  // 3a. Dr. Amani Kimani (Veterinarian - Verified)
  store.saveProvider({
    providerId: SEED_PROVIDERS.DR_KIMANI,
    userId: SEED_USERS.VET_DR_KIMANI,
    displayName: 'Dr. Amani Kimani, BVSc',
    professionalTitle: 'Lead Clinical Veterinarian & Small Animal Surgeon',
    category: 'VETERINARIAN',
    bio: 'Board-certified small animal veterinary practitioner with over 9 years of clinical medicine and soft tissue surgical experience in Nairobi. Passionate about preventive wellness, feline internal medicine, and geriatric canine comfort.',
    yearsOfExperience: 9,
    languages: ['English', 'Swahili'],
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&auto=format&fit=crop&q=80',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    visibilityStatus: 'PUBLIC',
    primaryBusinessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    metadata: {
      insurancePolicyNumber: 'APA-VET-882194',
      taxIdentifierMasked: 'P051****82Z',
      verifiedAt: pastYear,
    },
    createdAt: pastYear,
    updatedAt: now,
  });

  // 3b. Sarah Mwangi (Dog Walker - Verified)
  store.saveProvider({
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    userId: SEED_USERS.WALKER_SARAH,
    displayName: 'Sarah Mwangi',
    professionalTitle: 'Certified Urban Dog Walker & Fear-Free Sitter',
    category: 'DOG_WALKER',
    bio: 'Certified pet care specialist dedicated to low-stress, structured neighborhood pack and solo walks across Kilimani and Westlands. Trained in canine CPR, body language observation, and reactive leash management.',
    yearsOfExperience: 5,
    languages: ['English', 'Swahili'],
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    visibilityStatus: 'PUBLIC',
    primaryBusinessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    metadata: {
      insurancePolicyNumber: 'BRITAM-PET-7729',
      verifiedAt: pastYear,
    },
    createdAt: pastYear,
    updatedAt: now,
  });

  // 3c. Juma Ochieng (Canine Trainer - Verified)
  store.saveProvider({
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    userId: SEED_USERS.TRAINER_JUMA,
    displayName: 'Juma Ochieng',
    professionalTitle: 'Certified Canine Behaviorist & Obedience Coach',
    category: 'TRAINER',
    bio: 'Professional positive-reinforcement dog trainer specializing in puppy socialization, loose-leash walking, separation anxiety, and adolescent boundary training. Former K9 handler with over 7 years of specialized field coaching.',
    yearsOfExperience: 7,
    languages: ['English', 'Swahili'],
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    verificationStatus: 'VERIFIED',
    operationalStatus: 'ACTIVE',
    visibilityStatus: 'PUBLIC',
    primaryBusinessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    metadata: {
      verifiedAt: pastYear,
    },
    createdAt: pastYear,
    updatedAt: now,
  });

  // 3d. Jane Doe (Applicant - Pending Review)
  store.saveProvider({
    providerId: SEED_PROVIDERS.JANE_DOE,
    userId: SEED_USERS.APPLICANT_JANE,
    displayName: 'Jane Doe',
    professionalTitle: 'Aspiring Pet Companion & Dog Walker',
    category: 'DOG_WALKER',
    bio: 'Avid animal lover looking to provide personalized evening walking and feeding drop-ins for dogs and cats in Nairobi.',
    yearsOfExperience: 2,
    languages: ['English'],
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    verificationStatus: 'PENDING_VERIFICATION',
    operationalStatus: 'ACTIVE',
    visibilityStatus: 'UNLISTED',
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });

  // 3e. Kevin Kiprono (Suspended for Safety Concern)
  store.saveProvider({
    providerId: SEED_PROVIDERS.KEVIN_KIPRONO,
    userId: SEED_USERS.SUSPENDED_KEVIN,
    displayName: 'Kevin Kiprono',
    professionalTitle: 'Dog Walker & Runner',
    category: 'DOG_WALKER',
    bio: 'Energetic pack walker covering city parks.',
    yearsOfExperience: 1,
    languages: ['English', 'Swahili'],
    verificationStatus: 'SUSPENDED',
    operationalStatus: 'SUSPENDED',
    visibilityStatus: 'PRIVATE',
    metadata: {
      suspensionReason: 'Incident Report #REP-9021: Client dog unleashed near vehicular traffic without owner consent.',
      suspendedAt: now,
    },
    createdAt: pastYear,
    updatedAt: now,
  });

  // 4. Credentials
  // Dr. Kimani
  const credVetGovId = asCredentialId('crd-kimani-id');
  const credVetLicense = asCredentialId('crd-kimani-lic');
  store.saveCredential({
    credentialId: credVetGovId,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    credentialType: 'GOVERNMENT_ID',
    title: 'Kenya National ID Card',
    issuingAuthority: 'National Registration Bureau of Kenya',
    identifierMasked: '24****18',
    issuedDate: '2012-05-14',
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  store.saveCredential({
    credentialId: credVetLicense,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    credentialType: 'VETERINARY_LICENSE',
    title: 'Kenya Veterinary Board Practicing License',
    issuingAuthority: 'Kenya Veterinary Board (KVB)',
    identifierMasked: 'KVB-2024-0982',
    issuedDate: '2024-01-01',
    expiryDate: nextYear,
    verificationStatus: 'VERIFIED',
    evidenceDocumentUrl: 'https://storage.petos.internal/credentials/kvb_license_kimani.pdf',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  // Sarah Mwangi
  const credSarahGovId = asCredentialId('crd-sarah-id');
  const credSarahInsurance = asCredentialId('crd-sarah-ins');
  const credSarahFirstAid = asCredentialId('crd-sarah-firstaid');
  store.saveCredential({
    credentialId: credSarahGovId,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    credentialType: 'GOVERNMENT_ID',
    title: 'Kenya National Identity Card',
    issuingAuthority: 'National Registration Bureau',
    identifierMasked: '29****44',
    issuedDate: '2016-08-20',
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  store.saveCredential({
    credentialId: credSarahInsurance,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    credentialType: 'COMMERCIAL_LIABILITY_INSURANCE',
    title: 'Pet Professional Commercial General Liability Policy',
    issuingAuthority: 'Britam General Insurance Kenya',
    identifierMasked: 'POL-CGL-99214',
    issuedDate: '2024-02-15',
    expiryDate: nextYear,
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  store.saveCredential({
    credentialId: credSarahFirstAid,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    credentialType: 'PET_FIRST_AID_CERTIFICATION',
    title: 'Canine & Feline Emergency CPR & First Aid Certificate',
    issuingAuthority: 'East African Animal Welfare Alliance',
    identifierMasked: 'CPR-EAA-2023-88',
    issuedDate: '2023-11-10',
    expiryDate: nextYear,
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  // Juma Ochieng
  const credJumaGovId = asCredentialId('crd-juma-id');
  const credJumaCert = asCredentialId('crd-juma-cert');
  store.saveCredential({
    credentialId: credJumaGovId,
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    credentialType: 'GOVERNMENT_ID',
    title: 'Kenya National ID Card',
    issuingAuthority: 'National Registration Bureau',
    identifierMasked: '26****91',
    issuedDate: '2014-03-12',
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  store.saveCredential({
    credentialId: credJumaCert,
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    credentialType: 'TRAINER_CERTIFICATION',
    title: 'Certified Professional Canine Trainer (CPCT)',
    issuingAuthority: 'International Association of Canine Professionals (IACP)',
    identifierMasked: 'IACP-CPCT-7741',
    issuedDate: '2021-04-18',
    verificationStatus: 'VERIFIED',
    verifiedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    createdAt: pastYear,
    updatedAt: pastYear,
  });

  // Jane Doe (Pending Credential)
  const credJaneId = asCredentialId('crd-jane-id');
  store.saveCredential({
    credentialId: credJaneId,
    providerId: SEED_PROVIDERS.JANE_DOE,
    credentialType: 'GOVERNMENT_ID',
    title: 'Passport Identification Document',
    issuingAuthority: 'Department of Immigration Kenya',
    identifierMasked: 'AK****99',
    issuedDate: '2022-09-10',
    expiryDate: nextYear,
    verificationStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  });

  // 5. Verification Cases
  store.saveVerificationCase({
    caseId: asVerificationCaseId('vcs-kimani-01'),
    targetType: 'PROVIDER',
    providerId: SEED_PROVIDERS.DR_KIMANI,
    applicantUserId: SEED_USERS.VET_DR_KIMANI,
    category: 'VETERINARIAN',
    status: 'APPROVED',
    submittedCredentialIds: [credVetGovId, credVetLicense],
    reviewerUserId: SEED_USERS.ADMIN,
    internalNotes: 'All records checked against KVB register. Valid through 2027.',
    submittedAt: pastYear,
    reviewedAt: pastYear,
    completedAt: pastYear,
  });

  store.saveVerificationCase({
    caseId: asVerificationCaseId('vcs-sarah-01'),
    targetType: 'PROVIDER',
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    applicantUserId: SEED_USERS.WALKER_SARAH,
    category: 'DOG_WALKER',
    status: 'APPROVED',
    submittedCredentialIds: [credSarahGovId, credSarahInsurance, credSarahFirstAid],
    reviewerUserId: SEED_USERS.ADMIN,
    internalNotes: 'Commercial insurance and CPR certificate verified.',
    submittedAt: pastYear,
    reviewedAt: pastYear,
    completedAt: pastYear,
  });

  store.saveVerificationCase({
    caseId: asVerificationCaseId('vcs-jane-01'),
    targetType: 'PROVIDER',
    providerId: SEED_PROVIDERS.JANE_DOE,
    applicantUserId: SEED_USERS.APPLICANT_JANE,
    category: 'DOG_WALKER',
    status: 'SUBMITTED',
    submittedCredentialIds: [credJaneId],
    submittedAt: now,
  });

  // 6. Trust Badges
  store.saveTrustIndicator({
    indicatorId: asTrustIndicatorId('tst-kimani-id'),
    providerId: SEED_PROVIDERS.DR_KIMANI,
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    badgeType: 'IDENTITY_VERIFIED',
    title: 'Identity Verified',
    issuedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    explanation: 'Government photo identification validated against official records.',
    linkedCredentialId: credVetGovId,
    isValid: true,
  });

  store.saveTrustIndicator({
    indicatorId: asTrustIndicatorId('tst-kimani-lic'),
    providerId: SEED_PROVIDERS.DR_KIMANI,
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    badgeType: 'PROFESSIONAL_LICENSE_VERIFIED',
    title: 'Veterinary License Verified',
    issuedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    explanation: 'Board registration license KVB-2024-0982 verified with Kenya Veterinary Board.',
    linkedCredentialId: credVetLicense,
    isValid: true,
  });

  store.saveTrustIndicator({
    indicatorId: asTrustIndicatorId('tst-sarah-id'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    badgeType: 'IDENTITY_VERIFIED',
    title: 'Identity Verified',
    issuedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    explanation: 'Government photo identification validated.',
    linkedCredentialId: credSarahGovId,
    isValid: true,
  });

  store.saveTrustIndicator({
    indicatorId: asTrustIndicatorId('tst-sarah-ins'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    badgeType: 'INSURANCE_VERIFIED',
    title: 'Commercial Liability Insured',
    issuedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    explanation: 'Active commercial general liability policy verified through Britam General Insurance.',
    linkedCredentialId: credSarahInsurance,
    isValid: true,
  });

  store.saveTrustIndicator({
    indicatorId: asTrustIndicatorId('tst-juma-cert'),
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    badgeType: 'PROFESSIONAL_LICENSE_VERIFIED',
    title: 'Certified Behaviorist / Trainer',
    issuedAt: pastYear,
    verifiedByUserId: SEED_USERS.ADMIN,
    explanation: 'Certified Professional Canine Trainer credentials verified through IACP.',
    linkedCredentialId: credJumaCert,
    isValid: true,
  });

  // 7. Service Offerings
  // Dr. Kimani:
  store.saveServiceOffering({
    serviceOfferingId: asServiceOfferingId('sro-vet-consult-01'),
    providerId: SEED_PROVIDERS.DR_KIMANI,
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    serviceTypeId: asServiceTypeId('st-vet-consult'),
    title: 'Comprehensive Veterinary Clinical Consultation',
    description: 'Thorough physical examination, diagnostic screening plan, ocular & dental inspection, and customized clinical wellness prescription.',
    category: 'VETERINARIAN',
    status: 'ACTIVE',
    pricingModel: 'FIXED',
    basePriceMinorUnits: 350000, // 3,500.00 KES
    currency: 'KES',
    defaultDurationMinutes: 30,
    locationTypes: ['PROVIDER_LOCATION'],
    targetSpecies: ['DOG', 'CAT'],
    variants: [
      {
        variantId: 'var-vet-standard',
        title: 'Standard Consultation (30 mins)',
        durationMinutes: 30,
        priceMinorUnits: 350000,
        currency: 'KES',
      },
      {
        variantId: 'var-vet-extended',
        title: 'Extended Multi-Issue Review (45 mins)',
        durationMinutes: 45,
        priceMinorUnits: 500000,
        currency: 'KES',
      },
      {
        variantId: 'var-vet-emergency',
        title: 'Urgent Same-Day Triage',
        durationMinutes: 45,
        priceMinorUnits: 650000,
        currency: 'KES',
      },
    ],
    prerequisites: ['Prior medical records or vaccination history requested where available'],
    maxPetsPerBooking: 1,
    createdAt: pastYear,
    updatedAt: now,
  });

  // Sarah Mwangi:
  store.saveServiceOffering({
    serviceOfferingId: asServiceOfferingId('sro-dog-walk-01'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    serviceTypeId: asServiceTypeId('st-dog-walk'),
    title: 'Structured Neighborhood Adventure Walk',
    description: 'Energetic outdoor walk with leash training reinforcement, fresh water, hydration break, and post-walk paw wipe-down.',
    category: 'DOG_WALKER',
    status: 'ACTIVE',
    pricingModel: 'STARTING_FROM',
    basePriceMinorUnits: 150000, // 1,500.00 KES (45 mins)
    currency: 'KES',
    defaultDurationMinutes: 45,
    locationTypes: ['CLIENT_LOCATION', 'OUTDOOR_PUBLIC'],
    targetSpecies: ['DOG'],
    variants: [
      {
        variantId: 'var-walk-quick-30',
        title: 'Express Relief Walk (30 mins)',
        durationMinutes: 30,
        priceMinorUnits: 120000, // 1,200 KES
        currency: 'KES',
      },
      {
        variantId: 'var-walk-standard-45',
        title: 'Standard Neighborhood Walk (45 mins)',
        durationMinutes: 45,
        priceMinorUnits: 150000, // 1,500 KES
        currency: 'KES',
      },
      {
        variantId: 'var-walk-power-60',
        title: 'High-Energy Adventure Walk (60 mins)',
        durationMinutes: 60,
        priceMinorUnits: 200000, // 2,000 KES
        currency: 'KES',
      },
    ],
    maxPetsPerBooking: 2,
    createdAt: pastYear,
    updatedAt: now,
  });

  store.saveServiceOffering({
    serviceOfferingId: asServiceOfferingId('sro-pet-sitting-01'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    serviceTypeId: asServiceTypeId('st-pet-sitting-dropin'),
    title: 'In-Home Drop-In Pet Sitting Visit',
    description: 'Personalized feeding, water bowl replenishment, litter scoop or yard waste cleanup, playtime, and photo update.',
    category: 'PET_SITTER',
    status: 'ACTIVE',
    pricingModel: 'FIXED',
    basePriceMinorUnits: 120000, // 1,200.00 KES
    currency: 'KES',
    defaultDurationMinutes: 30,
    locationTypes: ['CLIENT_LOCATION'],
    targetSpecies: ['DOG', 'CAT'],
    variants: [],
    maxPetsPerBooking: 3,
    createdAt: pastYear,
    updatedAt: now,
  });

  // Juma Ochieng:
  store.saveServiceOffering({
    serviceOfferingId: asServiceOfferingId('sro-behavior-training-01'),
    providerId: SEED_PROVIDERS.JUMA_OCHIENG,
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    serviceTypeId: asServiceTypeId('st-behavior-training'),
    title: '1-on-1 Behavioral & Leash Reactivity Coaching',
    description: 'Private tailored behavior modification focusing on impulse control, threshold desensitization, and handler confidence.',
    category: 'TRAINER',
    status: 'ACTIVE',
    pricingModel: 'FIXED',
    basePriceMinorUnits: 400000, // 4,000.00 KES
    currency: 'KES',
    defaultDurationMinutes: 60,
    locationTypes: ['CLIENT_LOCATION', 'OUTDOOR_PUBLIC', 'PROVIDER_LOCATION'],
    targetSpecies: ['DOG'],
    variants: [
      {
        variantId: 'var-train-session-60',
        title: 'Single Foundation Coaching Session (60 mins)',
        durationMinutes: 60,
        priceMinorUnits: 400000,
        currency: 'KES',
      },
      {
        variantId: 'var-train-intensive-90',
        title: 'Intensive Reactivity Deep-Dive (90 mins)',
        durationMinutes: 90,
        priceMinorUnits: 550000,
        currency: 'KES',
      },
    ],
    maxPetsPerBooking: 1,
    createdAt: pastYear,
    updatedAt: now,
  });

  // Jane Doe: Draft offering (cannot be activated because Jane is unverified)
  store.saveServiceOffering({
    serviceOfferingId: asServiceOfferingId('sro-jane-draft-01'),
    providerId: SEED_PROVIDERS.JANE_DOE,
    serviceTypeId: asServiceTypeId('st-dog-walk'),
    title: 'Evening Dog Walk (Draft)',
    description: 'Relaxed neighborhood walk.',
    category: 'DOG_WALKER',
    status: 'DRAFT',
    pricingModel: 'FIXED',
    basePriceMinorUnits: 100000,
    currency: 'KES',
    defaultDurationMinutes: 30,
    locationTypes: ['CLIENT_LOCATION'],
    targetSpecies: ['DOG'],
    variants: [],
    createdAt: now,
    updatedAt: now,
  });

  // 8. Locations & Service Areas
  // Nairobi West Vet Hospital Location (Public commercial clinic)
  store.saveLocation({
    locationId: asLocationId('loc-nairobi-west-clinic'),
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    providerId: SEED_PROVIDERS.DR_KIMANI,
    name: 'Nairobi West Animal Hospital Main Facility',
    category: 'COMMERCIAL_CLINIC',
    isPublicAddress: true,
    fullAddressPrivate: 'Plot 44, Langata Road opposite T-Mall, Nairobi West, Kenya',
    addressLine1Masked: 'Plot 44, Langata Road opposite T-Mall',
    city: 'Nairobi',
    stateOrRegion: 'Nairobi County',
    country: 'Kenya',
    coordinates: { lat: -1.3115, lng: 36.8194 },
    timezone: 'Africa/Nairobi',
    isPrimary: true,
    createdAt: pastYear,
  });

  // Sarah Mwangi Home Base (Private residence - Masked in public projection)
  store.saveLocation({
    locationId: asLocationId('loc-sarah-home-base'),
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    name: 'Kilimani Dispatch Office',
    category: 'PRIVATE_RESIDENCE',
    isPublicAddress: false, // Private!
    fullAddressPrivate: 'Apartment 4B, Wood Avenue Court, Wood Ave, Kilimani, Nairobi',
    addressLine1Masked: 'Kilimani, Nairobi',
    city: 'Nairobi',
    stateOrRegion: 'Nairobi County',
    country: 'Kenya',
    coordinates: { lat: -1.2921, lng: 36.7853 },
    timezone: 'Africa/Nairobi',
    isPrimary: true,
    createdAt: pastYear,
  });

  // Service Areas for Sarah Mwangi (Kilimani & Westlands dispatch zones)
  store.saveServiceArea({
    serviceAreaId: asServiceAreaId('sra-kilimani-zone'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    name: 'Kilimani & Lavington Service Zone',
    areaType: 'RADIUS_AROUND_LOCATION',
    centerLocationId: asLocationId('loc-sarah-home-base'),
    radiusKm: 6,
    isActive: true,
    createdAt: pastYear,
  });

  store.saveServiceArea({
    serviceAreaId: asServiceAreaId('sra-westlands-zone'),
    providerId: SEED_PROVIDERS.SARAH_MWANGI,
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    name: 'Westlands & Parklands Corridor',
    areaType: 'ADMIN_DISTRICT',
    districtName: 'Westlands Sub-County',
    isActive: true,
    createdAt: pastYear,
  });

  // 9. Availability Rules
  // Dr. Kimani: Mon-Fri 08:30 - 17:30
  for (let day = 1; day <= 5; day++) {
    store.saveAvailabilityRule({
      ruleId: asAvailabilityRuleId(`avr-kimani-day-${day}`),
      providerId: SEED_PROVIDERS.DR_KIMANI,
      businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
      dayOfWeek: day,
      startTime: '08:30',
      endTime: '17:30',
      timezone: 'Africa/Nairobi',
      maxConcurrentCapacity: 2,
      isActive: true,
    });
  }

  // Sarah Mwangi: Mon-Sat 07:30 - 18:00 (Group walks up to 4 dogs)
  for (let day = 1; day <= 6; day++) {
    store.saveAvailabilityRule({
      ruleId: asAvailabilityRuleId(`avr-sarah-day-${day}`),
      providerId: SEED_PROVIDERS.SARAH_MWANGI,
      businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
      dayOfWeek: day,
      startTime: '07:30',
      endTime: '18:00',
      timezone: 'Africa/Nairobi',
      maxConcurrentCapacity: 4,
      isActive: true,
    });
  }

  // Juma Ochieng: Tue-Sun 09:00 - 16:30
  const jumaDays = [0, 2, 3, 4, 5, 6];
  for (const day of jumaDays) {
    store.saveAvailabilityRule({
      ruleId: asAvailabilityRuleId(`avr-juma-day-${day}`),
      providerId: SEED_PROVIDERS.JUMA_OCHIENG,
      businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
      dayOfWeek: day,
      startTime: '09:00',
      endTime: '16:30',
      timezone: 'Africa/Nairobi',
      maxConcurrentCapacity: 1,
      isActive: true,
    });
  }

  // 10. Reports
  // Incident report on Kevin Kiprono (Suspended)
  store.saveReport({
    reportId: asProviderReportId('rep-kevin-safety-01'),
    reporterUserId: SEED_USERS.OWNER_ELENA,
    targetProviderId: SEED_PROVIDERS.KEVIN_KIPRONO,
    category: 'SAFETY_CONCERN',
    description: 'During scheduled pack walk in Uhuru Park, provider unclipped dog from 6ft lead without leash safety protocol near vehicular roadway. Dog ran onto grass near access street before being secured.',
    status: 'ACTION_REQUIRED',
    assignedReviewerUserId: SEED_USERS.ADMIN,
    resolutionNotes: 'Verified with photo evidence. Provider profile placed on administrative suspension pending formal remedial handling review.',
    createdAt: pastYear,
    resolvedAt: now,
  });
}
