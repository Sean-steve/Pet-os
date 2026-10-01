/**
 * Pet OS Sprint 19 - Veterinary Professional Workspace, Clinical Encounters & Governance Console
 * 
 * Implements:
 * - Volume XIV (Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces)
 * - Volume VII (Veterinary Health & Medical Records)
 * - Volume IV (Identity, Organizations & RBAC)
 * - Volume XXIV & XXV (AI Safety, Non-Diagnostic Governance & Clinical Provenance)
 * - Volume XXVIII (API Specification)
 * - Volume XXX (Database Schema & Technical Data Dictionary)
 * - Volume XXXI & XXXII (Security, Medical Privacy & Kenyan Regulatory Compliance - KVB)
 * - ADR-005 (Clinical Provenance Preserved: Owner Observations vs Professional Diagnoses)
 */

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  FileText,
  BadgeAlert,
  Search,
  Pill,
  Activity,
  Heart,
  Share2,
  Scale,
  Sparkles,
  ClipboardList,
  AlertOctagon,
  ChevronRight,
  ShieldAlert,
  KeyRound,
  FileCheck2,
  FileSignature,
  Sliders,
  Check,
  X,
  Thermometer,
  Layers,
} from 'lucide-react';
import { VetWorkspaceService } from '../pet-os/vet-workspace/service';
import { VetWorkspaceStore } from '../pet-os/vet-workspace/store';
import {
  ClinicalWorkQueueItem,
  WorkspaceClinicalEncounterSession,
  ClinicalPrescription,
  ClinicalDiagnosticOrder,
  ClinicalCarePlan,
  ClinicalAccessGrant,
  ClinicalRecordCorrectionRequest,
  VeterinaryReferral,
  WorkQueueStatus,
  TriageUrgencyLevel,
  PhysicalExamSystem,
  BodySystemName,
  ClinicalStaffRole,
} from '../pet-os/vet-workspace/types';
import { CANONICAL_IDS } from '../pet-os/kernel/canonical-ids';
import { runSprint19Tests, TestResult } from '../pet-os/vet-workspace/tests';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  asBusinessId,
  asProviderId,
  asEncounterId,
  asWorkQueueItemId,
} from '../pet-os/kernel/ids';

type WorkspaceTab = 'queue' | 'consultation' | 'records' | 'amendments' | 'referrals' | 'tests';

export const Sprint19VetWorkspaceConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('queue');
  const service = VetWorkspaceService.getInstance();
  const store = VetWorkspaceStore.getInstance();

  // Active User / Clinician context simulation
  const [activeActorId, setActiveActorId] = useState<string>('usr-01951500-0000-7000-8000-000000000101');
  const clinicId = asBusinessId('biz-nairobi-west-vet');

  // Domain data states
  const [queueItems, setQueueItems] = useState<ClinicalWorkQueueItem[]>([]);
  const [activeEncounter, setActiveEncounter] = useState<WorkspaceClinicalEncounterSession | null>(null);
  const [grants, setGrants] = useState<ClinicalAccessGrant[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<ClinicalRecordCorrectionRequest[]>([]);
  const [referrals, setReferrals] = useState<VeterinaryReferral[]>([]);
  const [selectedPetRecord, setSelectedPetRecord] = useState<any>(null);

  // Modals & form states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const [breakGlassPetId, setBreakGlassPetId] = useState('pet-luna-002');

  // Check-in form
  const [checkInPetId, setCheckInPetId] = useState('pet-kibo-001');
  const [checkInComplaint, setCheckInComplaint] = useState('');
  const [checkInTriage, setCheckInTriage] = useState<TriageUrgencyLevel>('ROUTINE');
  const [checkInRoom, setCheckInRoom] = useState('Exam Room 1');

  // Encounter form draft
  const [vitalsWeight, setVitalsWeight] = useState<number>(34.8);
  const [vitalsTemp, setVitalsTemp] = useState<number>(38.6);
  const [vitalsHR, setVitalsHR] = useState<number>(92);
  const [vitalsRR, setVitalsRR] = useState<number>(24);
  const [vitalsBCS, setVitalsBCS] = useState<number>(5);
  const [newDiagnosisName, setNewDiagnosisName] = useState('');
  const [newDiagnosisCategory, setNewDiagnosisCategory] = useState<any>('EAR_NOSE_THROAT');
  const [newMedName, setNewMedName] = useState('');
  const [newMedStrength, setNewMedStrength] = useState('');
  const [newMedDose, setNewMedDose] = useState<number>(1);
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [carePlanInstructions, setCarePlanInstructions] = useState('');
  const [carePlanRestLevel, setCarePlanRestLevel] = useState<any>('NORMAL_ACTIVITY');

  // Test Runner state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testsRunning, setTestsRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const actorRole = service.getStaffRole(asUserId(activeActorId), clinicId) || 'RECEPTION';

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  const refreshData = () => {
    const q = store.listQueueForClinic(clinicId);
    setQueueItems(q);

    // Active in-flight encounter for Kibo
    const enc = store.findEncounterSessionById(asEncounterId('enc-kibo-sprint19-01'));
    if (enc) setActiveEncounter(enc);

    const g = store.listGrantsForClinic(clinicId);
    setGrants(g);

    const cor = store.listPendingCorrectionRequests();
    setCorrectionRequests(cor);

    const ref = store.listReferralsForClinic(clinicId);
    setReferrals(ref);

    try {
      const rec = service.getPetClinicalWorkspaceRecord(clinicId, CANONICAL_IDS.PET_KIBO, asUserId(activeActorId));
      setSelectedPetRecord(rec);
    } catch {
      setSelectedPetRecord(null);
    }
  };

  useEffect(() => {
    refreshData();
  }, [activeActorId]);

  const handleRunTests = async () => {
    setTestsRunning(true);
    const summary = await runSprint19Tests();
    setTestResults(summary.results);
    setTestSummary({ total: summary.total, passed: summary.passed, failed: summary.failed });
    setTestsRunning(false);
    refreshData();
  };

  // Check In Patient
  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      service.checkInPatient({
        clinicId,
        petId: asPetId(checkInPetId),
        householdId: checkInPetId === 'pet-kibo-001' ? CANONICAL_IDS.MAIN_HOUSEHOLD : CANONICAL_IDS.BOOKING_HOUSEHOLD,
        chiefComplaint: checkInComplaint || 'Routine outpatient consultation',
        triageLevel: checkInTriage,
        roomNumber: checkInRoom,
        checkInByUserId: asUserId(activeActorId),
      });
      notify('success', `Patient successfully checked in with triage level ${checkInTriage}`);
      setShowCheckInModal(false);
      setCheckInComplaint('');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Break-Glass Emergency Access
  const handleBreakGlass = () => {
    try {
      const rec = service.breakGlassEmergencyAccess({
        clinicId,
        petId: asPetId(breakGlassPetId),
        accessedByUserId: asUserId(activeActorId),
        providerId: CANONICAL_IDS.VET_DR_KIMANI,
        emergencyReason: breakGlassReason,
        witnessName: 'Faith Mwende, RVT',
      });
      notify('success', `Emergency break-glass access established (Audit ID: ${rec.auditLogId})`);
      setShowBreakGlassModal(false);
      setBreakGlassReason('');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Record Vitals
  const handleSaveVitals = () => {
    if (!activeEncounter) return;
    try {
      service.recordVitals({
        encounterId: activeEncounter.encounterId,
        recordedByUserId: asUserId(activeActorId),
        vitals: {
          weightKg: vitalsWeight,
          temperatureCelsius: vitalsTemp,
          heartRateBpm: vitalsHR,
          respiratoryRateBrpm: vitalsRR,
          bodyConditionScore: vitalsBCS,
          mucousMembraneColor: 'PINK',
          capillaryRefillTimeSeconds: 1.5,
          painScore: 0,
        },
      });
      notify('success', 'Clinical vitals recorded & synced to patient twin');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Add Diagnosis
  const handleAddDiagnosis = () => {
    if (!activeEncounter || !newDiagnosisName) return;
    try {
      const current = activeEncounter.diagnoses || [];
      service.recordDiagnoses({
        encounterId: activeEncounter.encounterId,
        veterinarianUserId: asUserId(activeActorId),
        diagnoses: [
          ...current,
          {
            conditionName: newDiagnosisName,
            category: newDiagnosisCategory,
            likelihood: 'CONFIRMED',
            isPrimary: current.length === 0,
            chronic: false,
          },
        ],
        clinicalAssessmentSummary: activeEncounter.clinicalSummaryAssessment,
      });
      notify('success', `Diagnosis "${newDiagnosisName}" recorded by licensed practitioner`);
      setNewDiagnosisName('');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Prescribe Medication
  const handlePrescribe = () => {
    if (!activeEncounter || !newMedName) return;
    try {
      service.prescribeMedication({
        encounterId: activeEncounter.encounterId,
        veterinarianUserId: asUserId(activeActorId),
        medicationName: newMedName,
        form: 'TABLET',
        strength: newMedStrength || '50mg',
        dosageQuantity: newMedDose,
        dosageUnit: 'tablets',
        route: 'ORAL',
        frequency: 'q12h with meal',
        durationDays: 7,
        refillsAllowed: 0,
        instructions: newMedInstructions || 'Administer with food',
        warningLabels: ['Veterinary prescription only'],
      });
      notify('success', `Prescription "${newMedName}" issued after allergy clearance`);
      setNewMedName('');
      setNewMedStrength('');
      setNewMedInstructions('');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  // Sign and Finalize Encounter
  const handleSignEncounter = () => {
    if (!activeEncounter) return;
    try {
      service.signAndFinalizeEncounter({
        encounterId: activeEncounter.encounterId,
        veterinarianUserId: asUserId(activeActorId),
        veterinarianProviderId: CANONICAL_IDS.VET_DR_KIMANI,
        statementOfResponsibility: 'I confirm that I am a licensed veterinary professional. I have personally evaluated this animal, verified these clinical findings, and authorized all included medications and care plans.',
      });
      notify('success', 'Clinical encounter cryptographically signed & synchronized to Sprint 5, 6, 9 & Timeline!');
      refreshData();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-8 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50'
              : 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/50'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner & Clinic Identity Header */}
      <div className="bg-[#13161C] border border-[#1E2530] rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-teal-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">Nairobi West Veterinary Clinic</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  KVB Reg. No: KVB-CLIN-0082
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-800/40">
                  Sprint 19 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Clinical Encounters · Verified Medical Records · Cryptographic Sealing · Drug Safety · KVB Governance
              </p>
            </div>
          </div>

          {/* Actor Selector & Role Badge */}
          <div className="flex items-center gap-3 bg-[#0B0D10] p-2 rounded-xl border border-slate-800">
            <div className="text-right pr-2 border-r border-slate-800">
              <div className="text-xs font-semibold text-slate-200">Active Staff Actor</div>
              <div className="text-[11px] font-mono font-bold text-indigo-400">
                {actorRole.replace('_', ' ')}
              </div>
            </div>

            <select
              id="select-vet-staff-actor"
              value={activeActorId}
              onChange={(e) => setActiveActorId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="usr-01951500-0000-7000-8000-000000000101">Dr. Amani Kimani (Lead Vet, KVB-2024-0982)</option>
              <option value="usr-vet-tech-faith-01">Faith Mwende (Vet Tech / Nurse)</option>
              <option value="usr-vet-reception-grace-01">Grace Wanjiku (Receptionist / Masked)</option>
              <option value={CANONICAL_IDS.OUTSIDER_BRIAN}>Brian Outside (Foreign Unauthorized)</option>
            </select>

            <button
              id="btn-run-sprint19-tests"
              onClick={handleRunTests}
              disabled={testsRunning}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testsRunning ? 'animate-spin' : ''}`} />
              <span>{testsRunning ? 'Verifying...' : 'Run Test Suite'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-5 border-t border-slate-800/80 pt-3 overflow-x-auto">
          <button
            id="tab-queue"
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Outpatient Work Queue</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-indigo-300 border border-indigo-700/40">
              {queueItems.length}
            </span>
          </button>

          <button
            id="tab-consultation"
            onClick={() => setActiveTab('consultation')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'consultation'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Active Consultation</span>
            {activeEncounter?.isSigned ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/40">
                SIGNED
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-700/40">
                IN PROGRESS
              </span>
            )}
          </button>

          <button
            id="tab-records"
            onClick={() => setActiveTab('records')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Patient Chart & Grants</span>
            {selectedPetRecord?.masked && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center gap-1">
                <EyeOff className="w-2.5 h-2.5" />
                MASKED
              </span>
            )}
          </button>

          <button
            id="tab-amendments"
            onClick={() => setActiveTab('amendments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'amendments'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Corrections & Amendments</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 border border-slate-700">
              {correctionRequests.length}
            </span>
          </button>

          <button
            id="tab-referrals"
            onClick={() => setActiveTab('referrals')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'referrals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Specialist Referrals</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 border border-slate-700">
              {referrals.length}
            </span>
          </button>

          <button
            id="tab-tests"
            onClick={() => setActiveTab('tests')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Invariant Test Suite</span>
            {testSummary && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/40 font-mono">
                {testSummary.passed}/{testSummary.total}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: WORK QUEUE & OUTPATIENT TRIAGE                                */}
      {/* ==================================================================== */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Today's Outpatient Clinical Flow</span>
                <span className="text-xs font-normal text-slate-400">(Triage-Prioritized Queue)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Patients actively checked in, triaged, and transitioning across clinical care stages.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-break-glass-open"
                onClick={() => setShowBreakGlassModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Emergency Break-Glass</span>
              </button>

              <button
                id="btn-open-checkin"
                onClick={() => setShowCheckInModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-teal-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Check In Patient</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queueItems.map((item) => {
              const triageBadge = {
                EMERGENCY: 'bg-rose-950 text-rose-300 border-rose-800/60',
                URGENT: 'bg-amber-950 text-amber-300 border-amber-800/60',
                ROUTINE: 'bg-slate-900 text-slate-300 border-slate-800',
                POST_OP: 'bg-purple-950 text-purple-300 border-purple-800/60',
              }[item.triageLevel];

              const statusBadge = {
                SCHEDULED_TODAY: 'bg-slate-900 text-slate-400 border-slate-800',
                CHECKED_IN: 'bg-blue-950 text-blue-300 border-blue-800/50',
                TRIAGED: 'bg-cyan-950 text-cyan-300 border-cyan-800/50',
                IN_CONSULTATION: 'bg-amber-950 text-amber-300 border-amber-800/50',
                AWAITING_DIAGNOSTICS: 'bg-purple-950 text-purple-300 border-purple-800/50',
                READY_FOR_SIGNATURE: 'bg-indigo-950 text-indigo-300 border-indigo-800/50',
                DISCHARGED: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
                NO_SHOW: 'bg-rose-950 text-rose-300 border-rose-800/50',
              }[item.status];

              return (
                <div
                  key={item.queueItemId}
                  className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{item.petName}</span>
                        <span className="text-xs text-slate-400">({item.breed})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${triageBadge}`}>
                        {item.triageLevel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mb-3 line-clamp-2">
                      <span className="text-slate-500 font-semibold">Complaint: </span>
                      {item.chiefComplaint}
                    </p>

                    <div className="space-y-1 text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/70 mb-3">
                      <div className="flex justify-between">
                        <span>Owner:</span>
                        <span className="text-slate-200 font-medium">{item.ownerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Room / Station:</span>
                        <span className="text-indigo-300 font-mono">{item.roomNumber || 'Triage Area'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned Vet:</span>
                        <span className="text-slate-200">{item.assignedVeterinarianName || 'Dr. Kimani'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge}`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>

                    {item.status !== 'DISCHARGED' && (
                      <button
                        onClick={() => {
                          service.updateQueueStatus(item.queueItemId, 'IN_CONSULTATION');
                          setActiveTab('consultation');
                          refreshData();
                        }}
                        className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <span>Open Chart</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: ACTIVE CLINICAL ENCOUNTER CONSULTATION                         */}
      {/* ==================================================================== */}
      {activeTab === 'consultation' && activeEncounter && (
        <div className="space-y-5">
          {/* ADR-005 Clinical Provenance Banner */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-200/90">
            <BadgeAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300 flex items-center gap-2">
                <span>ADR-005 Mandatory Clinical Provenance Standard</span>
                <span className="px-2 py-0.2 rounded text-[10px] bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono">
                  OWNER_REPORTED vs VETERINARY_PROFESSIONAL
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-amber-200/80">
                Client observations and history are strictly preserved as owner narrative and will NEVER be silently converted into licensed veterinary diagnoses. Only validated findings confirmed by Dr. Kimani (KVB-2024-0982) carry medical weight.
              </p>
            </div>
          </div>

          {/* Consultation Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column: Owner Reported History & Vitals */}
            <div className="space-y-4">
              {/* Owner Reported Box */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-cyan-400" />
                    <span>Owner Presenting Complaint</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-bold">
                    OWNER_REPORTED
                  </span>
                </div>
                <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div>
                    <span className="text-slate-500 font-semibold block">Chief Complaint:</span>
                    <p className="mt-0.5">{activeEncounter.presentingComplaint}</p>
                  </div>
                  {activeEncounter.ownerReportedHistory && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-500 font-semibold block">Client History:</span>
                      <p className="mt-0.5">{activeEncounter.ownerReportedHistory}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vitals Form */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-emerald-400" />
                    <span>Clinical Vitals</span>
                  </h3>
                  {activeEncounter.vitals && (
                    <span className="text-[10px] text-slate-400">
                      By {activeEncounter.vitals.recordedByName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsWeight}
                      disabled={activeEncounter.isSigned}
                      onChange={(e) => setVitalsWeight(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalsTemp}
                      disabled={activeEncounter.isSigned}
                      onChange={(e) => setVitalsTemp(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      value={vitalsHR}
                      disabled={activeEncounter.isSigned}
                      onChange={(e) => setVitalsHR(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-1">Resp Rate (brpm)</label>
                    <input
                      type="number"
                      value={vitalsRR}
                      disabled={activeEncounter.isSigned}
                      onChange={(e) => setVitalsRR(parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                {!activeEncounter.isSigned && (
                  <button
                    onClick={handleSaveVitals}
                    className="w-full mt-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"
                  >
                    Save & Sync Vitals
                  </button>
                )}
              </div>
            </div>

            {/* Center Column: Physical Exam & Diagnoses */}
            <div className="space-y-4">
              {/* Physical Exam Checklist */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-400" />
                  <span>Physical Examination</span>
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeEncounter.physicalExam.map((pe, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-900/70 border border-slate-800 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">
                          {pe.system.replace(/_/g, ' ')}:
                        </span>
                        <p className="text-slate-400 text-[11px] mt-0.5">{pe.findings}</p>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          pe.status === 'NORMAL'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                        }`}
                      >
                        {pe.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Differential Diagnoses */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-indigo-400" />
                    <span>Differential Diagnoses</span>
                  </h3>
                  <span className="text-[10px] text-indigo-300 font-mono">Licensed Vet Only</span>
                </div>

                <div className="space-y-2 mb-3">
                  {activeEncounter.diagnoses.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900 border border-indigo-900/30 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">{d.conditionName}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/40">
                          {d.likelihood}
                        </span>
                      </div>
                      {d.rationale && (
                        <p className="text-[11px] text-slate-400 mt-1">{d.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>

                {!activeEncounter.isSigned && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      placeholder="Add confirmed / suspected diagnosis..."
                      value={newDiagnosisName}
                      onChange={(e) => setNewDiagnosisName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    />
                    <button
                      onClick={handleAddDiagnosis}
                      className="w-full py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
                    >
                      Record Professional Diagnosis
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Prescriptions, Diagnostics & Sealing */}
            <div className="space-y-4">
              {/* Prescriptions */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-purple-400" />
                    <span>Prescriptions Issued</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-mono">Allergy-Screened</span>
                </div>

                <div className="space-y-2 mb-3">
                  {activeEncounter.prescriptions.map((pid) => {
                    const rx = store.findPrescriptionById(pid);
                    if (!rx) return null;
                    return (
                      <div
                        key={pid}
                        className="p-2.5 rounded-lg bg-slate-900 border border-purple-900/30 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-100">
                          <span>{rx.medicationName}</span>
                          <span className="text-purple-300 font-mono text-[10px]">{rx.strength}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{rx.instructions}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>Route: {rx.route}</span>
                          <span>Duration: {rx.durationDays} days</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!activeEncounter.isSigned && (
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                    <input
                      type="text"
                      placeholder="Medication name..."
                      value={newMedName}
                      onChange={(e) => setNewMedName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Strength (e.g. 50mg)"
                        value={newMedStrength}
                        onChange={(e) => setNewMedStrength(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="Instructions"
                        value={newMedInstructions}
                        onChange={(e) => setNewMedInstructions(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                      />
                    </div>
                    <button
                      onClick={handlePrescribe}
                      className="w-full py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer"
                    >
                      Prescribe Medication
                    </button>
                  </div>
                )}
              </div>

              {/* Sealing & Cryptographic Finalization */}
              <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Clinical Sealing & Sign-Off</span>
                </h3>

                {activeEncounter.isSigned ? (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Cryptographically Sealed & Signed</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Signed by: {activeEncounter.primaryVeterinarianName} (KVB-2024-0982)
                    </p>
                    <p className="text-[10px] font-mono text-emerald-300 break-all">
                      Digest: sha256-sig-{activeEncounter.signatureId}
                    </p>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-emerald-900/50">
                      Record is immutable. Direct edits prohibited. Corrections require formal amendment.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Finalizing this encounter locks all entries, writes canonical medical records into Sprint 5, registers obligations in Sprint 6, and projects verified events onto the Pet Timeline.
                    </p>
                    <button
                      id="btn-sign-encounter"
                      onClick={handleSignEncounter}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <FileSignature className="w-4 h-4" />
                      <span>Sign & Seal Clinical Record</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PATIENT CHART & ACCESS GRANTS                                 */}
      {/* ==================================================================== */}
      {activeTab === 'records' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Verified Patient Medical Records</span>
                {selectedPetRecord?.masked && (
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                    <EyeOff className="w-3 h-3" />
                    Field-Level Redaction Active (Reception Role)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Authoritative records loaded directly from Sprint 5 Health bounded context.
              </p>
            </div>
          </div>

          {selectedPetRecord && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Pet Info & Active Grants */}
              <div className="space-y-4">
                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                    Patient Demographics
                  </h3>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name:</span>
                      <span className="font-bold text-slate-100">{selectedPetRecord.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Species / Breed:</span>
                      <span>{selectedPetRecord.species} · {selectedPetRecord.breed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Weight:</span>
                      <span className="font-mono text-emerald-400">{selectedPetRecord.weightKg} kg</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span>Clinical Access Grants</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    {grants.map((g) => (
                      <div
                        key={g.grantId}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-200">
                          <span>{g.relationshipType}</span>
                          <span className="text-emerald-400 font-mono text-[10px]">{g.status}</span>
                        </div>
                        <p className="text-slate-400 text-[10px] mt-1">{g.purposeDescription}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Conditions & Allergies */}
              <div className="space-y-4">
                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Known Allergies & Alerts</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedPetRecord.allergies.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No known drug or environmental allergies recorded.</p>
                    ) : (
                      selectedPetRecord.allergies.map((a: any) => (
                        <div
                          key={a.allergyId}
                          className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs"
                        >
                          <div className="font-bold text-rose-300">{a.allergen}</div>
                          <p className="text-slate-400 text-[11px]">{a.reaction} ({a.severity})</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <span>Medical Conditions & Diagnoses</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedPetRecord.conditions.map((c: any) => (
                      <div
                        key={c.conditionId}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${selectedPetRecord.masked ? 'text-amber-400 font-mono text-[10px]' : 'text-slate-200'}`}>
                            {c.conditionName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Medications & Vaccinations */}
              <div className="space-y-4">
                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-purple-400" />
                    <span>Current Medications</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedPetRecord.medications.map((m: any) => (
                      <div
                        key={m.medicationId}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${selectedPetRecord.masked ? 'text-amber-400 font-mono text-[10px]' : 'text-slate-200'}`}>
                            {m.medicationName}
                          </span>
                          <span className="text-[10px] text-purple-400 font-mono">{m.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>Vaccination History</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedPetRecord.vaccinations.map((v: any) => (
                      <div
                        key={v.vaccinationId}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-200">
                          <span>{v.vaccineName}</span>
                          <span className="text-teal-400 font-mono text-[10px]">Verified</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Administered: {new Date(v.administeredAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: CORRECTIONS & AMENDMENTS                                      */}
      {/* ==================================================================== */}
      {activeTab === 'amendments' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Clinical Record Correction Requests & Amendments</span>
            </h2>
            <p className="text-xs text-slate-400">
              Under medical governance rules, owners can request corrections, but signed records are never deleted—only amended with formal clinician review and audit history.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {correctionRequests.map((req) => (
              <div
                key={req.requestId}
                className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Request from {req.requestedByName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    {req.status}
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div>
                    <span className="text-slate-500 font-semibold">Target: </span>
                    <span className="font-mono text-indigo-300">{req.targetRecordType} ({req.targetRecordId})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Client Reason: </span>
                    <p className="mt-0.5 text-slate-300">{req.correctionReason}</p>
                  </div>
                </div>

                {req.status === 'SUBMITTED' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        service.reviewRecordCorrection({
                          requestId: req.requestId,
                          veterinarianUserId: asUserId(activeActorId),
                          approved: true,
                          clinicianResponse: 'Approved per client documentation.',
                          amendedFields: { reviewed: true },
                        });
                        notify('success', 'Correction request approved and formal amendment recorded');
                        refreshData();
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"
                    >
                      Accept & Record Amendment
                    </button>
                    <button
                      onClick={() => {
                        service.reviewRecordCorrection({
                          requestId: req.requestId,
                          veterinarianUserId: asUserId(activeActorId),
                          approved: false,
                          clinicianResponse: 'Clinical observation substantiated by diagnostic findings.',
                        });
                        notify('error', 'Correction request declined with clinical explanation');
                        refreshData();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: SPECIALIST REFERRALS                                          */}
      {/* ==================================================================== */}
      {activeTab === 'referrals' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Veterinary Specialist Referrals & Handoffs</span>
            </h2>
            <p className="text-xs text-slate-400">
              Inter-practice referrals with scoped patient medical record sharing and confirmed owner consent.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {referrals.map((ref) => (
              <div
                key={ref.referralId}
                className="bg-[#13161C] border border-[#1E2530] rounded-xl p-4 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{ref.petName}</span>
                    <span className="text-xs text-slate-400">({ref.specialtyRequested})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {ref.status}
                  </span>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Source:</span>
                    <span className="text-slate-200">{ref.sourceClinicName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Destination:</span>
                    <span className="text-indigo-300 font-semibold">{ref.destinationClinicName}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-slate-400">
                    <span className="text-slate-500 font-semibold">Summary: </span>
                    {ref.clinicalSummary}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Owner Consent: {ref.ownerConsentConfirmed ? '✓ Confirmed' : 'Missing'}</span>
                  <span>Urgency: {ref.urgency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: INVARIANT TEST SUITE RUNNER                                   */}
      {/* ==================================================================== */}
      {activeTab === 'tests' && (
        <div className="space-y-5">
          <div className="bg-[#13161C] border border-[#1E2530] rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>Sprint 19 Invariant & Governance Test Suite</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Executes all 12 core clinical security, RBAC, drug safety, and cross-domain synchronization invariants.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={testsRunning}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testsRunning ? 'animate-spin' : ''}`} />
              <span>{testsRunning ? 'Running Tests...' : 'Execute Suite'}</span>
            </button>
          </div>

          {testSummary && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-slate-100">{testSummary.total}</div>
                <div className="text-xs text-slate-400 mt-1">Total Invariants</div>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-emerald-400">{testSummary.passed}</div>
                <div className="text-xs text-emerald-300/80 mt-1">Passed</div>
              </div>
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-4 text-center">
                <div className="text-2xl font-black text-rose-400">{testSummary.failed}</div>
                <div className="text-xs text-rose-300/80 mt-1">Failed</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  t.passed
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="font-medium">{t.name}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{t.durationMs.toFixed(1)}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CHECK-IN PATIENT                                              */}
      {/* ==================================================================== */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13161C] border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-400" />
                <span>Patient Check-In & Triage</span>
              </h3>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCheckIn} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Select Patient with Active Grant</label>
                <select
                  value={checkInPetId}
                  onChange={(e) => setCheckInPetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-medium"
                >
                  <option value="pet-kibo-001">Kibo (Elena Vance - Active Grant)</option>
                  <option value="pet-001">Simba (Amina Hassan - Active Grant)</option>
                  <option value="pet-luna-002">Luna (David Kim - Active Grant)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Triage Urgency Level</label>
                <select
                  value={checkInTriage}
                  onChange={(e) => setCheckInTriage(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-medium"
                >
                  <option value="ROUTINE">ROUTINE (Standard wellness & scheduled checkup)</option>
                  <option value="URGENT">URGENT (Acute discomfort, vomiting, minor wounds)</option>
                  <option value="EMERGENCY">EMERGENCY (Respiratory distress, severe trauma, collapse)</option>
                  <option value="POST_OP">POST_OP (Suture removal or surgical check)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Chief Complaint (Client Narrative)</label>
                <textarea
                  rows={2}
                  value={checkInComplaint}
                  onChange={(e) => setCheckInComplaint(e.target.value)}
                  placeholder="e.g. Owner reports limping on left hindleg since yesterday..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Station / Room Assignment</label>
                <input
                  type="text"
                  value={checkInRoom}
                  onChange={(e) => setCheckInRoom(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer"
                >
                  Confirm Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: BREAK-GLASS EMERGENCY ACCESS                                  */}
      {/* ==================================================================== */}
      {showBreakGlassModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13161C] border border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-amber-800/50 pb-3">
              <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Emergency Clinical Break-Glass Access</span>
              </h3>
              <button
                onClick={() => setShowBreakGlassModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold block mb-1">AUDITED LEGAL ACTION</span>
              Break-glass overrides standard consent and provisions temporary 24-hour full clinical access. All queries and records viewed are permanently logged to the immutable clinical audit registry.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Emergency Patient</label>
                <select
                  value={breakGlassPetId}
                  onChange={(e) => setBreakGlassPetId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-medium"
                >
                  <option value="pet-luna-002">Luna (Acute Trauma Presentation)</option>
                  <option value="pet-kibo-001">Kibo (Emergency Triage)</option>
                  <option value="pet-001">Simba (Anaphylaxis Presentation)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mandatory Clinical Justification</label>
                <textarea
                  rows={3}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="State the life-threatening emergency, acute condition, or bystander presentation reason..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBreakGlass}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-amber-600/30"
                >
                  Acknowledge & Break-Glass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
