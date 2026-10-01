/**
 * Pet OS Financial Platform - Commission Engine & Snapshotter
 * Implements Volume XVII: Platform Marketplace Commissions & Snapshot Architecture
 * Deterministic calculation in minor integer units without floating-point errors.
 */

import {
  CommissionRuleId,
  CommissionSnapshotId,
  ProviderId,
  BusinessId,
  asCommissionRuleId,
  asCommissionSnapshotId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import { ProviderCategory } from '../provider/types';
import { PlatformCommissionRule, CommissionSnapshot } from './types';

export class CommissionEngine {
  private rules = new Map<CommissionRuleId, PlatformCommissionRule>();

  constructor() {
    this.bootstrapStandardCommissionRules();
  }

  /**
   * Initializes canonical Pet OS commission rules
   */
  private bootstrapStandardCommissionRules(): void {
    const defaultRules: Array<{
      category: ProviderCategory | 'ALL';
      percentageBps: number;
      fixedAmountMinor: number;
      description: string;
    }> = [
      {
        category: 'DOG_WALKER',
        percentageBps: 1500, // 15.00%
        fixedAmountMinor: 0,
        description: 'Standard Dog Walking & Daily Care Platform Commission (15%)',
      },
      {
        category: 'PET_SITTER',
        percentageBps: 1500, // 15.00%
        fixedAmountMinor: 0,
        description: 'Standard Pet Sitting & Boarding Platform Commission (15%)',
      },
      {
        category: 'TRAINER',
        percentageBps: 1200, // 12.00%
        fixedAmountMinor: 0,
        description: 'Certified Behavioral Training Platform Commission (12%)',
      },
      {
        category: 'VETERINARIAN',
        percentageBps: 1000, // 10.00%
        fixedAmountMinor: 0,
        description: 'Licensed Veterinary Services Platform Commission (10%)',
      },
      {
        category: 'GROOMER',
        percentageBps: 1500, // 15.00%
        fixedAmountMinor: 0,
        description: 'Grooming & Hygiene Platform Commission (15%)',
      },
      {
        category: 'ALL',
        percentageBps: 1500, // 15.00% fallback
        fixedAmountMinor: 0,
        description: 'Default Marketplace Service Commission (15%)',
      },
    ];

    for (const def of defaultRules) {
      const ruleId = asCommissionRuleId(`rule-${def.category.toLowerCase().replace(/_/g, '-')}`);
      this.rules.set(ruleId, {
        ruleId,
        category: def.category,
        percentageBps: def.percentageBps,
        fixedAmountMinor: def.fixedAmountMinor,
        currency: 'KES',
        effectiveFrom: '2026-01-01T00:00:00Z',
        version: 1,
        description: def.description,
      });
    }
  }

  /**
   * Finds the most specific active commission rule
   */
  resolveRule(
    category: ProviderCategory,
    providerId?: ProviderId,
    businessId?: BusinessId,
    asOf: string = new Date().toISOString()
  ): PlatformCommissionRule {
    const allRules = Array.from(this.rules.values());

    // 1. Check provider/business specific override
    if (providerId) {
      const specific = allRules.find(r => r.providerId === providerId);
      if (specific) return specific;
    }

    // 2. Check category specific rule
    const categoryRule = allRules.find(r => r.category === category);
    if (categoryRule) return categoryRule;

    // 3. Fallback to generic 'ALL' rule
    const fallback = allRules.find(r => r.category === 'ALL');
    if (fallback) return fallback;

    // Final safety fallback
    return {
      ruleId: asCommissionRuleId('rule-default-fallback'),
      category: 'ALL',
      percentageBps: 1500,
      fixedAmountMinor: 0,
      currency: 'KES',
      effectiveFrom: '2026-01-01T00:00:00Z',
      version: 1,
      description: 'System Fallback Commission (15%)',
    };
  }

  /**
   * Deterministically calculates platform commission and returns an immutable snapshot.
   * NEVER uses floating-point arithmetic.
   */
  createCommissionSnapshot(
    grossAmountMinor: number,
    category: ProviderCategory,
    currency: CurrencyCode = 'KES',
    providerId?: ProviderId,
    businessId?: BusinessId
  ): CommissionSnapshot {
    if (grossAmountMinor < 0 || !Number.isInteger(grossAmountMinor)) {
      throw new Error(`Invalid gross amount for commission snapshot: ${grossAmountMinor}`);
    }

    const rule = this.resolveRule(category, providerId, businessId);

    // Minor units calculation:
    // (grossAmountMinor * percentageBps) / 10000
    // Rounded deterministically
    const variableCommission = Math.round((grossAmountMinor * rule.percentageBps) / 10000);
    const netCommission = Math.min(grossAmountMinor, variableCommission + rule.fixedAmountMinor);

    return {
      snapshotId: asCommissionSnapshotId(generateUUIDv7()),
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      grossAmountMinor,
      commissionRateBps: rule.percentageBps,
      commissionAmountMinor: variableCommission,
      fixedFeeMinor: rule.fixedAmountMinor,
      netCommissionMinor: netCommission,
      currency,
      appliedAt: new Date().toISOString(),
    };
  }

  getAllRules(): PlatformCommissionRule[] {
    return Array.from(this.rules.values());
  }

  addCustomRule(rule: PlatformCommissionRule): void {
    this.rules.set(rule.ruleId, rule);
  }
}
