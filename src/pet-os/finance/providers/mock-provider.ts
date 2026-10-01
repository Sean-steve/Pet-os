/**
 * Pet OS Financial Platform - Mock Payment Provider
 * Deterministic testing fixture for unit, integration, and E2E financial test suites.
 */

import {
  PaymentProviderGateway,
  InitiatePaymentParams,
  InitiatePaymentResult,
  QueryPaymentResult,
  ProcessRefundParams,
  ProcessRefundResult,
  ProcessPayoutParams,
  ProcessPayoutResult,
  WebhookVerificationResult,
} from './gateway';
import { PaymentProviderName } from '../types';
import { CurrencyCode } from '../../kernel/money';

export class MockPaymentProvider implements PaymentProviderGateway {
  readonly providerName: PaymentProviderName = 'MOCK_PROVIDER';

  // Configurable hooks for simulating failure, async pending, or duplicate runs
  public forceNextFailure = false;
  public forceNextPending = false;
  public simulateNetworkTimeout = false;
  public fixedProviderFeeMinor = 1500; // 15.00 KES

  private transactions = new Map<
    string,
    {
      status: 'PENDING' | 'SUCCESS' | 'FAILED';
      amountMinor: number;
      currency: CurrencyCode;
      failureReason?: string;
    }
  >();

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    if (this.simulateNetworkTimeout) {
      throw new Error('ETIMEDOUT: Connection to payment gateway timed out');
    }

    const txId = `MOCK_TX_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (this.forceNextFailure) {
      this.forceNextFailure = false;
      this.transactions.set(txId, {
        status: 'FAILED',
        amountMinor: params.amount.amountMinor,
        currency: params.amount.currency,
        failureReason: 'Simulated processor decline',
      });
      return {
        success: false,
        providerTransactionId: txId,
        status: 'FAILED',
        message: 'Transaction declined by mock provider',
        providerFeeMinor: 0,
      };
    }

    if (this.forceNextPending) {
      this.forceNextPending = false;
      this.transactions.set(txId, {
        status: 'PENDING',
        amountMinor: params.amount.amountMinor,
        currency: params.amount.currency,
      });
      return {
        success: true,
        providerTransactionId: txId,
        status: 'PENDING',
        message: 'Payment queued at processor, awaiting customer confirmation',
        providerFeeMinor: this.fixedProviderFeeMinor,
      };
    }

    this.transactions.set(txId, {
      status: 'SUCCESS',
      amountMinor: params.amount.amountMinor,
      currency: params.amount.currency,
    });

    return {
      success: true,
      providerTransactionId: txId,
      status: 'SUCCESS',
      message: 'Mock payment authorized and captured successfully',
      providerFeeMinor: this.fixedProviderFeeMinor,
    };
  }

  async queryPaymentStatus(providerTransactionId: string): Promise<QueryPaymentResult> {
    const tx = this.transactions.get(providerTransactionId);
    if (!tx) {
      return {
        providerTransactionId,
        status: 'FAILED',
        amountMinor: 0,
        currency: 'KES',
        failureReason: 'Mock transaction not found',
      };
    }
    return {
      providerTransactionId,
      status: tx.status,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      failureReason: tx.failureReason,
    };
  }

  async processRefund(params: ProcessRefundParams): Promise<ProcessRefundResult> {
    return {
      success: true,
      providerRefundReference: `MOCK_REF_${Date.now()}`,
      status: 'SUCCEEDED',
      message: 'Mock refund settled successfully',
    };
  }

  async processPayout(params: ProcessPayoutParams): Promise<ProcessPayoutResult> {
    if (this.forceNextFailure) {
      this.forceNextFailure = false;
      return {
        success: false,
        providerReference: `MOCK_PAYOUT_FAIL_${Date.now()}`,
        status: 'FAILED',
        message: 'Mock payout failed due to invalid recipient account credentials',
      };
    }

    return {
      success: true,
      providerReference: `MOCK_PAYOUT_${Date.now()}`,
      status: 'PAID',
      message: 'Mock payout disbursed successfully',
    };
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): WebhookVerificationResult {
    const signature = headers['x-mock-signature'] || headers['x-signature'];
    if (!signature || signature === 'invalid_signature') {
      return {
        isValid: false,
        providerEventId: '',
        eventType: 'UNKNOWN',
        timestamp: new Date().toISOString(),
        payload: {},
        errorMessage: 'Invalid or missing mock cryptographic signature',
      };
    }

    try {
      const parsed = JSON.parse(rawBody);
      return {
        isValid: true,
        providerEventId: parsed.id || `mock_evt_${Date.now()}`,
        eventType: parsed.type || 'payment.succeeded',
        timestamp: new Date().toISOString(),
        payload: parsed,
      };
    } catch (err: any) {
      return {
        isValid: false,
        providerEventId: '',
        eventType: 'MALFORMED',
        timestamp: new Date().toISOString(),
        payload: {},
        errorMessage: err.message,
      };
    }
  }

  setTransactionStatus(txId: string, status: 'PENDING' | 'SUCCESS' | 'FAILED') {
    const existing = this.transactions.get(txId);
    if (existing) {
      existing.status = status;
    }
  }
}
