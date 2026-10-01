/**
 * Pet OS Sprint 9 - Activity, Exercise, Walks, Rest, Daily Care Routines & Household Execution Console
 * Implements Volume XI (Activity, Exercise & Daily Care), Volume XXIV & XXV (AI Safety)
 *
 * Core Capabilities:
 * - Cross-Domain Daily Care Aggregator ("Who did what today?")
 * - Real-Time Stopwatch Session with Concurrency Guard & Abandoned Recovery
 * - Activity Taxonomy & Auditable Log (Walks, Play, Rest, Enrichment)
 * - Routine Scheduler with Duplicate Care Execution Protection
 * - Activity Goals with Veterinary Medical Restriction Protection
 * - Caregiver Handoff Summary for Walkers/Sitters
 * - Factual Distance Transparency without AI Health Scores
 * - Comprehensive 12-Check Automated Test Suite
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Footprints,
  Play,
  Pause,
  Square,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Flame,
  FileText,
  RotateCcw,
  Plus,
  X,
  ChevronRight,
  Info,
  Users,
  Dog,
  Utensils,
  Stethoscope,
  GraduationCap,
  Sparkles,
  HeartHandshake,
  Compass,
  Timer,
  Share2
} from 'lucide-react';
import {
  asPetId,
  asHouseholdId,
  asUserId,
  asActivitySessionId,
  asActivityOccurrenceId,
  asActivityGoalId,
  PetId,
  HouseholdId,
  UserId,
  ActivityId,
  ActivitySessionId,
  ActivityOccurrenceId
} from '../pet-os/kernel/ids';
import { currentClockUtcNow } from '../pet-os/kernel/time';
import { PetStore } from '../pet-os/pet-core/store';
import { IdentityStore } from '../pet-os/identity/store';
import { HealthStore } from '../pet-os/health/store';
import { ActivityStore } from '../pet-os/activity/store';
import { ActivityService } from '../pet-os/activity/service';
import { seedActivityData } from '../pet-os/activity/seed';
import { runActivityTests } from '../pet-os/activity/tests';
import {
  ActivityRecord,
  ActivitySession,
  ActivityRoutine,
  ActivityOccurrence,
  ActivityGoal,
  DailyCareItem,
  HouseholdCareSummary,
  CaregiverHandoffSummary,
  WeeklyActivitySummary,
  ActivityType
} from '../pet-os/activity/types';

// Ensure initial seed baseline is ready immediately
seedActivityData();

export const Sprint9ActivityConsole: React.FC = () => {
  // Ensure seed baseline exists on render
  seedActivityData();

  // Context & Actor State
  const [selectedPetId, setSelectedPetId] = useState<PetId>(asPetId('pet-01951500-0000-7000-8000-000000000001'));
  const [activeActorId, setActiveActorId] = useState<UserId>(asUserId('usr-01951500-0000-7000-8000-000000000001'));
  const [householdId, setHouseholdId] = useState<HouseholdId>(asHouseholdId('hh-01951500-0000-7000-8000-000000000001'));

  // Navigation
  type ConsoleTab = 'daily_care' | 'stopwatch' | 'history' | 'routines' | 'goals' | 'handoff' | 'analytics' | 'tests';
  const [activeSubTab, setActiveSubTab] = useState<ConsoleTab>('daily_care');

  // Reactive State
  const [storeVersion, setStoreVersion] = useState(0);
  const [testResults, setTestResults] = useState<{ passed: number; failed: number; errors: string[] } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Active Session & Stopwatch Timer state
  const [activeSession, setActiveSession] = useState<ActivitySession | undefined>(undefined);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);

  // Manual Log Modal
  const [showLogModal, setShowLogModal] = useState(false);
  const [logType, setLogType] = useState<ActivityType>('WALK');
  const [logDurationMinutes, setLogDurationMinutes] = useState(30);
  const [logDistanceKm, setLogDistanceKm] = useState<string>('2.0');
  const [logPacing, setLogPacing] = useState<'LEISURELY' | 'BRISK' | 'INTERVAL'>('BRISK');
  const [logLeashStatus, setLogLeashStatus] = useState<'ON_LEASH' | 'OFF_LEASH' | 'MIXED'>('ON_LEASH');
  const [logNotes, setLogNotes] = useState('');

  // Abandoned Review Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [abandonedSessionId, setAbandonedSessionId] = useState<ActivitySessionId | null>(null);
  const [correctedMinutes, setCorrectedMinutes] = useState(30);
  const [reviewExplanation, setReviewExplanation] = useState('');

  // Handoff drawer
  const [showHandoffModal, setShowHandoffModal] = useState(false);

  // Load Seed & Subscribe to ActivityStore updates
  useEffect(() => {
    seedActivityData();
    const unsubscribe = ActivityStore.subscribe(() => {
      setStoreVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  // Sync active session for currently selected pet
  useEffect(() => {
    const session = ActivityStore.getActiveSessionForPet(selectedPetId);
    setActiveSession(session);
    if (session) {
      const startMs = new Date(session.startedAt).getTime();
      const nowMs = Date.now();
      const elapsed = Math.max(0, Math.floor((nowMs - startMs) / 1000) - (session.pausedDurationSeconds || 0));
      setStopwatchSeconds(elapsed);
    } else {
      setStopwatchSeconds(0);
    }
  }, [selectedPetId, storeVersion]);

  // Stopwatch ticking effect
  useEffect(() => {
    let interval: any = null;
    if (activeSession && activeSession.status === 'ACTIVE') {
      interval = setInterval(() => {
        setStopwatchSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  // Data queries
  const todayStr = currentClockUtcNow().split('T')[0];
  const pets = PetStore.listPetsByHousehold(householdId);
  const currentPet = PetStore.findPetById(selectedPetId);
  const householdMembers = IdentityStore.listMembersForHousehold(householdId);

  let dailyCareItems: DailyCareItem[] = [];
  try {
    dailyCareItems = ActivityService.getDailyCareItems(selectedPetId, householdId, todayStr, activeActorId);
  } catch (err) {
    console.warn('Daily care items query error:', err);
  }

  let householdCareSummary: HouseholdCareSummary = {
    householdId,
    date: todayStr,
    totalTasksScheduled: 0,
    totalTasksCompleted: 0,
    completionRatePercent: 0,
    memberBreakdown: [],
    unassignedPendingCount: 0
  };
  try {
    householdCareSummary = ActivityService.getHouseholdCareSummary(householdId, todayStr, activeActorId);
  } catch (err) {
    console.warn('Household care summary query error:', err);
  }

  const petRecords = ActivityStore.getRecordsForPet(selectedPetId);
  const petRoutines = ActivityStore.getRoutinesForPet(selectedPetId);
  const petGoals = ActivityStore.getGoalsForPet(selectedPetId);

  let weeklySummary: WeeklyActivitySummary | null = null;
  try {
    weeklySummary = ActivityService.getWeeklyActivitySummary(selectedPetId, householdId, todayStr, activeActorId);
  } catch (err) {
    console.warn('Weekly summary query error:', err);
  }

  // Handlers
  const handleStartSession = (activityType: ActivityType) => {
    try {
      const session = ActivityService.startActivitySession(
        {
          petId: selectedPetId,
          householdId,
          activityType,
          notes: `Started by ${activeActorId === asUserId('usr-01951500-0000-7000-8000-000000000001') ? 'Sean' : 'Sarah'}`
        },
        activeActorId
      );
      setActiveSession(session);
      setFeedbackMessage({ type: 'success', text: `Active ${activityType.toLowerCase()} session started for ${currentPet?.name || 'Pet'}.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handlePauseSession = () => {
    if (!activeSession) return;
    try {
      const paused = ActivityService.pauseActivitySession(activeSession.activitySessionId, activeActorId);
      setActiveSession(paused);
      setFeedbackMessage({ type: 'info', text: 'Session paused.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleResumeSession = () => {
    if (!activeSession) return;
    try {
      const resumed = ActivityService.resumeActivitySession(activeSession.activitySessionId, activeActorId);
      setActiveSession(resumed);
      setFeedbackMessage({ type: 'success', text: 'Session resumed.' });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleCompleteSession = () => {
    if (!activeSession) return;
    try {
      const dist = logDistanceKm ? parseFloat(logDistanceKm) : undefined;
      const res = ActivityService.completeActivitySession(
        {
          activitySessionId: activeSession.activitySessionId,
          distanceValue: dist,
          distanceUnit: dist ? 'KILOMETERS' : undefined,
          walkDetails: {
            leashStatus: logLeashStatus,
            pacing: logPacing,
            walkPurpose: 'EXERCISE'
          },
          notes: logNotes || 'Completed via stopwatch.'
        },
        activeActorId
      );
      setActiveSession(undefined);
      setFeedbackMessage({ type: 'success', text: `Session completed! Recorded ${Math.round(res.record.durationSeconds / 60)} active minutes.` });
    } catch (err: any) {
      if (err.message.includes('ABANDONED_SESSION_REVIEW_REQUIRED')) {
        setAbandonedSessionId(activeSession.activitySessionId);
        setShowReviewModal(true);
      }
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleRecoverSession = () => {
    if (!abandonedSessionId) return;
    try {
      const res = ActivityService.recoverAbandonedSession(
        {
          activitySessionId: abandonedSessionId,
          actualDurationSeconds: correctedMinutes * 60,
          reviewNotes: reviewExplanation || 'Owner reviewed timer overflow.'
        },
        activeActorId
      );
      setShowReviewModal(false);
      setAbandonedSessionId(null);
      setActiveSession(undefined);
      setFeedbackMessage({ type: 'success', text: `Session recovered with corrected duration (${correctedMinutes} mins).` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleCompleteCareItem = (item: DailyCareItem) => {
    try {
      if (item.sourceDomain === 'ACTIVITY') {
        const occId = asActivityOccurrenceId(item.sourceEntityId);
        ActivityService.completeRoutineOccurrence(
          {
            occurrenceId: occId,
            durationSeconds: 1800,
            notes: `Completed by ${activeActorId === asUserId('usr-01951500-0000-7000-8000-000000000001') ? 'Sean' : 'Sarah'}`
          },
          activeActorId
        );
        setFeedbackMessage({ type: 'success', text: `Marked "${item.title}" completed!` });
      } else {
        setFeedbackMessage({ type: 'info', text: `Task belongs to ${item.sourceDomain} domain. Open ${item.actionRoute} to execute.` });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleManualRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dist = logDistanceKm ? parseFloat(logDistanceKm) : undefined;
      ActivityService.recordActivity(
        {
          petId: selectedPetId,
          householdId,
          activityType: logType,
          startedAt: currentClockUtcNow(),
          durationSeconds: logDurationMinutes * 60,
          distanceValue: dist,
          distanceUnit: dist ? 'KILOMETERS' : undefined,
          intensity: 'MODERATE',
          walkDetails: logType === 'WALK' ? { leashStatus: logLeashStatus, pacing: logPacing } : undefined,
          notes: logNotes
        },
        activeActorId
      );
      setShowLogModal(false);
      setLogNotes('');
      setFeedbackMessage({ type: 'success', text: `Logged ${logType.toLowerCase()} (${logDurationMinutes} min) successfully!` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    }
  };

  const handleRunTests = () => {
    const res = runActivityTests();
    setTestResults(res);
    setActiveSubTab('tests');
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* SPRINT HEADER & IDENTITY BAR */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Footprints className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-[#F8FAFC]">Sprint 9: Activity &amp; Daily Care Execution</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Canonical Volume XI
                  </span>
                </div>
                <p className="text-sm text-[#94A3B8]">
                  Taxonomy · Walks &amp; Rest · Real-time Stopwatch · Concurrency Guards · Daily Care Radar · Medical Constraints
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pet Selector */}
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-1.5 flex items-center gap-2">
              <Dog className="w-4 h-4 text-emerald-400" />
              <select
                aria-label="Select Pet"
                value={selectedPetId}
                onChange={e => setSelectedPetId(asPetId(e.target.value))}
                className="bg-transparent text-sm text-[#F1F5F9] font-medium outline-none cursor-pointer"
              >
                {pets.map(p => (
                  <option key={p.petId} value={p.petId} className="bg-[#0F1115]">
                    {p.name} ({p.speciesCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Actor Selector */}
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-1.5 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <select
                aria-label="Select Active User"
                value={activeActorId}
                onChange={e => setActiveActorId(asUserId(e.target.value))}
                className="bg-transparent text-sm text-[#F1F5F9] font-medium outline-none cursor-pointer"
              >
                <option value="usr-01951500-0000-7000-8000-000000000001" className="bg-[#0F1115]">
                  Sean (Owner)
                </option>
                <option value="usr-01951500-0000-7000-8000-000000000002" className="bg-[#0F1115]">
                  Sarah (Caregiver)
                </option>
                <option value="usr-01951500-0000-7000-8000-000000000099" className="bg-[#0F1115]">
                  Guest / Walker (Restricted)
                </option>
              </select>
            </div>

            {/* Test Suite Action */}
            <button
              onClick={handleRunTests}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Run Automated Tests</span>
            </button>
          </div>
        </div>

        {/* System Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : feedbackMessage.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {feedbackMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {feedbackMessage.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
              <span>{feedbackMessage.text}</span>
            </div>
            <button onClick={() => setFeedbackMessage(null)} className="text-[#94A3B8] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#1E293B]">
        <button
          onClick={() => setActiveSubTab('daily_care')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'daily_care'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Care Radar</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stopwatch')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'stopwatch'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Timer className="w-4 h-4" />
          <span>Active Stopwatch</span>
          {activeSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'history'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Activity Log ({petRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('routines')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'routines'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Care Routines ({petRoutines.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('goals')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'goals'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Activity Goals</span>
        </button>

        <button
          onClick={() => setActiveSubTab('handoff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'handoff'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span>Caregiver Handoff</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'analytics'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Weekly Report</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'tests'
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Sprint 9 Tests</span>
        </button>
      </div>

      {/* TAB 1: DAILY CARE RADAR */}
      {activeSubTab === 'daily_care' && (
        <div className="space-y-6">
          {/* Household "Who did what today?" Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#94A3B8] font-medium">Household Care Completed</div>
              <div className="text-2xl font-black text-[#F8FAFC] mt-1">
                {householdCareSummary.totalTasksCompleted} / {householdCareSummary.totalTasksScheduled}
              </div>
              <div className="text-xs text-emerald-400 mt-1 font-semibold">
                {householdCareSummary.completionRatePercent}% Execution Rate Today
              </div>
            </div>

            {householdCareSummary.memberBreakdown.map(m => (
              <div key={m.userId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>{m.userName}</span>
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                </div>
                <div className="text-xl font-bold text-[#F8FAFC] mt-1">
                  {m.completedCount} Completed
                </div>
                <div className="text-xs text-[#64748B] mt-1">
                  {m.assignedPendingCount} pending assigned
                </div>
              </div>
            ))}

            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#94A3B8] font-medium">Unassigned Pending</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {householdCareSummary.unassignedPendingCount} Tasks
              </div>
              <div className="text-xs text-[#64748B] mt-1">Available for any caregiver</div>
            </div>
          </div>

          {/* Unified Daily Care Tasks Table */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">Today's Unified Care Radar for {currentPet?.name}</h2>
                <p className="text-xs text-[#94A3B8]">
                  Aggregated from Activity, Nutrition, Preventive Care, and Training bounded contexts.
                </p>
              </div>
              <div className="text-xs text-[#64748B] font-mono">{todayStr}</div>
            </div>

            {dailyCareItems.length === 0 ? (
              <div className="text-center py-12 text-[#64748B] text-sm">
                No scheduled care tasks for today.
              </div>
            ) : (
              <div className="space-y-3">
                {dailyCareItems.map(item => (
                  <div
                    key={item.itemId}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      item.isCompleted
                        ? 'bg-[#0B0D10]/50 border-emerald-900/30'
                        : item.dueState === 'DUE' || item.dueState === 'OVERDUE'
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-[#0B0D10] border-[#1E293B]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                          item.sourceDomain === 'ACTIVITY'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.sourceDomain === 'NUTRITION'
                            ? 'bg-amber-500/10 text-amber-400'
                            : item.sourceDomain === 'CARE'
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}
                      >
                        {item.sourceDomain === 'ACTIVITY' && <Footprints className="w-5 h-5" />}
                        {item.sourceDomain === 'NUTRITION' && <Utensils className="w-5 h-5" />}
                        {item.sourceDomain === 'CARE' && <Stethoscope className="w-5 h-5" />}
                        {item.sourceDomain === 'TRAINING' && <GraduationCap className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#F1F5F9]">{item.title}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8]">
                            {item.sourceDomain}
                          </span>
                          {item.priority === 'CRITICAL' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                              CRITICAL
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[#64748B] mt-1">
                          <span>Target: {item.targetTimeOfDay || 'Anytime'}</span>
                          {item.assignedToName && <span>Assigned: {item.assignedToName}</span>}
                          {item.instructions && <span className="text-[#94A3B8]">· {item.instructions}</span>}
                        </div>

                        {item.isCompleted && (
                          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed by {item.completedByName || 'Household Member'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {item.isCompleted ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Executed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCompleteCareItem(item)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Done</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE STOPWATCH & CONCURRENCY GUARD */}
      {activeSubTab === 'stopwatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#F8FAFC]">Real-Time Activity Stopwatch</h2>
                <p className="text-xs text-[#94A3B8]">
                  Enforces strict concurrency guard: only 1 active session per pet allowed across all household devices.
                </p>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                <Timer className="w-5 h-5" />
              </div>
            </div>

            {/* Big Stopwatch Display */}
            <div className="bg-[#0B0D10] border border-[#1E293B] rounded-2xl p-8 text-center space-y-3">
              <div className="text-xs uppercase tracking-widest text-[#64748B] font-bold">
                {activeSession
                  ? `${activeSession.activityType} IN PROGRESS (${activeSession.status})`
                  : 'STOPWATCH IDLE'}
              </div>

              <div className="font-mono text-6xl sm:text-7xl font-black text-[#F8FAFC] tracking-tight">
                {formatSeconds(stopwatchSeconds)}
              </div>

              {activeSession && (
                <div className="text-xs text-[#94A3B8]">
                  Started at {new Date(activeSession.startedAt).toLocaleTimeString()} by{' '}
                  {activeSession.startedBy === asUserId('usr-01951500-0000-7000-8000-000000000001') ? 'Sean' : 'Sarah'}
                  {activeSession.pausedDurationSeconds > 0 && (
                    <span className="text-amber-400 ml-2">
                      ({Math.round(activeSession.pausedDurationSeconds / 60)}m paused)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stopwatch Controls */}
            {!activeSession ? (
              <div className="space-y-4">
                <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                  Choose Activity Type to Begin
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => handleStartSession('WALK')}
                    className="p-4 rounded-xl border border-[#1E293B] bg-[#0B0D10] hover:border-emerald-500/50 text-left transition-all cursor-pointer group"
                  >
                    <Footprints className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm text-[#F1F5F9]">Walk</div>
                    <div className="text-[11px] text-[#64748B]">Leash &amp; exercise</div>
                  </button>

                  <button
                    onClick={() => handleStartSession('PLAY')}
                    className="p-4 rounded-xl border border-[#1E293B] bg-[#0B0D10] hover:border-amber-500/50 text-left transition-all cursor-pointer group"
                  >
                    <Flame className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm text-[#F1F5F9]">Play Session</div>
                    <div className="text-[11px] text-[#64748B]">Fetch, tug, agility</div>
                  </button>

                  <button
                    onClick={() => handleStartSession('ENRICHMENT')}
                    className="p-4 rounded-xl border border-[#1E293B] bg-[#0B0D10] hover:border-purple-500/50 text-left transition-all cursor-pointer group"
                  >
                    <Sparkles className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm text-[#F1F5F9]">Enrichment</div>
                    <div className="text-[11px] text-[#64748B]">Scent &amp; puzzles</div>
                  </button>

                  <button
                    onClick={() => handleStartSession('REST')}
                    className="p-4 rounded-xl border border-[#1E293B] bg-[#0B0D10] hover:border-indigo-500/50 text-left transition-all cursor-pointer group"
                  >
                    <Clock className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-sm text-[#F1F5F9]">Rest &amp; Sleep</div>
                    <div className="text-[11px] text-[#64748B]">Crate &amp; bed log</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {activeSession.status === 'ACTIVE' ? (
                    <button
                      onClick={handlePauseSession}
                      className="px-6 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Pause Session</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResumeSession}
                      className="px-6 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>Resume Session</span>
                    </button>
                  )}

                  <button
                    onClick={handleCompleteSession}
                    className="px-6 py-3 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
                  >
                    <Square className="w-4 h-4" />
                    <span>Complete &amp; Record</span>
                  </button>
                </div>

                {/* Additional metadata inputs before completion */}
                <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] font-semibold block mb-1">
                      Distance (km, optional)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={logDistanceKm}
                      onChange={e => setLogDistanceKm(e.target.value)}
                      placeholder="e.g. 2.4"
                      className="w-full bg-[#13151A] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[#94A3B8] font-semibold block mb-1">Pacing</label>
                    <select
                      value={logPacing}
                      onChange={e => setLogPacing(e.target.value as any)}
                      className="w-full bg-[#13151A] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] outline-none cursor-pointer"
                    >
                      <option value="LEISURELY">Leisurely / Sniffari</option>
                      <option value="BRISK">Brisk Pace</option>
                      <option value="INTERVAL">Interval / Running</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#94A3B8] font-semibold block mb-1">Notes</label>
                    <input
                      type="text"
                      value={logNotes}
                      onChange={e => setLogNotes(e.target.value)}
                      placeholder="e.g. Great leash focus"
                      className="w-full bg-[#13151A] border border-[#1E293B] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Concurrency & Safety Rules Box */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Volume XI Safety Guards</span>
            </div>

            <div className="space-y-3 text-xs text-[#94A3B8] leading-relaxed">
              <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                <div className="font-semibold text-[#F1F5F9]">1. Single Session Concurrency</div>
                <div>
                  If Sarah starts a walk with Max, Sean's device is blocked from starting a simultaneous session, preventing double-counting.
                </div>
              </div>

              <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                <div className="font-semibold text-[#F1F5F9]">2. Abandoned Session Recovery (&gt; 4h)</div>
                <div>
                  Timers accidentally left running over 4 hours enter <span className="text-amber-400">NEEDS_REVIEW</span>, requiring owner verification of true duration to protect metric accuracy.
                </div>
              </div>

              <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                <div className="font-semibold text-[#F1F5F9]">3. Opaque Route Telemetry (ADR-008)</div>
                <div>
                  Exact GPS coordinates are restricted data. Activity records store distance, duration, and opaque tokens only.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLogModal(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-[#334155] hover:border-emerald-500 text-xs font-bold text-[#94A3B8] hover:text-emerald-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Past Activity Manually</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY HISTORY & FACTUAL LOG */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Recorded Activity Log for {currentPet?.name}</h2>
              <p className="text-xs text-[#94A3B8]">
                Auditable historical records with measured distance, provenance source, and verification status.
              </p>
            </div>

            <button
              onClick={() => setShowLogModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </button>
          </div>

          <div className="space-y-3">
            {petRecords.map(rec => (
              <div
                key={rec.activityId}
                className={`p-4 rounded-xl border transition-all ${
                  rec.verificationStatus === 'ENTERED_IN_ERROR'
                    ? 'bg-rose-950/20 border-rose-900/30 opacity-60'
                    : 'bg-[#13151A] border-[#1E293B]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                        rec.activityType === 'WALK'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : rec.activityType === 'PLAY'
                          ? 'bg-amber-500/10 text-amber-400'
                          : rec.activityType === 'ENRICHMENT'
                          ? 'bg-purple-500/10 text-purple-400'
                          : rec.activityType === 'REST'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}
                    >
                      {rec.activityType === 'WALK' && <Footprints className="w-5 h-5" />}
                      {rec.activityType === 'PLAY' && <Flame className="w-5 h-5" />}
                      {rec.activityType === 'ENRICHMENT' && <Sparkles className="w-5 h-5" />}
                      {rec.activityType === 'REST' && <Clock className="w-5 h-5" />}
                      {rec.activityType === 'TRAINING' && <GraduationCap className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F1F5F9]">{rec.activityType}</span>
                        <span className="text-xs text-emerald-400 font-semibold font-mono">
                          {Math.round(rec.durationSeconds / 60)} mins
                        </span>
                        {rec.distanceValue && (
                          <span className="text-xs text-[#94A3B8] font-mono">
                            · {rec.distanceValue} km ({rec.distanceSource || 'Recorded'})
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#0B0D10] text-[#64748B] border border-[#1E293B]">
                          {rec.sourceType}
                        </span>
                      </div>

                      <div className="text-xs text-[#94A3B8] mt-1">
                        {rec.notes || 'Activity completed successfully.'}
                      </div>

                      {rec.walkDetails && (
                        <div className="flex items-center gap-3 text-[11px] text-[#64748B] mt-1">
                          {rec.walkDetails.leashStatus && <span>Leash: {rec.walkDetails.leashStatus}</span>}
                          {rec.walkDetails.pacing && <span>Pacing: {rec.walkDetails.pacing}</span>}
                          {rec.walkDetails.weatherConditions && <span>Weather: {rec.walkDetails.weatherConditions}</span>}
                        </div>
                      )}

                      {rec.restDetails && (
                        <div className="text-[11px] text-[#64748B] mt-1">
                          Environment: {rec.restDetails.environment || 'Default'} (Crate Rest: {rec.restDetails.isCrateRest ? 'Yes' : 'No'})
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center text-right shrink-0">
                    <div className="text-xs text-[#64748B] font-mono">
                      {new Date(rec.startedAt).toLocaleDateString()} {new Date(rec.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {rec.verificationStatus !== 'ENTERED_IN_ERROR' ? (
                      <button
                        onClick={() => {
                          const reason = prompt('Enter reason for correction:');
                          if (reason) {
                            ActivityService.markActivityEnteredInError(rec.activityId, reason, activeActorId);
                          }
                        }}
                        className="text-[11px] text-[#64748B] hover:text-rose-400 mt-1 cursor-pointer"
                      >
                        Entered in Error
                      </button>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-bold mt-1">
                        ENTERED IN ERROR: {rec.enteredInErrorReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ROUTINES & SCHEDULES */}
      {activeSubTab === 'routines' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Recurring Activity Routines</h2>
              <p className="text-xs text-[#94A3B8]">
                Household care expectations with duplicate completion protection.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {petRoutines.map(r => (
              <div key={r.routineId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{r.activityType}</span>
                  <span className="text-xs font-mono text-[#94A3B8]">{r.targetTimeOfDay || 'Morning'}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[#F8FAFC]">{r.title}</h3>
                  <p className="text-xs text-[#94A3B8] mt-1">{r.description}</p>
                </div>

                <div className="p-2.5 bg-[#0B0D10] border border-[#1E293B] rounded-xl text-xs space-y-1">
                  <div className="text-[#64748B]">Target Duration: {r.targetDurationMinutes} mins</div>
                  {r.instructions && <div className="text-[#94A3B8]">Instructions: {r.instructions}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: GOALS & VETERINARY RESTRICTIONS */}
      {activeSubTab === 'goals' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Activity Targets &amp; Clinical Safety Constraints</h2>
              <p className="text-xs text-[#94A3B8]">
                Integrated with Veterinary Health to prevent excessive exercise during medical restrictions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {petGoals.map(goal => {
              const progress = ActivityService.getGoalProgress(goal.goalId, activeActorId);
              return (
                <div key={goal.goalId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-[#F8FAFC]">{goal.title}</h3>
                      <div className="text-xs text-[#64748B]">
                        Target: {goal.targetValue} {goal.unit.toLowerCase()} ({goal.period.toLowerCase()})
                      </div>
                    </div>

                    {goal.isMedicallyConstrained ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Constrained by Vet
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-[#94A3B8]">
                      <span>Progress</span>
                      <span className="font-mono font-bold text-[#F1F5F9]">
                        {progress.currentValue} / {goal.targetValue} ({progress.progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#0B0D10] h-2.5 rounded-full overflow-hidden border border-[#1E293B]">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  {goal.medicalRestrictionReason && (
                    <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                      <Stethoscope className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{goal.medicalRestrictionReason}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 6: CAREGIVER HANDOFF SUMMARY */}
      {activeSubTab === 'handoff' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F8FAFC]">Caregiver &amp; Dog Walker Handoff Card</h2>
                <p className="text-xs text-[#94A3B8]">
                  Clean, printable summary for guest walkers, pet sitters, or boarding providers.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                alert('Handoff card link ready for guest temporary caregiver view.');
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1E293B] text-[#F8FAFC] border border-[#334155] flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
          </div>

          {(() => {
            const handoff = ActivityService.getCaregiverHandoffSummary(selectedPetId, householdId, activeActorId);
            return (
              <div className="space-y-4">
                {/* Medical Restrictions Banner */}
                <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4" />
                    <span>Clinical Restrictions &amp; Safety Instructions</span>
                  </div>
                  <ul className="text-xs text-[#F1F5F9] space-y-1 list-disc list-inside">
                    {handoff.activeMedicalRestrictions.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Dietary & Emergency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                    <div className="text-xs font-bold text-emerald-400 uppercase">Dietary Notes</div>
                    <p className="text-xs text-[#94A3B8]">Standard feeding portion per schedule. Fresh water available.</p>
                  </div>

                  <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                    <div className="text-xs font-bold text-indigo-400 uppercase">Emergency Contact</div>
                    <p className="text-xs text-[#F1F5F9] font-bold">{handoff.emergencyContact.primaryOwnerName}</p>
                    <p className="text-xs text-[#64748B]">{handoff.emergencyContact.contactNote}</p>
                  </div>
                </div>

                {/* Remaining Tasks for Today */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#94A3B8] uppercase">Remaining Care Tasks Today</div>
                  {handoff.scheduledTasksRemaining.length === 0 ? (
                    <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl text-xs text-emerald-400 font-medium">
                      All care tasks for today have been completed!
                    </div>
                  ) : (
                    handoff.scheduledTasksRemaining.map(t => (
                      <div key={t.itemId} className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl flex items-center justify-between text-xs">
                        <span className="font-bold text-[#F1F5F9]">{t.title}</span>
                        <span className="text-[#94A3B8] font-mono">{t.targetTimeOfDay}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 7: WEEKLY FACTUAL ANALYTICS */}
      {activeSubTab === 'analytics' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-base font-bold text-[#F8FAFC]">Weekly Activity Factual Report</h2>
            <p className="text-xs text-[#94A3B8]">
              Objective time-series observations. Pet OS rejects synthetic algorithmic "health scores".
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
              <div className="text-xs text-[#64748B]">Total Active Time</div>
              <div className="text-2xl font-black text-[#F8FAFC] mt-1">{weeklySummary.totalActiveMinutes} mins</div>
            </div>

            <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
              <div className="text-xs text-[#64748B]">Recorded Walks</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{weeklySummary.totalWalksCount} walks</div>
            </div>

            <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
              <div className="text-xs text-[#64748B]">Measured Distance</div>
              <div className="text-2xl font-black text-[#F8FAFC] mt-1">{weeklySummary.totalDistanceRecordedKm} km</div>
            </div>

            <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl">
              <div className="text-xs text-[#64748B]">Play &amp; Enrichment</div>
              <div className="text-2xl font-black text-purple-400 mt-1">{weeklySummary.playSessionsCount + weeklySummary.enrichmentCount} sessions</div>
            </div>
          </div>

          {/* Distance Transparency Notice */}
          <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
            <div className="text-xs font-bold text-emerald-400 uppercase">Distance Measurement Transparency</div>
            <p className="text-xs text-[#94A3B8]">{weeklySummary.distanceTransparencyNotice}</p>
          </div>

          {/* Source Provenance Breakdown */}
          <div className="p-4 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-2">
            <div className="text-xs font-bold text-[#94A3B8] uppercase">Activity Provenance Breakdown</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <span className="text-[#64748B] block">Owner Logged</span>
                <span className="font-bold text-[#F1F5F9]">{weeklySummary.sourceBreakdown.ownerRecordedMinutes}m</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Caregiver</span>
                <span className="font-bold text-[#F1F5F9]">{weeklySummary.sourceBreakdown.caregiverMinutes}m</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Training Sessions</span>
                <span className="font-bold text-indigo-400">{weeklySummary.sourceBreakdown.trainingSessionMinutes}m</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Device Recorded</span>
                <span className="font-bold text-[#F1F5F9]">{weeklySummary.sourceBreakdown.deviceRecordedMinutes}m</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Professional Walker</span>
                <span className="font-bold text-[#F1F5F9]">{weeklySummary.sourceBreakdown.providerMinutes}m</span>
              </div>
            </div>
          </div>

          {/* Scientific Disclaimer */}
          <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{weeklySummary.scientificDisclaimer}</span>
          </div>
        </div>
      )}

      {/* TAB 8: SPRINT 9 AUTOMATED TEST RUNNER */}
      {activeSubTab === 'tests' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">Sprint 9 Automated Test Suite</h2>
              <p className="text-xs text-[#94A3B8]">
                Rigorous verification of concurrency guards, duplicate execution prevention, medical restrictions, and cross-domain aggregation.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-run 12 Tests</span>
            </button>
          </div>

          {testResults ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold text-sm">
                  {testResults.passed} Tests Passed
                </div>
                {testResults.failed > 0 && (
                  <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-bold text-sm">
                    {testResults.failed} Tests Failed
                  </div>
                )}
              </div>

              {testResults.errors.length > 0 ? (
                <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
                  {testResults.errors.map((e, idx) => (
                    <div key={idx}>{e}</div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>All 12 canonical domain scenarios passed cleanly with zero regressions!</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-[#64748B] text-sm">
              Click &quot;Re-run 12 Tests&quot; to execute the automated test runner.
            </div>
          )}
        </div>
      )}

      {/* MANUAL ACTIVITY LOG MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#F8FAFC]">Log Activity Manually</h3>
              <button onClick={() => setShowLogModal(false)} className="text-[#94A3B8] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualRecordSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Activity Type</label>
                <select
                  value={logType}
                  onChange={e => setLogType(e.target.value as any)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none cursor-pointer"
                >
                  <option value="WALK">Walk</option>
                  <option value="PLAY">Play Session</option>
                  <option value="ENRICHMENT">Enrichment / Puzzles</option>
                  <option value="REST">Rest / Sleep</option>
                  <option value="SWIM">Swim</option>
                  <option value="HIKE">Hike</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#94A3B8] block mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={logDurationMinutes}
                    onChange={e => setLogDurationMinutes(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-[#94A3B8] block mb-1">Distance (km, optional)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={logDistanceKm}
                    onChange={e => setLogDistanceKm(e.target.value)}
                    placeholder="e.g. 2.0"
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Notes</label>
                <textarea
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  placeholder="e.g. Afternoon stroll through the park"
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none h-20 resize-none"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ABANDONED SESSION RECOVERY MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-[#F8FAFC]">Abandoned Session Review</h3>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              This session was left running for over 4 hours. To prevent distorted pet activity stats, please enter the actual duration.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Actual Active Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={correctedMinutes}
                  onChange={e => setCorrectedMinutes(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-[#94A3B8] block mb-1">Review Explanation</label>
                <input
                  type="text"
                  value={reviewExplanation}
                  onChange={e => setReviewExplanation(e.target.value)}
                  placeholder="e.g. Returned home at 30 mins, forgot to stop timer"
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#94A3B8] hover:text-white"
              >
                Dismiss
              </button>
              <button
                onClick={handleRecoverSession}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20"
              >
                Confirm Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
