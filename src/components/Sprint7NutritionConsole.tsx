/**
 * Pet OS Sprint 7 - Nutrition, Feeding Plans, Meal Execution, Hydration & Dietary Safety Console
 * Implements Volume IX (Nutrition & Feeding Architecture), Volume IV, Volume VII, Volume XXVI, Volume XXX
 */

import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Play,
  RotateCcw,
  FastForward,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  User,
  Filter,
  Calendar,
  Info,
  X,
  Flame,
  Layers,
  Activity,
  Award,
  RefreshCw,
  Eye,
  Check
} from 'lucide-react';
import {
  asUserId,
  asPetId,
  asHouseholdId,
  asFoodId,
  asMealOccurrenceId,
  UserId,
  PetId,
  HouseholdId,
  MealOccurrenceId,
  FoodId
} from '../pet-os/kernel/ids';
import { ClockRegistry, SimulatedClock } from '../pet-os/kernel/time';
import { PetStore } from '../pet-os/pet-core/store';
import { IdentityStore } from '../pet-os/identity/store';
import { HealthStore } from '../pet-os/health/store';
import { NutritionStore } from '../pet-os/nutrition/store';
import { NutritionService } from '../pet-os/nutrition/service';
import { seedSprint7NutritionData } from '../pet-os/nutrition/seed';
import { Sprint7NutritionTestSuite, TestResult } from '../pet-os/nutrition/tests';
import {
  MealOccurrence,
  FoodItem,
  FeedingPlan,
  PetNutritionProfile,
  CaregiverQuickView,
  FoodConflictResult,
  AppetiteStatus,
  TreatContext,
  HydrationMeasurementType
} from '../pet-os/nutrition/types';

export const Sprint7NutritionConsole: React.FC = () => {
  // 1. Context & Actor State
  const [selectedPetId, setSelectedPetId] = useState<PetId>(asPetId('pet-001'));
  const [activeActorId, setActiveActorId] = useState<UserId>(asUserId('user-owner-001'));
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
  const [simulatedClock, setSimulatedClock] = useState<SimulatedClock | null>(null);

  // 2. Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'TODAY' | 'PLANS' | 'FOODS' | 'TREATS_HYDRATION' | 'SAFETY_EVALUATOR' | 'TRANSITION' | 'CAREGIVER_VIEW' | 'TESTS'
  >('TODAY');

  // 3. Domain Data State
  const [profile, setProfile] = useState<PetNutritionProfile | null>(null);
  const [caregiverView, setCaregiverView] = useState<CaregiverQuickView | null>(null);
  const [allFoods, setAllFoods] = useState<FoodItem[]>([]);
  const [allPlans, setAllPlans] = useState<FeedingPlan[]>([]);
  const [treatLogs, setTreatLogs] = useState<any[]>([]);
  const [hydrationLogs, setHydrationLogs] = useState<any[]>([]);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // 4. Modals & Action State
  const [completingMeal, setCompletingMeal] = useState<MealOccurrence | null>(null);
  const [consumedGrams, setConsumedGrams] = useState<number>(220);
  const [appetiteSelection, setAppetiteSelection] = useState<AppetiteStatus>('NORMAL');
  const [mealNotes, setMealNotes] = useState<string>('');
  const [duplicateOverride, setDuplicateOverride] = useState<boolean>(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Unscheduled Meal Form
  const [showUnscheduledModal, setShowUnscheduledModal] = useState<boolean>(false);
  const [unscheduledLabel, setUnscheduledLabel] = useState<string>('Midday Snack');
  const [unscheduledFoodId, setUnscheduledFoodId] = useState<string>('');
  const [unscheduledGrams, setUnscheduledGrams] = useState<number>(50);

  // Food Conflict Evaluator State
  const [evaluatingFoodId, setEvaluatingFoodId] = useState<string>('');
  const [evaluationResult, setEvaluationResult] = useState<FoodConflictResult | null>(null);

  // New Food Modal
  const [showNewFoodModal, setShowNewFoodModal] = useState<boolean>(false);
  const [newFoodName, setNewFoodName] = useState<string>('');
  const [newFoodBrand, setNewFoodBrand] = useState<string>('');
  const [newFoodType, setNewFoodType] = useState<any>('COMMERCIAL_DRY');
  const [newFoodIngredientsKnown, setNewFoodIngredientsKnown] = useState<boolean>(true);
  const [newFoodIngredientsStr, setNewFoodIngredientsStr] = useState<string>('Chicken, Rice, Carrots');
  const [newFoodForm, setNewFoodForm] = useState<any>('KIBBLE');

  // Treat Form Modal
  const [showTreatModal, setShowTreatModal] = useState<boolean>(false);
  const [treatName, setTreatName] = useState<string>('Freeze-Dried Liver Bites');
  const [treatQuantity, setTreatQuantity] = useState<number>(3);
  const [treatContext, setTreatContext] = useState<TreatContext>('TRAINING');

  // Hydration Form Modal
  const [showHydrationModal, setShowHydrationModal] = useState<boolean>(false);
  const [hydrationVolume, setHydrationVolume] = useState<number>(500);
  const [hydrationType, setHydrationType] = useState<HydrationMeasurementType>('OFFERED_REFILL');
  const [hydrationSource, setHydrationSource] = useState<string>('Kitchen Tap Bowl');

  // Test Suite State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runningTests, setRunningTests] = useState<boolean>(false);

  // Available Household Actors
  const householdActors = [
    { id: asUserId('user-owner-001'), name: 'Sean Mwangi', role: 'HOUSEHOLD_OWNER', badge: 'Owner' },
    { id: asUserId('user-admin-002'), name: 'Wanjiku Mwangi', role: 'HOUSEHOLD_ADMIN', badge: 'Admin' },
    { id: asUserId('user-caregiver-003'), name: 'Peter Omondi', role: 'CAREGIVER', badge: 'Caregiver' },
    { id: asUserId('user-sitter-004'), name: 'Amina Kimani', role: 'TEMPORARY_CAREGIVER', badge: 'Pet Sitter' }
  ];

  // --------------------------------------------------------------------------
  // INITIALIZATION & SUBSCRIPTIONS
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 1. Setup clock
    let clock = ClockRegistry.getClock();
    if (!clock || !(clock instanceof SimulatedClock)) {
      const sim = new SimulatedClock(new Date());
      ClockRegistry.setClock(sim);
      clock = sim;
    }
    setSimulatedClock(clock as SimulatedClock);
    updateClockDisplay();

    // 2. Ensure pet exists
    let pet = PetStore.findPetById(selectedPetId);
    if (!pet) {
      const pets = PetStore.findAllPets();
      if (pets.length > 0) {
        setSelectedPetId(pets[0].petId);
      } else {
        PetStore.savePet({
          petId: asPetId('pet-001'),
          householdId: asHouseholdId('household-001'),
          name: 'Simba',
          speciesCode: 'CANIS_LUPUS_FAMILIARIS',
          breedCode: 'RHODESIAN_RIDGEBACK',
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

    // 3. Ensure users exist in IdentityStore
    for (const actor of householdActors) {
      if (!IdentityStore.findUserById(actor.id)) {
        IdentityStore.saveUser({
          userId: actor.id,
          email: `${actor.id}@petos.internal`,
          normalizedEmail: `${actor.id}@petos.internal`.toLowerCase(),
          passwordHash: 'dummy',
          accountStatus: 'ACTIVE',
          failedLoginAttempts: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          policyAcceptedAt: new Date().toISOString(),
          policyVersion: '1.0'
        });
        IdentityStore.saveProfile({
          userId: actor.id,
          displayName: actor.name,
          firstName: actor.name.split(' ')[0],
          lastName: actor.name.split(' ')[1] || '',
          locale: 'en-US',
          timezone: 'Africa/Nairobi',
          communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
          privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
          updatedAt: new Date().toISOString()
        });
        IdentityStore.saveMembership({
          membershipId: `mem-${actor.id}` as any,
          householdId: asHouseholdId('household-001'),
          userId: actor.id,
          role: actor.role as any,
          status: 'ACTIVE',
          joinedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 4. Seed Sprint 7 Nutrition data if not present
    seedSprint7NutritionData(asUserId('user-owner-001'), selectedPetId).then(() => {
      refreshData();
    });

    // 5. Subscribe to domain events
    const unsubscribe = NutritionStore.subscribe(() => {
      refreshData();
    });

    return () => {
      unsubscribe();
    };
  }, [selectedPetId]);

  const refreshData = () => {
    const prof = NutritionService.getNutritionProfile(selectedPetId);
    setProfile(prof);

    const qv = NutritionService.getCaregiverQuickView(selectedPetId);
    setCaregiverView(qv);

    const foods = NutritionService.listFoods(asHouseholdId('household-001'));
    setAllFoods(foods);
    if (foods.length > 0 && !evaluatingFoodId) {
      setEvaluatingFoodId(foods[0].foodId);
    }
    if (foods.length > 0 && !unscheduledFoodId) {
      setUnscheduledFoodId(foods[0].foodId);
    }

    const plans = NutritionStore.listFeedingPlansForPet(selectedPetId);
    setAllPlans(plans);

    const treats = NutritionStore.listTreatLogsForPet(selectedPetId);
    setTreatLogs(treats);

    const hydrations = NutritionStore.listHydrationLogsForPet(selectedPetId);
    setHydrationLogs(hydrations);
  };

  const updateClockDisplay = () => {
    const d = ClockRegistry.getClock().now();
    setCurrentTimeDisplay(
      d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' UTC'
    );
  };

  const advanceClockMinutes = (minutes: number) => {
    if (simulatedClock) {
      simulatedClock.advance(minutes * 60 * 1000);
      updateClockDisplay();
      refreshData();
      setActionNotice({
        message: `Clock fast-forwarded by ${minutes} minutes. Occurrences and timers recalculated.`,
        type: 'success'
      });
    }
  };

  const resetClock = () => {
    if (simulatedClock) {
      simulatedClock.setTime(new Date());
      updateClockDisplay();
      refreshData();
      setActionNotice({
        message: `Clock synchronized back to real-world time.`,
        type: 'success'
      });
    }
  };

  // --------------------------------------------------------------------------
  // MEAL EXECUTION HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenCompleteModal = (occ: MealOccurrence) => {
    setCompletingMeal(occ);
    setConsumedGrams(occ.plannedQuantity.value);
    setAppetiteSelection('NORMAL');
    setMealNotes('');
    setDuplicateOverride(false);
    setDuplicateWarning(null);
  };

  const handleExecuteCompleteMeal = () => {
    if (!completingMeal) return;

    try {
      NutritionService.completeMeal({
        occurrenceId: completingMeal.occurrenceId,
        userId: activeActorId,
        actualQuantity: { value: consumedGrams, unit: completingMeal.plannedQuantity.unit },
        consumedQuantity: { value: consumedGrams, unit: completingMeal.plannedQuantity.unit },
        appetiteObservation: appetiteSelection,
        notes: mealNotes,
        concurrencyVersion: completingMeal.concurrencyVersion,
        allowDuplicateOverride: duplicateOverride
      });

      setActionNotice({
        message: `Meal "${completingMeal.label}" recorded successfully by ${householdActors.find((a) => a.id === activeActorId)?.name}!`,
        type: 'success'
      });
      setCompletingMeal(null);
      setDuplicateWarning(null);
      refreshData();
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_FEEDING_GUARD')) {
        setDuplicateWarning(err.message);
      } else {
        setActionNotice({ message: err.message, type: 'error' });
      }
    }
  };

  const handleSkipMeal = (occurrenceId: MealOccurrenceId, reason: string) => {
    const occ = NutritionStore.findMealOccurrenceById(occurrenceId);
    if (!occ) return;

    try {
      NutritionService.skipMeal({
        occurrenceId,
        userId: activeActorId,
        reason,
        concurrencyVersion: occ.concurrencyVersion
      });
      setActionNotice({ message: `Meal skipped: ${reason}`, type: 'warning' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ message: err.message, type: 'error' });
    }
  };

  const handleLogUnscheduledMeal = () => {
    if (!unscheduledFoodId) return;

    try {
      NutritionService.logUnscheduledMeal({
        petId: selectedPetId,
        householdId: asHouseholdId('household-001'),
        label: unscheduledLabel,
        foodId: asFoodId(unscheduledFoodId),
        quantity: { value: unscheduledGrams, unit: 'g' },
        userId: activeActorId,
        notes: 'Unscheduled additional feeding'
      });

      setActionNotice({ message: `Unscheduled feeding "${unscheduledLabel}" recorded.`, type: 'success' });
      setShowUnscheduledModal(false);
      refreshData();
    } catch (err: any) {
      setActionNotice({ message: err.message, type: 'error' });
    }
  };

  // --------------------------------------------------------------------------
  // FOOD EVALUATION HANDLERS
  // --------------------------------------------------------------------------
  const handleEvaluateFood = (foodId: string) => {
    setEvaluatingFoodId(foodId);
    const res = NutritionService.evaluateFoodConflict(selectedPetId, asFoodId(foodId));
    setEvaluationResult(res);
  };

  // --------------------------------------------------------------------------
  // CREATE FOOD HANDLER
  // --------------------------------------------------------------------------
  const handleCreateFood = () => {
    if (!newFoodName.trim() || !newFoodBrand.trim()) return;

    try {
      const ingredientsList = newFoodIngredientsKnown
        ? newFoodIngredientsStr.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const created = NutritionService.createFoodItem({
        name: newFoodName.trim(),
        brand: newFoodBrand.trim(),
        foodType: newFoodType,
        sourceType: 'OWNER_CREATED',
        speciesTarget: 'CANINE',
        form: newFoodForm,
        ingredients: ingredientsList,
        ingredientsKnown: newFoodIngredientsKnown,
        servingUnitDefault: 'g',
        householdId: asHouseholdId('household-001'),
        userId: activeActorId
      });

      setActionNotice({ message: `New food item "${created.name}" added to household catalogue.`, type: 'success' });
      setShowNewFoodModal(false);
      setNewFoodName('');
      setNewFoodBrand('');
      refreshData();
    } catch (err: any) {
      setActionNotice({ message: err.message, type: 'error' });
    }
  };

  // --------------------------------------------------------------------------
  // TREAT & HYDRATION HANDLERS
  // --------------------------------------------------------------------------
  const handleLogTreat = () => {
    try {
      NutritionService.logTreat({
        petId: selectedPetId,
        householdId: asHouseholdId('household-001'),
        treatName,
        quantity: { value: treatQuantity, unit: 'piece' },
        context: treatContext,
        userId: activeActorId
      });
      setActionNotice({ message: `Logged ${treatQuantity}x "${treatName}" treat given.`, type: 'success' });
      setShowTreatModal(false);
      refreshData();
    } catch (err: any) {
      setActionNotice({ message: err.message, type: 'error' });
    }
  };

  const handleLogHydration = () => {
    try {
      NutritionService.logHydration({
        petId: selectedPetId,
        householdId: asHouseholdId('household-001'),
        volumeMl: hydrationVolume,
        measurementType: hydrationType,
        waterSource: hydrationSource,
        userId: activeActorId
      });
      setActionNotice({
        message: `Hydration recorded: ${hydrationVolume}ml (${hydrationType.replace('_', ' ')}).`,
        type: 'success'
      });
      setShowHydrationModal(false);
      refreshData();
    } catch (err: any) {
      setActionNotice({ message: err.message, type: 'error' });
    }
  };

  // --------------------------------------------------------------------------
  // TEST SUITE HANDLER
  // --------------------------------------------------------------------------
  const handleRunAllTests = async () => {
    setRunningTests(true);
    try {
      const results = await Sprint7NutritionTestSuite.runAllTests();
      setTestResults(results);
      setActionNotice({
        message: `Sprint 7 Test Suite completed: ${results.filter((r) => r.passed).length} / ${results.length} tests passed!`,
        type: 'success'
      });
    } catch (err: any) {
      setActionNotice({ message: `Test run failed: ${err.message}`, type: 'error' });
    } finally {
      setRunningTests(false);
      refreshData();
    }
  };

  const currentActor = householdActors.find((a) => a.id === activeActorId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ------------------------------------------------------------------- */}
        {/* HEADER & TIME CONTROLS */}
        {/* ------------------------------------------------------------------- */}
        <header className="bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                    Pet OS Nutrition & Dietary Safety
                    <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Sprint 7 Active
                    </span>
                  </h1>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Volume IX Architecture: Feeding Plans, Meal Occurrences, Concurrency Protection & Dietary Safety
                  </p>
                </div>
              </div>
            </div>

            {/* Acting Household Member Switcher */}
            <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/60">
              <span className="text-xs font-medium text-slate-400 px-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Actor:
              </span>
              {householdActors.map((actor) => (
                <button
                  key={actor.id}
                  onClick={() => setActiveActorId(actor.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeActorId === actor.id
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={`${actor.name} (${actor.role})`}
                >
                  {actor.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Temporal Clock Engine Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Canonical Clock:</span>
              <span className="font-mono font-semibold text-white px-2 py-0.5 bg-slate-950/70 border border-slate-700 rounded-md">
                {currentTimeDisplay || 'Synchronizing...'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 mr-1 text-xs">Simulate Time:</span>
              <button
                onClick={() => advanceClockMinutes(120)}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
              >
                <FastForward className="w-3 h-3" /> +2h
              </button>
              <button
                onClick={() => advanceClockMinutes(360)}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
              >
                <FastForward className="w-3 h-3" /> +6h
              </button>
              <button
                onClick={() => advanceClockMinutes(1440)}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
              >
                <Calendar className="w-3 h-3" /> +1 Day
              </button>
              <button
                onClick={resetClock}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-600 transition"
              >
                <RotateCcw className="w-3 h-3" /> Real Time
              </button>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------- */}
        {/* ACTION / ALERT BANNER */}
        {/* ------------------------------------------------------------------- */}
        {actionNotice && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-in fade-in duration-200 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : actionNotice.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : actionNotice.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* NAVIGATION TABS */}
        {/* ------------------------------------------------------------------- */}
        <nav className="flex items-center gap-1 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'TODAY', label: "Today's Feeding", icon: Utensils },
            { id: 'PLANS', label: 'Feeding Plans', icon: Layers },
            { id: 'FOODS', label: 'Food Catalogue & Unknowns', icon: Filter },
            { id: 'TREATS_HYDRATION', label: 'Treats & Hydration', icon: Droplets },
            { id: 'SAFETY_EVALUATOR', label: 'Dietary Safety & Allergies', icon: ShieldAlert },
            { id: 'TRANSITION', label: 'Diet Transitions', icon: Activity },
            { id: 'CAREGIVER_VIEW', label: 'Caregiver Quick View', icon: Eye },
            { id: 'TESTS', label: 'Verification Test Suite', icon: Award }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: TODAY'S FEEDING */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'TODAY' && (
          <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Active Diet Plan</div>
                <div className="text-lg font-bold text-white mt-1">
                  {profile?.activeFeedingPlan?.title || 'No Active Plan'}
                </div>
                <div className="text-xs text-amber-400 mt-0.5">
                  {profile?.primaryFood?.name || 'Standard Diet'}
                </div>
              </div>

              <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Today's Routine</div>
                <div className="text-lg font-bold text-white mt-1">
                  {profile?.todayOccurrences.filter((o) => o.status === 'COMPLETED').length || 0} /{' '}
                  {profile?.todayOccurrences.length || 0} Meals Fed
                </div>
                <div className="text-xs text-emerald-400 mt-0.5">
                  {profile?.todayOccurrences.some((o) => o.status === 'SCHEDULED' || o.status === 'DUE')
                    ? 'Meals remaining today'
                    : 'All routine meals completed'}
                </div>
              </div>

              <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">24h Hydration Summary</div>
                <div className="text-lg font-bold text-white mt-1">
                  {profile?.recentHydrationSummary.totalMeasuredConsumedLast24h || 0} ml
                </div>
                <div className="text-xs text-sky-400 mt-0.5">
                  Offered: {profile?.recentHydrationSummary.totalOfferedLast24h || 0} ml
                </div>
              </div>

              <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Recent Appetite</div>
                <div className="text-lg font-bold text-white mt-1 flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      profile?.recentAppetiteSummary.lastObservedStatus === 'NORMAL'
                        ? 'bg-emerald-400'
                        : profile?.recentAppetiteSummary.lastObservedStatus === 'REFUSED_MEAL'
                        ? 'bg-rose-500'
                        : 'bg-amber-400'
                    }`}
                  />
                  {profile?.recentAppetiteSummary.lastObservedStatus || 'NORMAL'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Refused last 7d: {profile?.recentAppetiteSummary.refusedCountLast7Days || 0}
                </div>
              </div>
            </div>

            {/* Meal Routine Card */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-amber-400" />
                    Today's Feeding Schedule
                  </h2>
                  <p className="text-xs text-slate-400">
                    Track household meal execution. Concurrency protected with duplicate-feeding guard.
                  </p>
                </div>

                <button
                  onClick={() => setShowUnscheduledModal(true)}
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4 text-amber-400" /> Log Unscheduled Meal
                </button>
              </div>

              {/* Occurrences List */}
              <div className="space-y-3">
                {profile?.todayOccurrences.map((occ) => {
                  const food = NutritionStore.findFoodById(occ.foodId);
                  const isCompleted = occ.status === 'COMPLETED' || occ.status === 'PARTIALLY_COMPLETED';
                  const isSkipped = occ.status === 'SKIPPED';
                  const completedUser = occ.completedByUserId
                    ? IdentityStore.findUserById(occ.completedByUserId)
                    : undefined;

                  return (
                    <div
                      key={occ.occurrenceId}
                      className={`p-4 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isSkipped
                          ? 'bg-slate-900/50 border-slate-700 opacity-75'
                          : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`p-2.5 rounded-xl border mt-0.5 ${
                              isCompleted
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : isSkipped
                                ? 'bg-slate-800 border-slate-700 text-slate-400'
                                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                            }`}
                          >
                            <Clock className="w-5 h-5" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-white text-base">{occ.label}</span>
                              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {occ.scheduledLocalTime}
                              </span>

                              {occ.isUnscheduled && (
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  Unscheduled
                                </span>
                              )}

                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                                  occ.status === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                    : occ.status === 'PARTIALLY_COMPLETED'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : occ.status === 'SKIPPED'
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                                }`}
                              >
                                {occ.status.replace('_', ' ')}
                              </span>
                            </div>

                            <div className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                              <span>
                                Food: <strong className="text-white">{food?.name || 'Diet Item'}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Target Portion:{' '}
                                <strong className="text-amber-300">
                                  {occ.plannedQuantity.value} {occ.plannedQuantity.unit}
                                </strong>
                              </span>
                            </div>

                            {/* Execution details if completed */}
                            {isCompleted && (
                              <div className="text-xs text-emerald-300/90 mt-2 flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-500/20">
                                <span className="flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  Fed by: <strong>{(occ.completedByUserId && IdentityStore.findProfileByUserId(occ.completedByUserId)?.displayName) || 'Caregiver'}</strong> at{' '}
                                  {occ.completedAt?.split('T')[1].slice(0, 5)} UTC
                                </span>
                                {occ.consumedQuantity && (
                                  <span>
                                    Consumed:{' '}
                                    <strong>
                                      {occ.consumedQuantity.value} {occ.consumedQuantity.unit}
                                    </strong>
                                  </span>
                                )}
                                {occ.appetiteObservation && (
                                  <span>
                                    Appetite: <strong>{occ.appetiteObservation}</strong>
                                  </span>
                                )}
                                {occ.notes && <span className="italic">"{occ.notes}"</span>}
                              </div>
                            )}

                            {isSkipped && (
                              <div className="text-xs text-slate-400 mt-1 italic">
                                Skipped reason: "{occ.skipReason}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Controls */}
                        {!isCompleted && !isSkipped && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenCompleteModal(occ)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" /> Mark Fed
                            </button>

                            <button
                              onClick={() =>
                                handleSkipMeal(occ.occurrenceId, 'Caregiver scheduled fasting / pet resting')
                              }
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!profile?.todayOccurrences || profile.todayOccurrences.length === 0) && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No meals scheduled for today. Create a feeding plan in the Feeding Plans tab.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: FEEDING PLANS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'PLANS' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    Household Feeding Plans
                  </h2>
                  <p className="text-xs text-slate-400">
                    Single active primary diet enforced. Professional diets require clinical provenance.
                  </p>
                </div>
              </div>

              {/* Plans List */}
              <div className="space-y-4">
                {allPlans.map((plan) => {
                  const schedules = NutritionStore.listSchedulesForPlan(plan.feedingPlanId);

                  return (
                    <div
                      key={plan.feedingPlanId}
                      className={`p-5 rounded-xl border transition-all ${
                        plan.status === 'ACTIVE'
                          ? 'bg-slate-900 border-amber-500/50 shadow-lg'
                          : 'bg-slate-900/60 border-slate-800 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base font-bold text-white">{plan.title}</h3>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                                plan.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : plan.status === 'SUPERSEDED'
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {plan.status}
                            </span>

                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {plan.provenance.replace('_', ' ')}
                            </span>

                            {plan.isProfessionalPlan && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Professional Diet
                              </span>
                            )}
                          </div>

                          {plan.generalInstructions && (
                            <p className="text-xs text-slate-300 max-w-2xl">{plan.generalInstructions}</p>
                          )}

                          {plan.clinicalNotes && (
                            <p className="text-xs text-blue-300/90 font-medium">
                              [Clinical Notice]: {plan.clinicalNotes}
                            </p>
                          )}

                          {/* Schedules list */}
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-slate-400 mb-1.5">Scheduled Meals:</div>
                            <div className="flex flex-wrap gap-2">
                              {schedules.map((s) => {
                                const food = NutritionStore.findFoodById(s.targetFoodId);
                                return (
                                  <div
                                    key={s.mealScheduleId}
                                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-2"
                                  >
                                    <strong className="text-amber-400">{s.localTime}</strong>
                                    <span>{s.label}</span>
                                    <span className="text-slate-400">
                                      ({s.plannedQuantity.value} {s.plannedQuantity.unit} {food?.name})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Plan Controls */}
                        <div>
                          {plan.status === 'PAUSED' && (
                            <button
                              onClick={() => {
                                try {
                                  NutritionService.activateFeedingPlan(plan.feedingPlanId, activeActorId);
                                  setActionNotice({ message: `Plan "${plan.title}" activated.`, type: 'success' });
                                  refreshData();
                                } catch (e: any) {
                                  setActionNotice({ message: e.message, type: 'error' });
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                            >
                              Activate Plan
                            </button>
                          )}

                          {plan.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                try {
                                  NutritionService.pauseFeedingPlan(
                                    plan.feedingPlanId,
                                    activeActorId,
                                    'Paused by user console'
                                  );
                                  setActionNotice({ message: `Plan "${plan.title}" paused.`, type: 'warning' });
                                  refreshData();
                                } catch (e: any) {
                                  setActionNotice({ message: e.message, type: 'error' });
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                            >
                              Pause Plan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: FOOD CATALOGUE & UNKNOWNS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'FOODS' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Filter className="w-5 h-5 text-amber-400" />
                    Food Item Reference & Catalogue
                  </h2>
                  <p className="text-xs text-slate-400">
                    Volume IX Rule: Unknown ingredient compositions are strictly preserved as UNKNOWN, never guessed.
                  </p>
                </div>

                <button
                  onClick={() => setShowNewFoodModal(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Add Food Item
                </button>
              </div>

              {/* Foods Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allFoods.map((food) => (
                  <div
                    key={food.foodId}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
                          {food.brand}
                        </div>
                        <div className="text-base font-bold text-white">{food.name}</div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {food.form}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Type: {food.foodType.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Source: {food.sourceType.replace('_', ' ')}
                      </span>
                      {food.energyDensityKcalPerGram && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {food.energyDensityKcalPerGram} kcal/g
                        </span>
                      )}
                    </div>

                    {/* Ingredients Section */}
                    <div className="pt-2 border-t border-slate-800 text-xs">
                      <div className="font-semibold text-slate-400 mb-1">Ingredients:</div>
                      {food.ingredientsKnown && food.ingredients ? (
                        <div className="flex flex-wrap gap-1">
                          {food.ingredients.map((ing, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] border border-slate-700/50"
                            >
                              {ing}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2 rounded bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            <strong>COMPOSITION UNKNOWN:</strong> Ingredients not verified. System will treat as
                            UNKNOWN and prevent automated allergy clearance.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 4: TREATS & HYDRATION */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'TREATS_HYDRATION' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Treats Column */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      Treats & Training Snacks
                    </h3>
                    <p className="text-xs text-slate-400">Contextual treat logging</p>
                  </div>

                  <button
                    onClick={() => setShowTreatModal(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Treat
                  </button>
                </div>

                <div className="space-y-2.5">
                  {treatLogs.map((t) => (
                    <div
                      key={t.treatLogId}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm">{t.treatName}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="text-amber-400 font-bold">
                            {t.quantity.value} {t.quantity.unit}
                          </span>
                          <span>•</span>
                          <span>Context: {t.context}</span>
                          {t.notes && <span>• "{t.notes}"</span>}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {t.occurredAt.split('T')[1].slice(0, 5)}
                      </span>
                    </div>
                  ))}

                  {treatLogs.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">No treats logged today.</div>
                  )}
                </div>
              </div>

              {/* Hydration Column */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-sky-400" />
                      Hydration Tracking
                    </h3>
                    <p className="text-xs text-slate-400">
                      Distinguishes water offered from water actually consumed
                    </p>
                  </div>

                  <button
                    onClick={() => setShowHydrationModal(true)}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Water
                  </button>
                </div>

                <div className="space-y-2.5">
                  {hydrationLogs.map((h) => (
                    <div
                      key={h.hydrationLogId}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          <span className="text-sky-400 font-bold">{h.volumeMl} ml</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {h.measurementType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Source: {h.waterSource || 'Bowl'} {h.notes && `• "${h.notes}"`}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        {h.occurredAt.split('T')[1].slice(0, 5)}
                      </span>
                    </div>
                  ))}

                  {hydrationLogs.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs">No hydration logs recorded.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 5: DIETARY SAFETY & ALLERGIES */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'SAFETY_EVALUATOR' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Dietary Safety & Allergy Evaluator
                </h2>
                <p className="text-xs text-slate-400">
                  Evaluates ingredients against active clinical allergies and dietary restrictions. Pet OS
                  NEVER certifies absolute safety (<code className="text-amber-300">isSafe: false</code> invariant).
                </p>
              </div>

              {/* Active Clinical Allergies Card */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Clinical Health Allergies (Sprint 5 Synchronized):
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile?.knownFoodAllergies.map((a, i) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 font-medium"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <strong>{a.allergen}</strong> ({a.severity}) • {a.verificationStatus}
                    </div>
                  ))}
                  {(!profile?.knownFoodAllergies || profile.knownFoodAllergies.length === 0) && (
                    <span className="text-xs text-slate-500">No active clinical food allergies recorded.</span>
                  )}
                </div>
              </div>

              {/* Evaluator Selector */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="text-xs font-semibold text-slate-300">
                    Select Food Item to Run Safety Evaluation:
                  </label>
                  <select
                    value={evaluatingFoodId}
                    onChange={(e) => handleEvaluateFood(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {allFoods.map((f) => (
                      <option key={f.foodId} value={f.foodId}>
                        {f.name} ({f.brand})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleEvaluateFood(evaluatingFoodId)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Play className="w-3.5 h-3.5" /> Evaluate
                  </button>
                </div>

                {/* Evaluation Outcome Box */}
                {evaluationResult && (
                  <div
                    className={`p-5 rounded-xl border space-y-3 ${
                      evaluationResult.classification === 'CONFIRMED_RECORDED_CONFLICT'
                        ? 'bg-rose-950/30 border-rose-500/60 text-rose-200'
                        : evaluationResult.classification === 'POTENTIAL_CONFLICT'
                        ? 'bg-amber-950/30 border-amber-500/60 text-amber-200'
                        : evaluationResult.classification === 'UNKNOWN'
                        ? 'bg-purple-950/30 border-purple-500/60 text-purple-200'
                        : 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {evaluationResult.classification === 'CONFIRMED_RECORDED_CONFLICT' ? (
                          <ShieldAlert className="w-5 h-5 text-rose-400" />
                        ) : evaluationResult.classification === 'POTENTIAL_CONFLICT' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        ) : evaluationResult.classification === 'UNKNOWN' ? (
                          <Info className="w-5 h-5 text-purple-400" />
                        ) : (
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        )}
                        <span className="font-bold text-base tracking-wide">
                          Classification: {evaluationResult.classification.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Explicit isSafe badge */}
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-slate-300">
                        isSafe: {String(evaluationResult.isSafe)} (Invariant Enforced)
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed">{evaluationResult.message}</p>

                    {evaluationResult.matchedAllergies.length > 0 && (
                      <div className="text-xs space-y-1">
                        <strong className="text-rose-300">Matched Clinical Allergies:</strong>
                        <ul className="list-disc pl-5">
                          {evaluationResult.matchedAllergies.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluationResult.matchedRestrictions.length > 0 && (
                      <div className="text-xs space-y-1">
                        <strong className="text-amber-300">Matched Dietary Restrictions:</strong>
                        <ul className="list-disc pl-5">
                          {evaluationResult.matchedRestrictions.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 6: DIET TRANSITIONS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'TRANSITION' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  Gradual Diet Transition Engine
                </h2>
                <p className="text-xs text-slate-400">
                  7-Day Veterinary Gradual Shift protocol protects against gastrointestinal dysbiosis.
                </p>
              </div>

              {profile?.activeTransition ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">
                        Active Transition: {profile.activeTransition.startDate} to{' '}
                        {profile.activeTransition.endDate}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Current: {profile.currentTransitionStage?.label}
                      </span>
                    </div>

                    {profile.currentTransitionStage && (
                      <div className="p-3 rounded-lg bg-slate-800 text-xs space-y-2">
                        <div className="font-semibold text-amber-300">
                          Today's Formula ({profile.currentTransitionStage.label}):
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold">
                          <span className="text-amber-400">
                            {profile.currentTransitionStage.targetFoodPercentage}% New Diet
                          </span>
                          <span className="text-slate-400">+</span>
                          <span className="text-slate-300">
                            {profile.currentTransitionStage.previousFoodPercentage}% Current Diet
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs italic">
                          "{profile.currentTransitionStage.instructions}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Stage by stage tracker */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {profile.activeTransition.stages.map((stage) => {
                      const isCurrent =
                        profile.currentTransitionStage?.stageNumber === stage.stageNumber;
                      return (
                        <div
                          key={stage.stageNumber}
                          className={`p-4 rounded-xl border text-center space-y-2 transition-all ${
                            isCurrent
                              ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500'
                              : 'bg-slate-900/60 border-slate-800 opacity-70'
                          }`}
                        >
                          <div className="text-xs font-bold uppercase text-slate-400">
                            Stage {stage.stageNumber}
                          </div>
                          <div className="text-base font-extrabold text-white">{stage.label}</div>
                          <div className="text-xs font-semibold text-amber-400">
                            {stage.targetFoodPercentage}% / {stage.previousFoodPercentage}%
                          </div>
                          <div className="text-[11px] text-slate-400 leading-tight">
                            {stage.instructions}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No active diet transition plan. Create one when changing food formulas.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 7: CAREGIVER QUICK VIEW */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'CAREGIVER_VIEW' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-amber-400" />
                    Caregiver Quick View (Least Privilege)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Minimal necessary data tailored for temporary caregivers and pet sitters like Amina.
                  </p>
                </div>

                <div className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  Sitter Mode Active
                </div>
              </div>

              {caregiverView && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Next meal highlight card */}
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border border-amber-500/40 space-y-4 shadow-xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Next Up For {caregiverView.petName}:
                    </div>

                    {caregiverView.nextMeal ? (
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-extrabold text-white">
                            {caregiverView.nextMeal.label}
                          </span>
                          <span className="text-lg font-mono text-amber-300">
                            at {caregiverView.nextMeal.scheduledTime}
                          </span>
                        </div>

                        <div className="text-sm text-slate-200">
                          Food: <strong className="text-white">{caregiverView.nextMeal.foodName}</strong>
                        </div>
                        <div className="text-sm text-slate-200">
                          Serving Portion:{' '}
                          <strong className="text-amber-300">{caregiverView.nextMeal.quantity}</strong>
                        </div>

                        {caregiverView.nextMeal.instructions && (
                          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-700/60 text-xs text-slate-300">
                            <strong>Instructions:</strong> {caregiverView.nextMeal.instructions}
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              const occ = NutritionStore.findMealOccurrenceById(
                                caregiverView.nextMeal!.occurrenceId
                              );
                              if (occ) handleOpenCompleteModal(occ);
                            }}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Complete This Feeding
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-sm">
                        No upcoming meals due for today. All scheduled feeding routines complete!
                      </div>
                    )}
                  </div>

                  {/* Safety & Allergy Alerts for Sitter */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700/80 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" /> Safety Notices
                    </div>

                    <div className="space-y-2">
                      {caregiverView.criticalAllergyWarnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-semibold"
                        >
                          {w}
                        </div>
                      ))}
                      {caregiverView.criticalAllergyWarnings.length === 0 && (
                        <div className="text-xs text-slate-400">No critical allergy alerts recorded.</div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-300">Water Status:</div>
                      <div className="text-xs text-sky-400 font-semibold">
                        Last Refill: {caregiverView.lastWaterOffered}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 8: TEST SUITE RUNNER */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'TESTS' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Automated Verification Suite
                  </h2>
                  <p className="text-xs text-slate-400">
                    Executes unit, concurrency, security, and integration invariants live.
                  </p>
                </div>

                <button
                  onClick={handleRunAllTests}
                  disabled={runningTests}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Play className="w-4 h-4" />
                  {runningTests ? 'Running Verification...' : 'Run All Sprint 7 Tests'}
                </button>
              </div>

              {testResults.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="text-emerald-400">
                      Passed: {testResults.filter((r) => r.passed).length}
                    </span>
                    <span className="text-rose-400">
                      Failed: {testResults.filter((r) => !r.passed).length}
                    </span>
                    <span className="text-slate-400">Total: {testResults.length}</span>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {testResults.map((r, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          r.passed
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                            : 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {r.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                          )}
                          <span className="font-semibold text-white">{r.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {r.error && (
                            <span className="text-rose-300 italic max-w-md truncate">{r.error}</span>
                          )}
                          <span className="font-mono text-slate-400">{r.durationMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResults.length === 0 && (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Click "Run All Sprint 7 Tests" to verify domain rules, safety evaluators, and concurrency
                  protections.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL: MARK MEAL COMPLETED */}
        {/* ------------------------------------------------------------------- */}
        {completingMeal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Complete Meal: {completingMeal.label}
                </h3>
                <button
                  onClick={() => setCompletingMeal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Duplicate feeding warning alert if triggered */}
              {duplicateWarning && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500 text-rose-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-300">
                    <ShieldAlert className="w-4 h-4" /> Duplicate Feeding Guard Triggered
                  </div>
                  <p>{duplicateWarning}</p>
                  <label className="flex items-center gap-2 text-white font-medium cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={duplicateOverride}
                      onChange={(e) => setDuplicateOverride(e.target.checked)}
                      className="rounded border-slate-600 text-amber-500 focus:ring-0"
                    />
                    <span>Acknowledge duplicate override & proceed</span>
                  </label>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Consumed Portion Quantity (Planned: {completingMeal.plannedQuantity.value}{' '}
                    {completingMeal.plannedQuantity.unit}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={consumedGrams}
                      onChange={(e) => setConsumedGrams(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                    <span className="text-slate-400 font-semibold">
                      {completingMeal.plannedQuantity.unit}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Appetite Observation:</label>
                  <select
                    value={appetiteSelection}
                    onChange={(e) => setAppetiteSelection(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="NORMAL">Normal (Ate enthusiastically)</option>
                    <option value="INCREASED">Increased (Hungry for more)</option>
                    <option value="REDUCED">Reduced (Hesitant or left leftovers)</option>
                    <option value="REFUSED_MEAL">Refused Meal (Did not eat)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Notes / Caregiver Comments:</label>
                  <input
                    type="text"
                    value={mealNotes}
                    onChange={(e) => setMealNotes(e.target.value)}
                    placeholder="e.g. Mixed with clean water, pet finished in 5 minutes"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setCompletingMeal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteCompleteMeal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  Confirm Feeding Complete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL: LOG UNSCHEDULED MEAL */}
        {/* ------------------------------------------------------------------- */}
        {showUnscheduledModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  Log Unscheduled Feeding
                </h3>
                <button onClick={() => setShowUnscheduledModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Meal Label / Occasion:</label>
                  <input
                    type="text"
                    value={unscheduledLabel}
                    onChange={(e) => setUnscheduledLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Select Food Item:</label>
                  <select
                    value={unscheduledFoodId}
                    onChange={(e) => setUnscheduledFoodId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    {allFoods.map((f) => (
                      <option key={f.foodId} value={f.foodId}>
                        {f.name} ({f.brand})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Portion Quantity (g):</label>
                  <input
                    type="number"
                    value={unscheduledGrams}
                    onChange={(e) => setUnscheduledGrams(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowUnscheduledModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogUnscheduledMeal}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow transition"
                >
                  Save Unscheduled Feeding
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL: ADD FOOD ITEM */}
        {/* ------------------------------------------------------------------- */}
        {showNewFoodModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  Add Food Item to Household Catalogue
                </h3>
                <button onClick={() => setShowNewFoodModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Food Name:</label>
                  <input
                    type="text"
                    value={newFoodName}
                    onChange={(e) => setNewFoodName(e.target.value)}
                    placeholder="e.g. Lamb & Brown Rice Sensitive"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Brand / Source:</label>
                  <input
                    type="text"
                    value={newFoodBrand}
                    onChange={(e) => setNewFoodBrand(e.target.value)}
                    placeholder="e.g. Acana, Royal Canin, Home Cooked"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Food Type:</label>
                    <select
                      value={newFoodType}
                      onChange={(e) => setNewFoodType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="COMMERCIAL_DRY">Commercial Dry</option>
                      <option value="COMMERCIAL_WET">Commercial Wet</option>
                      <option value="RAW">Raw</option>
                      <option value="HOMEMADE">Homemade</option>
                      <option value="VETERINARY_PRESCRIPTION">Veterinary Prescription</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Form:</label>
                    <select
                      value={newFoodForm}
                      onChange={(e) => setNewFoodForm(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="KIBBLE">Kibble</option>
                      <option value="PATE">Pâté</option>
                      <option value="CHUNKS_IN_GRAVY">Chunks in Gravy</option>
                      <option value="CUSTOM_MIX">Custom Mix</option>
                    </select>
                  </div>
                </div>

                {/* Explicit unknown composition checkbox */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <label className="flex items-center gap-2 text-slate-200 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFoodIngredientsKnown}
                      onChange={(e) => setNewFoodIngredientsKnown(e.target.checked)}
                      className="rounded border-slate-600 text-amber-500 focus:ring-0"
                    />
                    <span>Ingredient list is known & verified</span>
                  </label>

                  {newFoodIngredientsKnown ? (
                    <div>
                      <label className="text-slate-400 block mb-1">
                        Ingredients (comma separated):
                      </label>
                      <input
                        type="text"
                        value={newFoodIngredientsStr}
                        onChange={(e) => setNewFoodIngredientsStr(e.target.value)}
                        placeholder="e.g. Lamb, Rice, Beet pulp, Salmon oil"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                      />
                    </div>
                  ) : (
                    <p className="text-amber-400 text-xs">
                      Volume IX Rule: If ingredients are unknown, Pet OS marks composition as UNKNOWN.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowNewFoodModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFood}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow transition"
                >
                  Save Food
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL: LOG TREAT */}
        {/* ------------------------------------------------------------------- */}
        {showTreatModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Log Treat or Training Reward
                </h3>
                <button onClick={() => setShowTreatModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Treat Name:</label>
                  <input
                    type="text"
                    value={treatName}
                    onChange={(e) => setTreatName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Quantity (Pieces):</label>
                    <input
                      type="number"
                      value={treatQuantity}
                      onChange={(e) => setTreatQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Context:</label>
                    <select
                      value={treatContext}
                      onChange={(e) => setTreatContext(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                    >
                      <option value="TRAINING">Training Reward</option>
                      <option value="REWARD">General Reward</option>
                      <option value="DENTAL_CHEW">Dental Chew</option>
                      <option value="MEDICATION_ADMINISTRATION">Medication Pill Wrap</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowTreatModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogTreat}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow transition"
                >
                  Record Treat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* MODAL: LOG HYDRATION */}
        {/* ------------------------------------------------------------------- */}
        {showHydrationModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-sky-400" />
                  Record Water & Hydration
                </h3>
                <button onClick={() => setShowHydrationModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Volume (ml):</label>
                  <input
                    type="number"
                    value={hydrationVolume}
                    onChange={(e) => setHydrationVolume(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Measurement Type:</label>
                  <select
                    value={hydrationType}
                    onChange={(e) => setHydrationType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="OFFERED_REFILL">Water Offered / Bowl Refilled</option>
                    <option value="MEASURED_CONSUMPTION">Measured Actual Consumption</option>
                    <option value="ESTIMATED_CONSUMPTION">Estimated Drinking Consumption</option>
                    <option value="OBSERVED_DRINKING">Observed Drinking Event</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Water Source / Location:</label>
                  <input
                    type="text"
                    value={hydrationSource}
                    onChange={(e) => setHydrationSource(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setShowHydrationModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogHydration}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  Save Hydration Record
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
