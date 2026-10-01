/**
 * Pet OS Shared Kernel - Time & Temporal Utilities
 * Implements UTC normalization and PETPET-001:
 * "Birth date MUST record precision as exact, estimated-month/year, or unknown."
 */

export type BirthDatePrecision = 'exact' | 'estimated_month' | 'estimated_year' | 'unknown';

export interface PetBirthRecord {
  date: string; // ISO 8601 UTC
  precision: BirthDatePrecision;
}

export function utcNow(): string {
  return new Date().toISOString();
}

export function toUTC(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return d.toISOString();
}

/**
 * Computes human-readable pet age string adhering to PETPET-001 precision rules.
 * Exact date permits exact age; estimated values use approximate wording/windows.
 */
export function computePetAge(birthRecord: PetBirthRecord, referenceDate = new Date()): {
  ageYears: number;
  ageMonths: number;
  displayAge: string;
  isApproximate: boolean;
} {
  if (birthRecord.precision === 'unknown') {
    return {
      ageYears: 0,
      ageMonths: 0,
      displayAge: 'Age unknown',
      isApproximate: true
    };
  }

  const birth = new Date(birthRecord.date);
  const now = referenceDate;
  
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (months < 0) {
    years--;
    months += 12;
  }

  let text = '';
  if (years === 0) {
    text = months === 1 ? '1 month' : `${months} months`;
  } else if (years === 1 && months === 0) {
    text = '1 year';
  } else if (months === 0) {
    text = `${years} years`;
  } else {
    text = `${years}y ${months}m`;
  }

  const isApprox = birthRecord.precision !== 'exact';
  const prefix = isApprox ? 'approx. ' : '';

  return {
    ageYears: Math.max(0, years),
    ageMonths: Math.max(0, months),
    displayAge: `${prefix}${text}`,
    isApproximate: isApprox
  };
}

/**
 * Calculates whether a care item is overdue based on grace window
 */
export function isOverdue(dueAt: string, graceHours = 24): boolean {
  const dueTime = new Date(dueAt).getTime();
  const graceMs = graceHours * 60 * 60 * 1000;
  return ClockRegistry.getClock().getTime() > dueTime + graceMs;
}

/**
 * Sprint 6 - Canonical Clock Abstraction (Volume VIII, Step 53)
 * Decouples domain logic from wall-clock Date.now() for deterministic testing,
 * timezone calculation, and simulated scheduling advancement.
 */
export interface IClock {
  now(): Date;
  utcNow(): string;
  getTime(): number;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  utcNow(): string {
    return new Date().toISOString();
  }
  getTime(): number {
    return Date.now();
  }
}

export class SimulatedClock implements IClock {
  private currentTime: Date;

  constructor(initialTime: Date | string = new Date()) {
    this.currentTime = new Date(initialTime);
  }

  setTime(time: Date | string): void {
    this.currentTime = new Date(time);
  }

  advanceHours(hours: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + hours * 3600 * 1000);
  }

  advanceDays(days: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + days * 86400 * 1000);
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  utcNow(): string {
    return this.currentTime.toISOString();
  }

  getTime(): number {
    return this.currentTime.getTime();
  }
}

export class ClockRegistry {
  private static activeClock: IClock = new SystemClock();

  static getClock(): IClock {
    return ClockRegistry.activeClock;
  }

  static setClock(clock: IClock): void {
    ClockRegistry.activeClock = clock;
  }

  static reset(): void {
    ClockRegistry.activeClock = new SystemClock();
  }
}

export function currentClockTime(): Date {
  return ClockRegistry.getClock().now();
}

export function currentClockUtcNow(): string {
  return ClockRegistry.getClock().utcNow();
}
