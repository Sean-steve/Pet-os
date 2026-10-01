/**
 * Pet OS Sprint 10 - Automated Verification Test Suite
 * Validates:
 * 1. User, Provider, and Business identity decoupling
 * 2. Category-specific verification requirements (Vet vs Walker vs Trainer)
 * 3. Strict prohibition of provider self-verification
 * 4. Verification status vs Operational status decoupling
 * 5. Service offering activation eligibility guards
 * 6. Structured pricing & variants using Money value object
 * 7. Public vs Private projection data sanitization
 * 8. Business organizational boundaries and authorization
 * 9. Credential expiry detection and operational status restriction
 * 10. Verified trust badge provenance
 * 11. Geographic coverage areas & address privacy masking
 * 12. Future booking snapshot contract immutability
 * 13. Suspension cascades across service offerings
 * 14. Trust and safety reporting lifecycle
 */

import {
  UserId,
  asUserId,
  asProviderId,
  asBusinessId,
  asCredentialId,
  asServiceTypeId,
} from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { ProviderStore } from './store';
import { ProviderPlatformService } from './service';
import { ProviderPolicyEngine } from './policy';
import { seedProviderData, SEED_USERS, SEED_PROVIDERS, SEED_BUSINESSES } from './seed';

export interface TestResult {
  testId: string;
  name: string;
  description: string;
  category: 'IDENTITY' | 'VERIFICATION' | 'SERVICES' | 'PRIVACY' | 'ORGANIZATION' | 'TRUST_SAFETY';
  passed: boolean;
  durationMs: number;
  error?: string;
}

export class Sprint10TestSuite {
  private store: ProviderStore;
  private service: ProviderPlatformService;

  constructor() {
    this.store = ProviderStore.getInstance();
    this.service = new ProviderPlatformService(this.store);
  }

  private setupFreshState(): void {
    this.store.reset();
    seedProviderData(this.store);
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const tests = [
      () => this.testIdentityDecoupling(),
      () => this.testCategorySpecificVerificationRequirements(),
      () => this.testSelfVerificationProhibition(),
      () => this.testVerificationVsOperationalStatusSeparation(),
      () => this.testServiceOfferingActivationPolicyGuard(),
      () => this.testPricingAndVariantsIntegrity(),
      () => this.testPublicVsPrivateProjectionSanitization(),
      () => this.testBusinessOrganizationIsolation(),
      () => this.testCredentialExpiryAndStatusRestriction(),
      () => this.testTrustIndicatorProvenance(),
      () => this.testPrivateResidenceAddressMasking(),
      () => this.testBookingSnapshotContract(),
      () => this.testSuspensionCascadeOnLiveServices(),
      () => this.testTrustAndSafetyReportingLifecycle(),
    ];

    for (const testFn of tests) {
      const start = performance.now();
      try {
        this.setupFreshState();
        const result = await testFn();
        result.durationMs = Math.round(performance.now() - start);
        results.push(result);
      } catch (err: any) {
        results.push({
          testId: 'UNKNOWN_TEST',
          name: 'Unhandled Test Failure',
          description: 'Unexpected error during test execution',
          category: 'IDENTITY',
          passed: false,
          durationMs: Math.round(performance.now() - start),
          error: err.message || String(err),
        });
      }
    }

    // Restore demo state after test suite execution
    this.setupFreshState();
    return results;
  }

  // 1. Identity Decoupling
  private testIdentityDecoupling(): TestResult {
    const testId = 'TEST-PRV-001';
    const name = 'User, Provider, and Business Decoupled Aggregates';
    const description = 'Verifies that User, Provider, and Business are distinct entities with independent identifiers.';

    const user = IdentityStore.findUserById(SEED_USERS.VET_DR_KIMANI);
    const provider = this.store.getProvider(SEED_PROVIDERS.DR_KIMANI);
    const business = this.store.getBusiness(SEED_BUSINESSES.NAIROBI_WEST_VET);

    if (!user) throw new Error('User entity not found');
    if (!provider) throw new Error('Provider entity not found');
    if (!business) throw new Error('Business entity not found');

    if (provider.userId !== user.userId) {
      throw new Error(`Provider linked userId ${provider.userId} does not match expected ${user.userId}`);
    }

    if (business.ownerUserId !== user.userId) {
      throw new Error(`Business ownerUserId ${business.ownerUserId} does not match expected ${user.userId}`);
    }

    if ((provider.providerId as string) === (user.userId as string)) {
      throw new Error('Violation: ProviderId must be distinct from UserId');
    }

    if ((business.businessId as string) === (user.userId as string)) {
      throw new Error('Violation: BusinessId must be distinct from UserId');
    }

    return {
      testId,
      name,
      description,
      category: 'IDENTITY',
      passed: true,
      durationMs: 0,
    };
  }

  // 2. Category Verification Requirements
  private testCategorySpecificVerificationRequirements(): TestResult {
    const testId = 'TEST-PRV-002';
    const name = 'Category-Specific Credential Enforcement';
    const description = 'Enforces that Veterinarians require board licenses while Trainers require specialized certifications.';

    // Veterinarian check
    const vetReadinessWithoutLicense = ProviderPolicyEngine.evaluateVerificationReadiness('VETERINARIAN', [
      {
        credentialId: asCredentialId('crd-temp-1'),
        credentialType: 'GOVERNMENT_ID',
        title: 'ID',
        issuingAuthority: 'State',
        identifierMasked: '12***',
        issuedDate: '2020-01-01',
        verificationStatus: 'PENDING',
        createdAt: '2020-01-01',
        updatedAt: '2020-01-01',
      },
    ]);

    if (vetReadinessWithoutLicense.isReadyToSubmit) {
      throw new Error('Veterinarian should NOT be ready to submit without VETERINARY_LICENSE');
    }
    if (!vetReadinessWithoutLicense.missingMandatory.includes('VETERINARY_LICENSE')) {
      throw new Error('Missing mandatory should include VETERINARY_LICENSE');
    }

    // Trainer check
    const trainerReadinessWithoutCert = ProviderPolicyEngine.evaluateVerificationReadiness('TRAINER', [
      {
        credentialId: asCredentialId('crd-temp-2'),
        credentialType: 'GOVERNMENT_ID',
        title: 'ID',
        issuingAuthority: 'State',
        identifierMasked: '12***',
        issuedDate: '2020-01-01',
        verificationStatus: 'PENDING',
        createdAt: '2020-01-01',
        updatedAt: '2020-01-01',
      },
    ]);

    if (trainerReadinessWithoutCert.isReadyToSubmit) {
      throw new Error('Trainer should NOT be ready to submit without TRAINER_CERTIFICATION');
    }

    return {
      testId,
      name,
      description,
      category: 'VERIFICATION',
      passed: true,
      durationMs: 0,
    };
  }

  // 3. Prohibition of Self-Verification
  private testSelfVerificationProhibition(): TestResult {
    const testId = 'TEST-PRV-003';
    const name = 'Strict Prohibition of Provider Self-Verification';
    const description = 'Prevents an applicant user from reviewing or approving their own verification dossier.';

    const janeCases = this.store.getVerificationCasesForProvider(SEED_PROVIDERS.JANE_DOE);
    if (janeCases.length === 0) throw new Error('Jane Doe verification case not found');
    const caseRecord = janeCases[0];

    let caughtError = false;
    try {
      this.service.reviewVerificationCase(
        {
          caseId: caseRecord.caseId,
          decision: 'APPROVED',
          notes: 'Attempting self-approval',
        },
        SEED_USERS.APPLICANT_JANE // Self-review attempt!
      );
    } catch (err: any) {
      caughtError = true;
      if (!err.message.includes('Security violation')) {
        throw new Error(`Expected Security violation error message, got: ${err.message}`);
      }
    }

    if (!caughtError) {
      throw new Error('Security failure: Applicant successfully self-approved their own verification dossier!');
    }

    return {
      testId,
      name,
      description,
      category: 'VERIFICATION',
      passed: true,
      durationMs: 0,
    };
  }

  // 4. Verification vs Operational Status Decoupling
  private testVerificationVsOperationalStatusSeparation(): TestResult {
    const testId = 'TEST-PRV-004';
    const name = 'Verification vs Operational Status Decoupling';
    const description = 'Ensures a verified provider can change operational status without forfeiting verification.';

    const provider = this.store.getProvider(SEED_PROVIDERS.SARAH_MWANGI)!;
    if (provider.verificationStatus !== 'VERIFIED') throw new Error('Sarah should start VERIFIED');

    // Go on vacation
    const updated = this.service.setOperationalStatus(
      SEED_PROVIDERS.SARAH_MWANGI,
      'TEMPORARILY_INACTIVE',
      SEED_USERS.WALKER_SARAH
    );

    if (updated.operationalStatus !== 'TEMPORARILY_INACTIVE') {
      throw new Error(`Operational status should be TEMPORARILY_INACTIVE, got ${updated.operationalStatus}`);
    }

    if (updated.verificationStatus !== 'VERIFIED') {
      throw new Error(`Verification status should remain VERIFIED, got ${updated.verificationStatus}`);
    }

    // Resume operations
    const resumed = this.service.setOperationalStatus(
      SEED_PROVIDERS.SARAH_MWANGI,
      'ACTIVE',
      SEED_USERS.WALKER_SARAH
    );

    if (resumed.operationalStatus !== 'ACTIVE') {
      throw new Error(`Operational status should be ACTIVE, got ${resumed.operationalStatus}`);
    }

    return {
      testId,
      name,
      description,
      category: 'IDENTITY',
      passed: true,
      durationMs: 0,
    };
  }

  // 5. Service Offering Activation Policy Guard
  private testServiceOfferingActivationPolicyGuard(): TestResult {
    const testId = 'TEST-PRV-005';
    const name = 'Service Offering Activation Policy Guard';
    const description = 'Blocks unverified providers from publishing active service offerings.';

    const janeOfferings = this.store.getServiceOfferingsForProvider(SEED_PROVIDERS.JANE_DOE);
    if (janeOfferings.length === 0) throw new Error('Jane draft offering not found');
    const draftOffering = janeOfferings[0];

    let blocked = false;
    try {
      this.service.activateServiceOffering(draftOffering.serviceOfferingId, SEED_USERS.APPLICANT_JANE);
    } catch (err: any) {
      blocked = true;
      if (!err.message.includes('Service activation blocked')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!blocked) {
      throw new Error('Policy breach: Unverified provider was able to activate a service offering!');
    }

    return {
      testId,
      name,
      description,
      category: 'SERVICES',
      passed: true,
      durationMs: 0,
    };
  }

  // 6. Structured Pricing and Variants
  private testPricingAndVariantsIntegrity(): TestResult {
    const testId = 'TEST-PRV-006';
    const name = 'Structured Pricing & Service Variants (Money VO)';
    const description = 'Validates integer minor unit prices, duration tiers, and currency conformity.';

    const sarahWalks = this.store.getServiceOfferingsForProvider(SEED_PROVIDERS.SARAH_MWANGI);
    const walkOffering = sarahWalks.find(o => o.serviceTypeId === 'st-dog-walk');
    if (!walkOffering) throw new Error('Walk offering not found');

    if (walkOffering.basePriceMinorUnits !== 150000) {
      throw new Error(`Base price should be 150000 minor units (1,500 KES), got ${walkOffering.basePriceMinorUnits}`);
    }

    if (walkOffering.variants.length !== 3) {
      throw new Error(`Expected 3 variants (30m, 45m, 60m), got ${walkOffering.variants.length}`);
    }

    const quickVariant = walkOffering.variants.find(v => v.variantId === 'var-walk-quick-30');
    if (!quickVariant || quickVariant.priceMinorUnits !== 120000) {
      throw new Error('Quick 30m variant price mismatch');
    }

    return {
      testId,
      name,
      description,
      category: 'SERVICES',
      passed: true,
      durationMs: 0,
    };
  }

  // 7. Public vs Private Projection Sanitization
  private testPublicVsPrivateProjectionSanitization(): TestResult {
    const testId = 'TEST-PRV-007';
    const name = 'Public vs Private Data Projection Sanitization';
    const description = 'Verifies zero leakage of private credential documents or personal details in public API.';

    const publicProfile = this.service.getPublicProviderProfile(SEED_PROVIDERS.DR_KIMANI);
    if (!publicProfile) throw new Error('Public profile for Dr. Kimani not found');

    // Asserts no internal notes, no document URLs, no tax numbers in public view
    const stringified = JSON.stringify(publicProfile);
    if (stringified.includes('KVB-2024-0982') && stringified.includes('kvb_license_kimani.pdf')) {
      throw new Error('Data leak: Private credential document URL exposed in public provider profile!');
    }

    if (stringified.includes('rejectionReason') || stringified.includes('taxIdentifierMasked')) {
      throw new Error('Data leak: Internal administrative metadata exposed in public provider profile!');
    }

    // Asserts private dashboard contains full operational picture
    const privateDashboard = this.service.getPrivateProviderDashboard(
      SEED_PROVIDERS.DR_KIMANI,
      SEED_USERS.VET_DR_KIMANI
    );
    if (privateDashboard.credentials.length === 0) {
      throw new Error('Private dashboard should include credentials');
    }

    return {
      testId,
      name,
      description,
      category: 'PRIVACY',
      passed: true,
      durationMs: 0,
    };
  }

  // 8. Business Organization Boundaries
  private testBusinessOrganizationIsolation(): TestResult {
    const testId = 'TEST-PRV-008';
    const name = 'Business Organization Boundaries & Team RBAC';
    const description = 'Prevents unauthorized users from modifying team membership or business offerings.';

    let caught = false;
    try {
      this.service.addBusinessMember(
        {
          businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
          targetUserId: SEED_USERS.APPLICANT_JANE,
          role: 'STAFF',
        },
        SEED_USERS.WALKER_SARAH // Sarah does not manage Nairobi West Vet!
      );
    } catch (err: any) {
      caught = true;
      if (!err.message.includes('Access denied')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }

    if (!caught) {
      throw new Error('IDOR vulnerability: Unauthorized actor added member to foreign business!');
    }

    return {
      testId,
      name,
      description,
      category: 'ORGANIZATION',
      passed: true,
      durationMs: 0,
    };
  }

  // 9. Credential Expiry and Status Restriction
  private testCredentialExpiryAndStatusRestriction(): TestResult {
    const testId = 'TEST-PRV-009';
    const name = 'Credential Expiry Detection & Operational Downgrade';
    const description = 'Restricts operational status when mandatory credential expiry passes.';

    // Fast-forward time to 2 years in the future
    const futureTime = new Date(Date.now() + 730 * 24 * 3600 * 1000).toISOString();
    const result = this.service.checkAndProcessCredentialExpiries(futureTime);

    if (result.expiredCount === 0) {
      throw new Error('Expected credentials to expire in the future time simulation');
    }

    // Dr. Kimani's veterinary license will have expired, restricting operational status
    const vet = this.store.getProvider(SEED_PROVIDERS.DR_KIMANI)!;
    if (vet.operationalStatus !== 'RESTRICTED') {
      throw new Error(`Expected vet operational status to be RESTRICTED due to expired license, got ${vet.operationalStatus}`);
    }

    return {
      testId,
      name,
      description,
      category: 'VERIFICATION',
      passed: true,
      durationMs: 0,
    };
  }

  // 10. Trust Indicator Provenance
  private testTrustIndicatorProvenance(): TestResult {
    const testId = 'TEST-PRV-010';
    const name = 'Trust Badge Provenance and Validation';
    const description = 'Ensures trust indicators are tied to concrete verified credential records.';

    const badges = this.store.getTrustIndicatorsForProvider(SEED_PROVIDERS.SARAH_MWANGI);
    const insuranceBadge = badges.find(b => b.badgeType === 'INSURANCE_VERIFIED');

    if (!insuranceBadge) throw new Error('Insurance badge not found for Sarah');
    if (!insuranceBadge.linkedCredentialId) {
      throw new Error('Trust badge must be linked to a concrete verified CredentialId');
    }

    const linkedCred = this.store.getCredential(insuranceBadge.linkedCredentialId);
    if (!linkedCred || linkedCred.verificationStatus !== 'VERIFIED') {
      throw new Error('Linked credential for trust badge is not verified');
    }

    return {
      testId,
      name,
      description,
      category: 'TRUST_SAFETY',
      passed: true,
      durationMs: 0,
    };
  }

  // 11. Private Residence Address Masking
  private testPrivateResidenceAddressMasking(): TestResult {
    const testId = 'TEST-PRV-011';
    const name = 'Operating Location Privacy & Address Masking';
    const description = 'Shields exact residential street addresses of in-home providers from public view.';

    const publicProfile = this.service.getPublicProviderProfile(SEED_PROVIDERS.SARAH_MWANGI);
    if (!publicProfile) throw new Error('Public profile for Sarah not found');

    // Public locations should be empty or only commercial
    if (publicProfile.publicLocations.length > 0) {
      for (const loc of publicProfile.publicLocations) {
        if (loc.category === 'PRIVATE_RESIDENCE') {
          throw new Error('Privacy breach: Private residence exposed in publicLocations!');
        }
      }
    }

    // Service areas should communicate coverage radius without leaking street address
    if (publicProfile.serviceAreas.length === 0) {
      throw new Error('Expected service areas to be visible');
    }

    return {
      testId,
      name,
      description,
      category: 'PRIVACY',
      passed: true,
      durationMs: 0,
    };
  }

  // 12. Booking Snapshot Contract
  private testBookingSnapshotContract(): TestResult {
    const testId = 'TEST-PRV-012';
    const name = 'Future Booking Offering Snapshot Contract';
    const description = 'Generates immutable price and duration snapshot for downstream booking and payments.';

    const offerings = this.store.getServiceOfferingsForProvider(SEED_PROVIDERS.SARAH_MWANGI);
    const walkOffering = offerings.find(o => o.serviceTypeId === 'st-dog-walk')!;

    const snapshot = this.service.getBookingSnapshot(walkOffering.serviceOfferingId, 'var-walk-power-60');

    if (snapshot.durationMinutes !== 60) {
      throw new Error(`Expected 60 minutes duration, got ${snapshot.durationMinutes}`);
    }
    if (snapshot.priceMinorUnits !== 200000) {
      throw new Error(`Expected 200000 minor units (2,000 KES), got ${snapshot.priceMinorUnits}`);
    }
    if (!snapshot.snapshotTimestamp) {
      throw new Error('Snapshot must include timestamp');
    }

    return {
      testId,
      name,
      description,
      category: 'SERVICES',
      passed: true,
      durationMs: 0,
    };
  }

  // 13. Suspension Cascade
  private testSuspensionCascadeOnLiveServices(): TestResult {
    const testId = 'TEST-PRV-013';
    const name = 'Administrative Suspension Cascade on Offerings';
    const description = 'Ensures provider suspension disables operational status and pauses active offerings.';

    const suspended = this.service.suspendProvider(
      SEED_PROVIDERS.DR_KIMANI,
      'Safety investigation',
      SEED_USERS.ADMIN
    );

    if (suspended.verificationStatus !== 'SUSPENDED' || suspended.operationalStatus !== 'SUSPENDED') {
      throw new Error('Provider status should transition to SUSPENDED');
    }

    const offerings = this.store.getServiceOfferingsForProvider(SEED_PROVIDERS.DR_KIMANI);
    for (const o of offerings) {
      if (o.status === 'ACTIVE') {
        throw new Error(`Offering ${o.serviceOfferingId} should have been suspended, remains ACTIVE`);
      }
    }

    return {
      testId,
      name,
      description,
      category: 'TRUST_SAFETY',
      passed: true,
      durationMs: 0,
    };
  }

  // 14. Trust and Safety Reporting Lifecycle
  private testTrustAndSafetyReportingLifecycle(): TestResult {
    const testId = 'TEST-PRV-014';
    const name = 'Trust & Safety Report Filing & Resolution';
    const description = 'Enables pet owners to report policy violations and administrators to resolve cases.';

    const report = this.service.submitReport(
      {
        targetProviderId: SEED_PROVIDERS.SARAH_MWANGI,
        category: 'INACCURATE_PROFILE',
        description: 'Listing says 6 years experience but bio mentions 5 years.',
      },
      SEED_USERS.OWNER_ELENA
    );

    if (report.status !== 'OPEN') throw new Error('Report should initialize as OPEN');

    const resolved = this.service.resolveReport(
      report.reportId,
      'RESOLVED',
      'Contacted provider to synchronize bio wording.',
      SEED_USERS.ADMIN
    );

    if (resolved.status !== 'RESOLVED') throw new Error('Report status should be RESOLVED');
    if (resolved.assignedReviewerUserId !== SEED_USERS.ADMIN) {
      throw new Error('Reviewer ID should be recorded');
    }

    return {
      testId,
      name,
      description,
      category: 'TRUST_SAFETY',
      passed: true,
      durationMs: 0,
    };
  }
}
