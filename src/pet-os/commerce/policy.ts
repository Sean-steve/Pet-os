/**
 * Pet OS Sprint 27 - Marketplace Commerce Policy Engine
 * Volume XV: First-Party Commerce
 * Volume XVI: Third-Party Marketplace
 * Volume XXIII: Rescue, Adoption & Welfare (Live Animal Protection)
 * Volume XXXI: Security, Privacy, Trust & Abuse
 */

import {
  ProductCategory,
  Product,
  ReturnReason,
  SpeciesApplicability,
  ReturnRequest,
  Order,
  OrderItem,
  CommissionSnapshot,
  SellerOrder,
} from './types';
import { CurrencyCode } from '../kernel/money';
import { CommissionSnapshotId, asCommissionSnapshotId, generateUUIDv7 } from '../kernel/ids';

export class CommercePolicy {
  // Prohibited live animal keywords
  private static readonly PROHIBITED_LIVE_ANIMAL_PATTERNS = [
    /\b(puppy|puppies)\b/i,
    /\b(kitten|kittens)\b/i,
    /\b(live\s+dog|live\s+cat)\b/i,
    /\b(dog\s+for\s+sale|cat\s+for\s+sale)\b/i,
    /\b(live\s+animal|live\s+pet)\b/i,
    /\b(breed\s+puppy|purebred\s+puppy)\b/i,
  ];

  // Restricted prescription medication patterns
  private static readonly RESTRICTED_PRESCRIPTION_PATTERNS = [
    /\b(apoquel|bravecto\s+rx|nexgard\s+spectra|prednisone|amoxicillin\s+clavulanate|gabapentin\s+vet|carprofen|rimadyl)\b/i,
    /\b(prescription\s+only|rx\s+only|veterinary\s+prescription)\b/i,
  ];

  /**
   * Validates whether a proposed product title, description, or category attempts to sell a live animal.
   * INVARIANT: LIVE ANIMALS CANNOT BE MODELLED OR SOLD AS ORDINARY COMMERCE SKUS.
   */
  static evaluateLiveAnimalProhibition(params: {
    title: string;
    description: string;
    categoryCode: string;
  }): { isProhibited: boolean; reason?: string } {
    if (params.categoryCode.toUpperCase().includes('LIVE_ANIMAL')) {
      return {
        isProhibited: true,
        reason: 'Live animals cannot be sold via Pet OS Marketplace. Animal placement belongs to Sprint 18 Rescue & Adoption.',
      };
    }

    const textToScan = `${params.title} ${params.description}`;
    for (const pattern of this.PROHIBITED_LIVE_ANIMAL_PATTERNS) {
      if (pattern.test(textToScan)) {
        return {
          isProhibited: true,
          reason: `Product listing contains prohibited live-animal sale terms ('${pattern.source}'). Live animals are protected from ordinary commercial cart/checkout.`,
        };
      }
    }

    return { isProhibited: false };
  }

  /**
   * Validates whether a proposed product attempts open marketplace sale of restricted prescription pharmaceuticals.
   */
  static evaluatePrescriptionRestriction(params: {
    title: string;
    description: string;
    categoryCode: string;
    isSellerRegisteredPharmacy?: boolean;
  }): { isRestricted: boolean; requiresPharmacyVerification: boolean; reason?: string } {
    if (params.categoryCode.toUpperCase().includes('PRESCRIPTION_MEDICATION')) {
      if (!params.isSellerRegisteredPharmacy) {
        return {
          isRestricted: true,
          requiresPharmacyVerification: true,
          reason: 'Prescription pharmaceuticals require licensed veterinary pharmacy verification and canonical prescription linkage.',
        };
      }
    }

    const textToScan = `${params.title} ${params.description}`;
    for (const pattern of this.RESTRICTED_PRESCRIPTION_PATTERNS) {
      if (pattern.test(textToScan)) {
        if (!params.isSellerRegisteredPharmacy) {
          return {
            isRestricted: true,
            requiresPharmacyVerification: true,
            reason: `Product contains restricted prescription pharmaceutical reference ('${pattern.source}'). Open marketplace purchase is prohibited.`,
          };
        }
      }
    }

    return { isRestricted: false, requiresPharmacyVerification: false };
  }

  /**
   * Evaluates return eligibility for a delivered order item.
   */
  static evaluateReturnEligibility(params: {
    category: ProductCategory;
    deliveredAt: string;
    reason: ReturnReason;
    isOpenedConsumable?: boolean;
    isPersonalized?: boolean;
  }): { isEligible: boolean; isSafetyException: boolean; reasonText: string } {
    // Safety concerns / dangerous defects ALWAYS override standard return limits
    if (params.reason === 'SAFETY_CONCERN' || params.reason === 'DEFECTIVE') {
      return {
        isEligible: true,
        isSafetyException: true,
        reasonText: 'Product safety/defect claims are eligible for return review regardless of standard category return window.',
      };
    }

    // Check non-returnable categories
    if (!params.category.isReturnableByDefault) {
      return {
        isEligible: false,
        isSafetyException: false,
        reasonText: `Category '${params.category.displayName}' is non-returnable by default for hygiene or safety reasons.`,
      };
    }

    if (params.isOpenedConsumable) {
      return {
        isEligible: false,
        isSafetyException: false,
        reasonText: 'Opened consumable pet food or hygiene products cannot be returned once unsealed.',
      };
    }

    if (params.isPersonalized) {
      return {
        isEligible: false,
        isSafetyException: false,
        reasonText: 'Custom engraved or personalized pet accessories cannot be returned.',
      };
    }

    // Check return window
    const deliveredDate = new Date(params.deliveredAt).getTime();
    const now = Date.now();
    const daysSinceDelivery = (now - deliveredDate) / (1000 * 60 * 60 * 24);

    if (daysSinceDelivery > params.category.standardReturnWindowDays) {
      return {
        isEligible: false,
        isSafetyException: false,
        reasonText: `Return window of ${params.category.standardReturnWindowDays} days has expired (${Math.floor(daysSinceDelivery)} days elapsed since delivery).`,
      };
    }

    return {
      isEligible: true,
      isSafetyException: false,
      reasonText: 'Item is eligible for return.',
    };
  }

  /**
   * Calculates immutable commission snapshot for a SellerOrder.
   * Standard: 10% marketplace fee + 0 fixed fee, or first-party 0%.
   */
  static calculateCommissionSnapshot(params: {
    sellerOrderId: SellerOrder['sellerOrderId'];
    sellerId: SellerOrder['sellerId'];
    sellerGrossMinor: number;
    currency: CurrencyCode;
    isFirstParty: boolean;
  }): CommissionSnapshot {
    const ratePercentage = params.isFirstParty ? 0 : 10; // 10% standard marketplace commission
    const fixedFeeMinor = 0;
    const ruleCode = params.isFirstParty ? 'FIRST_PARTY_STORE_ZERO_COMMISSION' : 'MARKETPLACE_STANDARD_10_PERCENT';

    const commissionAmountMinor = Math.round(params.sellerGrossMinor * (ratePercentage / 100)) + fixedFeeMinor;
    const sellerNetAmountMinor = params.sellerGrossMinor - commissionAmountMinor;

    return {
      commissionSnapshotId: generateUUIDv7() as CommissionSnapshotId,
      sellerOrderId: params.sellerOrderId,
      sellerId: params.sellerId,
      ruleCode,
      ratePercentage,
      fixedFeeMinor,
      grossAmountMinor: params.sellerGrossMinor,
      commissionAmountMinor,
      sellerNetAmountMinor,
      currency: params.currency,
      calculatedAt: new Date().toISOString(),
    };
  }
}
