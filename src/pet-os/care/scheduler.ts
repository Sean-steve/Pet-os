/**
 * Pet OS - Care Background Scheduler Engine
 * Implements Step 41-45: Periodic evaluation of due states,
 * reminder dispatch, lookahead generation, and downtime recovery.
 */

import { currentClockTime } from '../kernel/time';
import { CareStore } from './store';
import { DueStateEngine } from './due-state';
import { RecurrenceEngine } from './recurrence';
import { NotificationService } from '../notifications/service';
import { NotificationType } from '../notifications/types';

export interface SchedulerExecutionReport {
  timestamp: string;
  durationMs: number;
  evaluatedOccurrences: number;
  transitionedCount: number;
  remindersEnqueued: number;
  occurrencesGenerated: number;
  notificationQueueReport: {
    processed: number;
    delivered: number;
    failed: number;
    deadLetter: number;
  };
  errors: string[];
}

function toNotificationPriority(priority: string): 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' {
  switch (priority) {
    case 'CRITICAL':
    case 'URGENT':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'NORMAL';
    default:
      return 'LOW';
  }
}

export class CareBackgroundScheduler {
  private static lastRunTime?: Date;
  private static executionHistory: SchedulerExecutionReport[] = [];

  /**
   * Executes a deterministic scheduler tick at currentTime.
   */
  static async executeTick(currentTime = currentClockTime()): Promise<SchedulerExecutionReport> {
    const startTime = Date.now();
    const errors: string[] = [];
    let evaluatedOccurrences = 0;
    let transitionedCount = 0;
    let remindersEnqueued = 0;
    let occurrencesGenerated = 0;

    const occurrences = CareStore.getAllOccurrences();
    const obligations = CareStore.getAllObligations();

    // 1. Evaluate Due States and Enqueue Reminders
    for (const occ of occurrences) {
      if (occ.status === 'COMPLETED' || occ.status === 'SKIPPED' || occ.status === 'CANCELLED') {
        continue;
      }

      const obligation = obligations.find(o => o.careObligationId === occ.careObligationId);
      if (!obligation || obligation.status !== 'ACTIVE') {
        continue;
      }

      evaluatedOccurrences++;

      // Evaluate new temporal status
      const newStatus = DueStateEngine.evaluateStatus(occ, obligation, currentTime);
      if (newStatus !== occ.status) {
        occ.status = newStatus;
        occ.updatedAt = currentTime.toISOString();
        CareStore.saveOccurrence(occ);
        transitionedCount++;
      }

      // 2. Reminder Policy Evaluation & Notification Dispatch
      const reminderPolicy = CareStore.getReminderPolicyForObligation(obligation.careObligationId);
      if (reminderPolicy && DueStateEngine.isNotificationDue(occ, currentTime)) {
        const scheduledMs = new Date(occ.scheduledFor).getTime();
        const currentMs = currentTime.getTime();
        const daysDiff = (scheduledMs - currentMs) / (24 * 3600 * 1000);

        let shouldRemind = false;
        let notificationType: NotificationType = 'CARE_DUE';
        let priority = toNotificationPriority(obligation.priority);

        if (newStatus === 'DUE' && reminderPolicy.remindAtDue) {
          shouldRemind = true;
          notificationType = 'CARE_DUE';
        } else if (newStatus === 'OVERDUE') {
          shouldRemind = true;
          notificationType = 'CARE_OVERDUE';
          priority = 'HIGH';
        } else if (newStatus === 'UPCOMING') {
          // Check remindBeforeDays
          const matchesBeforeDay = reminderPolicy.remindBeforeDays.some(
            days => Math.abs(daysDiff - days) < 0.5
          );
          if (matchesBeforeDay) {
            shouldRemind = true;
            notificationType = 'CARE_UPCOMING';
          }
        }

        if (shouldRemind) {
          const recipientId = occ.assignedToUserId || obligation.assignedToUserId || obligation.createdBy;
          try {
            const deduplicationKey = `care-reminder:${occ.occurrenceId}:${notificationType}:${currentTime.toISOString().slice(0, 10)}`;
            await NotificationService.schedule({
              recipientUserId: recipientId,
              petId: occ.petId,
              careObligationId: occ.careObligationId,
              occurrenceId: occ.occurrenceId,
              notificationType,
              sourceType: 'CARE_OCCURRENCE',
              sourceId: occ.occurrenceId,
              title: `${occ.title} is ${newStatus === 'OVERDUE' ? 'OVERDUE' : newStatus}`,
              body: `Scheduled item "${occ.title}" is ${newStatus.toLowerCase()} on ${new Date(occ.scheduledFor).toLocaleDateString()}.`,
              priority,
              channels: reminderPolicy.preferredChannels,
              deduplicationKey
            });
            remindersEnqueued++;
          } catch (err: any) {
            errors.push(`Failed to enqueue reminder for ${occ.occurrenceId}: ${err.message}`);
          }
        }
      }
    }

    // 3. Lookahead occurrence generation for active recurring obligations
    const lookaheadWindowEnd = new Date(currentTime.getTime() + 30 * 24 * 3600 * 1000);
    for (const ob of obligations) {
      if (ob.status === 'ACTIVE' && ob.recurrenceRule) {
        const existingOccs = occurrences.filter(o => o.careObligationId === ob.careObligationId);
        const hasFutureOccurrence = existingOccs.some(
          o => new Date(o.scheduledFor).getTime() >= currentTime.getTime()
        );

        if (!hasFutureOccurrence) {
          const lastOcc = existingOccs[existingOccs.length - 1];
          const baseDate = lastOcc ? new Date(lastOcc.scheduledFor) : new Date(ob.startsAt || ob.dueAt);
          const nextOcc = RecurrenceEngine.generateNextOccurrence(
            ob,
            lastOcc ? lastOcc.occurrenceNumber : 0,
            baseDate
          );
          CareStore.saveOccurrence(nextOcc);
          ob.nextDueAt = nextOcc.scheduledFor;
          ob.updatedAt = currentTime.toISOString();
          CareStore.saveObligation(ob);
          occurrencesGenerated++;
        }
      }
    }

    // 4. Process Pending Notification Queue (dispatch to channels)
    const queueReport = await NotificationService.processPendingQueue(currentTime);

    const report: SchedulerExecutionReport = {
      timestamp: currentTime.toISOString(),
      durationMs: Date.now() - startTime,
      evaluatedOccurrences,
      transitionedCount,
      remindersEnqueued,
      occurrencesGenerated,
      notificationQueueReport: queueReport,
      errors
    };

    this.lastRunTime = currentTime;
    this.executionHistory.unshift(report);
    if (this.executionHistory.length > 20) {
      this.executionHistory.pop();
    }

    return report;
  }

  /**
   * Simulates downtime recovery: system was offline for X hours.
   */
  static async simulateDowntimeRecovery(
    offlineHours = 24,
    referenceTime = currentClockTime()
  ): Promise<{
    catchupReport: SchedulerExecutionReport;
    offlineHours: number;
  }> {
    const recoveryTime = new Date(referenceTime.getTime() + offlineHours * 3600 * 1000);
    const report = await this.executeTick(recoveryTime);

    return {
      catchupReport: report,
      offlineHours
    };
  }

  static getHistory(): SchedulerExecutionReport[] {
    return [...this.executionHistory];
  }

  static getLastRunTime(): Date | undefined {
    return this.lastRunTime ? new Date(this.lastRunTime) : undefined;
  }
}
