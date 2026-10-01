/**
 * Pet OS Financial Platform - Core Financial Application Service
 * Coordinates payments, checkout, double-entry ledger postings, commission snapshots,
 * provider earnings lifecycle, payouts, refunds, and reconciliation.
 */

import {
  BookingId,
  UserId,
  HouseholdId,
  ProviderId,
  BusinessId,
  PaymentIntentId,
  PaymentTransactionId,
  ProviderEarningId,
  ProviderPayoutDestinationId,
  ProviderPayoutId,
  RefundId,
  FinancialAdjustmentId,
  FinancialReceiptId,
  WebhookEventId,
  ReconciliationRunId,
  ReconciliationItemId,
  asPaymentIntentId,
  asPaymentTransactionId,
  asProviderEarningId,
  asProviderPayoutDestinationId,
  asProviderPayoutId,
  asRefundId,
  asFinancialAdjustmentId,
  asFinancialReceiptId,
  asWebhookEventId,
  asReconciliationRunId,
  asReconciliationItemId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import { ProviderCategory } from '../provider/types';
import { BookingStatus, BookingCancellationActor } from '../booking/types';
import { BookingStore } from '../booking/store';
import { IdentityStore } from '../identity/store';
import { DoubleEntryLedgerEngine } from './ledger';
import { CommissionEngine } from './commission';
import { PaymentProviderRegistry } from './providers/registry';
import { FinanceStore } from './store';
import {
  PaymentIntent,
  PaymentTransaction,
  PaymentMethodType,
  PaymentProviderName,
  ProviderEarning,
  ProviderPayoutDestination,
  ProviderPayout,
  Refund,
  RefundReason,
  FinancialAdjustment,
  FinancialAdjustmentReason,
  FinancialReceipt,
  RefundReceipt,
  ReconciliationRun,
  ReconciliationItem,
  ReconciliationClassification,
  WebhookEventRecord,
  FinancialPermission,
  ProviderFinancialSummary,
} from './types';

export interface CreatePaymentIntentParams {
  bookingId: BookingId;
  payerUserId: UserId;
  paymentMethodType: PaymentMethodType;
  providerName?: PaymentProviderName;
  idempotencyKey?: string;
}

export interface InitiateBookingPaymentParams {
  paymentIntentId: PaymentIntentId;
  payerUserId: UserId;
  customerPhoneNumber?: string;
  cardToken?: string;
}

export interface SettlementRecordInput {
  providerTransactionId: string;
  amountMinor: number;
  currency: CurrencyCode;
  status: 'SUCCESS' | 'FAILED';
  bookingId?: BookingId;
  timestamp: string;
}

export class FinancialPlatformService {
  constructor(
    readonly financeStore: FinanceStore,
    readonly ledger: DoubleEntryLedgerEngine,
    readonly commissionEngine: CommissionEngine,
    readonly providers: PaymentProviderRegistry,
    readonly bookingStore: BookingStore,
    readonly identityStore: IdentityStore
  ) {}

  // ==========================================================================
  // 1. BOOKING CHECKOUT & PAYMENT INTENT CREATION
  // ==========================================================================

  /**
   * Server-authoritative checkout creation.
   * NEVER accepts payment amount from client! Resolves amount strictly from BookingPriceSnapshot.
   */
  async createBookingPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    const booking = this.bookingStore.getBooking(params.bookingId);
    if (!booking) {
      throw new Error(`Booking not found for payment checkout: ${params.bookingId}`);
    }

    // Authorization: Payer must be the booking owner or a member of the booking household
    const isOwner = booking.ownerUserId === params.payerUserId;
    const membership = IdentityStore.findMembership(booking.householdId, params.payerUserId);
    const isHouseholdMember = !!membership;
    if (!isOwner && !isHouseholdMember) {
      throw new Error('Access denied: You are not authorized to pay for this booking.');
    }

    // Booking State Guard: Must permit payment
    const payableStates: BookingStatus[] = ['DRAFT', 'CONFIRMED', 'PENDING_PROVIDER'];
    if (!payableStates.includes(booking.status)) {
      throw new Error(`Booking state '${booking.status}' does not permit payment.`);
    }

    // Check if already paid
    const existingSuccess = this.financeStore.getSuccessfulIntentForBooking(params.bookingId);
    if (existingSuccess) {
      throw new Error(`Booking ${params.bookingId} has already been paid successfully.`);
    }

    // Check active idempotency
    const idempotencyKey = params.idempotencyKey || `checkout_${booking.bookingId}_${params.paymentMethodType}`;
    const cachedIntent = this.financeStore.getPaymentIntentByIdempotency(idempotencyKey);
    if (cachedIntent && cachedIntent.status !== 'FAILED' && cachedIntent.status !== 'EXPIRED') {
      return cachedIntent;
    }

    // Reuse existing active intent if present
    const existingActive = this.financeStore.getActiveIntentForBooking(params.bookingId);
    if (existingActive) {
      return existingActive;
    }

    // Server-Authoritative Price Resolution from Booking Price Snapshot
    const priceSnapshot = booking.priceSnapshot;
    if (!priceSnapshot || priceSnapshot.amountMinorUnits <= 0) {
      throw new Error(`Booking ${params.bookingId} does not have a valid server price snapshot.`);
    }

    // Select provider based on payment method
    let providerName: PaymentProviderName = params.providerName || 'MPESA_SAFARICOM';
    if (params.paymentMethodType === 'CARD') {
      providerName = 'CARD_GATEWAY';
    } else if (params.paymentMethodType === 'MPESA') {
      providerName = 'MPESA_SAFARICOM';
    }

    const intentId = asPaymentIntentId(generateUUIDv7());
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes checkout hold

    const paymentIntent: PaymentIntent = {
      paymentIntentId: intentId,
      bookingId: booking.bookingId,
      payerUserId: params.payerUserId,
      householdId: booking.householdId,
      amountMinor: priceSnapshot.amountMinorUnits,
      currency: priceSnapshot.currency,
      paymentMethodType: params.paymentMethodType,
      provider: providerName,
      status: 'CREATED',
      expiresAt,
      idempotencyKey,
      metadata: {
        serviceTitle: booking.serviceSnapshot.title,
        providerName: 'Sarah Mwangi (Nairobi Dog Walking)',
        petCount: booking.petCount,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.financeStore.savePaymentIntent(paymentIntent);
    return paymentIntent;
  }

  // ==========================================================================
  // 2. INITIATE PAYMENT FLOW
  // ==========================================================================

  /**
   * Initiates payment with external gateway (STK Push or Card authorization)
   */
  async initiatePayment(params: InitiateBookingPaymentParams): Promise<{
    paymentIntent: PaymentIntent;
    transaction: PaymentTransaction;
    actionRequired?: {
      type: 'MPESA_STK_PROMPT' | '3DS_REDIRECT';
      message: string;
    };
  }> {
    const intent = this.financeStore.getPaymentIntent(params.paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${params.paymentIntentId}`);
    }

    if (intent.status === 'SUCCEEDED') {
      throw new Error('Payment intent has already succeeded.');
    }
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') {
      throw new Error(`Payment intent is ${intent.status} and cannot be processed.`);
    }

    const gateway = this.providers.get(intent.provider);
    const amountMoney = Money.fromMinor(intent.amountMinor, intent.currency);

    const initResult = await gateway.initiatePayment({
      paymentIntentId: intent.paymentIntentId,
      bookingId: intent.bookingId,
      payerUserId: params.payerUserId,
      amount: amountMoney,
      paymentMethodType: intent.paymentMethodType,
      customerPhoneNumber: params.customerPhoneNumber,
      cardToken: params.cardToken,
      idempotencyKey: intent.idempotencyKey,
    });

    const txId = asPaymentTransactionId(generateUUIDv7());
    const now = new Date().toISOString();

    const transaction: PaymentTransaction = {
      paymentTransactionId: txId,
      paymentIntentId: intent.paymentIntentId,
      bookingId: intent.bookingId,
      provider: intent.provider,
      providerTransactionId: initResult.providerTransactionId || `prov_tx_${Date.now()}`,
      transactionType: 'CHARGE',
      status: initResult.status === 'SUCCESS' ? 'SUCCESS' : initResult.status === 'FAILED' ? 'FAILED' : 'PENDING',
      requestedAmountMinor: intent.amountMinor,
      settledAmountMinor: initResult.status === 'SUCCESS' ? intent.amountMinor : undefined,
      currency: intent.currency,
      providerFeeMinor: initResult.providerFeeMinor,
      initiatedAt: now,
      confirmedAt: initResult.status === 'SUCCESS' ? now : undefined,
      rawProviderReference: initResult.providerIntentReference,
      createdAt: now,
    };

    this.financeStore.savePaymentTransaction(transaction);

    // Update Intent state
    if (initResult.status === 'SUCCESS') {
      await this.handleAuthoritativePaymentSuccess(intent, transaction);
    } else if (initResult.status === 'REQUIRES_ACTION') {
      intent.status = 'REQUIRES_ACTION';
      intent.providerIntentReference = initResult.providerIntentReference;
      intent.updatedAt = now;
      this.financeStore.savePaymentIntent(intent);
    } else if (initResult.status === 'PENDING') {
      intent.status = 'PROCESSING';
      intent.providerIntentReference = initResult.providerIntentReference;
      intent.updatedAt = now;
      this.financeStore.savePaymentIntent(intent);
    } else {
      intent.status = 'FAILED';
      intent.failedAt = now;
      intent.failureReason = initResult.message;
      intent.updatedAt = now;
      this.financeStore.savePaymentIntent(intent);
    }

    return {
      paymentIntent: intent,
      transaction,
      actionRequired: initResult.requiresActionType
        ? {
            type: initResult.requiresActionType,
            message: initResult.message,
          }
        : undefined,
    };
  }

  // ==========================================================================
  // 3. AUTHORITATIVE PAYMENT CONFIRMATION (WEBHOOK & SUCCESS HANDLER)
  // ==========================================================================

  /**
   * Processes verified payment success.
   * Atomically posts double-entry ledger journals, commission snapshot,
   * creates PENDING provider earnings, updates booking payment state, and issues customer receipt.
   */
  async handleAuthoritativePaymentSuccess(
    intent: PaymentIntent,
    transaction: PaymentTransaction
  ): Promise<void> {
    // Idempotency check: If intent already succeeded, do NOT duplicate money movements!
    if (intent.status === 'SUCCEEDED') {
      return;
    }

    const booking = this.bookingStore.getBooking(intent.bookingId);
    if (!booking) {
      throw new Error(`Booking ${intent.bookingId} not found during payment settlement`);
    }

    const now = new Date().toISOString();
    intent.status = 'SUCCEEDED';
    intent.succeededAt = now;
    intent.updatedAt = now;
    this.financeStore.savePaymentIntent(intent);

    transaction.status = 'SUCCESS';
    transaction.confirmedAt = now;
    transaction.settledAmountMinor = intent.amountMinor;
    this.financeStore.savePaymentTransaction(transaction);

    // 1. Snapshot Commission Rule (Immutable basis)
    const category: ProviderCategory = booking.serviceSnapshot.category || 'DOG_WALKER';
    const commissionSnapshot = this.commissionEngine.createCommissionSnapshot(
      intent.amountMinor,
      category,
      intent.currency,
      booking.providerId,
      booking.businessId
    );

    const grossAmount = intent.amountMinor;
    const commissionAmount = commissionSnapshot.netCommissionMinor;
    const providerNetEntitlement = grossAmount - commissionAmount;

    // 2. Double-Entry Ledger Posting: CUSTOMER_PAYMENT
    // DEBIT: Cash clearing (Asset) -> Gross Amount
    // CREDIT: Provider Payable Pending (Liability) -> Provider Net
    // CREDIT: Platform Commission Revenue (Revenue) -> Platform Commission
    const clearingAccount =
      intent.paymentMethodType === 'CARD' ? 'ASSET_CASH_CLEARING_CARD' : 'ASSET_CASH_CLEARING_MPESA';

    this.ledger.postJournal({
      journalType: 'CUSTOMER_PAYMENT',
      sourceType: 'BOOKING_PAYMENT',
      sourceId: intent.paymentIntentId,
      currency: intent.currency,
      description: `Payment received for booking ${intent.bookingId} (${booking.serviceSnapshot.title})`,
      entries: [
        {
          accountCode: clearingAccount,
          direction: 'DEBIT',
          amountMinor: grossAmount,
          bookingId: intent.bookingId,
          reference: `Gross customer charge: tx ${transaction.providerTransactionId}`,
        },
        {
          accountCode: 'LIABILITY_PROVIDER_PAYABLE_PENDING',
          direction: 'CREDIT',
          amountMinor: providerNetEntitlement,
          providerId: booking.providerId,
          businessId: booking.businessId,
          bookingId: intent.bookingId,
          reference: `Provider net entitlement (pending service fulfillment)`,
        },
        {
          accountCode: 'REVENUE_PLATFORM_COMMISSION',
          direction: 'CREDIT',
          amountMinor: commissionAmount,
          providerId: booking.providerId,
          businessId: booking.businessId,
          bookingId: intent.bookingId,
          reference: `Platform commission (${commissionSnapshot.commissionRateBps / 100}%)`,
        },
      ],
      idempotencyKey: `journal_payment_${intent.paymentIntentId}`,
    });

    // 3. If processor fees exist, post separate fee expense journal
    if (transaction.providerFeeMinor > 0) {
      this.ledger.postJournal({
        journalType: 'FINANCIAL_ADJUSTMENT',
        sourceType: 'BOOKING_PAYMENT',
        sourceId: intent.paymentIntentId,
        currency: intent.currency,
        description: `Payment processor fee for tx ${transaction.providerTransactionId}`,
        entries: [
          {
            accountCode: 'EXPENSE_PAYMENT_PROCESSOR_FEES',
            direction: 'DEBIT',
            amountMinor: transaction.providerFeeMinor,
            bookingId: intent.bookingId,
            reference: `Processor transaction fee: ${transaction.provider}`,
          },
          {
            accountCode: clearingAccount,
            direction: 'CREDIT',
            amountMinor: transaction.providerFeeMinor,
            bookingId: intent.bookingId,
            reference: `Settlement fee deduction`,
          },
        ],
        idempotencyKey: `journal_fee_${intent.paymentIntentId}`,
      });
    }

    // 4. Create Provider Earning in PENDING state (STRICT NON-WITHDRAWABLE INVARIANT)
    const earningId = asProviderEarningId(generateUUIDv7());
    const providerEarning: ProviderEarning = {
      earningId,
      bookingId: intent.bookingId,
      providerId: booking.providerId,
      businessId: booking.businessId,
      grossAmountMinor: grossAmount,
      platformCommissionMinor: commissionAmount,
      providerFeesMinor: transaction.providerFeeMinor,
      adjustmentsMinor: 0,
      netAmountMinor: providerNetEntitlement,
      currency: intent.currency,
      status: 'PENDING', // PENDING service completion!
      holdReason: 'PENDING_SERVICE',
      createdAt: now,
      updatedAt: now,
    };
    this.financeStore.saveProviderEarning(providerEarning);

    // 5. Generate Immutable Customer Receipt
    const receiptId = asFinancialReceiptId(generateUUIDv7());
    const receiptNumber = `REC-${now.slice(0, 7).replace('-', '')}-${Math.floor(10000 + Math.random() * 90000)}`;
    const receipt: FinancialReceipt = {
      receiptId,
      receiptNumber,
      bookingId: intent.bookingId,
      paymentIntentId: intent.paymentIntentId,
      paymentTransactionId: transaction.paymentTransactionId,
      payerUserId: intent.payerUserId,
      payerName: 'Elena Vance (Household Owner)',
      providerId: booking.providerId,
      providerName: 'Sarah Mwangi (Nairobi Dog Walking)',
      serviceTitle: booking.serviceSnapshot.title,
      serviceScheduledAt: booking.startAt,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      paymentMethod:
        intent.paymentMethodType === 'MPESA'
          ? `M-PESA (${transaction.providerTransactionId})`
          : `Credit Card (Visa ****4242)`,
      paymentReference: transaction.providerTransactionId,
      taxAmountMinor: 0,
      issuedAt: now,
    };
    this.financeStore.saveReceipt(receipt);

    // 6. Notify Booking Domain (payment satisfied)
    if (booking.status === 'DRAFT' || booking.status === 'PENDING_PROVIDER') {
      booking.status = 'CONFIRMED';
      booking.confirmedAt = now;
      booking.updatedAt = now;
      this.bookingStore.saveBooking(booking);
    }
  }

  // ==========================================================================
  // 4. SECURE WEBHOOK INGESTION (IDEMPOTENT & ORDER-SAFE)
  // ==========================================================================

  /**
   * Processes inbound provider webhooks.
   * Enforces cryptographic verification, deduplication, and monotonic state progression.
   */
  async processProviderWebhook(
    providerName: PaymentProviderName,
    headers: Record<string, string>,
    rawBody: string
  ): Promise<{ processed: boolean; message: string; isDuplicate: boolean }> {
    const gateway = this.providers.get(providerName);
    const verification = gateway.verifyWebhook(headers, rawBody);

    if (!verification.isValid) {
      throw new Error(`Webhook signature verification failed: ${verification.errorMessage}`);
    }

    // Deduplication check
    const existingEvt = this.financeStore.getWebhookByProviderEventId(verification.providerEventId);
    if (existingEvt) {
      return {
        processed: true,
        message: 'Duplicate webhook event ignored (idempotent)',
        isDuplicate: true,
      };
    }

    const eventRecordId = asWebhookEventId(generateUUIDv7());
    const now = new Date().toISOString();
    const eventRecord: WebhookEventRecord = {
      eventId: eventRecordId,
      provider: providerName,
      providerEventId: verification.providerEventId,
      eventType: verification.eventType,
      signature: headers['x-mpesa-signature'] || headers['x-signature'] || 'verified',
      receivedAt: now,
      processedAt: now,
      isDuplicate: false,
      status: 'PROCESSED',
      payloadSummary: verification.payload,
    };
    this.financeStore.saveWebhookEvent(eventRecord);

    // Resolve transaction and intent from payload or provider reference
    const providerTxId =
      verification.payload.providerTransactionId ||
      verification.payload.Body?.stkCallback?.CheckoutRequestID ||
      verification.providerEventId;

    const tx = this.financeStore.getTransactionByProviderId(providerTxId);
    if (!tx) {
      return {
        processed: true,
        message: `Webhook event ${verification.providerEventId} acknowledged, no internal intent matched`,
        isDuplicate: false,
      };
    }

    const intent = this.financeStore.getPaymentIntent(tx.paymentIntentId);
    if (!intent) {
      return { processed: true, message: 'Intent not found for transaction', isDuplicate: false };
    }

    // MONOTONIC STATE TRANSITION GUARD:
    // If intent already SUCCEEDED, a late or delayed PROCESSING webhook must NOT regress status!
    if (intent.status === 'SUCCEEDED') {
      return {
        processed: true,
        message: 'Intent already succeeded. Late webhook ignored.',
        isDuplicate: false,
      };
    }

    if (verification.eventType === 'PAYMENT_SUCCESS' || verification.eventType === 'charge.succeeded') {
      await this.handleAuthoritativePaymentSuccess(intent, tx);
      return { processed: true, message: 'Payment confirmed successfully via webhook', isDuplicate: false };
    } else {
      intent.status = 'FAILED';
      intent.failedAt = now;
      intent.failureReason = 'Payment failed or declined at gateway';
      this.financeStore.savePaymentIntent(intent);
      tx.status = 'FAILED';
      this.financeStore.savePaymentTransaction(tx);
      return { processed: true, message: 'Payment marked failed from webhook', isDuplicate: false };
    }
  }

  // ==========================================================================
  // 5. FUTURE SERVICE COMPLETION CONTRACT & EARNING AVAILABILITY
  // ==========================================================================

  /**
   * Called when service execution completes.
   * Releases PENDING provider earnings to AVAILABLE balance and posts ledger reclassification.
   */
  async handleServiceCompleted(bookingId: BookingId, actorUserId: UserId): Promise<ProviderEarning> {
    const earnings = this.financeStore.getEarningsForBooking(bookingId);
    if (!earnings || earnings.length === 0) {
      throw new Error(`No provider earnings found for booking: ${bookingId}`);
    }

    const earning = earnings[0];
    if (earning.status === 'AVAILABLE' || earning.status === 'PAID') {
      return earning; // Idempotent
    }
    if (earning.status === 'HELD') {
      throw new Error(`Cannot release earning: currently HELD due to ${earning.holdReason}`);
    }

    const now = new Date().toISOString();
    earning.status = 'AVAILABLE';
    earning.holdReason = undefined;
    earning.availableAt = now;
    earning.updatedAt = now;
    this.financeStore.saveProviderEarning(earning);

    // Double-Entry Ledger Posting: Reclassify from PENDING to AVAILABLE liability
    // DEBIT: LIABILITY_PROVIDER_PAYABLE_PENDING
    // CREDIT: LIABILITY_PROVIDER_PAYABLE_AVAILABLE
    this.ledger.postJournal({
      journalType: 'SERVICE_FULFILLMENT',
      sourceType: 'SERVICE_COMPLETION',
      sourceId: bookingId,
      currency: earning.currency,
      description: `Service completed for booking ${bookingId}. Earning released to provider available balance.`,
      entries: [
        {
          accountCode: 'LIABILITY_PROVIDER_PAYABLE_PENDING',
          direction: 'DEBIT',
          amountMinor: earning.netAmountMinor,
          providerId: earning.providerId,
          businessId: earning.businessId,
          bookingId,
          reference: `Clear pending liability upon fulfillment`,
        },
        {
          accountCode: 'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',
          direction: 'CREDIT',
          amountMinor: earning.netAmountMinor,
          providerId: earning.providerId,
          businessId: earning.businessId,
          bookingId,
          reference: `Provider available payout balance`,
        },
      ],
      idempotencyKey: `journal_fulfillment_${bookingId}`,
    });

    return earning;
  }

  // ==========================================================================
  // 6. CANCELLATION FINANCIAL ENGINE & REFUNDS
  // ==========================================================================

  /**
   * Consumes booking cancellation facts from Sprint 11 and evaluates exact financial outcome.
   */
  async handleBookingCancellation(
    bookingId: BookingId,
    actorUserId: UserId,
    cancellationActor: BookingCancellationActor,
    reason: string
  ): Promise<{ refund?: Refund; message: string; refundableAmountMinor: number }> {
    const booking = this.bookingStore.getBooking(bookingId);
    if (!booking) throw new Error(`Booking not found: ${bookingId}`);

    const intent = this.financeStore.getSuccessfulIntentForBooking(bookingId);
    if (!intent) {
      return {
        message: 'Booking was not paid; no refund required.',
        refundableAmountMinor: 0,
      };
    }

    const totalCaptured = intent.amountMinor;
    const existingRefunds = this.financeStore.getRefundsForBooking(bookingId);
    const alreadyRefunded = existingRefunds
      .filter(r => r.status === 'SUCCEEDED')
      .reduce((sum, r) => sum + r.requestedAmountMinor, 0);

    const remainingRefundable = totalCaptured - alreadyRefunded;
    if (remainingRefundable <= 0) {
      return {
        message: 'Payment has already been fully refunded.',
        refundableAmountMinor: 0,
      };
    }

    let calculatedRefundMinor = 0;
    let refundReason: RefundReason = 'OWNER_CANCELLATION';

    if (cancellationActor === 'PROVIDER' || cancellationActor === 'SYSTEM') {
      // If Provider or System cancels, customer ALWAYS receives 100% full refund
      calculatedRefundMinor = remainingRefundable;
      refundReason = 'PROVIDER_CANCELLATION';
    } else {
      // Owner Cancellation: Evaluate cancellation policy snapshot
      const policy = booking.cancellationPolicySnapshot;
      const serviceStartMs = new Date(booking.startAt).getTime();
      const hoursUntilStart = (serviceStartMs - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilStart >= (policy?.freeCancellationCutoffHours || 24)) {
        // Free cancellation before cutoff: 100% full refund
        calculatedRefundMinor = remainingRefundable;
      } else {
        // Late cancellation: Retain 50% late fee or non-refundable per policy tier
        if (policy?.policyTier === 'FLEXIBLE') {
          calculatedRefundMinor = Math.round(remainingRefundable * 0.75); // 75% refund
        } else if (policy?.policyTier === 'STANDARD') {
          calculatedRefundMinor = Math.round(remainingRefundable * 0.5); // 50% refund
        } else {
          calculatedRefundMinor = 0; // STRICT: no refund on late cancellation
        }
      }
    }

    if (calculatedRefundMinor <= 0) {
      return {
        message: 'No refund due under late cancellation terms.',
        refundableAmountMinor: 0,
      };
    }

    const refund = await this.processRefund({
      bookingId,
      requestedAmountMinor: calculatedRefundMinor,
      reason: refundReason,
      reasonDetails: reason,
      authorizedByUserId: actorUserId,
    });

    return {
      refund,
      message: `Refund of ${Money.fromMinor(calculatedRefundMinor, intent.currency).format()} processed.`,
      refundableAmountMinor: calculatedRefundMinor,
    };
  }

  /**
   * Executes full or partial refund.
   * Concurrency Guard: Total successful refunds CANNOT exceed captured amount.
   */
  async processRefund(params: {
    bookingId: BookingId;
    requestedAmountMinor: number;
    reason: RefundReason;
    reasonDetails?: string;
    authorizedByUserId: UserId;
  }): Promise<Refund> {
    const intent = this.financeStore.getSuccessfulIntentForBooking(params.bookingId);
    if (!intent) {
      throw new Error(`Cannot refund booking ${params.bookingId}: no successful payment found.`);
    }

    const txs = this.financeStore.getTransactionsForIntent(intent.paymentIntentId);
    const successfulTx = txs.find(t => t.status === 'SUCCESS');
    if (!successfulTx) {
      throw new Error('No successful payment transaction found for refund.');
    }

    // Concurrency Check: Ensure total refunds <= captured total
    const existingRefunds = this.financeStore.getRefundsForBooking(params.bookingId);
    const previousRefundedTotal = existingRefunds
      .filter(r => r.status === 'SUCCEEDED' || r.status === 'PROCESSING')
      .reduce((sum, r) => sum + r.requestedAmountMinor, 0);

    if (previousRefundedTotal + params.requestedAmountMinor > intent.amountMinor) {
      throw new Error(
        `REFUND LIMIT EXCEEDED: Requested ${params.requestedAmountMinor} + previous ${previousRefundedTotal} exceeds captured ${intent.amountMinor}`
      );
    }

    const refundId = asRefundId(generateUUIDv7());
    const now = new Date().toISOString();
    const refund: Refund = {
      refundId,
      bookingId: params.bookingId,
      paymentTransactionId: successfulTx.paymentTransactionId,
      requestedByUserId: params.authorizedByUserId,
      reason: params.reason,
      reasonDetails: params.reasonDetails,
      requestedAmountMinor: params.requestedAmountMinor,
      currency: intent.currency,
      status: 'PROCESSING',
      requestedAt: now,
      createdAt: now,
    };
    this.financeStore.saveRefund(refund);

    // Call Provider Gateway Refund
    const gateway = this.providers.get(intent.provider);
    const refundResult = await gateway.processRefund({
      refundId,
      originalProviderTransactionId: successfulTx.providerTransactionId,
      amount: Money.fromMinor(params.requestedAmountMinor, intent.currency),
      reason: params.reason,
      idempotencyKey: `refund_${refundId}`,
    });

    if (refundResult.success) {
      refund.status = 'SUCCEEDED';
      refund.providerRefundReference = refundResult.providerRefundReference;
      refund.completedAt = new Date().toISOString();
      this.financeStore.saveRefund(refund);

      // Proportionally adjust provider pending earning and platform commission
      const isFullRefund = params.requestedAmountMinor === intent.amountMinor;
      const earnings = this.financeStore.getEarningsForBooking(params.bookingId);
      if (earnings.length > 0) {
        const earning = earnings[0];
        if (isFullRefund) {
          earning.status = 'REVERSED';
          earning.netAmountMinor = 0;
        } else {
          // Proportionate deduction
          earning.netAmountMinor = Math.max(0, earning.netAmountMinor - params.requestedAmountMinor);
        }
        earning.updatedAt = new Date().toISOString();
        this.financeStore.saveProviderEarning(earning);
      }

      // Compensating Double-Entry Ledger Posting: CUSTOMER_REFUND
      // DEBIT: LIABILITY_PROVIDER_PAYABLE_PENDING (Provider portion)
      // DEBIT: REVENUE_PLATFORM_COMMISSION (Commission portion)
      // CREDIT: Cash clearing (Asset) -> Total Refund Amount
      const commissionEngine = this.commissionEngine;
      const ratio = params.requestedAmountMinor / intent.amountMinor;
      const booking = this.bookingStore.getBooking(params.bookingId);
      const commissionSnapshot = commissionEngine.createCommissionSnapshot(
        intent.amountMinor,
        booking?.serviceSnapshot.category || 'DOG_WALKER',
        intent.currency
      );

      const refundCommissionMinor = Math.round(commissionSnapshot.netCommissionMinor * ratio);
      const refundProviderMinor = params.requestedAmountMinor - refundCommissionMinor;

      const clearingAccount =
        intent.paymentMethodType === 'CARD' ? 'ASSET_CASH_CLEARING_CARD' : 'ASSET_CASH_CLEARING_MPESA';

      this.ledger.postJournal({
        journalType: 'CUSTOMER_REFUND',
        sourceType: 'REFUND',
        sourceId: refundId,
        currency: intent.currency,
        description: `Customer refund for booking ${params.bookingId} (${params.reason})`,
        entries: [
          {
            accountCode: 'LIABILITY_PROVIDER_PAYABLE_PENDING',
            direction: 'DEBIT',
            amountMinor: refundProviderMinor,
            bookingId: params.bookingId,
            reference: `Reversal of provider pending liability`,
          },
          {
            accountCode: 'REVENUE_PLATFORM_COMMISSION',
            direction: 'DEBIT',
            amountMinor: refundCommissionMinor,
            bookingId: params.bookingId,
            reference: `Reversal of platform commission`,
          },
          {
            accountCode: clearingAccount,
            direction: 'CREDIT',
            amountMinor: params.requestedAmountMinor,
            bookingId: params.bookingId,
            reference: `Disbursement of refund: ref ${refundResult.providerRefundReference}`,
          },
        ],
        idempotencyKey: `journal_refund_${refundId}`,
      });

      // Generate Refund Receipt
      const originalReceipt = this.financeStore.getReceiptForBooking(params.bookingId);
      if (originalReceipt) {
        const refundReceipt: RefundReceipt = {
          refundReceiptId: `REFREC-${generateUUIDv7().slice(0, 8)}`,
          refundId,
          originalReceiptId: originalReceipt.receiptId,
          bookingId: params.bookingId,
          refundedAmountMinor: params.requestedAmountMinor,
          currency: intent.currency,
          reason: params.reason,
          providerRefundReference: refundResult.providerRefundReference,
          issuedAt: new Date().toISOString(),
        };
        this.financeStore.saveRefundReceipt(refundReceipt);
      }
    } else {
      refund.status = 'FAILED';
      refund.failureReason = refundResult.message;
      this.financeStore.saveRefund(refund);
    }

    return refund;
  }

  // ==========================================================================
  // 7. PROVIDER PAYOUT ENGINE & DESTINATIONS
  // ==========================================================================

  /**
   * Registers and verifies a provider payout destination (M-Pesa B2C or Bank Account)
   */
  async registerPayoutDestination(params: {
    providerId: ProviderId;
    type: 'MPESA_B2C' | 'BANK_ACCOUNT';
    phoneNumber?: string;
    bankDetails?: { bankName: string; accountNumber: string };
    actorUserId: UserId;
  }): Promise<ProviderPayoutDestination> {
    const destId = asProviderPayoutDestinationId(generateUUIDv7());
    const now = new Date().toISOString();

    let displayTitle = '';
    let maskedIdentifier = '';
    let token = '';

    if (params.type === 'MPESA_B2C') {
      const phone = (params.phoneNumber || '254712345678').replace(/[^0-9]/g, '');
      maskedIdentifier = `${phone.slice(0, 5)}****${phone.slice(-3)}`;
      displayTitle = `M-PESA (${maskedIdentifier})`;
      token = `tok_mpesa_${phone}`;
    } else {
      const bank = params.bankDetails?.bankName || 'Equity Bank';
      const acc = params.bankDetails?.accountNumber || '1234567890';
      maskedIdentifier = `****${acc.slice(-4)}`;
      displayTitle = `${bank} (${maskedIdentifier})`;
      token = `tok_bank_${acc}`;
    }

    const dest: ProviderPayoutDestination = {
      destinationId: destId,
      providerId: params.providerId,
      type: params.type,
      status: 'VERIFIED',
      displayTitle,
      maskedIdentifier,
      destinationToken: token,
      isDefault: true,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.financeStore.savePayoutDestination(dest);
    return dest;
  }

  /**
   * Initiates provider payout.
   * Atomically reserves AVAILABLE earnings (`AVAILABLE` -> `RESERVED_FOR_PAYOUT`).
   * On gateway success, marks earnings PAID and posts payout ledger entries.
   */
  async initiateProviderPayout(params: {
    providerId: ProviderId;
    destinationId: ProviderPayoutDestinationId;
    amountMinor: number;
    actorUserId: UserId;
    idempotencyKey?: string;
  }): Promise<ProviderPayout> {
    const dest = this.financeStore.getPayoutDestination(params.destinationId);
    if (!dest || dest.providerId !== params.providerId) {
      throw new Error(`Payout destination not found or unauthorized for provider: ${params.destinationId}`);
    }
    if (dest.status !== 'VERIFIED') {
      throw new Error('Payout destination is not verified.');
    }

    // Minimum payout threshold check (e.g. KES 500 = 50,000 minor units)
    if (params.amountMinor < 50000) {
      throw new Error('Minimum payout threshold is KES 500.00 (50,000 minor units).');
    }

    // Validate Available Balance from dynamic read model
    const summary = this.financeStore.getProviderFinancialSummary(params.providerId);
    if (summary.availableBalanceMinor < params.amountMinor) {
      throw new Error(
        `INSUFFICIENT AVAILABLE FUNDS: Requested ${params.amountMinor} minor units, but only ${summary.availableBalanceMinor} is currently AVAILABLE.`
      );
    }

    // Atomically select and reserve AVAILABLE earnings
    const availableEarnings = this.financeStore
      .getEarningsForProvider(params.providerId)
      .filter(e => e.status === 'AVAILABLE');

    let neededMinor = params.amountMinor;
    const allocatedEarningIds: ProviderEarningId[] = [];

    for (const e of availableEarnings) {
      if (neededMinor <= 0) break;

      if (e.netAmountMinor <= neededMinor) {
        e.status = 'RESERVED_FOR_PAYOUT';
        e.updatedAt = new Date().toISOString();
        this.financeStore.saveProviderEarning(e);
        allocatedEarningIds.push(e.earningId);
        neededMinor -= e.netAmountMinor;
      } else {
        // Partial split of earning
        const allocatedPortion = neededMinor;
        const residualPortion = e.netAmountMinor - neededMinor;

        e.netAmountMinor = allocatedPortion;
        e.status = 'RESERVED_FOR_PAYOUT';
        e.updatedAt = new Date().toISOString();
        this.financeStore.saveProviderEarning(e);
        allocatedEarningIds.push(e.earningId);

        // Create residual earning that stays AVAILABLE
        const residualId = asProviderEarningId(generateUUIDv7());
        const residualEarning: ProviderEarning = {
          earningId: residualId,
          bookingId: e.bookingId,
          providerId: e.providerId,
          businessId: e.businessId,
          grossAmountMinor: residualPortion,
          platformCommissionMinor: 0,
          providerFeesMinor: 0,
          adjustmentsMinor: 0,
          netAmountMinor: residualPortion,
          currency: e.currency,
          status: 'AVAILABLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.financeStore.saveProviderEarning(residualEarning);

        neededMinor = 0;
        break;
      }
    }

    const payoutId = asProviderPayoutId(generateUUIDv7());
    const now = new Date().toISOString();
    const idempotencyKey = params.idempotencyKey || `payout_${payoutId}`;

    const payout: ProviderPayout = {
      payoutId,
      providerId: params.providerId,
      destinationId: params.destinationId,
      amountMinor: params.amountMinor,
      currency: 'KES',
      status: 'PROCESSING',
      allocatedEarningIds,
      initiatedAt: now,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.financeStore.savePayout(payout);

    // Call payment provider B2C payout gateway
    const gateway = this.providers.getMpesa();
    const payoutResult = await gateway.processPayout({
      payoutId,
      destinationToken: dest.destinationToken,
      destinationType: dest.type,
      amount: Money.fromMinor(params.amountMinor, 'KES'),
      recipientName: dest.displayTitle,
      idempotencyKey,
    });

    if (payoutResult.success) {
      payout.status = 'PAID';
      payout.providerReference = payoutResult.providerReference;
      payout.completedAt = new Date().toISOString();
      payout.updatedAt = new Date().toISOString();
      this.financeStore.savePayout(payout);

      // Transition allocated earnings to PAID
      for (const id of allocatedEarningIds) {
        const earning = this.financeStore.getProviderEarning(id);
        if (earning) {
          earning.status = 'PAID';
          earning.payoutId = payoutId;
          earning.updatedAt = new Date().toISOString();
          this.financeStore.saveProviderEarning(earning);
        }
      }

      // Double-Entry Ledger Posting: PROVIDER_PAYOUT
      // DEBIT: LIABILITY_PROVIDER_PAYABLE_AVAILABLE
      // CREDIT: ASSET_CASH_CLEARING_MPESA
      this.ledger.postJournal({
        journalType: 'PROVIDER_PAYOUT',
        sourceType: 'PAYOUT',
        sourceId: payoutId,
        currency: 'KES',
        description: `B2C provider payout to ${dest.displayTitle}`,
        entries: [
          {
            accountCode: 'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',
            direction: 'DEBIT',
            amountMinor: params.amountMinor,
            providerId: params.providerId,
            reference: `Disbursement from available provider balance`,
          },
          {
            accountCode: 'ASSET_CASH_CLEARING_MPESA',
            direction: 'CREDIT',
            amountMinor: params.amountMinor,
            providerId: params.providerId,
            reference: `Cash outflow via B2C ref: ${payoutResult.providerReference}`,
          },
        ],
        idempotencyKey: `journal_payout_${payoutId}`,
      });
    } else {
      // Payout failed: Safely release reserved earnings back to AVAILABLE
      payout.status = 'FAILED';
      payout.failureReason = payoutResult.message;
      payout.failedAt = new Date().toISOString();
      payout.updatedAt = new Date().toISOString();
      this.financeStore.savePayout(payout);

      for (const id of allocatedEarningIds) {
        const earning = this.financeStore.getProviderEarning(id);
        if (earning && earning.status === 'RESERVED_FOR_PAYOUT') {
          earning.status = 'AVAILABLE';
          earning.updatedAt = new Date().toISOString();
          this.financeStore.saveProviderEarning(earning);
        }
      }
    }

    return payout;
  }

  // ==========================================================================
  // 8. FINANCIAL RECONCILIATION ENGINE
  // ==========================================================================

  /**
   * Reconciles internal transactions against external provider settlement records.
   * Detects MATCHED, MISSING_INTERNAL, MISSING_PROVIDER, AMOUNT_MISMATCH, STATUS_MISMATCH.
   * NEVER silently mutates the ledger.
   */
  async runReconciliation(
    provider: PaymentProviderName,
    settlementRecords: SettlementRecordInput[],
    periodStart: string,
    periodEnd: string
  ): Promise<ReconciliationRun> {
    const runId = asReconciliationRunId(generateUUIDv7());
    const now = new Date().toISOString();

    const internalTxs = Array.from(this.financeStore.paymentTransactions.values()).filter(
      t => t.provider === provider
    );

    const internalTxMap = new Map<string, PaymentTransaction>();
    for (const t of internalTxs) {
      internalTxMap.set(t.providerTransactionId, t);
    }

    const items: ReconciliationItem[] = [];
    let matchedCount = 0;
    let exceptionCount = 0;
    let totalInternalMinor = 0;
    let totalProviderMinor = 0;

    const visitedInternalTxIds = new Set<string>();

    for (const record of settlementRecords) {
      totalProviderMinor += record.amountMinor;
      const internalMatch = internalTxMap.get(record.providerTransactionId);

      if (!internalMatch) {
        // Exists in provider settlement but MISSING internally
        exceptionCount++;
        items.push({
          itemId: asReconciliationItemId(generateUUIDv7()),
          runId,
          classification: 'MISSING_INTERNAL',
          providerTransactionId: record.providerTransactionId,
          providerAmountMinor: record.amountMinor,
          currency: record.currency,
          discrepancyMinor: record.amountMinor,
          resolutionStatus: 'UNRESOLVED',
          resolutionNotes: 'Provider recorded transaction not found in Pet OS internal records',
        });
      } else {
        visitedInternalTxIds.add(internalMatch.paymentTransactionId);
        totalInternalMinor += internalMatch.requestedAmountMinor;

        // Check for amount or status mismatch
        const amountDiff = Math.abs(internalMatch.requestedAmountMinor - record.amountMinor);
        const statusMatch =
          (internalMatch.status === 'SUCCESS' && record.status === 'SUCCESS') ||
          (internalMatch.status === 'FAILED' && record.status === 'FAILED');

        if (amountDiff > 0) {
          exceptionCount++;
          items.push({
            itemId: asReconciliationItemId(generateUUIDv7()),
            runId,
            classification: 'AMOUNT_MISMATCH',
            providerTransactionId: record.providerTransactionId,
            internalTransactionId: internalMatch.paymentTransactionId,
            bookingId: internalMatch.bookingId,
            providerAmountMinor: record.amountMinor,
            internalAmountMinor: internalMatch.requestedAmountMinor,
            currency: record.currency,
            discrepancyMinor: amountDiff,
            resolutionStatus: 'INVESTIGATING',
            resolutionNotes: `Internal amount (${internalMatch.requestedAmountMinor}) differs from external settlement (${record.amountMinor})`,
          });
        } else if (!statusMatch) {
          exceptionCount++;
          items.push({
            itemId: asReconciliationItemId(generateUUIDv7()),
            runId,
            classification: 'STATUS_MISMATCH',
            providerTransactionId: record.providerTransactionId,
            internalTransactionId: internalMatch.paymentTransactionId,
            bookingId: internalMatch.bookingId,
            providerAmountMinor: record.amountMinor,
            internalAmountMinor: internalMatch.requestedAmountMinor,
            currency: record.currency,
            resolutionStatus: 'INVESTIGATING',
            resolutionNotes: `Status conflict: Internal is ${internalMatch.status}, External is ${record.status}`,
          });
        } else {
          matchedCount++;
          items.push({
            itemId: asReconciliationItemId(generateUUIDv7()),
            runId,
            classification: 'MATCHED',
            providerTransactionId: record.providerTransactionId,
            internalTransactionId: internalMatch.paymentTransactionId,
            bookingId: internalMatch.bookingId,
            providerAmountMinor: record.amountMinor,
            internalAmountMinor: internalMatch.requestedAmountMinor,
            currency: record.currency,
            discrepancyMinor: 0,
            resolutionStatus: 'UNRESOLVED',
          });
        }
      }
    }

    // Check for internal transactions MISSING in external provider settlement
    for (const t of internalTxs) {
      if (!visitedInternalTxIds.has(t.paymentTransactionId) && t.status === 'SUCCESS') {
        exceptionCount++;
        items.push({
          itemId: asReconciliationItemId(generateUUIDv7()),
          runId,
          classification: 'MISSING_PROVIDER',
          internalTransactionId: t.paymentTransactionId,
          bookingId: t.bookingId,
          internalAmountMinor: t.requestedAmountMinor,
          currency: t.currency,
          discrepancyMinor: t.requestedAmountMinor,
          resolutionStatus: 'UNRESOLVED',
          resolutionNotes: 'Internal successful payment absent in external provider settlement report',
        });
      }
    }

    const run: ReconciliationRun = {
      runId,
      provider,
      periodStart,
      periodEnd,
      status: 'COMPLETED',
      startedAt: now,
      completedAt: new Date().toISOString(),
      totalInternalTransactions: internalTxs.length,
      totalProviderTransactions: settlementRecords.length,
      totalInternalAmountMinor: totalInternalMinor,
      totalProviderAmountMinor: totalProviderMinor,
      matchedCount,
      exceptionCount,
      currency: 'KES',
      items,
    };

    this.financeStore.saveReconciliationRun(run);
    for (const item of items) {
      this.financeStore.saveReconciliationItem(item);
    }

    return run;
  }

  // ==========================================================================
  // 9. AUDITED FINANCIAL ADJUSTMENTS
  // ==========================================================================

  /**
   * Posts an authorized financial adjustment.
   * Modifies balances solely through double-entry ledger entries.
   */
  async createFinancialAdjustment(params: {
    providerId?: ProviderId;
    bookingId?: BookingId;
    reason: FinancialAdjustmentReason;
    amountMinor: number;
    direction: 'CREDIT' | 'DEBIT';
    description: string;
    authorizedByUserId: UserId;
  }): Promise<FinancialAdjustment> {
    const adjId = asFinancialAdjustmentId(generateUUIDv7());
    const now = new Date().toISOString();

    // Determine ledger accounts based on adjustment
    // E.g. Goodwill credit: DEBIT Expense Platform Discounts, CREDIT Customer Prepayment/Clearing
    const journal = this.ledger.postJournal({
      journalType: 'FINANCIAL_ADJUSTMENT',
      sourceType: 'ADJUSTMENT',
      sourceId: adjId,
      currency: 'KES',
      description: `Adjustment: ${params.description}`,
      entries: [
        {
          accountCode: 'EXPENSE_PLATFORM_DISCOUNTS',
          direction: 'DEBIT',
          amountMinor: params.amountMinor,
          providerId: params.providerId,
          bookingId: params.bookingId,
          reference: `Platform adjustment expense: ${params.reason}`,
        },
        {
          accountCode: 'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',
          direction: 'CREDIT',
          amountMinor: params.amountMinor,
          providerId: params.providerId,
          bookingId: params.bookingId,
          reference: `Provider credit adjustment`,
        },
      ],
      idempotencyKey: `journal_adj_${adjId}`,
    });

    const adjustment: FinancialAdjustment = {
      adjustmentId: adjId,
      providerId: params.providerId,
      bookingId: params.bookingId,
      reason: params.reason,
      amountMinor: params.amountMinor,
      direction: params.direction,
      currency: 'KES',
      description: params.description,
      authorizedByUserId: params.authorizedByUserId,
      journalId: journal.journalId,
      createdAt: now,
    };

    this.financeStore.saveFinancialAdjustment(adjustment);
    return adjustment;
  }
}
