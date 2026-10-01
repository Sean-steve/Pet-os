/**
 * Pet OS Financial Platform - Double-Entry Ledger Engine
 * Implements Volume XVII, ADR-012:
 * "All payments, payouts, platform commissions, fees, and refunds are posted to a double-entry ledger.
 * Every balance movement maps to a balanced ledger journal (debit = credit); posted journals are immutable."
 */

import {
  LedgerAccountId,
  LedgerJournalId,
  LedgerEntryId,
  ProviderId,
  BusinessId,
  BookingId,
  CorrelationId,
  asLedgerAccountId,
  asLedgerJournalId,
  asLedgerEntryId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import {
  LedgerAccount,
  LedgerAccountCode,
  LedgerAccountType,
  LedgerJournal,
  LedgerEntry,
  LedgerDirection,
  JournalType,
  JournalSourceType,
} from './types';

export interface EntryDraft {
  accountCode: LedgerAccountCode;
  direction: LedgerDirection;
  amountMinor: number;
  providerId?: ProviderId;
  businessId?: BusinessId;
  bookingId?: BookingId;
  reference?: string;
}

export interface PostJournalParams {
  journalType: JournalType;
  sourceType: JournalSourceType;
  sourceId: string;
  currency: CurrencyCode;
  description: string;
  entries: EntryDraft[];
  idempotencyKey: string;
  correlationId?: CorrelationId;
  reversalOfJournalId?: LedgerJournalId;
}

export class DoubleEntryLedgerEngine {
  private accounts = new Map<LedgerAccountCode, LedgerAccount>();
  private journals = new Map<LedgerJournalId, LedgerJournal>();
  private entries = new Map<LedgerEntryId, LedgerEntry>();
  private idempotencyIndex = new Map<string, LedgerJournalId>();

  constructor() {
    this.bootstrapStandardChartOfAccounts();
  }

  /**
   * Initializes the canonical Pet OS Chart of Accounts
   */
  private bootstrapStandardChartOfAccounts(): void {
    const definitions: Array<{
      code: LedgerAccountCode;
      name: string;
      type: LedgerAccountType;
      description: string;
    }> = [
      {
        code: 'ASSET_CASH_CLEARING_MPESA',
        name: 'M-PESA Clearing Account',
        type: 'ASSET',
        description: 'Cash collected via Safaricom M-Pesa waiting for platform bank transfer/settlement',
      },
      {
        code: 'ASSET_CASH_CLEARING_CARD',
        name: 'Card Gateway Clearing Account',
        type: 'ASSET',
        description: 'Funds collected via Visa/Mastercard payment gateway awaiting merchant settlement',
      },
      {
        code: 'ASSET_PAYMENT_PROCESSOR_RECEIVABLE',
        name: 'Payment Processor Settlement Receivable',
        type: 'ASSET',
        description: 'Authoritative settlements due from external payment service providers',
      },
      {
        code: 'LIABILITY_CUSTOMER_PREPAYMENTS',
        name: 'Customer Service Prepayments',
        type: 'LIABILITY',
        description: 'Customer pre-funded amounts for bookings not yet rendered or settled',
      },
      {
        code: 'LIABILITY_PROVIDER_PAYABLE_PENDING',
        name: 'Pending Provider Earnings',
        type: 'LIABILITY',
        description: 'Provider earnings escrowed pending service fulfillment and settlement window',
      },
      {
        code: 'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',
        name: 'Available Provider Earnings',
        type: 'LIABILITY',
        description: 'Cleared provider earnings eligible for immediate B2C/bank withdrawal',
      },
      {
        code: 'LIABILITY_REFUND_PAYABLE',
        name: 'Customer Refund Payable',
        type: 'LIABILITY',
        description: 'Approved customer refunds awaiting payment provider disbursement',
      },
      {
        code: 'LIABILITY_PAYOUT_CLEARING',
        name: 'Provider Payout In-Flight Clearing',
        type: 'LIABILITY',
        description: 'Provider funds reserved in-flight during active B2C/bank payout execution',
      },
      {
        code: 'REVENUE_PLATFORM_COMMISSION',
        name: 'Pet OS Platform Commission Revenue',
        type: 'REVENUE',
        description: 'Net platform marketplace commissions earned upon service booking/fulfillment',
      },
      {
        code: 'EXPENSE_PAYMENT_PROCESSOR_FEES',
        name: 'Payment Processor Processing Fees',
        type: 'EXPENSE',
        description: 'Transaction fees levied by Safaricom M-Pesa or card acquiring banks',
      },
      {
        code: 'EXPENSE_PLATFORM_DISCOUNTS',
        name: 'Platform Promotional Credits & Goodwill',
        type: 'EXPENSE',
        description: 'Promotional discounts or customer satisfaction goodwill absorption',
      },
    ];

    for (const def of definitions) {
      const account: LedgerAccount = {
        accountId: asLedgerAccountId(`acc-${def.code.toLowerCase()}`),
        code: def.code,
        name: def.name,
        type: def.type,
        currency: 'KES',
        description: def.description,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      this.accounts.set(def.code, account);
    }
  }

  /**
   * Retrieves an account by canonical code
   */
  getAccount(code: LedgerAccountCode): LedgerAccount {
    const acc = this.accounts.get(code);
    if (!acc) {
      throw new Error(`Ledger account not found for code: ${code}`);
    }
    return acc;
  }

  /**
   * Posts an immutable double-entry journal transaction.
   * STRICT INVARIANT: Total Debits MUST strictly equal Total Credits.
   */
  postJournal(params: PostJournalParams): LedgerJournal {
    // 1. Idempotency Check
    const existingJournalId = this.idempotencyIndex.get(params.idempotencyKey);
    if (existingJournalId) {
      const existing = this.journals.get(existingJournalId);
      if (existing) return existing;
    }

    if (!params.entries || params.entries.length < 2) {
      throw new Error('A double-entry journal must contain at least 2 entries.');
    }

    let totalDebitsMinor = 0;
    let totalCreditsMinor = 0;

    // Validate entries and calculate sums
    for (const entry of params.entries) {
      if (entry.amountMinor <= 0) {
        throw new Error(`Entry amount must be positive integer minor units, got: ${entry.amountMinor}`);
      }
      if (!Number.isInteger(entry.amountMinor)) {
        throw new Error(`Entry amount must be an integer, got: ${entry.amountMinor}`);
      }

      if (entry.direction === 'DEBIT') {
        totalDebitsMinor += entry.amountMinor;
      } else if (entry.direction === 'CREDIT') {
        totalCreditsMinor += entry.amountMinor;
      } else {
        throw new Error(`Invalid direction: ${entry.direction}`);
      }
    }

    // STRICT INVARIANT: Total Debits === Total Credits
    if (totalDebitsMinor !== totalCreditsMinor) {
      throw new Error(
        `UNBALANCED JOURNAL REJECTED: Total debits (${totalDebitsMinor}) do not equal total credits (${totalCreditsMinor}). Currency: ${params.currency}`
      );
    }

    const journalId = asLedgerJournalId(generateUUIDv7());
    const now = new Date().toISOString();

    const createdEntries: LedgerEntry[] = params.entries.map(draft => {
      const account = this.getAccount(draft.accountCode);
      const entryId = asLedgerEntryId(generateUUIDv7());
      const entry: LedgerEntry = {
        entryId,
        journalId,
        accountId: account.accountId,
        accountCode: draft.accountCode,
        direction: draft.direction,
        amountMinor: draft.amountMinor,
        currency: params.currency,
        providerId: draft.providerId,
        businessId: draft.businessId,
        bookingId: draft.bookingId,
        reference: draft.reference,
        createdAt: now,
      };
      this.entries.set(entryId, entry);
      return entry;
    });

    const journal: LedgerJournal = {
      journalId,
      journalType: params.journalType,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      currency: params.currency,
      status: 'POSTED',
      totalAmountMinor: totalDebitsMinor,
      postedAt: now,
      reversalOfJournalId: params.reversalOfJournalId,
      correlationId: params.correlationId,
      idempotencyKey: params.idempotencyKey,
      description: params.description,
      entries: createdEntries,
      createdAt: now,
    };

    this.journals.set(journalId, journal);
    this.idempotencyIndex.set(params.idempotencyKey, journalId);

    return journal;
  }

  /**
   * Calculates the authoritative balance of a specific ledger account by summing immutable entries.
   * Never mutates balances directly.
   */
  getAccountBalance(code: LedgerAccountCode, filter?: { providerId?: ProviderId; currency?: CurrencyCode }): Money {
    const account = this.getAccount(code);
    const currency = filter?.currency || 'KES';
    let debits = 0;
    let credits = 0;

    for (const entry of this.entries.values()) {
      if (entry.accountCode !== code) continue;
      if (entry.currency !== currency) continue;
      if (filter?.providerId && entry.providerId !== filter.providerId) continue;

      if (entry.direction === 'DEBIT') {
        debits += entry.amountMinor;
      } else {
        credits += entry.amountMinor;
      }
    }

    // Normal balance sign convention:
    // ASSET & EXPENSE: Debits - Credits
    // LIABILITY, EQUITY & REVENUE: Credits - Debits
    let balanceMinor = 0;
    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      balanceMinor = debits - credits;
    } else {
      balanceMinor = credits - debits;
    }

    return Money.fromMinor(balanceMinor, currency);
  }

  /**
   * Returns all registered ledger accounts in Chart of Accounts
   */
  getAllAccounts(): LedgerAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Returns all journals in chronological order
   */
  getAllJournals(): LedgerJournal[] {
    return Array.from(this.journals.values()).sort(
      (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
    );
  }

  /**
   * Returns all entries for a specific booking
   */
  getEntriesForBooking(bookingId: BookingId): LedgerEntry[] {
    return Array.from(this.entries.values()).filter(e => e.bookingId === bookingId);
  }

  /**
   * Verifies the fundamental accounting equation across the entire ledger:
   * Total Assets = Total Liabilities + Total Equity + (Revenue - Expenses)
   */
  verifyTrialBalance(currency: CurrencyCode = 'KES'): {
    isBalanced: boolean;
    totalDebits: Money;
    totalCredits: Money;
    differenceMinor: number;
  } {
    let debitsMinor = 0;
    let creditsMinor = 0;

    for (const entry of this.entries.values()) {
      if (entry.currency !== currency) continue;
      if (entry.direction === 'DEBIT') {
        debitsMinor += entry.amountMinor;
      } else {
        creditsMinor += entry.amountMinor;
      }
    }

    return {
      isBalanced: debitsMinor === creditsMinor,
      totalDebits: Money.fromMinor(debitsMinor, currency),
      totalCredits: Money.fromMinor(creditsMinor, currency),
      differenceMinor: Math.abs(debitsMinor - creditsMinor),
    };
  }

  /**
   * Reverses a posted journal by posting an exact inverse compensating journal.
   * Posted entries are NEVER modified.
   */
  reverseJournal(
    originalJournalId: LedgerJournalId,
    reason: string,
    idempotencyKey: string,
    correlationId?: CorrelationId
  ): LedgerJournal {
    const original = this.journals.get(originalJournalId);
    if (!original) {
      throw new Error(`Original journal not found for reversal: ${originalJournalId}`);
    }

    // Create opposite entries
    const inverseEntries: EntryDraft[] = original.entries.map(e => ({
      accountCode: e.accountCode,
      direction: e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      amountMinor: e.amountMinor,
      providerId: e.providerId,
      businessId: e.businessId,
      bookingId: e.bookingId,
      reference: `Reversal of entry ${e.entryId}: ${reason}`,
    }));

    return this.postJournal({
      journalType: 'REVERSAL',
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      currency: original.currency,
      description: `Compensating reversal of journal ${originalJournalId}: ${reason}`,
      entries: inverseEntries,
      idempotencyKey,
      correlationId,
      reversalOfJournalId: originalJournalId,
    });
  }
}
