/**
 * Pet OS Sprint 10 - Service Provider Platform, Professional Identity,
 * Verification Workflows, Service Catalogue & Trust Foundation Console
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  FileCheck,
  Search,
  Filter,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  User,
  Plus,
  ArrowRight,
  Info,
  Calendar,
  DollarSign,
  Award,
  ChevronRight,
  XCircle,
  FileText,
  AlertOctagon,
  Layers,
  Check,
  Phone,
  Mail,
  Globe,
  Tag,
} from 'lucide-react';
import {
  ProviderPlatformService,
  ProviderStore,
  seedProviderData,
  SEED_PROVIDERS,
  SEED_USERS,
  SEED_BUSINESSES,
  Sprint10TestSuite,
  TestResult,
  PublicProviderProfile,
  PrivateProviderDashboard,
  ProviderCategory,
  ProviderProfile,
  ProviderCredential,
  ServiceOffering,
  VerificationCase,
  CATEGORY_VERIFICATION_RULES,
  STANDARD_SERVICE_TAXONOMY,
} from '../pet-os/provider';
import { UserId, ProviderId, asProviderId, asCredentialId } from '../pet-os/kernel/ids';

type ActiveViewTab =
  | 'directory'
  | 'workspace'
  | 'credentials'
  | 'catalogue'
  | 'locations'
  | 'schedule'
  | 'admin_queue'
  | 'tests';

export const Sprint10ProviderConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('directory');
  const [store] = useState(() => ProviderStore.getInstance());
  const [service] = useState(() => new ProviderPlatformService(store));

  // Current logged in actor
  const [actorRole, setActorRole] = useState<'PROVIDER' | 'ADMIN' | 'OWNER'>('PROVIDER');
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(SEED_PROVIDERS.DR_KIMANI);

  // Directory filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<PublicProviderProfile | null>(null);

  // Test state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Version counter to trigger re-renders on state mutations
  const [version, setVersion] = useState(0);
  const bumpVersion = () => setVersion(v => v + 1);

  // Initialize seed data on initial mount
  useEffect(() => {
    seedProviderData(store);
    bumpVersion();
  }, [store]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Directory profiles
  const discoverableProviders = useMemo(() => {
    // Read all providers and filter by public listability
    const list = store.listProviders();
    const publicProfiles: PublicProviderProfile[] = [];
    for (const p of list) {
      const pub = service.getPublicProviderProfile(p.providerId);
      if (pub && pub.verificationStatus === 'VERIFIED' && p.operationalStatus === 'ACTIVE' && p.visibilityStatus === 'PUBLIC') {
        publicProfiles.push(pub);
      }
    }
    return publicProfiles;
  }, [store, service, version]);

  const filteredDirectory = useMemo(() => {
    return discoverableProviders.filter(p => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.displayName.toLowerCase().includes(q);
        const matchesTitle = (p.professionalTitle || '').toLowerCase().includes(q);
        const matchesBio = p.bio.toLowerCase().includes(q);
        const matchesService = p.activeOfferings.some(o => o.title.toLowerCase().includes(q));
        if (!matchesName && !matchesTitle && !matchesBio && !matchesService) return false;
      }
      return true;
    });
  }, [discoverableProviders, categoryFilter, searchQuery]);

  // Private Dashboard for currently selected provider
  const currentDashboard = useMemo<PrivateProviderDashboard | null>(() => {
    try {
      const p = store.getProvider(selectedProviderId);
      if (!p) return null;
      return service.getPrivateProviderDashboard(selectedProviderId, p.userId);
    } catch {
      return null;
    }
  }, [store, service, selectedProviderId, version]);

  // Run Test Suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const runner = new Sprint10TestSuite();
      const results = await runner.runAllTests();
      setTestResults(results);
      bumpVersion();
      showToast(`Completed test suite: ${results.filter(r => r.passed).length}/${results.length} passed`, 'success');
    } catch (err: any) {
      showToast(`Test suite execution failed: ${err.message}`, 'error');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Reset database state
  const handleResetData = () => {
    store.reset();
    seedProviderData(store);
    bumpVersion();
    showToast('Platform store reset to pristine seed state', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Context Switcher */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-full uppercase tracking-wider">
                Sprint 10
              </span>
              <span className="text-[#64748B] text-xs font-mono">Volume XII &amp; XIV Architecture</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] tracking-tight mt-2 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-400" />
              Pet Services Provider Platform &amp; Trust Foundation
            </h1>
            <p className="text-[#94A3B8] text-sm mt-1 max-w-3xl">
              Professional identity, business organization, category-specific credential verification,
              structured service catalogue with integer pricing, and strict public/private read model segregation.
            </p>
          </div>

          {/* Actor / Provider Profile Switcher */}
          <div className="flex flex-wrap items-center gap-3 bg-[#0B0D10] border border-[#1E293B] p-2 rounded-xl">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#94A3B8]">
              <User className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-[#E2E8F0]">Active Provider:</span>
            </div>
            <select
              id="select-active-provider"
              value={selectedProviderId}
              onChange={e => {
                setSelectedProviderId(asProviderId(e.target.value));
                bumpVersion();
              }}
              className="bg-[#1E293B] text-[#F8FAFC] text-xs rounded-lg px-3 py-1.5 border border-[#334155] focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value={SEED_PROVIDERS.DR_KIMANI}>Dr. Amani Kimani (Veterinarian - Verified)</option>
              <option value={SEED_PROVIDERS.SARAH_MWANGI}>Sarah Mwangi (Dog Walker - Verified)</option>
              <option value={SEED_PROVIDERS.JUMA_OCHIENG}>Juma Ochieng (Canine Trainer - Verified)</option>
              <option value={SEED_PROVIDERS.JANE_DOE}>Jane Doe (Applicant - Pending Review)</option>
              <option value={SEED_PROVIDERS.KEVIN_KIPRONO}>Kevin Kiprono (Suspended - Safety Issue)</option>
            </select>

            <button
              id="btn-reset-provider-data"
              onClick={handleResetData}
              title="Reset data store to default seed"
              className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1E293B] rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-[#1E293B]/80 scrollbar-none">
          <button
            id="tab-view-directory"
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Public Marketplace</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
              {discoverableProviders.length}
            </span>
          </button>

          <button
            id="tab-view-workspace"
            onClick={() => setActiveTab('workspace')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Provider Dashboard</span>
            {currentDashboard && (
              <span
                className={`w-2 h-2 rounded-full ${
                  currentDashboard.profile.verificationStatus === 'VERIFIED'
                    ? 'bg-emerald-400'
                    : currentDashboard.profile.verificationStatus === 'SUSPENDED'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
            )}
          </button>

          <button
            id="tab-view-credentials"
            onClick={() => setActiveTab('credentials')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Credentials &amp; Verification</span>
            {currentDashboard && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#1E293B] text-[#CBD5E1] font-mono">
                {currentDashboard.credentials.length}
              </span>
            )}
          </button>

          <button
            id="tab-view-catalogue"
            onClick={() => setActiveTab('catalogue')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'catalogue'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Service Catalogue &amp; Pricing</span>
            {currentDashboard && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#1E293B] text-[#CBD5E1] font-mono">
                {currentDashboard.offerings.length}
              </span>
            )}
          </button>

          <button
            id="tab-view-locations"
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Locations &amp; Coverage Areas</span>
          </button>

          <button
            id="tab-view-schedule"
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1A1D24]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Availability &amp; Schedule</span>
          </button>

          <button
            id="tab-view-admin"
            onClick={() => setActiveTab('admin_queue')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'admin_queue'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-purple-300 hover:text-white hover:bg-purple-950/40 border border-purple-900/40'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Trust Review Desk</span>
          </button>

          <button
            id="tab-view-tests"
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40 border border-emerald-900/40'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Verification Tests</span>
            {testResults.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                {testResults.filter(t => t.passed).length}/{testResults.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border shadow-lg ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-blue-950/90 text-blue-200 border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toastMessage.type === 'error' && <AlertOctagon className="w-5 h-5 text-rose-400" />}
            {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1. PUBLIC MARKETPLACE & PROVIDER DIRECTORY                         */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#64748B]" />
              <input
                id="input-directory-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search verified professionals, specialties, services..."
                className="bg-transparent border-none text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#64748B] hover:text-[#F8FAFC]">
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <Filter className="w-4 h-4 text-[#64748B] shrink-0" />
              {[
                { id: 'ALL', label: 'All Categories' },
                { id: 'VETERINARIAN', label: 'Veterinarians' },
                { id: 'DOG_WALKER', label: 'Dog Walkers' },
                { id: 'TRAINER', label: 'Trainers & Behaviorists' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-[#0B0D10] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#1E293B]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Marketplace Grid */}
          {filteredDirectory.length === 0 ? (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-12 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[#F8FAFC]">No Verified Providers Match Criteria</h3>
              <p className="text-sm text-[#94A3B8] max-w-md mx-auto mt-1">
                Only providers with verified credentials, active operational status, and published services appear in the public marketplace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDirectory.map(profile => (
                <div
                  key={profile.providerId}
                  className="bg-[#13151A] border border-[#1E293B] hover:border-blue-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg"
                >
                  <div>
                    {/* Header: Avatar, Name & Category */}
                    <div className="flex items-start gap-4">
                      <img
                        src={profile.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                        alt={profile.displayName}
                        className="w-14 h-14 rounded-2xl object-cover border border-[#1E293B]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-[#F8FAFC] text-base group-hover:text-blue-400 transition-colors truncate">
                            {profile.displayName}
                          </h3>
                        </div>
                        <p className="text-xs text-[#94A3B8] line-clamp-1 mt-0.5">
                          {profile.professionalTitle || profile.category}
                        </p>
                        {profile.primaryBusiness && (
                          <div className="flex items-center gap-1 text-[11px] text-blue-400 mt-1">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{profile.primaryBusiness.tradingName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {profile.trustIndicators.map((t, idx) => (
                        <span
                          key={idx}
                          title={t.explanation}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>{t.title}</span>
                        </span>
                      ))}
                    </div>

                    {/* Bio excerpt */}
                    <p className="text-xs text-[#94A3B8] line-clamp-3 mt-3 leading-relaxed">
                      {profile.bio}
                    </p>

                    {/* Service Areas & Locations Preview */}
                    <div className="mt-4 pt-3 border-t border-[#1E293B] space-y-1.5 text-xs text-[#94A3B8]">
                      {profile.publicLocations.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[#CBD5E1]">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate">{profile.publicLocations[0].name} ({profile.publicLocations[0].city})</span>
                        </div>
                      )}
                      {profile.serviceAreas.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[#CBD5E1]">
                          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">Dispatches in {profile.serviceAreas.map(a => a.name).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Published Services Preview */}
                    <div className="mt-4 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                        Active Offerings ({profile.activeOfferings.length})
                      </div>
                      <div className="space-y-1.5">
                        {profile.activeOfferings.slice(0, 2).map(offering => (
                          <div
                            key={offering.serviceOfferingId}
                            className="bg-[#0B0D10] border border-[#1E293B] p-2.5 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-medium text-[#F8FAFC] block truncate">{offering.title}</span>
                              <span className="text-[10px] text-[#94A3B8]">{offering.defaultDurationMinutes} mins</span>
                            </div>
                            <span className="font-bold text-emerald-400 shrink-0">
                              KES {(offering.basePriceMinorUnits / 100).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* View Details Action */}
                  <div className="mt-5 pt-3 border-t border-[#1E293B] flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {profile.operatingHoursSummary.length} operating days
                    </span>
                    <button
                      onClick={() => setSelectedPublicProfile(profile)}
                      className="px-3 py-1.5 bg-[#1E293B] hover:bg-blue-600 text-xs font-semibold text-[#F8FAFC] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Public Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal: Public Profile View & Booking Snapshot Simulation */}
          {selectedPublicProfile && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={selectedPublicProfile.avatarUrl}
                      alt={selectedPublicProfile.displayName}
                      className="w-16 h-16 rounded-2xl object-cover border border-[#1E293B]"
                    />
                    <div>
                      <h2 className="text-xl font-bold text-[#F8FAFC]">{selectedPublicProfile.displayName}</h2>
                      <p className="text-xs text-blue-400">{selectedPublicProfile.professionalTitle}</p>
                      {selectedPublicProfile.primaryBusiness && (
                        <p className="text-xs text-[#94A3B8] mt-0.5">{selectedPublicProfile.primaryBusiness.tradingName}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPublicProfile(null)}
                    className="text-[#94A3B8] hover:text-[#F8FAFC] p-1 rounded-lg hover:bg-[#1E293B] cursor-pointer"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Privacy Badge Notice */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3 text-xs text-blue-300">
                  <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <strong>Sanitized Read Projection:</strong> Zero private residential addresses, tax identifiers, or internal review notes are exposed through this public API contract.
                  </span>
                </div>

                {/* Trust Badges */}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-[#64748B] tracking-wider mb-2">Verified Trust Credentials</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedPublicProfile.trustIndicators.map((t, idx) => (
                      <div key={idx} className="bg-[#0B0D10] border border-emerald-900/40 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.title}</span>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1">{t.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Full Offerings with Variants & Booking Contract Simulation */}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-[#64748B] tracking-wider mb-2">Service Offerings &amp; Pricing Variants</h4>
                  <div className="space-y-3">
                    {selectedPublicProfile.activeOfferings.map(offering => (
                      <div key={offering.serviceOfferingId} className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-4 text-xs space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-[#F8FAFC] text-sm">{offering.title}</span>
                            <p className="text-[#94A3B8] mt-1">{offering.description}</p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 shrink-0 ml-4">
                            KES {(offering.basePriceMinorUnits / 100).toLocaleString()}
                          </span>
                        </div>

                        {/* Variants if any */}
                        {offering.variants.length > 0 && (
                          <div className="space-y-2 border-t border-[#1E293B] pt-2">
                            <span className="text-[11px] font-semibold text-[#94A3B8]">Pricing &amp; Duration Variants:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {offering.variants.map(v => (
                                <div key={v.variantId} className="bg-[#13151A] border border-[#1E293B] p-2 rounded-lg">
                                  <span className="font-medium text-[#F8FAFC] block truncate">{v.title}</span>
                                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mt-1">
                                    <span>{v.durationMinutes} mins</span>
                                    <span className="font-bold text-emerald-400">KES {(v.priceMinorUnits / 100).toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Simulate Future Booking Engine Contract */}
                        <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                          <span className="text-[11px] text-[#64748B]">Future Booking Engine Integration</span>
                          <button
                            onClick={() => {
                              const snapshot = service.getBookingSnapshot(
                                offering.serviceOfferingId,
                                offering.variants[0]?.variantId
                              );
                              alert(
                                `Simulated Immutable Booking Contract Created:\n\nOffering: ${snapshot.title}\nVariant: ${snapshot.variantTitle || 'Base'}\nDuration: ${snapshot.durationMinutes} mins\nPrice: KES ${(snapshot.priceMinorUnits / 100).toLocaleString()}\nTimestamp: ${snapshot.snapshotTimestamp}\n\nThis snapshot is ready for downstream booking locks and ledger payouts!`
                              );
                            }}
                            className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Simulate Contract Lock
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1E293B] flex justify-end">
                  <button
                    onClick={() => setSelectedPublicProfile(null)}
                    className="px-4 py-2 bg-[#1E293B] hover:bg-[#334155] text-xs font-semibold text-[#F8FAFC] rounded-xl transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. PROVIDER OPERATIONAL WORKSPACE                                  */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'workspace' && currentDashboard && (
        <div className="space-y-6">
          {/* Identity & Status Overview Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <img
                  src={currentDashboard.profile.avatarUrl}
                  alt={currentDashboard.profile.displayName}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#1E293B]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-[#F8FAFC]">{currentDashboard.profile.displayName}</h2>
                    <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-md">
                      {currentDashboard.profile.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1">{currentDashboard.profile.professionalTitle}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 font-mono">
                    Provider ID: {currentDashboard.profile.providerId} · Linked User ID: {currentDashboard.profile.userId}
                  </p>
                </div>
              </div>

              {/* Status Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Verification Status */}
                <div className="bg-[#0B0D10] border border-[#1E293B] p-2.5 rounded-xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#94A3B8]" />
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Verification Status</div>
                    <div
                      className={`text-xs font-bold ${
                        currentDashboard.profile.verificationStatus === 'VERIFIED'
                          ? 'text-emerald-400'
                          : currentDashboard.profile.verificationStatus === 'SUSPENDED'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {currentDashboard.profile.verificationStatus}
                    </div>
                  </div>
                </div>

                {/* Operational Status Toggle */}
                <div className="bg-[#0B0D10] border border-[#1E293B] p-2.5 rounded-xl flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#94A3B8]" />
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Operational Status</div>
                    <select
                      value={currentDashboard.profile.operationalStatus}
                      onChange={e => {
                        try {
                          service.setOperationalStatus(
                            currentDashboard.profile.providerId,
                            e.target.value as any,
                            currentDashboard.profile.userId
                          );
                          bumpVersion();
                          showToast(`Operational status updated to ${e.target.value}`, 'success');
                        } catch (err: any) {
                          showToast(err.message, 'error');
                        }
                      }}
                      className="bg-transparent text-xs font-bold text-[#F8FAFC] border-none focus:outline-none cursor-pointer"
                    >
                      <option value="ACTIVE" className="bg-[#13151A] text-emerald-400">ACTIVE</option>
                      <option value="TEMPORARILY_INACTIVE" className="bg-[#13151A] text-amber-400">TEMPORARILY_INACTIVE (Vacation)</option>
                      <option value="RESTRICTED" className="bg-[#13151A] text-rose-400">RESTRICTED</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Eligibility Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#1E293B]">
              <div
                className={`p-4 rounded-xl border ${
                  currentDashboard.eligibilityToActivateServices.isEligible
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs">
                  {currentDashboard.eligibilityToActivateServices.isEligible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Service Activation Eligibility:</span>
                  <span className="font-bold">
                    {currentDashboard.eligibilityToActivateServices.isEligible ? 'ELIGIBLE' : 'BLOCKED'}
                  </span>
                </div>
                {!currentDashboard.eligibilityToActivateServices.isEligible && (
                  <p className="text-[11px] opacity-80 mt-1">
                    {currentDashboard.eligibilityToActivateServices.missingPrerequisites[0]}
                  </p>
                )}
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  currentDashboard.eligibilityForPublicDirectory.isEligible
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                    : 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-xs">
                  {currentDashboard.eligibilityForPublicDirectory.isEligible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Marketplace Directory Discoverability:</span>
                  <span className="font-bold">
                    {currentDashboard.eligibilityForPublicDirectory.isEligible ? 'LISTED' : 'NOT LISTED'}
                  </span>
                </div>
                {!currentDashboard.eligibilityForPublicDirectory.isEligible && (
                  <p className="text-[11px] opacity-80 mt-1">
                    Missing: {currentDashboard.eligibilityForPublicDirectory.missingPrerequisites.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#13151A] border border-[#1E293B] p-4 rounded-2xl">
              <span className="text-xs text-[#64748B] uppercase font-bold">Verified Credentials</span>
              <div className="text-2xl font-bold text-[#F8FAFC] mt-1">
                {currentDashboard.credentials.filter(c => c.verificationStatus === 'VERIFIED').length} / {currentDashboard.credentials.length}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] p-4 rounded-2xl">
              <span className="text-xs text-[#64748B] uppercase font-bold">Live Offerings</span>
              <div className="text-2xl font-bold text-[#F8FAFC] mt-1">
                {currentDashboard.offerings.filter(o => o.status === 'ACTIVE').length}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] p-4 rounded-2xl">
              <span className="text-xs text-[#64748B] uppercase font-bold">Coverage Zones</span>
              <div className="text-2xl font-bold text-[#F8FAFC] mt-1">
                {currentDashboard.serviceAreas.length}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] p-4 rounded-2xl">
              <span className="text-xs text-[#64748B] uppercase font-bold">Trust Badges</span>
              <div className="text-2xl font-bold text-[#F8FAFC] mt-1">
                {currentDashboard.trustIndicators.length}
              </div>
            </div>
          </div>

          {/* Organization & Affiliated Business */}
          {currentDashboard.primaryBusiness && (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-400" />
                    Business Organization: {currentDashboard.primaryBusiness.tradingName}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Legal Name: {currentDashboard.primaryBusiness.legalName} · Reg: {currentDashboard.primaryBusiness.registrationNumber}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                  {currentDashboard.primaryBusiness.verificationStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#1E293B] text-xs">
                <div>
                  <span className="text-[#64748B]">Business Type:</span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">{currentDashboard.primaryBusiness.businessType}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Contact Phone:</span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">{currentDashboard.primaryBusiness.contactPhone}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Contact Email:</span>
                  <p className="font-semibold text-[#F8FAFC] mt-0.5">{currentDashboard.primaryBusiness.contactEmail}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. CREDENTIALS & VERIFICATION DOSSIER SUBMISSION                   */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'credentials' && currentDashboard && (
        <div className="space-y-6">
          {/* Category Rule Requirements Box */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-400" />
              Category Requirements for {currentDashboard.profile.category}
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">
              Pet OS enforces strict statutory credential validation before any provider can publish services.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#1E293B] text-xs">
              <div className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl">
                <span className="font-semibold text-rose-400 block mb-2">Mandatory Statutory Credentials:</span>
                <ul className="space-y-1 text-[#CBD5E1]">
                  {CATEGORY_VERIFICATION_RULES[currentDashboard.profile.category]?.mandatoryCredentialTypes.map(c => (
                    <li key={c} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-rose-400" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl">
                <span className="font-semibold text-blue-400 block mb-2">Recommended Trust Badges:</span>
                <ul className="space-y-1 text-[#CBD5E1]">
                  {CATEGORY_VERIFICATION_RULES[currentDashboard.profile.category]?.recommendedCredentialTypes.map(c => (
                    <li key={c} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Current Credentials List */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F8FAFC]">Attached Credentials Dossier</h3>
              {currentDashboard.profile.verificationStatus === 'DRAFT' && (
                <button
                  onClick={() => {
                    try {
                      service.submitVerificationCase(
                        currentDashboard.profile.providerId,
                        currentDashboard.credentials.map(c => c.credentialId),
                        currentDashboard.profile.userId
                      );
                      bumpVersion();
                      showToast('Verification dossier submitted for official trust review', 'success');
                    } catch (err: any) {
                      showToast(err.message, 'error');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit Dossier for Review</span>
                </button>
              )}
            </div>

            {currentDashboard.credentials.length === 0 ? (
              <div className="p-8 text-center bg-[#0B0D10] rounded-xl border border-[#1E293B]">
                <FileText className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <p className="text-xs text-[#94A3B8]">No credentials uploaded yet. Attach your government ID and professional credentials below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDashboard.credentials.map(c => (
                  <div
                    key={c.credentialId}
                    className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F8FAFC] text-sm">{c.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1E293B] text-[#94A3B8]">
                          {c.credentialType}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        Issuer: {c.issuingAuthority} · Masked Identifier: <span className="font-mono">{c.identifierMasked}</span>
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        Issued: {c.issuedDate} {c.expiryDate ? `· Expires: ${c.expiryDate}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          c.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : c.verificationStatus === 'EXPIRED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {c.verificationStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. SERVICE CATALOGUE & PRICING                                    */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'catalogue' && currentDashboard && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#F8FAFC]">Service Catalogue Offerings</h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Services use strict integer minor units for currency (Money VO) and support multi-tier duration variants.
                </p>
              </div>

              {/* Service Activation Guard Warning */}
              {currentDashboard.profile.verificationStatus !== 'VERIFIED' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Activation locked until verified</span>
                </div>
              )}
            </div>

            {/* Offerings list */}
            <div className="mt-6 space-y-4">
              {currentDashboard.offerings.map(offering => (
                <div key={offering.serviceOfferingId} className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F8FAFC]">{offering.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            offering.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-[#1E293B] text-[#94A3B8]'
                          }`}
                        >
                          {offering.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">{offering.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-emerald-400">
                        KES {(offering.basePriceMinorUnits / 100).toLocaleString()}
                      </span>

                      {/* Activate / Pause controls */}
                      {offering.status === 'DRAFT' || offering.status === 'PAUSED' ? (
                        <button
                          onClick={() => {
                            try {
                              service.activateServiceOffering(offering.serviceOfferingId, currentDashboard.profile.userId);
                              bumpVersion();
                              showToast(`Offering "${offering.title}" is now ACTIVE`, 'success');
                            } catch (err: any) {
                              showToast(err.message, 'error');
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Publish / Activate
                        </button>
                      ) : offering.status === 'ACTIVE' ? (
                        <button
                          onClick={() => {
                            try {
                              service.pauseServiceOffering(offering.serviceOfferingId, currentDashboard.profile.userId);
                              bumpVersion();
                              showToast(`Offering "${offering.title}" is now PAUSED`, 'info');
                            } catch (err: any) {
                              showToast(err.message, 'error');
                            }
                          }}
                          className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Pause
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Variants */}
                  {offering.variants.length > 0 && (
                    <div className="pt-2 border-t border-[#1E293B]">
                      <span className="text-[11px] font-semibold text-[#64748B]">Duration &amp; Pricing Variants:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                        {offering.variants.map(v => (
                          <div key={v.variantId} className="bg-[#13151A] p-2 rounded-lg border border-[#1E293B] flex items-center justify-between">
                            <span className="font-medium text-[#F8FAFC]">{v.title}</span>
                            <span className="font-bold text-emerald-400">KES {(v.priceMinorUnits / 100).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 5. LOCATIONS & COVERAGE AREAS                                     */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'locations' && currentDashboard && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Operating Locations &amp; Privacy Shielding
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Commercial clinics display full street addresses. Private in-home residences automatically mask exact street numbers to preserve provider safety.
              </p>
            </div>

            <div className="space-y-3">
              {currentDashboard.locations.map(loc => (
                <div key={loc.locationId} className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#F8FAFC]">{loc.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        loc.isPublicAddress ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                      }`}
                    >
                      {loc.isPublicAddress ? 'Public Commercial Address' : 'Private Residence (Shielded)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1E293B]">
                    <div>
                      <span className="text-[#64748B] flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Public Projection Address:
                      </span>
                      <p className="font-medium text-[#CBD5E1] mt-0.5">{loc.addressLine1Masked || `${loc.city}, ${loc.country}`}</p>
                    </div>

                    <div>
                      <span className="text-[#64748B] flex items-center gap-1">
                        <Lock className="w-3 h-3 text-purple-400" /> Internal Operational Address (Restricted):
                      </span>
                      <p className="font-mono text-[11px] text-purple-300 mt-0.5">{loc.fullAddressPrivate}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Areas */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              Mobile Dispatch Coverage Areas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentDashboard.serviceAreas.map(area => (
                <div key={area.serviceAreaId} className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl text-xs">
                  <span className="font-bold text-[#F8FAFC] block text-sm">{area.name}</span>
                  <div className="flex items-center justify-between text-[#94A3B8] mt-2">
                    <span>Type: {area.areaType}</span>
                    {area.radiusKm && <span className="font-semibold text-emerald-400">Radius: {area.radiusKm} km</span>}
                    {area.districtName && <span className="font-semibold text-blue-400">{area.districtName}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. AVAILABILITY & SCHEDULE                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'schedule' && currentDashboard && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Weekly Repeating Availability Schedule
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Enforces time-boundary availability and concurrent booking limits.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {currentDashboard.availabilityRules.map(rule => {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return (
                  <div key={rule.ruleId} className="bg-[#0B0D10] border border-[#1E293B] p-3 rounded-xl text-xs">
                    <div className="flex items-center justify-between font-bold text-[#F8FAFC]">
                      <span>{days[rule.dayOfWeek]}</span>
                      <span className="text-emerald-400">{rule.startTime} - {rule.endTime}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-1">
                      Capacity: {rule.maxConcurrentCapacity} concurrent booking(s) · {rule.timezone}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 7. TRUST REVIEW DESK & ADMIN QUEUE                                 */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'admin_queue' && (
        <div className="space-y-6">
          <div className="bg-purple-950/20 border border-purple-900/40 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-bold text-[#F8FAFC]">Trust Review &amp; Safety Desk</h2>
                </div>
                <p className="text-xs text-purple-200 mt-1">
                  Active Reviewer: <span className="font-mono text-white">Dr. Charles Maina (Trust Officer)</span>
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-500/30">
                Administrative Workspace
              </span>
            </div>
          </div>

          {/* Pending Verification Cases */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#F8FAFC]">Submitted Verification Dossiers</h3>

            {store.listVerificationCases().length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No active cases</p>
            ) : (
              <div className="space-y-3">
                {store.listVerificationCases().map(caseRecord => {
                  const targetProvider = caseRecord.providerId ? store.getProvider(caseRecord.providerId) : undefined;
                  return (
                    <div key={caseRecord.caseId} className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl text-xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-sm text-[#F8FAFC]">
                            Case #{caseRecord.caseId} · {targetProvider?.displayName}
                          </span>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            Category: {caseRecord.category} · Submitted At: {caseRecord.submittedAt}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            caseRecord.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : caseRecord.status === 'SUBMITTED'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {caseRecord.status}
                        </span>
                      </div>

                      {/* Review Actions if Submitted */}
                      {caseRecord.status === 'SUBMITTED' && (
                        <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                          <span className="text-[11px] text-[#64748B]">Review Decision</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                try {
                                  service.reviewVerificationCase(
                                    {
                                      caseId: caseRecord.caseId,
                                      decision: 'APPROVED',
                                      notes: 'Official credentials verified against statutory registry.',
                                    },
                                    SEED_USERS.ADMIN
                                  );
                                  bumpVersion();
                                  showToast(`Approved case #${caseRecord.caseId}`, 'success');
                                } catch (err: any) {
                                  showToast(err.message, 'error');
                                }
                              }}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                try {
                                  service.reviewVerificationCase(
                                    {
                                      caseId: caseRecord.caseId,
                                      decision: 'REJECTED',
                                      rejectionReason: 'Credential document missing clear seal.',
                                    },
                                    SEED_USERS.ADMIN
                                  );
                                  bumpVersion();
                                  showToast(`Rejected case #${caseRecord.caseId}`, 'info');
                                } catch (err: any) {
                                  showToast(err.message, 'error');
                                }
                              }}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trust & Safety Incident Reports */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#F8FAFC]">Trust &amp; Safety Incident Reports</h3>
            <div className="space-y-3">
              {store.listReports().map(report => (
                <div key={report.reportId} className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F8FAFC] text-sm">
                      Report #{report.reportId} · Category: {report.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400">
                      {report.status}
                    </span>
                  </div>
                  <p className="text-[#94A3B8]">{report.description}</p>
                  {report.resolutionNotes && (
                    <p className="text-[11px] text-emerald-400 bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/40">
                      Resolution: {report.resolutionNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 8. AUTOMATED VERIFICATION TEST SUITE                               */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#F8FAFC] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Automated Domain Architecture Test Suite (14 Invariant Tests)
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Validates User/Provider/Business separation, self-verification prohibition, status decoupling, Money VO integer pricing, public/private projection isolation, and suspension cascades.
                </p>
              </div>

              <button
                id="btn-run-all-tests"
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Play className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>{isRunningTests ? 'Executing Tests...' : 'Run All 14 Tests'}</span>
              </button>
            </div>
          </div>

          {testResults.length === 0 ? (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-12 text-center">
              <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-[#F8FAFC]">Test Suite Ready</h4>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-1 mb-4">
                Click "Run All 14 Tests" above to verify all Sprint 10 architectural boundaries, invariant rules, and security policies.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map(test => (
                <div
                  key={test.testId}
                  className={`bg-[#13151A] border rounded-xl p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    test.passed ? 'border-emerald-900/50' : 'border-rose-900/50 bg-rose-950/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#64748B]">{test.testId}</span>
                      <span className="font-bold text-[#F8FAFC] text-sm">{test.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1E293B] text-[#94A3B8]">
                        {test.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1">{test.description}</p>
                    {test.error && (
                      <p className="text-xs text-rose-400 font-mono mt-1 bg-rose-950/40 p-2 rounded border border-rose-900/40">
                        {test.error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-[#64748B]">{test.durationMs}ms</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        test.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {test.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{test.passed ? 'PASSED' : 'FAILED'}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
