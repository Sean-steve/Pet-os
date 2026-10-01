import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  BatteryCharging,
  BatteryMedium,
  BatteryWarning,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Clock,
  FileText,
  Search,
  ChevronRight,
  ExternalLink,
  Shield,
  Activity,
  HardDrive,
} from 'lucide-react';
import { TrackerSubscriptionStore } from '../pet-os/tracker-service/store';
import { TrackerSubscriptionService } from '../pet-os/tracker-service/service';
import { DeviceEntitlementService } from '../pet-os/tracker-service/device-entitlement-service';
import { CarrierProviderRegistry } from '../pet-os/tracker-service/carrier-provider';
import { TrackerSubscriptionTestSuite, TestResult } from '../pet-os/tracker-service/tests';
import { TrackingStore } from '../pet-os/tracking/store';
import { PetStore } from '../pet-os/pet-core/store';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import { TRACKING_SEED_IDS } from '../pet-os/tracking/seed';
import { TRACKER_SEED_IDS, seedTrackerSubscriptionData } from '../pet-os/tracker-service/seed';
import {
  DeviceId,
  TrackerSubscriptionId,
  TrackerPlanPriceId,
  asDeviceId,
  asIncidentId,
  generateUUIDv7,
} from '../pet-os/kernel/ids';
import {
  DeviceHolisticStatusProjection,
  TrackerServicePlan,
  TrackerPlanPrice,
} from '../pet-os/tracker-service/types';

export const Sprint25TrackerSubscriptionConsole: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'fleet' | 'plans' | 'safety' | 'transfer' | 'webhooks' | 'tests'>('fleet');
  const [projections, setProjections] = useState<DeviceHolisticStatusProjection[]>([]);
  const [plans, setPlans] = useState<TrackerServicePlan[]>([]);
  const [prices, setPrices] = useState<TrackerPlanPrice[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; action: string; details: any }>>([]);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Test suite state
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  } | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Hardware transfer modal / form
  const [transferSourceSubId, setTransferSourceSubId] = useState<string>('');
  const [transferTargetDeviceId, setTransferTargetDeviceId] = useState<string>('');
  const [transferReason, setTransferReason] = useState<'WARRANTY_REPLACEMENT' | 'UPGRADE_NEW_HARDWARE' | 'LOST_DEVICE_REPLACEMENT'>('WARRANTY_REPLACEMENT');

  // Load / refresh data
  const refreshData = () => {
    const trackerStore = TrackerSubscriptionStore.getInstance();
    const trackingStore = TrackingStore.getInstance();

    const devices = trackingStore.listDevices();
    const projList = devices.map(d => TrackerSubscriptionService.getHolisticDeviceProjection(d.deviceId));
    setProjections(projList);

    setPlans(trackerStore.getAllPlans());
    const allPrices: TrackerPlanPrice[] = [];
    trackerStore.getAllPlans().forEach(p => {
      allPrices.push(...trackerStore.getPricesForPlan(p.id));
    });
    setPrices(allPrices);
    setAuditLogs(trackerStore.getAuditLog(20));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const showBanner = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Actions
  const handleRenewSuccess = async (subId: TrackerSubscriptionId) => {
    const res = await TrackerSubscriptionService.renewSubscription(subId, true);
    if (res.success) {
      showBanner(`Successfully renewed subscription ${subId}. Current period extended.`);
    }
    refreshData();
  };

  const handleSimulatePaymentFailure = async (subId: TrackerSubscriptionId) => {
    const res = await TrackerSubscriptionService.renewSubscription(subId, false);
    showBanner(`Simulated payment failure. Subscription is now: ${res.subscription.status}`);
    refreshData();
  };

  const handleReactivate = async (subId: TrackerSubscriptionId) => {
    await TrackerSubscriptionService.reactivateSubscription(subId);
    showBanner(`Subscription ${subId} reactivated. Carrier SIM uplink restored.`);
    refreshData();
  };

  const handleToggleSafetyOverride = async (deviceId: DeviceId, petId?: string) => {
    const trackerStore = TrackerSubscriptionStore.getInstance();
    const activeOverride = trackerStore.getActiveSafetyOverride(deviceId);

    if (activeOverride) {
      await TrackerSubscriptionService.deactivateSafetyOverride(activeOverride.id);
      showBanner('Emergency Lost Pet Safety Override deactivated. Returned to standard subscription profile.');
    } else {
      const incidentId = asIncidentId(`inc-${generateUUIDv7().slice(0, 10)}`);
      await TrackerSubscriptionService.activateLostPetSafetyOverride({
        deviceId,
        petId: (petId as any) || CANONICAL_IDS.PET_KIBO,
        incidentId,
        reason: 'Simulated field emergency: Pet breached primary safe zone boundary',
        durationHours: 72,
      });
      showBanner('CRITICAL SAFETY OVERRIDE ACTIVE: Emergency cellular uplink guaranteed for 72 hours!');
    }
    refreshData();
  };

  const handleExecuteTransfer = async () => {
    if (!transferSourceSubId || !transferTargetDeviceId) {
      showBanner('Please select both source subscription and target replacement device.');
      return;
    }

    try {
      const { transferRecord } = await TrackerSubscriptionService.transferDeviceHardware({
        subscriptionId: transferSourceSubId as TrackerSubscriptionId,
        targetDeviceId: asDeviceId(transferTargetDeviceId),
        userId: CANONICAL_IDS.OWNER_ELENA,
        reason: transferReason,
        notes: 'Transferred via Sprint 25 Hardware Lifecycle Console',
      });
      showBanner(`Hardware transfer complete! Preserved ${transferRecord.remainingPeriodDaysPreserved} days.`);
      setTransferSourceSubId('');
      setTransferTargetDeviceId('');
      refreshData();
    } catch (err: any) {
      showBanner(`Transfer failed: ${err.message}`);
    }
  };

  const handleSimulateCarrierOutage = async (deviceId: DeviceId) => {
    const trackerStore = TrackerSubscriptionStore.getInstance();
    const carrier = trackerStore.getCarrierRecordForDevice(deviceId);
    if (!carrier) return;

    const adapter = CarrierProviderRegistry.getAdapter(carrier.carrierVendor);
    if (carrier.carrierOutageReported) {
      await adapter.simulateAttachState(carrier.id, 'ATTACHED');
      showBanner(`Carrier outage resolved for ${carrier.carrierVendor}. Network attach restored.`);
    } else {
      await adapter.simulateAttachState(carrier.id, 'CARRIER_OUTAGE');
      showBanner(`Simulated upstream carrier cell outage for ${carrier.carrierVendor}. Billing is unaffected.`);
    }
    refreshData();
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    const results = await TrackerSubscriptionTestSuite.runAllTests();
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
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center justify-between animate-fade-in text-sm font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400/60 hover:text-emerald-400">
            &times;
          </button>
        </div>
      )}

      {/* Header & Architectural Pillars */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2">
                  Sprint 25: Tracker Connectivity &amp; Device Service Plans
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    Production Control Plane
                  </span>
                </h1>
                <p className="text-xs text-[#94A3B8]">
                  Device-Backed Commercial Contracts · Cellular/eSIM Lifecycle · Holistic Diagnostics · Lost Pet Safety Overrides
                </p>
              </div>
            </div>

            {/* Core Architectural Invariant Badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Physical Device Owns Subscription (Not Pet)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Billing Status ≠ Physical Connectivity ≠ Battery</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Emergency Lost-Mode Safety Fallback (72h)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#1E293B]/70 text-[#CBD5E1] border border-[#334155]/60">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Hardware Replacement Preserves Billing Period</span>
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Active Trackers</div>
              <div className="text-lg font-black text-cyan-400 mt-0.5">
                {projections.filter(p => p.billingStatus === 'ACTIVE').length}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Cellular Online</div>
              <div className="text-lg font-black text-emerald-400 mt-0.5">
                {projections.filter(p => p.carrierNetworkAttach === 'ATTACHED').length}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Safety Overrides</div>
              <div className="text-lg font-black text-amber-400 mt-0.5">
                {projections.filter(p => p.safetyOverrideActive).length}
              </div>
            </div>
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Data Metered</div>
              <div className="text-lg font-black text-indigo-400 mt-0.5">
                {projections.reduce((sum, p) => sum + p.dataUsageMbCurrentCycle, 0).toFixed(1)} MB
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-[#1E293B] mt-6 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('fleet')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'fleet'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Device Fleet &amp; Diagnostic Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('plans')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'plans'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plan Catalogue &amp; Bundling</span>
          </button>

          <button
            onClick={() => setActiveSubTab('safety')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'safety'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Lost Pet Safety Fallback</span>
          </button>

          <button
            onClick={() => setActiveSubTab('transfer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'transfer'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Hardware Replacement Flow</span>
          </button>

          <button
            onClick={() => setActiveSubTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'webhooks'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Carrier &amp; Billing Webhooks</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'tests'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Automated Test Runner (22 Tests)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: FLEET & DIAGNOSTIC MATRIX */}
      {activeSubTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Household Tracker Fleet &amp; Diagnostic Synthesis</h2>
              <p className="text-xs text-[#64748B]">
                Juxtaposition of commercial subscription, physical hardware battery, carrier attach, and active entitlement grants.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Projection</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projections.map(proj => (
              <div
                key={proj.deviceId}
                className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 shadow-lg relative flex flex-col justify-between"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1E293B]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F8FAFC] text-sm">{proj.displayName}</span>
                        <span className="text-[10px] font-mono text-[#64748B]">{proj.serialNumberMasked}</span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">
                        Model: <span className="text-[#E2E8F0] font-medium">{proj.model}</span>
                        {proj.assignedPetName && (
                          <>
                            {' · '}Assigned to: <span className="text-amber-400 font-bold">{proj.assignedPetName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Primary Status Chip */}
                    {proj.safetyOverrideActive ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        SAFETY OVERRIDE
                      </span>
                    ) : proj.primaryBlocker === 'DEAD_BATTERY' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                        <BatteryWarning className="w-3 h-3" />
                        CRITICAL BATTERY
                      </span>
                    ) : proj.primaryBlocker === 'CARRIER_OUTAGE' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        CARRIER OUTAGE
                      </span>
                    ) : proj.billingStatus === 'ACTIVE' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        ACTIVE &amp; ONLINE
                      </span>
                    ) : proj.billingStatus === 'GRACE_PERIOD' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        GRACE PERIOD
                      </span>
                    ) : proj.billingStatus === 'SUSPENDED' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        BILLING SUSPENDED
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
                        {proj.billingStatus}
                      </span>
                    )}
                  </div>

                  {/* 3 Pillars Matrix: Billing vs RF vs Battery */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-[11px]">
                    {/* 1. Commercial / Billing */}
                    <div className="bg-[#0B0D10] p-2.5 rounded-xl border border-[#1E293B]">
                      <div className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-cyan-400" />
                        <span>SUBSCRIPTION</span>
                      </div>
                      <div className="font-semibold text-[#F1F5F9] mt-1 truncate">
                        {proj.planName || 'No Active Plan'}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Status: <span className="font-mono text-[#CBD5E1]">{proj.billingStatus}</span>
                      </div>
                    </div>

                    {/* 2. Physical Battery */}
                    <div className="bg-[#0B0D10] p-2.5 rounded-xl border border-[#1E293B]">
                      <div className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                        <BatteryMedium className="w-3 h-3 text-emerald-400" />
                        <span>BATTERY</span>
                      </div>
                      <div className="font-semibold text-[#F1F5F9] mt-1">
                        {proj.batteryPercent !== undefined ? `${proj.batteryPercent}%` : 'N/A'}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Health: <span className="font-mono text-[#CBD5E1]">{proj.batteryStatus}</span>
                      </div>
                    </div>

                    {/* 3. Carrier SIM / Attach */}
                    <div className="bg-[#0B0D10] p-2.5 rounded-xl border border-[#1E293B]">
                      <div className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-indigo-400" />
                        <span>CARRIER RF</span>
                      </div>
                      <div className="font-semibold text-[#F1F5F9] mt-1 truncate">
                        {proj.carrierVendor || 'None'}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Attach: <span className="font-mono text-[#CBD5E1]">{proj.carrierNetworkAttach}</span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Summary Note */}
                  <div className="mt-3 bg-[#1E293B]/40 border border-[#334155]/40 rounded-xl p-2.5 text-xs text-[#CBD5E1] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>{proj.diagnosticSummary}</span>
                  </div>

                  {/* Entitlements Checklist */}
                  <div className="mt-4 pt-3 border-t border-[#1E293B]">
                    <div className="text-[10px] uppercase font-bold text-[#64748B] mb-2">Device Entitlement Grants</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        {proj.cellularAllowed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className={proj.cellularAllowed ? 'text-[#E2E8F0]' : 'text-[#64748B]'}>
                          Cellular Network Attach
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {proj.telemetryUploadAllowed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className={proj.telemetryUploadAllowed ? 'text-[#E2E8F0]' : 'text-[#64748B]'}>
                          GPS Telemetry Uplink
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {proj.liveTrackingAllowed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className={proj.liveTrackingAllowed ? 'text-[#E2E8F0]' : 'text-[#64748B]'}>
                          5-Second Live Pin
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {proj.safetyOverrideActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 font-bold" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="text-[#E2E8F0]">
                          Emergency SOS / Lost Mode
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cellular Data Usage Metering */}
                  {proj.dataLimitMbCurrentCycle > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#1E293B]">
                      <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
                        <span>Data Allowance</span>
                        <span className="font-mono text-[#CBD5E1]">
                          {proj.dataUsageMbCurrentCycle} MB / {proj.dataLimitMbCurrentCycle} MB
                        </span>
                      </div>
                      <div className="w-full bg-[#0B0D10] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (proj.dataUsageMbCurrentCycle / proj.dataLimitMbCurrentCycle) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Toolbar */}
                <div className="mt-5 pt-3 border-t border-[#1E293B] flex flex-wrap gap-2 justify-end">
                  {proj.subscriptionId && (
                    <>
                      <button
                        onClick={() => handleRenewSuccess(proj.subscriptionId!)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-cyan-400 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Renew</span>
                      </button>

                      <button
                        onClick={() => handleSimulatePaymentFailure(proj.subscriptionId!)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/40 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Fail Payment</span>
                      </button>

                      {proj.billingStatus === 'SUSPENDED' && (
                        <button
                          onClick={() => handleReactivate(proj.subscriptionId!)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 font-bold flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleToggleSafetyOverride(proj.deviceId, proj.assignedPetId)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                      proj.safetyOverrideActive
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-amber-950/30 text-amber-400 border border-amber-800/40 hover:bg-amber-900/40'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>{proj.safetyOverrideActive ? 'Deactivate Safety' : 'Declare Lost (Safety)'}</span>
                  </button>

                  <button
                    onClick={() => handleSimulateCarrierOutage(proj.deviceId)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8]"
                  >
                    {proj.carrierOutageActive ? 'Restore Cell' : 'Simulate Tower Outage'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PLANS CATALOGUE & BUNDLING */}
      {activeSubTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Commercial Tracker Service Plans &amp; Bundles</h2>
              <p className="text-xs text-[#64748B]">
                Independent device connectivity contracts with Consumer Premium bundling discounts for multi-device households.
              </p>
            </div>

            {/* Interval Toggle */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-1 flex items-center self-start sm:self-auto">
              <button
                onClick={() => setBillingInterval('MONTHLY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  billingInterval === 'MONTHLY' ? 'bg-cyan-500 text-slate-950' : 'text-[#94A3B8]'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('ANNUAL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  billingInterval === 'ANNUAL' ? 'bg-cyan-500 text-slate-950' : 'text-[#94A3B8]'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">Save ~18%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => {
              const matchingPrice = prices.find(
                pr => pr.planId === plan.id && pr.interval === billingInterval
              );

              return (
                <div
                  key={plan.id}
                  className={`bg-[#13151A] border rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden ${
                    plan.tier === 'PREMIUM_LIVE'
                      ? 'border-cyan-500/50 ring-1 ring-cyan-500/20'
                      : 'border-[#1E293B]'
                  }`}
                >
                  {plan.tier === 'PREMIUM_LIVE' && (
                    <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{plan.tier}</div>
                    <h3 className="text-lg font-bold text-[#F8FAFC] mt-1">{plan.name}</h3>
                    <p className="text-xs text-[#94A3B8] mt-1.5 min-h-[36px]">{plan.description}</p>

                    {/* Price display */}
                    <div className="mt-5 pb-5 border-b border-[#1E293B]">
                      {matchingPrice && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-[#F8FAFC]">
                            ${(matchingPrice.amountCents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-[#64748B]">/{billingInterval.toLowerCase()}</span>

                          {matchingPrice.bundledDiscountCents && (
                            <span className="ml-auto text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              Bundle: ${( (matchingPrice.amountCents - matchingPrice.bundledDiscountCents) / 100 ).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] text-[#64748B] mt-1">
                        Includes {plan.cellularDataAllowanceMbPerMonth} MB cellular telemetry / mo
                      </div>
                    </div>

                    {/* Feature list */}
                    <ul className="mt-5 space-y-2.5 text-xs text-[#CBD5E1]">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#1E293B]">
                    <div className="text-[11px] text-[#64748B] mb-2 flex items-center justify-between">
                      <span>Default Carrier:</span>
                      <span className="font-mono text-[#CBD5E1] font-semibold">{plan.carrierVendorDefault}</span>
                    </div>
                    <button
                      onClick={() => {
                        showBanner(`Plan ${plan.name} selected. Assignable to any unclaimed hardware.`);
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-cyan-500 hover:text-slate-950 text-[#F8FAFC] transition-all cursor-pointer"
                    >
                      Configure for Device
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LOST PET SAFETY FALLBACK */}
      {activeSubTab === 'safety' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-950/30 via-[#13151A] to-[#13151A] border border-amber-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-400">
                  Critical Safety Invariant: Emergency Lost-Pet Fallback
                </h2>
                <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                  Under canonical Pet OS safety principles, an active Lost Pet recovery incident MUST NEVER have its cellular tracking uplink terminated due to billing retries, expired credit cards, or administrative disputes. Even when a device subscription is <span className="font-mono text-red-400 font-bold">SUSPENDED</span>, declaring a Lost Pet incident activates a temporary 72-hour emergency cellular override window.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-[#F8FAFC] mb-4">Emergency Safety Uplink Simulator</h3>
            <div className="space-y-4">
              {projections.map(proj => (
                <div
                  key={proj.deviceId}
                  className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#F8FAFC] text-sm">{proj.displayName}</span>
                      <span className="text-xs text-amber-400">({proj.assignedPetName || 'Unassigned'})</span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      Current Billing Status: <span className="font-mono text-[#CBD5E1] font-semibold">{proj.billingStatus}</span>
                      {' · '}
                      Cellular Uplink Allowed:{' '}
                      <span className={proj.cellularAllowed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {proj.cellularAllowed ? 'YES' : 'DENIED (BILLING)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {proj.safetyOverrideActive ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                        UPLINK FORCED ACTIVE
                      </span>
                    ) : (
                      <span className="text-xs text-[#64748B]">Normal Safety Policy</span>
                    )}

                    <button
                      onClick={() => handleToggleSafetyOverride(proj.deviceId, proj.assignedPetId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        proj.safetyOverrideActive
                          ? 'bg-red-500 hover:bg-red-400 text-slate-950'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                      }`}
                    >
                      {proj.safetyOverrideActive ? 'Resolve Incident' : 'Trigger Lost Pet Safety'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HARDWARE REPLACEMENT FLOW */}
      {activeSubTab === 'transfer' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">Hardware Replacement &amp; Subscription Migration</h2>
                <p className="text-xs text-[#94A3B8]">
                  Transfer a device-backed commercial connectivity subscription from damaged or retired hardware to a replacement tracker without losing remaining billing days or corrupting historical spatial routes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    1. Source Subscription (Current Hardware)
                  </label>
                  <select
                    value={transferSourceSubId}
                    onChange={e => setTransferSourceSubId(e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select source device subscription...</option>
                    {projections
                      .filter(p => p.subscriptionId)
                      .map(p => (
                        <option key={p.subscriptionId} value={p.subscriptionId}>
                          {p.displayName} ({p.serialNumberMasked}) — {p.planName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                    2. Target Replacement Hardware Device
                  </label>
                  <select
                    value={transferTargetDeviceId}
                    onChange={e => setTransferTargetDeviceId(e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Select available target hardware...</option>
                    {projections
                      .filter(p => !p.subscriptionId || p.billingStatus === 'INCOMPLETE')
                      .map(p => (
                        <option key={p.deviceId} value={p.deviceId}>
                          {p.displayName} ({p.serialNumberMasked})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">3. Transfer Reason</label>
                  <select
                    value={transferReason}
                    onChange={e => setTransferReason(e.target.value as any)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F8FAFC] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="WARRANTY_REPLACEMENT">Warranty Hardware Replacement</option>
                    <option value="UPGRADE_NEW_HARDWARE">Hardware Upgrade (New Model)</option>
                    <option value="LOST_DEVICE_REPLACEMENT">Lost Physical Tracker Replacement</option>
                  </select>
                </div>

                <button
                  onClick={handleExecuteTransfer}
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/20"
                >
                  Execute Hardware Subscription Transfer
                </button>
              </div>

              {/* Invariant Explanation Panel */}
              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-5 text-xs text-[#94A3B8] space-y-3">
                <div className="font-bold text-[#F8FAFC] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Guaranteed Transfer Invariants</span>
                </div>
                <p>
                  • <strong className="text-[#CBD5E1]">Remaining Period Preserved:</strong> If 210 days remain in the annual plan, all 210 days immediately apply to the new hardware.
                </p>
                <p>
                  • <strong className="text-[#CBD5E1]">Telemetry Immutability:</strong> Historical GPS breadcrumbs for walks completed on the old tracker remain permanently bound to the old DeviceId in Tracking. No retroactive data mutation occurs.
                </p>
                <p>
                  • <strong className="text-[#CBD5E1]">Old SIM Deprovisioned:</strong> The carrier SIM profile for the decommissioned device is suspended to prevent unauthorized cellular roaming or data theft.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: WEBHOOKS & AUDIT LOG */}
      {activeSubTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#F8FAFC] mb-2">Carrier &amp; Billing Webhook Ingestion Engine</h2>
            <p className="text-xs text-[#94A3B8] mb-6">
              Simulate external billing gateway and cellular carrier webhooks with cryptographic HMAC signature verification and idempotency keys.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={async () => {
                  const sub = projections.find(p => p.subscriptionId)?.subscriptionId;
                  if (!sub) return;
                  await TrackerSubscriptionService.processBillingWebhook({
                    eventId: `evt-wh-${generateUUIDv7()}`,
                    eventType: 'tracker.invoice.payment_succeeded',
                    subscriptionId: sub,
                    deviceId: asDeviceId('dev-tractive-gps-001'),
                    amountCents: 1199,
                    currency: 'USD',
                    transactionRef: `tx-ext-${generateUUIDv7().slice(0, 8)}`,
                    timestamp: new Date().toISOString(),
                    signature: 'sha256=valid_hmac_signature',
                  });
                  showBanner('Dispatched payment_succeeded billing webhook');
                  refreshData();
                }}
                className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] hover:border-cyan-500/50 text-left transition-all"
              >
                <div className="text-xs font-bold text-cyan-400">Webhook: invoice.payment_succeeded</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">Simulates successful gateway renewal and period rollover.</div>
              </button>

              <button
                onClick={async () => {
                  const sub = projections.find(p => p.subscriptionId)?.subscriptionId;
                  if (!sub) return;
                  await TrackerSubscriptionService.processBillingWebhook({
                    eventId: `evt-wh-${generateUUIDv7()}`,
                    eventType: 'tracker.invoice.payment_failed',
                    subscriptionId: sub,
                    deviceId: asDeviceId('dev-tractive-gps-001'),
                    amountCents: 1199,
                    currency: 'USD',
                    transactionRef: `tx-ext-${generateUUIDv7().slice(0, 8)}`,
                    failureCode: 'insufficient_funds',
                    failureMessage: 'Card declined by issuing bank',
                    timestamp: new Date().toISOString(),
                    signature: 'sha256=valid_hmac_signature',
                  });
                  showBanner('Dispatched payment_failed billing webhook');
                  refreshData();
                }}
                className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] hover:border-amber-500/50 text-left transition-all"
              >
                <div className="text-xs font-bold text-amber-400">Webhook: invoice.payment_failed</div>
                <div className="text-[11px] text-[#94A3B8] mt-1">Simulates renewal failure and entry into 7-day grace period.</div>
              </button>
            </div>

            {/* Audit Stream */}
            <div className="mt-6 pt-6 border-t border-[#1E293B]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Live Domain Audit Stream</h3>
              <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 max-h-60 overflow-y-auto font-mono text-[11px] space-y-1.5">
                {auditLogs.map(log => (
                  <div key={log.id} className="text-[#94A3B8] flex items-start gap-2">
                    <span className="text-[#475569]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-cyan-400 font-bold">[{log.action}]</span>
                    <span className="text-[#CBD5E1] truncate">{JSON.stringify(log.details)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUTOMATED TESTS */}
      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">Automated Verification Suite</h2>
                <p className="text-xs text-[#94A3B8]">
                  22 exhaustive end-to-end tests validating lifecycle states, grace periods, Lost Mode safety overrides, hardware transfers, and security invariants.
                </p>
              </div>

              <button
                onClick={runAllTests}
                disabled={isRunningTests}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {isRunningTests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isRunningTests ? 'Executing Test Suite...' : 'Run All 22 Tests'}</span>
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
                    {['ALL', 'LIFECYCLE', 'ENTITLEMENTS', 'SAFETY', 'HARDWARE', 'BILLING', 'CARRIER'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          filterCategory === cat ? 'bg-cyan-500 text-slate-950' : 'text-[#64748B] hover:text-[#CBD5E1]'
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
                            <span className="font-mono text-[10px] text-cyan-400">{t.id}</span>
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
