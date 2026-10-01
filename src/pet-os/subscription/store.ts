/**
 * Pet OS Subscription & Entitlements Domain - Store & Index Engine
 * Provides thread-safe, transactional in-memory storage, querying, and audit indexing.
 */

import {
  ConsumerPlanId,
  PlanVersionId,
  PlanPriceId,
  EntitlementDefinitionId,
  EntitlementBundleId,
  EntitlementGrantId,
  ConsumerSubscriptionId,
  SubscriptionBillingAgreementId,
  SubscriptionStatusHistoryId,
  SubscriptionInvoiceId,
  EntitlementUsageId,
  SupportGrantId,
  SubscriptionReconciliationRunId,
  EntitlementReconciliationRunId,
  UserId,
  HouseholdId,
} from '../kernel/ids';
import {
  ConsumerPlan,
  PlanVersion,
  PlanPrice,
  EntitlementDefinition,
  EntitlementBundle,
  EntitlementGrant,
  ConsumerSubscription,
  SubscriptionStatusHistory,
  SubscriptionBillingAgreement,
  SubscriptionInvoice,
  EntitlementUsage,
  SupportGrant,
  SubscriptionProviderReconciliationRecord,
  EntitlementReconciliationRecord,
  SubscriptionBillingWebhookPayload,
} from './types';

export class SubscriptionStore {
  // Catalogs
  private static plans = new Map<ConsumerPlanId, ConsumerPlan>();
  private static planVersions = new Map<PlanVersionId, PlanVersion>();
  private static planPrices = new Map<PlanPriceId, PlanPrice>();
  private static entitlementDefinitions = new Map<EntitlementDefinitionId, EntitlementDefinition>();
  private static entitlementDefinitionsByCode = new Map<string, EntitlementDefinition>();
  private static entitlementBundles = new Map<EntitlementBundleId, EntitlementBundle>();

  // Subscriptions & Billing
  private static subscriptions = new Map<ConsumerSubscriptionId, ConsumerSubscription>();
  private static subscriptionsByOwner = new Map<string, ConsumerSubscriptionId[]>();
  private static statusHistories: SubscriptionStatusHistory[] = [];
  private static billingAgreements = new Map<SubscriptionBillingAgreementId, SubscriptionBillingAgreement>();
  private static invoices = new Map<SubscriptionInvoiceId, SubscriptionInvoice>();

  // Entitlement Grants & Usages
  private static grants = new Map<EntitlementGrantId, EntitlementGrant>();
  private static grantsBySubject = new Map<string, EntitlementGrantId[]>();
  private static usages = new Map<string, EntitlementUsage>(); // key: `${subjectId}:${entitlementId}:${periodKey}`
  private static supportGrants = new Map<SupportGrantId, SupportGrant>();

  // Webhooks & Idempotency
  private static processedWebhookEventIds = new Set<string>();
  private static webhookEvents: SubscriptionBillingWebhookPayload[] = [];

  // Reconciliation Records
  private static providerReconciliations: SubscriptionProviderReconciliationRecord[] = [];
  private static entitlementReconciliations: EntitlementReconciliationRecord[] = [];
  private static idempotencyRecords = new Map<string, any>();

  // ==========================================================================
  // PLANS & CATALOG
  // ==========================================================================

  public static savePlan(plan: ConsumerPlan): void {
    this.plans.set(plan.planId, plan);
  }

  public static getPlan(id: ConsumerPlanId): ConsumerPlan | undefined {
    return this.plans.get(id);
  }

  public static getPlanByCode(code: string): ConsumerPlan | undefined {
    return Array.from(this.plans.values()).find((p) => p.code === code);
  }

  public static listPlans(): readonly ConsumerPlan[] {
    return Array.from(this.plans.values());
  }

  public static savePlanVersion(version: PlanVersion): void {
    this.planVersions.set(version.planVersionId, version);
  }

  public static getPlanVersion(id: PlanVersionId): PlanVersion | undefined {
    return this.planVersions.get(id);
  }

  public static listPlanVersions(planId?: ConsumerPlanId): readonly PlanVersion[] {
    const list = Array.from(this.planVersions.values());
    return planId ? list.filter((v) => v.planId === planId) : list;
  }

  public static getLatestActivePlanVersion(planId: ConsumerPlanId): PlanVersion | undefined {
    const active = this.listPlanVersions(planId).filter((v) => v.status === 'ACTIVE');
    return active.sort((a, b) => b.version - a.version)[0];
  }

  public static savePlanPrice(price: PlanPrice): void {
    this.planPrices.set(price.planPriceId, price);
  }

  public static getPlanPrice(id: PlanPriceId): PlanPrice | undefined {
    return this.planPrices.get(id);
  }

  public static listPlanPrices(planVersionId?: PlanVersionId): readonly PlanPrice[] {
    const list = Array.from(this.planPrices.values());
    return planVersionId ? list.filter((p) => p.planVersionId === planVersionId) : list;
  }

  // ==========================================================================
  // ENTITLEMENT DEFINITIONS & BUNDLES
  // ==========================================================================

  public static saveEntitlementDefinition(def: EntitlementDefinition): void {
    this.entitlementDefinitions.set(def.entitlementId, def);
    this.entitlementDefinitionsByCode.set(def.code, def);
  }

  public static getEntitlementDefinition(id: EntitlementDefinitionId): EntitlementDefinition | undefined {
    return this.entitlementDefinitions.get(id);
  }

  public static getEntitlementDefinitionByCode(code: string): EntitlementDefinition | undefined {
    return this.entitlementDefinitionsByCode.get(code);
  }

  public static listEntitlementDefinitions(): readonly EntitlementDefinition[] {
    return Array.from(this.entitlementDefinitions.values());
  }

  public static saveEntitlementBundle(bundle: EntitlementBundle): void {
    this.entitlementBundles.set(bundle.entitlementBundleId, bundle);
  }

  public static getEntitlementBundle(id: EntitlementBundleId): EntitlementBundle | undefined {
    return this.entitlementBundles.get(id);
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  public static saveSubscription(sub: ConsumerSubscription): void {
    this.subscriptions.set(sub.subscriptionId, sub);
    const ownerKey = String(sub.ownerId);
    const existing = this.subscriptionsByOwner.get(ownerKey) || [];
    if (!existing.includes(sub.subscriptionId)) {
      this.subscriptionsByOwner.set(ownerKey, [...existing, sub.subscriptionId]);
    }
  }

  public static getSubscription(id: ConsumerSubscriptionId): ConsumerSubscription | undefined {
    return this.subscriptions.get(id);
  }

  public static getActiveSubscriptionForOwner(ownerId: HouseholdId | UserId): ConsumerSubscription | undefined {
    const ids = this.subscriptionsByOwner.get(String(ownerId)) || [];
    const activeStatuses = ['ACTIVE', 'TRIALING', 'GRACE_PERIOD', 'CANCEL_AT_PERIOD_END', 'PAST_DUE'];
    for (const id of ids) {
      const sub = this.subscriptions.get(id);
      if (sub && activeStatuses.includes(sub.status)) {
        return sub;
      }
    }
    return undefined;
  }

  public static listSubscriptionsForOwner(ownerId: HouseholdId | UserId): readonly ConsumerSubscription[] {
    const ids = this.subscriptionsByOwner.get(String(ownerId)) || [];
    return ids.map((id) => this.subscriptions.get(id)!).filter(Boolean);
  }

  public static listAllSubscriptions(): readonly ConsumerSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public static recordStatusHistory(history: SubscriptionStatusHistory): void {
    this.statusHistories.push(history);
  }

  public static getStatusHistory(subscriptionId: ConsumerSubscriptionId): readonly SubscriptionStatusHistory[] {
    return this.statusHistories.filter((h) => h.subscriptionId === subscriptionId);
  }

  // ==========================================================================
  // BILLING AGREEMENTS & INVOICES
  // ==========================================================================

  public static saveBillingAgreement(agreement: SubscriptionBillingAgreement): void {
    this.billingAgreements.set(agreement.agreementId, agreement);
  }

  public static getBillingAgreement(id: SubscriptionBillingAgreementId): SubscriptionBillingAgreement | undefined {
    return this.billingAgreements.get(id);
  }

  public static getBillingAgreementForSubscription(subscriptionId: ConsumerSubscriptionId): SubscriptionBillingAgreement | undefined {
    return Array.from(this.billingAgreements.values()).find((a) => a.subscriptionId === subscriptionId);
  }

  public static saveInvoice(invoice: SubscriptionInvoice): void {
    this.invoices.set(invoice.invoiceId, invoice);
  }

  public static getInvoice(id: SubscriptionInvoiceId): SubscriptionInvoice | undefined {
    return this.invoices.get(id);
  }

  public static listInvoicesForSubscription(subscriptionId: ConsumerSubscriptionId): readonly SubscriptionInvoice[] {
    return Array.from(this.invoices.values()).filter((i) => i.subscriptionId === subscriptionId);
  }

  // ==========================================================================
  // ENTITLEMENT GRANTS
  // ==========================================================================

  public static saveEntitlementGrant(grant: EntitlementGrant): void {
    this.grants.set(grant.grantId, grant);
    const existing = this.grantsBySubject.get(grant.subjectId) || [];
    if (!existing.includes(grant.grantId)) {
      this.grantsBySubject.set(grant.subjectId, [...existing, grant.grantId]);
    }
  }

  public static getEntitlementGrant(id: EntitlementGrantId): EntitlementGrant | undefined {
    return this.grants.get(id);
  }

  public static listGrantsForSubject(subjectId: string): readonly EntitlementGrant[] {
    const ids = this.grantsBySubject.get(subjectId) || [];
    return ids.map((id) => this.grants.get(id)!).filter(Boolean);
  }

  public static revokeGrantsForSource(sourceId: string): number {
    let count = 0;
    for (const grant of this.grants.values()) {
      if (grant.sourceId === sourceId && grant.status === 'ACTIVE') {
        const updated: EntitlementGrant = {
          ...grant,
          status: 'REVOKED',
        };
        this.grants.set(grant.grantId, updated);
        count++;
      }
    }
    return count;
  }

  public static listAllActiveGrants(): readonly EntitlementGrant[] {
    return Array.from(this.grants.values()).filter((g) => g.status === 'ACTIVE');
  }

  // ==========================================================================
  // USAGE METERS
  // ==========================================================================

  public static getUsage(subjectId: string, entitlementId: EntitlementDefinitionId, periodKey: string): EntitlementUsage | undefined {
    const key = `${subjectId}:${entitlementId}:${periodKey}`;
    return this.usages.get(key);
  }

  public static saveUsage(usage: EntitlementUsage): void {
    const key = `${usage.subjectId}:${usage.entitlementDefinitionId}:${usage.periodKey}`;
    this.usages.set(key, usage);
  }

  // ==========================================================================
  // SUPPORT GRANTS
  // ==========================================================================

  public static saveSupportGrant(grant: SupportGrant): void {
    this.supportGrants.set(grant.grantId, grant);
  }

  public static getSupportGrant(id: SupportGrantId): SupportGrant | undefined {
    return this.supportGrants.get(id);
  }

  public static listSupportGrantsForSubject(subjectId: string): readonly SupportGrant[] {
    return Array.from(this.supportGrants.values()).filter((g) => g.subjectId === subjectId);
  }

  // ==========================================================================
  // WEBHOOKS & IDEMPOTENCY
  // ==========================================================================

  public static isWebhookEventProcessed(eventId: string): boolean {
    return this.processedWebhookEventIds.has(eventId);
  }

  public static recordWebhookEvent(payload: SubscriptionBillingWebhookPayload): void {
    this.processedWebhookEventIds.add(payload.eventId);
    this.webhookEvents.push(payload);
  }

  // ==========================================================================
  // RECONCILIATION RUNS
  // ==========================================================================

  public static recordProviderReconciliation(rec: SubscriptionProviderReconciliationRecord): void {
    this.providerReconciliations.push(rec);
  }

  public static listProviderReconciliations(): readonly SubscriptionProviderReconciliationRecord[] {
    return [...this.providerReconciliations];
  }

  public static recordEntitlementReconciliation(rec: EntitlementReconciliationRecord): void {
    this.entitlementReconciliations.push(rec);
  }

  public static listEntitlementReconciliations(): readonly EntitlementReconciliationRecord[] {
    return [...this.entitlementReconciliations];
  }

  // ==========================================================================
  // IDEMPOTENCY
  // ==========================================================================

  public static saveIdempotency(key: string, value: any): void {
    this.idempotencyRecords.set(key, value);
  }

  public static getIdempotency<T>(key: string): T | undefined {
    return this.idempotencyRecords.get(key) as T | undefined;
  }

  // ==========================================================================
  // RESET / CLEAR
  // ==========================================================================

  public static reset(): void {
    this.plans.clear();
    this.planVersions.clear();
    this.planPrices.clear();
    this.entitlementDefinitions.clear();
    this.entitlementDefinitionsByCode.clear();
    this.entitlementBundles.clear();
    this.subscriptions.clear();
    this.subscriptionsByOwner.clear();
    this.statusHistories = [];
    this.billingAgreements.clear();
    this.invoices.clear();
    this.grants.clear();
    this.grantsBySubject.clear();
    this.usages.clear();
    this.supportGrants.clear();
    this.processedWebhookEventIds.clear();
    this.webhookEvents = [];
    this.providerReconciliations = [];
    this.entitlementReconciliations = [];
    this.idempotencyRecords.clear();
  }
}
