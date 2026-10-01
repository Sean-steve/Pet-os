/**
 * Pet OS Sprint 10 - Provider Platform In-Memory Store
 * High-performance repository with indexed access and event pub/sub.
 */

import {
  UserId,
  ProviderId,
  BusinessId,
  BusinessMembershipId,
  CredentialId,
  VerificationCaseId,
  ServiceOfferingId,
  LocationId,
  ServiceAreaId,
  AvailabilityRuleId,
  AvailabilityExceptionId,
  TrustIndicatorId,
  ProviderReportId,
} from '../kernel/ids';
import {
  ProviderProfile,
  ServiceBusiness,
  BusinessMembership,
  ProviderCredential,
  VerificationCase,
  ServiceOffering,
  ProviderLocation,
  ServiceArea,
  ProviderAvailabilityRule,
  ProviderAvailabilityException,
  ProviderTrustIndicator,
  ProviderReport,
  ProviderCategory,
} from './types';
import { ProviderDomainEvent } from './events';

export class ProviderStore {
  private providers = new Map<ProviderId, ProviderProfile>();
  private providersByUser = new Map<UserId, ProviderId>();
  private businesses = new Map<BusinessId, ServiceBusiness>();
  private businessMemberships = new Map<BusinessMembershipId, BusinessMembership>();
  private credentials = new Map<CredentialId, ProviderCredential>();
  private verificationCases = new Map<VerificationCaseId, VerificationCase>();
  private serviceOfferings = new Map<ServiceOfferingId, ServiceOffering>();
  private locations = new Map<LocationId, ProviderLocation>();
  private serviceAreas = new Map<ServiceAreaId, ServiceArea>();
  private availabilityRules = new Map<AvailabilityRuleId, ProviderAvailabilityRule>();
  private availabilityExceptions = new Map<AvailabilityExceptionId, ProviderAvailabilityException>();
  private trustIndicators = new Map<TrustIndicatorId, ProviderTrustIndicator>();
  private reports = new Map<ProviderReportId, ProviderReport>();

  private eventListeners: Array<(event: ProviderDomainEvent) => void> = [];

  // Singleton instance
  private static instance: ProviderStore;

  static getInstance(): ProviderStore {
    if (!ProviderStore.instance) {
      ProviderStore.instance = new ProviderStore();
    }
    return ProviderStore.instance;
  }

  // --- Provider Profiles ---
  saveProvider(provider: ProviderProfile): void {
    this.providers.set(provider.providerId, { ...provider });
    this.providersByUser.set(provider.userId, provider.providerId);
  }

  getProvider(providerId: ProviderId): ProviderProfile | undefined {
    const p = this.providers.get(providerId);
    return p ? { ...p } : undefined;
  }

  findProviderById(providerId: ProviderId): ProviderProfile | undefined {
    return this.getProvider(providerId);
  }

  getProviderByUserId(userId: UserId): ProviderProfile | undefined {
    const id = this.providersByUser.get(userId);
    if (!id) return undefined;
    return this.getProvider(id);
  }

  listProviders(filter?: { category?: ProviderCategory; activeOnly?: boolean }): ProviderProfile[] {
    let result = Array.from(this.providers.values());
    if (filter?.category) {
      result = result.filter(p => p.category === filter.category);
    }
    if (filter?.activeOnly) {
      result = result.filter(p => p.operationalStatus === 'ACTIVE');
    }
    return result.map(p => ({ ...p }));
  }

  // --- Businesses ---
  saveBusiness(business: ServiceBusiness): void {
    this.businesses.set(business.businessId, { ...business });
  }

  getBusiness(businessId: BusinessId): ServiceBusiness | undefined {
    const b = this.businesses.get(businessId);
    return b ? { ...b } : undefined;
  }

  getBusinessById(businessId: BusinessId): ServiceBusiness | undefined {
    return this.getBusiness(businessId);
  }

  listBusinesses(): ServiceBusiness[] {
    return Array.from(this.businesses.values()).map(b => ({ ...b }));
  }

  // --- Business Memberships ---
  saveBusinessMembership(membership: BusinessMembership): void {
    this.businessMemberships.set(membership.membershipId, { ...membership });
  }

  saveMembership(membership: BusinessMembership): void {
    this.saveBusinessMembership(membership);
  }

  getBusinessMembership(id: BusinessMembershipId): BusinessMembership | undefined {
    const m = this.businessMemberships.get(id);
    return m ? { ...m } : undefined;
  }

  getBusinessMemberships(businessId: BusinessId): BusinessMembership[] {
    return Array.from(this.businessMemberships.values())
      .filter(m => m.businessId === businessId && m.isActive)
      .map(m => ({ ...m }));
  }

  listMembershipsByBusiness(businessId: BusinessId): BusinessMembership[] {
    return this.getBusinessMemberships(businessId);
  }

  getUserBusinessMemberships(userId: UserId): BusinessMembership[] {
    return Array.from(this.businessMemberships.values())
      .filter(m => m.userId === userId && m.isActive)
      .map(m => ({ ...m }));
  }

  // --- Credentials ---
  saveCredential(credential: ProviderCredential): void {
    this.credentials.set(credential.credentialId, { ...credential });
  }

  getCredential(id: CredentialId): ProviderCredential | undefined {
    const c = this.credentials.get(id);
    return c ? { ...c } : undefined;
  }

  getCredentialsForProvider(providerId: ProviderId): ProviderCredential[] {
    return Array.from(this.credentials.values())
      .filter(c => c.providerId === providerId)
      .map(c => ({ ...c }));
  }

  getCredentialsForBusiness(businessId: BusinessId): ProviderCredential[] {
    return Array.from(this.credentials.values())
      .filter(c => c.businessId === businessId)
      .map(c => ({ ...c }));
  }

  // --- Verification Cases ---
  saveVerificationCase(caseRecord: VerificationCase): void {
    this.verificationCases.set(caseRecord.caseId, { ...caseRecord });
  }

  getVerificationCase(caseId: VerificationCaseId): VerificationCase | undefined {
    const v = this.verificationCases.get(caseId);
    return v ? { ...v } : undefined;
  }

  listVerificationCases(filter?: { status?: string }): VerificationCase[] {
    let result = Array.from(this.verificationCases.values());
    if (filter?.status) {
      result = result.filter(c => c.status === filter.status);
    }
    return result.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(c => ({ ...c }));
  }

  getVerificationCasesForProvider(providerId: ProviderId): VerificationCase[] {
    return Array.from(this.verificationCases.values())
      .filter(c => c.providerId === providerId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(c => ({ ...c }));
  }

  // --- Service Offerings ---
  saveServiceOffering(offering: ServiceOffering): void {
    this.serviceOfferings.set(offering.serviceOfferingId, { ...offering });
  }

  getServiceOffering(id: ServiceOfferingId): ServiceOffering | undefined {
    const o = this.serviceOfferings.get(id);
    return o ? { ...o } : undefined;
  }

  getServiceOfferingsForProvider(providerId: ProviderId): ServiceOffering[] {
    return Array.from(this.serviceOfferings.values())
      .filter(o => o.providerId === providerId)
      .map(o => ({ ...o }));
  }

  listActiveOfferings(): ServiceOffering[] {
    return Array.from(this.serviceOfferings.values())
      .filter(o => o.status === 'ACTIVE')
      .map(o => ({ ...o }));
  }

  // --- Locations ---
  saveLocation(loc: ProviderLocation): void {
    this.locations.set(loc.locationId, { ...loc });
  }

  getLocation(locationId: LocationId): ProviderLocation | undefined {
    const l = this.locations.get(locationId);
    return l ? { ...l } : undefined;
  }

  getLocationsForProvider(providerId: ProviderId): ProviderLocation[] {
    return Array.from(this.locations.values())
      .filter(l => l.providerId === providerId)
      .map(l => ({ ...l }));
  }

  getLocationsForBusiness(businessId: BusinessId): ProviderLocation[] {
    return Array.from(this.locations.values())
      .filter(l => l.businessId === businessId)
      .map(l => ({ ...l }));
  }

  listLocationsByBusiness(businessId: BusinessId): ProviderLocation[] {
    return this.getLocationsForBusiness(businessId);
  }

  // --- Service Areas ---
  saveServiceArea(area: ServiceArea): void {
    this.serviceAreas.set(area.serviceAreaId, { ...area });
  }

  getServiceAreasForProvider(providerId: ProviderId): ServiceArea[] {
    return Array.from(this.serviceAreas.values())
      .filter(a => a.providerId === providerId && a.isActive)
      .map(a => ({ ...a }));
  }

  // --- Availability Rules ---
  saveAvailabilityRule(rule: ProviderAvailabilityRule): void {
    this.availabilityRules.set(rule.ruleId, { ...rule });
  }

  getAvailabilityRulesForProvider(providerId: ProviderId): ProviderAvailabilityRule[] {
    return Array.from(this.availabilityRules.values())
      .filter(r => r.providerId === providerId && r.isActive)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      .map(r => ({ ...r }));
  }

  deleteAvailabilityRule(ruleId: AvailabilityRuleId): void {
    this.availabilityRules.delete(ruleId);
  }

  // --- Availability Exceptions ---
  saveAvailabilityException(exception: ProviderAvailabilityException): void {
    this.availabilityExceptions.set(exception.exceptionId, { ...exception });
  }

  getAvailabilityExceptionsForProvider(providerId: ProviderId): ProviderAvailabilityException[] {
    return Array.from(this.availabilityExceptions.values())
      .filter(e => e.providerId === providerId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map(e => ({ ...e }));
  }

  // --- Trust Indicators ---
  saveTrustIndicator(indicator: ProviderTrustIndicator): void {
    this.trustIndicators.set(indicator.indicatorId, { ...indicator });
  }

  getTrustIndicatorsForProvider(providerId: ProviderId): ProviderTrustIndicator[] {
    return Array.from(this.trustIndicators.values())
      .filter(t => t.providerId === providerId && t.isValid)
      .map(t => ({ ...t }));
  }

  // --- Reports ---
  saveReport(report: ProviderReport): void {
    this.reports.set(report.reportId, { ...report });
  }

  getReport(reportId: ProviderReportId): ProviderReport | undefined {
    const r = this.reports.get(reportId);
    return r ? { ...r } : undefined;
  }

  getReportsForProvider(providerId: ProviderId): ProviderReport[] {
    return Array.from(this.reports.values())
      .filter(r => r.targetProviderId === providerId)
      .map(r => ({ ...r }));
  }

  listReports(status?: string): ProviderReport[] {
    let list = Array.from(this.reports.values());
    if (status) {
      list = list.filter(r => r.status === status);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => ({ ...r }));
  }

  // --- Event Pub/Sub ---
  publish(event: ProviderDomainEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in provider event listener:', err);
      }
    }
  }

  subscribe(listener: (event: ProviderDomainEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  // --- Teardown for Tests ---
  reset(): void {
    this.providers.clear();
    this.providersByUser.clear();
    this.businesses.clear();
    this.businessMemberships.clear();
    this.credentials.clear();
    this.verificationCases.clear();
    this.serviceOfferings.clear();
    this.locations.clear();
    this.serviceAreas.clear();
    this.availabilityRules.clear();
    this.availabilityExceptions.clear();
    this.trustIndicators.clear();
    this.reports.clear();
    this.eventListeners = [];
  }
}
