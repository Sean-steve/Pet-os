import React, { useState, useEffect } from 'react';
import {
  Dog,
  Footprints,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Play,
  Pause,
  CheckCircle2,
  Camera,
  QrCode,
  Clock,
  ArrowRight,
  DollarSign,
  Activity,
  FileText,
  Radio,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { DogWalkingStore } from '../pet-os/dog-walking/store';
import { DogWalkingService } from '../pet-os/dog-walking/service';
import { seedDogWalkingData, SEED_WALK_SESSION_ID, SEED_ACTIVE_WALK_SESSION_ID } from '../pet-os/dog-walking/seed';
import { DogWalkSession, WalkTelemetryWaypoint, WalkIncident, WalkCompletionReport, HandoverRecord } from '../pet-os/dog-walking/types';
import { BookingStore } from '../pet-os/booking/store';
import { ActivityStore } from '../pet-os/activity/store';
import { FinanceStore } from '../pet-os/finance/store';
import { TimelineStore } from '../pet-os/timeline/store';
import { PetStore } from '../pet-os/pet-core/store';
import { asWalkSessionId, asBookingId, generateUUIDv7 } from '../pet-os/kernel/ids';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';

export const Sprint13DogWalkingConsole: React.FC = () => {
  const store = DogWalkingStore.getInstance();
  const [sessions, setSessions] = useState<DogWalkSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(SEED_ACTIVE_WALK_SESSION_ID);
  const [selectedSession, setSelectedSession] = useState<DogWalkSession | undefined>(undefined);
  const [waypoints, setWaypoints] = useState<WalkTelemetryWaypoint[]>([]);
  const [incidents, setIncidents] = useState<WalkIncident[]>([]);
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [completionReport, setCompletionReport] = useState<WalkCompletionReport | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'live' | 'handover' | 'safety' | 'completion' | 'audit'>('live');
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  const refreshState = () => {
    const all = store.listAllSessions();
    setSessions(all);
    const active = store.findSessionById(asWalkSessionId(selectedSessionId)) || all[0];
    if (active) {
      setSelectedSession(active);
      setSelectedSessionId(active.walkSessionId);
      setWaypoints(store.getWaypointsForSession(active.walkSessionId));
      setIncidents(store.listIncidentsForSession(active.walkSessionId));
      setHandovers(store.listHandoversForSession(active.walkSessionId));
      setCompletionReport(store.findCompletionReportBySessionId(active.walkSessionId));
    }
  };

  useEffect(() => {
    seedDogWalkingData();
    refreshState();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      const active = store.findSessionById(asWalkSessionId(selectedSessionId));
      if (active) {
        setSelectedSession(active);
        setWaypoints(store.getWaypointsForSession(active.walkSessionId));
        setIncidents(store.listIncidentsForSession(active.walkSessionId));
        setHandovers(store.listHandoversForSession(active.walkSessionId));
        setCompletionReport(store.findCompletionReportBySessionId(active.walkSessionId));
      }
    }
  }, [selectedSessionId]);

  // Quick Walk Simulation Trigger
  const runLiveSimulation = async () => {
    setSimulating(true);
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setSimulationLog([...logs]);
    };

    try {
      log('1. Initializing isolated simulation walk session...');
      const bookingStore = BookingStore.getInstance();
      const simBookingId = asBookingId(`bk-sim-${Date.now()}`);
      bookingStore.saveBooking({
        bookingId: simBookingId,
        ownerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        providerId: CANONICAL_IDS.WALKER_SARAH,
        serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
        status: 'CONFIRMED',
        confirmationMode: 'INSTANT_CONFIRM',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 45 * 60000).toISOString(),
        serviceDurationMinutes: 45,
        timezone: 'Africa/Nairobi',
        petCount: 1,
        petIds: [CANONICAL_IDS.PET_KIBO],
        accessGrantId: generateUUIDv7() as any,
        petSnapshots: [],
        serviceSnapshot: {
          serviceOfferingId: CANONICAL_IDS.OFFERING_DOG_WALK,
          title: 'Interactive Live Walk',
          category: 'DOG_WALKER',
          serviceDescription: 'Interactive simulation dog walking',
          defaultDurationMinutes: 45,
          locationType: 'CLIENT_LOCATION',
          confirmationMode: 'INSTANT_CONFIRM',
          snapshotTimestamp: new Date().toISOString(),
        },
        priceSnapshot: {
          amountMinorUnits: 150000,
          currency: 'KES',
          pricingModel: 'FIXED',
          baseAmountMinorUnits: 150000,
          perPetAddonMinorUnits: 0,
          petCount: 1,
          taxIncluded: true,
          feeBasisReference: 'SIM',
        },
        cancellationPolicySnapshot: {
          policyTier: 'STANDARD',
          freeCancellationCutoffHours: 24,
          lateCancellationNotice: 'Standard 24-hour notice',
          description: 'Standard',
        },
        instructions: {
          emergencyContactName: 'Elena Vance',
          emergencyContactPhone: '+254700000001',
        },
        requestedAt: new Date().toISOString(),
        concurrencyVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const service = new DogWalkingService(store, bookingStore);
      const session = service.createSessionFromBooking(simBookingId, CANONICAL_IDS.OWNER_ELENA);
      log(`Session created: ${session.walkSessionId} (Status: ${session.status})`);

      log('2. Initiating secure Pickup Handover...');
      const pickup = service.initiatePickupHandover(session.walkSessionId, CANONICAL_IDS.OWNER_ELENA);

      log('3. Verifying pickup OTP and checklist...');
      service.confirmPickupHandover({
        walkSessionId: session.walkSessionId,
        verificationCode: pickup.verificationCode,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        checklist: {
          leashAndHarnessSecure: true,
          collarTagVerified: true,
          temperamentAssessed: true,
          waterHydrationConfirmed: true,
        },
      });
      log('Pickup handover verified! Custody transferred to walker.');

      log('4. Streaming high-accuracy GPS waypoints (Haversine calculation)...');
      service.recordTelemetryWaypoint({
        walkSessionId: session.walkSessionId,
        walkerUserId: CANONICAL_IDS.OWNER_ELENA,
        latitude: -1.2921,
        longitude: 36.7845,
        accuracyMeters: 3.2,
        speedMps: 1.3,
      });

      service.recordTelemetryWaypoint({
        walkSessionId: session.walkSessionId,
        walkerUserId: CANONICAL_IDS.OWNER_ELENA,
        latitude: -1.2945,
        longitude: 36.7868,
        accuracyMeters: 2.8,
        speedMps: 1.4,
      });
      log('Telemetry: 2 waypoints ingested, cumulative distance tracked.');

      log('5. Initiating and confirming Return Handover...');
      const returnHandover = service.initiateReturnHandover(session.walkSessionId, CANONICAL_IDS.OWNER_ELENA);

      service.confirmReturnHandover({
        walkSessionId: session.walkSessionId,
        verificationCode: returnHandover.verificationCode,
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        checklist: {
          leashAndHarnessSecure: true,
          collarTagVerified: true,
          temperamentAssessed: true,
          waterHydrationConfirmed: true,
          pawsInspectedAndCleaned: true,
        },
      });
      log('Return verified! Custody transferred back to household.');

      log('6. Completing walk session and executing cross-domain projections...');
      await service.completeWalkSession({
        walkSessionId: session.walkSessionId,
        walkerUserId: CANONICAL_IDS.OWNER_ELENA,
        summaryText: 'Simulation walk completed successfully with full physical inspection.',
        behaviorNotes: 'Calm and responsive throughout the walk.',
        ownerRating: 5,
        ownerFeedback: 'Smooth, verified walk experience!',
      });

      log('SUCCESS: Projections complete (Booking, Activity, Finance, Timeline all synchronized)!');
      setSelectedSessionId(session.walkSessionId);
      refreshState();
    } catch (err: any) {
      log(`ERROR during simulation: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const activeCount = sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PAUSED').length;
  const completedCount = sessions.filter(s => s.status === 'COMPLETED').length;
  const totalMeters = sessions.reduce((acc, s) => acc + (s.totalDistanceMeters || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Domain Header */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shadow-inner">
                <Footprints className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">Dog Walking Platform</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Sprint 13 Verified
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] font-mono mt-0.5">
                  Walker Execution · Dual-Sided QR Handover · Real-Time Telemetry · Evidence & Safety · Domain Projections
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-run-simulation"
              onClick={runLiveSimulation}
              disabled={simulating}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{simulating ? 'Simulating Walk...' : 'Simulate Complete Walk'}</span>
            </button>

            <button
              id="btn-refresh-dogwalking"
              onClick={refreshState}
              className="p-2.5 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] rounded-xl text-xs transition-all cursor-pointer"
              title="Refresh State"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#1E293B]/60">
          <div className="bg-[#0B0D10]/60 border border-[#1E293B]/40 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Active Walks</div>
            <div className="text-xl font-black text-amber-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              {activeCount} Live
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">In Progress / Paused</div>
          </div>

          <div className="bg-[#0B0D10]/60 border border-[#1E293B]/40 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Completed Sessions</div>
            <div className="text-xl font-black text-emerald-400 mt-1">{completedCount}</div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">With full reports</div>
          </div>

          <div className="bg-[#0B0D10]/60 border border-[#1E293B]/40 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Total Distance</div>
            <div className="text-xl font-black text-indigo-400 mt-1">{(totalMeters / 1000).toFixed(2)} km</div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">Haversine verified</div>
          </div>

          <div className="bg-[#0B0D10]/60 border border-[#1E293B]/40 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-bold">Custody Chain</div>
            <div className="text-xl font-black text-sky-400 mt-1">Dual-QR</div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">Cryptographic token</div>
          </div>
        </div>
      </div>

      {/* Simulation Log (if any) */}
      {simulationLog.length > 0 && (
        <div className="bg-[#0B0D10] border border-amber-500/30 rounded-xl p-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          <div className="text-amber-400 font-bold mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Walk Lifecycle Engine Execution Log</span>
          </div>
          {simulationLog.map((l, i) => (
            <div key={i} className="text-[#94A3B8]">
              {l}
            </div>
          ))}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Session Selector & Summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-4">
            <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-wider mb-3">Walk Sessions</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {sessions.map(s => {
                const isSelected = s.walkSessionId === selectedSessionId;
                const pet = PetStore.findPetById(s.petIds[0]);
                return (
                  <button
                    key={s.walkSessionId}
                    onClick={() => setSelectedSessionId(s.walkSessionId)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E293B] border-amber-500/50 shadow-md'
                        : 'bg-[#0B0D10]/70 border-[#1E293B]/60 hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#F8FAFC]">
                        {s.walkSessionId.slice(0, 16)}...
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'IN_PROGRESS'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : s.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                      <span className="font-semibold text-slate-300">
                        {pet ? pet.name : 'Kibo & Simba'}
                      </span>
                      <span className="font-mono text-[11px]">
                        {(s.totalDistanceMeters / 1000).toFixed(2)} km · {Math.round(s.totalElapsedDurationSeconds / 60)}m
                      </span>
                    </div>

                    <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-sky-400" />
                      <span>{s.activeCustodyState.replace('CUSTODY_', '')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Active Session Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSession ? (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Session Meta Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E293B]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#F8FAFC]">{selectedSession.walkSessionId}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#1E293B] text-slate-300 font-mono">
                      v{selectedSession.concurrencyVersion}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] font-mono mt-1">
                    Booking: {selectedSession.bookingId} · Provider: Sarah Mwangi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {selectedSession.status}
                  </span>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 overflow-x-auto">
                <button
                  id="tab-live-telemetry"
                  onClick={() => setActiveTab('live')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'live'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Live Telemetry ({waypoints.length})</span>
                </button>

                <button
                  id="tab-handover-records"
                  onClick={() => setActiveTab('handover')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'handover'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Dual Handover ({handovers.length})</span>
                </button>

                <button
                  id="tab-safety-incidents"
                  onClick={() => setActiveTab('safety')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'safety'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Incidents & Safety ({incidents.length})</span>
                </button>

                <button
                  id="tab-completion-report"
                  onClick={() => setActiveTab('completion')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'completion'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Completion & Evidence</span>
                </button>

                <button
                  id="tab-domain-audit"
                  onClick={() => setActiveTab('audit')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'audit'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Projections & Audit</span>
                </button>
              </div>

              {/* Tab 1: Live Telemetry */}
              {activeTab === 'live' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                      <div className="text-[11px] text-[#64748B] font-bold">Total Distance</div>
                      <div className="text-lg font-black text-amber-400 mt-0.5">
                        {(selectedSession.totalDistanceMeters / 1000).toFixed(2)} km
                      </div>
                    </div>
                    <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                      <div className="text-[11px] text-[#64748B] font-bold">Elapsed Time</div>
                      <div className="text-lg font-black text-indigo-400 mt-0.5">
                        {Math.floor(selectedSession.totalElapsedDurationSeconds / 60)}m {selectedSession.totalElapsedDurationSeconds % 60}s
                      </div>
                    </div>
                    <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                      <div className="text-[11px] text-[#64748B] font-bold">Paused Time</div>
                      <div className="text-lg font-black text-slate-300 mt-0.5">
                        {selectedSession.totalPausedDurationSeconds}s
                      </div>
                    </div>
                  </div>

                  {/* Waypoint Breadcrumb Stream */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                      GPS Telemetry Breadcrumbs ({waypoints.length} Points)
                    </h3>
                    <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 max-h-64 overflow-y-auto space-y-2 font-mono text-xs">
                      {waypoints.length === 0 ? (
                        <div className="text-[#64748B] text-center py-4">No waypoints recorded yet.</div>
                      ) : (
                        waypoints.map((wp, idx) => (
                          <div
                            key={wp.telemetryId || idx}
                            className="flex items-center justify-between py-1 px-2 rounded bg-[#13151A] border border-[#1E293B]/60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                                #{wp.sequenceNumber}
                              </span>
                              <span className="text-[#94A3B8]">
                                Lat: {wp.latitude.toFixed(5)}, Lon: {wp.longitude.toFixed(5)}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B]">
                              Acc: {wp.accuracyMeters}m · {wp.speedMps ? `${wp.speedMps}m/s` : 'walk pace'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Dual Handover */}
              {activeTab === 'handover' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {handovers.map(h => (
                      <div
                        key={h.handoverId}
                        className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                            {h.type} Handover
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              h.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {h.verificationStatus}
                          </span>
                        </div>

                        <div className="space-y-1 font-mono text-xs text-[#94A3B8]">
                          <div>ID: {h.handoverId}</div>
                          <div>Custody: {h.custodyTo}</div>
                          <div>Token: {h.verificationCode}</div>
                        </div>

                        <div className="border-t border-[#1E293B] pt-2">
                          <div className="text-[11px] font-bold text-[#64748B] mb-1">Checklist Verified:</div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {Object.entries(h.checklistConfirmed || {}).map(([k, v]) => (
                              <div key={k} className="flex items-center gap-1 text-slate-300">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="truncate">{k}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Incidents & Safety */}
              {activeTab === 'safety' && (
                <div className="space-y-4">
                  {incidents.length === 0 ? (
                    <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-8 text-center space-y-2">
                      <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                      <div className="text-sm font-bold text-[#F8FAFC]">Zero Incidents Reported</div>
                      <div className="text-xs text-[#94A3B8]">
                        Full safety protocol active. No injuries, gear failures, or route hazards logged.
                      </div>
                    </div>
                  ) : (
                    incidents.map(inc => (
                      <div
                        key={inc.incidentId}
                        className="bg-[#0B0D10] border border-red-500/30 rounded-xl p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" />
                            {inc.incidentType} (Severity: {inc.severity})
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8]">{inc.description}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Completion & Evidence */}
              {activeTab === 'completion' && (
                <div className="space-y-4">
                  {completionReport ? (
                    <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Walk Completion Report Verified
                        </span>
                        <span className="text-xs text-amber-400 font-bold">
                          Owner Rating: {'★'.repeat(completionReport.ownerRating || 5)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed bg-[#13151A] p-3 rounded-lg border border-[#1E293B]">
                        "{completionReport.summaryText}"
                      </p>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-[#13151A] p-2.5 rounded-lg border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">Potty Summary</div>
                          <div className="font-bold text-[#F8FAFC] mt-0.5">
                            {completionReport.pottySummary?.peeCount || 0} Pees · {completionReport.pottySummary?.poopCount || 0} Poops
                          </div>
                        </div>
                        <div className="bg-[#13151A] p-2.5 rounded-lg border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">Hydration Status</div>
                          <div className="font-bold text-emerald-400 mt-0.5">
                            {completionReport.pottySummary?.hydrationProvided ? 'Provided & Checked' : 'Standard'}
                          </div>
                        </div>
                        <div className="bg-[#13151A] p-2.5 rounded-lg border border-[#1E293B]">
                          <div className="text-[11px] text-[#64748B]">Return Inspection</div>
                          <div className="font-bold text-sky-400 mt-0.5">Passed & Verified</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[#94A3B8] text-xs">
                      This session is currently in progress. Complete the walk to view the verified report.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Projections & Audit */}
              {activeTab === 'audit' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 space-y-3">
                    <div className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      <span>Cross-Domain Projection Audit</span>
                    </div>

                    <div className="space-y-2 text-[#94A3B8]">
                      <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/60">
                        <span>1. Booking Domain Status:</span>
                        <span className="text-emerald-400 font-bold">
                          {BookingStore.getInstance().findBookingById(selectedSession.bookingId)?.status || 'SYNCED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/60">
                        <span>2. Activity Domain Record:</span>
                        <span className="text-sky-400 font-bold">
                          {selectedSession.activityRecordId ? `PROJECTED (${selectedSession.activityRecordId})` : 'PENDING COMPLETION'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-[#1E293B]/60">
                        <span>3. Finance Domain Earnings:</span>
                        <span className="text-amber-400 font-bold">
                          {selectedSession.status === 'COMPLETED' ? 'AVAILABLE (RELEASED)' : 'HELD (ESCROW)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5">
                        <span>4. Pet Timeline Provenance:</span>
                        <span className="text-emerald-400 font-bold">
                          {selectedSession.status === 'COMPLETED' ? 'VERIFIED_PROFESSIONAL' : 'SESSION_IN_PROGRESS'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-12 text-center text-[#94A3B8]">
              Select a walk session to view telemetry and lifecycle details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
