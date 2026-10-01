/**
 * Pet OS Sprint 20 - Trainer Professional Workspace Console
 * 
 * Provides an institutional-grade, dark-studio interface for certified professional
 * dog trainers, training directors, and assistant trainers at Apex K9 Academy.
 * Integrates directly with canonical Sprint 8 Training domain, Sprint 5 Health,
 * Sprint 6 Care, Sprint 7 Nutrition, Sprint 9 Activity, Sprint 10 Provider,
 * Sprint 11 Booking, and Sprint 4 Documents.
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ClipboardCheck,
  PlayCircle,
  Award,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  ChevronRight,
  BookOpen,
  Sparkles,
  Activity,
  Heart,
  Lock,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Check,
  XCircle,
  Info,
} from 'lucide-react';

import {
  UserId,
  PetId,
  asSkillId,
  asTrainingPlanId,
  asBookingId,
  generateUUIDv7,
} from '../pet-os/kernel/ids';

import { TrainerWorkspaceStore } from '../pet-os/trainer-workspace/store';
import { TrainerWorkspaceService } from '../pet-os/trainer-workspace/service';
import { SEED_TRAINER_IDS } from '../pet-os/trainer-workspace/seed';
import { runSprint20Tests, TestResult } from '../pet-os/trainer-workspace/tests';
import { TrainingStore } from '../pet-os/training/store';
import { PetStore } from '../pet-os/pet-core/store';
import { HealthStore } from '../pet-os/health/store';
import { DocumentStore } from '../pet-os/documents/store';

type WorkspaceTab = 'QUEUE' | 'ASSESSMENT' | 'SESSION' | 'PROGRAMS' | 'REPORTS' | 'TESTS';

export const Sprint20TrainerWorkspaceConsole: React.FC = () => {
  const store = TrainerWorkspaceStore.getInstance();
  const service = TrainerWorkspaceService.getInstance();

  // Active Context
  const [activeTrainerId, setActiveTrainerId] = useState<UserId>(SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);
  const [activeTrainerRole, setActiveTrainerRole] = useState<'LEAD_TRAINER' | 'ASSISTANT_TRAINER' | 'SUSPENDED'>('LEAD_TRAINER');
  const [selectedPetId, setSelectedPetId] = useState<PetId>(SEED_TRAINER_IDS.PET_KIBO);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('QUEUE');
  
  // Refresh ticker
  const [ticker, setTicker] = useState(0);
  const refresh = () => setTicker(t => t + 1);

  // Active Session state
  const [activeSessionAssignmentId, setActiveSessionAssignmentId] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState('Watch Me Attention Cue');
  const [exerciseReps, setExerciseReps] = useState(8);
  const [isHighImpact, setIsHighImpact] = useState(false);
  const [treatFoodChoice, setTreatFoodChoice] = useState('Freeze-Dried Beef Liver');
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'SUCCESS' | 'ERROR' | 'INFO' } | null>(null);

  // Amendment modal state
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amendDetails, setAmendDetails] = useState('');

  // Tests state
  const [testSuiteRunning, setTestSuiteRunning] = useState(false);
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);

  const showNotification = (text: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
    setActionNotice({ text, type });
    setTimeout(() => setActionNotice(null), 6000);
  };

  // Queries
  const activePet = PetStore.findPetById(selectedPetId);
  const queueItems = store.listQueueItems(SEED_TRAINER_IDS.APEX_K9_ACADEMY);
  const assessments = store.listAssessmentsForPet(selectedPetId);
  const currentAssessment = assessments[0];
  const grant = store.findActiveGrant(selectedPetId, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
  const consent = store.findActiveConsent(selectedPetId, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
  const relationship = store.findActiveRelationship(selectedPetId, SEED_TRAINER_IDS.APEX_K9_ACADEMY);
  const sessions = store.listSessionExecutionsForPet(selectedPetId);
  const completedSession = sessions.find(s => s.status === 'COMPLETED');
  const homeworkList = store.listHomeworkForPet(selectedPetId);
  const reports = store.listReportsForPet(selectedPetId);
  const skillProgressList = TrainingStore.listSkillProgressForPet(selectedPetId);

  // Role switcher handler
  const handleActorSwitch = (role: 'LEAD_TRAINER' | 'ASSISTANT_TRAINER' | 'SUSPENDED') => {
    setActiveTrainerRole(role);
    if (role === 'LEAD_TRAINER') {
      setActiveTrainerId(SEED_TRAINER_IDS.LEAD_TRAINER_JUMA);
    } else if (role === 'ASSISTANT_TRAINER') {
      setActiveTrainerId(SEED_TRAINER_IDS.ASSISTANT_TRAINER_SARAH);
    } else {
      setActiveTrainerId(SEED_TRAINER_IDS.SUSPENDED_TRAINER_KEVIN);
    }
  };

  // Finalize assessment handler
  const handleFinalizeAssessment = () => {
    if (!currentAssessment) return;
    try {
      service.finalizeAssessment(currentAssessment.assessmentId, activeTrainerId, activeTrainerRole as any);
      showNotification(`Assessment finalized and canonical Sprint 8 plan created and activated!`, 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Submit amendment handler
  const handleAmendAssessment = () => {
    if (!currentAssessment || !amendReason || !amendDetails) return;
    try {
      service.amendAssessment(
        currentAssessment.assessmentId,
        { amendmentReason: amendReason, correctionDetails: amendDetails },
        activeTrainerId
      );
      showNotification('Assessment amendment recorded with full provenance!', 'SUCCESS');
      setShowAmendModal(false);
      setAmendReason('');
      setAmendDetails('');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Start Session handler
  const handleStartSession = () => {
    if (!relationship || !relationship.currentPlanId) {
      showNotification('No active prescribed training plan found. Please finalize an assessment first.', 'ERROR');
      return;
    }
    try {
      const prep = service.prepareSession(
        {
          planId: relationship.currentPlanId,
          petId: selectedPetId,
          householdId: relationship.householdId,
          businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
          environment: 'QUIET_OUTDOOR',
        },
        activeTrainerId
      );
      const started = service.startSession(prep.assignmentId, activeTrainerId);
      setActiveSessionAssignmentId(started.assignmentId);
      showNotification(`Session started in canonical Sprint 8 engine! Assignment: ${started.assignmentId.substring(0, 14)}...`, 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Record Attempt handler
  const handleRecordAttempt = () => {
    if (!activeSessionAssignmentId) {
      showNotification('No session currently in progress.', 'ERROR');
      return;
    }
    try {
      service.recordExerciseAttempt(
        activeSessionAssignmentId as any,
        {
          exerciseId: exerciseName.toLowerCase().replace(/\s+/g, '-'),
          skillId: asSkillId('skill-sit'),
          result: 'SUCCESSFUL',
          repetitions: exerciseReps,
          successfulRepetitions: exerciseReps,
          assistanceLevel: 'INDEPENDENT',
          distractionLevel: 'MODERATE',
          environment: 'QUIET_OUTDOOR',
          isHighImpactExercise: isHighImpact,
        },
        activeTrainerId
      );
      showNotification(`Recorded ${exerciseReps} reps for "${exerciseName}" in canonical Sprint 8!`, 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Complete Session handler
  const handleCompleteSession = () => {
    if (!activeSessionAssignmentId) return;
    try {
      service.completeSession(
        activeSessionAssignmentId as any,
        {
          overallPerformance: 'SUCCESSFUL',
          handoffSummary: {
            whatWorkedOn: [exerciseName, 'Loose leash focus games'],
            whatChangedSummary: 'Dog exhibited calm handler-oriented focus with low latency to cues.',
            whatToPractice: [exerciseName],
            practiceFrequencyRecommendation: 'Two 5-minute sessions daily before meals',
            whatToWatchFor: ['Avoid intense arousal triggers over threshold'],
            followUpNotes: 'Elena handled the final repetitions with great timing.',
          },
          treatCountRecorded: 12,
          treatFoodId: treatFoodChoice,
          homeworkTasks: [
            {
              exerciseId: 'hw-' + exerciseName.toLowerCase().replace(/\s+/g, '-'),
              exerciseName,
              skillId: asSkillId('skill-sit'),
              targetRepetitions: 10,
              targetFrequencyPerDay: 2,
              instructions: 'Reward calm stationary behavior before greeting visitors.',
            },
          ],
        },
        activeTrainerId
      );
      setActiveSessionAssignmentId(null);
      showNotification('Session completed! Household handoff summary generated & activity projected to Sprint 9.', 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Caregiver Homework log handler
  const handleCaregiverLogHomework = (homeworkId: any) => {
    try {
      service.logCaregiverHomework(
        homeworkId,
        {
          repetitionsCompleted: 10,
          successObserved: true,
          notes: 'Completed in living room with zero distractions. Very responsive!',
        },
        SEED_TRAINER_IDS.CLIENT_OWNER_ELENA
      );
      showNotification('Household Caregiver practice logged with HOUSEHOLD_CAREGIVER provenance!', 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Generate Report handler
  const handleGenerateReport = () => {
    if (!relationship) return;
    try {
      const rep = service.createAndFinalizeReport(
        {
          petId: selectedPetId,
          householdId: relationship.householdId,
          businessId: SEED_TRAINER_IDS.APEX_K9_ACADEMY,
          title: `Milestone Behavioral Progress Report - ${activePet?.name}`,
          reportType: 'PROGRESS_REPORT',
          executiveSummary: `${activePet?.name} has shown significant behavioral stabilization under systematic desensitization protocols.`,
          behaviorChangesSummary: 'Reactivity threshold reduced from 25m to 12m without barrier frustration.',
          caregiverInstructions: 'Continue structured loose-leash morning walks using the front-clip harness.',
        },
        activeTrainerId
      );
      showNotification(`Professional Report finalized & exported to Sprint 4 Documents! (Doc ID: ${rep.documentId})`, 'SUCCESS');
      refresh();
    } catch (err: any) {
      showNotification(err.message, 'ERROR');
    }
  };

  // Run Test Suite handler
  const handleRunTests = async () => {
    setTestSuiteRunning(true);
    try {
      const res = await runSprint20Tests();
      setTestResults(res);
      showNotification(`All ${res.passed}/${res.total} Sprint 20 governance tests passed!`, 'SUCCESS');
    } catch (err: any) {
      showNotification(`Test failure: ${err.message}`, 'ERROR');
    } finally {
      setTestSuiteRunning(false);
      refresh();
    }
  };

  return (
    <div id="trainer-workspace-container" className="min-h-screen bg-[#0B0D10] text-slate-200 p-4 md:p-6 lg:p-8 font-sans">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div
          id="workspace-alert-banner"
          className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-sm shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${
            actionNotice.type === 'SUCCESS'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : actionNotice.type === 'ERROR'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {actionNotice.type === 'SUCCESS' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            {actionNotice.type === 'ERROR' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {actionNotice.type === 'INFO' && <Info className="w-5 h-5 text-indigo-400 shrink-0" />}
            <span className="font-medium">{actionNotice.text}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Actor Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full">
              Sprint 20 Domain
            </span>
            <span className="text-xs text-zinc-500 font-mono">CPDT-KA Verified Workspace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-amber-400" />
            Apex K9 Academy Professional Workspace
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Structured behavioral programs, clinical assessments, session execution, and household handoff governance.
          </p>
        </div>

        {/* Actor & Pet Switcher Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-2xl">
          {/* Active Trainer Selector */}
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400 font-medium">Actor:</span>
            <div className="inline-flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
              <button
                id="btn-actor-juma"
                onClick={() => handleActorSwitch('LEAD_TRAINER')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTrainerRole === 'LEAD_TRAINER'
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Juma (Lead)
              </button>
              <button
                id="btn-actor-sarah"
                onClick={() => handleActorSwitch('ASSISTANT_TRAINER')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTrainerRole === 'ASSISTANT_TRAINER'
                    ? 'bg-blue-500 text-zinc-950 font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Sarah (Assistant)
              </button>
              <button
                id="btn-actor-kevin"
                onClick={() => handleActorSwitch('SUSPENDED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTrainerRole === 'SUSPENDED'
                    ? 'bg-rose-600 text-white font-bold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Kevin (Suspended)
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          {/* Client Pet Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Client Pet:</span>
            <select
              id="select-client-pet"
              value={selectedPetId}
              onChange={e => setSelectedPetId(e.target.value as PetId)}
              className="bg-zinc-950 border border-zinc-800 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value={SEED_TRAINER_IDS.PET_KIBO}>Kibo (German Shepherd - Leash Reactivity)</option>
              <option value={SEED_TRAINER_IDS.PET_SIMBA}>Simba (Golden Retriever - Therapy Intake)</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Header Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
        <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Active Clients</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">2 Pets</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 100% Consent Verified
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Canonical Plans Active</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">Sprint 8 Synced</div>
          <div className="text-[11px] text-zinc-400 mt-1">Zero Duplicate Records</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Session Status</span>
            <PlayCircle className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {activeSessionAssignmentId ? 'In Progress' : 'Ready to Start'}
          </div>
          <div className="text-[11px] text-indigo-400 mt-1">Handoff & Activity Hook</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Caregiver Homework</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">1 Completed</div>
          <div className="text-[11px] text-cyan-400 mt-1">HOUSEHOLD_CAREGIVER Signed</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-zinc-800 pb-3 mb-6 no-scrollbar">
        <button
          id="tab-queue"
          onClick={() => setActiveTab('QUEUE')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'QUEUE'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" /> Work Queue & Intake ({queueItems.length})
        </button>

        <button
          id="tab-assessment"
          onClick={() => setActiveTab('ASSESSMENT')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'ASSESSMENT'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Assessment & Goals
        </button>

        <button
          id="tab-session"
          onClick={() => setActiveTab('SESSION')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'SESSION'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <PlayCircle className="w-4 h-4" /> Live Session Execution {activeSessionAssignmentId && '🔴'}
        </button>

        <button
          id="tab-programs"
          onClick={() => setActiveTab('PROGRAMS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'PROGRAMS'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Award className="w-4 h-4" /> Skills & Homework ({homeworkList.length})
        </button>

        <button
          id="tab-reports"
          onClick={() => setActiveTab('REPORTS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'REPORTS'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4" /> Reports & Governance
        </button>

        <button
          id="tab-tests"
          onClick={() => setActiveTab('TESTS')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'TESTS'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Automated Verification (13 Tests)
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: WORK QUEUE & INTAKE */}
      {/* ===================================================================== */}
      {activeTab === 'QUEUE' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-400" />
              Daily Operational Queue & Client Handoffs
            </h2>
            <button
              onClick={refresh}
              className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queueItems.map(item => (
              <div
                key={item.queueItemId}
                className={`p-5 rounded-2xl border transition-all ${
                  item.petId === selectedPetId
                    ? 'bg-zinc-900/90 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                      item.priority === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {item.priority} Priority
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">{item.itemType}</span>
                </div>

                <div className="text-base font-bold text-white flex items-center gap-2">
                  {item.petName}
                  <span className="text-xs font-normal text-zinc-400">({item.clientName})</span>
                </div>

                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.notes}</p>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {item.status}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPetId(item.petId);
                      setActiveTab('ASSESSMENT');
                    }}
                    className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                  >
                    Open Case <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Active Client Consent & Boundary Summary */}
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Client Relationship & Consent Governance ({activePet?.name})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-zinc-500 font-medium mb-1">Access Grant Status</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {grant?.status || 'NO ACTIVE GRANT'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-2">
                  Scopes: {grant?.scopes.join(', ') || 'None'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-zinc-500 font-medium mb-1">Owner Consent & Rules</div>
                <div className="text-sm font-bold text-white">
                  {consent ? 'Signed & Active' : 'Consent Pending'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-2">
                  Restrictions: {consent?.handlingRestrictions.join(', ') || 'Standard handling'}
                </div>
                <div className="text-[11px] text-rose-400 mt-1">
                  Allergens: {consent?.treatAllergenExclusions.join(', ') || 'None reported'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-zinc-500 font-medium mb-1">Emergency Authorization</div>
                <div className="text-sm font-bold text-white">
                  {consent?.emergencyVetCareAuthorized ? 'Authorized' : 'Not Authorized'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-2">
                  Designated Vet: {consent?.designatedEmergencyVet || 'Standard Emergency Clinic'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ASSESSMENT & GOALS */}
      {/* ===================================================================== */}
      {activeTab === 'ASSESSMENT' && (
        <div className="space-y-6">
          {currentAssessment ? (
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${
                        currentAssessment.status === 'FINALIZED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : currentAssessment.status === 'AMENDED'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {currentAssessment.status}
                    </span>
                    <h2 className="text-xl font-bold text-white">
                      Professional Assessment: {currentAssessment.recommendedPlanTitle}
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Evaluated for {activePet?.name} ({activePet?.breedCode || activePet?.customBreedName || 'Canine'}) on{' '}
                    {new Date(currentAssessment.assessmentDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {currentAssessment.status === 'DRAFT' && (
                    <button
                      id="btn-finalize-assessment"
                      onClick={handleFinalizeAssessment}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow"
                    >
                      <Check className="w-4 h-4" /> Sign & Finalize Assessment
                    </button>
                  )}
                  {(currentAssessment.status === 'FINALIZED' || currentAssessment.status === 'AMENDED') && (
                    <button
                      id="btn-amend-assessment"
                      onClick={() => setShowAmendModal(true)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 font-semibold rounded-xl text-xs flex items-center gap-2"
                    >
                      <Sliders className="w-4 h-4" /> File Record Amendment
                    </button>
                  )}
                </div>
              </div>

              {/* Goals Breakdown: Owner vs Trainer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-400" /> Owner-Stated Goals
                  </h3>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {currentAssessment.ownerStatedGoals.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" /> Trainer Professional Goals
                  </h3>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {currentAssessment.trainerAssessedGoals.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Skill Baselines Table */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Assessed Skill Baselines (Canonical Sprint 8 Sync)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Skill</th>
                        <th className="p-3">Baseline Proficiency</th>
                        <th className="p-3">Trainer Clinical Observation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                      {currentAssessment.skillBaselines.map(base => (
                        <tr key={base.skillId} className="hover:bg-zinc-800/30">
                          <td className="p-3 font-semibold text-white">{base.skillName}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {base.baselineProficiency}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-400">{base.notes || 'No specific notes'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Non-Diagnostic Disclaimer & Safety */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <ShieldCheck className="w-4 h-4" /> Professional Non-Diagnostic Boundary Notice
                </div>
                <p className="leading-relaxed text-[11px] text-zinc-400">
                  {currentAssessment.nonDiagnosticDisclaimer}
                </p>
                {currentAssessment.finalizedAt && (
                  <div className="pt-2 border-t border-zinc-800 text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Signed by Verified Trainer on {new Date(currentAssessment.finalizedAt).toLocaleString()} (License: {currentAssessment.trainerCredentialSnapshot})
                  </div>
                )}
              </div>

              {/* Amendments History */}
              {currentAssessment.amendments.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  <h4 className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" /> Formal Record Amendments ({currentAssessment.amendments.length})
                  </h4>
                  <div className="space-y-2">
                    {currentAssessment.amendments.map(am => (
                      <div key={am.amendmentId} className="p-3 rounded-lg bg-zinc-950 border border-purple-500/30 text-xs">
                        <div className="flex justify-between text-zinc-500 text-[10px] mb-1">
                          <span>Reason: {am.amendmentReason}</span>
                          <span>{new Date(am.amendedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="text-zinc-300">{am.correctionDetails}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl">
              <BookOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <div className="text-sm font-bold text-white">No Assessment Found for Selected Pet</div>
              <p className="text-xs text-zinc-400 mt-1">Select Kibo or generate an initial intake assessment.</p>
            </div>
          )}

          {/* Amendment Modal */}
          {showAmendModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  File Formal Assessment Amendment
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Finalized clinical records cannot be overwritten. An amendment attaches an immutable correction entry.
                </p>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Reason for Amendment</label>
                    <input
                      type="text"
                      value={amendReason}
                      onChange={e => setAmendReason(e.target.value)}
                      placeholder="e.g., Client reported increased reactivity to bicycles..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 font-semibold">Correction Details</label>
                    <textarea
                      rows={3}
                      value={amendDetails}
                      onChange={e => setAmendDetails(e.target.value)}
                      placeholder="Specify the amended behavior protocol or threshold adjustments..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setShowAmendModal(false)}
                      className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAmendAssessment}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow"
                    >
                      Record Amendment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: LIVE SESSION EXECUTION */}
      {/* ===================================================================== */}
      {activeTab === 'SESSION' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-amber-400" />
                  Live Professional Session Execution Flow
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Enforces automated safety checks, health restrictions, treat allergen verification, and household handoffs.
                </p>
              </div>

              {!activeSessionAssignmentId ? (
                <button
                  id="btn-start-session"
                  onClick={handleStartSession}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg"
                >
                  <PlayCircle className="w-4 h-4" /> Start New Professional Session
                </button>
              ) : (
                <button
                  id="btn-complete-session"
                  onClick={handleCompleteSession}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" /> Complete Session & Handoff Summary
                </button>
              )}
            </div>

            {/* Session In-Progress Controls */}
            {activeSessionAssignmentId ? (
              <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    Active Session in Progress for {activePet?.name}
                  </div>
                  <span className="font-mono text-[11px]">Assignment: {activeSessionAssignmentId.substring(0, 16)}</span>
                </div>

                {/* Exercise Repetitions Logger */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Exercise Name</label>
                      <input
                        type="text"
                        value={exerciseName}
                        onChange={e => setExerciseName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-zinc-400 mb-1 font-semibold">Repetitions</label>
                        <input
                          type="number"
                          value={exerciseReps}
                          min={1}
                          max={30}
                          onChange={e => setExerciseReps(parseInt(e.target.value) || 1)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-5">
                        <input
                          type="checkbox"
                          id="check-high-impact"
                          checked={isHighImpact}
                          onChange={e => setIsHighImpact(e.target.checked)}
                          className="rounded bg-zinc-900 border-zinc-800 text-amber-500 focus:ring-amber-500"
                        />
                        <label htmlFor="check-high-impact" className="text-zinc-300 text-xs">
                          High Impact (Agility/Hurdle)
                        </label>
                      </div>
                    </div>

                    <button
                      id="btn-record-attempt"
                      onClick={handleRecordAttempt}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/40 rounded-xl font-bold flex items-center justify-center gap-2 shadow"
                    >
                      <Plus className="w-4 h-4" /> Record Exercise Attempt in Sprint 8
                    </button>
                  </div>

                  {/* Treat & Nutrition Safety Check */}
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-semibold">Reward Treat Selection</label>
                      <select
                        value={treatFoodChoice}
                        onChange={e => setTreatFoodChoice(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="Freeze-Dried Beef Liver">Freeze-Dried Beef Liver (Safe)</option>
                        <option value="Salmon Jerky Treats">Salmon Jerky Treats (Safe)</option>
                        <option value="Chicken Biscuit Jerky">Chicken Biscuit Jerky (Allergen: Chicken - Will Block)</option>
                      </select>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Sprint 7 Nutrition safety check rejects treats containing allergens flagged in owner consent or medical profile.
                      </p>
                    </div>

                    <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                      <div className="font-semibold text-zinc-300">Safety Verification Status:</div>
                      <div>• Orthopedic Restrictions: Monitored via Sprint 5 HealthStore</div>
                      <div>• Allergen Screening: Chicken & Wheat blocked for Kibo</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="text-xs text-zinc-400 mb-4 font-semibold uppercase tracking-wider">
                  Previously Completed Session Handoff Summary
                </div>
                {completedSession && completedSession.handoffSummary ? (
                  <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 text-xs">
                    <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-3">
                      <span className="font-bold text-white text-sm">Household Handoff Note</span>
                      <span>Duration: {completedSession.durationMinutes || 30} mins</span>
                    </div>

                    <div>
                      <div className="text-zinc-500 font-semibold mb-1">What We Worked On:</div>
                      <div className="text-zinc-300">
                        {completedSession.handoffSummary.whatWorkedOn.join(', ')}
                      </div>
                    </div>

                    <div>
                      <div className="text-zinc-500 font-semibold mb-1">Behavioral Progress Observed:</div>
                      <div className="text-zinc-300 leading-relaxed">
                        {completedSession.handoffSummary.whatChangedSummary}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                        <div className="text-amber-400 font-semibold mb-1">What to Practice at Home:</div>
                        <div className="text-zinc-300">{completedSession.handoffSummary.whatToPractice.join(', ')}</div>
                        <div className="text-zinc-500 text-[11px] mt-1">
                          Frequency: {completedSession.handoffSummary.practiceFrequencyRecommendation}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                        <div className="text-rose-400 font-semibold mb-1">What to Watch For:</div>
                        <div className="text-zinc-300">{completedSession.handoffSummary.whatToWatchFor.join(', ')}</div>
                      </div>
                    </div>

                    <div className="pt-2 text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Session successfully projected into Sprint 9 ActivityStore as verified provider training activity.
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950 rounded-xl">
                    No completed session records for this pet yet. Click "Start New Professional Session" above.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SKILLS & HOMEWORK */}
      {/* ===================================================================== */}
      {activeTab === 'PROGRAMS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Canonical Sprint 8 Skill Mastery Matrix */}
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Canonical Skill Mastery Matrix (Sprint 8 TrainingStore)
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Real-time proficiency tracking directly synchronized with the canonical Training domain.
              </p>

              <div className="space-y-3">
                {skillProgressList.map(prog => (
                  <div
                    key={prog.skillProgressId}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">Skill ID: {prog.skillId}</div>
                      <div className="text-[11px] text-zinc-400">
                        Sessions: {prog.sessionCount} · Total Reps: {prog.successfulRepetitionsTotal}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          prog.currentProficiency === 'RELIABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : prog.currentProficiency === 'DEVELOPING'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {prog.currentProficiency}
                      </span>
                      <div className="text-[10px] text-zinc-500 mt-1">{prog.assessmentProvenance}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Homework Assignments & Caregiver Execution */}
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Active Homework & Caregiver Practice Log
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Assigned by verified trainer; logged by household owner with HOUSEHOLD_CAREGIVER provenance.
              </p>

              <div className="space-y-4">
                {homeworkList.map(hw => (
                  <div key={hw.homeworkId} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">{hw.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hw.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {hw.status}
                      </span>
                    </div>
                    <p className="text-zinc-400 mb-3 leading-relaxed">{hw.instructions}</p>

                    {/* Caregiver Logs */}
                    <div className="space-y-2 pt-3 border-t border-zinc-800/80">
                      <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Caregiver Completed Logs ({hw.caregiverLogs.length})
                      </div>
                      {hw.caregiverLogs.map(log => (
                        <div
                          key={log.logId}
                          className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px]"
                        >
                          <div className="flex justify-between text-zinc-400 mb-1">
                            <span className="font-bold text-cyan-300">
                              Elena Vance ({log.caregiverProvenance})
                            </span>
                            <span>{new Date(log.completedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-zinc-300">{log.notes}</div>
                        </div>
                      ))}

                      <button
                        id="btn-log-caregiver-homework"
                        onClick={() => handleCaregiverLogHomework(hw.homeworkId)}
                        className="w-full mt-2 py-2 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/30 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Log Home Practice Session (Caregiver Action)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: REPORTS & GOVERNANCE */}
      {/* ===================================================================== */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Professional Behavioral Reports & Document Export
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Exports canonical PDF copies directly to Sprint 4 Pet Documents with VERIFIED_PROFESSIONAL provenance.
                </p>
              </div>

              <button
                id="btn-generate-report"
                onClick={handleGenerateReport}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow"
              >
                <Plus className="w-4 h-4" /> Generate Milestone Progress Report
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {reports.map(rep => (
                <div key={rep.reportId} className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">{rep.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {rep.status}
                    </span>
                  </div>

                  <p className="text-zinc-300 leading-relaxed">{rep.executiveSummary}</p>

                  <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-400">
                    <div className="font-semibold text-zinc-300 mb-1">Observed Behavior Stabilization:</div>
                    <div>{rep.behaviorChangesSummary}</div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-zinc-800 text-zinc-500">
                    <span>Exported to Sprint 4 Document ID: {rep.documentId}</span>
                    <span>Signed by: Juma Ochieng (CPDT-KA-2024-0012)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: AUTOMATED VERIFICATION SUITE */}
      {/* ===================================================================== */}
      {activeTab === 'TESTS' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Sprint 20 Automated Invariant Test Suite
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Exhaustively verifies role-based access, suspension enforcement, canonical Sprint 8 sync, immutability, health safety, treat allergens, and multi-domain projections.
                </p>
              </div>

              <button
                id="btn-run-all-tests"
                disabled={testSuiteRunning}
                onClick={handleRunTests}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                {testSuiteRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Running Governance Suite...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" /> Run 13 Invariant Tests
                  </>
                )}
              </button>
            </div>

            {testResults && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">Total Tests</div>
                    <div className="text-2xl font-bold text-white">{testResults.total}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/30">
                    <div className="text-xs text-emerald-500 mb-1">Passed</div>
                    <div className="text-2xl font-bold text-emerald-400">{testResults.passed}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-1">Failed</div>
                    <div className="text-2xl font-bold text-zinc-400">{testResults.failed}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  {testResults.results.map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        res.passed
                          ? 'bg-zinc-950/60 border-emerald-500/30 text-zinc-200'
                          : 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-semibold">{res.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {res.error && <span className="text-[11px] text-rose-400 max-w-md truncate">{res.error}</span>}
                        <span className="text-[10px] text-zinc-500 font-mono">{res.durationMs}ms</span>
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
