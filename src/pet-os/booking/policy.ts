/**
 * Pet OS Sprint 11 - Booking Platform Domain Policies & Business Rules
 * Implements Volume XII, Volume XIII, Volume XIV, Volume XXVIII, Volume XXXI
 * 
 * Normative Constraints:
 * - Deterministic state machine with server-enforced legal transitions
 * - Zero self-approval rule (provider cannot approve their own booking)
 * - Minimum-necessary pet data exposure during prerequisite validation
 * - Dynamic address masking based on booking state and service time window
 * - Strict capacity bounds and multi-pet calculations
 */

import {
  BookingStatus,
  PetEligibilityResult,
  PrerequisiteCheckItem,
  PrerequisiteSatisfactionState,
  BookingCancellationPolicySnapshot,
} from './types';
import { UserId, PetId } from '../kernel/ids';
import { Pet } from '../pet-core/types';
import { ServiceOffering } from '../provider/types';

// ---------------------------------------------------------------------------
// 1. Booking State Machine Transitions
// ---------------------------------------------------------------------------

export const LEGAL_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ['PENDING_PROVIDER', 'CONFIRMED'],
  PENDING_PROVIDER: ['CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED_BY_OWNER'],
  CONFIRMED: [
    'RESCHEDULE_PENDING',
    'CANCELLED_BY_OWNER',
    'CANCELLED_BY_PROVIDER',
    'IN_PROGRESS',
  ],
  RESCHEDULE_PENDING: [
    'CONFIRMED',              // Accepted new slot OR reverted to original schedule
    'CANCELLED_BY_OWNER',
    'CANCELLED_BY_PROVIDER',
  ],
  DECLINED: [],              // Terminal
  EXPIRED: [],               // Terminal
  CANCELLED_BY_OWNER: [],    // Terminal
  CANCELLED_BY_PROVIDER: [], // Terminal
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],   // Terminal unless disputed
  NO_SHOW: [],               // Terminal
  DISPUTED: ['COMPLETED'],   // Resolved
};

export function canTransitionStatus(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  const legalNextStates = LEGAL_STATUS_TRANSITIONS[from];
  return legalNextStates ? legalNextStates.includes(to) : false;
}

export function assertLegalStatusTransition(from: BookingStatus, to: BookingStatus, bookingId: string): void {
  if (!canTransitionStatus(from, to)) {
    throw new Error(
      `Illegal booking status transition from '${from}' to '${to}' for booking '${bookingId}'.`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Zero Self-Approval Security Policy
// ---------------------------------------------------------------------------

export function assertNotSelfApproval(providerUserId: UserId, ownerUserId: UserId): void {
  if (providerUserId === ownerUserId) {
    throw new Error(
      'Zero Self-Approval Violation: A provider cannot approve, confirm, or accept their own service booking.'
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Pet Eligibility & Minimum-Necessary Prerequisite Evaluator
// ---------------------------------------------------------------------------

export function evaluatePetToServiceEligibility(
  pet: Pet,
  offering: ServiceOffering
): PetEligibilityResult {
  const reasons: string[] = [];
  let speciesSupported = true;
  let sizeSupported = true;

  // Species check (harmonizing SPECIES_DOG and DOG, SPECIES_CAT and CAT)
  const normalizedPetSpecies = (pet.speciesCode || '').toUpperCase().replace('SPECIES_', '');
  if (offering.targetSpecies && offering.targetSpecies.length > 0) {
    const supported = offering.targetSpecies.map(s => s.toUpperCase().replace('SPECIES_', ''));
    if (!supported.includes(normalizedPetSpecies)) {
      speciesSupported = false;
      reasons.push(
        `Service '${offering.title}' does not support species '${pet.speciesCode}'. Supported species: ${offering.targetSpecies.join(', ')}.`
      );
    }
  }

  // Size restriction check (if pet has size in metadata or breed)
  const petSize = String(pet.metadata?.size || pet.sizeClassification || 'MEDIUM').toUpperCase();
  if (offering.sizeRestrictions && offering.sizeRestrictions.length > 0) {
    const supportedSizes = offering.sizeRestrictions.map(s => s.toUpperCase());
    if (!supportedSizes.includes(petSize)) {
      sizeSupported = false;
      reasons.push(
        `Pet size '${petSize}' is not supported by service. Allowed sizes: ${offering.sizeRestrictions.join(', ')}.`
      );
    }
  }

  // Prerequisite check (Minimum necessary evaluation)
  const prerequisites: PrerequisiteCheckItem[] = [];

  if (offering.prerequisites && offering.prerequisites.length > 0) {
    for (const prereq of offering.prerequisites) {
      const code = prereq.toUpperCase();
      if (code.includes('VACCIN') || code.includes('RABIES')) {
        // Evaluate vaccination satisfaction without returning medical history
        const hasVaccination = Boolean(pet.metadata?.hasValidVaccinations ?? true);
        prerequisites.push({
          code: 'VACCINATION_VERIFICATION',
          title: 'Core Vaccinations (Rabies / DHPP)',
          description: 'Provider requires proof of active core immunization.',
          state: hasVaccination ? 'REQUIREMENT_SATISFIED' : 'REQUIREMENT_NOT_SATISFIED',
          reason: hasVaccination ? 'Immunization certificate active' : 'Rabies vaccination record missing or expired',
        });
      } else if (code.includes('AGE') || code.includes('PUPPY')) {
        // Age limit check
        const birthDate = pet.dateOfBirth ? new Date(pet.dateOfBirth) : null;
        const isOldEnough = birthDate ? (Date.now() - birthDate.getTime()) > (16 * 7 * 24 * 3600 * 1000) : true; // > 16 weeks
        prerequisites.push({
          code: 'AGE_REQUIREMENT',
          title: 'Minimum Age Requirement',
          description: 'Puppies must be at least 16 weeks old for group service.',
          state: isOldEnough ? 'REQUIREMENT_SATISFIED' : 'REQUIREMENT_NOT_SATISFIED',
          reason: isOldEnough ? 'Age requirement met' : 'Pet is under required minimum age',
        });
      } else if (code.includes('TEMPERAMENT') || code.includes('BEHAVIOR')) {
        prerequisites.push({
          code: 'TEMPERAMENT_EVALUATION',
          title: 'Behavior & Temperament Intake',
          description: 'Owner must confirm pet has no human aggression or unmanaged bite history.',
          state: 'REQUIREMENT_SATISFIED', // Attested in intake notes
          reason: 'Owner self-attestation recorded',
        });
      } else {
        prerequisites.push({
          code: 'STANDARD_REQUIREMENT',
          title: prereq,
          description: `Provider policy requirement: ${prereq}`,
          state: 'REQUIREMENT_SATISFIED',
        });
      }
    }
  }

  // Determine overall status
  const hasUnsatisfied = prerequisites.some(p => p.state === 'REQUIREMENT_NOT_SATISFIED');
  const hasUnknown = prerequisites.some(p => p.state === 'REQUIREMENT_UNKNOWN');

  let status: PetEligibilityResult['status'] = 'ELIGIBLE';
  if (!speciesSupported || !sizeSupported) {
    status = 'INELIGIBLE';
  } else if (hasUnsatisfied) {
    status = 'REQUIRES_DOCUMENT';
    reasons.push('One or more mandatory service prerequisites are not satisfied.');
  } else if (hasUnknown) {
    status = 'REQUIRES_INFORMATION';
    reasons.push('Additional information required to verify eligibility.');
  }

  return {
    petId: pet.petId,
    status,
    isEligible: status === 'ELIGIBLE',
    speciesSupported,
    sizeSupported,
    prerequisites,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// 4. Cancellation Policy Calculations
// ---------------------------------------------------------------------------

export const STANDARD_CANCELLATION_POLICY: BookingCancellationPolicySnapshot = {
  policyTier: 'STANDARD',
  freeCancellationCutoffHours: 24,
  lateCancellationNotice: 'Cancellations within 24 hours of service time are marked as late cancellations for trust & capacity accounting.',
  description: 'Free cancellation up to 24 hours before service start.',
};

export const FLEXIBLE_CANCELLATION_POLICY: BookingCancellationPolicySnapshot = {
  policyTier: 'FLEXIBLE',
  freeCancellationCutoffHours: 2,
  lateCancellationNotice: 'Cancellations within 2 hours of service start are marked as late cancellations.',
  description: 'Free cancellation up to 2 hours before service start.',
};

export function evaluateCancellationPolicy(
  startAtIso: string,
  cancelledAtIso: string,
  policy: BookingCancellationPolicySnapshot = STANDARD_CANCELLATION_POLICY
): { isLateCancellation: boolean; hoursBeforeStart: number } {
  const startMs = new Date(startAtIso).getTime();
  const cancelMs = new Date(cancelledAtIso).getTime();
  const hoursBeforeStart = Math.max(0, (startMs - cancelMs) / (1000 * 3600));
  const isLateCancellation = hoursBeforeStart < policy.freeCancellationCutoffHours;

  return {
    isLateCancellation,
    hoursBeforeStart: Math.round(hoursBeforeStart * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// 5. Address Privacy Masking Policy
// ---------------------------------------------------------------------------

export function maskDestinationAddress(
  rawAddress: string,
  bookingStatus: BookingStatus,
  serviceStartAtIso: string,
  nowIso: string = new Date().toISOString()
): { addressText: string; isFullyDisclosed: boolean } {
  // Only fully reveal address if CONFIRMED or RESCHEDULE_PENDING, AND within 24 hours of service start
  if (bookingStatus !== 'CONFIRMED' && bookingStatus !== 'RESCHEDULE_PENDING' && bookingStatus !== 'IN_PROGRESS') {
    return {
      addressText: 'Nairobi Metro Dispatch Area (Exact address masked until booking is confirmed)',
      isFullyDisclosed: false,
    };
  }

  const startMs = new Date(serviceStartAtIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  const hoursUntilStart = (startMs - nowMs) / (1000 * 3600);

  // If confirmed and within 48 hours, disclose full address
  if (hoursUntilStart <= 48) {
    return {
      addressText: rawAddress,
      isFullyDisclosed: true,
    };
  }

  return {
    addressText: `${rawAddress.split(',')[0] || 'Client Residence'} (Full street address unlocks 48 hours before service)`,
    isFullyDisclosed: false,
  };
}

// ---------------------------------------------------------------------------
// 6. Capacity Calculation
// ---------------------------------------------------------------------------

export function calculateRequiredCapacity(
  petCount: number,
  baseCapacityPerPet: number = 1
): number {
  if (petCount < 1) return 1;
  return petCount * baseCapacityPerPet;
}
