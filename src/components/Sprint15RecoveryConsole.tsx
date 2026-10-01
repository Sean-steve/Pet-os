import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Compass,
  AlertOctagon,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { RecoveryService } from '../pet-os/recovery/service';
import { runSprint15RecoveryTests } from '../pet-os/recovery/tests';
import {
  LostPetIncident,
  SafeZone,
  PublicRecoveryProfile,
  LostPetSighting,
} from '../pet-os/recovery/types';
import {
  asHouseholdId,
  asUserId,
  asPetId,
  asLostPetIncidentId,
} from '../pet-os/kernel/ids';
import { PetStore } from '../pet-os/pet-core/store';

export const Sprint15RecoveryConsole: React.FC = () => {
  const service = useMemo(() => RecoveryService.getInstance(), []);

  const [activeTab, setActiveTab] = useState<'incidents' | 'safezones' | 'sightings' | 'tests'>('incidents');
  const [incidents, setIncidents] = useState<LostPetIncident[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [sightings, setSightings] = useState<LostPetSighting[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<LostPetIncident | null>(null);

  // New incident modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [incidentPetId, setIncidentPetId] = useState('pet-kibo-ridgeback-001');
  const [incidentArea, setIncidentArea] = useState('Kilimani near Menelik Rd');
  const [incidentNotes, setIncidentNotes] = useState('Wearing blue reflective collar with Pet OS QR tag.');

  // Sighting report modal
  const [showSightingModal, setShowSightingModal] = useState(false);
  const [sightingDesc, setSightingDesc] = useState('');
  const [sightingAreaInput, setSightingAreaInput] = useState('');

  // Test suite execution
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ total: number; passed: number; results: any[] } | null>(null);

  const refreshData = () => {
    const active = service.getActiveIncidents();
    setIncidents(active);
    if (active.length > 0 && (!selectedIncident || !active.some(i => i.lostPetIncidentId === selectedIncident.lostPetIncidentId))) {
      setSelectedIncident(active[0]);
    }

    const householdId = asHouseholdId('hsh-elena-vance-001');
    const zones = service.getSafeZonesForHousehold(householdId);
    setSafeZones(zones.length > 0 ? zones : service.getSafeZones());

    if (selectedIncident) {
      const s = service.getSightingsForIncident(selectedIncident.lostPetIncidentId);
      setSightings(s);
    }
  };

  useEffect(() => {
    refreshData();
  }, [service]);

  useEffect(() => {
    if (selectedIncident) {
      const s = service.getSightingsForIncident(selectedIncident.lostPetIncidentId);
      setSightings(s);
    }
  }, [selectedIncident]);

  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { incident } = service.reportLostPetIncident({
        householdId: asHouseholdId('hsh-elena-vance-001'),
        reportedByUserId: asUserId('usr-elena-vance-001'),
        petId: asPetId(incidentPetId),
        missingSince: new Date().toISOString(),
        lastKnownLocation: {
          latitude: -1.286389,
          longitude: 36.817223,
          coarseDescription: incidentArea,
        },
        coarseSearchArea: {
          neighborhood: 'Kilimani',
          district: 'Dagoretti North',
          city: 'Nairobi',
          county: 'Nairobi County',
          centerLatitude: -1.286389,
          centerLongitude: 36.817223,
          radiusKm: 2.0,
        },
        ownerInstructions: incidentNotes,
      });

      setShowReportModal(false);
      setSelectedIncident(incident);
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleActivateCommunityAlert = (incidentId: string) => {
    try {
      service.activateCommunityAlert(asLostPetIncidentId(incidentId), asUserId('usr-elena-vance-001'));
      refreshData();
      alert('Community Alert broadcast dispatched to Sprint 16 Recovery Network!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmRecovery = (incidentId: string) => {
    const notes = prompt('Enter recovery resolution notes:', 'Pet located safely and reunited with family.');
    if (!notes) return;

    try {
      service.confirmRecovery({
        incidentId: asLostPetIncidentId(incidentId),
        actorUserId: asUserId('usr-elena-vance-001'),
        resolutionNotes: notes,
      });
      refreshData();
      alert('Incident closed and public recovery token revoked.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReportSighting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    try {
      service.reportSighting({
        lostPetIncidentId: selectedIncident.lostPetIncidentId,
        reporterUserId: asUserId('usr-sarah-mwangi-002'),
        reporterName: 'Sarah Mwangi',
        sightingTimestamp: new Date().toISOString(),
        latitude: -1.2870,
        longitude: 36.7860,
        coarseDescription: sightingAreaInput,
        notes: sightingDesc,
        reportedVia: 'COMMUNITY_ALERT',
      });

      setShowSightingModal(false);
      setSightingDesc('');
      setSightingAreaInput('');
      refreshData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const runTests = async () => {
    setTestRunning(true);
    try {
      const res = await runSprint15RecoveryTests();
      setTestResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setTestRunning(false);
    }
  };

  const currentPet = selectedIncident ? PetStore.findPetById(selectedIncident.petId) : undefined;
  const currentPublicProfile: PublicRecoveryProfile | undefined = selectedIncident
    ? service.getPublicProfileById(selectedIncident.recoveryProfileReference)
    : undefined;

  return (
    <div className="space-y-6">
      {/* Domain Top Hero */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                SPRINT 15 ARCHITECTURE
              </span>
              <span className="text-xs text-slate-400 font-mono">Geofencing, Lost Pet Mode &amp; Recovery Profiles</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
              <ShieldAlert className="w-7 h-7 text-amber-400" />
              Emergency Recovery &amp; Safe Zones
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Deterministic hysteresis geofencing, lost pet incident lifecycle, cryptographic 
              public recovery profiles with zero data leakage, and automated anti-extortion scanning.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-report-lost-pet"
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Report Lost Pet</span>
            </button>
            <button
              onClick={refreshData}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub navigation */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'incidents'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Active Incidents ({incidents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('safezones')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'safezones'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Safe Zones &amp; Geofences ({safeZones.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sightings')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'sightings'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Sightings &amp; Ingestion ({sightings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ml-auto ${
            activeTab === 'tests'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
              : 'text-amber-400 hover:bg-amber-950/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sprint 15 Tests (5 Tests)</span>
        </button>
      </div>

      {/* Incidents View */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          {incidents.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-semibold text-slate-200">All Household Pets Accounted For</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No active lost pet incidents exist in the recovery registry. Click "Report Lost Pet" to simulate an escape and generate a public recovery profile.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Incident selection list */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Search Incidents</h3>
                {incidents.map((inc) => {
                  const pet = PetStore.findPetById(inc.petId);
                  const isSelected = selectedIncident?.lostPetIncidentId === inc.lostPetIncidentId;
                  return (
                    <div
                      key={inc.lostPetIncidentId}
                      onClick={() => setSelectedIncident(inc)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-lg'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-sm">{pet?.name || 'Pet'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {inc.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Search: {inc.coarseSearchArea.neighborhood}, {inc.coarseSearchArea.city}</p>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Missing since: {new Date(inc.missingSince).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Incident Detail & Public Profile Card */}
              {selectedIncident && (
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-slate-100">{currentPet?.name}</h3>
                          <span className="text-xs text-amber-400 font-mono">({selectedIncident.status})</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Public Profile Ref: <code className="text-slate-300 font-mono">{selectedIncident.recoveryProfileReference}</code>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!selectedIncident.isCommunityAlertRequested && (
                          <button
                            onClick={() => handleActivateCommunityAlert(selectedIncident.lostPetIncidentId)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 text-slate-950 hover:bg-rose-400 transition-colors cursor-pointer"
                          >
                            Broadcast to Sprint 16
                          </button>
                        )}
                        <button
                          onClick={() => handleConfirmRecovery(selectedIncident.lostPetIncidentId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                        >
                          Confirm Recovered
                        </button>
                      </div>
                    </div>

                    {/* Public Profile View (Minimization verification) */}
                    {currentPublicProfile && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-amber-400" />
                            Public QR / Tag Recovery Landing Page (Sanitized)
                          </span>
                          <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            No Stalker GPS / No Microchips
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Pet Name</span>
                            <span className="font-bold">{currentPublicProfile.petDisplayName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Species &amp; Breed</span>
                            <span>{currentPublicProfile.species} · {currentPublicProfile.breed || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Coarse Area</span>
                            <span>{currentPublicProfile.coarseMissingArea}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Emergency Medical Notes</span>
                            <span>{currentPublicProfile.emergencyMedicalNotes || 'None'}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                          <span className="text-slate-400 italic">"{currentPublicProfile.ownerInstructions}"</span>
                          <button
                            onClick={() => setShowSightingModal(true)}
                            className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] cursor-pointer"
                          >
                            Log Sighting
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Safe Zones View */}
      {activeTab === 'safezones' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {safeZones.map((zone) => (
              <div key={zone.safeZoneId} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-base">{zone.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {zone.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{zone.zoneType} · Radius: {zone.radiusMeters}m</p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1 text-slate-300 font-mono text-[11px]">
                  <div>Center: [{zone.centerLatitude.toFixed(4)}, {zone.centerLongitude.toFixed(4)}]</div>
                  <div>Hysteresis Debounce: {zone.hysteresisBufferMeters}m</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sightings View */}
      {activeTab === 'sightings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Incident Sightings Queue</h3>
            <span className="text-xs text-slate-400">All sightings validated by Anti-Extortion Scanner</span>
          </div>

          {sightings.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/50 text-center text-xs text-slate-400">
              No sightings reported yet for this incident.
            </div>
          ) : (
            sightings.map((s) => (
              <div key={s.sightingId} className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{s.location.coarseDescription}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-slate-300">{s.notes}</p>
                <div className="text-[11px] text-slate-500">Timestamp: {new Date(s.sightingTimestamp).toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Test Runner */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Sprint 15 Verification Suite
              </h2>
              <p className="text-xs text-slate-400">
                Safe zones, lost pet mode, public token revocation, and extortion detection tests.
              </p>
            </div>
            <button
              id="btn-run-recovery-tests"
              onClick={runTests}
              disabled={testRunning}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {testRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{testRunning ? 'Running Tests...' : 'Execute Test Suite'}</span>
            </button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200">
                  Tests Passed: {testResults.passed} / {testResults.total}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${testResults.passed === testResults.total ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'}`}>
                  {testResults.passed === testResults.total ? '100% ALL VERIFIED' : 'TESTS FAILED'}
                </span>
              </div>

              <div className="space-y-2">
                {testResults.results.map((res: any, i: number) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-2.5">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-200">{res.name}</div>
                        {res.error && <div className="text-rose-400 text-[11px] mt-1 font-mono">{res.error}</div>}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {res.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sighting Modal */}
      {showSightingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleReportSighting} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-slate-100">Log Verified Sighting</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Coarse Area / Landmark</label>
              <input
                type="text"
                required
                value={sightingAreaInput}
                onChange={(e) => setSightingAreaInput(e.target.value)}
                placeholder="e.g. Menelik Rd / Chania intersection"
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Visual Notes</label>
              <textarea
                required
                rows={3}
                value={sightingDesc}
                onChange={(e) => setSightingDesc(e.target.value)}
                placeholder="Observed pet resting under shade..."
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSightingModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
              >
                Submit Sighting
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
