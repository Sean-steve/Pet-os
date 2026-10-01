/**
 * Pet OS Sprint 12 - Financial Platform, Double-Entry Ledger, Provider Earnings & Payouts Console
 * Real-time ledger explorer, checkout simulator, provider payout engine, refund policies, and live test suite.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Receipt,
  Scale,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Clock,
  Smartphone,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Building,
  Lock,
  Zap,
  Info,
  Sliders,
  Send,
  Download,
  AlertCircle,
} from 'lucide-react';

import {
  FinanceStore,
  DoubleEntryLedgerEngine,
  CommissionEngine,
  PaymentProviderRegistry,
  FinancialPlatformService,
  LedgerJournal,
  PaymentIntent,
  ProviderEarning,
  ProviderPayout,
  Refund,
} from '../pet-os/finance';
import { FinancialPlatformTestSuite } from '../pet-os/finance/tests';
import { Money } from '../pet-os/kernel/money';
import {
  asUserId,
  asHouseholdId,
  asProviderId,
  asBusinessId,
  asServiceOfferingId,
  asPetId,
  asBookingId,
  asMembershipId,
} from '../pet-os/kernel/ids';
import { BookingStore } from '../pet-os/booking/store';
import { BookingAggregate, BookingStatus } from '../pet-os/booking/types';
import { IdentityStore } from '../pet-os/identity/store';

export const Sprint12FinanceConsole: React.FC = () => {
  // State managers
  const [activeSubTab, setActiveSubTab] = useState<
    'ledger' | 'checkout' | 'earnings' | 'refunds' | 'reconciliation' | 'test-suite'
  >('ledger');

  // Core singletons for console demo
  const [store] = useState(() => new FinanceStore());
  const [ledger] = useState(() => new DoubleEntryLedgerEngine());
  const [commissionEngine] = useState(() => new CommissionEngine());
  const [providers] = useState(() => new PaymentProviderRegistry());
  const [bookingStore] = useState(() => BookingStore.getInstance());
  const [identityStore] = useState(() => new IdentityStore());
  const [service] = useState(
    () =>
      new FinancialPlatformService(
        store,
        ledger,
        commissionEngine,
        providers,
        bookingStore,
        identityStore
      )
  );

  // Live data triggers
  const [refreshCount, setRefreshCount] = useState(0);
  const triggerRefresh = () => setRefreshCount(c => c + 1);

  // Interactive Form States
  const [mpesaPhone, setMpesaPhone] = useState('254712345678');
  const [checkoutBookingId, setCheckoutBookingId] = useState('book-canonical-walk-001');
  const [checkoutStatusMsg, setCheckoutStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [payoutAmountKes, setPayoutAmountKes] = useState('2000');
  const [payoutStatusMsg, setPayoutStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [refundReason, setRefundReason] = useState<'PROVIDER_CANCELLATION' | 'OWNER_CANCELLATION'>('OWNER_CANCELLATION');
  const [refundStatusMsg, setRefundStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Test Runner State
  const [testResults, setTestResults] = useState<Array<{ id: number; name: string; passed: boolean; error?: string }>>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Initialize seed demo data if store is empty
  useEffect(() => {
    const existingJournals = ledger.getAllJournals();
    if (existingJournals.length === 0) {
      // Seed Canonical Identities
      const elenaId = asUserId('usr-elena-vance-0000-0000-000000000001');
      const householdId = asHouseholdId('hh-vance-nairobi-0000-00000001');
      const sarahId = asUserId('usr-sarah-mwangi-0000-0000-00000000002');
      const providerId = asProviderId('prov-sarah-walking-0000-000000000001');
      const businessId = asBusinessId('biz-nairobi-pets-0000-000000000001');
      const offeringId = asServiceOfferingId('offering-dog-walk-0000-00000001');
      const petId = asPetId('pet-kibo-0000-0000-0000-000000000001');

      IdentityStore.saveMembership({
        membershipId: asMembershipId('mem-elena-vance-0001'),
        householdId,
        userId: elenaId,
        role: 'HOUSEHOLD_OWNER',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Seed Initial Booking
      const bookingId = asBookingId('book-canonical-walk-001');
      const booking: BookingAggregate = {
        bookingId,
        ownerUserId: elenaId,
        householdId,
        providerId,
        businessId,
        serviceOfferingId: offeringId,
        petIds: [petId],
        petCount: 1,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        status: 'CONFIRMED' as BookingStatus,
        locationType: 'CLIENT_LOCATION',
        priceSnapshot: {
          pricingModel: 'FIXED',
          currency: 'KES',
          amountMinorUnits: 300000, // 3,000.00 KES Total
          baseAmountMinorUnits: 250000,
          petCount: 1,
          taxIncluded: false,
          feeBasisReference: 'STANDARD_RATE',
        },
        cancellationPolicySnapshot: {
          policyTier: 'STANDARD',
          freeCancellationCutoffHours: 24,
          lateCancellationNotice: 'Late cancellation forfeits 50%',
          description: 'Standard 24h cancellation policy',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;
      bookingStore.saveBooking(booking);

      // Seed Initial Opening Ledger Journal
      ledger.postJournal({
        journalType: 'PAYMENT_CAPTURED',
        sourceType: 'PAYMENT_TRANSACTION',
        sourceId: 'seed_init_01',
        currency: 'KES',
        description: 'Initial Seed: M-PESA clearing for Kibo Trail Adventure',
        entries: [
          { accountCode: 'ASSET_CASH_CLEARING_MPESA', direction: 'DEBIT', amountMinor: 300000 },
          { accountCode: 'LIABILITY_PROVIDER_PAYABLE_PENDING', direction: 'CREDIT', amountMinor: 255000 },
          { accountCode: 'REVENUE_PLATFORM_COMMISSION', direction: 'CREDIT', amountMinor: 45000 },
        ],
        idempotencyKey: 'seed_init_01',
      });

      // Register verified destination for Sarah Mwangi
      service.registerPayoutDestination({
        providerId,
        type: 'MPESA_B2C',
        phoneNumber: '254722123456',
        actorUserId: sarahId,
      });

      triggerRefresh();
    }
  }, [store, ledger, bookingStore, service]);

  // Derived financial metrics
  const journals = useMemo(() => ledger.getAllJournals(), [ledger, refreshCount]);
  const trialBalance = useMemo(() => ledger.verifyTrialBalance('KES'), [ledger, refreshCount]);
  const accounts = useMemo(() => {
    return ledger.getAllAccounts().map(acc => ({
      accountCode: acc.code,
      name: acc.name,
      type: acc.type,
      balanceMinor: ledger.getAccountBalance(acc.code, { currency: 'KES' }).minorUnits,
    }));
  }, [ledger, refreshCount]);
  const intents = useMemo(() => Array.from(store.paymentIntents.values()), [store, refreshCount]);
  const providerSummary = useMemo(() => {
    const provId = asProviderId('prov-sarah-walking-0000-000000000001');
    return store.getProviderFinancialSummary(provId);
  }, [store, refreshCount]);

  // Calculate platform totals
  const totalVolumeMinor = useMemo(() => {
    return journals
      .filter(j => j.journalType === 'PAYMENT_CAPTURED')
      .reduce((sum, j) => sum + j.entries.filter(l => l.direction === 'DEBIT').reduce((s, l) => s + l.amountMinor, 0), 0);
  }, [journals]);

  const platformRevenueMinor = useMemo(() => {
    return journals.reduce((sum, j) => {
      const revLines = j.entries.filter(l => l.accountCode === 'REVENUE_PLATFORM_COMMISSION');
      const credits = revLines.filter(l => l.direction === 'CREDIT').reduce((s, l) => s + l.amountMinor, 0);
      const debits = revLines.filter(l => l.direction === 'DEBIT').reduce((s, l) => s + l.amountMinor, 0);
      return sum + (credits - debits);
    }, 0);
  }, [journals]);

  // Handler: Simulate M-PESA Checkout
  const handleSimulateMpesaPayment = async () => {
    setCheckoutStatusMsg({ type: 'info', text: 'Initiating Safaricom STK Push prompt...' });
    try {
      const elenaId = asUserId('usr-elena-vance-0000-0000-000000000001');
      const bookingId = asBookingId(checkoutBookingId);

      // 1. Create Payment Intent
      const intent = await service.createBookingPaymentIntent({
        bookingId,
        payerUserId: elenaId,
        paymentMethodType: 'MPESA',
      });

      // 2. Initiate Payment (STK Push)
      const res = await service.initiatePayment({
        paymentIntentId: intent.paymentIntentId,
        payerUserId: elenaId,
        mpesaPhoneNumber: mpesaPhone,
      });

      // 3. Simulate customer entering M-PESA PIN and receiving Safaricom Webhook
      const simulatedWebhookPayload = {
        TransactionType: 'CustomerPayBillOnline',
        TransID: `WS_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        TransAmount: (intent.amountMinor / 100).toFixed(2),
        BusinessShortCode: '600000',
        BillRefNumber: intent.paymentIntentId,
        MSISDN: mpesaPhone,
        TransTime: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
      };

      const webhookResult = await service.handlePaymentWebhook({
        provider: 'MPESA_SAFARICOM',
        rawPayload: JSON.stringify(simulatedWebhookPayload),
        signature: 'simulated_valid_sha256_sig',
        eventType: 'charge.completed',
        idempotencyKey: `evt_${simulatedWebhookPayload.TransID}`,
      });

      setCheckoutStatusMsg({
        type: 'success',
        text: `M-PESA Payment Succeeded! Receipt ${simulatedWebhookPayload.TransID}. Double-entry journal posted: Dr Cash Clearing KES ${intent.amountMinor / 100}, Cr Provider Escrow & Platform Commission.`,
      });
      triggerRefresh();
    } catch (err: any) {
      setCheckoutStatusMsg({ type: 'error', text: err.message || 'Payment simulation failed' });
    }
  };

  // Handler: Simulate Service Completion & Earnings Release
  const handleFulfillService = async () => {
    setPayoutStatusMsg({ type: 'info', text: 'Marking service fulfilled and unlocking escrow...' });
    try {
      const sarahId = asUserId('usr-sarah-mwangi-0000-0000-00000000002');
      const bookingId = asBookingId(checkoutBookingId);
      await service.handleServiceCompleted(bookingId, sarahId);
      setPayoutStatusMsg({
        type: 'success',
        text: 'Service marked COMPLETED! Escrow unlocked: Pending liability transitioned to AVAILABLE provider earnings and posted to ledger.',
      });
      triggerRefresh();
    } catch (err: any) {
      setPayoutStatusMsg({ type: 'error', text: err.message || 'Fulfillment error' });
    }
  };

  // Handler: Dispatch Provider Payout
  const handleDispatchPayout = async () => {
    setPayoutStatusMsg({ type: 'info', text: 'Submitting B2C payout request...' });
    try {
      const provId = asProviderId('prov-sarah-walking-0000-000000000001');
      const sarahId = asUserId('usr-sarah-mwangi-0000-0000-00000000002');
      const destinations = store.getPayoutDestinationsForProvider(provId);
      if (destinations.length === 0) {
        throw new Error('No verified payout destination found');
      }

      const requestedMinor = Math.round(parseFloat(payoutAmountKes) * 100);
      const payout = await service.initiateProviderPayout({
        providerId: provId,
        destinationId: destinations[0].destinationId,
        amountMinor: requestedMinor,
        actorUserId: sarahId,
      });

      setPayoutStatusMsg({
        type: 'success',
        text: `Payout ${payout.status}! Disbursed KES ${(payout.amountMinor / 100).toLocaleString()} to ${destinations[0].displayTitle}. Ledger journal posted: Dr Provider Liability, Cr Cash.`,
      });
      triggerRefresh();
    } catch (err: any) {
      setPayoutStatusMsg({ type: 'error', text: err.message || 'Payout failed' });
    }
  };

  // Handler: Run Cancellation & Refund
  const handleTriggerRefund = async () => {
    setRefundStatusMsg({ type: 'info', text: 'Evaluating cancellation policy & processing refund...' });
    try {
      const elenaId = asUserId('usr-elena-vance-0000-0000-000000000001');
      const bookingId = asBookingId(checkoutBookingId);
      const actor = refundReason === 'PROVIDER_CANCELLATION' ? 'PROVIDER' : 'OWNER';

      const res = await service.handleBookingCancelled(
        bookingId,
        actor,
        'Cancellation simulated via Pet OS Sprint 12 Financial Console',
        elenaId
      );

      setRefundStatusMsg({
        type: 'success',
        text: `${res.message} Compensating reversal journal posted to General Ledger.`,
      });
      triggerRefresh();
    } catch (err: any) {
      setRefundStatusMsg({ type: 'error', text: err.message || 'Refund processing failed' });
    }
  };

  // Handler: Run Sprint 12 Test Suite Live
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    try {
      const runner = new FinancialPlatformTestSuite();
      const results = await runner.runAll();
      setTestResults(results);
      triggerRefresh();
    } catch (err) {
      console.error('Test runner error:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Receipt className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Sprint 12: Financial Platform &amp; Double-Entry Ledger
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ADR-012 &amp; ADR-013
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
              Volume III (DDD), Volume XXXI (Double-Entry General Ledger, Invariant Balancing, Normal Balance Rules,
              Deterministic BPS Commissions, Escrow Reserves, Safaricom M-PESA STK Push &amp; Tokenized Card Gateways).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Running 26 Assertions...' : 'Run Sprint 12 Tests'}</span>
            </button>
            <button
              onClick={triggerRefresh}
              className="p-2 rounded-xl bg-[#1A1E26] hover:bg-[#242A36] text-[#94A3B8] hover:text-white border border-[#2B3545] transition-all cursor-pointer"
              title="Refresh ledger state"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Financial Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#1E293B]/80">
          <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
              <span className="font-medium">Total Volume</span>
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              KES {(totalVolumeMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
              <ArrowUpRight className="w-3 h-3" /> Processed Volume
            </span>
          </div>

          <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
              <span className="font-medium">Trial Balance</span>
              <Scale className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono flex items-center gap-1.5">
              {trialBalance.isBalanced ? (
                <span className="text-emerald-400 text-sm font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> BALANCED
                </span>
              ) : (
                <span className="text-rose-400 text-sm font-bold flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> UNBALANCED
                </span>
              )}
            </div>
            <span className="text-[10px] text-[#64748B] font-mono">
              Dr {(trialBalance.totalDebitsMinor / 100).toLocaleString()} = Cr {(trialBalance.totalCreditsMinor / 100).toLocaleString()}
            </span>
          </div>

          <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
              <span className="font-medium">Provider Available</span>
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              KES {(providerSummary.availableBalanceMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-[#64748B]">
              Escrow Pending: KES {(providerSummary.pendingBalanceMinor / 100).toLocaleString()}
            </span>
          </div>

          <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
              <span className="font-medium">Platform Commission</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              KES {(platformRevenueMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-indigo-400 font-semibold">
              15.00% Take-rate (1,500 bps)
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('ledger')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'ledger'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Double-Entry General Ledger</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-950 text-indigo-300 font-mono">
            {journals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('checkout')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'checkout'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Checkout &amp; M-PESA STK Push</span>
        </button>

        <button
          onClick={() => setActiveSubTab('earnings')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'earnings'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Provider Earnings &amp; Payouts</span>
        </button>

        <button
          onClick={() => setActiveSubTab('refunds')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'refunds'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Policy Refunds &amp; Reversals</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reconciliation')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'reconciliation'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Settlement &amp; Reconciliation</span>
        </button>

        <button
          onClick={() => setActiveSubTab('test-suite')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'test-suite'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13161C]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Test Suite (26 Specs)</span>
          {testResults.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-mono">
              {testResults.filter(t => t.passed).length}/26
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DOUBLE-ENTRY GENERAL LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-6">
          {/* Trial Balance Audit Card */}
          <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-400" />
                  Trial Balance &amp; Chart of Accounts (COA)
                </h3>
                <p className="text-xs text-[#64748B]">
                  Enforces Fundamental Accounting Invariant: &Sigma; Debits === &Sigma; Credits across all asset,
                  liability, revenue, and expense accounts.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border ${
                    trialBalance.isBalanced
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      trialBalance.isBalanced ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`}
                  />
                  <span>
                    {trialBalance.isBalanced
                      ? 'TRIAL BALANCE IN PERFECT EQUILIBRIUM'
                      : `DISCREPANCY: ${(trialBalance.differenceMinor / 100).toFixed(2)} KES`}
                  </span>
                </div>
              </div>
            </div>

            {/* Trial Balance Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {accounts.map(acc => (
                <div key={acc.accountCode} className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3">
                  <div className="text-[11px] font-mono text-[#94A3B8] truncate mb-1" title={acc.accountCode}>
                    {acc.accountCode}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-bold text-white font-mono">
                      KES {(acc.balanceMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-[#64748B]">
                      {acc.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Journals Table */}
          <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-400" />
                  General Ledger Journal Entries ({journals.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Immutable append-only entries. Corrections executed strictly via inverse compensating journals.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {journals.map((journal, idx) => (
                <div key={journal.journalId} className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-[#1E293B]/60">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {journal.journalType}
                      </span>
                      <span className="text-xs font-semibold text-white">{journal.description}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-mono">
                      <span>{new Date(journal.postedAt).toLocaleTimeString()}</span>
                      <span>ID: {journal.journalId.slice(0, 16)}...</span>
                    </div>
                  </div>

                  {/* Journal Lines (Debits and Credits) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {journal.entries.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono ${
                          line.direction === 'DEBIT'
                            ? 'bg-blue-950/20 border-blue-900/30 text-blue-300'
                            : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              line.direction === 'DEBIT'
                                ? 'bg-blue-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {line.direction}
                          </span>
                          <span className="truncate text-slate-300">{line.accountCode}</span>
                        </div>
                        <span className="font-bold shrink-0">
                          KES {(line.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHECKOUT & M-PESA STK PUSH */}
      {activeSubTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Safaricom M-PESA STK Push (Daraja 2.0 Adapter)
              </h3>
              <p className="text-xs text-[#64748B] mb-5">
                Simulate end-to-end customer checkout. Amount is strictly server-authoritative from the BookingPriceSnapshot
                (NEVER trusted from client payload).
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Select Canonical Booking
                  </label>
                  <select
                    value={checkoutBookingId}
                    onChange={e => setCheckoutBookingId(e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="book-canonical-walk-001">
                      book-canonical-walk-001 (Kibo 1-hr Trail Adventure · KES 3,000.00)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Kenyan MSISDN Phone Number (Safaricom)
                  </label>
                  <input
                    type="text"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    placeholder="254712345678"
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Normalized to international format 254XXXXXXXXX. Tariffs and validation enforced.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSimulateMpesaPayment}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Initiate STK Push Prompt &amp; Process Webhook</span>
                  </button>
                </div>

                {checkoutStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      checkoutStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : checkoutStatusMsg.type === 'error'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {checkoutStatusMsg.text}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Intents History */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Receipt className="w-4 h-4 text-indigo-400" />
                Tracked Payment Intents ({intents.length})
              </h3>
              <div className="space-y-2.5">
                {intents.map(intent => (
                  <div
                    key={intent.paymentIntentId}
                    className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          KES {(intent.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                            intent.status === 'SUCCEEDED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {intent.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                        Booking: {intent.bookingId} · Payer: {intent.payerUserId.slice(0, 16)}...
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-[#64748B]">
                      {new Date(intent.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Security & Architecture Specs Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Payment Security Baseline
              </h4>
              <ul className="space-y-2.5 text-xs text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>No client-side price manipulation: amount derived strictly from server price snapshot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Zero raw PAN or CVV storage: tokenized authorization via PaymentProviderGateway.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>HMAC-SHA256 signature verification on incoming webhook payloads.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Monotonic state protection: completed payments cannot regress on duplicate delivery.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROVIDER EARNINGS & PAYOUTS */}
      {activeSubTab === 'earnings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Fulfillment & Escrow Release */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Service Fulfillment &amp; Escrow Release
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Initial customer payment is held as PENDING escrow liability. When service completion is certified,
                    funds transition to AVAILABLE and become withdrawable.
                  </p>
                </div>
                <button
                  onClick={handleFulfillService}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Complete Service</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3">
                  <div className="text-xs text-[#64748B] mb-1">Escrow Pending (Non-Withdrawable)</div>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    KES {(providerSummary.pendingBalanceMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3">
                  <div className="text-xs text-[#64748B] mb-1">Available for B2C Payout</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    KES {(providerSummary.availableBalanceMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Payout Dispatch Form */}
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <Building className="w-4 h-4 text-indigo-400" />
                Initiate Provider Payout (M-PESA B2C Disbursement)
              </h3>
              <p className="text-xs text-[#64748B] mb-4">
                Disburse available earnings to Sarah Mwangi's verified M-PESA destination. Minimum payout threshold is
                KES 500.00 (50,000 minor units).
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Payout Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={payoutAmountKes}
                    onChange={e => setPayoutAmountKes(e.target.value)}
                    min="500"
                    step="100"
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleDispatchPayout}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Dispatch B2C Payout to Verified Destination</span>
                </button>

                {payoutStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      payoutStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : payoutStatusMsg.type === 'error'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {payoutStatusMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Provider Profile Summary */}
          <div className="space-y-4">
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                Provider Account Profile
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span className="text-[#64748B]">Provider Name:</span>
                  <span className="font-semibold text-white">Sarah Mwangi</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span className="text-[#64748B]">Business:</span>
                  <span className="font-semibold text-white">Nairobi Pet Care</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#1E293B]">
                  <span className="text-[#64748B]">Payout Channel:</span>
                  <span className="font-semibold text-emerald-400 font-mono">M-PESA (254722****456)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Status:</span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                    KYC VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REFUNDS & POLICY ENGINE */}
      {activeSubTab === 'refunds' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Cancellation &amp; Policy-Driven Refund Engine
              </h3>
              <p className="text-xs text-[#64748B] mb-5">
                Evaluates cancellation provenance and time-to-service cutoff against the immutable Booking Cancellation
                Policy snapshot.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                    Cancellation Actor &amp; Policy Rule
                  </label>
                  <select
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value as any)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PROVIDER_CANCELLATION">
                      Provider Cancellation (Always 100% Full Customer Refund)
                    </option>
                    <option value="OWNER_CANCELLATION">
                      Owner Cancellation (Evaluates 24-hr Free Window &amp; Tier Fees)
                    </option>
                  </select>
                </div>

                <button
                  onClick={handleTriggerRefund}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Execute Cancellation &amp; Compensating Ledger Reversal</span>
                </button>

                {refundStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs border ${
                      refundStatusMsg.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : refundStatusMsg.type === 'error'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                    }`}
                  >
                    {refundStatusMsg.text}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-3">
                Refund Concurrency Protection
              </h4>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                The financial engine strictly enforces an atomic invariant: the cumulative total of all refunds for a
                payment intent cannot exceed the original captured amount under any concurrency condition.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECONCILIATION & SETTLEMENT */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              Multi-Way Financial Reconciliation Engine
            </h3>
            <p className="text-xs text-[#64748B] mb-5">
              Automated matching between internal ledger records, payment provider transaction journals (Safaricom Daraja
              / Card Acquirer), and external bank statements.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>MATCHED</span>
                </div>
                <p className="text-xs text-[#94A3B8]">
                  Transactions where external provider settlement amount and reference perfectly match internal payment intent.
                </p>
              </div>

              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>AMOUNT_MISMATCH</span>
                </div>
                <p className="text-xs text-[#94A3B8]">
                  Transactions where external settlement fee differs from booked price (tariff variations or FX delta).
                </p>
              </div>

              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>MISSING_INTERNAL</span>
                </div>
                <p className="text-xs text-[#94A3B8]">
                  External gateway credits not recorded internally (e.g. dropped webhook). Auto-flagged for ledger entry.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TEST SUITE (26 SPECIFICATIONS) */}
      {activeSubTab === 'test-suite' && (
        <div className="bg-[#13161C] border border-[#1E293B] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1E293B]">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Sprint 12 Automated Verification Radar (26 Specifications)
              </h3>
              <p className="text-xs text-[#64748B]">
                Executes all 26 canonical specifications covering Double-Entry Ledger, Commission Engine, M-PESA &amp; Card
                gateways, Payouts, and Reconciliation.
              </p>
            </div>
            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Running Specs...' : 'Run All 26 Specs'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {testResults.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-xs text-[#64748B]">
                Click "Run All 26 Specs" to execute the full suite in real time.
              </div>
            ) : (
              testResults.map(test => (
                <div
                  key={test.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono transition-all ${
                    test.passed
                      ? 'bg-[#0B0D10] border-[#1E293B] text-slate-200'
                      : 'bg-rose-950/20 border-rose-900/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{test.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      test.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {test.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
