/**
 * Pet OS Sprint 26 - Provider Business SaaS Store & Repository
 * Authoritative in-memory state store with strict isolation and indexing.
 */

import {
  BusinessId,
  ProviderId,
  UserId,
  ProviderSaaSPlanId,
  ProviderSaaSPlanVersionId,
  ProviderSaaSPriceId,
  ProviderSaaSSubscriptionId,
  ProviderSaaSContinuityGrantId,
  ProviderSaaSSupportGrantId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  ProviderSaaSPlan,
  ProviderSaaSPlanVersion,
  ProviderSaaSPrice,
  ProviderSaaSSubscription,
  ProviderSaaSSubscriptionStatusHistory,
  ProviderSaaSContinuityGrant,
  ProviderSaaSSupportGrant,
} from './types';

export class ProviderSaaSStore {
  private static instance: ProviderSaaSStore | null = null;

  private plans: Map<string, ProviderSaaSPlan> = new Map();
  private planVersions: Map<string, ProviderSaaSPlanVersion> = new Map();
  private planPrices: Map<string, ProviderSaaSPrice> = new Map();
  private subscriptions: Map<string, ProviderSaaSSubscription> = new Map();
  private subscriptionsByBusiness: Map<string, string[]> = new Map();
  private subscriptionsByProvider: Map<string, string[]> = new Map();
  private statusHistories: ProviderSaaSSubscriptionStatusHistory[] = [];
  private continuityGrants: Map<string, ProviderSaaSContinuityGrant> = new Map();
  private supportGrants: Map<string, ProviderSaaSSupportGrant> = new Map();
  private processedWebhooks: Set<string> = new Set();
  private auditLogs: Array<{ id: string; timestamp: string; action: string; details: any }> = [];

  private constructor() {}

  public static getInstance(): ProviderSaaSStore {
    if (!ProviderSaaSStore.instance) {
      ProviderSaaSStore.instance = new ProviderSaaSStore();
    }
    return ProviderSaaSStore.instance;
  }

  public reset(): void {
    this.plans.clear();
    this.planVersions.clear();
    this.planPrices.clear();
    this.subscriptions.clear();
    this.subscriptionsByBusiness.clear();
    this.subscriptionsByProvider.clear();
    this.statusHistories = [];
    this.continuityGrants.clear();
    this.supportGrants.clear();
    this.processedWebhooks.clear();
    this.auditLogs = [];
  }

  // ==========================================================================
  // PLANS & CATALOGUE
  // ==========================================================================

  public savePlan(plan: ProviderSaaSPlan): void {
    this.plans.set(String(plan.planId), { ...plan });
  }

  public getPlan(id: ProviderSaaSPlanId): ProviderSaaSPlan | undefined {
    return this.plans.get(String(id));
  }

  public getPlanByCode(code: string): ProviderSaaSPlan | undefined {
    return Array.from(this.plans.values()).find(p => p.code === code);
  }

  public listPlans(): ProviderSaaSPlan[] {
    return Array.from(this.plans.values());
  }

  public savePlanVersion(version: ProviderSaaSPlanVersion): void {
    this.planVersions.set(String(version.versionId), { ...version });
  }

  public getPlanVersion(id: ProviderSaaSPlanVersionId): ProviderSaaSPlanVersion | undefined {
    return this.planVersions.get(String(id));
  }

  public listPlanVersions(planId?: ProviderSaaSPlanId): ProviderSaaSPlanVersion[] {
    const list = Array.from(this.planVersions.values());
    return planId ? list.filter(v => v.planId === planId) : list;
  }

  public savePrice(price: ProviderSaaSPrice): void {
    this.planPrices.set(String(price.priceId), { ...price });
  }

  public getPrice(id: ProviderSaaSPriceId): ProviderSaaSPrice | undefined {
    return this.planPrices.get(String(id));
  }

  public listPricesForPlan(planId: ProviderSaaSPlanId): ProviderSaaSPrice[] {
    return Array.from(this.planPrices.values()).filter(p => p.planId === planId);
  }

  public listAllPrices(): ProviderSaaSPrice[] {
    return Array.from(this.planPrices.values());
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  public saveSubscription(sub: ProviderSaaSSubscription): void {
    this.subscriptions.set(String(sub.subscriptionId), { ...sub });

    if (sub.businessId) {
      const bizKey = String(sub.businessId);
      const list = this.subscriptionsByBusiness.get(bizKey) || [];
      if (!list.includes(String(sub.subscriptionId))) {
        list.push(String(sub.subscriptionId));
        this.subscriptionsByBusiness.set(bizKey, list);
      }
    }

    if (sub.providerId) {
      const prvKey = String(sub.providerId);
      const list = this.subscriptionsByProvider.get(prvKey) || [];
      if (!list.includes(String(sub.subscriptionId))) {
        list.push(String(sub.subscriptionId));
        this.subscriptionsByProvider.set(prvKey, list);
      }
    }
  }

  public getSubscription(id: ProviderSaaSSubscriptionId): ProviderSaaSSubscription | undefined {
    const s = this.subscriptions.get(String(id));
    return s ? { ...s } : undefined;
  }

  public getActiveSubscriptionForBusiness(businessId: BusinessId): ProviderSaaSSubscription | undefined {
    const ids = this.subscriptionsByBusiness.get(String(businessId)) || [];
    const activeStatuses = ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'RESTRICTED', 'CANCEL_AT_PERIOD_END', 'PAST_DUE'];
    for (const id of ids) {
      const s = this.subscriptions.get(id);
      if (s && activeStatuses.includes(s.status)) {
        return { ...s };
      }
    }
    return undefined;
  }

  public getActiveSubscriptionForProvider(providerId: ProviderId): ProviderSaaSSubscription | undefined {
    const ids = this.subscriptionsByProvider.get(String(providerId)) || [];
    const activeStatuses = ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'RESTRICTED', 'CANCEL_AT_PERIOD_END', 'PAST_DUE'];
    for (const id of ids) {
      const s = this.subscriptions.get(id);
      if (s && activeStatuses.includes(s.status)) {
        return { ...s };
      }
    }
    return undefined;
  }

  public listAllSubscriptions(): ProviderSaaSSubscription[] {
    return Array.from(this.subscriptions.values()).map(s => ({ ...s }));
  }

  public recordStatusHistory(history: ProviderSaaSSubscriptionStatusHistory): void {
    this.statusHistories.push({ ...history });
  }

  public getStatusHistory(subId: ProviderSaaSSubscriptionId): ProviderSaaSSubscriptionStatusHistory[] {
    return this.statusHistories.filter(h => h.subscriptionId === subId);
  }

  // ==========================================================================
  // CONTINUITY GRANTS (ANIMAL SAFETY)
  // ==========================================================================

  public saveContinuityGrant(grant: ProviderSaaSContinuityGrant): void {
    this.continuityGrants.set(String(grant.grantId), { ...grant });
  }

  public getContinuityGrant(id: ProviderSaaSContinuityGrantId): ProviderSaaSContinuityGrant | undefined {
    return this.continuityGrants.get(String(id));
  }

  public getActiveContinuityGrantsForBusiness(businessId: BusinessId): ProviderSaaSContinuityGrant[] {
    const nowIso = new Date().toISOString();
    return Array.from(this.continuityGrants.values()).filter(
      g => g.businessId === businessId && g.isActive && g.expiresAt > nowIso
    );
  }

  public getActiveContinuityGrantsForProvider(providerId: ProviderId): ProviderSaaSContinuityGrant[] {
    const nowIso = new Date().toISOString();
    return Array.from(this.continuityGrants.values()).filter(
      g => g.providerId === providerId && g.isActive && g.expiresAt > nowIso
    );
  }

  public getContinuityGrantByContext(contextId: string): ProviderSaaSContinuityGrant | undefined {
    const nowIso = new Date().toISOString();
    return Array.from(this.continuityGrants.values()).find(
      g => g.contextId === contextId && g.isActive && g.expiresAt > nowIso
    );
  }

  public listAllContinuityGrants(): ProviderSaaSContinuityGrant[] {
    return Array.from(this.continuityGrants.values()).map(g => ({ ...g }));
  }

  // ==========================================================================
  // SUPPORT GRANTS
  // ==========================================================================

  public saveSupportGrant(grant: ProviderSaaSSupportGrant): void {
    this.supportGrants.set(String(grant.grantId), { ...grant });
  }

  public getActiveSupportGrantsForTarget(targetId: string): ProviderSaaSSupportGrant[] {
    const nowIso = new Date().toISOString();
    return Array.from(this.supportGrants.values()).filter(
      g => g.targetId === targetId && g.isActive && g.expiresAt > nowIso
    );
  }

  public listAllSupportGrants(): ProviderSaaSSupportGrant[] {
    return Array.from(this.supportGrants.values()).map(g => ({ ...g }));
  }

  // ==========================================================================
  // WEBHOOK IDEMPOTENCY & AUDIT
  // ==========================================================================

  public hasProcessedWebhook(eventId: string): boolean {
    return this.processedWebhooks.has(eventId);
  }

  public markWebhookProcessed(eventId: string): void {
    this.processedWebhooks.add(eventId);
  }

  public logAudit(action: string, details: any): void {
    this.auditLogs.unshift({
      id: generateUUIDv7(),
      timestamp: new Date().toISOString(),
      action,
      details,
    });
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(limit = 50): Array<{ id: string; timestamp: string; action: string; details: any }> {
    return this.auditLogs.slice(0, limit);
  }
}
