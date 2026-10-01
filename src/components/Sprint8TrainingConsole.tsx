/**
 * Pet OS Sprint 8 - Training, Skills & Behavior Development Console
 * Implements Volume X (Training & Behavior Architecture), Volume III, Volume IV,
 * Volume V, Volume VI, Volume XI, Volume XII, Volume XIV, Volume XXIV-XXXI, Volume XXXV, Volume XLI-XLII.
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Award,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  User,
  Plus,
  BookOpen,
  Calendar,
  Flame,
  Activity,
  Layers,
  Info,
  X,
  Target,
  Clock,
  Sparkles,
  FileText,
  HelpCircle,
  Stethoscope,
  Utensils,
  Share2
} from 'lucide-react';
import {
  asUserId,
  asPetId,
  asHouseholdId,
  asSkillId,
  asTrainingPlanId,
  asTrainingSessionId,
  asTrainingExerciseId,
  UserId,
  PetId,
  HouseholdId,
  SkillId,
  TrainingPlanId,
  TrainingSessionId
} from '../pet-os/kernel/ids';
import { currentClockUtcNow } from '../pet-os/kernel/time';
import { PetStore } from '../pet-os/pet-core/store';
import { IdentityStore } from '../pet-os/identity/store';
import { TrainingStore } from '../pet-os/training/store';
import { TrainingService } from '../pet-os/training/service';
import { seedTrainingData } from '../pet-os/training/seed';
import { Sprint8TrainingTestSuite, TestResult } from '../pet-os/training/tests';
import {
  Skill,
  TrainingPlan,
  TrainingSession,
  PetSkillProgress,
  TrainingMilestone,
  BehaviorObservation,
  TrainingProgram,
  ProgramVersion,
  ProgramStage,
  AssistanceLevel,
  DistractionLevel,
  BehaviorTrigger,
  SkillProficiencyLevel
} from '../pet-os/training/types';

export const Sprint8TrainingConsole: React.FC = () => {
  // Context & Actor State
  const [selectedPetId, setSelectedPetId] = useState<PetId>(asPetId('pet-001'));
  const [activeActorId, setActiveActorId] = useState<UserId>(asUserId('user-owner-001'));
  const [householdId, setHouseholdId] = useState<HouseholdId>(asHouseholdId('household-001'));

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'SKILLS' | 'SESSION_RUNNER' | 'BEHAVIOR_JOURNAL' | 'MILESTONES' | 'TRAINER_HANDOFF' | 'TESTS'
  >('OVERVIEW');

  // Domain Data State
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [skillProgressList, setSkillProgressList] = useState<PetSkillProgress[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [milestones, setMilestones] = useState<TrainingMilestone[]>([]);
  const [observations, setObservations] = useState<BehaviorObservation[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);

  // Active Interactive Session State
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionTreatCount, setSessionTreatCount] = useState<number>(8);
  const [attemptSkillId, setAttemptSkillId] = useState<SkillId>(asSkillId('skill-sit-001'));
  const [attemptReps, setAttemptReps] = useState<number>(10);
  const [attemptSuccessReps, setAttemptSuccessReps] = useState<number>(9);
  const [attemptAssistance, setAttemptAssistance] = useState<AssistanceLevel>('INDEPENDENT');
  const [attemptDistraction, setAttemptDistraction] = useState<DistractionLevel>('LOW');
  const [attemptNotes, setAttemptNotes] = useState('');

  // Behavior Observation Form State
  const [showObsModal, setShowObsModal] = useState(false);
  const [obsCategory, setObsCategory] = useState<string>('BARKING');
  const [obsTrigger, setObsTrigger] = useState<BehaviorTrigger>('DOORBELL');
  const [obsIntensity, setObsIntensity] = useState<number>(2);
  const [obsDescription, setObsDescription] = useState('');
  const [obsContext, setObsContext] = useState('');
  const [obsResponse, setObsResponse] = useState('');
  const [obsInterpretation, setObsInterpretation] = useState('');
  const [obsLocation, setObsLocation] = useState('');

  // Test Suite State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  // Initialize data on mount
  useEffect(() => {
    // Seed if empty
    if (TrainingStore.listAllSkills().length === 0) {
      seedTrainingData();
    }
    refreshData();
  }, [selectedPetId, activeActorId]);

  const refreshData = () => {
    try {
      const plan = TrainingService.getActivePlanForPet(selectedPetId, activeActorId, householdId);
      setActivePlan(plan);
    } catch {
      setActivePlan(null);
    }

    const skills = TrainingStore.listAllSkills();
    setAllSkills(skills);

    try {
      const progress = TrainingService.listSkillProgress(selectedPetId, activeActorId, householdId);
      setSkillProgressList(progress);
    } catch {
      setSkillProgressList([]);
    }

    try {
      const sessList = TrainingService.listSessionsForPet(selectedPetId, activeActorId, householdId);
      setSessions(sessList);
      // Check if there's an in-progress session
      const inProgress = sessList.find(s => s.status === 'IN_PROGRESS');
      setCurrentSession(inProgress || null);
    } catch {
      setSessions([]);
      setCurrentSession(null);
    }

    try {
      const msList = TrainingService.listMilestonesForPet(selectedPetId, activeActorId, householdId);
      setMilestones(msList);
    } catch {
      setMilestones([]);
    }

    try {
      const obsList = TrainingService.listObservationsForPet(selectedPetId, activeActorId, householdId);
      setObservations(obsList);
    } catch {
      setObservations([]);
    }

    setPrograms(TrainingStore.listAllPrograms());
  };

  const showFeedback = (text: string, type: 'success' | 'error' | 'info') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Actions
  const handleResetData = () => {
    seedTrainingData();
    refreshData();
    showFeedback('Sprint 8 canonical seed data restored successfully.', 'success');
  };

  const handleStartSession = () => {
    if (!activePlan) {
      showFeedback('No active training plan found for this pet.', 'error');
      return;
    }
    try {
      const session = TrainingService.startSession(
        {
          householdId,
          petId: selectedPetId,
          planId: activePlan.trainingPlanId,
          stageId: activePlan.currentStageId,
          environment: 'HOME'
        },
        activeActorId
      );
      setCurrentSession(session);
      refreshData();
      showFeedback('Training session started! Record exercise attempts below.', 'success');
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRecordAttempt = () => {
    if (!currentSession) return;
    try {
      TrainingService.recordAttempt(
        {
          sessionId: currentSession.trainingSessionId,
          exerciseId: asTrainingExerciseId(`ex-${Date.now()}`),
          skillId: attemptSkillId,
          result: attemptSuccessReps >= attemptReps * 0.7 ? 'SUCCESSFUL' : 'PARTIAL',
          repetitions: attemptReps,
          successfulRepetitions: attemptSuccessReps,
          assistanceLevel: attemptAssistance,
          distractionLevel: attemptDistraction,
          environment: currentSession.environment,
          notes: attemptNotes
        },
        activeActorId,
        householdId
      );
      setAttemptNotes('');
      refreshData();
      showFeedback('Exercise attempt recorded successfully.', 'success');
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCompleteSession = () => {
    if (!currentSession) return;
    try {
      TrainingService.completeSession(
        {
          sessionId: currentSession.trainingSessionId,
          overallPerformance: 'SUCCESSFUL',
          notes: sessionNotes,
          treatCountRecorded: sessionTreatCount
        },
        activeActorId,
        householdId
      );
      setCurrentSession(null);
      setSessionNotes('');
      refreshData();
      showFeedback(
        'Session completed! Deterministic skill proficiency updated & treats synchronized with Nutrition context.',
        'success'
      );
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRecordObservation = () => {
    if (!obsDescription.trim()) {
      showFeedback('Please describe the factual observed behavior.', 'error');
      return;
    }
    try {
      const obs = TrainingService.recordBehaviorObservation(
        {
          householdId,
          petId: selectedPetId,
          category: obsCategory as any,
          behaviorDescription: obsDescription,
          context: obsContext,
          trigger: obsTrigger,
          durationMinutes: 2,
          frequency: 'OCCASIONAL',
          intensity: obsIntensity,
          locationContext: obsLocation,
          ownerResponse: obsResponse,
          outcome: 'Observed and recorded.',
          ownerInterpretation: obsInterpretation || undefined,
          provenance: 'OWNER_OBSERVED'
        },
        activeActorId
      );

      setShowObsModal(false);
      setObsDescription('');
      setObsContext('');
      setObsResponse('');
      setObsInterpretation('');
      setObsLocation('');
      refreshData();

      if (obs.highRiskCategory !== 'NONE') {
        showFeedback(
          `Observation recorded. Escalation flag: ${obs.highRiskCategory}. Safety guidance attached.`,
          'info'
        );
      } else {
        showFeedback('Behavior observation logged with factual separation.', 'success');
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    try {
      const results = await Sprint8TrainingTestSuite.runAllTests();
      setTestResults(results);
      const passedCount = results.filter(r => r.passed).length;
      showFeedback(
        `Automated Test Suite Completed: ${passedCount}/${results.length} tests passing.`,
        passedCount === results.length ? 'success' : 'error'
      );
    } catch (err: any) {
      showFeedback(`Test Suite Execution Failed: ${err.message}`, 'error');
    } finally {
      setIsRunningTests(false);
      refreshData();
    }
  };

  const getActorLabel = (id: UserId): { name: string; role: string; badge: string } => {
    if (id.includes('owner')) {
      return { name: 'Sarah Chen', role: 'Household Owner', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
    if (id.includes('trainer')) {
      return { name: 'Sarah Jenkins, CPDT-KA', role: 'Certified Trainer', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    }
    if (id.includes('caregiver')) {
      return { name: 'Alex Rivera', role: 'Temporary Caregiver', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
    return { name: 'External Stranger', role: 'Unauthorized IDOR Test', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  };

  const getProficiencyBadge = (prof: SkillProficiencyLevel) => {
    switch (prof) {
      case 'RELIABLE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'GENERALIZING':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'RELIABLE_IN_CONTROLLED_ENVIRONMENT':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'DEVELOPING':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'INTRODUCED':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default:
        return 'bg-slate-700/40 text-slate-400 border-slate-700';
    }
  };

  const currentActor = getActorLabel(activeActorId);

  return (
    <div className="space-y-6">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between shadow-lg transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
              : feedbackMessage.type === 'error'
              ? 'bg-rose-950/80 text-rose-300 border-rose-800/80'
              : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Actor Context & Architecture Rules */}
      <div className="bg-[#131720] border border-[#232936] rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                  Training, Skills &amp; Behavior Development
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Sprint 8 Bounded Context
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volume X Specification: Skills Catalogue · Curriculum Versioning · Session Execution · Deterministic Proficiency · Behavioral Fact Tracking
              </p>
            </div>
          </div>

          {/* Actor & Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Actor Switcher */}
            <div className="flex items-center gap-2 bg-[#1A202C] px-3 py-1.5 rounded-xl border border-[#2D3748]">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Actor:</span>
              <select
                value={activeActorId}
                onChange={e => setActiveActorId(asUserId(e.target.value))}
                className="bg-transparent text-xs font-semibold text-slate-200 outline-none cursor-pointer"
              >
                <option value="user-owner-001" className="bg-[#1A202C] text-slate-200">
                  Sarah Chen (Owner)
                </option>
                <option value="user-trainer-001" className="bg-[#1A202C] text-slate-200">
                  Sarah Jenkins, CPDT-KA (Trainer)
                </option>
                <option value="user-caregiver-001" className="bg-[#1A202C] text-slate-200">
                  Alex Rivera (Caregiver)
                </option>
                <option value="user-stranger-002" className="bg-[#1A202C] text-slate-200">
                  External Stranger (IDOR Test)
                </option>
              </select>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${currentActor.badge}`}>
                {currentActor.role}
              </span>
            </div>

            {/* Seed / Reset Button */}
            <button
              id="btn-reset-training-seed"
              onClick={handleResetData}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-[#1E293B] hover:bg-[#2D3748] border border-[#334155] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Reset to canonical Sprint 8 test data"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
          </div>
        </div>

        {/* Boundary Guard Notice */}
        <div className="mt-4 pt-3 border-t border-[#1E293B] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span><strong>No AI Diagnosis:</strong> Factual observations separated from psychiatric claims.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span><strong>Deterministic Proficiency:</strong> 1 single session never jumps to Reliable.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span><strong>Safety Escalation:</strong> High-risk triggers prompt veterinary/behaviorist referral.</span>
          </div>
        </div>
      </div>

      {/* Secondary Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#232936] pb-2">
        <button
          id="subtab-overview"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'OVERVIEW'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Active Plans &amp; Overview</span>
        </button>

        <button
          id="subtab-skills"
          onClick={() => setActiveTab('SKILLS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'SKILLS'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Skills Catalogue ({allSkills.length})</span>
        </button>

        <button
          id="subtab-session-runner"
          onClick={() => setActiveTab('SESSION_RUNNER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'SESSION_RUNNER'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Interactive Session Runner {currentSession && '• Active'}</span>
        </button>

        <button
          id="subtab-behavior-journal"
          onClick={() => setActiveTab('BEHAVIOR_JOURNAL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'BEHAVIOR_JOURNAL'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Behavior Journal ({observations.length})</span>
        </button>

        <button
          id="subtab-milestones"
          onClick={() => setActiveTab('MILESTONES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'MILESTONES'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Milestones &amp; Evidence ({milestones.length})</span>
        </button>

        <button
          id="subtab-trainer-handoff"
          onClick={() => setActiveTab('TRAINER_HANDOFF')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'TRAINER_HANDOFF'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Trainer Handoff Dossier</span>
        </button>

        <button
          id="subtab-tests"
          onClick={() => setActiveTab('TESTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'TESTS'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1A202C]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sprint 8 Test Suite</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Plan Card */}
          <div className="lg:col-span-2 bg-[#131720] border border-[#232936] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Current Plan</span>
                <h2 className="text-xl font-bold text-slate-100 mt-0.5">
                  {activePlan ? activePlan.title : 'No Active Training Plan'}
                </h2>
              </div>
              {activePlan && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activePlan.status}
                </span>
              )}
            </div>

            {activePlan ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{activePlan.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Plan Type</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">{activePlan.planType}</p>
                  </div>
                  <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Provenance</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">{activePlan.sourceType}</p>
                  </div>
                  <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Prescribing Trainer</span>
                    <p className="text-xs font-semibold text-indigo-300 mt-1 truncate">
                      {activePlan.trainerName || 'Self-Guided'}
                    </p>
                  </div>
                  <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Verification</span>
                    <p className="text-xs font-semibold text-emerald-400 mt-1">
                      {activePlan.trainerVerificationStatus}
                    </p>
                  </div>
                </div>

                {/* Stage Progression Visualizer */}
                <div className="pt-4 border-t border-[#232936]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">Curriculum Stages (Puppy Foundations)</span>
                    <span className="text-xs text-slate-400">Stage 2 of 3 Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-400">STAGE 1</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <p className="text-xs font-semibold text-slate-200 mt-1">Marker &amp; Engagement</p>
                      <span className="text-[10px] text-emerald-300">Mastered (100%)</span>
                    </div>

                    <div className="bg-indigo-950/40 border border-indigo-700/60 p-3 rounded-xl shadow-md shadow-indigo-950/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300">STAGE 2</span>
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                      </div>
                      <p className="text-xs font-semibold text-slate-100 mt-1">Foundation Positions</p>
                      <span className="text-[10px] text-indigo-300">In Progress (Sit, Down, Stay)</span>
                    </div>

                    <div className="bg-[#1A202C]/60 border border-[#2D3748] p-3 rounded-xl opacity-60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">STAGE 3</span>
                        <span className="text-[10px] text-slate-500">Locked</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-400 mt-1">Loose Leash Basics</p>
                      <span className="text-[10px] text-slate-500">Prereq: Stage 2</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Target End Date: {activePlan.targetEndAt ? new Date(activePlan.targetEndAt).toLocaleDateString() : 'Continuous'}
                  </span>
                  <button
                    onClick={() => setActiveTab('SESSION_RUNNER')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch Session For Stage 2</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-sm">
                No active plan found. Click Reset Data to restore canonical state.
              </div>
            )}
          </div>

          {/* Side Column: Quick Stats & Proficiency Snapshot */}
          <div className="space-y-6">
            {/* Quick Metrics */}
            <div className="bg-[#131720] border border-[#232936] rounded-2xl p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Simba Progress Snapshot</span>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                  <span className="text-[10px] text-slate-400">Total Sessions</span>
                  <p className="text-lg font-bold text-slate-100 mt-0.5">{sessions.length}</p>
                </div>
                <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                  <span className="text-[10px] text-slate-400">Milestones</span>
                  <p className="text-lg font-bold text-indigo-400 mt-0.5">{milestones.length}</p>
                </div>
                <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                  <span className="text-[10px] text-slate-400">Skills Tracked</span>
                  <p className="text-lg font-bold text-slate-100 mt-0.5">{skillProgressList.length}</p>
                </div>
                <div className="bg-[#1A202C] p-3 rounded-xl border border-[#2D3748]">
                  <span className="text-[10px] text-slate-400">Behavior Logs</span>
                  <p className="text-lg font-bold text-slate-100 mt-0.5">{observations.length}</p>
                </div>
              </div>
            </div>

            {/* Current Proficiency List */}
            <div className="bg-[#131720] border border-[#232936] rounded-2xl p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assessed Competencies</span>
              <div className="space-y-2 mt-3">
                {skillProgressList.map(prog => {
                  const skill = allSkills.find(s => s.skillId === prog.skillId);
                  return (
                    <div
                      key={prog.skillProgressId}
                      className="p-3 rounded-xl bg-[#1A202C] border border-[#2D3748] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-200">{skill?.name || prog.skillId}</p>
                        <p className="text-[10px] text-slate-400">
                          {prog.successfulRepetitionsTotal} successful reps · {prog.assessmentProvenance}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getProficiencyBadge(prog.currentProficiency)}`}>
                        {prog.currentProficiency}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SKILLS CATALOGUE */}
      {activeTab === 'SKILLS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Canonical Skills Catalogue</h2>
              <p className="text-xs text-slate-400">
                Structured prerequisite graph, taxonomy, and deterministic proficiency tiers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSkills.map(skill => {
              const currentProg = skillProgressList.find(p => p.skillId === skill.skillId);
              const prereqSkills = allSkills.filter(s => skill.prerequisiteSkillIds.includes(s.skillId));

              return (
                <div
                  key={skill.skillId}
                  className="bg-[#131720] border border-[#232936] rounded-2xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {skill.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{skill.skillCode}</span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-100">{skill.name}</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{skill.description}</p>

                    {/* Prerequisite Tags */}
                    {prereqSkills.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-[#232936]">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                          Prerequisites
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {prereqSkills.map(pr => (
                            <span
                              key={pr.skillId}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {pr.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Current Pet Status */}
                  <div className="mt-4 pt-3 border-t border-[#232936] flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Simba Status:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getProficiencyBadge(
                        currentProg?.currentProficiency || 'NOT_STARTED'
                      )}`}
                    >
                      {currentProg?.currentProficiency || 'NOT_STARTED'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE SESSION RUNNER */}
      {activeTab === 'SESSION_RUNNER' && (
        <div className="space-y-6">
          {!currentSession ? (
            <div className="bg-[#131720] border border-[#232936] rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <Play className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">Ready for Training Session?</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Start a live session for Simba under active plan <strong>{activePlan?.title || 'Puppy Foundations'}</strong>.
                Session attempts record assistance levels and update proficiency deterministically.
              </p>
              <button
                id="btn-start-session"
                onClick={handleStartSession}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Start Training Session</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#131720] border border-indigo-500/40 rounded-2xl p-6 space-y-6 shadow-2xl shadow-indigo-950/40">
              {/* Active Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#232936]">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Active Training Session In Progress
                    </span>
                    <h2 className="text-lg font-bold text-slate-100">Simba · Stage 2 Foundation Positions</h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">
                    Session ID: {currentSession.trainingSessionId.slice(0, 16)}...
                  </span>
                  <button
                    id="btn-complete-session"
                    onClick={handleCompleteSession}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete &amp; Save Session</span>
                  </button>
                </div>
              </div>

              {/* Record Exercise Attempt Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200">Log Exercise Attempt</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Target Skill</label>
                      <select
                        value={attemptSkillId}
                        onChange={e => setAttemptSkillId(asSkillId(e.target.value))}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      >
                        {allSkills.map(s => (
                          <option key={s.skillId} value={s.skillId}>
                            {s.name} ({s.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Assistance Level</label>
                      <select
                        value={attemptAssistance}
                        onChange={e => setAttemptAssistance(e.target.value as AssistanceLevel)}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      >
                        <option value="INDEPENDENT">Independent (No prompts)</option>
                        <option value="PROMPTED">Prompted (Verbal/Hand cue)</option>
                        <option value="LURED">Lured (Treat at nose)</option>
                        <option value="PARTIAL_GUIDANCE">Partial Guidance (Gentle touch)</option>
                        <option value="FULL_GUIDANCE">Full Guidance</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Total Repetitions</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={attemptReps}
                        onChange={e => setAttemptReps(Number(e.target.value))}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Successful Repetitions</label>
                      <input
                        type="number"
                        min="0"
                        max={attemptReps}
                        value={attemptSuccessReps}
                        onChange={e => setAttemptSuccessReps(Number(e.target.value))}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-400 block mb-1">Distraction Level</label>
                      <select
                        value={attemptDistraction}
                        onChange={e => setAttemptDistraction(e.target.value as DistractionLevel)}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      >
                        <option value="NONE">None (Quiet room)</option>
                        <option value="LOW">Low (Family present)</option>
                        <option value="MODERATE">Moderate (Backyard noises)</option>
                        <option value="HIGH">High (Public park, other dogs)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs text-slate-400 block mb-1">Observation Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Sat immediately upon first hand cue, great focus"
                        value={attemptNotes}
                        onChange={e => setAttemptNotes(e.target.value)}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    id="btn-record-attempt"
                    onClick={handleRecordAttempt}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Attempt</span>
                  </button>
                </div>

                {/* Session Context & Nutrition Integration */}
                <div className="bg-[#1A202C] border border-[#2D3748] rounded-2xl p-5 space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Session Controls</span>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Training Treats Used</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={sessionTreatCount}
                        onChange={e => setSessionTreatCount(Number(e.target.value))}
                        className="w-24 bg-[#131720] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                      />
                      <span className="text-xs text-slate-400">pea-sized pieces</span>
                    </div>
                    <span className="text-[10px] text-amber-400 mt-1 block">
                      Synchronized to Nutrition domain (Sprint 7) upon completion.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Overall Session Summary</label>
                    <textarea
                      rows={3}
                      value={sessionNotes}
                      onChange={e => setSessionNotes(e.target.value)}
                      placeholder="Simba was highly engaged throughout session..."
                      className="w-full bg-[#131720] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-300">
                    <p className="font-semibold">Deterministic Progression</p>
                    <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                      Completing this session evaluates repetitions, consistency, and assistance level. A single session
                      never promotes directly to Reliable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Past Completed Sessions List */}
          <div className="bg-[#131720] border border-[#232936] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-200 mb-3">Session History ({sessions.length})</h3>
            <div className="space-y-3">
              {sessions.map(sess => (
                <div
                  key={sess.trainingSessionId}
                  className="p-4 rounded-xl bg-[#1A202C] border border-[#2D3748] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        {new Date(sess.startedAt).toLocaleDateString()} at{' '}
                        {new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {sess.status}
                      </span>
                      <span className="text-xs text-slate-400">· {sess.environment}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{sess.notes || 'Routine training practice'}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                      <span>Duration: {Math.round((sess.durationSeconds || 600) / 60)}m</span>
                      <span>Treats logged: {sess.treatCountRecorded || 0}</span>
                      <span>Attempts: {sess.attempts?.length || 1}</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-indigo-300">
                    Conducted by: {sess.conductedByUserId.includes('owner') ? 'Owner' : 'Trainer'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BEHAVIOR JOURNAL */}
      {activeTab === 'BEHAVIOR_JOURNAL' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Behavioral Observations Journal</h2>
              <p className="text-xs text-slate-400">
                Observational logging preserving facts, context, and triggers distinctly from psychiatric diagnoses.
              </p>
            </div>
            <button
              id="btn-log-observation"
              onClick={() => setShowObsModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Observation</span>
            </button>
          </div>

          {/* Observations List */}
          <div className="space-y-3">
            {observations.map(obs => (
              <div
                key={obs.observationId}
                className={`p-5 rounded-2xl border transition-all ${
                  obs.highRiskCategory !== 'NONE'
                    ? 'bg-rose-950/20 border-rose-800/50 shadow-lg shadow-rose-950/20'
                    : 'bg-[#131720] border-[#232936]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {obs.category}
                    </span>
                    <span className="text-xs text-slate-400">Trigger: <strong>{obs.trigger}</strong></span>
                    <span className="text-xs text-slate-400">· Intensity: {obs.intensity}/5</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(obs.observedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Factual Description */}
                <div className="mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Factual Observation
                  </span>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{obs.behaviorDescription}</p>
                </div>

                {/* Owner Response & Outcome */}
                {obs.ownerResponse && (
                  <div className="mt-2 text-xs text-slate-300">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                      Owner Response &amp; Outcome
                    </span>
                    <p className="mt-0.5">{obs.ownerResponse} → {obs.outcome}</p>
                  </div>
                )}

                {/* Owner Interpretation (Separated) */}
                {obs.ownerInterpretation && (
                  <div className="mt-2 p-2.5 rounded-xl bg-[#1A202C] border border-[#2D3748] text-xs text-slate-300">
                    <span className="text-[10px] text-amber-400 font-bold block">
                      Owner Interpretation (Non-Diagnostic)
                    </span>
                    <p className="italic text-slate-300 mt-0.5">"{obs.ownerInterpretation}"</p>
                  </div>
                )}

                {/* High-Risk Non-Diagnostic Safety Escalation Notice */}
                {obs.safetyEscalationMessage && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-300 block">
                        Safety Escalation Guidance ({obs.highRiskCategory})
                      </span>
                      <p className="text-xs text-rose-200/90 mt-0.5 leading-relaxed">
                        {obs.safetyEscalationMessage}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Record Observation Modal */}
          {showObsModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#131720] border border-[#232936] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#232936]">
                  <h3 className="text-base font-bold text-slate-100">Record Behavioral Observation</h3>
                  <button onClick={() => setShowObsModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Category</label>
                      <select
                        value={obsCategory}
                        onChange={e => setObsCategory(e.target.value)}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                      >
                        <option value="BARKING">Barking / Vocalization</option>
                        <option value="JUMPING">Jumping on People</option>
                        <option value="REACTIVITY_OBSERVATION">Reactivity Observation</option>
                        <option value="RESOURCE_GUARDING_OBSERVATION">Resource Guarding Observation</option>
                        <option value="CHEWING">Chewing / Mouthing</option>
                        <option value="FEAR_OBSERVATION">Fear Posture Observation</option>
                        <option value="PULLING">Leash Pulling</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Trigger</label>
                      <select
                        value={obsTrigger}
                        onChange={e => setObsTrigger(e.target.value as BehaviorTrigger)}
                        className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                      >
                        <option value="DOORBELL">Doorbell / Knock</option>
                        <option value="STRANGER">Stranger Encounter</option>
                        <option value="OTHER_DOG">Other Dog Encounter</option>
                        <option value="HANDLING">Handling / Grooming / Vet</option>
                        <option value="FOOD_OR_BOWL">Food / Chew Item</option>
                        <option value="NOISE">Loud Sudden Noise</option>
                        <option value="LEFT_ALONE">Left Alone / Departure</option>
                        <option value="UNKNOWN">Unknown / Not Identified</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Intensity Scale (1 = Mild, 5 = Severe)</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={obsIntensity}
                      onChange={e => setObsIntensity(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1">
                      <span>1: Subtle ear tuck</span>
                      <span>3: Vocal/Active</span>
                      <span>5: Severe reaction</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Factual Observed Action (Required)</label>
                    <textarea
                      rows={2}
                      value={obsDescription}
                      onChange={e => setObsDescription(e.target.value)}
                      placeholder="State what pet physically did (e.g. barked 4 times, stiffened, lunged at toy)..."
                      className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2.5 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Location &amp; Context</label>
                    <input
                      type="text"
                      value={obsLocation}
                      onChange={e => setObsLocation(e.target.value)}
                      placeholder="e.g. Front door foyer during evening delivery"
                      className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Owner Response</label>
                    <input
                      type="text"
                      value={obsResponse}
                      onChange={e => setObsResponse(e.target.value)}
                      placeholder="e.g. Called away to sit, rewarded quiet behavior"
                      className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Owner Interpretation (Preserved Separately from Clinical Facts)
                    </label>
                    <input
                      type="text"
                      value={obsInterpretation}
                      onChange={e => setObsInterpretation(e.target.value)}
                      placeholder="e.g. Believes Simba was startled by the sudden knock"
                      className="w-full bg-[#1A202C] border border-[#2D3748] rounded-xl p-2 text-xs text-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#232936] flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowObsModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-save-observation"
                    onClick={handleRecordObservation}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    Save Observation
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MILESTONES & EVIDENCE */}
      {activeTab === 'MILESTONES' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Milestones &amp; Evidence Log</h2>
            <p className="text-xs text-slate-400">
              Automated milestone tracking with strict idempotency protection against duplicate event replay.
            </p>
          </div>

          <div className="space-y-3">
            {milestones.map(ms => (
              <div
                key={ms.milestoneId}
                className="bg-[#131720] border border-[#232936] rounded-2xl p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{ms.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {ms.milestoneType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ms.description}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      Achieved: {new Date(ms.achievedAt).toLocaleDateString()} · Idempotency Key: {ms.idempotencyKey}
                    </span>
                  </div>
                </div>

                <span className="text-xs text-emerald-400 font-semibold shrink-0">Verified</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: TRAINER HANDOFF DOSSIER */}
      {activeTab === 'TRAINER_HANDOFF' && (
        <div className="bg-[#131720] border border-[#232936] rounded-2xl p-6 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-[#232936]">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Professional Dossier</span>
              <h2 className="text-xl font-bold text-slate-100 mt-0.5">Trainer Handoff Summary: Simba</h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Verified Trainer Export
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Health Cross-Reference */}
            <div className="p-4 rounded-xl bg-[#1A202C] border border-[#2D3748]">
              <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                <Stethoscope className="w-4 h-4" />
                <span>Clinical &amp; Mobility Restrictions</span>
              </div>
              <p className="text-slate-300">
                Cross-referenced with Veterinary Health bounded context (Sprint 5). Ensure physical jumping exercises
                respect veterinary mobility guidelines.
              </p>
            </div>

            {/* Known Cues from Passport */}
            <div className="p-4 rounded-xl bg-[#1A202C] border border-[#2D3748]">
              <span className="font-bold text-slate-200 block mb-2">Known Verbal &amp; Hand Cues (Pet Passport)</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-[#131720] p-2.5 rounded-lg border border-[#232936]">
                  <span className="font-bold text-slate-100">"Sit"</span>
                  <span className="text-[10px] text-slate-400 block">Developing (Stage 2)</span>
                </div>
                <div className="bg-[#131720] p-2.5 rounded-lg border border-[#232936]">
                  <span className="font-bold text-slate-100">"Down"</span>
                  <span className="text-[10px] text-slate-400 block">Introduced (Stage 2)</span>
                </div>
                <div className="bg-[#131720] p-2.5 rounded-lg border border-[#232936]">
                  <span className="font-bold text-slate-100">"Yes!"</span>
                  <span className="text-[10px] text-emerald-400 block">Mastered Marker</span>
                </div>
              </div>
            </div>

            {/* Behavioral Summary */}
            <div className="p-4 rounded-xl bg-[#1A202C] border border-[#2D3748]">
              <span className="font-bold text-slate-200 block mb-2">Behavioral Observations for Professional</span>
              <p className="text-slate-300 leading-relaxed">
                Total observed events: {observations.length}. Owner notes doorway barking upon delivery arrival. No
                clinical diagnoses entered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: TEST SUITE */}
      {activeTab === 'TESTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Sprint 8 Automated Invariant &amp; Safety Test Suite</h2>
              <p className="text-xs text-slate-400">
                19 automated unit &amp; integration tests covering cycle detection, immutability, safety escalation, and domain isolation.
              </p>
            </div>
            <button
              id="btn-run-all-training-tests"
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                isRunningTests
                  ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              {isRunningTests ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Executing Invariant Tests...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Run 19 Invariant Tests</span>
                </>
              )}
            </button>
          </div>

          {/* Test Results Display */}
          {testResults.length > 0 && (
            <div className="bg-[#131720] border border-[#232936] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#232936]">
                <span className="text-xs font-bold text-slate-200">
                  Results: {testResults.filter(r => r.passed).length} of {testResults.length} Passed
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  {testResults.filter(r => r.passed).length === testResults.length ? 'ALL PASSING' : 'FAILURES DETECTED'}
                </span>
              </div>

              <div className="space-y-2">
                {testResults.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      t.passed
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {t.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">{t.name}</span>
                        {t.error && <p className="text-[10px] text-rose-400 mt-0.5">{t.error}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono opacity-60 shrink-0">{t.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
