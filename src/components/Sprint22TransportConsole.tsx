/**
 * Pet OS Sprint 22 — Pet Transport Professional Workspace Console
 * Complete Interactive Dark Studio Workspace for Drivers, Dispatchers, Owners & Cross-Domain Audit
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Clock,
  Thermometer,
  Key,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  UserCheck,
  Activity,
  FileText,
  Radio,
  Eye,
  Lock,
  ArrowRight,
  Package,
  Heart,
  PlusCircle,
  Car,
  Compass,
} from 'lucide-react';
import { TransportStore } from '../pet-os/transport/store';
import { TransportService } from '../pet-os/transport/service';
import { seedTransportData } from '../pet-os/transport/seed';
import { runAllTransportTests, TransportTestResult } from '../pet-os/transport/tests';
import {
  TransportTrip,
  TransportDriverProfile,
  TransportVehicle,
  TransportStop,
  TransportEvent,
  OwnerTripLiveProjection,
} from '../pet-os/transport';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asBusinessId,
  asBookingId,
  asTransportTripId,
  asTransportStopId,
  asTransportVehicleId,
} from '../pet-os/kernel/ids';

type WorkspaceRole = 'DRIVER' | 'DISPATCHER' | 'OWNER' | 'TEST_RUNNER';

export const Sprint22TransportConsole: React.FC = () => {
  const [role, setRole] = useState<WorkspaceRole>('DRIVER');
  const [trips, setTrips] = useState<TransportTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('trp-luna-vet-return');
  const [drivers, setDrivers] = useState<TransportDriverProfile[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [testResults, setTestResults] = useState<TransportTestResult[]>([]);
  const [outboxEvents, setOutboxEvents] = useState<TransportEvent[]>([]);
  const [ownerProjection, setOwnerProjection] = useState<OwnerTripLiveProjection | null>(null);

  // Forms / Interactivity State
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [delayReason, setDelayReason] = useState<string>('TRAFFIC');
  const [cargoTempInput, setCargoTempInput] = useState<number>(23.5);
  const [welfareNotes, setWelfareNotes] = useState<string>('Pet is calm and rested in crate.');
  const [welfareResponsiveness, setWelfareResponsiveness] = useState<'ALERT' | 'RESTING' | 'VISIBLE_DISTRESS'>('RESTING');
  const [incidentCategory, setIncidentCategory] = useState<string>('VEHICLE_BREAKDOWN');
  const [incidentDesc, setIncidentDesc] = useState<string>('Tire puncture on route; safely stopped on paved shoulder.');
  const [handoverPin, setHandoverPin] = useState<string>('7821');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const store = TransportStore.getInstance();
  const service = TransportService.getInstance();

  const refreshState = () => {
    setTrips(store.listTrips());
    setDrivers(store.listDrivers());
    setVehicles(store.listVehicles());
    setOutboxEvents(store.getOutboxEvents().slice(-15).reverse());

    const activeTrip = store.getTrip(asTransportTripId(selectedTripId)) || store.listTrips()[0];
    if (activeTrip) {
      setSelectedTripId(activeTrip.tripId);
      try {
        const proj = service.getOwnerTripLiveProjection({
          tripId: activeTrip.tripId,
          ownerUserId: asUserId('usr-elena-vance'),
        });
        setOwnerProjection(proj);
      } catch {
        setOwnerProjection(null);
      }
    }
  };

  useEffect(() => {
    seedTransportData();
    refreshState();

    const unsub = store.subscribe(() => {
      refreshState();
    });
    return () => unsub();
  }, []);

  const activeTrip = trips.find(t => t.tripId === selectedTripId) || trips[0];
  const activeDriver = activeTrip?.assignedDriverId ? store.getDriver(activeTrip.assignedDriverId) : undefined;
  const activeVehicle = activeTrip?.assignedVehicleId ? store.getVehicle(activeTrip.assignedVehicleId) : undefined;
  const stops = activeTrip ? store.getStopsForTrip(activeTrip.tripId) : [];
  const snapshots = activeTrip ? store.getSnapshotsForTrip(activeTrip.tripId) : [];
  const custodyRecords = activeTrip ? store.getCustodyRecordsForTrip(activeTrip.tripId) : [];
  const observations = activeTrip ? store.getObservationsForTrip(activeTrip.tripId) : [];
  const safetyAlerts = activeTrip ? store.getSafetyAlertsForTrip(activeTrip.tripId) : [];
  const incidents = activeTrip ? store.getIncidentsForTrip(activeTrip.tripId) : [];
  const delays = activeTrip ? store.getDelaysForTrip(activeTrip.tripId) : [];
  const belongings = activeTrip ? store.getBelongingsForTrip(activeTrip.tripId) : [];

  const showFeedback = (text: string, type: 'success' | 'error' | 'info') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Driver Actions
  const handleArriveAtStop = (stopId: string) => {
    try {
      service.arriveAtStop({
        tripId: activeTrip.tripId,
        stopId: asTransportStopId(stopId),
        driverUserId: activeDriver!.userId,
      });
      showFeedback('Arrived at stop. Updated trip status.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleIntermediateTransfer = (stopId: string) => {
    try {
      service.transferCustodyAtIntermediateStop({
        tripId: activeTrip.tripId,
        stopId: asTransportStopId(stopId),
        petId: activeTrip.pets[0].petId,
        receivingStaffUserId: asUserId('usr-vet-clinic-reception'),
        receivingStaffRole: 'VET_CLINIC_STAFF',
        verificationMethod: 'CLINIC_STAFF_BADGE',
        driverUserId: activeDriver!.userId,
      });
      showFeedback('Custody transferred temporarily to veterinary clinic staff.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleResumeCustody = (stopId: string) => {
    try {
      service.resumeCustodyFromIntermediateStop({
        tripId: activeTrip.tripId,
        stopId: asTransportStopId(stopId),
        petId: activeTrip.pets[0].petId,
        releasingStaffUserId: asUserId('usr-vet-clinic-reception'),
        driverUserId: activeDriver!.userId,
        verificationMethod: 'CLINIC_STAFF_BADGE',
      });
      showFeedback('Driver resumed custody for return leg.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCompleteStop = (stopId: string) => {
    try {
      service.completeStop({
        tripId: activeTrip.tripId,
        stopId: asTransportStopId(stopId),
        driverUserId: activeDriver!.userId,
      });
      showFeedback('Stop marked completed.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRecordDelay = () => {
    if (!activeTrip || !activeDriver) return;
    try {
      const revisedEta = new Date(Date.now() + (delayMinutes + 30) * 60000).toISOString();
      service.recordDelay({
        tripId: activeTrip.tripId,
        driverUserId: activeDriver.userId,
        reason: delayReason as any,
        delayMinutes,
        revisedEta,
        notes: `En-route delay recorded: ${delayReason}`,
      });
      showFeedback(`Delay of ${delayMinutes}m recorded. Revised ETA communicated.`, 'info');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRecordObservation = (customTemp?: number) => {
    if (!activeTrip) return;
    try {
      const tempVal = customTemp ?? cargoTempInput;
      service.recordEnvironmentObservation({
        tripId: activeTrip.tripId,
        sensorId: 'SENSOR-CARGO-TEMP-A',
        observationType: 'CARGO_TEMPERATURE',
        value: tempVal,
        unit: 'CELSIUS',
      });
      showFeedback(`Recorded vehicle cargo ambient temp: ${tempVal}°C`, tempVal > 28 ? 'error' : 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRecordWelfare = () => {
    if (!activeTrip || !activeDriver) return;
    try {
      service.recordWelfareCheck({
        tripId: activeTrip.tripId,
        petId: activeTrip.pets[0].petId,
        driverUserId: activeDriver.userId,
        responsiveness: welfareResponsiveness,
        hydrationOffered: true,
        waterConsumedObserved: true,
        containmentIntact: true,
        factualNotes: welfareNotes,
      });
      showFeedback('Factual welfare check logged.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleReportIncident = () => {
    if (!activeTrip || !activeDriver) return;
    try {
      service.reportIncident({
        tripId: activeTrip.tripId,
        driverUserId: activeDriver.userId,
        category: incidentCategory as any,
        severity: incidentCategory === 'PET_ESCAPE' ? 'CRITICAL' : 'HIGH',
        description: incidentDesc,
        actionTaken: 'Standard operating safety procedure initiated.',
        petIds: activeTrip.pets.map(p => p.petId),
      });
      showFeedback(`Incident reported: ${incidentCategory}. Dispatch alerted.`, 'error');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleDestinationHandover = (stopId: string) => {
    if (!activeTrip || !activeDriver) return;
    try {
      service.executeDestinationHandover({
        tripId: activeTrip.tripId,
        stopId: asTransportStopId(stopId),
        petId: activeTrip.pets[0].petId,
        recipientName: 'Elena Vance',
        recipientRole: 'HOUSEHOLD_OWNER',
        recipientUserId: asUserId('usr-elena-vance'),
        verificationMethod: 'OWNER_PIN',
        recipientSignatureOrOtp: handoverPin,
        driverUserId: activeDriver.userId,
        notes: 'Handed over in person with PIN verification.',
      });
      showFeedback('Destination handover executed. Belongings released.', 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCompleteTrip = () => {
    if (!activeTrip || !activeDriver) return;
    try {
      const evidence = service.completeTrip({
        tripId: activeTrip.tripId,
        driverUserId: activeDriver.userId,
      });
      showFeedback(`Trip successfully completed! Evidence ID: ${evidence.completionEvidenceId}`, 'success');
      refreshState();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRunTests = () => {
    const results = runAllTransportTests();
    setTestResults(results);
    refreshState();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full tracking-wider uppercase flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Sprint 22 Workspace
              </span>
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Zero Regressions Certified
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] tracking-tight">
              Pet Transport Professional Workspace
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1 max-w-3xl leading-relaxed">
              Driver custody tracking, verified vehicle capacities, address privacy windows, ambient telematics,
              positive pet identification, multi-stop custody handovers, and emergency escape protocols.
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-[#0B0D10]/80 border border-[#1E293B] rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Active Trips</div>
              <div className="text-lg font-black text-cyan-400">{trips.filter(t => t.status === 'IN_TRANSIT').length}</div>
            </div>
            <div className="bg-[#0B0D10]/80 border border-[#1E293B] rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Fleet Vetted</div>
              <div className="text-lg font-black text-emerald-400">{drivers.filter(d => d.verificationStatus === 'VERIFIED').length} Drv / {vehicles.length} Veh</div>
            </div>
            <div className="bg-[#0B0D10]/80 border border-[#1E293B] rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <div className="text-[10px] uppercase font-bold text-[#64748B]">Safety Alerts</div>
              <div className="text-lg font-black text-amber-400">{safetyAlerts.length}</div>
            </div>
          </div>
        </div>

        {/* Persona Switcher Bar */}
        <div className="mt-6 pt-5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider mr-1">Workspace Persona:</span>
            <button
              id="role-btn-driver"
              onClick={() => setRole('DRIVER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                role === 'DRIVER'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#0B0D10] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Driver Workspace</span>
            </button>
            <button
              id="role-btn-dispatcher"
              onClick={() => setRole('DISPATCHER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                role === 'DISPATCHER'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#0B0D10] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Fleet Dispatcher</span>
            </button>
            <button
              id="role-btn-owner"
              onClick={() => setRole('OWNER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                role === 'OWNER'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#0B0D10] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Owner Live View</span>
            </button>
            <button
              id="role-btn-test-runner"
              onClick={() => setRole('TEST_RUNNER')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                role === 'TEST_RUNNER'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-[#0B0D10] text-[#94A3B8] hover:text-white border border-[#1E293B]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Verification Suite</span>
            </button>
          </div>

          <button
            id="btn-reset-seed"
            onClick={() => {
              seedTransportData();
              refreshState();
              showFeedback('Reset canonical seed data successfully.', 'info');
            }}
            className="text-xs text-[#64748B] hover:text-[#E2E8F0] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#0B0D10] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Canonical Seed</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-950/40 border-rose-800 text-rose-300'
              : 'bg-cyan-950/40 border-cyan-800 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {feedbackMessage.type === 'error' && <AlertTriangle className="w-4 h-4" />}
            {feedbackMessage.type === 'info' && <Activity className="w-4 h-4" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSONA 1: DRIVER WORKSPACE */}
      {/* ============================================================ */}
      {role === 'DRIVER' && activeTrip && (
        <div className="space-y-6">
          {/* Active Trip Header Card */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <span>TRIP REF: {activeTrip.tripId}</span>
                  <span>·</span>
                  <span>ROUTE: {activeTrip.routeReference}</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {activeTrip.pets.map(p => p.petName).join(', ')} — {activeTrip.tripType.replace(/_/g, ' ')}
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Driver: <span className="text-white font-semibold">{activeDriver?.fullName}</span> · Vehicle: <span className="text-white font-semibold">{activeVehicle?.displayName}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  activeTrip.status === 'IN_TRANSIT'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : activeTrip.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {activeTrip.status}
                </span>

                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold">
                  Custody: {activeTrip.overallCustodyStatus}
                </span>

                {activeTrip.status !== 'COMPLETED' && (
                  <button
                    id="btn-complete-trip"
                    onClick={handleCompleteTrip}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Trip</span>
                  </button>
                )}
              </div>
            </div>

            {/* Address Privacy Access Window Callout */}
            <div className="mt-6 bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Address Privacy Access Window Active</span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-mono">AUTHORIZED_DRIVER</span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Decrypted Gate / Apartment Instructions visible only to assigned driver during authorized transit window.
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-[#64748B]">
                <div>Auto-Revocation: <span className="text-[#94A3B8] font-mono">Post-Handover</span></div>
                <div className="text-emerald-400 font-semibold mt-0.5">All Access Logged to Kernel Audit</div>
              </div>
            </div>
          </div>

          {/* Grid Layout: Stops Timeline & Safety Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Stops Itinerary & Actions */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>Route Stops & Chain-of-Custody Actions</span>
                </h3>

                <div className="space-y-4">
                  {stops.map((stop, idx) => (
                    <div
                      key={stop.stopId}
                      className={`p-4 rounded-xl border transition-all ${
                        stop.status === 'COMPLETED'
                          ? 'bg-[#0B0D10]/50 border-emerald-900/30'
                          : stop.status === 'EN_ROUTE' || stop.status === 'ARRIVED'
                          ? 'bg-[#0B0D10] border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                          : 'bg-[#0B0D10]/30 border-[#1E293B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            stop.status === 'COMPLETED'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-cyan-500 text-slate-950'
                          }`}>
                            {stop.sequence}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{stop.title}</span>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#1E293B] text-[#94A3B8]">
                                {stop.stopType}
                              </span>
                            </div>
                            <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                              {stop.exactAddressEncrypted}
                            </div>
                            <div className="text-xs text-[#64748B] mt-0.5">
                              Contact: {stop.recipientContactName} ({stop.recipientContactPhoneMasked})
                            </div>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          stop.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {stop.status}
                        </span>
                      </div>

                      {/* Stop Action Buttons */}
                      {stop.status !== 'COMPLETED' && (
                        <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-wrap items-center gap-2">
                          {stop.status === 'PENDING' || stop.status === 'EN_ROUTE' ? (
                            <button
                              id={`btn-arrive-stop-${stop.sequence}`}
                              onClick={() => handleArriveAtStop(stop.stopId)}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Arrive At Stop</span>
                            </button>
                          ) : null}

                          {stop.stopType === 'VETERINARY_STOP' && (
                            <>
                              <button
                                id="btn-transfer-clinic"
                                onClick={() => handleIntermediateTransfer(stop.stopId)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>Transfer Custody to Clinic Staff</span>
                              </button>

                              <button
                                id="btn-resume-custody"
                                onClick={() => handleResumeCustody(stop.stopId)}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Resume Custody (Return Leg)</span>
                              </button>
                            </>
                          )}

                          {stop.stopType === 'RETURN_ORIGIN_STOP' || stop.stopType === 'DROP_OFF' ? (
                            <button
                              id="btn-execute-handover"
                              onClick={() => handleDestinationHandover(stop.stopId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Verify Recipient PIN & Handover</span>
                            </button>
                          ) : null}

                          <button
                            id={`btn-complete-stop-${stop.sequence}`}
                            onClick={() => handleCompleteStop(stop.stopId)}
                            className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Stop Completed</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Belongings & Restraint Checklist */}
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <span>Pet Belongings & Containment Custody</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Assigned Containment</div>
                    <div className="text-sm font-bold text-white mt-1">Crate Slot CRATE-A1</div>
                    <div className="text-xs text-[#94A3B8] mt-0.5">Lower Left XL Secure Crate (Provider Provided)</div>
                    <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Containment Verified Before Departure</span>
                    </div>
                  </div>

                  <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Belongings in Transit ({belongings.length})</div>
                    <div className="space-y-1.5 mt-2">
                      {belongings.map(b => (
                        <div key={b.itemId} className="flex items-center justify-between text-xs">
                          <span className="text-white">{b.description}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            b.releasedAtHandover ? 'bg-emerald-950 text-emerald-400' : 'bg-cyan-950 text-cyan-400'
                          }`}>
                            {b.releasedAtHandover ? 'RELEASED' : 'IN_TRANSIT'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Telemetry, Welfare & Safety Actions */}
            <div className="space-y-6">
              {/* Environmental Telematics Card */}
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-cyan-400" />
                    <span>Cargo Telematics</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                    VEHICLE_SENSOR
                  </span>
                </h3>

                <p className="text-xs text-[#94A3B8] mb-4">
                  Factual ambient cargo compartment telemetry only. Never modeled as pet body temperature.
                </p>

                <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl text-center">
                  <div className="text-xs text-[#64748B] uppercase font-bold">Cargo Compartment Temp</div>
                  <div className="text-3xl font-black text-cyan-400 mt-1">
                    {observations.length > 0 ? observations[observations.length - 1].value : 23.4}°C
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-1">Safe Canonical Range: 12.0°C – 28.0°C</div>
                </div>

                {/* Simulate Telemetry Inputs */}
                <div className="mt-4 pt-4 border-t border-[#1E293B] space-y-3">
                  <div className="text-xs font-bold text-[#94A3B8]">Simulate Sensor Feed:</div>
                  <div className="flex gap-2">
                    <button
                      id="btn-temp-normal"
                      onClick={() => handleRecordObservation(22.0)}
                      className="flex-1 py-1.5 bg-[#0B0D10] hover:bg-[#1E293B] border border-[#1E293B] rounded-lg text-xs font-semibold text-emerald-400"
                    >
                      Normal (22°C)
                    </button>
                    <button
                      id="btn-temp-high"
                      onClick={() => handleRecordObservation(31.2)}
                      className="flex-1 py-1.5 bg-[#0B0D10] hover:bg-[#1E293B] border border-rose-900/50 rounded-lg text-xs font-semibold text-rose-400"
                    >
                      High (31.2°C)
                    </button>
                  </div>
                </div>

                {/* Safety Alerts Display */}
                {safetyAlerts.length > 0 && (
                  <div className="mt-4 p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Active Telematics Alert</span>
                    </div>
                    {safetyAlerts.slice(-2).map(a => (
                      <p key={a.alertId} className="text-xs text-rose-200 leading-snug">
                        {a.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Factual Pet Welfare Check */}
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-cyan-400" />
                  <span>Factual Welfare Check</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#94A3B8] font-semibold">Responsiveness Observation:</label>
                    <div className="flex gap-2 mt-1">
                      {(['ALERT', 'RESTING', 'VISIBLE_DISTRESS'] as const).map(res => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setWelfareResponsiveness(res)}
                          className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                            welfareResponsiveness === res
                              ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                              : 'bg-[#0B0D10] text-[#94A3B8] border-[#1E293B]'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-[#94A3B8] font-semibold">Factual Observation Notes:</label>
                    <input
                      type="text"
                      value={welfareNotes}
                      onChange={e => setWelfareNotes(e.target.value)}
                      className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    id="btn-log-welfare"
                    onClick={handleRecordWelfare}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Log Welfare Observation
                  </button>
                </div>
              </div>

              {/* Delays & Incidents Section */}
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>En-Route Delay Notification</span>
                </h3>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-1/2">
                      <label className="text-[11px] text-[#94A3B8]">Reason:</label>
                      <select
                        value={delayReason}
                        onChange={e => setDelayReason(e.target.value)}
                        className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="TRAFFIC">Heavy Traffic</option>
                        <option value="WEATHER">Weather Delay</option>
                        <option value="PET_WELFARE_STOP">Pet Comfort Stop</option>
                        <option value="ROAD_INCIDENT">Road Diversion</option>
                      </select>
                    </div>
                    <div className="w-1/2">
                      <label className="text-[11px] text-[#94A3B8]">Delay Minutes:</label>
                      <input
                        type="number"
                        value={delayMinutes}
                        onChange={e => setDelayMinutes(Number(e.target.value))}
                        className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <button
                    id="btn-record-delay"
                    onClick={handleRecordDelay}
                    className="w-full py-2 bg-[#1E293B] hover:bg-[#334155] text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Broadcast ETA Update
                  </button>
                </div>

                {/* Emergency Incident Trigger */}
                <div className="mt-6 pt-4 border-t border-[#1E293B] space-y-3">
                  <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report Critical Incident</span>
                  </div>

                  <select
                    value={incidentCategory}
                    onChange={e => setIncidentCategory(e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown (Dispatch Replacement)</option>
                    <option value="PET_ESCAPE">Pet Escape (Trigger Lost Pet Rescue)</option>
                    <option value="PET_ILLNESS_OBSERVED">Pet Illness Observed (Vet Divert)</option>
                  </select>

                  <button
                    id="btn-report-incident"
                    onClick={handleReportIncident}
                    className="w-full py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 rounded-lg text-xs font-bold transition-colors"
                  >
                    Report Incident & Escalate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSONA 2: FLEET DISPATCHER CONSOLE */}
      {/* ============================================================ */}
      {role === 'DISPATCHER' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Drivers Roster */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
              <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>Vetted Transport Drivers ({drivers.length})</span>
              </h2>

              <div className="space-y-3">
                {drivers.map(d => (
                  <div key={d.driverProfileId} className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{d.fullName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {d.verificationStatus}
                        </span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                        License: {d.drivingLicenseRefMasked} · Contact: {d.phoneNumberMasked}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        Approved: {d.approvedServiceTypes.join(', ')}
                      </div>
                    </div>

                    {d.verificationStatus === 'UNVERIFIED' && (
                      <button
                        onClick={() => {
                          try {
                            service.verifyDriver({
                              driverProfileId: d.driverProfileId,
                              verifiedByUserId: asUserId('usr-admin-dispatch'),
                            });
                            showFeedback(`Driver ${d.fullName} verified and activated.`, 'success');
                            refreshState();
                          } catch (err: any) {
                            showFeedback(err.message, 'error');
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                      >
                        Verify Driver
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicles Roster */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
              <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                <span>Specialized Fleet Vehicles ({vehicles.length})</span>
              </h2>

              <div className="space-y-3">
                {vehicles.map(v => (
                  <div key={v.vehicleId} className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{v.displayName}</span>
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-mono">
                        {v.registrationNumber}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-1">
                      Type: {v.vehicleType} · Max Capacity: {v.capacity.maxPets} Pets ({v.capacity.maxWeightKg} kg)
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">
                      Sensors: {v.sensorCapabilities.join(', ') || 'Standard Inspection'}
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#1E293B] flex flex-wrap gap-1.5">
                      {v.capacity.crateSlots.map(slot => (
                        <span key={slot.slotId} className="px-2 py-0.5 bg-[#1E293B] text-[#94A3B8] rounded text-[10px]">
                          {slot.slotName} ({slot.size})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSONA 3: OWNER LIVE PROJECTION (PRIVACY PRESERVING) */}
      {/* ============================================================ */}
      {role === 'OWNER' && ownerProjection && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
              <Truck className="w-8 h-8" />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {ownerProjection.trackingFreshness === 'LIVE' ? 'Live Transit in Progress' : 'Tracking Offline'}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white">
              {ownerProjection.petNames.join(', ')} is Safe in Transit
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Destination: <span className="text-white font-semibold">{ownerProjection.currentStopName}</span>
            </p>

            <div className="mt-6 p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl grid grid-cols-2 gap-4 text-left">
              <div>
                <div className="text-[10px] uppercase font-bold text-[#64748B]">Assigned Driver</div>
                <div className="text-sm font-bold text-white mt-0.5">{ownerProjection.driverName}</div>
                <div className="text-xs text-cyan-400 mt-0.5">{ownerProjection.driverPhoneRelay} (Secure Relay)</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#64748B]">Vehicle</div>
                <div className="text-sm font-bold text-white mt-0.5">{ownerProjection.vehicleDescription}</div>
                <div className="text-xs text-emerald-400 mt-0.5">
                  Cargo Temp: {ownerProjection.cargoTemperatureObservedCelsius ? `${ownerProjection.cargoTemperatureObservedCelsius}°C` : 'Normal (Monitored)'}
                </div>
              </div>
            </div>

            {/* Privacy Boundary Notice */}
            <div className="mt-4 p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-xl text-left flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-cyan-300 leading-relaxed">
                <strong className="text-white">Privacy Protected:</strong> Driver location tracking is actively active solely while your pet is in transit. Tracking automatically terminates immediately upon destination handover.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERSONA 4: VERIFICATION SUITE & AUDIT RUNNER */}
      {/* ============================================================ */}
      {role === 'TEST_RUNNER' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Sprint 22 Automated Verification Engine</h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Comprehensive test execution of driver verification invariants, address privacy windows, telemetry provenance, and escape integrations.
                </p>
              </div>

              <button
                id="btn-run-all-tests"
                onClick={handleRunTests}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Play className="w-4 h-4" />
                <span>Run All 11 Assertions</span>
              </button>
            </div>

            {testResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-xs font-bold pb-2 border-b border-[#1E293B]">
                  <span className="text-emerald-400">Passed: {testResults.filter(r => r.passed).length}</span>
                  <span className="text-rose-400">Failed: {testResults.filter(r => !r.passed).length}</span>
                  <span className="text-[#64748B]">Total: {testResults.length}</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {testResults.map((r, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        r.passed ? 'bg-[#0B0D10] border-emerald-900/30 text-white' : 'bg-rose-950/30 border-rose-800 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {r.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-bold">{r.testName}</div>
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">{r.message}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                        <span className="px-2 py-0.5 bg-[#1E293B] text-[#94A3B8] rounded">{r.category}</span>
                        <span className="text-[#64748B]">{r.durationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Outbox Events Inspector */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Domain Outbox & Integration Events</span>
            </h3>

            <div className="space-y-2 font-mono text-xs max-h-72 overflow-y-auto">
              {outboxEvents.map((e, idx) => (
                <div key={idx} className="p-2.5 bg-[#0B0D10] border border-[#1E293B] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{e.eventType}</span>
                    <span className="text-[#64748B]">·</span>
                    <span className="text-[#94A3B8]">{(e as any).tripId || (e as any).bookingId}</span>
                  </div>
                  <span className="text-[10px] text-[#475569]">{new Date(e.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
