/**
 * Pet OS Financial Platform - In-Memory Repository Store
 * Implements high-performance indexed queries, multi-entity retrieval, and projection derivation.
 */

import {
  PaymentIntentId,
  PaymentTransactionId,
  ProviderEarningId,
  EarningHoldId,
  ProviderPayoutDestinationId,
  ProviderPayoutId,
  PayoutAllocationId,
  RefundId,
  FinancialAdjustmentId,
  FinancialReceiptId,
  ReconciliationRunId,
  ReconciliationItemId,
  WebhookEventId,
  BookingId,
  ProviderId,
  UserId,
  HouseholdId,
} from '../kernel/ids';
import {
  PaymentIntent,
  PaymentTransaction,
  ProviderEarning,
  EarningHold,
  ProviderPayoutDestination,
  ProviderPayout,
  PayoutAllocation,
  Refund,
  FinancialAdjustment,
  FinancialReceipt,
  RefundReceipt,
  ReconciliationRun,
  ReconciliationItem,
  WebhookEventRecord,
  FinancialFraudFlag,
  ProviderFinancialSummary,
} from './types';
import { CurrencyCode } from '../kernel/money';

export class FinanceStore {
  private static instance: FinanceStore;

  static getInstance(): FinanceStore {
    if (!FinanceStore.instance) {
      FinanceStore.instance = new FinanceStore();
    }
    return FinanceStore.instance;
  }

  reset(): void {
    this.paymentIntents.clear();
    this.paymentTransactions.clear();
    this.providerEarnings.clear();
    this.earningHolds.clear();
    this.payoutDestinations.clear();
    this.payouts.clear();
    this.payoutAllocations.clear();
    this.refunds.clear();
    this.financialAdjustments.clear();
    this.receipts.clear();
    this.refundReceipts.clear();
    this.reconciliationRuns.clear();
    this.reconciliationItems.clear();
    this.webhookEvents.clear();
    this.fraudFlags.clear();
    this.intentsByBooking.clear();
    this.intentsByIdempotency.clear();
    this.earningsByProvider.clear();
    this.earningsByBooking.clear();
    this.payoutsByProvider.clear();
    this.destinationsByProvider.clear();
    this.refundsByBooking.clear();
    this.receiptsByBooking.clear();
    this.webhookByProviderEventId.clear();
  }

  // Primary Entity Maps
  readonly paymentIntents = new Map<PaymentIntentId, PaymentIntent>();
  readonly paymentTransactions = new Map<PaymentTransactionId, PaymentTransaction>();
  readonly providerEarnings = new Map<ProviderEarningId, ProviderEarning>();
  readonly earningHolds = new Map<EarningHoldId, EarningHold>();
  readonly payoutDestinations = new Map<ProviderPayoutDestinationId, ProviderPayoutDestination>();
  readonly payouts = new Map<ProviderPayoutId, ProviderPayout>();
  readonly payoutAllocations = new Map<PayoutAllocationId, PayoutAllocation>();
  readonly refunds = new Map<RefundId, Refund>();
  readonly financialAdjustments = new Map<FinancialAdjustmentId, FinancialAdjustment>();
  readonly receipts = new Map<FinancialReceiptId, FinancialReceipt>();
  readonly refundReceipts = new Map<string, RefundReceipt>();
  readonly reconciliationRuns = new Map<ReconciliationRunId, ReconciliationRun>();
  readonly reconciliationItems = new Map<ReconciliationItemId, ReconciliationItem>();
  readonly webhookEvents = new Map<WebhookEventId, WebhookEventRecord>();
  readonly fraudFlags = new Map<string, FinancialFraudFlag>();

  // Secondary Indices
  private intentsByBooking = new Map<BookingId, PaymentIntentId[]>();
  private intentsByIdempotency = new Map<string, PaymentIntentId>();
  private earningsByProvider = new Map<ProviderId, ProviderEarningId[]>();
  private earningsByBooking = new Map<BookingId, ProviderEarningId[]>();
  private payoutsByProvider = new Map<ProviderId, ProviderPayoutId[]>();
  private destinationsByProvider = new Map<ProviderId, ProviderPayoutDestinationId[]>();
  private refundsByBooking = new Map<BookingId, RefundId[]>();
  private receiptsByBooking = new Map<BookingId, FinancialReceiptId>();
  private webhookByProviderEventId = new Map<string, WebhookEventId>();

  // ==========================================================================
  // PAYMENT INTENTS
  // ==========================================================================

  savePaymentIntent(intent: PaymentIntent): void {
    this.paymentIntents.set(intent.paymentIntentId, intent);

    // Index by booking
    const list = this.intentsByBooking.get(intent.bookingId) || [];
    if (!list.includes(intent.paymentIntentId)) {
      list.push(intent.paymentIntentId);
      this.intentsByBooking.set(intent.bookingId, list);
    }

    // Index by idempotency key
    if (intent.idempotencyKey) {
      this.intentsByIdempotency.set(intent.idempotencyKey, intent.paymentIntentId);
    }
  }

  getPaymentIntent(id: PaymentIntentId): PaymentIntent | undefined {
    return this.paymentIntents.get(id);
  }

  getPaymentIntentByIdempotency(key: string): PaymentIntent | undefined {
    const id = this.intentsByIdempotency.get(key);
    return id ? this.paymentIntents.get(id) : undefined;
  }

  getIntentsForBooking(bookingId: BookingId): PaymentIntent[] {
    const ids = this.intentsByBooking.get(bookingId) || [];
    return ids.map(id => this.paymentIntents.get(id)!).filter(Boolean);
  }

  getActiveIntentForBooking(bookingId: BookingId): PaymentIntent | undefined {
    return this.getIntentsForBooking(bookingId).find(
      i => i.status === 'CREATED' || i.status === 'REQUIRES_ACTION' || i.status === 'PROCESSING'
    );
  }

  getSuccessfulIntentForBooking(bookingId: BookingId): PaymentIntent | undefined {
    return this.getIntentsForBooking(bookingId).find(i => i.status === 'SUCCEEDED');
  }

  // ==========================================================================
  // PAYMENT TRANSACTIONS
  // ==========================================================================

  savePaymentTransaction(tx: PaymentTransaction): void {
    this.paymentTransactions.set(tx.paymentTransactionId, tx);
  }

  getPaymentTransaction(id: PaymentTransactionId): PaymentTransaction | undefined {
    return this.paymentTransactions.get(id);
  }

  getTransactionsForIntent(intentId: PaymentIntentId): PaymentTransaction[] {
    return Array.from(this.paymentTransactions.values()).filter(t => t.paymentIntentId === intentId);
  }

  getTransactionByProviderId(providerTxId: string): PaymentTransaction | undefined {
    return Array.from(this.paymentTransactions.values()).find(t => t.providerTransactionId === providerTxId);
  }

  // ==========================================================================
  // PROVIDER EARNINGS & READ MODEL PROJECTION
  // ==========================================================================

  saveProviderEarning(earning: ProviderEarning): void {
    this.providerEarnings.set(earning.earningId, earning);

    // Index by provider
    const pList = this.earningsByProvider.get(earning.providerId) || [];
    if (!pList.includes(earning.earningId)) {
      pList.push(earning.earningId);
      this.earningsByProvider.set(earning.providerId, pList);
    }

    // Index by booking
    const bList = this.earningsByBooking.get(earning.bookingId) || [];
    if (!bList.includes(earning.earningId)) {
      bList.push(earning.earningId);
      this.earningsByBooking.set(earning.bookingId, bList);
    }
  }

  getProviderEarning(id: ProviderEarningId): ProviderEarning | undefined {
    return this.providerEarnings.get(id);
  }

  getEarningsForProvider(providerId: ProviderId): ProviderEarning[] {
    const ids = this.earningsByProvider.get(providerId) || [];
    return ids.map(id => this.providerEarnings.get(id)!).filter(Boolean);
  }

  getEarningsForBooking(bookingId: BookingId): ProviderEarning[] {
    const ids = this.earningsByBooking.get(bookingId) || [];
    return ids.map(id => this.providerEarnings.get(id)!).filter(Boolean);
  }

  /**
   * CANONICAL READ MODEL PROJECTION:
   * Reconstructs provider balances dynamically from immutable earnings records.
   * Never mutates a solitary balance column.
   */
  getProviderFinancialSummary(providerId: ProviderId, currency: CurrencyCode = 'KES'): ProviderFinancialSummary {
    const earnings = this.getEarningsForProvider(providerId).filter(e => e.currency === currency);
    const payouts = this.getPayoutsForProvider(providerId).filter(p => p.currency === currency && p.status === 'PAID');

    let pendingMinor = 0;
    let availableMinor = 0;
    let reservedMinor = 0;
    let lifetimePaidMinor = 0;
    let lifetimeGrossMinor = 0;
    let lifetimeCommissionMinor = 0;

    for (const e of earnings) {
      lifetimeGrossMinor += e.grossAmountMinor;
      lifetimeCommissionMinor += e.platformCommissionMinor;

      switch (e.status) {
        case 'PENDING':
        case 'HELD':
          pendingMinor += e.netAmountMinor;
          break;
        case 'AVAILABLE':
          availableMinor += e.netAmountMinor;
          break;
        case 'RESERVED_FOR_PAYOUT':
          reservedMinor += e.netAmountMinor;
          break;
        case 'PAID':
          lifetimePaidMinor += e.netAmountMinor;
          break;
        case 'REVERSED':
          // Reversals do not contribute to positive balances
          break;
      }
    }

    return {
      providerId,
      currency,
      pendingBalanceMinor: pendingMinor,
      availableBalanceMinor: availableMinor,
      reservedBalanceMinor: reservedMinor,
      lifetimePaidMinor,
      lifetimeGrossMinor,
      lifetimeCommissionMinor,
      earningsCount: earnings.length,
      payoutCount: payouts.length,
      asOf: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // EARNING HOLDS
  // ==========================================================================

  saveEarningHold(hold: EarningHold): void {
    this.earningHolds.set(hold.holdId, hold);
  }

  getHoldsForEarning(earningId: ProviderEarningId): EarningHold[] {
    return Array.from(this.earningHolds.values()).filter(h => h.earningId === earningId);
  }

  // ==========================================================================
  // PAYOUT DESTINATIONS & PAYOUTS
  // ==========================================================================

  savePayoutDestination(dest: ProviderPayoutDestination): void {
    this.payoutDestinations.set(dest.destinationId, dest);
    const list = this.destinationsByProvider.get(dest.providerId) || [];
    if (!list.includes(dest.destinationId)) {
      list.push(dest.destinationId);
      this.destinationsByProvider.set(dest.providerId, list);
    }
  }

  getPayoutDestination(id: ProviderPayoutDestinationId): ProviderPayoutDestination | undefined {
    return this.payoutDestinations.get(id);
  }

  getDestinationsForProvider(providerId: ProviderId): ProviderPayoutDestination[] {
    const ids = this.destinationsByProvider.get(providerId) || [];
    return ids.map(id => this.payoutDestinations.get(id)!).filter(Boolean);
  }

  savePayout(payout: ProviderPayout): void {
    this.payouts.set(payout.payoutId, payout);
    const list = this.payoutsByProvider.get(payout.providerId) || [];
    if (!list.includes(payout.payoutId)) {
      list.push(payout.payoutId);
      this.payoutsByProvider.set(payout.providerId, list);
    }
  }

  getPayout(id: ProviderPayoutId): ProviderPayout | undefined {
    return this.payouts.get(id);
  }

  getPayoutsForProvider(providerId: ProviderId): ProviderPayout[] {
    const ids = this.payoutsByProvider.get(providerId) || [];
    return ids.map(id => this.payouts.get(id)!).filter(Boolean);
  }

  savePayoutAllocation(alloc: PayoutAllocation): void {
    this.payoutAllocations.set(alloc.allocationId, alloc);
  }

  getAllocationsForPayout(payoutId: ProviderPayoutId): PayoutAllocation[] {
    return Array.from(this.payoutAllocations.values()).filter(a => a.payoutId === payoutId);
  }

  // ==========================================================================
  // REFUNDS & ADJUSTMENTS
  // ==========================================================================

  saveRefund(refund: Refund): void {
    this.refunds.set(refund.refundId, refund);
    const list = this.refundsByBooking.get(refund.bookingId) || [];
    if (!list.includes(refund.refundId)) {
      list.push(refund.refundId);
      this.refundsByBooking.set(refund.bookingId, list);
    }
  }

  getRefund(id: RefundId): Refund | undefined {
    return this.refunds.get(id);
  }

  getRefundsForBooking(bookingId: BookingId): Refund[] {
    const ids = this.refundsByBooking.get(bookingId) || [];
    return ids.map(id => this.refunds.get(id)!).filter(Boolean);
  }

  saveFinancialAdjustment(adj: FinancialAdjustment): void {
    this.financialAdjustments.set(adj.adjustmentId, adj);
  }

  getAdjustmentsForProvider(providerId: ProviderId): FinancialAdjustment[] {
    return Array.from(this.financialAdjustments.values()).filter(a => a.providerId === providerId);
  }

  // ==========================================================================
  // RECEIPTS
  // ==========================================================================

  saveReceipt(receipt: FinancialReceipt): void {
    this.receipts.set(receipt.receiptId, receipt);
    this.receiptsByBooking.set(receipt.bookingId, receipt.receiptId);
  }

  getReceipt(id: FinancialReceiptId): FinancialReceipt | undefined {
    return this.receipts.get(id);
  }

  getReceiptForBooking(bookingId: BookingId): FinancialReceipt | undefined {
    const id = this.receiptsByBooking.get(bookingId);
    return id ? this.receipts.get(id) : undefined;
  }

  saveRefundReceipt(receipt: RefundReceipt): void {
    this.refundReceipts.set(receipt.refundReceiptId, receipt);
  }

  getRefundReceipt(id: string): RefundReceipt | undefined {
    return this.refundReceipts.get(id);
  }

  // ==========================================================================
  // RECONCILIATION
  // ==========================================================================

  saveReconciliationRun(run: ReconciliationRun): void {
    this.reconciliationRuns.set(run.runId, run);
  }

  getReconciliationRun(id: ReconciliationRunId): ReconciliationRun | undefined {
    return this.reconciliationRuns.get(id);
  }

  getAllReconciliationRuns(): ReconciliationRun[] {
    return Array.from(this.reconciliationRuns.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  saveReconciliationItem(item: ReconciliationItem): void {
    this.reconciliationItems.set(item.itemId, item);
  }

  // ==========================================================================
  // WEBHOOK EVENTS & DEDUPLICATION
  // ==========================================================================

  saveWebhookEvent(evt: WebhookEventRecord): void {
    this.webhookEvents.set(evt.eventId, evt);
    if (evt.providerEventId) {
      this.webhookByProviderEventId.set(evt.providerEventId, evt.eventId);
    }
  }

  getWebhookByProviderEventId(providerEventId: string): WebhookEventRecord | undefined {
    const id = this.webhookByProviderEventId.get(providerEventId);
    return id ? this.webhookEvents.get(id) : undefined;
  }

  getAllWebhookEvents(): WebhookEventRecord[] {
    return Array.from(this.webhookEvents.values()).sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  // ==========================================================================
  // FRAUD / ABUSE FLAGS
  // ==========================================================================

  saveFraudFlag(flag: FinancialFraudFlag): void {
    this.fraudFlags.set(flag.flagId, flag);
  }

  getAllFraudFlags(): FinancialFraudFlag[] {
    return Array.from(this.fraudFlags.values());
  }

  clear(): void {
    this.paymentIntents.clear();
    this.paymentTransactions.clear();
    this.providerEarnings.clear();
    this.earningHolds.clear();
    this.payoutDestinations.clear();
    this.payouts.clear();
    this.payoutAllocations.clear();
    this.refunds.clear();
    this.financialAdjustments.clear();
    this.receipts.clear();
    this.refundReceipts.clear();
    this.reconciliationRuns.clear();
    this.reconciliationItems.clear();
    this.webhookEvents.clear();
    this.fraudFlags.clear();
    this.intentsByBooking.clear();
    this.intentsByIdempotency.clear();
    this.earningsByProvider.clear();
    this.earningsByBooking.clear();
    this.payoutsByProvider.clear();
    this.destinationsByProvider.clear();
    this.refundsByBooking.clear();
    this.receiptsByBooking.clear();
    this.webhookByProviderEventId.clear();
  }
}
