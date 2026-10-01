import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Users,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Layers,
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRightLeft,
  Building2,
  FileText,
  Activity,
  Award,
  Star,
  Search,
  Lock,
  Calendar,
  BarChart3,
  HelpCircle,
} from 'lucide-react';
import { ProviderSaaSStore } from '../pet-os/provider-saas/store';
import { ProviderSaaSService } from '../pet-os/provider-saas/service';
import { ProviderSaaSContinuityEngine } from '../pet-os/provider-saas/continuity-engine';
import { ProviderSaaSTestSuite, TestResult } from '../pet-os/provider-saas/tests';
import { ProviderStore } from '../pet-os/provider/store';
import { SEED_BUSINESSES, SEED_USERS } from '../pet-os/provider/seed';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import {
  BusinessId,
  ProviderSaaSSubscriptionId,
  ProviderSaaSPriceId,
  asBusinessMembershipId,
  asUserId,
  generateUUIDv7,
} from '../pet-os/kernel/ids';
import {
  ProviderSaaSPlan,
  ProviderSaaSPrice,
  ProviderSaaSReadModel,
  StaffSeatUsageProjection,
  LocationUsageProjection,
  DowngradeImpactPreview,
} from '../pet-os/provider-saas/types';

export const Sprint26ProviderSaaSConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'businesses' | 'seats' | 'locations' | 'plans' | 'safety' | 'webhooks' | 'tests'>('businesses');
  const [readModels, setReadModels] = useState<ProviderSaaSReadModel[]>([]);
  const [plans, setPlans] = useState<ProviderSaaSPlan[]>([]);
  const [prices, setPrices] = useState<ProviderSaaSPrice[]>([]);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [selectedBizId, setSelectedBizId] = useState<BusinessId>(SEED_BUSINESSES.NAIROBI_WEST_VET);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; action: string; details: any }>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Downgrade preview modal
  const [previewData, setPreviewData] = useState<DowngradeImpactPreview | null>(null);

  // Tests
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  } | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const refreshData = () => {
    const saasStore = ProviderSaaSStore.getInstance();
    const providerStore = ProviderStore.getInstance();

    const businesses = providerStore.listBusinesses();
    const models = businesses.map(b => ProviderSaaSService.getBusinessSaaSReadModel(b.businessId, b.ownerUserId));
    setReadModels(models);

    setPlans(saasStore.listPlans());
    setPrices(saasStore.listAllPrices());
    setAuditLogs(saasStore.getAuditLogs(20));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showBanner = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Actions
  const handleRenewSuccess = async (subId: ProviderSaaSSubscriptionId) => {
    const res = await ProviderSaaSService.renewSubscription(subId, true);
    if (res.success) {
      showBanner(`Successfully renewed subscription ${subId}. Current period extended.`);
    }
    refreshData();
  };

  const handleSimulatePaymentFailure = async (subId: ProviderSaaSSubscriptionId) => {
    const res = await ProviderSaaSService.renewSubscription(subId, false);
    showBanner(`Simulated payment failure. Subscription status is now: ${res.subscription.status}`);
    refreshData();
  };

  const handleReactivate = async (subId: ProviderSaaSSubscriptionId, ownerId: any) => {
    await ProviderSaaSService.reactivateSubscription(subId, ownerId);
    showBanner(`Subscription ${subId} reactivated by billing owner.`);
    refreshData();
  };

  const handleOpenDowngradePreview = (subId: ProviderSaaSSubscriptionId, targetPriceId: ProviderSaaSPriceId) => {
    try {
      const preview = ProviderSaaSService.previewPlanChange(subId, targetPriceId);
      setPreviewData(preview);
    } catch (err: any) {
      showBanner(`Preview failed: ${err.message}`);
    }
  };

  const handleExecutePlanChange = async (subId: ProviderSaaSSubscriptionId, targetPriceId: ProviderSaaSPriceId, ownerId: any) => {
    try {
      await ProviderSaaSService.changePlan(subId, targetPriceId, ownerId);
      setPreviewData(null);
      showBanner('Plan change executed! Invariant guaranteed: ZERO staff or locations deleted.');
      refreshData();
    } catch (err: any) {
      showBanner(`Plan change failed: ${err.message}`);
    }
  };

  const handleSimulateAddStaff = (bizId: BusinessId) => {
    const check = ProviderSaaSService.canAddStaffMember(bizId);
    if (!check.allowed) {
      showBanner(`DENIED: ${check.reason}`);
      return;
    }

    const providerStore = ProviderStore.getInstance();
    const newCount = providerStore.listMembershipsByBusiness(bizId).length + 1;
    providerStore.saveMembership({
      membershipId: asBusinessMembershipId(`mem-ui-staff-${generateUUIDv7().slice(0, 8)}`),
      businessId: bizId,
      userId: asUserId(`usr-staff-${newCount}`),
      role: 'STAFF',
      isActive: true,
      canManageServices: false,
      canManageSchedule: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    showBanner(`Staff member added successfully! Seat consumed.`);
    refreshData();
  };

  const handleToggleBoardingShield = (bizId: BusinessId) => {
    const saasStore = ProviderSaaSStore.getInstance();
    const activeGrants = saasStore.getActiveContinuityGrantsForBusiness(bizId);
    const existing = activeGrants.find(g => g.serviceType === 'BOARDING_STAY');

    if (existing) {
      ProviderSaaSContinuityEngine.resolveContinuityGrant(existing.contextId, 'Boarding stay safely completed.');
      showBanner('Active custody returned to owner. Continuity shield safely concluded.');
    } else {
      ProviderSaaSContinuityEngine.ensureContinuityGrant({
        businessId: bizId,
        serviceType: 'BOARDING_STAY',
        contextId: `boarding-demo-${generateUUIDv7().slice(0, 8)}`,
        petId: CANONICAL_IDS.PET_SIMBA,
        reason: 'Simba checked into facility; animal custody shield guaranteed.',
        durationHours: 72,
      });
      showBanner('ANIMAL SAFETY SHIELD ENGAGED: Active custody workflows protected against subscription expiration!');
    }
    refreshData();
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    const results = await ProviderSaaSTestSuite.runAllTests();
    setTestResults(results);
    setIsRunningTests(false);
    refreshData();
  };

  const filteredTests = testResults?.results.filter(
    r => filterCategory === 'ALL' || r.category === filterCategory
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {statusMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400/60 hover:text-emerald-400 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Header & Architectural Invariants */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2">
                  Sprint 26: Provider Business SaaS &amp; Professional Subscriptions
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                    Operations Control Plane
                  </span>
                </h1>
                <p className="text-xs text-[#94A3B8]">
                  Professional SaaS Monetization · Staff Seat Limits · Multi-Location Entitlements · Animal Care Continuity Shield
                </p>
              </div>
            </div>

            {/* Invariant Badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verification &amp; Credentials Isolated (Cannot Buy Verification)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Reputation &amp; Reviews Untainted by Subscription State</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Animal Safety: Custody Continuity Guaranteed</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zero Destructive Staff/Location Deletion on Downgrade</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Subscribed Businesses</div>
              <div className="text-lg font-black text-indigo-400 mt-0.5">
                {readModels.filter(m => m.billingStatus === 'ACTIVE').length}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Staff Seats Active</div>
              <div className="text-lg font-black text-cyan-400 mt-0.5">
                {readModels.reduce((acc, m) => acc + m.seatsUsed, 0)}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Active Locations</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {readModels.reduce((acc, m) => acc + m.locationsUsed, 0)}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Continuity Shields</div>
              <div className="text-lg font-black text-rose-400 mt-0.5">
                {readModels.reduce((acc, m) => acc + m.activeContinuityGrantsCount, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-[#1E293B] mt-6 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('businesses')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'businesses'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Business Fleet &amp; SaaS Subscriptions</span>
          </button>

          <button
            onClick={() => setActiveTab('seats')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'seats'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Seat Capacity Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('locations')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Multi-Location Entitlements</span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plan Catalogue &amp; Pricing</span>
          </button>

          <button
            onClick={() => setActiveTab('safety')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Animal Care Continuity Shield</span>
          </button>

          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'webhooks'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Webhooks &amp; Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Automated Test Runner (26 Tests)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BUSINESS FLEET & SUBSCRIPTION READ MODELS */}
      {activeTab === 'businesses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Service Business SaaS Subscriptions</h2>
              <p className="text-xs text-[#64748B]">
                Authoritative SaaS contracts granting software capabilities without altering marketplace verification or reputation.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {readModels.map(rm => (
              <div
                key={rm.businessId}
                className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
                    <div>
                      <h3 className="font-bold text-[#F8FAFC] text-sm">{rm.businessName}</h3>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">ID: {rm.businessId}</div>
                    </div>

                    {/* Status badge */}
                    {rm.activeContinuityGrantsCount > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        CONTINUITY SHIELD
                      </span>
                    ) : rm.billingStatus === 'ACTIVE' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        ACTIVE
                      </span>
                    ) : rm.billingStatus === 'GRACE_PERIOD' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        GRACE PERIOD
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {rm.billingStatus}
                      </span>
                    )}
                  </div>

                  {/* Plan details */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">SaaS Tier:</span>
                      <span className="font-bold text-indigo-400">{rm.planName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Staff Capacity:</span>
                      <span className={`font-mono font-semibold ${rm.isSeatOverLimit ? 'text-amber-400 font-bold' : 'text-[#E2E8F0]'}`}>
                        {rm.seatsUsed} / {rm.seatLimit} seats {rm.isSeatOverLimit && '(Over-Limit)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Locations:</span>
                      <span className="font-mono text-[#E2E8F0] font-semibold">
                        {rm.locationsUsed} / {rm.locationLimit}
                      </span>
                    </div>

                    {rm.currentPeriodEnd && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Current Period End:</span>
                        <span className="font-mono text-[#94A3B8]">
                          {new Date(rm.currentPeriodEnd).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Diagnostic / Operational status note */}
                  <div className="mt-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-[11px] text-[#CBD5E1] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{rm.operationalSummary}</span>
                  </div>

                  {/* Entitlement Badges */}
                  <div className="mt-4 pt-3 border-t border-[#1E293B]">
                    <div className="text-[10px] uppercase font-bold text-[#64748B] mb-1.5">Active Software Features</div>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {rm.activeEntitlements.map(e => (
                        <span key={e} className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[#CBD5E1] font-mono">
                          {e.replace('provider.', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-3 border-t border-[#1E293B] flex flex-wrap gap-2 justify-end">
                  {rm.subscriptionId && (
                    <>
                      <button
                        onClick={() => handleRenewSuccess(rm.subscriptionId!)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-cyan-400 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Renew</span>
                      </button>

                      <button
                        onClick={() => handleSimulatePaymentFailure(rm.subscriptionId!)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40 flex items-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Fail Payment</span>
                      </button>

                      {rm.billingStatus === 'RESTRICTED' && (
                        <button
                          onClick={() => handleReactivate(rm.subscriptionId!, rm.billingOwnerUserId)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleToggleBoardingShield(rm.businessId)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>{rm.activeContinuityGrantsCount > 0 ? 'End Custody Shield' : 'Simulate Care Shield'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: STAFF SEAT CAPACITY ENGINE */}
      {activeTab === 'seats' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#F8FAFC] mb-2">Staff Seat Allocation &amp; Atomic Limit Engine</h2>
            <p className="text-xs text-[#94A3B8] mb-6">
              Seats are consumed strictly by active business memberships in the canonical Provider Platform. Downgrading to a plan with fewer seats enters a grandfathered state and NEVER deletes employees!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {readModels.map(rm => (
                <div key={rm.businessId} className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
                    <span className="font-bold text-[#F8FAFC] text-sm">{rm.businessName}</span>
                    <span className="text-[10px] text-indigo-400 font-bold">{rm.planName}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-xs text-[#94A3B8]">
                      <span>Seat Utilization</span>
                      <span className="font-mono text-[#CBD5E1]">
                        {rm.seatsUsed} / {rm.seatLimit} seats
                      </span>
                    </div>

                    <div className="w-full bg-[#1E293B] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          rm.isSeatOverLimit ? 'bg-amber-400' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${Math.min(100, (rm.seatsUsed / rm.seatLimit) * 100)}%` }}
                      ></div>
                    </div>

                    {rm.isSeatOverLimit ? (
                      <div className="text-[11px] text-amber-400 bg-amber-950/20 border border-amber-800/40 p-2.5 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>Grandfathered Over-Limit:</strong> Existing staff remain active. You cannot invite new staff until within limit.
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{rm.seatLimit - rm.seatsUsed} seat(s) available for new staff invites.</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-[#1E293B] flex gap-2">
                      <button
                        onClick={() => handleSimulateAddStaff(rm.businessId)}
                        className="w-full py-2 rounded-lg text-xs font-bold bg-[#1E293B] hover:bg-cyan-500 hover:text-slate-950 text-[#CBD5E1] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Add Staff Member</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-LOCATION ENTITLEMENTS */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#F8FAFC] mb-2">Multi-Location Entitlement &amp; Branch Capacity</h2>
            <p className="text-xs text-[#94A3B8] mb-6">
              Branch locations are derived from Sprint 10 Provider Platform. Business Plus unlocks up to 5 multi-branch facilities.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {readModels.map(rm => (
                <div key={rm.businessId} className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
                    <span className="font-bold text-[#F8FAFC] text-sm">{rm.businessName}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">{rm.planName}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between text-xs text-[#94A3B8]">
                      <span>Branch Facilities</span>
                      <span className="font-mono text-[#CBD5E1]">
                        {rm.locationsUsed} / {rm.locationLimit} active
                      </span>
                    </div>

                    <div className="w-full bg-[#1E293B] rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (rm.locationsUsed / rm.locationLimit) * 100)}%` }}
                      ></div>
                    </div>

                    <div className="text-[11px] text-[#CBD5E1] bg-[#1E293B]/40 p-2.5 rounded-lg flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        {rm.locationsUsed > 1
                          ? `Multi-branch facility active across ${rm.locationsUsed} regional hubs.`
                          : 'Single location commercial facility.'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLAN CATALOGUE & PRICING */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Provider SaaS Plan Catalogue</h2>
              <p className="text-xs text-[#64748B]">
                Tailored for independent practitioners, pet businesses, and multi-location hospital networks.
              </p>
            </div>

            {/* Interval Toggle */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-1 flex items-center self-start sm:self-auto">
              <button
                onClick={() => setBillingInterval('MONTHLY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  billingInterval === 'MONTHLY' ? 'bg-indigo-500 text-slate-950' : 'text-[#94A3B8]'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('ANNUAL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  billingInterval === 'ANNUAL' ? 'bg-indigo-500 text-slate-950' : 'text-[#94A3B8]'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">Save ~17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {plans.map(plan => {
              const price = prices.find(
                p => p.planId === plan.planId && (plan.tier === 'FREE' || p.billingInterval === billingInterval)
              );

              return (
                <div
                  key={plan.planId}
                  className={`bg-[#13151A] border rounded-2xl p-5 shadow-xl flex flex-col justify-between ${
                    plan.tier === 'BUSINESS'
                      ? 'border-indigo-500/50 ring-1 ring-indigo-500/30'
                      : 'border-[#1E293B]'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{plan.tier}</span>
                    <h3 className="text-base font-bold text-[#F8FAFC] mt-1">{plan.displayName}</h3>
                    <p className="text-xs text-[#94A3B8] mt-1.5 min-h-[36px]">{plan.description}</p>

                    <div className="mt-4 pb-4 border-b border-[#1E293B]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-[#F8FAFC]">
                          ${price ? (price.amountMinor / 100).toFixed(2) : '0.00'}
                        </span>
                        <span className="text-xs text-[#64748B]">/{billingInterval.toLowerCase()}</span>
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-1">
                        {plan.includedStaffSeats} staff seat(s) · {plan.includedLocations} location(s)
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 text-xs text-[#CBD5E1]">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-3 border-t border-[#1E293B]">
                    <button
                      onClick={() => {
                        const targetSub = readModels.find(m => m.businessId === selectedBizId)?.subscriptionId;
                        if (targetSub && price) {
                          handleOpenDowngradePreview(targetSub, price.priceId);
                        } else {
                          showBanner(`Selected plan ${plan.displayName}`);
                        }
                      }}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-indigo-500 hover:text-slate-950 text-[#F8FAFC] transition-all cursor-pointer"
                    >
                      Change Nairobi Vet to This Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Downgrade Preview Modal */}
          {previewData && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
                  <h3 className="font-bold text-[#F8FAFC] text-sm flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                    <span>Plan Change Impact Preview</span>
                  </h3>
                  <button onClick={() => setPreviewData(null)} className="text-[#64748B] hover:text-[#CBD5E1] cursor-pointer">
                    &times;
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Target Plan:</span>
                      <span className="font-bold text-indigo-400">{previewData.targetPlanName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Effective Date:</span>
                      <span className="font-mono text-[#CBD5E1]">
                        {new Date(previewData.effectiveDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {previewData.isStaffOverLimit && (
                    <div className="bg-amber-950/30 border border-amber-800/40 p-3 rounded-xl text-amber-300">
                      <strong>Seat Limit Warning:</strong> {previewData.staffOverLimitWarning}
                    </div>
                  )}

                  {previewData.featuresLost.length > 0 && (
                    <div>
                      <span className="font-bold text-[#64748B]">Features lost on downgrade:</span>
                      <ul className="mt-1 space-y-1 text-[#94A3B8]">
                        {previewData.featuresLost.map((f, idx) => (
                          <li key={idx}>• {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-[#1E293B]/40 p-3 rounded-xl border border-[#334155]/40 text-[#CBD5E1] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Animal Safety Invariant: Active service execution remains 100% protected.</span>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setPreviewData(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const sub = readModels.find(m => m.businessId === selectedBizId)?.subscriptionId;
                      const pr = prices.find(p => p.planId === plans.find(pl => pl.displayName === previewData.targetPlanName)?.planId);
                      if (sub && pr) {
                        handleExecutePlanChange(sub, pr.priceId, SEED_USERS.VET_DR_KIMANI);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-slate-950 cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    Confirm Plan Change
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANIMAL CARE CONTINUITY SHIELD */}
      {activeTab === 'safety' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-rose-950/30 via-[#13151A] to-[#13151A] border border-rose-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-rose-400">
                  Critical Safety Invariant: Animal Care &amp; Custody Continuity Shield
                </h2>
                <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                  Under Pet OS safety principles, if a business SaaS subscription enters <span className="font-mono text-red-400 font-bold">PAST_DUE</span> or <span className="font-mono text-red-400 font-bold">RESTRICTED</span> mode while an animal is currently boarding, being walked, undergoing surgery, or in transit, the system <strong className="text-rose-400">NEVER blocks active care</strong>. A scoped continuity grant preserves medication logs, emergency escalation, and handover workflows until the pet is safely returned.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-[#F8FAFC] mb-4">Active Custody &amp; Care Continuity Simulator</h3>
            <div className="space-y-4">
              {readModels.map(rm => (
                <div
                  key={rm.businessId}
                  className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#F8FAFC] text-sm">{rm.businessName}</span>
                      <span className="text-xs text-indigo-400 font-mono">({rm.billingStatus})</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      Active Continuity Grants: <span className="font-bold text-rose-400">{rm.activeContinuityGrantsCount}</span>
                      {' · '}
                      Animal Safety Status:{' '}
                      <span className="text-emerald-400 font-semibold">100% Guaranteed Protected</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {rm.activeContinuityGrantsCount > 0 ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                        SHIELD ENGAGED
                      </span>
                    ) : (
                      <span className="text-xs text-[#64748B]">No Active Custody Stays</span>
                    )}

                    <button
                      onClick={() => handleToggleBoardingShield(rm.businessId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        rm.activeContinuityGrantsCount > 0
                          ? 'bg-rose-500 hover:bg-rose-400 text-slate-950'
                          : 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-md shadow-indigo-500/20'
                      }`}
                    >
                      {rm.activeContinuityGrantsCount > 0 ? 'Conclude Custody' : 'Simulate Active Boarding'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: WEBHOOKS & AUDIT LOGS */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#F8FAFC] mb-2">Billing Gateway Ingestion &amp; Idempotency Sandbox</h2>
            <p className="text-xs text-[#94A3B8] mb-6">
              Simulate recurring billing webhooks with HMAC signature validation and nonce replay prevention.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={async () => {
                  const subId = readModels[0]?.subscriptionId;
                  if (!subId) return;
                  await ProviderSaaSService.processBillingWebhook({
                    eventId: `evt-wh-saas-${generateUUIDv7()}`,
                    eventType: 'provider_saas.invoice.payment_succeeded',
                    subscriptionId: subId,
                    businessId: readModels[0].businessId,
                    amountMinor: 14900,
                    currency: 'USD',
                    transactionRef: `tx-ext-${generateUUIDv7().slice(0, 8)}`,
                    timestamp: new Date().toISOString(),
                    signature: 'sha256=hmac_verified_token_991',
                  });
                  showBanner('Dispatched payment_succeeded webhook');
                  refreshData();
                }}
                className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] hover:border-indigo-500/50 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-indigo-400">Webhook: invoice.payment_succeeded</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">Advances billing period and clears consecutive failure counters.</div>
              </button>

              <button
                onClick={async () => {
                  const subId = readModels[0]?.subscriptionId;
                  if (!subId) return;
                  await ProviderSaaSService.processBillingWebhook({
                    eventId: `evt-wh-saas-${generateUUIDv7()}`,
                    eventType: 'provider_saas.invoice.payment_failed',
                    subscriptionId: subId,
                    businessId: readModels[0].businessId,
                    amountMinor: 14900,
                    currency: 'USD',
                    transactionRef: `tx-ext-${generateUUIDv7().slice(0, 8)}`,
                    failureCode: 'insufficient_funds',
                    failureMessage: 'Card declined by issuing bank',
                    timestamp: new Date().toISOString(),
                    signature: 'sha256=hmac_verified_token_991',
                  });
                  showBanner('Dispatched payment_failed webhook');
                  refreshData();
                }}
                className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] hover:border-amber-500/50 text-left transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-amber-400">Webhook: invoice.payment_failed</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">Transitions to 7-day grace period with active service continuity intact.</div>
              </button>
            </div>

            {/* Audit log stream */}
            <div className="mt-6 pt-6 border-t border-[#1E293B]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Live Domain Audit Stream</h3>
              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 max-h-60 overflow-y-auto font-mono text-[11px] space-y-1.5">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-[#94A3B8] flex items-start gap-2">
                    <span className="text-[#475569]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-indigo-400 font-bold">[{log.action}]</span>
                    <span className="text-[#CBD5E1] truncate">{JSON.stringify(log.details)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AUTOMATED TESTS */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">Automated Verification Suite</h2>
                <p className="text-xs text-[#94A3B8]">
                  26 exhaustive end-to-end tests validating lifecycle states, staff seat limits, over-limit preservation, active service continuity, verification separation, and discovery neutrality.
                </p>
              </div>

              <button
                onClick={runAllTests}
                disabled={isRunningTests}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {isRunningTests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isRunningTests ? 'Executing Test Suite...' : 'Run All 26 Tests'}</span>
              </button>
            </div>

            {testResults && (
              <div className="mt-6 pt-6 border-t border-[#1E293B]">
                {/* Stats */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-semibold text-[#CBD5E1]">
                    Passed: <strong className="text-emerald-400">{testResults.passed}</strong> / {testResults.total}
                  </span>
                  {testResults.failed > 0 && (
                    <span className="text-xs font-semibold text-red-400">
                      Failed: <strong>{testResults.failed}</strong>
                    </span>
                  )}

                  {/* Filter */}
                  <div className="ml-auto flex items-center gap-1">
                    {['ALL', 'LIFECYCLE', 'SAFETY', 'SEATS', 'LOCATIONS', 'AUTHORIZATION', 'SEPARATION', 'BILLING'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                          filterCategory === cat ? 'bg-indigo-500 text-slate-950' : 'text-[#64748B] hover:text-[#CBD5E1]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Results list */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredTests?.map(t => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        t.passed
                          ? 'bg-emerald-950/10 border-emerald-500/20 text-[#CBD5E1]'
                          : 'bg-red-950/20 border-red-500/30 text-red-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {t.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            <span className="font-mono text-[10px] text-indigo-400">{t.id}</span>
                            <span>{t.name}</span>
                          </div>
                          {!t.passed && <div className="text-[11px] text-red-400 mt-0.5">{t.message}</div>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-[#64748B]">{t.category}</span>
                        <span className="text-[10px] font-mono text-[#64748B]">{t.durationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
