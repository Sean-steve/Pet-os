/**
 * Pet OS Sprint 11 - Service Discovery, Availability, Booking, Reservation,
 * Rescheduling & Cancellation Engine Interactive Platform Console
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Play,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  FileText,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowRight,
  Filter,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  Info,
  CalendarCheck,
  CalendarDays,
  Repeat,
  RefreshCw,
  Send,
  AlertCircle,
  FileCheck2,
  Phone,
  Check,
} from 'lucide-react';
import {
  BookingPlatformService,
  BookingStore,
  seedBookingData,
  Sprint11TestSuite,
  TestResult,
  ServiceDiscoveryResult,
  AvailabilitySlot,
  PetEligibilityResult,
  OwnerBookingProjection,
  ProviderBookingProjection,
  RecurringBookingSeries,
  SeriesOccurrence,
  BookingAggregate,
} from '../pet-os/booking';
import { UnifiedWorkflowTestSuite } from '../pet-os/kernel/unified-workflow-tests';
import {
  ProviderStore,
  seedProviderData,
  SEED_PROVIDERS,
  SEED_USERS,
  ProviderCategory,
} from '../pet-os/provider';
import { PetStore } from '../pet-os/pet-core/store';
import {
  asUserId,
  asHouseholdId,
  asPetId,
  asProviderId,
  asServiceOfferingId,
  asBookingId,
  asRescheduleRequestId,
} from '../pet-os/kernel/ids';

type ConsoleTab = 'discover' | 'book' | 'owner' | 'provider' | 'series' | 'contracts' | 'tests';

export const Sprint11BookingConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('discover');
  const [refreshKey, setRefreshKey] = useState(0);

  // Discovery Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [speciesFilter, setSpeciesFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Booking Flow State
  const [selectedOffering, setSelectedOffering] = useState<ServiceDiscoveryResult | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<string>('pet-kibo-001'); // Kibo default
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [pickupNotes, setPickupNotes] = useState('Front garden gate. Please use harness in foyer.');
  const [emergencyPhone, setEmergencyPhone] = useState('+254700000001');
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Provider Inbox Persona State
  const [activeProviderPersona, setActiveProviderPersona] = useState<string>(SEED_PROVIDERS.SARAH_MWANGI); // Sarah Mwangi default
  const [declineReason, setDeclineReason] = useState<'CAPACITY' | 'UNAVAILABLE' | 'SERVICE_MISMATCH'>('CAPACITY');

  // Reschedule Modal State
  const [reschedulingBooking, setReschedulingBooking] = useState<OwnerBookingProjection | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Personal schedule conflict');

  // Cancellation Modal State
  const [cancellingBooking, setCancellingBooking] = useState<OwnerBookingProjection | null>(null);
  const [cancelReason, setCancelReason] = useState('Family travel change');

  // Automated Tests State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testSuiteSelection, setTestSuiteSelection] = useState<'sprint11' | 'unified' | 'all'>('all');
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Service Instance
  const service = useMemo(() => {
    return new BookingPlatformService();
  }, []);

  // Initialize Baseline Seeds
  useEffect(() => {
    seedBookingData();
    setRefreshKey(k => k + 1);
  }, []);

  const triggerRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  const handleResetData = () => {
    seedBookingData();
    setBookingSuccessMsg('Baseline booking & availability state restored.');
    setBookingErrorMsg(null);
    triggerRefresh();
  };

  // -------------------------------------------------------------------------
  // Computed Data
  // -------------------------------------------------------------------------

  // Discovery Results
  const discoveryResults = useMemo(() => {
    const queryParams: any = {};
    if (categoryFilter !== 'ALL') {
      queryParams.serviceCategory = categoryFilter as ProviderCategory;
    }
    if (speciesFilter !== 'ALL') {
      queryParams.targetSpecies = speciesFilter;
    }
    let res = service.discoverServices(queryParams);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(r =>
        r.serviceTitle.toLowerCase().includes(q) ||
        r.providerDisplayName.toLowerCase().includes(q) ||
        r.serviceDescription.toLowerCase().includes(q)
      );
    }
    return res;
  }, [service, categoryFilter, speciesFilter, searchQuery, refreshKey]);

  // Available Pets
  const pets = useMemo(() => {
    const hhId = asHouseholdId('hh-01955000-0001-7000-8000-000000000001');
    return PetStore.listPetsByHousehold(hhId);
  }, [refreshKey]);

  // Pet Eligibility for Selected Offering
  const petEligibility: PetEligibilityResult | null = useMemo(() => {
    if (!selectedOffering || !selectedPetId) return null;
    try {
      return service.evaluatePetEligibility(asPetId(selectedPetId), selectedOffering.serviceOfferingId);
    } catch {
      return null;
    }
  }, [service, selectedOffering, selectedPetId, refreshKey]);

  // Calculated Availability Slots
  const availableSlots: AvailabilitySlot[] = useMemo(() => {
    if (!selectedOffering || !selectedDate) return [];
    return service.calculateAvailabilitySlots({
      providerId: selectedOffering.providerId,
      serviceOfferingId: selectedOffering.serviceOfferingId,
      date: selectedDate,
    });
  }, [service, selectedOffering, selectedDate, refreshKey]);

  // Owner Bookings
  const ownerBookings = useMemo(() => {
    const ownerUserId = SEED_USERS.OWNER_ELENA;
    return service.getOwnerBookingProjections(ownerUserId);
  }, [service, refreshKey]);

  // Provider Bookings (Inbox & Calendar)
  const providerBookings = useMemo(() => {
    return service.getProviderBookingProjections(asProviderId(activeProviderPersona));
  }, [service, activeProviderPersona, refreshKey]);

  // Recurring Series
  const recurringSeriesList = useMemo(() => {
    const ownerUserId = SEED_USERS.OWNER_ELENA;
    return BookingStore.getInstance().listRecurringSeriesByOwner(ownerUserId);
  }, [refreshKey]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSelectOfferingToBook = (offering: ServiceDiscoveryResult) => {
    setSelectedOffering(offering);
    setSelectedSlot(null);
    setBookingSuccessMsg(null);
    setBookingErrorMsg(null);
    setActiveTab('book');
  };

  const handleConfirmBooking = () => {
    if (!selectedOffering || !selectedSlot) {
      setBookingErrorMsg('Please select an available appointment slot.');
      return;
    }

    try {
      setBookingErrorMsg(null);
      const booking = service.createBooking({
        ownerUserId: SEED_USERS.OWNER_ELENA,
        householdId: asHouseholdId('hh-01955000-0001-7000-8000-000000000001'),
        providerId: selectedOffering.providerId,
        serviceOfferingId: selectedOffering.serviceOfferingId,
        petIds: [asPetId(selectedPetId)],
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
        instructions: {
          pickupLocationNotes: pickupNotes,
          emergencyContactPhone: emergencyPhone,
          emergencyContactName: 'Elena Vance',
        },
        idempotencyKey: `idemp-ui-${Date.now()}`,
      });

      if (booking.status === 'CONFIRMED') {
        setBookingSuccessMsg(
          `Service instantly confirmed! Booking ID: ${booking.bookingId}. Minimum-necessary pet access grant generated.`
        );
      } else {
        setBookingSuccessMsg(
          `Booking requested! Booking ID: ${booking.bookingId}. Awaiting provider approval within 24h.`
        );
      }

      setSelectedSlot(null);
      triggerRefresh();
    } catch (err: any) {
      setBookingErrorMsg(err.message || 'Failed to complete booking.');
    }
  };

  const handleProviderAccept = (bookingId: string) => {
    try {
      const activeProvider = ProviderStore.getInstance().getProvider(asProviderId(activeProviderPersona));
      if (!activeProvider) return;

      service.providerAcceptBooking({
        bookingId: asBookingId(bookingId),
        providerUserId: activeProvider.userId,
      });

      setBookingSuccessMsg(`Booking ${bookingId} confirmed & scheduled on calendar.`);
      triggerRefresh();
    } catch (err: any) {
      setBookingErrorMsg(err.message || 'Failed to accept booking.');
    }
  };

  const handleProviderDecline = (bookingId: string) => {
    try {
      const activeProvider = ProviderStore.getInstance().getProvider(asProviderId(activeProviderPersona));
      if (!activeProvider) return;

      service.providerDeclineBooking({
        bookingId: asBookingId(bookingId),
        providerUserId: activeProvider.userId,
        reasonCode: declineReason,
      });

      setBookingSuccessMsg(`Booking ${bookingId} declined (${declineReason}). Capacity released.`);
      triggerRefresh();
    } catch (err: any) {
      setBookingErrorMsg(err.message || 'Failed to decline booking.');
    }
  };

  const handleCancelOwnerBooking = () => {
    if (!cancellingBooking) return;
    try {
      service.cancelBookingByOwner({
        bookingId: cancellingBooking.bookingId,
        ownerUserId: SEED_USERS.OWNER_ELENA,
        reason: cancelReason,
      });

      setBookingSuccessMsg(`Booking ${cancellingBooking.bookingId} cancelled. Slot capacity released.`);
      setCancellingBooking(null);
      triggerRefresh();
    } catch (err: any) {
      setBookingErrorMsg(err.message || 'Failed to cancel booking.');
    }
  };

  const handleRescheduleOwnerBooking = () => {
    if (!reschedulingBooking || !rescheduleDate) return;
    try {
      const newStart = `${rescheduleDate}T09:00:00.000Z`;
      const newEnd = `${rescheduleDate}T09:45:00.000Z`;

      const req = service.requestReschedule({
        bookingId: reschedulingBooking.bookingId,
        actorUserId: SEED_USERS.OWNER_ELENA,
        actorType: 'OWNER',
        newStartAt: newStart,
        newEndAt: newEnd,
        reason: rescheduleReason,
      });

      setBookingSuccessMsg(
        `Reschedule requested for ${new Date(newStart).toLocaleDateString()}. Request ID: ${req.requestId}.`
      );
      setReschedulingBooking(null);
      triggerRefresh();
    } catch (err: any) {
      setBookingErrorMsg(err.message || 'Failed to request reschedule.');
    }
  };

  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    try {
      const combined: TestResult[] = [];
      if (testSuiteSelection === 'sprint11' || testSuiteSelection === 'all') {
        const suite = new Sprint11TestSuite();
        const results = await suite.runAllTests();
        combined.push(...results);
      }
      if (testSuiteSelection === 'unified' || testSuiteSelection === 'all') {
        const unified = await UnifiedWorkflowTestSuite.runAllTests();
        const mapped: TestResult[] = unified.results.map(r => ({
          id: r.id,
          name: r.name,
          category: `INTEGRATION_${r.category}` as any,
          passed: r.passed,
          durationMs: r.durationMs,
          error: r.message,
        }));
        combined.push(...mapped);
      }
      setTestResults(combined);
    } finally {
      setIsRunningTests(false);
      triggerRefresh();
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Sprint 11 Engine
              </span>
              <span className="text-xs text-[#64748B] font-mono">Marketplace &amp; Booking Architecture</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Service Discovery, Availability &amp; Booking Engine
            </h1>
            <p className="text-sm text-[#94A3B8] max-w-2xl mt-1">
              Deterministic availability calculation, atomic reservation holds, minimum-necessary pet access grants, address masking, and immutable commercial snapshots.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="reset-seed-btn"
              onClick={handleResetData}
              className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2D3748] text-xs font-semibold text-[#E2E8F0] flex items-center gap-2 transition-all cursor-pointer border border-[#334155]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset State
            </button>
            <button
              id="run-tests-banner-btn"
              onClick={() => {
                setActiveTab('tests');
                handleRunAllTests();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Verify 22 Tests
            </button>
          </div>
        </div>

        {/* Global Feedback Messages */}
        {bookingSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{bookingSuccessMsg}</span>
            </div>
            <button
              onClick={() => setBookingSuccessMsg(null)}
              className="text-emerald-400 hover:text-white font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {bookingErrorMsg && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{bookingErrorMsg}</span>
            </div>
            <button
              onClick={() => setBookingErrorMsg(null)}
              className="text-rose-400 hover:text-white font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 overflow-x-auto">
        <button
          id="nav-tab-discover"
          onClick={() => setActiveTab('discover')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'discover'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Find Services</span>
        </button>

        <button
          id="nav-tab-book"
          onClick={() => setActiveTab('book')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'book'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          <span>Book &amp; Slot Selector</span>
          {selectedOffering && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          id="nav-tab-owner"
          onClick={() => setActiveTab('owner')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'owner'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>My Appointments</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#334155] text-[10px] text-white">
            {ownerBookings.length}
          </span>
        </button>

        <button
          id="nav-tab-provider"
          onClick={() => setActiveTab('provider')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'provider'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Provider Inbox &amp; Schedule</span>
          {providerBookings.some(b => b.status === 'PENDING_PROVIDER') && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          )}
        </button>

        <button
          id="nav-tab-series"
          onClick={() => setActiveTab('series')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'series'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Recurring Series</span>
        </button>

        <button
          id="nav-tab-contracts"
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'contracts'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Future Handoffs</span>
        </button>

        <button
          id="nav-tab-tests"
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'tests'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Test Suite (22)</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: DISCOVER SERVICES                                           */}
      {/* =================================================================== */}
      {activeTab === 'discover' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search offering or provider..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-[#0B0D10] p-1 rounded-xl border border-[#1E293B]">
                {['ALL', 'DOG_WALKER', 'VETERINARIAN', 'TRAINER', 'GROOMER'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Services' : cat.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Species Filter */}
              <div className="flex items-center gap-1 bg-[#0B0D10] p-1 rounded-xl border border-[#1E293B]">
                {['ALL', 'DOG', 'CAT'].map(sp => (
                  <button
                    key={sp}
                    onClick={() => setSpeciesFilter(sp)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      speciesFilter === sp
                        ? 'bg-indigo-600 text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {sp === 'ALL' ? 'All Pets' : sp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Offerings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {discoveryResults.map(offering => {
              const formattedPrice = (offering.displayedPriceMinorUnits / 100).toLocaleString('en-KE', {
                style: 'currency',
                currency: offering.currency,
              });

              return (
                <div
                  key={offering.serviceOfferingId}
                  className="bg-[#13151A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-md"
                >
                  <div className="space-y-4">
                    {/* Header: Provider & Badge */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800/40 flex items-center justify-center font-bold text-indigo-400 text-sm">
                          {offering.providerDisplayName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-white">{offering.providerDisplayName}</h4>
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                          </div>
                          <p className="text-xs text-[#94A3B8]">{offering.providerProfessionalTitle || offering.providerCategory}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[10px] font-mono text-[#94A3B8]">
                        {offering.publicCity}
                      </span>
                    </div>

                    {/* Offering Title & Description */}
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {offering.serviceTitle}
                      </h3>
                      <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1">
                        {offering.serviceDescription}
                      </p>
                    </div>

                    {/* Attributes Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1E293B] text-[#E2E8F0] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#94A3B8]" />
                        {offering.durationMinutes} min
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1E293B] text-[#E2E8F0]">
                        {offering.targetSpecies.join(', ')}
                      </span>
                      {offering.confirmationMode === 'INSTANT_CONFIRM' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Instant Book
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Approval Required
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price & Book Action Footer */}
                  <div className="mt-5 pt-4 border-t border-[#1E293B] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B]">Price</span>
                      <p className="text-base font-extrabold text-white font-mono">{formattedPrice}</p>
                    </div>

                    <button
                      id={`book-offering-btn-${offering.serviceOfferingId}`}
                      onClick={() => handleSelectOfferingToBook(offering)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                    >
                      <span>Select &amp; Book</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BOOK SERVICE & DETERMINISTIC SLOT SELECTOR                  */}
      {/* =================================================================== */}
      {activeTab === 'book' && (
        <div className="space-y-6">
          {!selectedOffering ? (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-12 text-center space-y-4">
              <Calendar className="w-12 h-12 text-[#64748B] mx-auto" />
              <h3 className="text-lg font-bold text-white">No Service Selected</h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                Please browse verified offerings in the &quot;Find Services&quot; directory and select one to configure availability and booking options.
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
              >
                Browse Service Directory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Service Snapshot & Pet Prerequisite Check */}
              <div className="lg:col-span-1 space-y-6">
                {/* Offering Snapshot Card */}
                <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                      Selected Service
                    </span>
                    <button
                      onClick={() => setSelectedOffering(null)}
                      className="text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedOffering.serviceTitle}</h3>
                    <p className="text-xs text-[#94A3B8] mt-1">{selectedOffering.providerDisplayName} · {selectedOffering.publicCity}</p>
                  </div>

                  <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">Duration:</span>
                      <span className="font-semibold text-white">{selectedOffering.durationMinutes} minutes</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">Confirmation:</span>
                      <span className="font-semibold text-white">
                        {selectedOffering.confirmationMode === 'INSTANT_CONFIRM' ? 'Instant Book' : 'Provider Approval'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#94A3B8]">Base Price:</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {(selectedOffering.displayedPriceMinorUnits / 100).toLocaleString('en-KE', {
                          style: 'currency',
                          currency: selectedOffering.currency,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 1: Pet Selection & Real-Time Eligibility */}
                <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Step 1: Select Household Pet
                  </h4>

                  <div className="space-y-2">
                    {pets.map(pet => {
                      const isSelected = pet.petId === selectedPetId;
                      return (
                        <div
                          key={pet.petId}
                          onClick={() => setSelectedPetId(pet.petId)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-950/40 border-indigo-600 text-white'
                              : 'bg-[#0B0D10] border-[#1E293B] text-[#94A3B8] hover:border-[#334155]'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{pet.name}</p>
                            <p className="text-[10px] text-[#64748B]">{pet.species} · {pet.breed || 'Mixed'}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Prerequisite Evaluation Preview */}
                  {petEligibility && (
                    <div className="mt-3 p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Eligibility Check</span>
                        {petEligibility.isEligible ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ELIGIBLE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            INELIGIBLE
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#94A3B8]">Species Compatible</span>
                          {petEligibility.speciesSupported ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                        </div>
                        {petEligibility.prerequisites.map(prereq => (
                          <div key={prereq.code} className="flex items-center justify-between text-[11px]">
                            <span className="text-[#94A3B8]">{prereq.title}</span>
                            <span className="text-[10px] font-mono font-semibold text-emerald-400">
                              {prereq.state === 'REQUIREMENT_SATISFIED' ? 'SATISFIED' : 'PENDING'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Center & Right Columns: Date Picker, Slots & Instructions */}
              <div className="lg:col-span-2 space-y-6">
                {/* Step 2: Date & Slot Selection */}
                <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                      Step 2: Choose Service Date &amp; Slot
                    </h4>
                    <span className="text-[10px] text-[#64748B]">Server-calculated availability</span>
                  </div>

                  {/* Date Input */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-[#94A3B8] font-semibold">Service Date:</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => {
                        setSelectedDate(e.target.value);
                        setSelectedSlot(null);
                      }}
                      className="bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Slots Grid */}
                  <div className="pt-2">
                    {availableSlots.length === 0 ? (
                      <div className="p-6 text-center bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-1">
                        <Clock className="w-6 h-6 text-[#64748B] mx-auto" />
                        <p className="text-xs font-semibold text-[#94A3B8]">No Slots Available on {selectedDate}</p>
                        <p className="text-[10px] text-[#64748B]">The provider may be off-duty, fully booked, or on scheduled holiday.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {availableSlots.map(slot => {
                          const isSelected = selectedSlot?.startAt === slot.startAt;
                          const startTimeStr = new Date(slot.startAt).toLocaleTimeString('en-KE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });

                          return (
                            <button
                              key={slot.slotId}
                              disabled={!slot.isReservable}
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                !slot.isReservable
                                  ? 'opacity-40 bg-[#0B0D10] border-[#1E293B] cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                                  : 'bg-[#0B0D10] border-[#1E293B] hover:border-[#334155] text-[#E2E8F0]'
                              }`}
                            >
                              <p className="text-xs font-extrabold">{startTimeStr}</p>
                              <p className="text-[10px] mt-0.5 opacity-80">
                                {slot.availableCapacity}/{slot.totalCapacity} spots left
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Instructions & Emergency Contact */}
                <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Step 3: Handoff Instructions &amp; Emergency Info
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-[#94A3B8] uppercase">Pickup / Entry Notes</label>
                      <input
                        type="text"
                        value={pickupNotes}
                        onChange={e => setPickupNotes(e.target.value)}
                        className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        placeholder="e.g. Gate code, lockbox notes"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#94A3B8] uppercase">Emergency Contact Phone</label>
                      <input
                        type="text"
                        value={emergencyPhone}
                        onChange={e => setEmergencyPhone(e.target.value)}
                        className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        placeholder="+2547..."
                      />
                    </div>
                  </div>

                  {/* Address Privacy Notice */}
                  <div className="p-3 bg-[#0B0D10] border border-blue-900/30 rounded-xl flex items-center gap-2.5 text-xs text-blue-300">
                    <Lock className="w-4 h-4 shrink-0 text-blue-400" />
                    <span>
                      <strong>Address Privacy Protection:</strong> Exact street address is masked until booking is confirmed and within 48h of service time.
                    </span>
                  </div>
                </div>

                {/* Step 4: Submission & Commercial Snapshots */}
                <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#64748B]">Total Amount (Snapshotted)</span>
                    <p className="text-xl font-black text-white font-mono">
                      {(selectedOffering.displayedPriceMinorUnits / 100).toLocaleString('en-KE', {
                        style: 'currency',
                        currency: selectedOffering.currency,
                      })}
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">
                      Cancellation policy: Standard (Free cancel up to 24h prior)
                    </p>
                  </div>

                  <button
                    id="submit-booking-btn"
                    disabled={!selectedSlot || !petEligibility?.isEligible}
                    onClick={handleConfirmBooking}
                    className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                      !selectedSlot || !petEligibility?.isEligible
                        ? 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {selectedOffering.confirmationMode === 'INSTANT_CONFIRM'
                        ? 'Confirm Instant Booking'
                        : 'Submit Request to Provider'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: OWNER APPOINTMENTS ("MY BOOKINGS")                          */}
      {/* =================================================================== */}
      {activeTab === 'owner' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Household Bookings &amp; Reservations</h3>
            <span className="text-xs text-[#94A3B8] font-mono">Owner Persona: Elena Vance</span>
          </div>

          <div className="space-y-4">
            {ownerBookings.map(bkg => {
              const startDate = new Date(bkg.startAt).toLocaleString('en-KE', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

              return (
                <div
                  key={bkg.bookingId}
                  className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">{bkg.serviceTitle}</span>
                      <span className="text-xs text-[#94A3B8]">with {bkg.providerName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          bkg.status === 'CONFIRMED'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : bkg.status === 'PENDING_PROVIDER'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : bkg.status === 'RESCHEDULE_PENDING'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-[#1E293B] text-[#94A3B8] border-[#334155]'
                        }`}
                      >
                        {bkg.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono text-indigo-400 font-bold">{bkg.totalPriceFormatted}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-[#64748B] block font-bold uppercase text-[10px]">Date &amp; Time</span>
                      <p className="font-semibold text-white mt-0.5">{startDate}</p>
                      <p className="text-[11px] text-[#94A3B8]">{bkg.durationMinutes} min appointment</p>
                    </div>

                    <div>
                      <span className="text-[#64748B] block font-bold uppercase text-[10px]">Service Address</span>
                      <p className="font-semibold text-white mt-0.5">{bkg.addressDisplay}</p>
                    </div>

                    <div>
                      <span className="text-[#64748B] block font-bold uppercase text-[10px]">Pets Included</span>
                      <p className="font-semibold text-white mt-0.5">{bkg.petNames.join(', ')}</p>
                      <p className="text-[11px] text-[#94A3B8]">{bkg.instructionsSummary}</p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                    <span className="text-[10px] text-[#64748B] font-mono">ID: {bkg.bookingId}</span>

                    <div className="flex items-center gap-2">
                      {bkg.canReschedule && (
                        <button
                          onClick={() => {
                            setReschedulingBooking(bkg);
                            setRescheduleDate(new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0]);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2D3748] text-xs font-semibold text-[#E2E8F0] cursor-pointer"
                        >
                          Reschedule
                        </button>
                      )}
                      {bkg.canCancel && (
                        <button
                          onClick={() => setCancellingBooking(bkg)}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-semibold text-rose-300 cursor-pointer"
                        >
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: PROVIDER INBOX & CALENDAR SCHEDULE                           */}
      {/* =================================================================== */}
      {activeTab === 'provider' && (
        <div className="space-y-6">
          {/* Provider Persona Selector */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
                Viewing Provider Workspace:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveProviderPersona(SEED_PROVIDERS.SARAH_MWANGI)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeProviderPersona === SEED_PROVIDERS.SARAH_MWANGI
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#0B0D10] text-[#94A3B8] border border-[#1E293B]'
                  }`}
                >
                  Sarah Mwangi (Dog Walker)
                </button>
                <button
                  onClick={() => setActiveProviderPersona(SEED_PROVIDERS.DR_KIMANI)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeProviderPersona === SEED_PROVIDERS.DR_KIMANI
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#0B0D10] text-[#94A3B8] border border-[#1E293B]'
                  }`}
                >
                  Dr. David Kimani (Veterinarian)
                </button>
              </div>
            </div>
            <span className="text-xs font-mono text-[#64748B]">Zero Self-Approval Enforced</span>
          </div>

          {/* Pending Approval Requests */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Pending Service Requests</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20 font-mono">
                {providerBookings.filter(b => b.status === 'PENDING_PROVIDER').length}
              </span>
            </h4>

            {providerBookings.filter(b => b.status === 'PENDING_PROVIDER').length === 0 ? (
              <div className="p-6 bg-[#13151A] border border-[#1E293B] rounded-2xl text-center text-xs text-[#94A3B8]">
                No pending requests awaiting approval for this provider.
              </div>
            ) : (
              providerBookings
                .filter(b => b.status === 'PENDING_PROVIDER')
                .map(req => {
                  return (
                    <div
                      key={req.bookingId}
                      className="bg-[#13151A] border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white">{req.serviceTitle}</h4>
                          <p className="text-xs text-[#94A3B8]">Requested by {req.ownerDisplayName}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
                          Pending Approval (Expires in 24h)
                        </span>
                      </div>

                      {/* Minimum Necessary Pet Summary (No full medical records!) */}
                      <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-2">
                        <span className="text-[10px] uppercase font-bold text-[#64748B]">
                          Pet Summary (Minimum Necessary Scope)
                        </span>
                        <div className="flex flex-wrap gap-4 text-xs">
                          {req.pets.map(p => (
                            <div key={p.name} className="flex items-center gap-2">
                              <span className="font-bold text-white">{p.name}</span>
                              <span className="text-[#94A3B8]">({p.species} · {p.breed || 'Standard'})</span>
                              {p.alerts && p.alerts.length > 0 && (
                                <span className="text-amber-400 text-[10px] font-semibold">Alerts: {p.alerts.join(', ')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Schedule & Notes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[#64748B] block font-bold uppercase text-[10px]">Requested Slot</span>
                          <p className="font-semibold text-white mt-0.5">
                            {new Date(req.startAt).toLocaleString('en-KE')} ({req.durationMinutes} min)
                          </p>
                        </div>
                        <div>
                          <span className="text-[#64748B] block font-bold uppercase text-[10px]">Handoff Instructions</span>
                          <p className="font-semibold text-white mt-0.5">
                            {req.instructions.pickupLocationNotes || 'Standard entrance'}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between">
                        <span className="text-xs font-mono text-indigo-400 font-bold">{req.totalPriceFormatted}</span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleProviderDecline(req.bookingId)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#1E293B] hover:bg-[#2D3748] text-xs font-semibold text-rose-300 border border-rose-900/30 cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleProviderAccept(req.bookingId)}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md shadow-emerald-600/30 cursor-pointer"
                          >
                            Accept &amp; Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Confirmed Schedule Calendar */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white">Confirmed Schedule &amp; Calendar Blocks</h4>

            <div className="space-y-3">
              {providerBookings
                .filter(b => b.status === 'CONFIRMED' || b.status === 'RESCHEDULE_PENDING')
                .map(block => (
                  <div
                    key={block.bookingId}
                    className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{block.serviceTitle}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          CONFIRMED
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        Client: {block.ownerDisplayName} · Pets: {block.pets.map(p => p.name).join(', ')}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Address: {block.destinationAddress}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-white font-mono">
                        {new Date(block.startAt).toLocaleString('en-KE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[10px] text-[#64748B]">{block.durationMinutes} min</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: RECURRING BOOKING SERIES                                    */}
      {/* =================================================================== */}
      {activeTab === 'series' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Recurring Service Series</h3>
              <p className="text-xs text-[#94A3B8]">
                Bounded-horizon weekly schedule generation with non-blocking provider conflict detection.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {recurringSeriesList.map(series => {
              const occurrences = BookingStore.getInstance().getOccurrences(series.seriesId);

              return (
                <div
                  key={series.seriesId}
                  className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-white">Weekly Recurring Dog Walk (Kibo)</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20 font-bold">
                        ACTIVE
                      </span>
                    </div>

                    <span className="text-xs text-[#94A3B8]">Horizon: {series.horizonWeeks} weeks</span>
                  </div>

                  {/* Future Generated Occurrences */}
                  <div>
                    <h5 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-2">
                      Generated Occurrences
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {occurrences.map(occ => (
                        <div
                          key={occ.occurrenceIndex}
                          className={`p-3 rounded-xl border ${
                            occ.status === 'REQUIRES_ATTENTION'
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-[#0B0D10] border-[#1E293B] text-[#E2E8F0]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{occ.scheduledDate}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                occ.status === 'BOOKED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {occ.status}
                            </span>
                          </div>
                          {occ.conflictReason && (
                            <p className="text-[10px] text-amber-400/90 mt-1">
                              {occ.conflictReason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: FUTURE INTEGRATION CONTRACTS (READ-ONLY INSPECTORS)         */}
      {/* =================================================================== */}
      {activeTab === 'contracts' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Bounded Context Integration Contracts</h3>
            <p className="text-xs text-[#94A3B8]">
              Sprint 11 provides read-only projections and immutable event payloads for upcoming Sprint 12 (Payments), Sprint 13 (Dog Walking execution), and Sprint 14 (Workspaces).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Future Payments Contract */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <DollarSign className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Future Payments Contract</h4>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Provides immutable price snapshots in integer minor units, fee basis references, and cancellation policy tiers without executing financial transactions.
              </p>
              <div className="p-3 bg-[#0B0D10] rounded-xl font-mono text-[11px] text-[#94A3B8] space-y-1">
                <p>contractVersion: &quot;1.0&quot;</p>
                <p>currency: &quot;KES&quot;</p>
                <p>amountMinorUnits: 250000</p>
                <p>feeBasisReference: &quot;PRC-REF-01955002...&quot;</p>
                <p>policyTier: &quot;STANDARD&quot;</p>
              </div>
            </div>

            {/* Future Dog Walking Contract */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CalendarDays className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Future Dog Walking Contract</h4>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Supplies confirmed booking handoff, walker access grant ID, emergency contacts, and leash instructions without exposing full medical histories.
              </p>
              <div className="p-3 bg-[#0B0D10] rounded-xl font-mono text-[11px] text-[#94A3B8] space-y-1">
                <p>contractVersion: &quot;1.0&quot;</p>
                <p>bookingStatus: &quot;CONFIRMED&quot;</p>
                <p>authorizedScopes: [&quot;PET_IDENTITY_SUMMARY&quot;, &quot;SERVICE_INSTRUCTIONS&quot;]</p>
                <p>pickupHandoffNotes: &quot;Front gate&quot;</p>
              </div>
            </div>

            {/* Future Workspace Contract */}
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Briefcase className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">Future Workspace Contract</h4>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Prepares clinical and trainer queues with prerequisite satisfaction states, appointment duration, and scheduling metadata.
              </p>
              <div className="p-3 bg-[#0B0D10] rounded-xl font-mono text-[11px] text-[#94A3B8] space-y-1">
                <p>contractVersion: &quot;1.0&quot;</p>
                <p>workspaceType: &quot;VETERINARY&quot;</p>
                <p>prerequisiteStates: &#123; VACCINATION: &quot;SATISFIED&quot; &#125;</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 7: AUTOMATED VERIFICATION SUITE                                */}
      {/* =================================================================== */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Pet OS Automated Verification Suites</h3>
              <p className="text-xs text-[#94A3B8]">
                Execute isolated Sprint 11 marketplace engine tests or end-to-end unified cross-domain workflows across all 11 sprints.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#0B0D10] p-1 rounded-xl border border-[#1E293B] text-xs">
                <button
                  onClick={() => setTestSuiteSelection('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    testSuiteSelection === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  All (33 Tests)
                </button>
                <button
                  onClick={() => setTestSuiteSelection('unified')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    testSuiteSelection === 'unified'
                      ? 'bg-emerald-600 text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Cross-Domain (11 Tests)
                </button>
                <button
                  onClick={() => setTestSuiteSelection('sprint11')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    testSuiteSelection === 'sprint11'
                      ? 'bg-indigo-600 text-white'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Sprint 11 (22 Tests)
                </button>
              </div>

              <button
                id="run-all-tests-btn"
                disabled={isRunningTests}
                onClick={handleRunAllTests}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {isRunningTests
                    ? 'Executing Tests...'
                    : testSuiteSelection === 'all'
                    ? 'Run All 33 Tests'
                    : testSuiteSelection === 'unified'
                    ? 'Run 11 Cross-Domain Tests'
                    : 'Run 22 Sprint 11 Tests'}
                </span>
              </button>
            </div>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <div className="p-3 bg-[#13151A] border border-[#1E293B] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Results:</span>
                  <span className="text-emerald-400 font-bold">
                    {testResults.filter(t => t.passed).length} Passed
                  </span>
                  <span className="text-rose-400 font-bold">
                    {testResults.filter(t => !t.passed).length} Failed
                  </span>
                </div>
                <span className="text-[#64748B] font-mono">
                  Total runtime: {testResults.reduce((acc, t) => acc + t.durationMs, 0)}ms
                </span>
              </div>

              <div className="space-y-1.5">
                {testResults.map(t => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-4 ${
                      t.passed
                        ? 'bg-[#13151A] border-[#1E293B] text-[#E2E8F0]'
                        : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {t.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        {t.message && <p className="text-[11px] text-rose-400 font-mono mt-0.5">{t.message}</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#64748B] font-mono shrink-0">{t.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RESCHEDULE APPOINTMENT                                       */}
      {/* =================================================================== */}
      {reschedulingBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Reschedule Service</h3>
            <p className="text-xs text-[#94A3B8]">
              Rescheduling {reschedulingBooking.serviceTitle}. Previous schedule will be retained if request is declined.
            </p>

            <div>
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase">Proposed New Date</label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase">Reason for Rescheduling</label>
              <input
                type="text"
                value={rescheduleReason}
                onChange={e => setRescheduleReason(e.target.value)}
                className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setReschedulingBooking(null)}
                className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2D3748] text-xs font-semibold text-[#E2E8F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleOwnerBooking}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
              >
                Submit Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: CANCEL APPOINTMENT                                           */}
      {/* =================================================================== */}
      {cancellingBooking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Cancel Service Appointment</h3>
            <p className="text-xs text-[#94A3B8]">
              {cancellingBooking.cancellationPolicySummary}
            </p>

            <div>
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase">Reason for Cancellation</label>
              <input
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full mt-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setCancellingBooking(null)}
                className="px-4 py-2 rounded-xl bg-[#1E293B] hover:bg-[#2D3748] text-xs font-semibold text-[#E2E8F0] cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelOwnerBooking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
