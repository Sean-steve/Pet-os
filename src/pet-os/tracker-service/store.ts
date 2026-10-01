/**
 * Pet OS Sprint 25 - Tracker Subscription & Device Service Store
 * Authoritative in-memory state store adhering to Pet OS singleton patterns.
 */

import {
  DeviceId,
  HouseholdId,
  TrackerServicePlanId,
  TrackerPlanPriceId,
  TrackerSubscriptionId,
  TrackerCarrierServiceRecordId,
  TrackerDeviceTransferRecordId,
  TrackerSafetyOverrideRecordId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  TrackerServicePlan,
  TrackerPlanVersion,
  TrackerPlanPrice,
  TrackerSubscription,
  TrackerCarrierServiceRecord,
  TrackerDeviceTransferRecord,
  TrackerSafetyOverrideRecord,
} from './types';

export class TrackerSubscriptionStore {
  private static instance: TrackerSubscriptionStore | null = null;

  // Repositories
  private plans: Map<string, TrackerServicePlan> = new Map();
  private planVersions: Map<string, TrackerPlanVersion> = new Map();
  private planPrices: Map<string, TrackerPlanPrice> = new Map();
  private subscriptions: Map<string, TrackerSubscription> = new Map();
  private carrierRecords: Map<string, TrackerCarrierServiceRecord> = new Map();
  private transferRecords: Map<string, TrackerDeviceTransferRecord> = new Map();
  private safetyOverrides: Map<string, TrackerSafetyOverrideRecord> = new Map();
  private processedWebhookEvents: Set<string> = new Set();
  private auditLog: Array<{ id: string; timestamp: string; action: string; details: any }> = [];

  private constructor() {}

  public static getInstance(): TrackerSubscriptionStore {
    if (!TrackerSubscriptionStore.instance) {
      TrackerSubscriptionStore.instance = new TrackerSubscriptionStore();
    }
    return TrackerSubscriptionStore.instance;
  }

  public reset(): void {
    this.plans.clear();
    this.planVersions.clear();
    this.planPrices.clear();
    this.subscriptions.clear();
    this.carrierRecords.clear();
    this.transferRecords.clear();
    this.safetyOverrides.clear();
    this.processedWebhookEvents.clear();
    this.auditLog = [];
  }

  // ==========================================================================
  // PLANS & CATALOGUE
  // ==========================================================================

  public savePlan(plan: TrackerServicePlan): void {
    this.plans.set(String(plan.id), { ...plan });
  }

  public getPlan(id: TrackerServicePlanId): TrackerServicePlan | undefined {
    return this.plans.get(String(id));
  }

  public getPlanByCode(code: string): TrackerServicePlan | undefined {
    return Array.from(this.plans.values()).find(p => p.code === code);
  }

  public getAllPlans(): TrackerServicePlan[] {
    return Array.from(this.plans.values());
  }

  public savePlanVersion(version: TrackerPlanVersion): void {
    this.planVersions.set(String(version.id), { ...version });
  }

  public getPlanVersion(id: string): TrackerPlanVersion | undefined {
    return this.planVersions.get(id);
  }

  public savePlanPrice(price: TrackerPlanPrice): void {
    this.planPrices.set(String(price.id), { ...price });
  }

  public getPlanPrice(id: TrackerPlanPriceId): TrackerPlanPrice | undefined {
    return this.planPrices.get(String(id));
  }

  public getPricesForPlan(planId: TrackerServicePlanId): TrackerPlanPrice[] {
    return Array.from(this.planPrices.values()).filter(p => p.planId === planId);
  }

  // ==========================================================================
  // DEVICE SUBSCRIPTIONS
  // ==========================================================================

  public saveSubscription(sub: TrackerSubscription): void {
    this.subscriptions.set(String(sub.id), { ...sub });
  }

  public getSubscription(id: TrackerSubscriptionId): TrackerSubscription | undefined {
    return this.subscriptions.get(String(id));
  }

  public getSubscriptionForDevice(deviceId: DeviceId): TrackerSubscription | undefined {
    return Array.from(this.subscriptions.values()).find(
      s => s.deviceId === deviceId && s.status !== 'TERMINATED' && s.status !== 'EXPIRED'
    ) || Array.from(this.subscriptions.values()).find(
      s => s.deviceId === deviceId
    );
  }

  public getSubscriptionsForHousehold(householdId: HouseholdId): TrackerSubscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.householdId === householdId);
  }

  public getAllSubscriptions(): TrackerSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  // ==========================================================================
  // CARRIER RECORDS
  // ==========================================================================

  public saveCarrierRecord(record: TrackerCarrierServiceRecord): void {
    this.carrierRecords.set(String(record.id), { ...record });
  }

  public getCarrierRecord(id: TrackerCarrierServiceRecordId): TrackerCarrierServiceRecord | undefined {
    return this.carrierRecords.get(String(id));
  }

  public getCarrierRecordForDevice(deviceId: DeviceId): TrackerCarrierServiceRecord | undefined {
    return Array.from(this.carrierRecords.values()).find(c => c.deviceId === deviceId);
  }

  public getCarrierRecordByRef(ref: string): TrackerCarrierServiceRecord | undefined {
    return Array.from(this.carrierRecords.values()).find(c => c.carrierSubscriptionRef === ref);
  }

  public getAllCarrierRecords(): TrackerCarrierServiceRecord[] {
    return Array.from(this.carrierRecords.values());
  }

  // ==========================================================================
  // TRANSFERS & REPLACEMENTS
  // ==========================================================================

  public saveTransferRecord(record: TrackerDeviceTransferRecord): void {
    this.transferRecords.set(String(record.id), { ...record });
  }

  public getTransferRecordsForSubscription(subId: TrackerSubscriptionId): TrackerDeviceTransferRecord[] {
    return Array.from(this.transferRecords.values()).filter(t => t.subscriptionId === subId);
  }

  public getAllTransferRecords(): TrackerDeviceTransferRecord[] {
    return Array.from(this.transferRecords.values());
  }

  // ==========================================================================
  // SAFETY OVERRIDES
  // ==========================================================================

  public saveSafetyOverride(override: TrackerSafetyOverrideRecord): void {
    this.safetyOverrides.set(String(override.id), { ...override });
  }

  public getActiveSafetyOverride(deviceId: DeviceId): TrackerSafetyOverrideRecord | undefined {
    const now = new Date().toISOString();
    return Array.from(this.safetyOverrides.values()).find(
      o => o.deviceId === deviceId && o.isEmergencyUplinkActive && o.expiresAt > now
    );
  }

  public getSafetyOverridesForDevice(deviceId: DeviceId): TrackerSafetyOverrideRecord[] {
    return Array.from(this.safetyOverrides.values()).filter(o => o.deviceId === deviceId);
  }

  public getAllSafetyOverrides(): TrackerSafetyOverrideRecord[] {
    return Array.from(this.safetyOverrides.values());
  }

  // ==========================================================================
  // WEBHOOK IDEMPOTENCY
  // ==========================================================================

  public hasProcessedWebhook(eventId: string): boolean {
    return this.processedWebhookEvents.has(eventId);
  }

  public markWebhookProcessed(eventId: string): void {
    this.processedWebhookEvents.add(eventId);
  }

  // ==========================================================================
  // AUDIT & LOGGING
  // ==========================================================================

  public logAudit(action: string, details: any): void {
    this.auditLog.unshift({
      id: generateUUIDv7(),
      timestamp: new Date().toISOString(),
      action,
      details,
    });
    if (this.auditLog.length > 500) {
      this.auditLog.pop();
    }
  }

  public getAuditLog(limit = 50): Array<{ id: string; timestamp: string; action: string; details: any }> {
    return this.auditLog.slice(0, limit);
  }
}
