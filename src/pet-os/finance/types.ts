/**
 * Pet OS Financial Platform - Core Types & Contracts
 * Implements Volume XVII, ADR-012 (Double-Entry Ledger), ADR-013 (Payment Provider Abstraction).
 * Production-grade financial correctness, immutable ledger, and currency safety.
 */

import {
  BookingId,
  UserId,
  HouseholdId,
  ProviderId,
  BusinessId,
  PaymentIntentId,
  PaymentTransactionId,
  LedgerAccountId,
  LedgerJournalId,
  LedgerEntryId,
  CommissionRuleId,
  CommissionSnapshotId,
  ProviderEarningId,
  EarningHoldId,
  RefundId,
  FinancialAdjustmentId,
  ProviderPayoutDestinationId,
  ProviderPayoutId,
  PayoutAllocationId,
  ReconciliationRunId,
  ReconciliationItemId,
  FinancialReceiptId,
  WebhookEventId,
  CorrelationId,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import { ProviderCategory } from '../provider/types';

// ============================================================================
// 1. PAYMENT ENUMS & STATUSES
// ============================================================================

export type PaymentMethodType = 'MPESA' | 'CARD' | 'BANK_TRANSFER';

export type PaymentProviderName = 'MPESA_SAFARICOM' | 'CARD_GATEWAY' | 'MOCK_PROVIDER';

export type PaymentIntentStatus =
  | 'CREATED'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PaymentTransactionType =
  | 'AUTHORIZATION'
  | 'CAPTURE'
  | 'CHARGE'
  | 'REFUND'
  | 'PAYOUT'
  | 'REVERSAL';

export type PaymentTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

// ============================================================================
// 2. DOUBLE-ENTRY LEDGER ENUMS & ACCOUNT CODES
// ============================================================================

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type LedgerAccountCode =
  | 'ASSET_CASH_CLEARING_MPESA'
  | 'ASSET_CASH_CLEARING_CARD'
  | 'ASSET_PAYMENT_PROCESSOR_RECEIVABLE'
  | 'LIABILITY_CUSTOMER_PREPAYMENTS'
  | 'LIABILITY_PROVIDER_PAYABLE_PENDING'
  | 'LIABILITY_PROVIDER_PAYABLE_AVAILABLE'
  | 'LIABILITY_REFUND_PAYABLE'
  | 'LIABILITY_PAYOUT_CLEARING'
  | 'REVENUE_PLATFORM_COMMISSION'
  | 'EXPENSE_PAYMENT_PROCESSOR_FEES'
  | 'EXPENSE_PLATFORM_DISCOUNTS';

export type JournalType =
  | 'CUSTOMER_PAYMENT'
  | 'SERVICE_FULFILLMENT'
  | 'CUSTOMER_REFUND'
  | 'PROVIDER_PAYOUT'
  | 'FINANCIAL_ADJUSTMENT'
  | 'REVERSAL';

export type JournalSourceType =
  | 'BOOKING_PAYMENT'
  | 'SERVICE_COMPLETION'
  | 'REFUND'
  | 'PAYOUT'
  | 'ADJUSTMENT';

export type LedgerDirection = 'DEBIT' | 'CREDIT';

// ============================================================================
// 3. PROVIDER EARNINGS & PAYOUT ENUMS
// ============================================================================

export type ProviderEarningStatus =
  | 'PENDING'               // Held pending service fulfillment + settlement window
  | 'HELD'                  // Blocked due to dispute, cancellation review or safety incident
  | 'AVAILABLE'             // Cleared & available for withdrawal
  | 'RESERVED_FOR_PAYOUT'   // Atomically locked in an active in-flight payout
  | 'PAID'                  // Disbursed to provider destination
  | 'REVERSED';             // Cancelled/refunded before or during settlement

export type EarningHoldReason =
  | 'PENDING_SERVICE'
  | 'DISPUTE_OPEN'
  | 'SAFETY_INCIDENT'
  | 'ADMINISTRATIVE_REVIEW'
  | 'CANCELLATION_PENDING';

export type PayoutStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REVERSED'
  | 'CANCELLED';

export type PayoutDestinationType = 'MPESA_B2C' | 'BANK_ACCOUNT';

export type PayoutDestinationStatus = 'PENDING' | 'VERIFIED' | 'DISABLED';

// ============================================================================
// 4. REFUND & ADJUSTMENT ENUMS
// ============================================================================

export type RefundStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type RefundReason =
  | 'OWNER_CANCELLATION'
  | 'PROVIDER_CANCELLATION'
  | 'SERVICE_UNSATISFACTORY'
  | 'DUPLICATE_CHARGE'
  | 'GOODWILL'
  | 'SYSTEM_RECOVERY';

export type FinancialAdjustmentReason =
  | 'RESCHEDULE_PRICE_DIFFERENCE'
  | 'GOODWILL_CREDIT'
  | 'CANCELLATION_FEE_CORRECTION'
  | 'MANUAL_RECONCILIATION_CORRECTION';

// ============================================================================
// 5. RECONCILIATION ENUMS
// ============================================================================

export type ReconciliationClassification =
  | 'MATCHED'
  | 'MISSING_INTERNAL'
  | 'MISSING_PROVIDER'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'DUPLICATE'
  | 'NEEDS_REVIEW';

export type ReconciliationStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

// ============================================================================
// 6. CORE FINANCIAL AGGREGATES & ENTITIES
// ============================================================================

export interface PaymentIntent {
  paymentIntentId: PaymentIntentId;
  bookingId: BookingId;
  payerUserId: UserId;
  householdId: HouseholdId;
  amountMinor: number;
  currency: CurrencyCode;
  paymentMethodType: PaymentMethodType;
  provider: PaymentProviderName;
  providerIntentReference?: string;
  status: PaymentIntentStatus;
  expiresAt: string;
  idempotencyKey: string;
  metadata: {
    serviceTitle: string;
    providerName: string;
    petCount: number;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  succeededAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  failureReason?: string;
}

export interface PaymentTransaction {
  paymentTransactionId: PaymentTransactionId;
  paymentIntentId: PaymentIntentId;
  bookingId: BookingId;
  provider: PaymentProviderName;
  providerTransactionId: string; // e.g. Safaricom MPesa Receipt 'QGH781290X'
  transactionType: PaymentTransactionType;
  status: PaymentTransactionStatus;
  requestedAmountMinor: number;
  settledAmountMinor?: number;
  currency: CurrencyCode;
  providerFeeMinor: number;
  initiatedAt: string;
  confirmedAt?: string;
  failureCode?: string;
  failureReasonNormalized?: string;
  rawProviderReference?: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Double-Entry Ledger Entities
// ----------------------------------------------------------------------------

export interface LedgerAccount {
  accountId: LedgerAccountId;
  code: LedgerAccountCode;
  name: string;
  type: LedgerAccountType;
  currency: CurrencyCode;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface LedgerEntry {
  entryId: LedgerEntryId;
  journalId: LedgerJournalId;
  accountId: LedgerAccountId;
  accountCode: LedgerAccountCode;
  direction: LedgerDirection;
  amountMinor: number;
  currency: CurrencyCode;
  providerId?: ProviderId;
  businessId?: BusinessId;
  bookingId?: BookingId;
  reference?: string;
  createdAt: string;
}

export interface LedgerJournal {
  journalId: LedgerJournalId;
  journalType: JournalType;
  sourceType: JournalSourceType;
  sourceId: string;
  currency: CurrencyCode;
  status: 'POSTED';
  totalAmountMinor: number;
  postedAt: string;
  reversalOfJournalId?: LedgerJournalId;
  correlationId?: CorrelationId;
  idempotencyKey: string;
  description: string;
  entries: LedgerEntry[];
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Commission & Fee Snapshots
// ----------------------------------------------------------------------------

export interface PlatformCommissionRule {
  ruleId: CommissionRuleId;
  category: ProviderCategory | 'ALL';
  providerId?: ProviderId;
  businessId?: BusinessId;
  percentageBps: number; // e.g. 1500 = 15.00%
  fixedAmountMinor: number; // e.g. 0 or 5000 (50.00 KES)
  currency: CurrencyCode;
  effectiveFrom: string;
  effectiveTo?: string;
  version: number;
  description: string;
}

export interface CommissionSnapshot {
  snapshotId: CommissionSnapshotId;
  ruleId: CommissionRuleId;
  ruleVersion: number;
  grossAmountMinor: number;
  commissionRateBps: number;
  commissionAmountMinor: number;
  fixedFeeMinor: number;
  netCommissionMinor: number;
  currency: CurrencyCode;
  appliedAt: string;
}

// ----------------------------------------------------------------------------
// Provider Earnings & Holds
// ----------------------------------------------------------------------------

export interface ProviderEarning {
  earningId: ProviderEarningId;
  bookingId: BookingId;
  providerId: ProviderId;
  businessId?: BusinessId;
  grossAmountMinor: number;
  platformCommissionMinor: number;
  providerFeesMinor: number;
  adjustmentsMinor: number;
  netAmountMinor: number; // gross - commission - fees + adjustments
  currency: CurrencyCode;
  status: ProviderEarningStatus;
  holdReason?: EarningHoldReason;
  availableAt?: string; // Set when fulfillment is completed and settlement period lapses
  payoutId?: ProviderPayoutId;
  createdAt: string;
  updatedAt: string;
}

export interface EarningHold {
  holdId: EarningHoldId;
  earningId: ProviderEarningId;
  providerId: ProviderId;
  reason: EarningHoldReason;
  description: string;
  placedByUserId: UserId;
  placedAt: string;
  releasedAt?: string;
  releasedByUserId?: UserId;
}

export interface ProviderFinancialSummary {
  providerId: ProviderId;
  businessId?: BusinessId;
  currency: CurrencyCode;
  pendingBalanceMinor: number;
  availableBalanceMinor: number;
  reservedBalanceMinor: number;
  lifetimePaidMinor: number;
  lifetimeGrossMinor: number;
  lifetimeCommissionMinor: number;
  earningsCount: number;
  payoutCount: number;
  asOf: string;
}

// ----------------------------------------------------------------------------
// Provider Payouts & Destinations
// ----------------------------------------------------------------------------

export interface ProviderPayoutDestination {
  destinationId: ProviderPayoutDestinationId;
  providerId: ProviderId;
  type: PayoutDestinationType;
  status: PayoutDestinationStatus;
  // Masked display credentials
  displayTitle: string; // e.g. "M-PESA (2547****1234)" or "Equity Bank (****4567)"
  maskedIdentifier: string;
  // Tokenized/secure internal reference (never raw PIN or unencrypted bank credentials)
  destinationToken: string;
  isDefault: boolean;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutAllocation {
  allocationId: PayoutAllocationId;
  payoutId: ProviderPayoutId;
  earningId: ProviderEarningId;
  allocatedAmountMinor: number;
  currency: CurrencyCode;
  allocatedAt: string;
}

export interface ProviderPayout {
  payoutId: ProviderPayoutId;
  providerId: ProviderId;
  businessId?: BusinessId;
  destinationId: ProviderPayoutDestinationId;
  amountMinor: number;
  currency: CurrencyCode;
  status: PayoutStatus;
  providerReference?: string;
  allocatedEarningIds: ProviderEarningId[];
  initiatedAt: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Refunds & Financial Adjustments
// ----------------------------------------------------------------------------

export interface Refund {
  refundId: RefundId;
  bookingId: BookingId;
  paymentTransactionId: PaymentTransactionId;
  requestedByUserId: UserId;
  reason: RefundReason;
  reasonDetails?: string;
  requestedAmountMinor: number;
  settledAmountMinor?: number;
  currency: CurrencyCode;
  status: RefundStatus;
  providerRefundReference?: string;
  failureReason?: string;
  requestedAt: string;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
}

export interface FinancialAdjustment {
  adjustmentId: FinancialAdjustmentId;
  providerId?: ProviderId;
  bookingId?: BookingId;
  reason: FinancialAdjustmentReason;
  amountMinor: number;
  direction: 'CREDIT' | 'DEBIT';
  currency: CurrencyCode;
  description: string;
  authorizedByUserId: UserId;
  journalId?: LedgerJournalId;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Receipts (Immutable customer & refund records)
// ----------------------------------------------------------------------------

export interface FinancialReceipt {
  receiptId: FinancialReceiptId;
  receiptNumber: string; // e.g. "REC-202609-00124"
  bookingId: BookingId;
  paymentIntentId: PaymentIntentId;
  paymentTransactionId: PaymentTransactionId;
  payerUserId: UserId;
  payerName: string;
  providerId: ProviderId;
  providerName: string;
  serviceTitle: string;
  serviceScheduledAt: string;
  amountMinor: number;
  currency: CurrencyCode;
  paymentMethod: string;
  paymentReference: string;
  taxAmountMinor: number;
  issuedAt: string;
}

export interface RefundReceipt {
  refundReceiptId: string;
  refundId: RefundId;
  originalReceiptId: FinancialReceiptId;
  bookingId: BookingId;
  refundedAmountMinor: number;
  currency: CurrencyCode;
  reason: string;
  providerRefundReference?: string;
  issuedAt: string;
}

// ----------------------------------------------------------------------------
// Reconciliation Framework
// ----------------------------------------------------------------------------

export interface ReconciliationRun {
  runId: ReconciliationRunId;
  provider: PaymentProviderName;
  periodStart: string;
  periodEnd: string;
  status: ReconciliationStatus;
  startedAt: string;
  completedAt?: string;
  totalInternalTransactions: number;
  totalProviderTransactions: number;
  totalInternalAmountMinor: number;
  totalProviderAmountMinor: number;
  matchedCount: number;
  exceptionCount: number;
  currency: CurrencyCode;
  items: ReconciliationItem[];
}

export interface ReconciliationItem {
  itemId: ReconciliationItemId;
  runId: ReconciliationRunId;
  classification: ReconciliationClassification;
  providerTransactionId?: string;
  internalTransactionId?: PaymentTransactionId;
  bookingId?: BookingId;
  providerAmountMinor?: number;
  internalAmountMinor?: number;
  currency: CurrencyCode;
  discrepancyMinor?: number;
  resolutionStatus: 'UNRESOLVED' | 'INVESTIGATING' | 'ADJUSTMENT_POSTED' | 'DISMISSED';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedByUserId?: UserId;
}

// ----------------------------------------------------------------------------
// Webhook Records & Fraud Hooks
// ----------------------------------------------------------------------------

export interface WebhookEventRecord {
  eventId: WebhookEventId;
  provider: PaymentProviderName;
  providerEventId: string;
  eventType: string;
  signature: string;
  receivedAt: string;
  processedAt?: string;
  isDuplicate: boolean;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  payloadSummary: Record<string, any>;
  errorMessage?: string;
}

export interface FinancialFraudFlag {
  flagId: string;
  userId?: UserId;
  providerId?: ProviderId;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'REPEATED_PAYMENT_FAILURE' | 'RAPID_REFUND' | 'PAYOUT_DESTINATION_VELOCITY' | 'UNUSUAL_VOLUME';
  reason: string;
  flaggedAt: string;
  isResolved: boolean;
}

// ============================================================================
// 7. FINANCIAL RBAC PERMISSIONS
// ============================================================================

export type FinancialPermission =
  | 'payment.read_self'
  | 'payment.create_self'
  | 'refund.request_self'
  | 'provider.earnings.read_self'
  | 'provider.payouts.read_self'
  | 'provider.payout_destination.manage_self'
  | 'finance.payments.read'
  | 'finance.refunds.approve'
  | 'finance.adjustments.create'
  | 'finance.payouts.manage'
  | 'finance.reconciliation.manage'
  | 'finance.ledger.read';
