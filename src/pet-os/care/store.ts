/**
 * Pet OS - Preventive Care In-Memory Store
 * Provides transactional state, multi-key indices, and reactive UI subscriptions.
 */

import {
  CareObligationId,
  CareOccurrenceId,
  CareCompletionRecordId,
  ReminderPolicyId,
  PetId,
  HouseholdId,
  UserId
} from '../kernel/ids';
import {
  CareObligation,
  CareOccurrence,
  CareCompletionRecord,
  ReminderPolicy,
  CareFilterOptions
} from './types';

export class CareStore {
  private static obligations: Map<string, CareObligation> = new Map();
  private static occurrences: Map<string, CareOccurrence> = new Map();
  private static completions: Map<string, CareCompletionRecord> = new Map();
  private static reminderPolicies: Map<string, ReminderPolicy> = new Map();
  private static subscribers: Set<() => void> = new Set();

  static subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  static notify(): void {
    this.subscribers.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('CareStore subscriber error', err);
      }
    });
  }

  // --- Care Obligations ---

  static saveObligation(obligation: CareObligation): void {
    this.obligations.set(obligation.careObligationId, { ...obligation });
    this.notify();
  }

  static getObligation(id: CareObligationId): CareObligation | undefined {
    const ob = this.obligations.get(id);
    return ob ? { ...ob } : undefined;
  }

  static getObligationsForPet(petId: PetId): CareObligation[] {
    return Array.from(this.obligations.values())
      .filter(o => o.petId === petId)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  static getObligationsForHousehold(householdId: HouseholdId): CareObligation[] {
    return Array.from(this.obligations.values())
      .filter(o => o.householdId === householdId)
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  static getAllObligations(): CareObligation[] {
    return Array.from(this.obligations.values());
  }

  // --- Care Occurrences ---

  static saveOccurrence(occurrence: CareOccurrence): void {
    this.occurrences.set(occurrence.occurrenceId, { ...occurrence });
    this.notify();
  }

  static getOccurrence(id: CareOccurrenceId): CareOccurrence | undefined {
    const occ = this.occurrences.get(id);
    return occ ? { ...occ } : undefined;
  }

  static getOccurrencesForObligation(obligationId: CareObligationId): CareOccurrence[] {
    return Array.from(this.occurrences.values())
      .filter(o => o.careObligationId === obligationId)
      .sort((a, b) => a.occurrenceNumber - b.occurrenceNumber);
  }

  static getOccurrencesForPet(petId: PetId): CareOccurrence[] {
    return Array.from(this.occurrences.values())
      .filter(o => o.petId === petId)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  static getAllOccurrences(): CareOccurrence[] {
    return Array.from(this.occurrences.values())
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  static queryOccurrences(filters: CareFilterOptions): CareOccurrence[] {
    return Array.from(this.occurrences.values()).filter(occ => {
      if (filters.petId && occ.petId !== filters.petId) return false;
      if (filters.householdId && occ.householdId !== filters.householdId) return false;
      if (filters.assignedToUserId && occ.assignedToUserId !== filters.assignedToUserId) return false;
      if (filters.category && occ.category !== filters.category) return false;
      if (filters.status && occ.status !== filters.status) return false;
      if (filters.fromDate && new Date(occ.scheduledFor).getTime() < new Date(filters.fromDate).getTime()) return false;
      if (filters.toDate && new Date(occ.scheduledFor).getTime() > new Date(filters.toDate).getTime()) return false;
      return true;
    }).sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  // --- Care Completion Records ---

  static saveCompletion(record: CareCompletionRecord): void {
    this.completions.set(record.completionId, { ...record });
    this.notify();
  }

  static getCompletionsForPet(petId: PetId): CareCompletionRecord[] {
    return Array.from(this.completions.values())
      .filter(c => c.petId === petId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  static getCompletionForOccurrence(occurrenceId: CareOccurrenceId): CareCompletionRecord | undefined {
    return Array.from(this.completions.values()).find(c => c.occurrenceId === occurrenceId);
  }

  // --- Reminder Policies ---

  static saveReminderPolicy(policy: ReminderPolicy): void {
    this.reminderPolicies.set(policy.policyId, { ...policy });
    this.notify();
  }

  static getReminderPolicy(id: ReminderPolicyId): ReminderPolicy | undefined {
    const p = this.reminderPolicies.get(id);
    return p ? { ...p } : undefined;
  }

  static getReminderPolicyForObligation(obligationId: CareObligationId): ReminderPolicy | undefined {
    return Array.from(this.reminderPolicies.values()).find(p => p.careObligationId === obligationId);
  }

  static reset(): void {
    this.obligations.clear();
    this.occurrences.clear();
    this.completions.clear();
    this.reminderPolicies.clear();
    this.notify();
  }
}
