/**
 * Pet OS Sprint 6 - Preventive Care, Care Scheduling, Due Engine & Notification Orchestration Console
 * Implements interactive visual demonstration of Volume VIII & Volume XXVI
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Bell,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  FastForward,
  UserCheck,
  ShieldAlert,
  Send,
  Plus,
  Filter,
  Check,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  CalendarCheck,
  ShieldCheck,
  Eye,
  FileText,
  User,
  Sliders,
  Radio,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  asUserId,
  asPetId,
  asHouseholdId,
  asCareOccurrenceId,
  UserId,
  PetId,
  HouseholdId
} from '../pet-os/kernel/ids';
import { ClockRegistry, SimulatedClock } from '../pet-os/kernel/time';
import { CareStore } from '../pet-os/care/store';
import { CareService } from '../pet-os/care/service';
import { CareBackgroundScheduler, SchedulerExecutionReport } from '../pet-os/care/scheduler';
import { seedSprint6CareData } from '../pet-os/care/seed';
import { runSprint6TestSuite, TestSuiteSummary } from '../pet-os/care/tests';
import { NotificationStore } from '../pet-os/notifications/store';
import { NotificationService } from '../pet-os/notifications/service';
import { PetStore } from '../pet-os/pet-core/store';
import { IdentityStore } from '../pet-os/identity/store';
import { CareOccurrence, CareCategory, CareOccurrenceStatus } from '../pet-os/care/types';

export const Sprint6CareConsole: React.FC = () => {
  // 1. Context State
  const [selectedPetId, setSelectedPetId] = useState<PetId>(asPetId('pet-001'));
  const [activeActorId, setActiveActorId] = useState<UserId>(asUserId('user-owner-001'));
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
  const [simulatedClock, setSimulatedClock] = useState<SimulatedClock | null>(null);

  // 2. Data State
  const [occurrences, setOccurrences] = useState<CareOccurrence[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<'SCHEDULE' | 'INBOX' | 'NEW_CARE' | 'TESTS' | 'SCHEDULER'>('SCHEDULE');

  // 3. Modals & Forms State
  const [selectedOccurrence, setSelectedOccurrence] = useState<CareOccurrence | null>(null);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [completionEvidence, setCompletionEvidence] = useState<string>('');
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);

  const [snoozeDays, setSnoozeDays] = useState<number>(2);
  const [snoozeReason, setSnoozeReason] = useState<string>('');
  const [showSnoozeModal, setShowSnoozeModal] = useState<boolean>(false);

  const [assigneeId, setAssigneeId] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);

  // New Obligation Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CareCategory>('PARASITE_PREVENTION');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [newSourceType, setNewSourceType] = useState<'OWNER_CREATED' | 'PROVIDER_RECORDED'>('OWNER_CREATED');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Test Suite State
  const [testSummary, setTestSummary] = useState<TestSuiteSummary | null>(null);
  const [runningTests, setRunningTests] = useState<boolean>(false);

  // Scheduler Report State
  const [lastReport, setLastReport] = useState<SchedulerExecutionReport | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Initialize data and clock
  useEffect(() => {
    // Check if pet exists
    let pet = PetStore.findPetById(selectedPetId);
    if (!pet) {
      const pets = PetStore.findAllPets();
      if (pets.length > 0) {
        setSelectedPetId(pets[0].petId);
      } else {
        // Seed default pet
        PetStore.savePet({
          petId: asPetId('pet-001'),
          householdId: asHouseholdId('household-001'),
          name: 'Simba',
          speciesCode: 'SPECIES_DOG',
          breedCode: 'BREED_DOG_GOLDEN_RETRIEVER',
          mixedBreed: false,
          unknownBreed: false,
          sex: 'MALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2022-04-12',
          birthdatePrecision: 'EXACT',
          estimatedBirthdate: false,
          primaryColor: 'Golden',
          sizeClassification: 'LARGE',
          lifecycleStage: 'ADULT',
          status: 'ACTIVE',
          createdBy: asUserId('user-owner-001'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          metadata: {}
        });
      }
    }

    // Seed Sprint 6 care data
    seedSprint6CareData(asUserId('user-owner-001'), selectedPetId);

    // Setup simulated clock
    const clock = new SimulatedClock();
    ClockRegistry.setClock(clock);
    setSimulatedClock(clock);
    setCurrentTimeDisplay(new Date(clock.getTime()).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));

    refreshData();

    // Subscribe to stores
    const unsubCare = CareStore.subscribe(refreshData);
    const unsubNotif = NotificationStore.subscribe(refreshData);

    return () => {
      unsubCare();
      unsubNotif();
    };
  }, [selectedPetId]);

  const refreshData = () => {
    const occs = CareStore.getOccurrencesForPet(selectedPetId);
    setOccurrences(occs);

    const userNotifs = NotificationStore.getNotificationsForUser(activeActorId);
    setNotifications(userNotifs);

    const currentClock = ClockRegistry.getClock();
    setCurrentTimeDisplay(new Date(currentClock.getTime()).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  };

  useEffect(() => {
    refreshData();
  }, [activeActorId, selectedPetId]);

  // Clock Manipulation Handlers
  const handleAdvanceClockDays = async (days: number) => {
    if (!simulatedClock) return;
    simulatedClock.advanceTime(days * 86400 * 1000);
    setCurrentTimeDisplay(new Date(simulatedClock.getTime()).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
    
    // Automatically trigger scheduler tick on clock change
    const report = await CareBackgroundScheduler.executeTick(new Date(simulatedClock.getTime()));
    setLastReport(report);
    setActionNotice(`Clock advanced ${days} day(s). Scheduler evaluated ${report.evaluatedOccurrences} items.`);
    setTimeout(() => setActionNotice(null), 4000);
    refreshData();
  };

  const handleResetClock = async () => {
    const clock = new SimulatedClock();
    ClockRegistry.setClock(clock);
    setSimulatedClock(clock);
    setCurrentTimeDisplay(new Date(clock.getTime()).toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
    
    const report = await CareBackgroundScheduler.executeTick(new Date(clock.getTime()));
    setLastReport(report);
    setActionNotice('Clock reset to real-time. Scheduler re-evaluated.');
    setTimeout(() => setActionNotice(null), 4000);
    refreshData();
  };

  const handleRunSchedulerTick = async () => {
    const now = simulatedClock ? new Date(simulatedClock.getTime()) : new Date();
    const report = await CareBackgroundScheduler.executeTick(now);
    setLastReport(report);
    setActionNotice(`Scheduler tick executed in ${report.durationMs}ms: ${report.transitionedCount} transitions, ${report.remindersEnqueued} reminders.`);
    setTimeout(() => setActionNotice(null), 5000);
    refreshData();
  };

  const handleSimulateDowntime = async (hours: number) => {
    const now = simulatedClock ? new Date(simulatedClock.getTime()) : new Date();
    if (simulatedClock) {
      simulatedClock.advanceTime(hours * 3600 * 1000);
    }
    const { catchupReport } = await CareBackgroundScheduler.simulateDowntimeRecovery(hours, now);
    setLastReport(catchupReport);
    setActionNotice(`Downtime recovery complete (+${hours}h): Evaluated ${catchupReport.evaluatedOccurrences} items.`);
    setTimeout(() => setActionNotice(null), 5000);
    refreshData();
  };

  // Care Action Handlers
  const handleCompleteOccurrence = () => {
    if (!selectedOccurrence) return;
    try {
      CareService.completeOccurrence(activeActorId, selectedOccurrence.occurrenceId, {
        completionNotes: completionNotes || 'Completed on schedule.',
        evidenceReference: completionEvidence || undefined
      });
      setShowCompleteModal(false);
      setCompletionNotes('');
      setCompletionEvidence('');
      setActionNotice(`Care item "${selectedOccurrence.title}" marked as complete.`);
      setTimeout(() => setActionNotice(null), 4000);
      refreshData();
    } catch (err: any) {
      alert(`Error completing care: ${err.message}`);
    }
  };

  const handleSnoozeOccurrence = () => {
    if (!selectedOccurrence) return;
    try {
      const clock = simulatedClock ? new Date(simulatedClock.getTime()) : new Date();
      const snoozedUntil = new Date(clock.getTime() + snoozeDays * 86400 * 1000).toISOString();
      CareService.snoozeReminder(activeActorId, selectedOccurrence.occurrenceId, snoozedUntil, snoozeReason);
      setShowSnoozeModal(false);
      setSnoozeReason('');
      setActionNotice(`Reminder snoozed for ${snoozeDays} day(s). Note: Clinical due date remains unchanged.`);
      setTimeout(() => setActionNotice(null), 5000);
      refreshData();
    } catch (err: any) {
      alert(`Error snoozing: ${err.message}`);
    }
  };

  const handleAssignCaregiver = () => {
    if (!selectedOccurrence || !assigneeId) return;
    try {
      CareService.assignCaregiver(activeActorId, selectedOccurrence.occurrenceId, asUserId(assigneeId));
      setShowAssignModal(false);
      setAssigneeId('');
      setActionNotice(`Task delegated to household member.`);
      setTimeout(() => setActionNotice(null), 4000);
      refreshData();
    } catch (err: any) {
      alert(`Error assigning caregiver: ${err.message}`);
    }
  };

  const handleCreateObligation = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!newTitle.trim() || !newDueDate) {
      setFormError('Please provide a title and due date.');
      return;
    }

    try {
      const pet = PetStore.findPetById(selectedPetId);
      if (!pet) throw new Error('Pet not found');

      CareService.createObligation(activeActorId, {
        petId: selectedPetId,
        householdId: pet.householdId,
        category: newCategory,
        careType: newTitle.toUpperCase().replace(/\s+/g, '_'),
        title: newTitle,
        sourceType: newSourceType,
        scheduleType: newRecurrence === 'NONE' ? 'ONE_TIME' : 'CALENDAR_RECURRENCE',
        dueAt: new Date(newDueDate).toISOString(),
        recurrenceRule:
          newRecurrence === 'NONE'
            ? undefined
            : {
                frequency: newRecurrence,
                interval: 1
              },
        priority: newPriority,
        assignedToUserId: activeActorId
      });

      setFormSuccess(`Care Obligation "${newTitle}" created successfully.`);
      setNewTitle('');
      setNewDueDate('');
      setTimeout(() => setFormSuccess(null), 4000);
      refreshData();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const handleRunTests = async () => {
    setRunningTests(true);
    try {
      const summary = await runSprint6TestSuite();
      setTestSummary(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setRunningTests(false);
      refreshData();
    }
  };

  // Filter Occurrences
  const filteredOccurrences = occurrences.filter(occ => {
    if (selectedCategory !== 'ALL' && occ.category !== selectedCategory) return false;
    if (selectedStatus !== 'ALL' && occ.status !== selectedStatus) return false;
    return true;
  });

  // Calculate Metrics
  const dueTodayCount = occurrences.filter(o => o.status === 'DUE').length;
  const overdueCount = occurrences.filter(o => o.status === 'OVERDUE').length;
  const upcomingCount = occurrences.filter(o => o.status === 'UPCOMING').length;
  const completedCount = occurrences.filter(o => o.status === 'COMPLETED').length;
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Announcement */}
      {actionNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-emerald-200">×</button>
        </div>
      )}

      {/* Control Bar: Actor Switcher & Simulated Clock */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Active Persona Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Active Persona</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-indigo-300 font-mono">Least-Privilege</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <select
                value={activeActorId}
                onChange={e => setActiveActorId(asUserId(e.target.value))}
                className="bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs font-medium text-[#F1F5F9] focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="user-owner-001">Sean (Primary Owner) - Full Authority</option>
                <option value="user-admin-002">Sarah (Household Admin) - Care Manager</option>
                <option value="user-caregiver-003">Alex (Caregiver) - Task Completion</option>
                <option value="user-temp-004">Tom (Temp Caregiver) - Limited Access</option>
                <option value="test-outsider-999">Dr. Evans (Outsider) - Non-Member (Denied)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Center: Pet Digital Twin Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Digital Twin</span>
            <div className="flex items-center gap-1.5 mt-1">
              <select
                value={selectedPetId}
                onChange={e => setSelectedPetId(asPetId(e.target.value))}
                className="bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2.5 py-1 text-xs font-medium text-[#F1F5F9] focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="pet-001">Simba (Golden Retriever · Male)</option>
                <option value="pet-002">Nala (German Shepherd · Female)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Deterministic Time Simulation Controller */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0B0D10] border border-[#1E293B] p-2 rounded-xl">
          <div className="flex items-center gap-2 px-2 py-1">
            <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-[10px] text-[#64748B] font-mono leading-none">KERNEL CLOCK (Nairobi)</div>
              <div className="text-xs font-mono font-bold text-[#E2E8F0] mt-0.5">{currentTimeDisplay || 'Loading...'}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-[#1E293B] pl-2">
            <button
              onClick={() => handleAdvanceClockDays(1)}
              title="Advance +1 Day"
              className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-[11px] font-semibold text-[#E2E8F0] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-3 h-3 text-emerald-400" />
              <span>+1d</span>
            </button>
            <button
              onClick={() => handleAdvanceClockDays(7)}
              title="Advance +7 Days"
              className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-[11px] font-semibold text-[#E2E8F0] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-3 h-3 text-indigo-400" />
              <span>+7d</span>
            </button>
            <button
              onClick={() => handleAdvanceClockDays(30)}
              title="Advance +30 Days"
              className="px-2 py-1 bg-[#1E293B] hover:bg-[#334155] text-[11px] font-semibold text-[#E2E8F0] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FastForward className="w-3 h-3 text-amber-400" />
              <span>+30d</span>
            </button>
            <button
              onClick={handleResetClock}
              title="Reset Clock to Real Time"
              className="p-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#13151A] border border-rose-500/20 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300 mt-1">{overdueCount}</div>
          <span className="text-[10px] text-[#64748B]">Escalated alerts</span>
        </div>

        <div className="bg-[#13151A] border border-amber-500/20 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Due Today</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1">{dueTodayCount}</div>
          <span className="text-[10px] text-[#64748B]">Active window</span>
        </div>

        <div className="bg-[#13151A] border border-indigo-500/20 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Upcoming</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1">{upcomingCount}</div>
          <span className="text-[10px] text-[#64748B]">Next 7 days</span>
        </div>

        <div className="bg-[#13151A] border border-emerald-500/20 rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1">{completedCount}</div>
          <span className="text-[10px] text-[#64748B]">With provenance</span>
        </div>

        <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">In-App Inbox</span>
            <Bell className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-[#F1F5F9] mt-1">{unreadNotificationsCount} unread</div>
          <span className="text-[10px] text-[#64748B]">{notifications.length} total notifications</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveViewTab('SCHEDULE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'SCHEDULE'
                ? 'bg-emerald-400 text-[#0F1115] shadow-lg shadow-emerald-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Care Obligations &amp; Schedule</span>
          </button>

          <button
            onClick={() => setActiveViewTab('INBOX')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeViewTab === 'INBOX'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notification Orchestration</span>
            {unreadNotificationsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-black">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveViewTab('NEW_CARE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'NEW_CARE'
                ? 'bg-amber-400 text-[#0F1115] shadow-lg shadow-amber-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Care Obligation</span>
          </button>

          <button
            onClick={() => setActiveViewTab('SCHEDULER')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'SCHEDULER'
                ? 'bg-[#1E293B] text-emerald-400 border border-emerald-500/30'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Scheduler Engine</span>
          </button>

          <button
            onClick={() => setActiveViewTab('TESTS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeViewTab === 'TESTS'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Test Suite (12 Suites)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunSchedulerTick}
            className="px-3 py-1 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Tick</span>
          </button>
        </div>
      </div>

      {/* VIEW TAB 1: SCHEDULE & OBLIGATIONS */}
      {activeViewTab === 'SCHEDULE' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#64748B]" />
              <span className="text-xs font-bold text-[#64748B] uppercase">Filter:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-[#E2E8F0] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="VACCINATION">Vaccination</option>
                <option value="PARASITE_PREVENTION">Parasite Prevention</option>
                <option value="DEWORMING">Deworming</option>
                <option value="VET_CHECKUP">Vet Checkup</option>
                <option value="GROOMING">Grooming</option>
                <option value="MEDICATION_ADMINISTRATION">Medication</option>
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="bg-[#0B0D10] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-[#E2E8F0] focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="DUE">Due Today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div className="text-xs text-[#64748B]">
              Showing {filteredOccurrences.length} of {occurrences.length} care items
            </div>
          </div>

          {/* Occurrence Cards List */}
          <div className="space-y-3">
            {filteredOccurrences.length === 0 ? (
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-8 text-center text-[#64748B]">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No care occurrences match the selected filter.</p>
              </div>
            ) : (
              filteredOccurrences.map(occ => {
                const isOverdue = occ.status === 'OVERDUE';
                const isDue = occ.status === 'DUE';
                const isCompleted = occ.status === 'COMPLETED';
                const isSnoozed = Boolean(occ.snoozedUntil);
                const parentObligation = CareStore.getObligation(occ.careObligationId);

                return (
                  <div
                    key={occ.occurrenceId}
                    className={`bg-[#13151A] border rounded-2xl p-4 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isOverdue
                        ? 'border-rose-500/40 bg-rose-950/10'
                        : isDue
                        ? 'border-amber-500/40 bg-amber-950/10'
                        : isCompleted
                        ? 'border-emerald-500/20 opacity-75'
                        : 'border-[#1E293B]'
                    }`}
                  >
                    {/* Left: Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isDue
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          }`}
                        >
                          {occ.status}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E293B] text-[#94A3B8]">
                          {occ.category.replace('_', ' ')}
                        </span>

                        {parentObligation?.sourceType && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#0B0D10] text-[#64748B] border border-[#1E293B]">
                            {parentObligation.sourceType === 'PROVIDER_RECORDED' ? '🏥 Provider Recorded' : '👤 Owner Created'}
                          </span>
                        )}

                        {isSnoozed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Snoozed ({occ.snoozeCount}x)</span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-[#F1F5F9]">{occ.title}</h4>

                      {parentObligation?.description && (
                        <p className="text-xs text-[#94A3B8]">{parentObligation.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] pt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>
                            Clinical Due Date:{' '}
                            <strong className="text-[#E2E8F0]">
                              {new Date(occ.scheduledFor).toLocaleDateString()}
                            </strong>
                          </span>
                        </div>

                        {occ.assignedToUserId && (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#94A3B8]" />
                            <span>
                              Assigned:{' '}
                              <strong className="text-indigo-300">
                                {occ.assignedToUserId.includes('caregiver')
                                  ? 'Alex (Caregiver)'
                                  : occ.assignedToUserId.includes('admin')
                                  ? 'Sarah (Admin)'
                                  : 'Sean (Owner)'}
                              </strong>
                            </span>
                          </div>
                        )}

                        {isCompleted && occ.completedAt && (
                          <div className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed on {new Date(occ.completedAt).toLocaleDateString()}</span>
                          </div>
                        )}

                        {isSnoozed && occ.snoozedUntil && (
                          <div className="flex items-center gap-1 text-amber-400 font-mono text-[11px]">
                            <span>Notification suppressed until {new Date(occ.snoozedUntil).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!isCompleted && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOccurrence(occ);
                              setShowCompleteModal(true);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-[#0F1115] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedOccurrence(occ);
                              setShowSnoozeModal(true);
                            }}
                            className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#E2E8F0] rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Snooze</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedOccurrence(occ);
                              setShowAssignModal(true);
                            }}
                            className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#E2E8F0] rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Delegate</span>
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <div className="text-xs text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verified Complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW TAB 2: NOTIFICATION ORCHESTRATION */}
      {activeViewTab === 'INBOX' && (
        <div className="space-y-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                <span>Multi-Channel Notification Orchestrator (Volume XXVI)</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Idempotent deduplication keys, quiet hours evaluation (22:00-07:00), exponential backoff retries, and dead-letter queue.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  NotificationStore.markAllAsRead(activeActorId);
                  refreshData();
                }}
                className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl transition-all cursor-pointer"
              >
                Mark All Read
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="space-y-2.5">
            {notifications.length === 0 ? (
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-8 text-center text-[#64748B]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No notifications for active persona.</p>
              </div>
            ) : (
              notifications.map((notif: any) => (
                <div
                  key={notif.notificationId}
                  className={`bg-[#13151A] border rounded-2xl p-4 transition-all flex items-start justify-between gap-4 ${
                    !notif.isRead ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-[#1E293B]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          notif.notificationType === 'CARE_OVERDUE'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : notif.notificationType === 'CARE_DUE'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : notif.notificationType === 'CARE_ASSIGNED'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {notif.notificationType}
                      </span>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#0B0D10] text-[#64748B] border border-[#1E293B]">
                        Channel: {notif.channel}
                      </span>

                      <span className="text-[10px] text-[#64748B] font-mono">
                        {new Date(notif.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h5 className="text-sm font-bold text-[#F1F5F9]">{notif.title}</h5>
                    <p className="text-xs text-[#94A3B8]">{notif.body}</p>
                    <div className="text-[10px] text-[#475569] font-mono">
                      Deduplication Key: {notif.deduplicationKey} · Attempts: {notif.attemptCount}/{notif.maxAttempts}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!notif.isRead && (
                      <button
                        onClick={() => {
                          NotificationStore.markAsRead(notif.notificationId);
                          refreshData();
                        }}
                        className="px-2.5 py-1 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW TAB 3: ADD CARE OBLIGATION */}
      {activeViewTab === 'NEW_CARE' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl max-w-2xl mx-auto">
          <div className="border-b border-[#1E293B] pb-4 mb-4">
            <h3 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-amber-400" />
              <span>Create New Care Obligation</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              Step 31 Invariant: Pet OS must not invent clinical schedules. Professional-derived care requires clinical authority.
            </p>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateObligation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Care Title &amp; Description
              </label>
              <input
                type="text"
                placeholder="e.g. Heartgard Plus Chewable, Nail Trim, Annual Booster"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as CareCategory)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="PARASITE_PREVENTION">Parasite Prevention</option>
                  <option value="VACCINATION">Vaccination</option>
                  <option value="DEWORMING">Deworming</option>
                  <option value="VET_CHECKUP">Veterinary Checkup</option>
                  <option value="DENTAL_CARE">Dental Care</option>
                  <option value="GROOMING">Grooming</option>
                  <option value="MEDICATION_ADMINISTRATION">Medication</option>
                  <option value="GENERAL_CARE">General Care</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  First Due Date
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Recurrence
                </label>
                <select
                  value={newRecurrence}
                  onChange={e => setNewRecurrence(e.target.value as any)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="NONE">One-Time Only</option>
                  <option value="DAILY">Daily Recurrence</option>
                  <option value="WEEKLY">Weekly Recurrence</option>
                  <option value="MONTHLY">Monthly Recurrence</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Source Provenance
                </label>
                <select
                  value={newSourceType}
                  onChange={e => setNewSourceType(e.target.value as any)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="OWNER_CREATED">Owner Created</option>
                  <option value="PROVIDER_RECORDED">Provider Recorded (Protected)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as any)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3.5 py-2 text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High (Escalates)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-[#0F1115] font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save Care Obligation</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW TAB 4: SCHEDULER ENGINE */}
      {activeViewTab === 'SCHEDULER' && (
        <div className="space-y-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span>Background Scheduler &amp; Resilience Engine</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              Evaluates temporal due windows, cascades overdue transitions, lookahead occurrence generation, and recovery from offline downtime.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={handleRunSchedulerTick}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-[#0F1115] font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Execute Scheduler Tick Now</span>
              </button>

              <button
                onClick={() => handleSimulateDowntime(6)}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <FastForward className="w-4 h-4 text-amber-400" />
                <span>Simulate 6-Hour Downtime Catchup</span>
              </button>

              <button
                onClick={() => handleSimulateDowntime(24)}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <FastForward className="w-4 h-4 text-rose-400" />
                <span>Simulate 24-Hour Downtime Catchup</span>
              </button>
            </div>
          </div>

          {/* Last Execution Report */}
          {lastReport && (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-3">
              <h4 className="text-sm font-bold text-[#F1F5F9] flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Last Execution Report ({new Date(lastReport.timestamp).toLocaleTimeString()})</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[#64748B]">Evaluated Occurrences</div>
                  <div className="text-lg font-bold text-[#F1F5F9] mt-1">{lastReport.evaluatedOccurrences}</div>
                </div>

                <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[#64748B]">State Transitions</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">{lastReport.transitionedCount}</div>
                </div>

                <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[#64748B]">Reminders Enqueued</div>
                  <div className="text-lg font-bold text-indigo-400 mt-1">{lastReport.remindersEnqueued}</div>
                </div>

                <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                  <div className="text-[#64748B]">Lookahead Generated</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{lastReport.occurrencesGenerated}</div>
                </div>
              </div>

              <div className="bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B] text-xs font-mono text-[#94A3B8]">
                Notification Queue: Processed {lastReport.notificationQueueReport.processed} · Delivered {lastReport.notificationQueueReport.delivered} · Failed {lastReport.notificationQueueReport.failed} · Dead-Letter {lastReport.notificationQueueReport.deadLetter}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 5: TEST SUITE */}
      {activeViewTab === 'TESTS' && (
        <div className="space-y-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <span>Sprint 6 Automated Architecture Test Suite</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Verifies recurrence calculations, snooze invariants, clinical authority protection, timeline projection, caregiver delegation, and notification resilience.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={runningTests}
              className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              {runningTests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{runningTests ? 'Executing Test Suites...' : 'Run All 12 Test Suites'}</span>
            </button>
          </div>

          {testSummary && (
            <div className="space-y-3">
              {/* Summary pill */}
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-bold text-[#F1F5F9]">
                    Execution Summary: <span className="text-emerald-400">{testSummary.passed} Passed</span> · <span className={testSummary.failed > 0 ? 'text-rose-400' : 'text-[#64748B]'}>{testSummary.failed} Failed</span>
                  </div>
                  <div className="text-xs text-[#64748B] font-mono">
                    Total Duration: {testSummary.durationMs}ms
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  testSummary.failed === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {testSummary.failed === 0 ? 'All Assertions Passed' : 'Failures Detected'}
                </span>
              </div>

              {/* Individual Results */}
              <div className="space-y-2">
                {testSummary.results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      r.passed
                        ? 'bg-[#13151A] border-emerald-500/20 text-[#E2E8F0]'
                        : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-[10px] text-[#64748B]">{r.category}</div>
                        {r.error && <div className="text-rose-400 font-mono mt-1">{r.error}</div>}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[#64748B]">{r.durationMs}ms</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: COMPLETE CARE OCCURRENCE */}
      {showCompleteModal && selectedOccurrence && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Record Care Completion</span>
            </h4>

            <p className="text-xs text-[#94A3B8]">
              Recording completion for <strong>{selectedOccurrence.title}</strong> will log verified completion provenance and project directly to the Unified Pet Timeline.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Completion Notes &amp; Observations
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Administered with breakfast. Well tolerated without regurgitation."
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Evidence / Receipt Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. DOC-VACC-0042, Photo URL, Batch #, Receipt"
                value={completionEvidence}
                onChange={e => setCompletionEvidence(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteOccurrence}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-[#0F1115] font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Confirm Completion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SNOOZE REMINDER */}
      {showSnoozeModal && selectedOccurrence && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Snooze Care Reminder</span>
            </h4>

            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300">
              <strong>Step 36 Invariant:</strong> Snooze suppresses reminder delivery. It <em>does not</em> rewrite or postpone the underlying clinical due date!
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Snooze Duration
              </label>
              <select
                value={snoozeDays}
                onChange={e => setSnoozeDays(Number(e.target.value))}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value={1}>1 Day (Tomorrow)</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
                <option value={7}>1 Week</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Reason for Snooze (Audited)
              </label>
              <input
                type="text"
                placeholder="e.g. Waiting for medication delivery, Traveling"
                value={snoozeReason}
                onChange={e => setSnoozeReason(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSnoozeModal(false)}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSnoozeOccurrence}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-[#0F1115] font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Apply Snooze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELEGATE TO CAREGIVER */}
      {showAssignModal && selectedOccurrence && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="text-base font-bold text-[#F1F5F9] flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>Delegate Care Task</span>
            </h4>

            <p className="text-xs text-[#94A3B8]">
              Assign <strong>{selectedOccurrence.title}</strong> to a member of this pet's household. The assignee will receive an immediate assignment notification.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                Select Assignee
              </label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="">Select Household Member...</option>
                <option value="user-owner-001">Sean (Primary Owner)</option>
                <option value="user-admin-002">Sarah (Household Admin)</option>
                <option value="user-caregiver-003">Alex (Caregiver)</option>
                <option value="user-temp-004">Tom (Temporary Caregiver)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#E2E8F0] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignCaregiver}
                disabled={!assigneeId}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Assign Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
