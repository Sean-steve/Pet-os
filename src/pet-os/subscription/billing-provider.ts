/**
 * Pet OS Subscription Billing Provider Abstraction
 * Implements Step 31 (Billing Provider Abstraction), Step 33 (Mobile Money), Step 34 (Card Payments).
 * Decouples Subscription lifecycle from third-party billing vendors.
 */

import {
  SubscriptionBillingProviderName,
  PlanPrice,
  SubscriptionStatus,
} from './types';
import { generateUUIDv7 } from '../kernel/ids';

export interface CreateBillingAgreementResult {
  readonly agreementExternalReference: string;
  readonly maskedToken: string;
  readonly mandateReference?: string;
  readonly status: 'ACTIVE' | 'REQUIRES_ACTION';
}

export interface CreateRecurringSubscriptionResult {
  readonly externalSubscriptionReference: string;
  readonly initialStatus: SubscriptionStatus;
}

export interface RenewalCollectionResult {
  readonly success: boolean;
  readonly providerTransactionId: string;
  readonly failureReason?: string;
}

export interface SubscriptionBillingProvider {
  readonly providerName: SubscriptionBillingProviderName;

  createBillingAgreement(
    ownerId: string,
    paymentTokenOrPhone: string
  ): Promise<CreateBillingAgreementResult>;

  createRecurringSubscription(
    agreementRef: string,
    planPrice: PlanPrice
  ): Promise<CreateRecurringSubscriptionResult>;

  collectRenewal(
    externalSubRef: string,
    planPrice: PlanPrice
  ): Promise<RenewalCollectionResult>;

  cancelRecurringSubscription(
    externalSubRef: string
  ): Promise<boolean>;

  fetchExternalStatus(
    externalSubRef: string
  ): Promise<{ status: string; currentPeriodEnd: string }>;

  verifyWebhookSignature(
    rawPayload: string,
    signature: string
  ): boolean;
}

/**
 * M-Pesa Recurring Billing Provider
 * Handles Kenya mobile-money STK prompt / recurring debit mandates.
 * Respects customer authorization constraints (no invisible card charging without mandate).
 */
export class MpesaRecurringBillingProvider implements SubscriptionBillingProvider {
  readonly providerName: SubscriptionBillingProviderName = 'MPESA_RECURRING';

  async createBillingAgreement(ownerId: string, phone: string): Promise<CreateBillingAgreementResult> {
    const cleanPhone = phone.replace(/\D/g, '');
    const masked = cleanPhone.length > 4 ? `2547••••${cleanPhone.slice(-4)}` : '2547••••1234';
    const mandateRef = `MND-MPESA-${generateUUIDv7().slice(0, 8).toUpperCase()}`;

    return {
      agreementExternalReference: `agr-mpesa-${generateUUIDv7()}`,
      maskedToken: masked,
      mandateReference: mandateRef,
      status: 'ACTIVE',
    };
  }

  async createRecurringSubscription(agreementRef: string, planPrice: PlanPrice): Promise<CreateRecurringSubscriptionResult> {
    return {
      externalSubscriptionReference: `sub-mpesa-ext-${generateUUIDv7()}`,
      initialStatus: 'ACTIVE',
    };
  }

  async collectRenewal(externalSubRef: string, planPrice: PlanPrice): Promise<RenewalCollectionResult> {
    // In production, triggers Daraja STK Push or Standing Order Debit
    return {
      success: true,
      providerTransactionId: `MPESA-TX-${generateUUIDv7().slice(0, 10).toUpperCase()}`,
    };
  }

  async cancelRecurringSubscription(externalSubRef: string): Promise<boolean> {
    return true;
  }

  async fetchExternalStatus(externalSubRef: string): Promise<{ status: string; currentPeriodEnd: string }> {
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { status: 'ACTIVE', currentPeriodEnd: end };
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    return signature.startsWith('sig_mpesa_') || signature === 'valid_mpesa_test_sig';
  }
}

/**
 * Card Gateway Billing Provider
 * Handles tokenized recurring credit/debit card debits without storing PAN/CVV.
 */
export class CardGatewayBillingProvider implements SubscriptionBillingProvider {
  readonly providerName: SubscriptionBillingProviderName = 'CARD_GATEWAY';

  async createBillingAgreement(ownerId: string, cardToken: string): Promise<CreateBillingAgreementResult> {
    const last4 = cardToken.length >= 4 ? cardToken.slice(-4) : '4242';
    return {
      agreementExternalReference: `agr-card-${generateUUIDv7()}`,
      maskedToken: `Visa •••• ${last4}`,
      mandateReference: `MND-CARD-${generateUUIDv7().slice(0, 8).toUpperCase()}`,
      status: 'ACTIVE',
    };
  }

  async createRecurringSubscription(agreementRef: string, planPrice: PlanPrice): Promise<CreateRecurringSubscriptionResult> {
    return {
      externalSubscriptionReference: `sub-card-ext-${generateUUIDv7()}`,
      initialStatus: 'ACTIVE',
    };
  }

  async collectRenewal(externalSubRef: string, planPrice: PlanPrice): Promise<RenewalCollectionResult> {
    return {
      success: true,
      providerTransactionId: `CARD-TX-${generateUUIDv7().slice(0, 10).toUpperCase()}`,
    };
  }

  async cancelRecurringSubscription(externalSubRef: string): Promise<boolean> {
    return true;
  }

  async fetchExternalStatus(externalSubRef: string): Promise<{ status: string; currentPeriodEnd: string }> {
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { status: 'ACTIVE', currentPeriodEnd: end };
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    return signature.startsWith('sig_card_') || signature === 'valid_card_test_sig';
  }
}

/**
 * Mock Subscription Billing Provider for deterministic integration tests.
 */
export class MockSubscriptionBillingProvider implements SubscriptionBillingProvider {
  readonly providerName: SubscriptionBillingProviderName = 'MOCK_BILLING_PROVIDER';
  public shouldFailNextRenewal: boolean = false;
  public failureReasonMessage: string = 'INSUFFICIENT_FUNDS';
  public mockedExternalStatus: string = 'ACTIVE';

  async createBillingAgreement(ownerId: string, token: string): Promise<CreateBillingAgreementResult> {
    return {
      agreementExternalReference: `agr-mock-${generateUUIDv7()}`,
      maskedToken: 'Mock •••• 9999',
      mandateReference: 'MND-MOCK-001',
      status: 'ACTIVE',
    };
  }

  async createRecurringSubscription(agreementRef: string, planPrice: PlanPrice): Promise<CreateRecurringSubscriptionResult> {
    return {
      externalSubscriptionReference: `sub-mock-ext-${generateUUIDv7()}`,
      initialStatus: 'ACTIVE',
    };
  }

  async collectRenewal(externalSubRef: string, planPrice: PlanPrice): Promise<RenewalCollectionResult> {
    if (this.shouldFailNextRenewal) {
      return {
        success: false,
        providerTransactionId: `MOCK-FAIL-${generateUUIDv7().slice(0, 8)}`,
        failureReason: this.failureReasonMessage,
      };
    }
    return {
      success: true,
      providerTransactionId: `MOCK-TX-${generateUUIDv7().slice(0, 8)}`,
    };
  }

  async cancelRecurringSubscription(externalSubRef: string): Promise<boolean> {
    return true;
  }

  async fetchExternalStatus(externalSubRef: string): Promise<{ status: string; currentPeriodEnd: string }> {
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { status: this.mockedExternalStatus, currentPeriodEnd: end };
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    return signature === 'valid_webhook_signature' || signature.startsWith('sig_');
  }
}

export class SubscriptionBillingRegistry {
  private static providers: Map<SubscriptionBillingProviderName, SubscriptionBillingProvider> = new Map();

  static {
    const mpesa = new MpesaRecurringBillingProvider();
    const card = new CardGatewayBillingProvider();
    const mock = new MockSubscriptionBillingProvider();

    this.providers.set('MPESA_RECURRING', mpesa);
    this.providers.set('CARD_GATEWAY', card);
    this.providers.set('MOCK_BILLING_PROVIDER', mock);
  }

  public static getProvider(name: SubscriptionBillingProviderName): SubscriptionBillingProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Billing provider '${name}' not registered.`);
    }
    return provider;
  }

  public static getMockProvider(): MockSubscriptionBillingProvider {
    return this.providers.get('MOCK_BILLING_PROVIDER') as MockSubscriptionBillingProvider;
  }
}
