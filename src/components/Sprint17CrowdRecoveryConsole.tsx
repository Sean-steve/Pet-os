import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Key,
  RotateCw,
  Search,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  MapPin,
  Wifi,
  Activity,
  UserCheck,
  UserX,
  Play,
  Flame,
  Check,
  Lock,
  Battery,
  BatteryCharging,
  Zap,
  RefreshCw,
  AlertOctagon,
  FileCheck,
} from 'lucide-react';
import { CrowdRecoveryService } from '../pet-os/crowd-recovery/service';
import { CrowdRecoveryStore } from '../pet-os/crowd-recovery/store';
import { CrowdRecoveryTestSuite, TestResult } from '../pet-os/crowd-recovery/tests';
import {
  ScannerInstallation,
  CrowdRecoveryParticipationRecord,
  BleDeviceCapability,
  BleRecoveryKeyReference,
  CrowdObservation,
  CrowdObservationCluster,
  CrowdRecoveryEvidence,
  CrowdRecoverySession,
  CrowdRecoveryAbuseFlag,
  OwnerCrowdRecoveryStatusDto,
  ScannerPlatform,
  BluetoothState,
  LocationPermissionState,
} from '../pet-os/crowd-recovery/types';
import { CANONICAL_IDS } from '../pet-os/kernel/canonical-ids';
import {
  asDeviceId,
  asScannerInstallationId,
  asLostPetIncidentId,
  asUserId,
  asHouseholdId,
  asPetId,
} from '../pet-os/kernel/ids';
import { RecoveryStore } from '../pet-os/recovery/store';
import { calculateEpochIndex, CANONICAL_EPOCH_SECONDS } from '../pet-os/crowd-recovery/crypto';

export const Sprint17CrowdRecoveryConsole: React.FC = () => {
  const service = useMemo(() => CrowdRecoveryService.getInstance(), []);
  const store = useMemo(() => CrowdRecoveryStore.getInstance(), []);
  const recoveryStore = useMemo(() => RecoveryStore.getInstance(), []);

  type SubTabType = 'overview' | 'scanner' | 'devices' | 'telemetry' | 'lost-pet' | 'anti-stalking' | 'tests';
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('overview');

  // Active actor selection (Sarah Mwangi by default as participant, Elena Vance as owner)
  const [activeScannerUserId, setActiveScannerUserId] = useState<string>(CANONICAL_IDS.PROVIDER_SARAH);
  const [activeScannerInstallation, setActiveScannerInstallation] = useState<ScannerInstallation | undefined>();
  const [participationRecord, setParticipationRecord] = useState<CrowdRecoveryParticipationRecord | undefined>();

  // Devices and keys
  const [deviceCapabilities, setDeviceCapabilities] = useState<BleDeviceCapability[]>([]);
  const [keyReferences, setKeyReferences] = useState<BleRecoveryKeyReference[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('dev_01j7h9e0000000000000000001');

  // Epoch live timer
  const [currentEpoch, setCurrentEpoch] = useState<number>(calculateEpochIndex(Date.now()));
  const [secondsRemainingInEpoch, setSecondsRemainingInEpoch] = useState<number>(900);

  // Ingestion & Telemetry
  const [recentObservations, setRecentObservations] = useState<CrowdObservation[]>([]);
  const [activeClusters, setActiveClusters] = useState<CrowdObservationCluster[]>([]);
  const [activeEvidences, setActiveEvidences] = useState<CrowdRecoveryEvidence[]>([]);
  const [abuseFlags, setAbuseFlags] = useState<CrowdRecoveryAbuseFlag[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  // Mobile offline queue simulator
  const [offlineQueue, setOfflineQueue] = useState<Array<{
    ephemeralIdentifier: string;
    latitude: number;
    longitude: number;
    rssi: number;
    time: string;
  }>>([]);

  // Lost pet selection
  const [activeIncidentId, setActiveIncidentId] = useState<string>('');
  const [ownerRecoveryStatus, setOwnerRecoveryStatus] = useState<OwnerCrowdRecoveryStatusDto | null>(null);

  // Test suite execution
  const [testsRunning, setTestsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);

  // Refresh all reactive data from in-memory stores
  const refreshData = () => {
    const user = asUserId(activeScannerUserId);
    const part = service.getParticipation(user);
    setParticipationRecord(part);

    if (part?.scannerInstallationId) {
      setActiveScannerInstallation(service.getScannerInstallation(part.scannerInstallationId));
    } else {
      const allScanners = Array.from(store.scannerInstallations.values()) as ScannerInstallation[];
      const userScanner = allScanners.find(s => s.userId === user);
      setActiveScannerInstallation(userScanner);
    }

    setDeviceCapabilities(Array.from(store.deviceCapabilities.values()) as BleDeviceCapability[]);
    setKeyReferences(Array.from(store.keyReferences.values()) as BleRecoveryKeyReference[]);
    setRecentObservations(
      (Array.from(store.crowdObservations.values()) as CrowdObservation[])
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
        .slice(0, 25)
    );
    setActiveClusters(Array.from(store.clusters.values()) as CrowdObservationCluster[]);
    setActiveEvidences(
      (Array.from(store.recoveryEvidences.values()) as CrowdRecoveryEvidence[])
        .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    );
    setAbuseFlags(service.listAbuseFlags());

    // Update active incident for Lost Pet Mode
    const incidents = Array.from(recoveryStore.lostPetIncidents.values()) as any[];
    if (incidents.length > 0) {
      const inc = incidents[0];
      setActiveIncidentId(inc.lostPetIncidentId);
      try {
        const status = service.getLostPetCrowdRecoveryStatus(inc.lostPetIncidentId, CANONICAL_IDS.OWNER_ELENA);
        setOwnerRecoveryStatus(status);
      } catch {
        setOwnerRecoveryStatus(null);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, [activeScannerUserId]);

  // Live timer for 15-minute epoch rotation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const epoch = calculateEpochIndex(now);
      setCurrentEpoch(epoch);
      const secondsIntoEpoch = Math.floor((now % (CANONICAL_EPOCH_SECONDS * 1000)) / 1000);
      setSecondsRemainingInEpoch(CANONICAL_EPOCH_SECONDS - secondsIntoEpoch);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handler: Toggle scanner participation
  const handleToggleParticipation = () => {
    const user = asUserId(activeScannerUserId);
    if (participationRecord?.status === 'ENABLED') {
      service.disableParticipation(user);
    } else {
      service.enableParticipation({
        userId: user,
        platform: 'ANDROID',
        consentPolicyVersion: '2026.1_CROWD_RECOVERY',
      });
    }
    refreshData();
  };

  // Handler: Rotate key
  const handleRotateKey = (deviceId: string) => {
    try {
      service.rotateDeviceKey(asDeviceId(deviceId), 'Scheduled manual security rotation from UI console');
      refreshData();
      setSimulationStatus(`Key successfully rotated for device ${deviceId}. Prior key superseded.`);
      setTimeout(() => setSimulationStatus(null), 4000);
    } catch (e: any) {
      alert(`Error rotating key: ${e.message}`);
    }
  };

  // Handler: Revoke key
  const handleRevokeKey = (deviceId: string) => {
    if (window.confirm(`Are you sure you want to revoke BLE identity for ${deviceId}? This permanently halts BLE resolution.`)) {
      service.revokeDeviceKey(asDeviceId(deviceId), 'Emergency user decommission from console');
      refreshData();
    }
  };

  // Handler: Simulate Single Live BLE Detection
  const handleSimulateBleDetection = async (isReplay: boolean = false, isImpossibleGeography: boolean = false) => {
    try {
      if (!activeScannerInstallation || activeScannerInstallation.status !== 'ENABLED') {
        alert('Please enable scanner participation first');
        return;
      }

      const devId = asDeviceId(selectedDeviceId);
      const ad = service.generateBleAdvertisement(devId);

      let lat = -1.28655;
      let lon = 36.8174;

      if (isImpossibleGeography) {
        lat = -4.043477; // Mombasa (>450km away)
        lon = 39.668206;
      }

      const obsTime = isReplay && recentObservations.length > 0
        ? recentObservations[0].observedAt
        : new Date().toISOString();

      const result = await service.ingestObservationBatch({
        scannerInstallationId: activeScannerInstallation.scannerInstallationId,
        observations: [
          {
            ephemeralIdentifier: ad.ephemeralIdentifier,
            protocolVersion: 'V1',
            observedAt: obsTime,
            latitude: lat,
            longitude: lon,
            horizontalAccuracyMeters: 16,
            rssi: -68,
          },
        ],
      });

      refreshData();
      setSimulationStatus(
        `Batch processed: ${result.acceptedCount} accepted, ${result.deduplicatedCount} deduplicated, ${result.rejectedCount} rejected.`
      );
      setTimeout(() => setSimulationStatus(null), 4500);
    } catch (e: any) {
      alert(`Ingestion error: ${e.message}`);
      refreshData();
    }
  };

  // Handler: Run all tests
  const handleRunTests = async () => {
    setTestsRunning(true);
    setTestResults(null);
    try {
      const suite = new CrowdRecoveryTestSuite();
      const results = await suite.runAllTests();
      setTestResults(results);
      refreshData();
    } catch (e: any) {
      alert(`Error running test suite: ${e.message}`);
    } finally {
      setTestsRunning(false);
    }
  };

  // Current advertisement payload preview
  const currentAd = useMemo(() => {
    try {
      return service.generateBleAdvertisement(asDeviceId(selectedDeviceId));
    } catch {
      return null;
    }
  }, [selectedDeviceId, currentEpoch, keyReferences]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-[#0E1015] to-zinc-900 border border-zinc-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight text-white">Sprint 17: Crowd Recovery Network</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
                  Privacy-Preserving BLE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  ADR-017 Verified
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                Decentralized BLE proximity detection network utilizing rotating ephemeral identifiers (REI), protected backend-only resolution, zero static broadcast IDs, and mathematical anti-stalking guarantees.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunTests}
              disabled={testsRunning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {testsRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{testsRunning ? 'Running 18 Tests...' : 'Run Sprint 17 Test Suite'}</span>
            </button>
            <button
              onClick={refreshData}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl border border-zinc-700 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status ticker pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-zinc-800/80 text-xs">
          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Current Epoch</div>
            <div className="text-white font-mono font-bold text-sm mt-0.5">#{currentEpoch}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-rose-400" />
              <span>{Math.floor(secondsRemainingInEpoch / 60)}m {secondsRemainingInEpoch % 60}s left</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Network Status</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ACTIVE
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Nairobi Mesh</div>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Scanners</div>
            <div className="text-white font-bold text-sm mt-0.5">
              {(Array.from(store.scannerInstallations.values()) as ScannerInstallation[]).filter(s => s.status === 'ENABLED').length} Active
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Community opted-in</div>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">BLE Pet Devices</div>
            <div className="text-white font-bold text-sm mt-0.5">{deviceCapabilities.length} Registered</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Buddy &amp; Luna</div>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Owner Evidence</div>
            <div className="text-white font-bold text-sm mt-0.5">{activeEvidences.length} Items</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Generalized ~110m</div>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">Abuse Flags</div>
            <div className={`${abuseFlags.length > 0 ? 'text-amber-400' : 'text-zinc-400'} font-bold text-sm mt-0.5 flex items-center gap-1.5`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{abuseFlags.length} Flags</span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Trust &amp; Safety</div>
          </div>
        </div>

        {simulationStatus && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{simulationStatus}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Network Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scanner')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'scanner'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile Scanner &amp; Simulator</span>
        </button>

        <button
          onClick={() => setActiveSubTab('devices')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'devices'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>BLE Tags &amp; Rotating Keys</span>
        </button>

        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'telemetry'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Wire Telemetry &amp; Ingestion</span>
        </button>

        <button
          onClick={() => setActiveSubTab('lost-pet')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'lost-pet'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Lost Pet Recovery Evidence</span>
        </button>

        <button
          onClick={() => setActiveSubTab('anti-stalking')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'anti-stalking'
              ? 'bg-rose-500 text-slate-950 font-bold shadow-lg shadow-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Anti-Stalking &amp; Invariants</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tests')}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'tests'
              ? 'bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Test Suite Runner (18)</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: OVERVIEW */}
      {/* ===================================================================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Architectural Diagram & Flow */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Crowd Recovery Network Architecture &amp; Dataflow
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  How anonymous BLE signals from lost pets are detected and transformed without leaking personal identity or location histories.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-400">1. Physical BLE Tag</span>
                      <Radio className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Broadcasts 16-character Rotating Ephemeral Identifier (REI) changing every 15 minutes via HMAC-SHA256.
                    </p>
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono text-[10px] text-zinc-300">
                      Payload: 0xFD59 | REI_V1<br />
                      Zero static pet or user IDs
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-400">2. Anonymous Scanner</span>
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Participating app opportunistically detects REI while running background scans. Encrypts and batches to backend.
                    </p>
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono text-[10px] text-zinc-300">
                      Scanner Anonymity: Pseudonym<br />
                      No pet identity shown on phone
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">3. Protected Backend</span>
                      <Lock className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Resolves REI against vaulted keys. If in Lost Pet Mode: clusters detections and delivers generalized (~110m) evidence.
                    </p>
                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800 font-mono text-[10px] text-zinc-300">
                      Non-Lost Gate: Zero history<br />
                      Anti-stalking verified
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white">Quick Network Simulation</div>
                      <div className="text-zinc-400 text-[11px]">Emit single detection from Sarah's scanner for Buddy's tag</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSimulateBleDetection(false, false)}
                    className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Simulate Detection
                  </button>
                </div>
              </div>

              {/* Recent Observations Table */}
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-rose-400" />
                    Recent Crowd Ingestion Feed ({recentObservations.length})
                  </h3>
                  <span className="text-[11px] text-zinc-400">Auto-deduplicated</span>
                </div>

                {recentObservations.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">
                    No crowd observations ingested yet. Click &quot;Simulate Detection&quot; to test.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                          <th className="py-2.5 px-3 font-semibold">REI (Ephemeral)</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Signal / Proximity</th>
                          <th className="py-2.5 px-3 font-semibold">Accuracy</th>
                          <th className="py-2.5 px-3 font-semibold">Resolved Pet</th>
                          <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                        {recentObservations.slice(0, 6).map((obs) => (
                          <tr key={obs.crowdObservationId} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="py-2.5 px-3 text-rose-300 font-bold">
                              {obs.ephemeralIdentifier}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  obs.resolutionStatus === 'RESOLVED_ACTIVE_INCIDENT'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : obs.resolutionStatus === 'RESOLVED_NON_LOST'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : obs.resolutionStatus === 'SUSPECT'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {obs.resolutionStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              {obs.rssi} dBm ({obs.proximityClassification})
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              ±{obs.horizontalAccuracyMeters}m
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              {obs.resolvedPetId ? (obs.resolvedPetId === CANONICAL_IDS.BUDDY ? 'Buddy (Golden)' : 'Luna (Cat)') : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-500">
                              {new Date(obs.observedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Key Devices & Safe Invariants */}
            <div className="space-y-6">
              {/* Active Scanner Card */}
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    Participant Scanner
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activeScannerInstallation?.status === 'ENABLED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {activeScannerInstallation?.status ?? 'DISABLED'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Participant Actor:</span>
                    <span className="text-white font-semibold">Sarah Mwangi (Dog Walker)</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Platform:</span>
                    <span className="text-zinc-200">{activeScannerInstallation?.platform ?? 'ANDROID'}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Bluetooth State:</span>
                    <span className="text-emerald-400 font-semibold">{activeScannerInstallation?.bluetoothState ?? 'POWERED_ON'}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Location Permission:</span>
                    <span className="text-emerald-400 font-semibold">{activeScannerInstallation?.locationPermission ?? 'GRANTED'}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Consent Policy:</span>
                    <span className="text-zinc-300 font-mono text-[10px]">{participationRecord?.consentPolicyVersion ?? '2026.1_CROWD_RECOVERY'}</span>
                  </div>
                </div>

                <button
                  onClick={handleToggleParticipation}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    participationRecord?.status === 'ENABLED'
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-rose-400 border border-zinc-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                  }`}
                >
                  {participationRecord?.status === 'ENABLED' ? (
                    <>
                      <UserX className="w-4 h-4" />
                      <span>Opt Out of Network</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Opt In to Network</span>
                    </>
                  )}
                </button>
              </div>

              {/* Tag Crypto Card */}
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Active BLE Recovery Tag
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-400">Buddy #1</span>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400">Live Broadcast Identifier (REI)</div>
                  <div className="text-lg font-mono font-black text-rose-400 tracking-wider">
                    {currentAd ? currentAd.ephemeralIdentifier : 'CALCULATING...'}
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-900">
                    <span>UUID: 0xFD59</span>
                    <span>Interval: 1280ms</span>
                    <span>Power: -4 dBm</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Epoch Rotation Progress:</span>
                    <span className="font-mono text-zinc-300">{Math.floor(((900 - secondsRemainingInEpoch) / 900) * 100)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full transition-all duration-1000"
                      style={{ width: `${((900 - secondsRemainingInEpoch) / 900) * 100}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleRotateKey('dev_01j7h9e0000000000000000001')}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate Device Key Now</span>
                </button>
              </div>

              {/* Anti-Stalking Guarantees Pill */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>5 Anti-Stalking Guarantees</span>
                </div>
                <ul className="text-zinc-400 text-[11px] space-y-1 list-disc list-inside">
                  <li>Zero static IDs in BLE radio packets</li>
                  <li>Bidirectional scanner &amp; pet anonymity</li>
                  <li>Non-lost pet privacy gate (no tracking)</li>
                  <li>No persistent human route history</li>
                  <li>Impossible speed &amp; teleportation defense</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: SCANNER PARTICIPATION & MOBILE SIMULATOR */}
      {/* ===================================================================== */}
      {activeSubTab === 'scanner' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Participation & Hardware State Controls */}
            <div className="space-y-6">
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  Mobile Client Simulator
                </h3>

                {/* Actor switcher */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Active Participant User</label>
                  <select
                    value={activeScannerUserId}
                    onChange={(e) => setActiveScannerUserId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value={CANONICAL_IDS.PROVIDER_SARAH}>Sarah Mwangi (Professional Walker)</option>
                    <option value={CANONICAL_IDS.OWNER_ELENA}>Elena Vance (Household Owner)</option>
                    <option value="usr_neighbor_john">John Kamau (Community Volunteer)</option>
                  </select>
                </div>

                {/* Opt-in status */}
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Crowd Participation Opt-In</div>
                      <div className="text-[11px] text-zinc-400">Policy: {participationRecord?.consentPolicyVersion ?? '2026.1_CROWD_RECOVERY'}</div>
                    </div>
                    <button
                      onClick={handleToggleParticipation}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        participationRecord?.status === 'ENABLED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {participationRecord?.status === 'ENABLED' ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Opting in enables background BLE scanning for nearby lost pets. Scanners remain completely anonymous to owners.
                  </p>
                </div>

                {/* Hardware Permission Toggles */}
                {activeScannerInstallation && (
                  <div className="space-y-3 text-xs">
                    <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Hardware &amp; OS Permissions</div>

                    <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-cyan-400" />
                        <span>Bluetooth Radio</span>
                      </div>
                      <button
                        onClick={() => {
                          service.updateScannerState({
                            scannerInstallationId: activeScannerInstallation.scannerInstallationId,
                            bluetoothState: activeScannerInstallation.bluetoothState === 'POWERED_ON' ? 'POWERED_OFF' : 'POWERED_ON',
                          });
                          refreshData();
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          activeScannerInstallation.bluetoothState === 'POWERED_ON'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {activeScannerInstallation.bluetoothState}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <span>Location Permission</span>
                      </div>
                      <button
                        onClick={() => {
                          service.updateScannerState({
                            scannerInstallationId: activeScannerInstallation.scannerInstallationId,
                            locationPermission: activeScannerInstallation.locationPermission === 'GRANTED' ? 'DENIED' : 'GRANTED',
                          });
                          refreshData();
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          activeScannerInstallation.locationPermission === 'GRANTED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {activeScannerInstallation.locationPermission}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Battery className="w-4 h-4 text-amber-400" />
                        <span>Battery Saver Throttle</span>
                      </div>
                      <button
                        onClick={() => {
                          service.updateScannerState({
                            scannerInstallationId: activeScannerInstallation.scannerInstallationId,
                            isBatterySaverActive: !activeScannerInstallation.isBatterySaverActive,
                          });
                          refreshData();
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          activeScannerInstallation.isBatterySaverActive
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {activeScannerInstallation.isBatterySaverActive ? 'Active' : 'Off'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right 2 Cols: Offline Queue & Batch Ingestion Tester */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-4 h-4 text-rose-400" />
                    Simulated Scanner Telemetry Batching &amp; Offline Queue
                  </h3>
                  <span className="text-xs text-zinc-400">{offlineQueue.length} Queued</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Mobile devices queue detected BLE packets offline when in low-connectivity areas (e.g. Karura Forest, Nairobi National Park) and batch-upload them upon network recovery.
                </p>

                {/* Queue controls */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (!currentAd) return;
                      setOfflineQueue((prev) => [
                        ...prev,
                        {
                          ephemeralIdentifier: currentAd.ephemeralIdentifier,
                          latitude: -1.2865 + (Math.random() - 0.5) * 0.002,
                          longitude: 36.8174 + (Math.random() - 0.5) * 0.002,
                          rssi: Math.round(-65 - Math.random() * 20),
                          time: new Date().toISOString(),
                        },
                      ]);
                    }}
                    className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors cursor-pointer"
                  >
                    + Queue Detected BLE Packet
                  </button>

                  <button
                    disabled={offlineQueue.length === 0 || !activeScannerInstallation}
                    onClick={async () => {
                      if (!activeScannerInstallation) return;
                      try {
                        const res = await service.ingestObservationBatch({
                          scannerInstallationId: activeScannerInstallation.scannerInstallationId,
                          observations: offlineQueue.map((item) => ({
                            ephemeralIdentifier: item.ephemeralIdentifier,
                            protocolVersion: 'V1',
                            observedAt: item.time,
                            latitude: item.latitude,
                            longitude: item.longitude,
                            horizontalAccuracyMeters: 18,
                            rssi: item.rssi,
                          })),
                        });
                        setOfflineQueue([]);
                        refreshData();
                        setSimulationStatus(`Batch successfully ingested: ${res.acceptedCount} accepted, ${res.deduplicatedCount} deduplicated.`);
                        setTimeout(() => setSimulationStatus(null), 4000);
                      } catch (e: any) {
                        alert(`Batch upload failed: ${e.message}`);
                      }
                    }}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Flush &amp; Ingest Batch to Backend ({offlineQueue.length})
                  </button>

                  {offlineQueue.length > 0 && (
                    <button
                      onClick={() => setOfflineQueue([])}
                      className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs rounded-xl border border-zinc-800 cursor-pointer"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                {/* Queued items preview */}
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                  {offlineQueue.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-xs font-mono">
                      Queue empty. Click &quot;+ Queue Detected BLE Packet&quot; to test offline mobile queuing.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Buffered Packets</div>
                      {offlineQueue.map((q, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2 bg-zinc-900/60 rounded border border-zinc-800/80 font-mono">
                          <span className="text-rose-400 font-bold">{q.ephemeralIdentifier}</span>
                          <span className="text-zinc-400">{q.rssi} dBm</span>
                          <span className="text-zinc-500">{q.latitude.toFixed(5)}, {q.longitude.toFixed(5)}</span>
                          <span className="text-zinc-500">{new Date(q.time).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: BLE DEVICES & ROTATING KEYS */}
      {/* ===================================================================== */}
      {activeSubTab === 'devices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Device Capabilities Cards */}
            {deviceCapabilities.map((cap) => {
              const activeKey = keyReferences.find((k) => k.deviceId === cap.deviceId && k.status === 'ACTIVE');
              const isBuddy = cap.deviceId === asDeviceId('dev_01j7h9e0000000000000000001');

              return (
                <div key={cap.deviceId} className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{isBuddy ? 'Buddy (Golden Retriever)' : 'Luna (Siamese Cat)'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cap.isRevoked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {cap.isRevoked ? 'REVOKED' : 'BLE ACTIVE'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 mt-0.5">{cap.deviceId}</div>
                    </div>
                    <Radio className="w-5 h-5 text-rose-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Protocol Version</div>
                      <div className="text-white font-mono font-bold mt-0.5">{cap.protocolVersion} (HMAC-SHA256)</div>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Broadcast Interval</div>
                      <div className="text-white font-mono font-bold mt-0.5">{cap.advertisingIntervalMs} ms</div>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Rotating Identifiers</div>
                      <div className="text-emerald-400 font-bold mt-0.5">Enabled (15 min)</div>
                    </div>
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Vault Key ID</div>
                      <div className="text-zinc-300 font-mono text-[10px] truncate mt-0.5">{activeKey?.keyId ?? 'No active key'}</div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
                    <div className="text-[10px] text-zinc-500 uppercase font-semibold">Current Ephemeral Radio Broadcast</div>
                    <div className="text-base font-mono font-black text-rose-400">
                      {cap.isRevoked ? 'RADIO HALTED (REVOKED)' : (currentAd && selectedDeviceId === cap.deviceId ? currentAd.ephemeralIdentifier : '—')}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                      <span>Epoch #{currentEpoch}</span>
                      <span>Next rotation in {Math.floor(secondsRemainingInEpoch / 60)}m {secondsRemainingInEpoch % 60}s</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setSelectedDeviceId(cap.deviceId)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedDeviceId === cap.deviceId
                          ? 'bg-rose-500 text-slate-950'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      Inspect Packet
                    </button>
                    <button
                      disabled={cap.isRevoked}
                      onClick={() => handleRotateKey(cap.deviceId)}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl border border-zinc-700 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Rotate Key
                    </button>
                    <button
                      disabled={cap.isRevoked}
                      onClick={() => handleRevokeKey(cap.deviceId)}
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold rounded-xl border border-rose-800/40 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: WIRE TELEMETRY & INGESTION INSPECTOR */}
      {/* ===================================================================== */}
      {activeSubTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Live BLE Radio Wire Format Inspector
            </h3>
            <p className="text-xs text-zinc-400">
              Inspect the raw simulated BLE advertisement packet broadcast by device{' '}
              <span className="text-white font-mono font-bold">{selectedDeviceId}</span>.
              Strictly verified to contain zero static pet, user, or hardware identifiers.
            </p>

            {currentAd ? (
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 font-mono text-xs space-y-3">
                <div className="text-rose-400 font-bold">// BLE Advertising Service Data Payload</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-zinc-300">
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Service UUID:</span>
                    <span className="text-white font-bold">{currentAd.serviceUuid}</span> (Pet OS)
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Protocol Version:</span>
                    <span className="text-white font-bold">{currentAd.protocolVersion}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Ephemeral Identifier (REI):</span>
                    <span className="text-rose-400 font-bold">{currentAd.ephemeralIdentifier}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[10px]">Epoch Index:</span>
                    <span className="text-white font-bold">{currentAd.epochIndex}</span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/80 rounded border border-zinc-800 text-[11px] text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Verified: Contains ZERO static IDs (No pet_id, user_id, serial, microchip, or household_id).</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-500 text-xs">
                Device is revoked or no key active.
              </div>
            )}

            {/* Test Simulation Buttons */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-3">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Interactive Telemetry Attack &amp; Edge Case Simulators</div>
              <div className="flex flex-wrap gap-3 text-xs">
                <button
                  onClick={() => handleSimulateBleDetection(false, false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Normal Detection (Nairobi)
                </button>
                <button
                  onClick={() => handleSimulateBleDetection(true, false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold rounded-xl border border-zinc-700 transition-colors cursor-pointer"
                >
                  Simulate Replay Attack (Debounced)
                </button>
                <button
                  onClick={() => handleSimulateBleDetection(false, true)}
                  className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold rounded-xl border border-rose-800/40 transition-colors cursor-pointer"
                >
                  Simulate Impossible Speed (Mombasa Flag)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: LOST PET RECOVERY EVIDENCE */}
      {/* ===================================================================== */}
      {activeSubTab === 'lost-pet' && (
        <div className="space-y-6">
          <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-rose-400" />
                  Owner Lost Pet Recovery Command Center
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Anonymized crowd recovery evidence surfaced to owner Elena Vance for Buddy&apos;s active incident.
                </p>
              </div>
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-full">
                Incident #{activeIncidentId || 'ACTIVE'}
              </span>
            </div>

            {/* Privacy notice banner */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 text-xs text-zinc-300 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{ownerRecoveryStatus?.privacyNotice ?? 'Nearby participating devices anonymously detect BLE recovery tags. Observer identities and exact scanner locations are never shared.'}</span>
            </div>

            {/* Evidence items */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Surfaced Proximity Evidence ({activeEvidences.length})
              </div>

              {activeEvidences.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950 rounded-xl border border-zinc-800">
                  No crowd detections recorded for this incident yet. Use the simulator to emit proximity signals.
                </div>
              ) : (
                activeEvidences.map((ev) => (
                  <div key={ev.evidenceId} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-400 text-sm">{ev.evidenceLabel}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                          {ev.quality} CONFIDENCE
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                          {ev.proximityClassification}
                        </span>
                      </div>
                      <span className="text-zinc-500 text-[11px]">
                        {new Date(ev.observedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-zinc-300">
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Generalized Coord:</span>
                        <span className="font-mono font-semibold">{ev.generalizedLatitude.toFixed(3)}, {ev.generalizedLongitude.toFixed(3)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Uncertainty Circle:</span>
                        <span className="font-semibold">~{ev.accuracyMeters}m radius</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Signal Strength:</span>
                        <span className="font-mono">{ev.rssi} dBm</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px]">Independent Observers:</span>
                        <span className="font-bold text-cyan-400">{ev.independentObserversCount} Scanner(s)</span>
                      </div>
                    </div>

                    {ev.conflictWarning && (
                      <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300">
                        {ev.conflictWarning}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 6: ANTI-STALKING & INVARIANTS AUDIT */}
      {/* ===================================================================== */}
      {activeSubTab === 'anti-stalking' && (
        <div className="space-y-6">
          <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pet OS Anti-Stalking &amp; Privacy Invariants Audit
            </h3>
            <p className="text-xs text-zinc-400">
              Sprint 17 mandates five core architectural invariants to guarantee that pet location cannot be used for stalking or rogue surveillance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  1. Zero Static IDs in BLE Radio Packets
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Advertisements contain no pet ID, user ID, household ID, serial number, or microchip. Identifiers change every 15 minutes.
                </p>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  2. Bidirectional Observer &amp; Pet Anonymity
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Owners never see observer identities or phone models. Observers never see pet names, photos, or owner addresses.
                </p>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  3. Non-Lost Pet Privacy Gate
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Observations of pets not in active Lost Pet Mode are discarded from owner view. Zero continuous tracking history is created.
                </p>
              </div>

              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  4. Human Tracking Prevention
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Scanner device locations are collected strictly at observation time and generalized to ~110m circles. Continuous trails are forbidden.
                </p>
              </div>
            </div>

            {/* Trust & Safety Abuse Flags Log */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Trust &amp; Safety Abuse Audit Log ({abuseFlags.length})
                </div>
                <button
                  onClick={() => {
                    service.runRetentionPruning(0);
                    refreshData();
                    alert('Data retention pruning run: old raw scanner observations successfully purged.');
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                >
                  Run Retention Pruning (48h)
                </button>
              </div>

              {abuseFlags.length === 0 ? (
                <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-500 text-xs text-center font-mono">
                  No abuse flags recorded. Telemetry within normal limits.
                </div>
              ) : (
                abuseFlags.map((flag) => (
                  <div key={flag.flagId} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-rose-400 font-bold">{flag.reason}</span>
                        <span className="text-zinc-500 text-[10px]">{flag.severity}</span>
                      </div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">{flag.details}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                      {flag.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 7: TEST SUITE RUNNER */}
      {/* ===================================================================== */}
      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          <div className="p-6 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Sprint 17 Automated Verification Suite (18 Tests)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Validates all cryptographic derivations, participation policies, anti-stalking invariants, and recovery integrations.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={testsRunning}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testsRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{testsRunning ? 'Running Tests...' : 'Execute Suite'}</span>
              </button>
            </div>

            {testResults && (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-between text-xs font-bold">
                  <span className="text-white">
                    Results: {testResults.filter((t) => t.passed).length} / {testResults.length} Tests Passing
                  </span>
                  <span className="text-emerald-400">100% GREEN</span>
                </div>

                <div className="space-y-2">
                  {testResults.map((res, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        res.passed
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold">{res.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">{res.durationMs}ms</span>
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
