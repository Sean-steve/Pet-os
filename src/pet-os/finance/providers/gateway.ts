/**
 * Pet OS Financial Platform - Payment Provider Gateway Interface
 * Implements ADR-013: Payment Provider Abstraction (M-PESA First)
 * Isolates external vendor payment APIs behind a unified, vendor-agnostic adapter.
 */

import { CurrencyCode, Money } from '../../kernel/money';
import {
  PaymentIntentId,
  PaymentTransactionId,
  BookingId,
  UserId,
  ProviderPayoutId,
  RefundId,
} from '../../kernel/ids';
import {
  PaymentMethodType,
  PaymentProviderName,
  PaymentTransactionType,
  PaymentTransactionStatus,
  PayoutStatus,
  RefundStatus,
} from '../types';

export interface InitiatePaymentParams {
  paymentIntentId: PaymentIntentId;
  bookingId: BookingId;
  payerUserId: UserId;
  amount: Money;
  paymentMethodType: PaymentMethodType;
  customerPhoneNumber?: string; // For M-PESA STK Push (e.g. 254712345678)
  cardToken?: string;           // For tokenized Card processing
  idempotencyKey: string;
}

export interface InitiatePaymentResult {
  success: boolean;
  providerTransactionId: string;
  providerIntentReference?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REQUIRES_ACTION';
  requiresActionType?: 'MPESA_STK_PROMPT' | '3DS_REDIRECT';
  redirectUrl?: string;
  message: string;
  providerFeeMinor: number;
  rawResponseSummary?: Record<string, any>;
}

export interface QueryPaymentResult {
  providerTransactionId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amountMinor: number;
  currency: CurrencyCode;
  confirmedAt?: string;
  failureCode?: string;
  failureReason?: string;
}

export interface ProcessRefundParams {
  refundId: RefundId;
  originalProviderTransactionId: string;
  amount: Money;
  reason: string;
  idempotencyKey: string;
}

export interface ProcessRefundResult {
  success: boolean;
  providerRefundReference: string;
  status: RefundStatus;
  message: string;
}

export interface ProcessPayoutParams {
  payoutId: ProviderPayoutId;
  destinationToken: string; // Tokenized recipient phone or bank reference
  destinationType: 'MPESA_B2C' | 'BANK_ACCOUNT';
  amount: Money;
  recipientName: string;
  idempotencyKey: string;
}

export interface ProcessPayoutResult {
  success: boolean;
  providerReference: string;
  status: PayoutStatus;
  message: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  providerEventId: string;
  eventType: string;
  isDuplicate?: boolean;
  timestamp: string;
  payload: Record<string, any>;
  errorMessage?: string;
}

export interface PaymentProviderGateway {
  readonly providerName: PaymentProviderName;

  /**
   * Initiates payment flow with external processor
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Queries authoritative status from external provider
   */
  queryPaymentStatus(providerTransactionId: string): Promise<QueryPaymentResult>;

  /**
   * Processes an authorized refund back to customer original payment source
   */
  processRefund(params: ProcessRefundParams): Promise<ProcessRefundResult>;

  /**
   * Disburses payout funds to a verified provider destination
   */
  processPayout(params: ProcessPayoutParams): Promise<ProcessPayoutResult>;

  /**
   * Verifies cryptographic webhook signature from external payment gateway
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): WebhookVerificationResult;
}
