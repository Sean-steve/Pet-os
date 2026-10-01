/**
 * Pet OS Sprint 21 - Professional Care Workspaces Console
 * Groomer, Pet Sitter & Boarding Workspaces, Care Handover, Custody,
 * Medication/Feeding Execution, Incidents & Multi-Domain Service Completion.
 */

import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Home,
  Building2,
  ShieldCheck,
  AlertTriangle,
  ClipboardCheck,
  Lock,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Heart,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Play,
  FileText,
  Key,
  Flame,
  AlertOctagon,
  ChevronRight,
  Info,
} from 'lucide-react';

import {
  CareEngagementId,
  GroomingSessionId,
  SitterVisitId,
  BoardingStayId,
  PetId,
  UserId,
  asCareEngagementId,
} from '../pet-os/kernel/ids';

import { ProfessionalCareStore } from '../pet-os/professional-care/store';
import { ProfessionalCareService } from '../pet-os/professional-care/service';
import { seedProfessionalCareData, SEED_CARE_USERS } from '../pet-os/professional-care/seed';
import { runSprint21Tests, TestResult } from '../pet-os/professional-care/tests';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import { PetStore } from '../pet-os/pet-core/store';
import { HealthStore } from '../pet-os/health/store';

import {
  ProfessionalCareEngagement,
  CareServiceType,
  GroomingSession,
  SitterVisit,
  BoardingStay,
  BoardingUnit,
  CareShiftHandover,
  CareCompletionEvidence,
  CareServiceIncident,
  CareAccessSecret,
  GroomingProcedureType,
} from '../pet-os/professional-care/types';

export function Sprint21CareConsole() {
  const store = ProfessionalCareStore.getInstance();
  const service = ProfessionalCareService.getInstance();

  // Active Workspace Sub-Tab
  const [activeTab, setActiveTab] = useState<
    'dispatch' | 'grooming' | 'sitting' | 'boarding' | 'custody' | 'incidents' | 'diagnostics'
  >('dispatch');

  // Active Actor Switcher
  const [currentActor, setCurrentActor] = useState<{ id: UserId; name: string; role: string }>({
    id: SEED_CARE_USERS.GROOMER_CHLOE,
    name: 'Chloe Wanjiku',
    role: 'Master Groomer (Apex Loft)',
  });

  // State
  const [engagements, setEngagements] = useState<ProfessionalCareEngagement[]>([]);
  const [selectedEngagement, setSelectedEngagement] = useState<ProfessionalCareEngagement | null>(null);
  const [groomingSession, setGroomingSession] = useState<GroomingSession | null>(null);
  const [sitterVisits, setSitterVisits] = useState<SitterVisit[]>([]);
  const [boardingStays, setBoardingStays] = useState<BoardingStay[]>([]);
  const [boardingUnits, setBoardingUnits] = useState<BoardingUnit[]>([]);
  const [shiftHandovers, setShiftHandovers] = useState<CareShiftHandover[]>([]);
  const [incidents, setIncidents] = useState<CareServiceIncident[]>([]);
  const [accessSecret, setAccessSecret] = useState<CareAccessSecret | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  // Grooming Allergy Test State
  const [allergyTestResult, setAllergyTestResult] = useState<{ safe: boolean; message: string } | null>(null);

  // Test Suite State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Flash Feedback Notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = () => {
    const allEngs = store.listEngagements();
    setEngagements(allEngs);

    if (allEngs.length > 0 && !selectedEngagement) {
      setSelectedEngagement(allEngs[0]);
    } else if (selectedEngagement) {
      const updated = store.getEngagement(selectedEngagement.engagementId);
      if (updated) setSelectedEngagement(updated);
    }

    // Load active grooming session
    const groomEng = allEngs.find((e) => e.serviceType === 'GROOMING');
    if (groomEng) {
      const gs = store.getGroomingSessionByEngagementId(groomEng.engagementId);
      if (gs) setGroomingSession(gs);
    }

    // Load sitting visits & secret
    const sitEng = allEngs.find((e) => e.serviceType === 'PET_SITTING_VISIT');
    if (sitEng) {
      setSitterVisits(store.listSitterVisitsForEngagement(sitEng.engagementId));
      const sec = store.getSecretByEngagementId(sitEng.engagementId);
      if (sec) setAccessSecret(sec);
    }

    // Load boarding stays & units
    const boardEng = allEngs.find((e) => e.serviceType === 'BOARDING');
    setBoardingUnits(store.listBoardingUnits());
    if (boardEng && boardEng.businessId) {
      setBoardingStays(store.listBoardingStays(boardEng.businessId));
      setShiftHandovers(store.listShiftHandovers(boardEng.businessId));
    }

    setIncidents(store.listAllIncidents());
  };

  useEffect(() => {
    if (store.listEngagements().length === 0) {
      seedProfessionalCareData();
    }
    loadData();
    const unsub = store.subscribe(() => loadData());
    return () => unsub();
  }, []);

  // Handlers
  const handleResetData = () => {
    seedProfessionalCareData();
    loadData();
    showFeedback('success', 'Professional Care data reseeded to canonical state.');
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await runSprint21Tests();
      setTestResults(res.results);
      loadData();
      if (res.failed === 0) {
        showFeedback('success', `All ${res.passed} Sprint 21 test scenarios verified cleanly!`);
      } else {
        showFeedback('error', `${res.failed} scenario(s) failed assertion checks.`);
      }
    } catch (err: any) {
      showFeedback('error', `Test runner error: ${err.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Grooming Procedure Toggle
  const handleToggleProcedure = (procedureType: GroomingProcedureType) => {
    if (!groomingSession) return;
    try {
      service.completeGroomingProcedure({
        sessionId: groomingSession.sessionId,
        procedureType,
        notes: `Completed with standard professional technique by ${currentActor.name}.`,
      });
      loadData();
      showFeedback('success', `Completed procedure: ${procedureType.replace(/_/g, ' ')}`);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Grooming Product Screening
  const handleTestProduct = (productName: string, ingredients: string[]) => {
    if (!groomingSession) return;
    try {
      service.applyGroomingProduct({
        sessionId: groomingSession.sessionId,
        productName,
        productType: 'SHAMPOO',
        productIngredients: ingredients,
      });
      setAllergyTestResult({
        safe: true,
        message: `PASSED ALLERGY SCREEN: Product "${productName}" is verified safe. No allergen conflicts detected.`,
      });
      loadData();
      showFeedback('success', `Product "${productName}" passed allergy screening.`);
    } catch (err: any) {
      setAllergyTestResult({
        safe: false,
        message: err.message,
      });
      showFeedback('error', 'Allergy conflict detected! Product blocked for pet safety.');
    }
  };

  // Grooming Safety Stop
  const handleTriggerSafetyStop = () => {
    if (!groomingSession) return;
    try {
      service.triggerGroomingSafetyStop({
        sessionId: groomingSession.sessionId,
        actorUserId: currentActor.id,
        reason: 'Pet exhibited acute agitation during drying phase. Halted immediately per safety protocol.',
      });
      loadData();
      showFeedback('error', 'SAFETY STOP TRIGGERED: Grooming session halted. Return handover initiated.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Reveal Keypad Code
  const handleRevealSecret = () => {
    if (!accessSecret) return;
    try {
      const res = service.revealHomeAccessSecret({
        secretId: accessSecret.secretId,
        actorUserId: currentActor.id,
        accessReason: 'Arrived on-site for scheduled sitting visit.',
      });
      setRevealedSecret(res.revealedSecret);
      loadData();
      showFeedback('success', 'Home-access keypad code securely decrypted and audited.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Feeding Execution
  const handleExecuteFeeding = (petId: PetId, foodName: string, grams: number) => {
    const sitEng = engagements.find((e) => e.serviceType === 'PET_SITTING_VISIT');
    if (!sitEng) return;
    try {
      const res = service.executeFeeding({
        engagementId: sitEng.engagementId,
        petId,
        actorUserId: currentActor.id,
        foodName,
        quantityGrams: grams,
        notes: 'Ate enthusiastically, fresh water refreshed.',
      });
      loadData();
      showFeedback('success', res.message);
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Medication Execution
  const handleAdministerMedication = (
    petId: PetId,
    medId: string,
    medName: string,
    dosage: string,
    attemptWrongDose = false
  ) => {
    const sitEng = engagements.find((e) => e.serviceType === 'PET_SITTING_VISIT');
    if (!sitEng) return;
    const doseToGive = attemptWrongDose ? '5.0 mg (Modified by Sitter)' : dosage;
    try {
      const res = service.administerMedication({
        engagementId: sitEng.engagementId,
        petId,
        actorUserId: currentActor.id,
        medicationId: medId,
        medicationName: medName,
        dosageGiven: doseToGive,
        administrationStatus: 'ADMINISTERED',
      });
      loadData();
      showFeedback('success', res.message);
    } catch (err: any) {
      loadData();
      showFeedback('error', err.message);
    }
  };

  // Shift Handover Acknowledge
  const handleAcknowledgeShift = (shiftId: any) => {
    try {
      service.acknowledgeShiftHandover(shiftId, currentActor.id);
      loadData();
      showFeedback('success', 'Shift handover acknowledged and confirmed.');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Custody Return Handover & Completion
  const handleReturnHandoverAndComplete = async (engagement: ProfessionalCareEngagement) => {
    try {
      // 1. Handover back to owner
      for (const petId of engagement.petIds) {
        service.executeHandover({
          engagementId: engagement.engagementId,
          petId,
          handoverType: 'PROVIDER_TO_OWNER',
          fromActorId: currentActor.id,
          toActorId: CANONICAL_IDS.OWNER_ELENA,
          recipientName: 'Elena Vance (Pet Owner)',
          checklist: {
            collarAndTagVerified: true,
            leashOrCarrierSecure: true,
            petPhysicalStateObserved: true,
            personalBelongingsTransferred: true,
            emergencyContactConfirmed: true,
          },
          notes: 'Pet returned happily to owner in healthy condition.',
        });
      }

      // 2. Finalize service execution
      const evidence = await service.finalizeServiceExecution({
        engagementId: engagement.engagementId,
        actorUserId: currentActor.id,
        outcome: 'COMPLETED',
        summaryNotes: 'Service executed flawlessly. All scheduled care performed and documented.',
        returnedToName: 'Elena Vance',
      });

      loadData();
      showFeedback(
        'success',
        `Service Completed! Evidence #${evidence.evidenceId.substring(0, 12)}... created. Booking & Financial fulfillment synchronized.`
      );
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  // Report Escape Incident
  const handleReportEscapeIncident = (petId: PetId) => {
    const sitEng = engagements.find((e) => e.serviceType === 'PET_SITTING_VISIT') || engagements[0];
    if (!sitEng) return;
    try {
      service.reportIncident({
        engagementId: sitEng.engagementId,
        petId,
        category: 'ESCAPE',
        severity: 'CRITICAL',
        details: 'Pet slipped collar near facility exterior gate. Active perimeter search underway.',
        actionsTaken: ['Immediate chase', 'Owner notified', 'Lost pet broadcast dispatched to community mesh'],
        reportedBy: currentActor.id,
        lastKnownCoordinates: { latitude: -1.2921, longitude: 36.8219 },
      });
      loadData();
      showFeedback('error', 'CRITICAL INCIDENT: Lost Pet broadcast dispatched to Recovery Platform mesh!');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  return (
    <div className="space-y-6" id="sprint21-care-console">
      {/* Top Banner & Context Controls */}
      <div className="bg-[#13161C] border border-zinc-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-teal-500/20 to-indigo-500/20 border border-teal-500/30 rounded-xl text-teal-400">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full">
                  Sprint 21 Foundation
                </span>
                <h2 className="text-lg font-bold text-zinc-100">
                  Professional Care Workspaces
                </h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Unified operations for Groomers, In-Home Pet Sitters & Boarding Facilities.
                Enforces custody tracking, immutable care instruction snapshots, audited time-bound home access,
                safe medication execution, and strict non-diagnostic medical boundaries.
              </p>
            </div>
          </div>

          {/* Actor Switcher & Diagnostic Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-zinc-900 border border-zinc-700/60 rounded-xl px-3 py-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400 mr-2" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-zinc-500 font-semibold">Active Professional Actor</span>
                <select
                  value={currentActor.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === SEED_CARE_USERS.GROOMER_CHLOE) {
                      setCurrentActor({
                        id: SEED_CARE_USERS.GROOMER_CHLOE,
                        name: 'Chloe Wanjiku',
                        role: 'Master Groomer (Apex Loft)',
                      });
                    } else if (val === SEED_CARE_USERS.SITTER_SARAH) {
                      setCurrentActor({
                        id: SEED_CARE_USERS.SITTER_SARAH,
                        name: 'Sarah Mwangi',
                        role: 'Pet Sitter & Walker',
                      });
                    } else if (val === SEED_CARE_USERS.BOARDING_DAVID) {
                      setCurrentActor({
                        id: SEED_CARE_USERS.BOARDING_DAVID,
                        name: 'David Kiprono',
                        role: 'Facility Director (Pet Haven)',
                      });
                    } else if (val === SEED_CARE_USERS.BOARDING_STAFF_FAITH) {
                      setCurrentActor({
                        id: SEED_CARE_USERS.BOARDING_STAFF_FAITH,
                        name: 'Faith Mutua',
                        role: 'Shift Lead (Pet Haven)',
                      });
                    } else {
                      setCurrentActor({
                        id: CANONICAL_IDS.OWNER_ELENA,
                        name: 'Elena Vance',
                        role: 'Household Pet Owner',
                      });
                    }
                  }}
                  className="bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-pointer"
                >
                  <option value={SEED_CARE_USERS.GROOMER_CHLOE} className="bg-zinc-900">
                    Chloe Wanjiku (Master Groomer)
                  </option>
                  <option value={SEED_CARE_USERS.SITTER_SARAH} className="bg-zinc-900">
                    Sarah Mwangi (Pet Sitter)
                  </option>
                  <option value={SEED_CARE_USERS.BOARDING_DAVID} className="bg-zinc-900">
                    David Kiprono (Facility Director)
                  </option>
                  <option value={SEED_CARE_USERS.BOARDING_STAFF_FAITH} className="bg-zinc-900">
                    Faith Mutua (Boarding Staff)
                  </option>
                  <option value={CANONICAL_IDS.OWNER_ELENA} className="bg-zinc-900">
                    Elena Vance (Household Owner)
                  </option>
                </select>
              </div>
            </div>

            <button
              onClick={handleResetData}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reset to canonical state"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-teal-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningTests ? 'Verifying...' : 'Run Sprint 21 Suite'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                : 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Workspace Navigation Tabs */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'dispatch'
                ? 'bg-zinc-100 text-zinc-950 font-bold shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Engagements & Dispatch ({engagements.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('grooming')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'grooming'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/20'
                : 'text-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-900/40'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Grooming Salon Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('sitting')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'sitting'
                ? 'bg-emerald-500 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/40'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>In-Home Pet Sitting</span>
          </button>

          <button
            onClick={() => setActiveTab('boarding')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'boarding'
                ? 'bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20'
                : 'text-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/40 border border-indigo-900/40'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Boarding & Daycare</span>
          </button>

          <button
            onClick={() => setActiveTab('custody')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'custody'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Custody & Handover</span>
          </button>

          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'incidents'
                ? 'bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/20'
                : incidents.length > 0
                ? 'text-rose-400 bg-rose-950/30 border border-rose-900/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Incidents & Safety ({incidents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-zinc-200 text-zinc-950 font-bold shadow'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test Suite Verification</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DISPATCH & ENGAGEMENTS OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'dispatch' && (
        <div className="space-y-6">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#13161C] border border-zinc-800 rounded-xl p-4">
              <span className="text-xs font-medium text-zinc-400">Total Care Engagements</span>
              <div className="text-2xl font-black text-zinc-100 mt-1">{engagements.length}</div>
              <span className="text-[11px] text-teal-400 mt-0.5 block">Grooming, Sitting & Boarding</span>
            </div>
            <div className="bg-[#13161C] border border-zinc-800 rounded-xl p-4">
              <span className="text-xs font-medium text-zinc-400">Active In-Care</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {engagements.filter((e) => e.status === 'IN_CARE').length}
              </div>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Under professional custody</span>
            </div>
            <div className="bg-[#13161C] border border-zinc-800 rounded-xl p-4">
              <span className="text-xs font-medium text-zinc-400">Boarding Unit Occupancy</span>
              <div className="text-2xl font-black text-indigo-400 mt-1">
                {boardingUnits.reduce((acc, u) => acc + u.currentOccupancy, 0)} /{' '}
                {boardingUnits.reduce((acc, u) => acc + u.maxCapacity, 0)}
              </div>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Nairobi Pet Haven facility</span>
            </div>
            <div className="bg-[#13161C] border border-zinc-800 rounded-xl p-4">
              <span className="text-xs font-medium text-zinc-400">Active Incidents</span>
              <div className="text-2xl font-black text-rose-400 mt-1">{incidents.length}</div>
              <span className="text-[11px] text-rose-500 mt-0.5 block">Real-time safety monitor</span>
            </div>
          </div>

          {/* Engagements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {engagements.map((eng) => {
              const petNames = eng.petIds
                .map((pid) => PetStore.findPetById(pid)?.name || pid)
                .join(', ');
              const isSelected = selectedEngagement?.engagementId === eng.engagementId;

              return (
                <div
                  key={eng.engagementId}
                  onClick={() => setSelectedEngagement(eng)}
                  className={`bg-[#13161C] border rounded-xl p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500 shadow-md shadow-teal-500/10 bg-zinc-900/90'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        eng.serviceType === 'GROOMING'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : eng.serviceType === 'PET_SITTING_VISIT'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {eng.serviceType.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        eng.status === 'IN_CARE'
                          ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                          : eng.status === 'COMPLETED'
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-amber-900/40 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {eng.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-100 mt-3 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pet(s): {petNames}</span>
                  </h3>

                  <div className="text-xs text-zinc-400 mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Custody:</span>
                      <span className="font-mono text-zinc-300 font-semibold">{eng.custodyStatus}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Schedule:</span>
                      <span className="text-zinc-300">
                        {new Date(eng.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const evalRes = service.evaluateReadiness(eng.engagementId);
                        showFeedback(
                          evalRes.isReadyForService ? 'success' : 'info',
                          evalRes.isReadyForService
                            ? 'Engagement readiness validated! All preconditions satisfied.'
                            : `Readiness check pending: ${evalRes.blockingReasons.join(', ')}`
                        );
                        loadData();
                      }}
                      className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      Evaluate Readiness
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (eng.serviceType === 'GROOMING') setActiveTab('grooming');
                        else if (eng.serviceType === 'PET_SITTING_VISIT') setActiveTab('sitting');
                        else setActiveTab('boarding');
                      }}
                      className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg flex items-center gap-1"
                    >
                      <span>Open Desk</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GROOMING SALON WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'grooming' && groomingSession && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Coat Profile & Intake Preferences */}
            <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    Grooming Client Intake
                  </span>
                  <h3 className="text-base font-bold text-zinc-100">Kibo (Golden Retriever)</h3>
                </div>
                <div className="p-2 bg-cyan-950/60 border border-cyan-800 text-cyan-400 rounded-xl">
                  <Scissors className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 block font-medium">Coat Type:</span>
                  <span className="text-zinc-200 font-semibold">{groomingSession.coatType}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-medium">Styling Preferences:</span>
                  <span className="text-zinc-200">{groomingSession.stylingPreferences}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block font-medium">Sensitive Areas:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {groomingSession.sensitiveAreas.map((area, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-amber-950/50 border border-amber-800/60 text-amber-300 rounded text-[11px]">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500 block font-medium">Handling Notes:</span>
                  <p className="text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                    {groomingSession.handlingNotes}
                  </p>
                </div>
              </div>

              {/* Safety Stop Status */}
              {groomingSession.safetyStopped ? (
                <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>SAFETY STOP ACTIVATED</span>
                  </div>
                  <p className="text-[11px] text-rose-200">{groomingSession.safetyStopReason}</p>
                </div>
              ) : (
                <button
                  onClick={handleTriggerSafetyStop}
                  className="w-full py-2 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 text-rose-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Trigger Safety Stop (Pet Distress)</span>
                </button>
              )}
            </div>

            {/* Center & Right: Procedures & Allergy Screening */}
            <div className="lg:col-span-2 space-y-6">
              {/* Allergy Screening Lab */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <h4 className="text-sm font-bold text-zinc-100">Allergy Screening Bar</h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Real-time allergen screening against HealthStore</span>
                </div>

                <p className="text-xs text-zinc-400">
                  Select a product to apply. The system cross-references active contact allergies in the Pet's Health Chart
                  before allowing application.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      handleTestProduct('Hypoallergenic Oatmeal Wash', ['Colloidal Oatmeal', 'Aloe Vera', 'Purified Water'])
                    }
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Test: Hypoallergenic Oatmeal Wash</span>
                  </button>

                  <button
                    onClick={() =>
                      handleTestProduct('Calming Chamomile Coat Tonic', ['Chamomile Extract', 'Fragrance', 'Purified Water'])
                    }
                    className="px-3 py-2 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Test: Chamomile Tonic (Known Allergen!)</span>
                  </button>
                </div>

                {allergyTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      allergyTestResult.safe
                        ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-800 text-rose-300'
                    }`}
                  >
                    {allergyTestResult.safe ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {allergyTestResult.safe ? 'Product Cleared' : 'Allergy Alert Triggered'}
                      </span>
                      <p className="text-[11px] mt-0.5">{allergyTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Procedure Progression Checklist */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-100">Planned Grooming Procedures</h4>
                  <span className="text-xs font-semibold text-cyan-400">
                    {groomingSession.plannedProcedures.filter((p) => p.completed).length} /{' '}
                    {groomingSession.plannedProcedures.length} Completed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groomingSession.plannedProcedures.map((proc) => (
                    <div
                      key={proc.procedureId}
                      onClick={() => !proc.completed && handleToggleProcedure(proc.procedureType)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        proc.completed
                          ? 'bg-cyan-950/30 border-cyan-800 text-cyan-200'
                          : groomingSession.safetyStopped
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-500 opacity-60'
                          : 'bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:border-cyan-600 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center ${
                            proc.completed ? 'bg-cyan-500 text-zinc-950 font-bold' : 'border border-zinc-600'
                          }`}
                        >
                          {proc.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-xs font-semibold">{proc.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {proc.completed ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. IN-HOME PET SITTING WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'sitting' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Protected Home Access Vault */}
            <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Security & Home Access
                  </span>
                  <h3 className="text-base font-bold text-zinc-100">Keypad Vault</h3>
                </div>
                <div className="p-2 bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-xl">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              {accessSecret ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block font-medium">Access Point:</span>
                    <span className="text-zinc-200 font-semibold">{accessSecret.title}</span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block font-medium">Service Window:</span>
                    <span className="text-zinc-300 font-mono text-[11px]">
                      {new Date(accessSecret.accessWindowStart).toLocaleTimeString()} -{' '}
                      {new Date(accessSecret.accessWindowEnd).toLocaleTimeString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-500 block font-medium">Door Code (Time-Bound):</span>
                    <div className="mt-1 p-3 bg-zinc-900 border border-zinc-700/80 rounded-xl flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-emerald-400 tracking-widest">
                        {revealedSecret || accessSecret.maskedDisplay}
                      </span>
                      {!revealedSecret ? (
                        <button
                          onClick={handleRevealSecret}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Reveal Code</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Audited</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-500 block font-medium">Instructions:</span>
                    <p className="text-zinc-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 text-[11px]">
                      {accessSecret.instructions}
                    </p>
                  </div>

                  <div>
                    <span className="text-zinc-500 block font-medium">Audit Trail ({accessSecret.auditLog.length} reveals):</span>
                    <div className="mt-1 space-y-1">
                      {accessSecret.auditLog.map((log, idx) => (
                        <div key={idx} className="p-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-400">
                          <span className="text-emerald-400 font-semibold">{log.accessReason}</span>
                          <div className="text-zinc-500 mt-0.5">{new Date(log.revealedAt).toLocaleTimeString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-zinc-500 text-center">No home-access secrets registered.</div>
              )}
            </div>

            {/* Center & Right: Scheduled Visits & Care Execution */}
            <div className="lg:col-span-2 space-y-6">
              {/* Visits List */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-zinc-100">Scheduled In-Home Visits</h4>
                  </div>
                  <span className="text-xs text-zinc-400">2-Visit Daily Plan (Luna & Simba)</span>
                </div>

                <div className="space-y-2">
                  {sitterVisits.map((v) => (
                    <div
                      key={v.visitId}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-zinc-200">
                          Visit #{v.visitNumber} of {v.totalVisits}
                        </span>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Window: {new Date(v.scheduledStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(v.scheduledEndAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            v.status === 'COMPLETED'
                              ? 'bg-zinc-800 text-zinc-400'
                              : v.status === 'IN_PROGRESS'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {v.status}
                        </span>
                        {v.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => {
                              service.completeSitterVisit({
                                visitId: v.visitId,
                                completedTasks: ['Fresh water provided', 'Litter box scooped', 'Dry food refilled'],
                                notes: 'Cats were happy and playful.',
                              });
                              loadData();
                              showFeedback('success', `Visit #${v.visitNumber} marked completed.`);
                            }}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[11px] font-bold rounded-lg cursor-pointer"
                          >
                            Complete Visit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feeding & Medication Execution Station */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-100">Care Execution: Feeding & Medication</h4>
                  <span className="text-[11px] text-zinc-400">Strict dosage integrity enforced</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Feeding Action */}
                  <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-zinc-200 block">Meal Execution (Luna)</span>
                    <p className="text-[11px] text-zinc-400">
                      Standard Meal: Salmon Wet Paté (85g). System prevents duplicate meal execution within 60 minutes.
                    </p>
                    <button
                      onClick={() => handleExecuteFeeding(CANONICAL_IDS.PET_LUNA, 'Salmon Wet Paté', 85)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Log Meal (85g)</span>
                    </button>
                  </div>

                  {/* Medication Action */}
                  <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-zinc-200 block">Medication Integrity (Methimazole)</span>
                    <p className="text-[11px] text-zinc-400">
                      Prescribed: <strong className="text-zinc-200">2.5 mg</strong>. Providers cannot alter dosage or substitute
                      drugs.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleAdministerMedication(
                            CANONICAL_IDS.PET_LUNA,
                            'med-milo-thyroid',
                            'Methimazole',
                            '2.5 mg',
                            false
                          )
                        }
                        className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Give 2.5 mg
                      </button>

                      <button
                        onClick={() =>
                          handleAdministerMedication(
                            CANONICAL_IDS.PET_LUNA,
                            'med-milo-thyroid',
                            'Methimazole',
                            '2.5 mg',
                            true
                          )
                        }
                        className="flex-1 py-2 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl cursor-pointer"
                        title="Simulate unauthorized altered dosage attempt"
                      >
                        Test Altered Dose
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BOARDING & DAYCARE WORKSPACE */}
      {/* ========================================================================= */}
      {activeTab === 'boarding' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Units Occupancy Grid */}
            <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    Facility Capacity
                  </span>
                  <h3 className="text-base font-bold text-zinc-100">Boarding Units</h3>
                </div>
                <div className="p-2 bg-indigo-950/60 border border-indigo-800 text-indigo-400 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2.5">
                {boardingUnits.map((u) => {
                  const isFull = u.currentOccupancy >= u.maxCapacity;
                  return (
                    <div
                      key={u.unitId}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isFull
                          ? 'bg-zinc-900/60 border-zinc-700'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-zinc-200">
                          Unit {u.unitNumber} ({u.unitType.replace(/_/g, ' ')})
                        </span>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Capacity: {u.maxCapacity} pet(s)
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isFull
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {u.currentOccupancy} / {u.maxCapacity} {isFull ? '(FULL)' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stays & Shift Handover Station */}
            <div className="lg:col-span-2 space-y-6">
              {/* Active Stays */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-100">Active Boarding Stays</h4>
                  <span className="text-xs text-zinc-400">Nairobi Pet Haven</span>
                </div>

                {boardingStays.map((stay) => (
                  <div key={stay.stayId} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-zinc-200">{stay.unitName}</span>
                        <div className="text-[11px] text-zinc-400">
                          Check-in: {new Date(stay.actualCheckInAt || stay.scheduledCheckInAt).toLocaleDateString()} ·
                          Scheduled Checkout: {new Date(stay.scheduledCheckOutAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 text-[10px] font-bold rounded border border-emerald-800">
                        {stay.status}
                      </span>
                    </div>

                    {/* Daily Care Log */}
                    <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80 space-y-1.5 text-xs">
                      <span className="text-zinc-500 font-medium block">Today's Daily Care Log:</span>
                      {stay.dailyLogs.length > 0 ? (
                        <div className="text-zinc-300 space-y-1 text-[11px]">
                          <div>• Meals Fed: {stay.dailyLogs[0].mealsFed}</div>
                          <div>• Water Refreshes: {stay.dailyLogs[0].waterRefreshedCount}</div>
                          <div>• Outdoor Exercise: {stay.dailyLogs[0].outdoorExerciseMinutes} mins</div>
                          <div>• Observation: {stay.dailyLogs[0].restAndSleepObservation}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-500">No logs for today yet.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shift Handover Station */}
              <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-zinc-100">Shift Handover Station</h4>
                  </div>
                  <span className="text-xs text-zinc-400">Staff to Staff Custody Relay</span>
                </div>

                <div className="space-y-3">
                  {shiftHandovers.map((sh) => (
                    <div key={sh.shiftHandoverId} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200">
                          Handover: Outgoing Staff → Incoming Staff
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            sh.acknowledged
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {sh.acknowledged ? 'Acknowledged & Signed' : 'Pending Signature'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
                        {sh.shiftNotes}
                      </p>

                      <div className="text-[11px] text-zinc-400 space-y-1">
                        <div>• Outstanding Meals: {sh.outstandingMeals.join(', ') || 'None'}</div>
                        <div>• Pending Meds: {sh.medicationsDue.join(', ') || 'None'}</div>
                      </div>

                      {!sh.acknowledged && (
                        <button
                          onClick={() => handleAcknowledgeShift(sh.shiftHandoverId)}
                          className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Sign & Acknowledge as {currentActor.name}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CUSTODY & HANDOVER STATION */}
      {/* ========================================================================= */}
      {activeTab === 'custody' && (
        <div className="space-y-6">
          <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Care Handover & Custody Verification</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  No service may complete while a pet is still under provider custody. Return handover to owner is strictly enforced.
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {engagements.map((eng) => {
                const petNames = eng.petIds
                  .map((pid) => PetStore.findPetById(pid)?.name || pid)
                  .join(', ');
                const canComplete = eng.custodyStatus === 'RETURNED' || eng.custodyStatus === 'OWNER_CUSTODY';

                return (
                  <div key={eng.engagementId} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">{eng.serviceType}</span>
                      <span className="text-[10px] font-mono text-amber-400">{eng.custodyStatus}</span>
                    </div>

                    <div className="text-xs text-zinc-300">
                      Pet: <strong className="text-zinc-100">{petNames}</strong>
                    </div>

                    <div className="p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/80 space-y-1 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Collar & ID Tag Verified</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Leash / Carrier Secure</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Physical Inspection Checked</span>
                      </div>
                    </div>

                    {eng.status !== 'COMPLETED' ? (
                      <button
                        onClick={() => handleReturnHandoverAndComplete(eng)}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Execute Return Handover & Finalize</span>
                      </button>
                    ) : (
                      <div className="text-center p-2 bg-zinc-800/60 text-zinc-400 text-xs rounded-lg font-medium">
                        Service Finalized & Evidence Locked
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. INCIDENTS & SAFETY STATION */}
      {/* ========================================================================= */}
      {activeTab === 'incidents' && (
        <div className="space-y-6">
          <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Service Incidents & Safety Center</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Critical escape incidents trigger canonical Lost Pet alerts directly to the Sprint 15 Recovery Platform.
                </p>
              </div>
              <button
                onClick={() => handleReportEscapeIncident(CANONICAL_IDS.PET_KIBO)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Simulate Pet Escape Incident</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              {incidents.length > 0 ? (
                incidents.map((inc) => (
                  <div key={inc.incidentId} className="p-4 bg-zinc-900 border border-rose-900/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-bold rounded">
                          {inc.severity}
                        </span>
                        <span className="text-xs font-bold text-zinc-100">{inc.category}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400">{new Date(inc.reportedAt).toLocaleTimeString()}</span>
                    </div>

                    <p className="text-xs text-zinc-300">{inc.details}</p>

                    <div className="text-[11px] text-zinc-400">
                      Actions Taken: {inc.actionsTaken.join('; ')}
                    </div>

                    {inc.lostPetAlertEmitted && (
                      <div className="p-2.5 bg-rose-950/40 border border-rose-800/80 rounded-lg text-xs text-rose-300 flex items-center gap-2 font-semibold">
                        <AlertOctagon className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>Synchronized with Sprint 15 Lost Pet Recovery Mesh</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No active incidents recorded. All services operating safely.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TEST SUITE & DIAGNOSTICS */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-[#13161C] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Sprint 21 Automated Verification Suite</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  End-to-end integration tests covering allergy screening, safety stops, time-bound secret vaults,
                  capacity enforcement, and multi-domain handoffs.
                </p>
              </div>
              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningTests ? 'Executing Scenarios...' : 'Run All Scenarios'}</span>
              </button>
            </div>

            {testResults.length > 0 && (
              <div className="space-y-2 pt-3">
                {testResults.map((tr, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      tr.passed
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-800 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {tr.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-semibold">{tr.name}</span>
                    </div>
                    <span className="font-mono text-[11px]">
                      {tr.passed ? 'PASSED' : `FAILED: ${tr.message}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
