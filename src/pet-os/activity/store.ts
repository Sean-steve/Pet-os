/**
 * Pet OS Sprint 9 - Activity In-Memory Store
 * Provides transactional state, multi-key indices, and reactive UI subscriptions.
 */

import {
  PetId,
  HouseholdId,
  UserId,
  ActivityId,
  ActivitySessionId,
  ActivityRoutineId,
  ActivityOccurrenceId,
  ActivityGoalId
} from '../kernel/ids';
import {
  ActivityRecord,
  ActivitySession,
  ActivityRoutine,
  ActivityOccurrence,
  ActivityGoal,
  ActivityAuditAmendment,
  ActivityType,
  ActivityVerificationStatus
} from './types';

export class ActivityStore {
  private static records: Map<string, ActivityRecord> = new Map();
  private static sessions: Map<string, ActivitySession> = new Map();
  private static routines: Map<string, ActivityRoutine> = new Map();
  private static occurrences: Map<string, ActivityOccurrence> = new Map();
  private static goals: Map<string, ActivityGoal> = new Map();
  private static amendments: Map<string, ActivityAuditAmendment> = new Map();

  // Reactive UI subscriptions
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
        console.error('ActivityStore subscriber error', err);
      }
    });
  }

  // ==========================================================================
  // ACTIVITY RECORDS
  // ==========================================================================

  static saveRecord(record: ActivityRecord): void {
    this.records.set(record.activityId, { ...record });
    this.notify();
  }

  static getRecord(id: ActivityId): ActivityRecord | undefined {
    const rec = this.records.get(id);
    return rec ? { ...rec } : undefined;
  }

  static getRecordsForPet(petId: PetId, includeEnteredInError = false): ActivityRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.petId === petId && (includeEnteredInError || r.verificationStatus !== 'ENTERED_IN_ERROR'))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  static getRecordsForHousehold(householdId: HouseholdId, includeEnteredInError = false): ActivityRecord[] {
    return Array.from(this.records.values())
      .filter(r => r.householdId === householdId && (includeEnteredInError || r.verificationStatus !== 'ENTERED_IN_ERROR'))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  static markEnteredInError(
    id: ActivityId,
    reason: string,
    userId: UserId,
    timestamp: string
  ): ActivityRecord {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`Activity record not found: ${id}`);
    }

    const updated: ActivityRecord = {
      ...existing,
      verificationStatus: 'ENTERED_IN_ERROR',
      enteredInErrorAt: timestamp,
      enteredInErrorReason: reason,
      enteredInErrorBy: userId,
      updatedAt: timestamp
    };

    this.records.set(id, updated);
    this.notify();
    return { ...updated };
  }

  // ==========================================================================
  // ACTIVE STOPWATCH SESSIONS
  // ==========================================================================

  static saveSession(session: ActivitySession): void {
    this.sessions.set(session.activitySessionId, { ...session });
    this.notify();
  }

  static getSession(id: ActivitySessionId): ActivitySession | undefined {
    const s = this.sessions.get(id);
    return s ? { ...s } : undefined;
  }

  /**
   * Concurrency Guard: Finds any currently ACTIVE or PAUSED session for a pet.
   */
  static getActiveSessionForPet(petId: PetId): ActivitySession | undefined {
    for (const s of this.sessions.values()) {
      if (s.petId === petId && (s.status === 'ACTIVE' || s.status === 'PAUSED')) {
        return { ...s };
      }
    }
    return undefined;
  }

  static getActiveSessionsForHousehold(householdId: HouseholdId): ActivitySession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.householdId === householdId && (s.status === 'ACTIVE' || s.status === 'PAUSED' || s.status === 'NEEDS_REVIEW'))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  // ==========================================================================
  // ACTIVITY ROUTINES
  // ==========================================================================

  static saveRoutine(routine: ActivityRoutine): void {
    this.routines.set(routine.routineId, { ...routine });
    this.notify();
  }

  static getRoutine(id: ActivityRoutineId): ActivityRoutine | undefined {
    const r = this.routines.get(id);
    return r ? { ...r } : undefined;
  }

  static getRoutinesForPet(petId: PetId): ActivityRoutine[] {
    return Array.from(this.routines.values())
      .filter(r => r.petId === petId && r.status !== 'ARCHIVED')
      .sort((a, b) => (a.targetTimeOfDay || '00:00').localeCompare(b.targetTimeOfDay || '00:00'));
  }

  static getRoutinesForHousehold(householdId: HouseholdId): ActivityRoutine[] {
    return Array.from(this.routines.values())
      .filter(r => r.householdId === householdId && r.status !== 'ARCHIVED');
  }

  // ==========================================================================
  // ROUTINE OCCURRENCES
  // ==========================================================================

  static saveOccurrence(occ: ActivityOccurrence): void {
    this.occurrences.set(occ.occurrenceId, { ...occ });
    this.notify();
  }

  static getOccurrence(id: ActivityOccurrenceId): ActivityOccurrence | undefined {
    const occ = this.occurrences.get(id);
    return occ ? { ...occ } : undefined;
  }

  static getOccurrencesForPet(petId: PetId): ActivityOccurrence[] {
    return Array.from(this.occurrences.values())
      .filter(o => o.petId === petId)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  static getOccurrencesForHousehold(householdId: HouseholdId): ActivityOccurrence[] {
    return Array.from(this.occurrences.values())
      .filter(o => o.householdId === householdId)
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  static getOccurrencesForDate(householdId: HouseholdId, dateStr: string): ActivityOccurrence[] {
    // dateStr in YYYY-MM-DD format
    return Array.from(this.occurrences.values())
      .filter(o => o.householdId === householdId && o.scheduledFor.startsWith(dateStr))
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  // ==========================================================================
  // ACTIVITY GOALS
  // ==========================================================================

  static saveGoal(goal: ActivityGoal): void {
    this.goals.set(goal.goalId, { ...goal });
    this.notify();
  }

  static getGoal(id: ActivityGoalId): ActivityGoal | undefined {
    const g = this.goals.get(id);
    return g ? { ...g } : undefined;
  }

  static getGoalsForPet(petId: PetId): ActivityGoal[] {
    return Array.from(this.goals.values())
      .filter(g => g.petId === petId && g.status !== 'CANCELLED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==========================================================================
  // AUDIT AMENDMENTS
  // ==========================================================================

  static saveAmendment(amendment: ActivityAuditAmendment): void {
    this.amendments.set(amendment.amendmentId, { ...amendment });
  }

  static getAmendmentsForActivity(activityId: ActivityId): ActivityAuditAmendment[] {
    return Array.from(this.amendments.values())
      .filter(a => a.activityId === activityId)
      .sort((a, b) => new Date(b.amendedAt).getTime() - new Date(a.amendedAt).getTime());
  }

  // ==========================================================================
  // TESTING & RESET
  // ==========================================================================

  static resetForTesting(): void {
    this.records.clear();
    this.sessions.clear();
    this.routines.clear();
    this.occurrences.clear();
    this.goals.clear();
    this.amendments.clear();
    this.subscribers.clear();
  }
}
