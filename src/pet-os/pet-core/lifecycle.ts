/**
 * Pet OS Sprint 3 - Lifecycle, Birthdate, Derived Age & State Machine Engine
 * Implements Volume V (Pet Identity & Digital Twin) and Volume VI (Lifecycle Engine).
 */

import { 
  BirthdatePrecision, 
  DerivedAge, 
  LifecycleStage, 
  PetStatus, 
  SizeClassification 
} from './types';

export class LifecycleEngine {
  /**
   * Validates a date of birth string (ISO format YYYY-MM-DD)
   * Enforces:
   * - Cannot be in the future
   * - Must be a valid calendar date
   * - Valid leap-year handling
   */
  static validateDateOfBirth(dateStr: string, precision: BirthdatePrecision): {
    valid: boolean;
    error?: string;
    normalizedDate?: string;
  } {
    if (precision === 'UNKNOWN') {
      return { valid: true };
    }

    if (!dateStr || typeof dateStr !== 'string') {
      return { valid: false, error: 'Date of birth is required when precision is not UNKNOWN.' };
    }

    const trimmed = dateStr.trim();
    // Validate ISO YYYY-MM-DD pattern
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(trimmed)) {
      return { valid: false, error: 'Date of birth must be in YYYY-MM-DD format.' };
    }

    const [yearStr, monthStr, dayStr] = trimmed.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: 'Invalid month in date of birth.' };
    }

    // Days in month validation including leap year
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (day < 1 || day > daysInMonth[month - 1]) {
      return { valid: false, error: `Invalid day ${day} for month ${month} in year ${year}.` };
    }

    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const now = new Date();

    if (parsedDate.getTime() > now.getTime()) {
      return { valid: false, error: 'Date of birth cannot be in the future (PETV-INV-002).' };
    }

    return { valid: true, normalizedDate: trimmed };
  }

  /**
   * Dynamically derives exact age components (years, months, days) from birthdate.
   * Age is never permanently stored as a stale integer.
   */
  static calculateAge(
    dateOfBirth?: string,
    precision: BirthdatePrecision = 'EXACT',
    asOfDate: Date = new Date()
  ): DerivedAge {
    if (!dateOfBirth || precision === 'UNKNOWN') {
      return {
        years: 0,
        months: 0,
        days: 0,
        totalDays: 0,
        display: 'Age Unknown',
        isEstimated: true,
        precision: 'UNKNOWN'
      };
    }

    const [y, m, d] = dateOfBirth.split('-').map(Number);
    const birthDate = new Date(Date.UTC(y, m - 1, d));
    const targetDate = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), asOfDate.getUTCDate()));

    if (birthDate > targetDate) {
      return {
        years: 0,
        months: 0,
        days: 0,
        totalDays: 0,
        display: '0 days',
        isEstimated: precision !== 'EXACT',
        precision
      };
    }

    const totalDays = Math.floor((targetDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));

    let years = targetDate.getUTCFullYear() - birthDate.getUTCFullYear();
    let months = targetDate.getUTCMonth() - birthDate.getUTCMonth();
    let days = targetDate.getUTCDate() - birthDate.getUTCDate();

    if (days < 0) {
      months -= 1;
      const prevMonthLastDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 0)).getUTCDate();
      days += prevMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    // Format human-friendly display
    let display = '';
    const prefix = precision !== 'EXACT' ? 'Est. ~' : '';

    if (precision === 'ESTIMATED_YEAR') {
      display = `${prefix}${years} ${years === 1 ? 'yr' : 'yrs'}`;
    } else if (years > 0) {
      display = months > 0 
        ? `${prefix}${years} ${years === 1 ? 'yr' : 'yrs'}, ${months} ${months === 1 ? 'mo' : 'mos'}`
        : `${prefix}${years} ${years === 1 ? 'yr' : 'yrs'}`;
    } else if (months > 0) {
      display = days > 0
        ? `${prefix}${months} ${months === 1 ? 'mo' : 'mos'}, ${days} ${days === 1 ? 'day' : 'days'}`
        : `${prefix}${months} ${months === 1 ? 'mo' : 'mos'}`;
    } else {
      display = `${prefix}${days} ${days === 1 ? 'day' : 'days'}`;
    }

    return {
      years,
      months,
      days,
      totalDays,
      display,
      isEstimated: precision !== 'EXACT',
      precision
    };
  }

  /**
   * Species-aware lifecycle stage derivation.
   * Canines: Puppy -> Adolescent -> Adult -> Senior
   * Felines: Kitten -> Adolescent -> Adult -> Senior
   * Other: Juvenile -> Adult -> Senior
   */
  static deriveLifecycleStage(
    speciesCode: string,
    derivedAge: DerivedAge,
    sizeClassification: SizeClassification = 'MEDIUM'
  ): LifecycleStage {
    if (derivedAge.precision === 'UNKNOWN') {
      return 'ADULT'; // Default neutral fallback if unknown
    }

    const totalMonths = derivedAge.years * 12 + derivedAge.months;

    if (speciesCode === 'SPECIES_DOG') {
      const isGiant = sizeClassification === 'GIANT';

      // Puppy threshold: < 12 months for standard, < 18 months for Giant
      if (totalMonths < (isGiant ? 18 : 12)) {
        return 'PUPPY';
      }

      // Adolescent threshold: 12 - 24 months (or 18 - 30 months for Giant)
      if (totalMonths < (isGiant ? 30 : 24)) {
        return 'ADOLESCENT';
      }

      // Senior threshold: Giant dogs become seniors earlier (~5-6 yrs / 60-72 mos), standard 7-8 yrs (84-96 mos)
      const seniorThresholdMonths = isGiant ? 60 : 84;
      if (totalMonths >= seniorThresholdMonths) {
        return 'SENIOR';
      }

      return 'ADULT';
    }

    if (speciesCode === 'SPECIES_CAT') {
      if (totalMonths < 12) return 'KITTEN';
      if (totalMonths < 24) return 'ADOLESCENT';
      if (totalMonths >= 120) return 'SENIOR'; // 10+ years
      return 'ADULT';
    }

    // Other species (Rabbits, Birds, etc.)
    if (totalMonths < 12) return 'JUVENILE';
    if (totalMonths >= 60) return 'SENIOR';
    return 'ADULT';
  }

  /**
   * Pet Status State Machine (Volume V & VI)
   * Validates legal status transitions.
   */
  static validateStatusTransition(currentStatus: PetStatus, targetStatus: PetStatus): {
    allowed: boolean;
    reasonCode?: string;
    message?: string;
  } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    // Terminal invariant: Deceased pet status is terminal
    if (currentStatus === 'DECEASED') {
      return {
        allowed: false,
        reasonCode: 'ERR_LIFECYCLE_TERMINAL_DECEASED',
        message: 'A pet marked as DECEASED cannot be transitioned to another status (PETV-INV-004).'
      };
    }

    // Legal transitions from ACTIVE
    if (currentStatus === 'ACTIVE') {
      if (['MISSING', 'ARCHIVED', 'DECEASED'].includes(targetStatus)) {
        return { allowed: true };
      }
    }

    // Legal transitions from MISSING (e.g. found/recovered or deceased)
    if (currentStatus === 'MISSING') {
      if (['ACTIVE', 'DECEASED'].includes(targetStatus)) {
        return { allowed: true };
      }
      if (targetStatus === 'ARCHIVED') {
        return {
          allowed: false,
          reasonCode: 'ERR_LIFECYCLE_INVALID_TRANSITION',
          message: 'A missing pet must be recovered to ACTIVE before archiving.'
        };
      }
    }

    // Legal transitions from ARCHIVED (restored to active, or recorded deceased)
    if (currentStatus === 'ARCHIVED') {
      if (['ACTIVE', 'DECEASED'].includes(targetStatus)) {
        return { allowed: true };
      }
      if (targetStatus === 'MISSING') {
        return {
          allowed: false,
          reasonCode: 'ERR_LIFECYCLE_INVALID_TRANSITION',
          message: 'An archived pet must be restored to ACTIVE before marking MISSING.'
        };
      }
    }

    return {
      allowed: false,
      reasonCode: 'ERR_LIFECYCLE_INVALID_TRANSITION',
      message: `Invalid lifecycle transition from ${currentStatus} to ${targetStatus}.`
    };
  }
}
