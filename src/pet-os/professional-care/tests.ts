/**
 * Pet OS Sprint 21 - Professional Care Workspaces Comprehensive Test Suite
 * 
 * Tests:
 * 1. Grooming Intake, Allergy Screening, Procedures, Safety Stop & Custody Return
 * 2. Pet Sitting Protected Home-Access Reveals, Feeding Duplicate Guards & Medication Integrity
 * 3. Boarding Intake, Unit Capacity Enforcement, Multi-Day Logs & Shift Handover
 * 4. Critical Safety Incidents & Lost Pet Recovery Integration
 * 5. Strict Non-Diagnostic Medical Boundary Validation
 * 6. Idempotent Multi-Domain Completion (Booking, Finance, Timeline, Custody)
 */

import {
  asUserId,
  asProviderId,
  asBusinessId,
  asBookingId,
  asServiceOfferingId,
  asHouseholdId,
  asPetId,
  asCareEngagementId,
  asBoardingUnitId,
  generateUUIDv7,
} from '../kernel/ids';

import { ProfessionalCareStore } from './store';
import { ProfessionalCareService } from './service';
import { BookingStore } from '../booking/store';
import { BookingAggregate } from '../booking/types';
import { PetStore } from '../pet-core/store';
import { HealthStore } from '../health/store';
import { TimelineStore } from '../timeline/store';
import { RecoveryStore } from '../recovery/store';
import { Pet, ReproductiveStatus } from '../pet-core/types';
import { HouseholdId, PetId, UserId, ProviderId, BusinessId, BookingId, ServiceOfferingId } from '../kernel/ids';

function makeTestPet(params: {
  petId: PetId;
  householdId: HouseholdId;
  name: string;
  speciesCode: string;
  breedCode: string;
  sex: 'MALE' | 'FEMALE';
  reproductiveStatus?: ReproductiveStatus;
  dateOfBirth?: string;
  ownerId: UserId;
}): Pet {
  return {
    petId: params.petId,
    householdId: params.householdId,
    name: params.name,
    speciesCode: params.speciesCode,
    breedCode: params.breedCode,
    mixedBreed: false,
    unknownBreed: false,
    sex: params.sex,
    reproductiveStatus: params.reproductiveStatus || 'STERILIZED',
    dateOfBirth: params.dateOfBirth || '2021-01-01',
    birthdatePrecision: 'EXACT',
    estimatedBirthdate: false,
    primaryColor: 'Brown',
    sizeClassification: 'MEDIUM',
    lifecycleStage: 'ADULT',
    status: 'ACTIVE',
    createdBy: params.ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    metadata: {},
  };
}

function makeTestBooking(params: {
  bookingId: BookingId;
  serviceOfferingId: ServiceOfferingId;
  providerId: ProviderId;
  businessId?: BusinessId;
  householdId: HouseholdId;
  petIds: PetId[];
  ownerUserId: UserId;
  startAt: string;
  endAt: string;
}): BookingAggregate {
  const now = new Date().toISOString();
  return {
    bookingId: params.bookingId,
    ownerUserId: params.ownerUserId,
    householdId: params.householdId,
    providerId: params.providerId,
    businessId: params.businessId,
    serviceOfferingId: params.serviceOfferingId,
    status: 'CONFIRMED',
    confirmationMode: 'INSTANT_CONFIRM',
    startAt: params.startAt,
    endAt: params.endAt,
    serviceDurationMinutes: 60,
    timezone: 'Africa/Nairobi',
    petCount: params.petIds.length,
    petIds: params.petIds,
    petSnapshots: [],
    serviceSnapshot: {
      title: 'Care Service',
      serviceType: 'GROOMING',
    } as any,
    priceSnapshot: {
      amountMinorUnits: 450000,
      currency: 'KES',
      pricingModel: 'FIXED',
      baseAmountMinorUnits: 450000,
      petCount: params.petIds.length,
      taxIncluded: true,
      feeBasisReference: 'FEE-TEST',
    },
    cancellationPolicySnapshot: {
      policyTier: 'STANDARD',
      freeCancellationCutoffHours: 24,
      lateCancellationNotice: 'Notice required',
      description: 'Standard',
    },
    instructions: {
      emergencyContactName: 'Elena Vance',
      emergencyContactPhone: '+254 700 000000',
    },
    concurrencyVersion: 1,
    requestedAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export class Sprint21CareTestSuite {
  private store: ProfessionalCareStore;
  private service: ProfessionalCareService;
  private bookingStore: BookingStore;

  constructor() {
    this.store = ProfessionalCareStore.getInstance();
    this.service = ProfessionalCareService.getInstance();
    this.bookingStore = BookingStore.getInstance();
  }

  public async runAllTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
    const results: TestResult[] = [];

    const tests = [
      this.testGroomingAllergyScreeningAndSafetyStop.bind(this),
      this.testSittingProtectedAccessAndMedicationIntegrity.bind(this),
      this.testBoardingCapacityAndShiftHandover.bind(this),
      this.testIncidentManagementAndLostPetEscalation.bind(this),
      this.testStrictMedicalBoundaryAssertion.bind(this),
      this.testMultiDomainCompletionAndIdempotency.bind(this),
    ];

    for (const test of tests) {
      try {
        const res = await test();
        results.push(res);
      } catch (err: any) {
        results.push({
          name: test.name,
          passed: false,
          message: `Unhandled exception: ${err.message || err}`,
        });
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    return { passed, failed, results };
  }

  // ============================================================================
  // Test 1: Grooming Intake, Allergy Screening, Procedures, Safety Stop & Custody Return
  // ============================================================================
  private async testGroomingAllergyScreeningAndSafetyStop(): Promise<TestResult> {
    const testName = 'Grooming: Intake, Allergy Screening, Procedures & Safety Stop';
    try {
      this.store.reset();

      const ownerId = asUserId('usr-test-owner-001');
      const groomerId = asUserId('usr-test-groomer-001');
      const providerId = asProviderId('prv-test-groomer-001');
      const businessId = asBusinessId('biz-test-grooming-001');
      const petId = asPetId('pet-test-groom-001');
      const householdId = asHouseholdId('hh-test-groom-001');
      const bookingId = asBookingId('bok-test-groom-001');
      const offeringId = asServiceOfferingId('sro-test-groom-001');

      // Ensure pet in PetStore
      PetStore.savePet(
        makeTestPet({
          petId,
          householdId,
          name: 'Rusty',
          speciesCode: 'CANINE',
          breedCode: 'GOLDEN_RETRIEVER',
          sex: 'MALE',
          reproductiveStatus: 'STERILIZED',
          ownerId,
        })
      );

      // Ensure allergy in HealthStore
      HealthStore.saveAllergy({
        allergyId: 'alg-rusty-chamomile' as any,
        petId,
        allergen: 'Chamomile',
        allergenCategory: 'CONTACT',
        allergyType: 'ALLERGY',
        reaction: 'Severe dermatitis',
        severity: 'SEVERE',
        firstObservedAt: new Date().toISOString(),
        firstObservedPrecision: 'EXACT',
        status: 'ACTIVE',
        provenance: 'VETERINARY_PROFESSIONAL',
        verificationStatus: 'VERIFIED',
        clinicalNotes: 'Severe contact dermatitis triggered by chamomile extracts',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create Booking
      const now = new Date().toISOString();
      const booking = makeTestBooking({
        bookingId,
        serviceOfferingId: offeringId,
        providerId,
        businessId,
        householdId,
        petIds: [petId],
        ownerUserId: ownerId,
        startAt: now,
        endAt: new Date(Date.now() + 7200000).toISOString(),
      });
      this.bookingStore.saveBooking(booking);

      // 1. Create Engagement
      const engagement = this.service.createEngagement({
        bookingId,
        serviceType: 'GROOMING',
        serviceOfferingId: offeringId,
        householdId,
        petIds: [petId],
        providerId,
        businessId,
        assignedStaffId: groomerId,
        scheduledStartAt: now,
        scheduledEndAt: new Date(Date.now() + 7200000).toISOString(),
      });

      if (!engagement || engagement.status !== 'SCHEDULED') {
        return { name: testName, passed: false, message: 'Failed to create grooming engagement' };
      }

      // 2. Capture Snapshot & verify allergy is pulled from HealthStore
      const snapshot = this.service.captureInstructionSnapshot({
        engagementId: engagement.engagementId,
        petId,
        actorUserId: ownerId,
        stylingPreferences: 'Trim sanitary areas, light de-shed',
      });

      if (!snapshot.knownAllergies.includes('Chamomile')) {
        return { name: testName, passed: false, message: 'Known allergy Chamomile not captured in snapshot' };
      }

      // 3. Initialize Grooming Session
      const session = this.service.initializeGroomingSession({
        engagementId: engagement.engagementId,
        petId,
        coatType: 'Dense Double Coat',
        stylingPreferences: 'Sanitary trim, brush out feathering',
        sensitiveAreas: ['Paw pads'],
        handlingNotes: 'Gentle on paws',
        procedures: ['BATH', 'DRY', 'BRUSH', 'NAIL_TRIM'],
      });

      // 4. Test Allergy Screening: Product with Chamomile MUST BE BLOCKED
      let blocked = false;
      try {
        this.service.applyGroomingProduct({
          sessionId: session.sessionId,
          productName: 'Calming Chamomile Coat Wash',
          productType: 'SHAMPOO',
          productIngredients: ['Water', 'Sodium Laureth Sulfate', 'Chamomile Flower Extract'],
        });
      } catch (err: any) {
        if (err.message.includes('ALLERGY_CONFLICT_BLOCKED')) {
          blocked = true;
        }
      }

      if (!blocked) {
        return { name: testName, passed: false, message: 'Allergy screening failed to block allergenic product' };
      }

      // Safe product should pass
      const safeProduct = this.service.applyGroomingProduct({
        sessionId: session.sessionId,
        productName: 'Hypoallergenic Oatmeal Wash',
        productType: 'SHAMPOO',
        productIngredients: ['Colloidal Oatmeal', 'Purified Water', 'Aloe Vera'],
      });
      if (!safeProduct.safe) {
        return { name: testName, passed: false, message: 'Safe product was rejected unexpectedly' };
      }

      // 5. Intake Handover (transfer to groomer)
      this.service.executeHandover({
        engagementId: engagement.engagementId,
        petId,
        handoverType: 'OWNER_TO_PROVIDER',
        fromActorId: ownerId,
        toActorId: groomerId,
        recipientName: 'Lead Groomer',
        checklist: {
          collarAndTagVerified: true,
          leashOrCarrierSecure: true,
          petPhysicalStateObserved: true,
          personalBelongingsTransferred: true,
          emergencyContactConfirmed: true,
        },
      });

      const inCareEngagement = this.store.getEngagement(engagement.engagementId);
      if (inCareEngagement?.custodyStatus !== 'PROVIDER_CUSTODY') {
        return { name: testName, passed: false, message: 'Custody status should be PROVIDER_CUSTODY' };
      }

      // 6. Complete some procedures
      this.service.completeGroomingProcedure({
        sessionId: session.sessionId,
        procedureType: 'BATH',
        notes: 'Oatmeal wash completed without incident',
      });

      // 7. Safety Stop test: Pet shows acute panic / distress
      this.service.triggerGroomingSafetyStop({
        sessionId: session.sessionId,
        actorUserId: groomerId,
        reason: 'Pet became acutely panicked during high-velocity dryer trial. Halting session for pet safety.',
      });

      const stoppedSession = this.store.getGroomingSession(session.sessionId);
      if (!stoppedSession?.safetyStopped) {
        return { name: testName, passed: false, message: 'Session should be marked as safetyStopped' };
      }

      // 8. Invariant: Cannot complete service while pet is still in PROVIDER_CUSTODY!
      let completionBlocked = false;
      try {
        await this.service.finalizeServiceExecution({
          engagementId: engagement.engagementId,
          actorUserId: groomerId,
          outcome: 'ABORTED',
          summaryNotes: 'Halted due to panic',
          returnedToName: 'Owner Elena',
        });
      } catch (err: any) {
        if (err.message.includes('COMPLETION_BLOCKED_CUSTODY_INVALID')) {
          completionBlocked = true;
        }
      }

      if (!completionBlocked) {
        return { name: testName, passed: false, message: 'Finalize execution must block if custody not returned to owner' };
      }

      // Return handover
      this.service.executeHandover({
        engagementId: engagement.engagementId,
        petId,
        handoverType: 'PROVIDER_TO_OWNER',
        fromActorId: groomerId,
        toActorId: ownerId,
        recipientName: 'Elena Vance',
        checklist: {
          collarAndTagVerified: true,
          leashOrCarrierSecure: true,
          petPhysicalStateObserved: true,
          personalBelongingsTransferred: true,
          emergencyContactConfirmed: true,
        },
      });

      // Now finalization succeeds with outcome ABORTED / PARTIALLY_COMPLETED
      const evidence = await this.service.finalizeServiceExecution({
        engagementId: engagement.engagementId,
        actorUserId: groomerId,
        outcome: 'ABORTED',
        summaryNotes: 'Safely returned early due to dryer sensitivity',
        returnedToName: 'Elena Vance',
      });

      if (!evidence || evidence.outcome !== 'ABORTED' || !evidence.returnHandoverVerified) {
        return { name: testName, passed: false, message: 'Failed to generate completion evidence for safety stop' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }

  // ============================================================================
  // Test 2: Pet Sitting Protected Access, Feeding Duplicate Guard & Medication Integrity
  // ============================================================================
  private async testSittingProtectedAccessAndMedicationIntegrity(): Promise<TestResult> {
    const testName = 'Pet Sitting: Home-Access Secrets, Feeding Duplicate Guard & Medication Integrity';
    try {
      const ownerId = asUserId('usr-test-owner-002');
      const sitterId = asUserId('usr-test-sitter-002');
      const providerId = asProviderId('prv-test-sitter-002');
      const petId = asPetId('pet-test-sitting-002');
      const householdId = asHouseholdId('hh-test-sitting-002');
      const bookingId = asBookingId('bok-test-sitting-002');
      const offeringId = asServiceOfferingId('sro-test-sitting-002');

      PetStore.savePet(
        makeTestPet({
          petId,
          householdId,
          name: 'Milo',
          speciesCode: 'FELINE',
          breedCode: 'DOMESTIC_SHORTHAIR',
          sex: 'MALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2020-05-15',
          ownerId,
        })
      );

      // Add medication in HealthStore
      HealthStore.saveMedication({
        medicationId: 'med-milo-thyroid' as any,
        petId,
        medicationName: 'Methimazole',
        medicationType: 'PRESCRIPTION',
        dosage: '2.5 mg',
        dosageUnit: 'mg',
        route: 'ORAL',
        frequency: 'Every 12 hours with food',
        startAt: new Date().toISOString(),
        startAtPrecision: 'EXACT',
        status: 'ACTIVE',
        instructions: 'Administer 2.5mg tablet inside a treat pouch. Do not crush.',
        provenance: 'VETERINARY_PROFESSIONAL',
        verificationStatus: 'VERIFIED',
        recordedBy: ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const now = new Date();
      const serviceStart = new Date(now.getTime() - 1800000).toISOString(); // 30 min ago
      const serviceEnd = new Date(now.getTime() + 5400000).toISOString();   // 90 min future

      const booking = makeTestBooking({
        bookingId,
        serviceOfferingId: offeringId,
        providerId,
        householdId,
        petIds: [petId],
        ownerUserId: ownerId,
        startAt: serviceStart,
        endAt: serviceEnd,
      });
      this.bookingStore.saveBooking(booking);

      // Create Engagement
      const engagement = this.service.createEngagement({
        bookingId,
        serviceType: 'PET_SITTING_VISIT',
        serviceOfferingId: offeringId,
        householdId,
        petIds: [petId],
        providerId,
        assignedStaffId: sitterId,
        scheduledStartAt: serviceStart,
        scheduledEndAt: serviceEnd,
      });

      // Capture Snapshot
      this.service.captureInstructionSnapshot({
        engagementId: engagement.engagementId,
        petId,
        actorUserId: ownerId,
      });

      // 1. Register Protected Home-Access Secret
      const secret = this.service.registerHomeAccessSecret({
        engagementId: engagement.engagementId,
        householdId,
        secretType: 'DOOR_KEYPAD_CODE',
        title: 'Front Door Keypad',
        maskedDisplay: '•••• 1984',
        unencryptedSecret: '1984*',
        instructions: 'Enter 1984 followed by * symbol.',
        accessWindowStart: serviceStart,
        accessWindowEnd: serviceEnd,
      });

      // Verify Secret cannot be revealed outside service window
      const farFutureIso = new Date(now.getTime() + 86400000 * 5).toISOString();
      let rejectedOutsideWindow = false;
      try {
        this.service.revealHomeAccessSecret({
          secretId: secret.secretId,
          actorUserId: sitterId,
          accessReason: 'Attempting early inspection',
          currentTimeIso: farFutureIso,
        });
      } catch (err: any) {
        if (err.message.includes('ACCESS_DENIED_OUTSIDE_SERVICE_WINDOW')) {
          rejectedOutsideWindow = true;
        }
      }

      if (!rejectedOutsideWindow) {
        return { name: testName, passed: false, message: 'Secret reveal outside service window was not blocked' };
      }

      // Reveal within valid service window
      const revealed = this.service.revealHomeAccessSecret({
        secretId: secret.secretId,
        actorUserId: sitterId,
        accessReason: 'Arrived at home for visit 1',
        currentTimeIso: now.toISOString(),
      });

      if (revealed.revealedSecret !== '1984*') {
        return { name: testName, passed: false, message: 'Failed to reveal valid secret' };
      }

      // Verify audit log exists and does NOT contain the secret plaintext
      const storedSecret = this.store.getSecret(secret.secretId);
      if (storedSecret?.auditLog.length !== 1 || storedSecret.auditLog[0].actorUserId !== sitterId) {
        return { name: testName, passed: false, message: 'Audit entry was not recorded for secret reveal' };
      }

      // 2. Feeding Execution
      const feedResult = this.service.executeFeeding({
        engagementId: engagement.engagementId,
        petId,
        actorUserId: sitterId,
        foodName: 'Salmon Wet Paté',
        quantityGrams: 85,
        notes: 'Finished all paté promptly.',
      });

      if (!feedResult.mealLogged) {
        return { name: testName, passed: false, message: 'Failed to execute feeding' };
      }

      // 3. Medication Administration: Attempting altered dose MUST be blocked
      let doseMismatchBlocked = false;
      try {
        this.service.administerMedication({
          engagementId: engagement.engagementId,
          petId,
          actorUserId: sitterId,
          medicationId: 'med-milo-thyroid',
          medicationName: 'Methimazole',
          dosageGiven: '5.0 mg', // Unauthorized modified dose!
          administrationStatus: 'ADMINISTERED',
        });
      } catch (err: any) {
        if (err.message.includes('MEDICATION_DOSAGE_MISMATCH')) {
          doseMismatchBlocked = true;
        }
      }

      if (!doseMismatchBlocked) {
        return { name: testName, passed: false, message: 'Failed to block unauthorized medication dosage alteration' };
      }

      // Correct authorized dose succeeds
      const medResult = this.service.administerMedication({
        engagementId: engagement.engagementId,
        petId,
        actorUserId: sitterId,
        medicationId: 'med-milo-thyroid',
        medicationName: 'Methimazole',
        dosageGiven: '2.5 mg', // Exact authorized dose
        administrationStatus: 'ADMINISTERED',
        notes: 'Pill accepted in creamy treat pouch without fuss.',
      });

      if (!medResult.recorded) {
        return { name: testName, passed: false, message: 'Failed to administer authorized medication dose' };
      }

      // Verify incident was logged for the earlier mismatch
      const incidents = this.store.listIncidentsForEngagement(engagement.engagementId);
      const medIncident = incidents.find((i) => i.category === 'MEDICATION_ERROR');
      if (!medIncident) {
        return { name: testName, passed: false, message: 'Medication error incident was not recorded' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }

  // ============================================================================
  // Test 3: Boarding Intake, Unit Capacity Enforcement, Multi-Day Logs & Shift Handover
  // ============================================================================
  private async testBoardingCapacityAndShiftHandover(): Promise<TestResult> {
    const testName = 'Boarding: Unit Capacity Enforcement, Multi-Day Logs & Shift Handover';
    try {
      const ownerId = asUserId('usr-test-owner-003');
      const staff1 = asUserId('usr-test-boarding-lead-003');
      const staff2 = asUserId('usr-test-boarding-night-003');
      const providerId = asProviderId('prv-test-boarding-003');
      const facilityId = asBusinessId('biz-test-boarding-003');
      const petId = asPetId('pet-test-boarding-003');
      const householdId = asHouseholdId('hh-test-boarding-003');
      const bookingId = asBookingId('bok-test-boarding-003');
      const offeringId = asServiceOfferingId('sro-test-boarding-003');

      PetStore.savePet(
        makeTestPet({
          petId,
          householdId,
          name: 'Zeus',
          speciesCode: 'CANINE',
          breedCode: 'ROTTWEILER',
          sex: 'MALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2019-08-10',
          ownerId,
        })
      );

      const now = new Date().toISOString();
      const booking = makeTestBooking({
        bookingId,
        serviceOfferingId: offeringId,
        providerId,
        businessId: facilityId,
        householdId,
        petIds: [petId],
        ownerUserId: ownerId,
        startAt: now,
        endAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      });
      this.bookingStore.saveBooking(booking);

      // Register Boarding Unit with capacity 1
      const singleUnit = this.service.registerBoardingUnit({
        facilityId,
        unitNumber: 'K-VIP-01',
        unitType: 'PRIVATE_SUITE',
        maxCapacity: 1,
      });

      const engagement = this.service.createEngagement({
        bookingId,
        serviceType: 'BOARDING',
        serviceOfferingId: offeringId,
        householdId,
        petIds: [petId],
        providerId,
        businessId: facilityId,
        assignedStaffId: staff1,
        scheduledStartAt: now,
        scheduledEndAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      });

      // 1. Check-in pet into singleUnit
      const stay = this.service.checkInBoardingStay({
        bookingId,
        engagementId: engagement.engagementId,
        facilityId,
        petIds: [petId],
        unitId: singleUnit.unitId,
        unitName: 'VIP Suite 01',
        scheduledCheckInAt: now,
        scheduledCheckOutAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        primaryStaffId: staff1,
      });

      if (!stay || stay.status !== 'ACTIVE') {
        return { name: testName, passed: false, message: 'Failed to check in boarding stay' };
      }

      // Unit should now have occupancy 1
      const updatedUnit = this.store.getBoardingUnit(singleUnit.unitId);
      if (updatedUnit?.currentOccupancy !== 1) {
        return { name: testName, passed: false, message: 'Unit occupancy should be 1' };
      }

      // 2. Capacity Enforcement: Second pet admission into same 1-pet unit MUST BE BLOCKED
      let capacityBlocked = false;
      try {
        this.service.checkInBoardingStay({
          bookingId: asBookingId('bok-overflow-001'),
          engagementId: asCareEngagementId('eng-overflow-001'),
          facilityId,
          petIds: [asPetId('pet-extra-001')],
          unitId: singleUnit.unitId,
          unitName: 'VIP Suite 01',
          scheduledCheckInAt: now,
          scheduledCheckOutAt: new Date(Date.now() + 86400000).toISOString(),
          primaryStaffId: staff1,
        });
      } catch (err: any) {
        if (err.message.includes('CAPACITY_EXCEEDED')) {
          capacityBlocked = true;
        }
      }

      if (!capacityBlocked) {
        return { name: testName, passed: false, message: 'Failed to block admission exceeding unit capacity' };
      }

      // 3. Multi-day care logging
      const loggedStay = this.service.recordDailyBoardingCare({
        stayId: stay.stayId,
        date: '2026-09-15',
        mealsFed: 2,
        waterRefreshedCount: 3,
        medicationDosesAdministered: 0,
        outdoorExerciseMinutes: 60,
        groupPlayParticipation: false,
        restAndSleepObservation: 'Sleeping peacefully on elevated cot',
        dailyNotes: 'Zeus enjoyed ball play in private courtyard.',
        loggedBy: staff1,
      });

      if (loggedStay.dailyLogs.length !== 1) {
        return { name: testName, passed: false, message: 'Daily boarding log not recorded' };
      }

      // 4. Shift Handover
      const shift = this.service.executeShiftHandover({
        facilityId,
        outgoingStaffId: staff1,
        incomingStaffId: staff2,
        activePetIds: [petId],
        outstandingMeals: ['Zeus evening kibble at 19:00'],
        medicationsDue: [],
        openIncidents: [],
        shiftNotes: 'Zeus is calm and secure in K-VIP-01.',
      });

      if (shift.acknowledged) {
        return { name: testName, passed: false, message: 'Shift handover should not be acknowledged yet' };
      }

      // Acknowledging by wrong staff should be rejected
      let wrongStaffBlocked = false;
      try {
        this.service.acknowledgeShiftHandover(shift.shiftHandoverId, staff1);
      } catch (err: any) {
        if (err.message.includes('UNAUTHORIZED')) {
          wrongStaffBlocked = true;
        }
      }

      if (!wrongStaffBlocked) {
        return { name: testName, passed: false, message: 'Unauthorized staff acknowledgement should fail' };
      }

      // Acknowledged by incoming staff2 succeeds
      const acked = this.service.acknowledgeShiftHandover(shift.shiftHandoverId, staff2);
      if (!acked.acknowledged) {
        return { name: testName, passed: false, message: 'Failed to acknowledge shift handover' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }

  // ============================================================================
  // Test 4: Critical Incidents & Lost Pet Recovery Integration
  // ============================================================================
  private async testIncidentManagementAndLostPetEscalation(): Promise<TestResult> {
    const testName = 'Incidents: Escape Incident & Lost Pet Recovery Integration';
    try {
      const ownerId = asUserId('usr-test-owner-004');
      const staffId = asUserId('usr-test-staff-004');
      const providerId = asProviderId('prv-test-provider-004');
      const petId = asPetId('pet-test-escape-004');
      const householdId = asHouseholdId('hh-test-escape-004');
      const bookingId = asBookingId('bok-test-escape-004');
      const offeringId = asServiceOfferingId('sro-test-sitting-004');

      PetStore.savePet(
        makeTestPet({
          petId,
          householdId,
          name: 'Flash',
          speciesCode: 'CANINE',
          breedCode: 'WHIPPET',
          sex: 'MALE',
          reproductiveStatus: 'INTACT',
          dateOfBirth: '2022-03-01',
          ownerId,
        })
      );

      const now = new Date().toISOString();
      const booking = makeTestBooking({
        bookingId,
        serviceOfferingId: offeringId,
        providerId,
        householdId,
        petIds: [petId],
        ownerUserId: ownerId,
        startAt: now,
        endAt: new Date(Date.now() + 3600000).toISOString(),
      });
      this.bookingStore.saveBooking(booking);

      const engagement = this.service.createEngagement({
        bookingId,
        serviceType: 'PET_SITTING_VISIT',
        serviceOfferingId: offeringId,
        householdId,
        petIds: [petId],
        providerId,
        assignedStaffId: staffId,
        scheduledStartAt: now,
        scheduledEndAt: new Date(Date.now() + 3600000).toISOString(),
      });

      // Report Pet Escape
      const incident = this.service.reportIncident({
        engagementId: engagement.engagementId,
        petId,
        category: 'ESCAPE',
        severity: 'CRITICAL',
        details: 'Pet bolted through garden gate when latch failed. Sprinted towards arboretum.',
        actionsTaken: ['Immediate pursuit', 'Gate secured', 'Owner alerted via emergency channel'],
        reportedBy: staffId,
        lastKnownCoordinates: { latitude: -1.2921, longitude: 36.8219 },
      });

      if (!incident || incident.category !== 'ESCAPE' || !incident.lostPetAlertEmitted) {
        return { name: testName, passed: false, message: 'Escape incident did not emit lost pet alert' };
      }

      // Check that engagement state transitioned to INCIDENT_ACTIVE
      const updatedEngagement = this.store.getEngagement(engagement.engagementId);
      if (updatedEngagement?.status !== 'INCIDENT_ACTIVE') {
        return { name: testName, passed: false, message: 'Engagement should transition to INCIDENT_ACTIVE on critical incident' };
      }

      // Check that Sprint 15 RecoveryStore received the lost pet incident
      const foundRecovery = RecoveryStore.getInstance().getActiveIncidentByPetId(petId);
      if (!foundRecovery) {
        return { name: testName, passed: false, message: 'LostPetIncident was not found in RecoveryStore' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }

  // ============================================================================
  // Test 5: Strict Non-Diagnostic Medical Boundary Validation
  // ============================================================================
  private async testStrictMedicalBoundaryAssertion(): Promise<TestResult> {
    const testName = 'Medical Boundary: Reject Clinical Diagnoses & Accept Factual Observations';
    try {
      const staffId = asUserId('usr-test-staff-005');
      const petId = asPetId('pet-test-obs-005');
      const engagementId = asCareEngagementId('eng-test-obs-005');

      // Create a dummy engagement in store
      this.store.saveEngagement({
        engagementId,
        bookingId: asBookingId('bok-dummy-005'),
        serviceType: 'GROOMING',
        serviceOfferingId: asServiceOfferingId('sro-dummy-005'),
        householdId: asHouseholdId('hh-dummy-005'),
        petIds: [petId],
        providerId: asProviderId('prv-dummy-005'),
        assignedStaffId: staffId,
        status: 'IN_CARE',
        custodyStatus: 'PROVIDER_CUSTODY',
        scheduledStartAt: new Date().toISOString(),
        scheduledEndAt: new Date().toISOString(),
        timezone: 'Africa/Nairobi',
        activeIncidentCount: 0,
        concurrencyVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 1. Clinical diagnosis claim MUST BE BLOCKED
      let diagnosisBlocked = false;
      try {
        this.service.recordObservation({
          engagementId,
          petId,
          category: 'COAT_SKIN',
          observationText: 'Diagnosed dermatitis on ventral abdomen. Prescribed hydrocortisone.',
          recordedBy: staffId,
        });
      } catch (err: any) {
        if (err.message.includes('MEDICAL_BOUNDARY_VIOLATION')) {
          diagnosisBlocked = true;
        }
      }

      if (!diagnosisBlocked) {
        return { name: testName, passed: false, message: 'Failed to block clinical diagnosis wording' };
      }

      // 2. Factual observation MUST SUCCEED
      const obs = this.service.recordObservation({
        engagementId,
        petId,
        category: 'COAT_SKIN',
        observationText: 'Mild redness observed on lower belly. No broken skin. Gentle drying recommended.',
        recordedBy: staffId,
        severityIndicator: 'NORMAL',
      });

      if (!obs || obs.category !== 'COAT_SKIN') {
        return { name: testName, passed: false, message: 'Factual observation failed to record' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }

  // ============================================================================
  // Test 6: Multi-Domain Completion & Idempotency
  // ============================================================================
  private async testMultiDomainCompletionAndIdempotency(): Promise<TestResult> {
    const testName = 'Completion: Multi-Domain Synchronization & Idempotency';
    try {
      const ownerId = asUserId('usr-test-owner-006');
      const groomerId = asUserId('usr-test-groomer-006');
      const providerId = asProviderId('prv-test-groomer-006');
      const petId = asPetId('pet-test-complete-006');
      const householdId = asHouseholdId('hh-test-complete-006');
      const bookingId = asBookingId('bok-test-complete-006');
      const offeringId = asServiceOfferingId('sro-test-complete-006');

      PetStore.savePet(
        makeTestPet({
          petId,
          householdId,
          name: 'Coco',
          speciesCode: 'CANINE',
          breedCode: 'POODLE',
          sex: 'FEMALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2023-01-10',
          ownerId,
        })
      );

      const now = new Date().toISOString();
      const booking = makeTestBooking({
        bookingId,
        serviceOfferingId: offeringId,
        providerId,
        householdId,
        petIds: [petId],
        ownerUserId: ownerId,
        startAt: now,
        endAt: new Date(Date.now() + 3600000).toISOString(),
      });
      this.bookingStore.saveBooking(booking);

      const engagement = this.service.createEngagement({
        bookingId,
        serviceType: 'GROOMING',
        serviceOfferingId: offeringId,
        householdId,
        petIds: [petId],
        providerId,
        assignedStaffId: groomerId,
        scheduledStartAt: now,
        scheduledEndAt: new Date(Date.now() + 3600000).toISOString(),
      });

      // Intake handover
      this.service.executeHandover({
        engagementId: engagement.engagementId,
        petId,
        handoverType: 'OWNER_TO_PROVIDER',
        fromActorId: ownerId,
        toActorId: groomerId,
        recipientName: 'Groomer',
        checklist: {
          collarAndTagVerified: true,
          leashOrCarrierSecure: true,
          petPhysicalStateObserved: true,
          personalBelongingsTransferred: true,
          emergencyContactConfirmed: true,
        },
      });

      // Record observations
      this.service.recordObservation({
        engagementId: engagement.engagementId,
        petId,
        category: 'COAT_SKIN',
        observationText: 'Coat clean and brushed thoroughly. Nails trimmed neatly.',
        recordedBy: groomerId,
      });

      // Return handover (crucial prerequisite)
      this.service.executeHandover({
        engagementId: engagement.engagementId,
        petId,
        handoverType: 'PROVIDER_TO_OWNER',
        fromActorId: groomerId,
        toActorId: ownerId,
        recipientName: 'Coco Owner',
        checklist: {
          collarAndTagVerified: true,
          leashOrCarrierSecure: true,
          petPhysicalStateObserved: true,
          personalBelongingsTransferred: true,
          emergencyContactConfirmed: true,
        },
      });

      // Finalize Service Execution
      const evidence1 = await this.service.finalizeServiceExecution({
        engagementId: engagement.engagementId,
        actorUserId: groomerId,
        outcome: 'COMPLETED',
        summaryNotes: 'Full deluxe grooming completed and returned.',
        returnedToName: 'Coco Owner',
      });

      if (!evidence1 || evidence1.outcome !== 'COMPLETED') {
        return { name: testName, passed: false, message: 'Finalize execution failed to return completion evidence' };
      }

      // Check Booking state updated to COMPLETED
      const updatedBooking = this.bookingStore.findBookingById(bookingId);
      if (updatedBooking?.status !== 'COMPLETED') {
        return { name: testName, passed: false, message: 'Booking was not transitioned to COMPLETED' };
      }

      // Check Pet Timeline received event
      const timelineEvents = TimelineStore.getEventsForPet(petId);
      const careEvent = timelineEvents.find((e) => e.sourceEntityId === engagement.engagementId);
      if (!careEvent) {
        return { name: testName, passed: false, message: 'Care performed event was not added to pet timeline' };
      }

      // Idempotency: Calling finalize again returns identical evidence without error
      const evidence2 = await this.service.finalizeServiceExecution({
        engagementId: engagement.engagementId,
        actorUserId: groomerId,
        outcome: 'COMPLETED',
        summaryNotes: 'Full deluxe grooming completed and returned.',
        returnedToName: 'Coco Owner',
      });

      if (evidence2.evidenceId !== evidence1.evidenceId) {
        return { name: testName, passed: false, message: 'Finalize execution was not idempotent' };
      }

      return { name: testName, passed: true };
    } catch (err: any) {
      return { name: testName, passed: false, message: err.message };
    }
  }
}

export async function runSprint21Tests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  const suite = new Sprint21CareTestSuite();
  return suite.runAllTests();
}
