/**
 * Pet OS - Recurrence Calculation Engine
 * Implements Step 33 & Step 34: Robust recurrence rules handling leap years,
 * month-end clamping (Feb 28/29, 30 vs 31 days), DST, and bounded lookahead.
 */

import { RecurrenceRule, CareObligation, CareOccurrence, CareOccurrenceStatus } from './types';
import { asCareOccurrenceId, generateUUIDv7 } from '../kernel/ids';

export class RecurrenceEngine {
  /**
   * Helper to check if a year is a leap year.
   */
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Returns the number of days in a given month of a given year (1-indexed month: 1=Jan, 2=Feb...).
   */
  static getDaysInMonth(year: number, month: number): number {
    const daysPerMonth = [31, this.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return daysPerMonth[month - 1];
  }

  /**
   * Computes the next scheduled occurrence date given a recurrence rule and baseline date.
   */
  static calculateNextOccurrenceDate(
    rule: RecurrenceRule,
    baseDate: Date,
    _timezone = 'UTC'
  ): Date {
    const next = new Date(baseDate);
    const interval = Math.max(1, rule.interval || 1);

    switch (rule.frequency) {
      case 'DAILY': {
        next.setUTCDate(next.getUTCDate() + interval);
        break;
      }

      case 'EVERY_N_DAYS': {
        next.setUTCDate(next.getUTCDate() + interval);
        break;
      }

      case 'WEEKLY': {
        next.setUTCDate(next.getUTCDate() + (7 * interval));
        break;
      }

      case 'MONTHLY': {
        const targetDay = rule.dayOfMonth || baseDate.getUTCDate();
        const totalMonths = next.getUTCFullYear() * 12 + next.getUTCMonth() + interval;
        const targetYear = Math.floor(totalMonths / 12);
        const targetMonthIndex = totalMonths % 12; // 0-indexed: 0=Jan, 1=Feb...
        const targetMonth1Indexed = targetMonthIndex + 1;

        // Month-end clamping rule (e.g. Jan 31 -> Feb 28 or 29, March 31 -> April 30)
        const maxDaysInTargetMonth = this.getDaysInMonth(targetYear, targetMonth1Indexed);
        const clampedDay = Math.min(targetDay, maxDaysInTargetMonth);

        // Prevent Date overflow by resetting day to 1 before updating month/year
        next.setUTCDate(1);
        next.setUTCFullYear(targetYear);
        next.setUTCMonth(targetMonthIndex);
        next.setUTCDate(clampedDay);
        break;
      }

      case 'YEARLY': {
        const targetYear = next.getUTCFullYear() + interval;
        const targetMonth = rule.monthOfYear ? rule.monthOfYear - 1 : next.getUTCMonth();
        let targetDay = rule.dayOfMonth || next.getUTCDate();

        // Leap year clamping for Feb 29
        if (targetMonth === 1 && targetDay === 29 && !this.isLeapYear(targetYear)) {
          targetDay = 28;
        }

        // Prevent Date overflow by resetting day to 1 before updating month/year
        next.setUTCDate(1);
        next.setUTCFullYear(targetYear);
        next.setUTCMonth(targetMonth);
        next.setUTCDate(targetDay);
        break;
      }

      default:
        throw new Error(`Unsupported recurrence frequency: ${(rule as any).frequency}`);
    }

    return next;
  }

  /**
   * Generates next occurrence for an obligation after a reference date.
   */
  static generateNextOccurrence(
    obligation: CareObligation,
    previousOccurrenceNumber: number,
    baseDate: Date
  ): CareOccurrence {
    if (!obligation.recurrenceRule) {
      throw new Error('Cannot generate next occurrence for non-recurring care obligation');
    }

    const nextDate = this.calculateNextOccurrenceDate(
      obligation.recurrenceRule,
      baseDate,
      obligation.timezone
    );

    // Compute due window: 24h grace window by default
    const windowStart = new Date(nextDate);
    const windowEnd = new Date(nextDate.getTime() + 24 * 3600 * 1000);

    const occurrence: CareOccurrence = {
      occurrenceId: asCareOccurrenceId(generateUUIDv7()),
      careObligationId: obligation.careObligationId,
      petId: obligation.petId,
      householdId: obligation.householdId,
      occurrenceNumber: previousOccurrenceNumber + 1,
      title: obligation.title,
      category: obligation.category,
      scheduledFor: nextDate.toISOString(),
      dueWindowStart: windowStart.toISOString(),
      dueWindowEnd: windowEnd.toISOString(),
      status: 'SCHEDULED' as CareOccurrenceStatus,
      assignedToUserId: obligation.assignedToUserId,
      snoozeCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return occurrence;
  }

  /**
   * Generates all occurrences within a time window (with a hard cap to avoid unbounded loops).
   */
  static generateOccurrencesWithinWindow(
    obligation: CareObligation,
    windowStart: Date,
    windowEnd: Date,
    maxLimit = 30
  ): CareOccurrence[] {
    if (!obligation.recurrenceRule) return [];

    const occurrences: CareOccurrence[] = [];
    let currentDate = new Date(obligation.startsAt || obligation.dueAt);
    let count = 0;
    let occNumber = 1;

    while (currentDate.getTime() <= windowEnd.getTime() && count < maxLimit) {
      if (obligation.recurrenceRule.endDate && currentDate.getTime() > new Date(obligation.recurrenceRule.endDate).getTime()) {
        break;
      }

      if (obligation.recurrenceRule.maxOccurrences && occNumber > obligation.recurrenceRule.maxOccurrences) {
        break;
      }

      if (currentDate.getTime() >= windowStart.getTime()) {
        const dStart = new Date(currentDate);
        const dEnd = new Date(currentDate.getTime() + 24 * 3600 * 1000);

        occurrences.push({
          occurrenceId: asCareOccurrenceId(generateUUIDv7()),
          careObligationId: obligation.careObligationId,
          petId: obligation.petId,
          householdId: obligation.householdId,
          occurrenceNumber: occNumber,
          title: obligation.title,
          category: obligation.category,
          scheduledFor: currentDate.toISOString(),
          dueWindowStart: dStart.toISOString(),
          dueWindowEnd: dEnd.toISOString(),
          status: 'SCHEDULED',
          assignedToUserId: obligation.assignedToUserId,
          snoozeCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      currentDate = this.calculateNextOccurrenceDate(
        obligation.recurrenceRule,
        currentDate,
        obligation.timezone
      );
      occNumber++;
      count++;
    }

    return occurrences;
  }
}
