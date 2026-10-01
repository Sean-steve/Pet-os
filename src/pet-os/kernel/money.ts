/**
 * Pet OS Shared Kernel - Money Value Object
 * Implements PETXXX-002 and ADR-012:
 * "Money MUST use integer minor units (bigint/number) + ISO 4217 char(3) currency, never float."
 * Handles M-PESA and multi-currency operations without floating-point errors.
 */

export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP' | 'TZS' | 'UGX';

export class Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;

  constructor(amountMinor: number, currency: CurrencyCode = 'KES') {
    if (!Number.isInteger(amountMinor)) {
      throw new Error(`Money amount must be an integer in minor units, got: ${amountMinor}`);
    }
    this.amountMinor = amountMinor;
    this.currency = currency;
  }

  static fromMinor(amountMinor: number, currency: CurrencyCode = 'KES'): Money {
    return new Money(amountMinor, currency);
  }

  static fromMajor(amountMajor: number, currency: CurrencyCode = 'KES'): Money {
    const factor = 100; // 100 minor units per major unit for KES, USD, EUR
    const minor = Math.round(amountMajor * factor);
    return new Money(minor, currency);
  }

  static zero(currency: CurrencyCode = 'KES'): Money {
    return new Money(0, currency);
  }

  get amountMajor(): number {
    return this.amountMinor / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.amountMinor * factor), this.currency);
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor > other.amountMinor;
  }

  greaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor >= other.amountMinor;
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor < other.amountMinor;
  }

  lessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor <= other.amountMinor;
  }

  /**
   * Distributes money across ratios without losing remainder cents (Footsie algorithm).
   * Critical for multi-merchant carts, platform fees, and provider payouts.
   */
  allocate(ratios: number[]): Money[] {
    const totalRatio = ratios.reduce((a, b) => a + b, 0);
    if (totalRatio <= 0) throw new Error('Total allocation ratio must be positive');

    let remainder = this.amountMinor;
    const results: number[] = [];

    for (const ratio of ratios) {
      const share = Math.floor((this.amountMinor * ratio) / totalRatio);
      results.push(share);
      remainder -= share;
    }

    // Distribute remainder 1 minor unit at a time to prevent rounding loss
    for (let i = 0; remainder > 0 && i < results.length; i++) {
      results[i] += 1;
      remainder -= 1;
    }

    return results.map(minor => new Money(minor, this.currency));
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  isPositive(): boolean {
    return this.amountMinor > 0;
  }

  isZero(): boolean {
    return this.amountMinor === 0;
  }

  format(): string {
    const major = (this.amountMinor / 100).toFixed(2);
    if (this.currency === 'KES') {
      return `KES ${Number(major).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
    }
    return `${this.currency} ${Number(major).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: cannot operate on ${this.currency} and ${other.currency}`);
    }
  }

  toJSON() {
    return {
      amount_minor: this.amountMinor,
      currency: this.currency,
      formatted: this.format()
    };
  }
}
