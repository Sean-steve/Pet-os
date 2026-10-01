/**
 * Pet OS - Due/Overdue Calculation Engine
 * Implements Step 35: Deterministic, server-authoritative due state transitions.
 * Implements Step 36: Snooze alters notification delivery timing, NOT the clinical due state.
 */

import { CareOccurrence, CareOccurrenceStatus, CareObligation } from './types';

export class DueStateEngine {
  /**
   * Deterministically evaluates the clinical status of a care occurrence at a given point in time.
   */
  static evaluateStatus(
    occurrence: CareOccurrence,
    obligation: CareObligation,
    currentTime: Date
  ): CareOccurrenceStatus {
    // 1. Terminal states are immutable
    if (occurrence.completedAt) {
      return 'COMPLETED';
    }

    if (occurrence.skippedAt) {
      return 'SKIPPED';
    }

    if (obligation.status === 'CANCELLED') {
      return 'CANCELLED';
    }

    // 2. Temporal window evaluation
    const currentMs = currentTime.getTime();
    const windowStartMs = new Date(occurrence.dueWindowStart || occurrence.scheduledFor).getTime();
    const windowEndMs = new Date(occurrence.dueWindowEnd || occurrence.scheduledFor).getTime();

    // Upcoming threshold: 7 days prior to window start
    const upcomingThresholdMs = windowStartMs - (7 * 24 * 3600 * 1000);

    if (currentMs < upcomingThresholdMs) {
      return 'SCHEDULED';
    }

    if (currentMs >= upcomingThresholdMs && currentMs < windowStartMs) {
      return 'UPCOMING';
    }

    if (currentMs >= windowStartMs && currentMs <= windowEndMs) {
      return 'DUE';
    }

    // Past window end
    return 'OVERDUE';
  }

  /**
   * Checks if an occurrence requires reminder delivery at the given currentTime,
   * taking into account snooze status.
   */
  static isNotificationDue(occurrence: CareOccurrence, currentTime: Date): boolean {
    if (occurrence.completedAt || occurrence.skippedAt) {
      return false;
    }

    // If snoozed and snooze period has not elapsed, suppress notification
    if (occurrence.snoozedUntil) {
      const snoozeExpiryMs = new Date(occurrence.snoozedUntil).getTime();
      if (currentTime.getTime() < snoozeExpiryMs) {
        return false;
      }
    }

    return true;
  }
}
