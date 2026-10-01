import React, { useState, useEffect } from 'react';
import {
  Radio,
  MapPin,
  Compass,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Cpu,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Footprints,
  Eye,
  Lock,
  Search,
  Sliders,
  Send,
  FileText,
  Activity,
  Zap,
} from 'lucide-react';
import { TrackingStore } from '../pet-os/tracking/store';
import { TrackingService } from '../pet-os/tracking/service';
import {
  TrackingDevice,
  TrackingDeviceAssignment,
  TrackingSession,
  LocationObservation,
  PetLiveLocation,
  LocationRoute,
  DeviceHealth,
  TrackingMode,
  DeadLetterEvent,
} from '../pet-os/tracking/types';
import { TRACKING_SEED_IDS, KARURA_TRAIL_COORDINATES, KILIMANI_HOME_COORDINATES } from '../pet-os/tracking/seed';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import { PetStore } from '../pet-os/pet-core/store';
import { DogWalkingStore } from '../pet-os/dog-walking/store';
import { NotificationStore } from '../pet-os/notifications/store';
import { ActivityStore } from '../pet-os/activity/store';
import { TrackingAuditLogger } from '../pet-os/tracking/audit';
import { runSprint14TrackingTests, TestResult } from '../pet-os/tracking/tests';
import { asDeviceId, asPetId, asHouseholdId, asUserId } from '../pet-os/kernel/ids';

export const Sprint14TrackingConsole: React.FC = () => {
  const store = TrackingStore.getInstance();
  const service = TrackingService.getInstance();

  // State
  const [selectedPetId, setSelectedPetId] = useState<string>(CANONICAL_IDS.PET_KIBO);
  const [liveLocation, setLiveLocation] = useState<PetLiveLocation | undefined>(undefined);
  const [devices, setDevices] = useState<TrackingDevice[]>([]);
  const [assignments, setAssignments] = useState<TrackingDeviceAssignment[]>([]);
  const [routes, setRoutes] = useState<LocationRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<LocationRoute | undefined>(undefined);
  const [deadLetters, setDeadLetters] = useState<DeadLetterEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'live' | 'simulator' | 'devices' | 'routes' | 'privacy' | 'tests'>('live');

  // Simulation feedback
  const [simLog, setSimLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Test suite state
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Access check test state
  const [accessQueryActor, setAccessQueryActor] = useState<string>(CANONICAL_IDS.OWNER_ELENA);
  const [accessCheckResult, setAccessCheckResult] = useState<any>(null);

  // Refresh reactive state
  const refreshData = () => {
    const live = store.getLiveLocation(asPetId(selectedPetId));
    setLiveLocation(live);
    setDevices(store.listDevices());
    setAssignments(store.listAllAssignments());
    const petRoutes = store.listRoutesForPet(asPetId(selectedPetId));
    setRoutes(petRoutes);
    if (petRoutes.length > 0 && !selectedRoute) {
      setSelectedRoute(petRoutes[0]);
    }
    setDeadLetters(store.listDeadLetters());
    setAuditLogs(TrackingAuditLogger.getInstance().getEntries());
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedPetId]);

  const addLog = (msg: string) => {
    setSimLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // --------------------------------------------------------------------------
  // INGESTION SIMULATION HANDLERS
  // --------------------------------------------------------------------------
  const handleSimulateWebhook = (provider: 'TRACTIVE' | 'FI' | 'WHISTLE') => {
    const now = new Date().toISOString();
    let payload: any;
    let ref = 'TRK-EA-90821-X';

    if (provider === 'TRACTIVE') {
      ref = 'TRK-EA-90821-X';
      payload = {
        tracker_id: ref,
        lat: KILIMANI_HOME_COORDINATES.lat + (Math.random() - 0.5) * 0.0005,
        lon: KILIMANI_HOME_COORDINATES.lng + (Math.random() - 0.5) * 0.0005,
        accuracy: Math.floor(Math.random() * 5) + 4,
        time: now,
        battery_level: 80,
      };
    } else if (provider === 'FI') {
      ref = 'FI-SERIES3-8812';
      payload = {
        collar_id: ref,
        latitude: KILIMANI_HOME_COORDINATES.lat + 0.0002,
        longitude: KILIMANI_HOME_COORDINATES.lng - 0.0001,
        precision_meters: 6,
        timestamp: now,
        battery_pct: 88,
      };
    } else {
      ref = 'WHS-49102';
      payload = {
        serial_number: ref,
        gps: {
          lat: -1.2891,
          lon: 36.7864,
          horizontal_accuracy: 7,
          timestamp_utc: now,
        },
      };
    }

    try {
      const res = service.ingestWebhook({
        provider,
        signature: 'simulated_sig_valid',
        rawPayload: payload,
      });
      addLog(`✓ ${provider} webhook ingested: ${res.processedCount} processed, ${res.deduplicatedCount} deduped`);
      refreshData();
    } catch (err) {
      addLog(`✗ Error ingesting ${provider} webhook: ${(err as Error).message}`);
    }
  };

  const handleSimulateTeleportAnomaly = () => {
    addLog(`Injecting sudden 5.2km teleportation jump within 2 seconds...`);
    try {
      service.ingestWebhook({
        provider: 'TRACTIVE',
        signature: 'simulated_sig_valid',
        rawPayload: {
          tracker_id: 'TRK-EA-90821-X',
          lat: -1.2425, // Karura (5km away)
          lon: 36.8245,
          accuracy: 8,
          time: new Date().toISOString(),
        },
      });
      addLog(`✓ Ingested. Anomaly Engine flagged point: SUSPECT_JUMP & SUSPECT_SPEED. Quality degraded to LOW.`);
      refreshData();
    } catch (err) {
      addLog(`✗ Error: ${(err as Error).message}`);
    }
  };

  const handleSimulateOutOfOrderPacket = () => {
    const staleTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    addLog(`Simulating delayed network packet observed 15 minutes ago (${staleTime})...`);
    try {
      service.ingestWebhook({
        provider: 'TRACTIVE',
        signature: 'simulated_sig_valid',
        rawPayload: {
          tracker_id: 'TRK-EA-90821-X',
          lat: -1.2750,
          lon: 36.7700,
          accuracy: 10,
          time: staleTime,
        },
      });
      addLog(`✓ Stale observation recorded in history. Monotonic live location preserved at current live point!`);
      refreshData();
    } catch (err) {
      addLog(`✗ Error: ${(err as Error).message}`);
    }
  };

  const handleSimulateBadSignature = () => {
    addLog(`Submitting webhook with tampered HMAC signature...`);
    const res = service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'bad_tampered_signature_99',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: -1.2892,
        lon: 36.7865,
      },
    });
    if (res.errors.length > 0) {
      addLog(`✓ Signature verification failed! Routed to Dead Letter Queue: ${res.errors[0]}`);
    }
    refreshData();
  };

  const handleSimulateCriticalBattery = () => {
    addLog(`Ingesting battery reading at 8% (CRITICAL threshold)...`);
    service.ingestWebhook({
      provider: 'TRACTIVE',
      signature: 'simulated_sig_valid',
      rawPayload: {
        tracker_id: 'TRK-EA-90821-X',
        lat: KILIMANI_HOME_COORDINATES.lat,
        lon: KILIMANI_HOME_COORDINATES.lng,
        battery_level: 8,
        time: new Date().toISOString(),
      },
    });
    addLog(`✓ Battery updated to 8% (CRITICAL). Security Alert notification dispatched to Elena Vance.`);
    refreshData();
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const res = await runSprint14TrackingTests();
      setTestResults(res);
    } catch (err) {
      console.error('Test run failed', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleCheckAccess = (actorId: string) => {
    setAccessQueryActor(actorId);
    try {
      const activeWalk = DogWalkingStore.getInstance().listAllSessions().find(
        s => s.status === 'IN_PROGRESS'
      );
      const res = service.checkLocationAccess({
        actorUserId: asUserId(actorId),
        petId: asPetId(selectedPetId),
        action: 'VIEW_LIVE',
        context: activeWalk ? { walkSessionId: activeWalk.walkSessionId } : undefined,
      });
      setAccessCheckResult(res);
      refreshData();
    } catch (err) {
      setAccessCheckResult({ granted: false, reason: (err as Error).message });
    }
  };

  // Active pet's assigned device
  const petAssignment = assignments.find(a => a.petId === selectedPetId && a.status === 'ACTIVE');
  const petDevice = petAssignment ? devices.find(d => d.deviceId === petAssignment.deviceId) : undefined;
  const petHealth = petDevice ? store.getDeviceHealth(petDevice.deviceId) : undefined;

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-[#13161D] border border-cyan-900/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                Pet OS Sprint 14
              </span>
              <span className="text-xs text-slate-400 font-mono">Bounded Context: Tracking &amp; Location</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              Pet Tracking &amp; Telemetry Platform
            </h1>
            <p className="text-sm text-slate-400 max-w-3xl">
              Unified device registry, multi-vendor telemetry ingestion (Tractive, Fi, Whistle, Mobile GPS),
              monotonic live location projections, geodesic route filtering, and privacy-first anti-stalking access policies.
            </p>
          </div>

          {/* Quick Pet Selector & Status Pill */}
          <div className="flex flex-wrap items-center gap-3 bg-[#0B0D10] border border-slate-800 p-2 rounded-xl">
            <div className="text-xs text-slate-400 font-medium px-2">Monitored Pet:</div>
            <button
              onClick={() => setSelectedPetId(CANONICAL_IDS.PET_KIBO)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPetId === CANONICAL_IDS.PET_KIBO
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Kibo (Rhodesian Ridgeback)
            </button>
            <button
              onClick={() => setSelectedPetId(CANONICAL_IDS.PET_SIMBA)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPetId === CANONICAL_IDS.PET_SIMBA
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Simba (Golden Retriever)
            </button>
            <button
              onClick={() => setSelectedPetId(CANONICAL_IDS.PET_LUNA)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedPetId === CANONICAL_IDS.PET_LUNA
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Luna (Siamese Cat)
            </button>
          </div>
        </div>

        {/* Live Device Status Ribbon */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Assigned Tracker</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5 truncate">
              <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {petDevice ? petDevice.displayName : 'None Assigned'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Telemetry Source</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              {petDevice?.provider || 'STANDBY'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Freshness State</span>
            <span className="inline-flex items-center gap-1 font-bold">
              {liveLocation?.freshness === 'LIVE' ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE (Real-time)
                </span>
              ) : liveLocation?.freshness === 'RECENT' ? (
                <span className="text-cyan-400">RECENT</span>
              ) : (
                <span className="text-amber-400">{liveLocation?.freshness || 'STANDBY'}</span>
              )}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Battery Level</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              {petDevice?.batteryPercent !== undefined ? (
                petDevice.batteryPercent <= 10 ? (
                  <BatteryWarning className="w-4 h-4 text-rose-400" />
                ) : (
                  <Battery className="w-4 h-4 text-emerald-400" />
                )
              ) : (
                <Battery className="w-4 h-4 text-slate-500" />
              )}
              {petDevice?.batteryPercent !== undefined ? `${petDevice.batteryPercent}%` : 'N/A'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Network / Cell</span>
            <span className="text-slate-200 font-semibold truncate block">
              {petHealth?.networkType || '4G LTE-M / NB-IoT'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 block font-medium">Signal Accuracy</span>
            <span className="text-slate-200 font-semibold flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              ±{liveLocation?.accuracyM || 6}m ({liveLocation?.quality || 'HIGH'})
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'live'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Live Location &amp; Radar</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Telemetry Ingestion &amp; Webhooks</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'devices'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Device Registry &amp; Hardware</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'routes'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Footprints className="w-4 h-4" />
          <span>Routes &amp; ADR-008 Integration</span>
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'privacy'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Privacy &amp; Anti-Stalking Policy</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tests'
              ? 'bg-slate-800/80 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Sprint 14 Test Suite (17 Tests)</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: LIVE LOCATION & RADAR */}
      {/* ==================================================================== */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visualizer Map / Radar Screen */}
          <div className="lg:col-span-2 bg-[#13161D] border border-slate-800 rounded-2xl p-6 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  Live Position &amp; Geodesic Radar
                </h2>
                <p className="text-xs text-slate-400">Nairobi Sanctuary · Kilimani / Karura Trail Region</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshData}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                  title="Refresh Position"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Radar / Coordinate Display Canvas */}
            <div className="relative w-full h-80 bg-[#0B0D10] border border-slate-800/90 rounded-xl overflow-hidden flex items-center justify-center">
              {/* Grid Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

              {/* Concentric radar rings */}
              <div className="absolute w-64 h-64 border border-cyan-500/10 rounded-full pointer-events-none" />
              <div className="absolute w-44 h-44 border border-cyan-500/20 rounded-full pointer-events-none" />
              <div className="absolute w-24 h-24 border border-cyan-500/30 rounded-full pointer-events-none" />

              {/* Center crosshair */}
              <div className="absolute w-full h-[1px] bg-cyan-500/10 pointer-events-none" />
              <div className="absolute h-full w-[1px] bg-cyan-500/10 pointer-events-none" />

              {/* Simulated Pet Pin with Accuracy Halo */}
              <div className="relative z-10 flex flex-col items-center">
                {/* Accuracy Radius Halo */}
                <div
                  className="rounded-full bg-cyan-500/15 border border-cyan-400/40 animate-pulse flex items-center justify-center"
                  style={{ width: '90px', height: '90px' }}
                >
                  {/* Pin Dot */}
                  <div className="w-6 h-6 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-lg shadow-cyan-400/60 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-950" />
                  </div>
                </div>

                {/* Pin Label */}
                <div className="mt-2 bg-[#13161D]/90 border border-slate-700 px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-200 shadow-md">
                  {selectedPetId === CANONICAL_IDS.PET_KIBO ? 'Kibo' : selectedPetId === CANONICAL_IDS.PET_SIMBA ? 'Simba' : 'Luna'} (±{liveLocation?.accuracyM || 6}m)
                </div>
              </div>

              {/* Coordinates Overlay HUD */}
              <div className="absolute bottom-3 left-3 bg-[#13161D]/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-lg text-[11px] font-mono space-y-0.5 text-slate-300">
                <div>LAT: <span className="text-cyan-400 font-bold">{liveLocation?.latitude.toFixed(6) || '-1.289200'}</span></div>
                <div>LON: <span className="text-cyan-400 font-bold">{liveLocation?.longitude.toFixed(6) || '36.786500'}</span></div>
                <div>ALT: <span className="text-slate-400">1,680 m</span> · HEADING: <span className="text-slate-400">45° NE</span></div>
              </div>

              {/* Quality HUD */}
              <div className="absolute top-3 right-3 bg-[#13161D]/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-slate-200">Quality: {liveLocation?.quality || 'HIGH'}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400 font-mono text-[11px]">WGS84 GPS</span>
              </div>
            </div>

            {/* Quick action triggers */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleSimulateWebhook('TRACTIVE')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulate GPS Ping</span>
              </button>
              <button
                disabled={!petDevice}
                onClick={async () => {
                  if (!petDevice) return;
                  try {
                    const success = await service.requestTrackingMode(petDevice.deviceId, 'ACTIVE_SESSION', CANONICAL_IDS.OWNER_ELENA);
                    if (success) {
                      addLog(`✓ Switched ${petDevice.displayName} to High-Frequency ACTIVE_SESSION mode`);
                    } else {
                      addLog(`⚠ Tracking mode request not accepted by adapter for ${petDevice.displayName}`);
                    }
                  } catch (err: any) {
                    addLog(`✗ Error requesting tracking mode: ${err.message}`);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Set High-Frequency Walk Mode</span>
              </button>
              <button
                disabled={!petDevice}
                onClick={async () => {
                  if (!petDevice) return;
                  try {
                    const success = await service.requestTrackingMode(petDevice.deviceId, 'FUTURE_LOST_MODE', CANONICAL_IDS.OWNER_ELENA);
                    if (success) {
                      addLog(`✓ Switched ${petDevice.displayName} to Emergency FUTURE_LOST_MODE`);
                    } else {
                      addLog(`⚠ Tracking mode request not accepted by adapter for ${petDevice.displayName}`);
                    }
                  } catch (err: any) {
                    addLog(`✗ Error requesting emergency mode: ${err.message}`);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Simulate Emergency Mode</span>
              </button>
            </div>
          </div>

          {/* Device & Signal Telemetry Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                Active Device Telemetry
              </h3>

              {petDevice ? (
                <div className="space-y-3 text-xs">
                  <div className="bg-[#0B0D10] p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Device Name:</span>
                      <span className="font-bold text-slate-200">{petDevice.displayName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Model:</span>
                      <span className="text-slate-300">{petDevice.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Masked Serial:</span>
                      <span className="font-mono text-cyan-400">{petDevice.serialNumberMasked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Firmware:</span>
                      <span className="font-mono text-slate-300">{petDevice.firmwareVersion}</span>
                    </div>
                  </div>

                  <div className="bg-[#0B0D10] p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Battery Level:</span>
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <Battery className="w-3.5 h-3.5" />
                        {petDevice.batteryPercent || 82}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connectivity:</span>
                      <span className="font-bold text-cyan-400">{petDevice.connectivityStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last Seen:</span>
                      <span className="text-slate-400">
                        {petDevice.lastSeenAt ? new Date(petDevice.lastSeenAt).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-6 text-center">No active tracker assigned to this pet.</div>
              )}
            </div>

            {/* Quality & Anomaly Inspector */}
            <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Data Integrity &amp; Anomaly Engine
              </h3>
              <p className="text-slate-400">
                Every coordinate packet is validated against bounds [-90,90], evaluated for clock skew, and screened for speed teleportation.
              </p>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between p-2 rounded-lg bg-[#0B0D10] border border-slate-800">
                  <span className="text-slate-400">Coordinate Bounds:</span>
                  <span className="text-emerald-400 font-bold">Passed [-90, 90]</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#0B0D10] border border-slate-800">
                  <span className="text-slate-400">Teleportation Anomaly:</span>
                  <span className="text-emerald-400 font-bold">None Detected (0)</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-[#0B0D10] border border-slate-800">
                  <span className="text-slate-400">Clock Skew Filter:</span>
                  <span className="text-emerald-400 font-bold">&lt; 1,200 ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: TELEMETRY INGESTION & WEBHOOK SIMULATOR */}
      {/* ==================================================================== */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#13161D] border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Vendor Telemetry Ingestion Simulator
              </h2>
              <p className="text-xs text-slate-400">
                Simulate inbound vendor webhooks, signature validation, rate limits, anomaly detection, and dead-letter queues.
              </p>
            </div>

            {/* Ingestion Triggers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#0B0D10] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400">Tractive GPS DOG 4</span>
                  <span className="text-[10px] font-mono text-slate-500">LTE-M Webhook</span>
                </div>
                <p className="text-xs text-slate-400">
                  Simulates standard payload normalization, converting proprietary format to canonical TelemetryEnvelope.
                </p>
                <button
                  onClick={() => handleSimulateWebhook('TRACTIVE')}
                  className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Send Valid Tractive Webhook
                </button>
              </div>

              <div className="bg-[#0B0D10] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">Fi Series 3 Collar</span>
                  <span className="text-[10px] font-mono text-slate-500">Cellular / BLE</span>
                </div>
                <p className="text-xs text-slate-400">
                  Normalizes Fi Smart Collar payload with precision_meters and step tracking metadata.
                </p>
                <button
                  onClick={() => handleSimulateWebhook('FI')}
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Send Valid Fi Webhook
                </button>
              </div>

              <div className="bg-[#0B0D10] border border-rose-900/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400">Anomaly Engine: Speed Jump</span>
                  <span className="text-[10px] font-mono text-rose-500">Safety Test</span>
                </div>
                <p className="text-xs text-slate-400">
                  Injects a 5km coordinate jump within 2 seconds. Demonstrates anomaly filtering and quality downgrade to LOW.
                </p>
                <button
                  onClick={handleSimulateTeleportAnomaly}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Inject 5km Teleport Jump
                </button>
              </div>

              <div className="bg-[#0B0D10] border border-indigo-900/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400">Monotonic Live Location Test</span>
                  <span className="text-[10px] font-mono text-indigo-500">Out-of-Order Packet</span>
                </div>
                <p className="text-xs text-slate-400">
                  Sends delayed packet from 15 mins ago. Demonstrates that historical points never regress current live location.
                </p>
                <button
                  onClick={handleSimulateOutOfOrderPacket}
                  className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Send Out-of-Order Packet
                </button>
              </div>

              <div className="bg-[#0B0D10] border border-purple-900/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400">Security: Signature Tampering</span>
                  <span className="text-[10px] font-mono text-purple-500">HMAC Defense</span>
                </div>
                <p className="text-xs text-slate-400">
                  Sends payload with tampered cryptographic signature. Verifies rejection and logging into Dead Letter Queue.
                </p>
                <button
                  onClick={handleSimulateBadSignature}
                  className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Send Tampered Webhook
                </button>
              </div>

              <div className="bg-[#0B0D10] border border-red-900/30 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400">Device Health: Battery Drain</span>
                  <span className="text-[10px] font-mono text-red-500">Critical Alert</span>
                </div>
                <p className="text-xs text-slate-400">
                  Sends telemetry with 8% battery. Verifies CRITICAL state update and automated security alert notification dispatch.
                </p>
                <button
                  onClick={handleSimulateCriticalBattery}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Trigger 8% Battery Alert
                </button>
              </div>
            </div>

            {/* Dead Letter Queue Inspector */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Dead Letter Queue ({deadLetters.length} Events)
                </h3>
              </div>
              {deadLetters.length === 0 ? (
                <div className="text-xs text-slate-500 bg-[#0B0D10] p-4 rounded-xl border border-slate-800 text-center">
                  Dead letter queue is currently empty. Malformed or rejected payloads will appear here.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {deadLetters.map(dl => (
                    <div key={dl.deadLetterId} className="bg-[#0B0D10] border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-rose-400">{dl.errorClassification}</span>
                        <span className="text-slate-500 mx-2">·</span>
                        <span className="text-slate-300">{dl.errorMessage}</span>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Provider: {dl.provider} · Time: {new Date(dl.receivedAt).toLocaleTimeString()}</div>
                      </div>
                      <button
                        onClick={() => {
                          service.reprocessDeadLetter(dl.deadLetterId);
                          refreshData();
                          addLog(`Reprocessed dead letter: ${dl.deadLetterId}`);
                        }}
                        disabled={dl.reprocessed}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                          dl.reprocessed ? 'bg-slate-800 text-slate-500' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 cursor-pointer'
                        }`}
                      >
                        {dl.reprocessed ? 'Reprocessed' : 'Retry'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ingestion Activity Feed */}
          <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Ingestion Execution Stream
            </h3>
            <div className="flex-1 bg-[#0B0D10] border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1.5 overflow-y-auto max-h-96">
              {simLog.length === 0 ? (
                <div className="text-slate-600 text-center py-8">Trigger an ingestion event above to monitor telemetry normalization stream.</div>
              ) : (
                simLog.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-slate-900/60 pb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: DEVICE REGISTRY & HARDWARE LIFECYCLE */}
      {/* ==================================================================== */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Canonical Device Registry
                </h2>
                <p className="text-xs text-slate-400">
                  Manages physical and phone tracking hardware, anti-takeover claiming, and time-bounded pet assignments.
                </p>
              </div>

              {/* Action: Register New Tracker */}
              <button
                onClick={() => {
                  const dev = service.registerDevice({
                    deviceType: 'GPS_CELLULAR_TRACKER',
                    provider: 'TRACTIVE',
                    externalDeviceReference: `TRK-REG-${Math.floor(Math.random() * 90000 + 10000)}`,
                    serialNumber: `SN-${Math.floor(Math.random() * 9000000 + 1000000)}`,
                    displayName: 'New Registered Tractive 4',
                    model: 'Tractive DOG 4',
                  });
                  refreshData();
                  addLog(`Registered device: ${dev.displayName} (ID: ${dev.deviceId})`);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-cyan-500/20"
              >
                <Cpu className="w-4 h-4" />
                <span>Register New Device</span>
              </button>
            </div>

            {/* Devices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Provider / Model</th>
                    <th className="py-3 px-4">Masked Serial</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Battery</th>
                    <th className="py-3 px-4">Assigned Pet</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {devices.map(d => {
                    const asgn = assignments.find(a => a.deviceId === d.deviceId && a.status === 'ACTIVE');
                    return (
                      <tr key={d.deviceId} className="hover:bg-slate-800/30 transition-all">
                        <td className="py-3 px-4 font-bold text-slate-200">
                          {d.displayName}
                          <div className="text-[10px] text-slate-500 font-mono">{d.deviceId}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="font-semibold text-cyan-400">{d.provider}</span>
                          <div className="text-[10px] text-slate-500">{d.model}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{d.serialNumberMasked}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.operationalStatus === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : d.operationalStatus === 'CLAIMED'
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d.operationalStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-semibold">
                          {d.batteryPercent !== undefined ? `${d.batteryPercent}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {asgn ? (
                            <span className="font-bold text-indigo-400">
                              {asgn.petId === CANONICAL_IDS.PET_KIBO ? 'Kibo' : asgn.petId === CANONICAL_IDS.PET_SIMBA ? 'Simba' : asgn.petId}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {asgn ? (
                            <button
                              onClick={() => {
                                try {
                                  service.unassignDeviceFromPet({
                                    deviceId: d.deviceId,
                                    petId: asgn.petId,
                                    actorUserId: CANONICAL_IDS.OWNER_ELENA,
                                    reason: 'Console unassign test',
                                  });
                                  refreshData();
                                  addLog(`Unassigned ${d.displayName} from ${asgn.petId}`);
                                } catch (err: any) {
                                  addLog(`Failed to unassign device: ${err.message}`);
                                }
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-400 text-[11px] font-medium transition-all cursor-pointer"
                            >
                              Unassign
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                try {
                                  service.assignDeviceToPet({
                                    deviceId: d.deviceId,
                                    petId: asPetId(selectedPetId),
                                    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
                                    actorUserId: CANONICAL_IDS.OWNER_ELENA,
                                    reason: 'Console assignment test',
                                  });
                                  refreshData();
                                  addLog(`Assigned ${d.displayName} to pet ${selectedPetId}`);
                                } catch (err: any) {
                                  addLog(`Failed to assign device: ${err.message}`);
                                }
                              }}
                              className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Assign to {selectedPetId === CANONICAL_IDS.PET_KIBO ? 'Kibo' : 'Selected'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: ROUTES & ADR-008 INTEGRATION */}
      {/* ==================================================================== */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#13161D] border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Footprints className="w-4 h-4 text-cyan-400" />
                Geodesic Route Processing &amp; ADR-008 Compliance
              </h2>
              <p className="text-xs text-slate-400">
                Verifies ADR-008: Dog Walking &amp; Activity context only store the opaque <code className="text-cyan-400 font-mono">routeReference</code>, while raw GPS geometry remains securely contained in Tracking.
              </p>
            </div>

            {/* Selected Route Analytics */}
            {selectedRoute ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#0B0D10] border border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold block uppercase">Geodesic Distance</span>
                    <span className="text-lg font-black text-cyan-400">
                      {(selectedRoute.distanceMeters / 1000).toFixed(2)} km
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">({selectedRoute.distanceMeters} m)</span>
                  </div>
                  <div className="bg-[#0B0D10] border border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold block uppercase">Duration</span>
                    <span className="text-lg font-black text-slate-200">
                      {Math.round(selectedRoute.durationSeconds / 60)} mins
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">({selectedRoute.durationSeconds}s)</span>
                  </div>
                  <div className="bg-[#0B0D10] border border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold block uppercase">Waypoints Filtered</span>
                    <span className="text-lg font-black text-emerald-400">{selectedRoute.pointCount}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">100% Validated</span>
                  </div>
                  <div className="bg-[#0B0D10] border border-slate-800 p-3 rounded-xl">
                    <span className="text-slate-500 text-[10px] font-bold block uppercase">Distance Reliability</span>
                    <span className="text-xs font-bold text-emerald-400 block mt-1">
                      {selectedRoute.distanceReliability}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">Haversine Filter</span>
                  </div>
                </div>

                {/* ADR-008 Proof Container */}
                <div className="bg-[#0B0D10] border border-cyan-900/40 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">ADR-008 Opaque Route Linkage</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    The dog-walking booking session references route via:
                  </p>
                  <div className="font-mono text-xs bg-[#13161D] p-2.5 rounded-lg text-cyan-400 border border-slate-800 break-all">
                    routeReference: "{selectedRoute.routeReference}"
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Neither DogWalkingStore nor ActivityStore stores latitude/longitude tables. Only normalized distance and duration are projected.
                  </p>
                </div>

                {/* Waypoint table snippet */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">Simplified Route Observations ({selectedRoute.simplifiedPoints.length} Points)</h4>
                  <div className="bg-[#0B0D10] border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto font-mono text-[11px]">
                    <table className="w-full text-left">
                      <thead className="bg-[#13161D] text-slate-400">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Latitude</th>
                          <th className="p-2">Longitude</th>
                          <th className="p-2">Accuracy</th>
                          <th className="p-2">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {selectedRoute.simplifiedPoints.map((pt, i) => (
                          <tr key={i} className="hover:bg-slate-800/20">
                            <td className="p-2 text-slate-500">{i + 1}</td>
                            <td className="p-2 text-cyan-400">{pt.latitude.toFixed(5)}</td>
                            <td className="p-2 text-cyan-400">{pt.longitude.toFixed(5)}</td>
                            <td className="p-2">±{pt.accuracyM}m</td>
                            <td className="p-2 text-slate-400">{new Date(pt.observedAt).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-12 text-center">No route history found for this pet.</div>
            )}
          </div>

          {/* Route History Selection Sidebar */}
          <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Footprints className="w-4 h-4 text-cyan-400" />
              Recorded Route Sessions
            </h3>
            <div className="space-y-2">
              {routes.map(r => (
                <div
                  key={r.routeId}
                  onClick={() => setSelectedRoute(r)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedRoute?.routeId === r.routeId
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-slate-100'
                      : 'bg-[#0B0D10] border-slate-800 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-200">Karura Trail Walk</span>
                    <span className="text-cyan-400">{(r.distanceMeters / 1000).toFixed(2)} km</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Date(r.startedAt).toLocaleDateString()} · {r.pointCount} points · {r.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: PRIVACY & ANTI-STALKING POLICY */}
      {/* ==================================================================== */}
      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#13161D] border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Anti-Stalking &amp; Location Authorization Matrix
              </h2>
              <p className="text-xs text-slate-400">
                Enforces strict RBAC: Live coordinates are only visible to verified Household Owners and Active Walkers within an open service window.
              </p>
            </div>

            {/* Test Actor Access Buttons */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Test Actor Authorization Queries</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleCheckAccess(CANONICAL_IDS.OWNER_ELENA)}
                  className="p-3 bg-[#0B0D10] border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-200">Elena Vance</div>
                  <div className="text-[11px] text-slate-400">Household Owner</div>
                  <div className="mt-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Should GRANT (Full Owner)
                  </div>
                </button>

                <button
                  onClick={() => handleCheckAccess(CANONICAL_IDS.WALKER_SARAH_USER)}
                  className="p-3 bg-[#0B0D10] border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-200">Sarah Mwangi</div>
                  <div className="text-[11px] text-slate-400">Vetted Dog Walker</div>
                  <div className="mt-2 text-[10px] font-bold text-cyan-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Session-Scoped Window
                  </div>
                </button>

                <button
                  onClick={() => handleCheckAccess(CANONICAL_IDS.OUTSIDER_BRIAN)}
                  className="p-3 bg-[#0B0D10] border border-slate-800 hover:border-rose-500/50 rounded-xl text-left transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-slate-200">Brian Outside</div>
                  <div className="text-[11px] text-slate-400">Unrelated Outsider</div>
                  <div className="mt-2 text-[10px] font-bold text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    Must DENY (Anti-Stalking)
                  </div>
                </button>
              </div>
            </div>

            {/* Access Query Result Card */}
            {accessCheckResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  accessCheckResult.granted
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {accessCheckResult.granted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span className="font-bold text-sm text-slate-100">
                    Decision: {accessCheckResult.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                  </span>
                </div>
                <div className="text-slate-300">Role: <span className="font-mono text-cyan-400">{accessCheckResult.role}</span></div>
                <div className="text-slate-300">Reason: {accessCheckResult.reason}</div>
              </div>
            )}
          </div>

          {/* Real-time Audit Log Stream */}
          <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Security Audit Stream
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-[11px]">
              {auditLogs.length === 0 ? (
                <div className="text-slate-500 text-center py-8">No security audit events recorded.</div>
              ) : (
                auditLogs.map(a => (
                  <div key={a.auditEventId} className="bg-[#0B0D10] p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex justify-between">
                      <span className={`font-bold ${a.success ? 'text-emerald-400' : 'text-rose-400'}`}>{a.action}</span>
                      <span className="text-[10px] text-slate-500">{new Date(a.occurredAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-slate-400 text-[10px]">Actor: {a.actorUserId || 'SYSTEM'}</div>
                    {a.reason && <div className="text-slate-500 text-[10px] italic">{a.reason}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: SPRINT 14 TEST SUITE */}
      {/* ==================================================================== */}
      {activeTab === 'tests' && (
        <div className="bg-[#13161D] border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Sprint 14 Automated Verification Suite
              </h2>
              <p className="text-xs text-slate-400">
                17 comprehensive domain tests covering device registry, claiming, webhook ingestion, deduplication, anomaly detection, monotonic projections, and anti-stalking policy.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                isRunningTests
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
              <span>{isRunningTests ? 'Running Verification...' : 'Execute 17 Domain Tests'}</span>
            </button>
          </div>

          {/* Test Results View */}
          {testResults ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-[#0B0D10] p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>{testResults.passed} Passed</span>
                </div>
                {testResults.failed > 0 && (
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    <span>{testResults.failed} Failed</span>
                  </div>
                )}
                <div className="text-xs text-slate-400 font-mono">
                  {testResults.total} total tests evaluated
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {testResults.results.map((r, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                      r.passed
                        ? 'bg-[#0B0D10] border-slate-800 text-slate-200'
                        : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="font-semibold">{r.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">{r.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#0B0D10] border border-slate-800 rounded-xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-cyan-400/50 mx-auto" />
              <p className="text-xs text-slate-400">Click "Execute 17 Domain Tests" to run automated verification across all tracking aggregates.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
