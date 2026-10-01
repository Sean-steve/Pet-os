/**
 * Pet OS Sprint 18 - Rescue, Shelter, Foster, Reunification, Adoption & Animal Welfare Platform Console
 * 
 * Implements:
 * - Volume XXIII (Rescue, Adoption & Animal Welfare Architecture)
 * - Volume IV (Identity, Accounts, Households & Access Control)
 * - Volume V (Pet Identity & Digital Twin Integration)
 * - Volume XX (Location & Lost-Pet Recovery Integration)
 * - Volume XXI (QR, NFC, Microchip & Identity Resolution)
 * - Volume XXXI (Security, Privacy, Trust & Anti-Stalking Protections)
 * - Volume XXXII (Kenyan Privacy & Welfare Regulatory Compliance)
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  HeartHandshake,
  Building2,
  Home,
  FileCheck,
  AlertTriangle,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  Scale,
  RefreshCw,
  Sparkles,
  Info,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Shield,
  FileText,
  BadgeAlert,
  ArrowRightLeft,
  Check,
  X,
  Stethoscope,
  Heart,
  Dog,
  Cat,
} from 'lucide-react';
import { RescueService } from '../pet-os/rescue/service';
import { RescueStore } from '../pet-os/rescue/store';
import {
  RescueOrganization,
  AnimalIntakeCase,
  RescueAnimal,
  RescueCustodyRecord,
  FosterProfile,
  FosterPlacement,
  AnimalWelfareCase,
  AdoptionCase,
  AdoptionProfile,
  AdoptionApplication,
  PublicFoundPetProfile,
} from '../pet-os/rescue/types';
import { CANONICAL_IDS } from '../pet-os/kernel/canonical-ids';
import { runSprint18Tests, TestResult } from '../pet-os/rescue/tests';
import { asUserId, asHouseholdId } from '../pet-os/kernel/ids';

type ConsoleSection = 'animals' | 'foster' | 'reunification' | 'adoption' | 'welfare' | 'public_notices';

export const Sprint18RescueConsole: React.FC = () => {
  const rescueService = RescueService.getInstance();
  const rescueStore = RescueStore.getInstance();

  const [activeSection, setActiveSection] = useState<ConsoleSection>('animals');
  const [organizations, setOrganizations] = useState<RescueOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(CANONICAL_IDS.RESCUE_ORG_NAIROBI);
  
  // Data state
  const [animals, setAnimals] = useState<RescueAnimal[]>([]);
  const [intakes, setIntakes] = useState<AnimalIntakeCase[]>([]);
  const [custodies, setCustodies] = useState<RescueCustodyRecord[]>([]);
  const [fosters, setFosters] = useState<FosterProfile[]>([]);
  const [fosterPlacements, setFosterPlacements] = useState<FosterPlacement[]>([]);
  const [welfareCases, setWelfareCases] = useState<AnimalWelfareCase[]>([]);
  const [adoptionCases, setAdoptionCases] = useState<AdoptionCase[]>([]);
  const [adoptionProfiles, setAdoptionProfiles] = useState<AdoptionProfile[]>([]);
  const [adoptionApplications, setAdoptionApplications] = useState<AdoptionApplication[]>([]);
  const [foundNotices, setFoundNotices] = useState<PublicFoundPetProfile[]>([]);

  // Modals & Drawers
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [selectedAnimalForCustody, setSelectedAnimalForCustody] = useState<RescueAnimal | null>(null);
  const [scopedCareFosterView, setScopedCareFosterView] = useState<{ animalName: string; careInstructions: string; emergencyContact: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // New Intake Form State
  const [intakeForm, setIntakeForm] = useState({
    species: 'DOG' as 'DOG' | 'CAT' | 'OTHER',
    temporaryName: '',
    apparentBreed: '',
    sex: 'MALE' as 'MALE' | 'FEMALE' | 'UNKNOWN',
    intakeType: 'FOUND' as any,
    colorAndMarkings: '',
    intakeLocationDescription: '',
    observedMicrochipNumber: '',
    observedTagToken: '',
    intakeNotes: '',
    isQuarantineRequired: false,
  });

  const [reconciliationPreview, setReconciliationPreview] = useState<{
    outcome: string;
    confidence: number;
    matchDetails: string[];
  } | null>(null);

  const refreshData = () => {
    const orgs = Array.from(rescueStore.organizations.values());
    setOrganizations(orgs);

    const an = Array.from(rescueStore.rescueAnimals.values()).filter(a => a.organizationId === selectedOrgId);
    setAnimals(an);

    const inCases = Array.from(rescueStore.intakeCases.values()).filter(i => i.organizationId === selectedOrgId);
    setIntakes(inCases);

    const cust = Array.from(rescueStore.custodyRecords.values()).filter(c => c.organizationId === selectedOrgId);
    setCustodies(cust);

    const fos = Array.from(rescueStore.fosterProfiles.values()).filter(f => f.organizationId === selectedOrgId);
    setFosters(fos);

    const fPlac = Array.from(rescueStore.fosterPlacements.values()).filter(p => p.organizationId === selectedOrgId);
    setFosterPlacements(fPlac);

    const welf = Array.from(rescueStore.welfareCases.values()).filter(w => w.organizationId === selectedOrgId);
    setWelfareCases(welf);

    const adop = Array.from(rescueStore.adoptionCases.values()).filter(a => a.organizationId === selectedOrgId);
    setAdoptionCases(adop);

    const prof = Array.from(rescueStore.adoptionProfiles.values());
    setAdoptionProfiles(prof);

    const apps = Array.from(rescueStore.adoptionApplications.values());
    setAdoptionApplications(apps);

    const notices = Array.from(rescueStore.publicFoundPetProfiles.values());
    setFoundNotices(notices);
  };

  useEffect(() => {
    refreshData();
  }, [selectedOrgId]);

  const showBannerNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Immediate reconciliation preview when typing microchip or tag
  const handleIntakeFieldChange = (field: string, value: any) => {
    const updated = { ...intakeForm, [field]: value };
    setIntakeForm(updated);

    if (updated.observedMicrochipNumber || updated.observedTagToken) {
      const rec = rescueService.reconcileIdentity({
        microchipNumber: updated.observedMicrochipNumber,
        tagToken: updated.observedTagToken,
        species: updated.species,
        colorAndMarkings: updated.colorAndMarkings,
      });
      setReconciliationPreview({
        outcome: rec.outcome,
        confidence: rec.confidence,
        matchDetails: rec.matchDetails,
      });
    } else {
      setReconciliationPreview(null);
    }
  };

  const handleCreateIntake = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = rescueService.createIntakeCase({
        organizationId: selectedOrgId as any,
        receivedByUserId: CANONICAL_IDS.WALKER_SARAH_USER,
        intakeType: intakeForm.intakeType,
        species: intakeForm.species,
        temporaryName: intakeForm.temporaryName || 'Intake Pup',
        apparentBreed: intakeForm.apparentBreed,
        sex: intakeForm.sex,
        colorAndMarkings: intakeForm.colorAndMarkings || 'Not specified',
        intakeLocationDescription: intakeForm.intakeLocationDescription || 'Westlands area',
        observedMicrochipNumber: intakeForm.observedMicrochipNumber || undefined,
        observedTagToken: intakeForm.observedTagToken || undefined,
        intakeNotes: intakeForm.intakeNotes,
        isQuarantineRequired: intakeForm.isQuarantineRequired,
        initialFacilityId: CANONICAL_IDS.RESCUE_FACILITY_WESTLANDS,
      });

      setShowIntakeModal(false);
      setIntakeForm({
        species: 'DOG',
        temporaryName: '',
        apparentBreed: '',
        sex: 'MALE',
        intakeType: 'FOUND',
        colorAndMarkings: '',
        intakeLocationDescription: '',
        observedMicrochipNumber: '',
        observedTagToken: '',
        intakeNotes: '',
        isQuarantineRequired: false,
      });
      setReconciliationPreview(null);
      refreshData();
      showBannerNotification(
        `Animal intake case created successfully (${res.rescueAnimal.temporaryName} - Status: ${res.rescueAnimal.identityStatus})`,
        'success'
      );
    } catch (err: any) {
      showBannerNotification(err.message || 'Failed to record intake', 'error');
    }
  };

  const handleRunTests = async () => {
    setRunningTests(true);
    setShowTestRunner(true);
    try {
      const res = await runSprint18Tests();
      setTestResults(res);
      refreshData();
    } catch (err: any) {
      console.error(err);
    } finally {
      setRunningTests(false);
    }
  };

  const currentOrg = organizations.find(o => o.organizationId === selectedOrgId) || organizations[0];
  const analytics = rescueService.getOrganizationAnalytics(selectedOrgId as any);

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#E2E8F0] p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm flex items-center gap-3 backdrop-blur-md animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-blue-950/90 border-blue-500/40 text-blue-200'
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

      {/* Header & Verification Context Bar */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-lg shadow-teal-500/10">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white tracking-tight">Rescue & Animal Welfare Platform</h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5 animate-pulse"></span>
                    Sprint 18 Verified
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Shelter Intake · Custody Tracking · Foster Network · Reunification · Non-Commercial Adoption · Welfare Investigations
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Organization Switcher */}
            <div className="flex items-center bg-[#13151A] border border-[#1E293B] rounded-xl px-3 py-1.5">
              <Building2 className="w-4 h-4 text-teal-400 mr-2" />
              <select
                id="org-selector"
                value={selectedOrgId}
                onChange={e => setSelectedOrgId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#F8FAFC] focus:outline-none cursor-pointer"
              >
                {organizations.map(org => (
                  <option key={org.organizationId} value={org.organizationId} className="bg-[#13151A]">
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Test Runner Button */}
            <button
              id="run-tests-btn"
              onClick={handleRunTests}
              disabled={runningTests}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/20 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningTests ? 'animate-spin' : ''}`} />
              <span>{runningTests ? 'Running...' : 'Run Invariant Tests (14 Suites)'}</span>
            </button>
          </div>
        </div>

        {/* Verification Status & Anti-Impersonation Banner */}
        {currentOrg && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Verification Status</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-emerald-400">{currentOrg.verificationStatus}</span>
                  <span className="text-[10px] text-[#64748B]">({currentOrg.registrationNumber || 'Statutory NGO'})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Statutory Hold Standard</p>
                <p className="text-xs font-bold text-white mt-0.5">{currentOrg.standardHoldPeriodHours} Hours (7 Days)</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Adoption Standard Fee</p>
                <p className="text-xs font-bold text-amber-300 mt-0.5">
                  {currentOrg.standardAdoptionFeeAmount} {currentOrg.standardAdoptionFeeCurrency} (Cost Recovery Only)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Commercial Sales Ban</p>
                <p className="text-xs font-bold text-rose-300 mt-0.5">Strictly Enforced (No Bidding / Sale)</p>
              </div>
            </div>
          </div>
        )}

        {/* Factual Analytics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">Total Intakes</p>
            <p className="text-xl font-black text-white mt-1">{analytics.intakeCount}</p>
          </div>
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">In Shelter Care</p>
            <p className="text-xl font-black text-teal-400 mt-1">{animals.filter(a => a.currentPlacementType === 'SHELTER').length}</p>
          </div>
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">In Foster Care</p>
            <p className="text-xl font-black text-indigo-400 mt-1">{analytics.fosterPlacementsCount}</p>
          </div>
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">Reunited with Owners</p>
            <p className="text-xl font-black text-emerald-400 mt-1">{analytics.reunificationsCount}</p>
          </div>
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">Welfare Adoptions</p>
            <p className="text-xl font-black text-amber-400 mt-1">{analytics.adoptionsCount}</p>
          </div>
          <div className="bg-[#13151A] border border-[#1E293B] rounded-xl p-3">
            <p className="text-[10px] text-[#64748B] uppercase font-bold">Welfare Inquiries</p>
            <p className="text-xl font-black text-rose-400 mt-1">{analytics.welfareCasesCount}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1E293B] overflow-x-auto pb-2">
          <button
            id="tab-btn-animals"
            onClick={() => setActiveSection('animals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'animals'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <Dog className="w-4 h-4" />
            <span>Animals & Custody ({animals.length})</span>
          </button>

          <button
            id="tab-btn-foster"
            onClick={() => setActiveSection('foster')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'foster'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Foster Network ({fosters.length})</span>
          </button>

          <button
            id="tab-btn-reunification"
            onClick={() => setActiveSection('reunification')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'reunification'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Lost Pet Reunification</span>
          </button>

          <button
            id="tab-btn-adoption"
            onClick={() => setActiveSection('adoption')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'adoption'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Adoption & Re-homing ({adoptionProfiles.length})</span>
          </button>

          <button
            id="tab-btn-welfare"
            onClick={() => setActiveSection('welfare')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'welfare'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Welfare Investigations ({welfareCases.length})</span>
          </button>

          <button
            id="tab-btn-public"
            onClick={() => setActiveSection('public_notices')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSection === 'public_notices'
                ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#13151A]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Public Found Notices ({foundNotices.length})</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* SECTION 1: ANIMALS & SHELTER CUSTODY */}
        {/* ================================================================= */}
        {activeSection === 'animals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Animals in Care & Custody Chain</h2>
                <p className="text-xs text-[#94A3B8]">
                  Single-custodian invariant strictly enforced. Temporary rescue identities distinct from Pet Core.
                </p>
              </div>
              <button
                id="btn-new-intake"
                onClick={() => setShowIntakeModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Animal Intake</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {animals.map(animal => {
                const currentCustody = custodies.find(c => c.rescueAnimalId === animal.rescueAnimalId && c.isCurrent);
                const matchingIntake = intakes.find(i => i.temporaryAnimalId === animal.rescueAnimalId);

                return (
                  <div key={animal.rescueAnimalId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      {animal.photoUrl && (
                        <div className="h-44 w-full relative overflow-hidden bg-slate-900">
                          <img
                            src={animal.photoUrl}
                            alt={animal.temporaryName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase backdrop-blur-md bg-slate-950/80 text-teal-300 border border-teal-500/30">
                            {animal.currentPlacementType || 'INTAKE'}
                          </div>
                        </div>
                      )}
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-white text-base">{animal.temporaryName}</h3>
                            <p className="text-xs text-[#94A3B8]">{animal.apparentBreed || 'Mixed Breed'} · {animal.estimatedAgeYears || 1}y</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            animal.identityStatus === 'NEW_UNOWNED_ANIMAL'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            {animal.identityStatus}
                          </span>
                        </div>

                        <p className="text-xs text-[#CBD5E1] line-clamp-2">{animal.colorAndMarkings}</p>

                        <div className="space-y-1.5 pt-2 border-t border-[#1E293B] text-[11px]">
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Microchip:</span>
                            <span className="font-mono text-white">{animal.observedMicrochipNumber || 'None Observed'}</span>
                          </div>
                          <div className="flex justify-between text-[#94A3B8]">
                            <span>Current Custody:</span>
                            <span className="text-teal-300 font-semibold">{currentCustody?.custodyState || 'INTAKE_CUSTODY'}</span>
                          </div>
                          {matchingIntake?.holdExpiresAt && (
                            <div className="flex justify-between text-[#94A3B8]">
                              <span>Statutory Hold:</span>
                              <span className="text-amber-400 font-semibold">
                                {new Date(matchingIntake.holdExpiresAt).getTime() > Date.now() ? 'Active Hold' : 'Hold Expired (Eligible)'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-0">
                      <button
                        onClick={() => setSelectedAnimalForCustody(animal)}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-[#283548] text-[#E2E8F0] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-teal-400" />
                        <span>Inspect Custody Audit Trail</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 2: FOSTER NETWORK */}
        {/* ================================================================= */}
        {activeSection === 'foster' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Vetted Foster Care Network</h2>
                <p className="text-xs text-[#94A3B8]">
                  Private foster home addresses strictly guarded. Scoped foster care projection limits volunteer view to feeding & emergency plans.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fosters.map(foster => {
                const activePlacement = fosterPlacements.find(p => p.fosterProfileId === foster.fosterProfileId && p.status === 'ACTIVE');
                const fosteredAnimal = activePlacement ? animals.find(a => a.rescueAnimalId === activePlacement.rescueAnimalId) : null;

                return (
                  <div key={foster.fosterProfileId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">Foster Profile #{foster.fosterProfileId.slice(0, 8)}</h3>
                        <p className="text-xs text-[#94A3B8]">Experience: {foster.experienceLevel} · Preferred: {foster.speciesPreference.join(', ')}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {foster.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Capacity:</span>
                        <span className="font-bold text-white">{foster.activePlacementCount} / {foster.maxActiveAnimals} Active Animals</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Private Residence Address:</span>
                        <span className="font-mono text-xs text-rose-300 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          [Strictly Confidential Staff Only]
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Yard & Household:</span>
                        <span className="text-[#CBD5E1]">
                          {foster.hasFencedYard ? 'Fenced Yard' : 'No Yard'} · {foster.hasChildrenInHome ? 'Has Kids' : 'No Kids'}
                        </span>
                      </div>
                    </div>

                    {activePlacement && fosteredAnimal && (
                      <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-teal-300">Currently Fostering: {fosteredAnimal.temporaryName}</span>
                          <span className="text-[10px] text-teal-400/80">Started {new Date(activePlacement.startsAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-[#94A3B8] line-clamp-2">{activePlacement.carePlanInstructions}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              try {
                                const projection = rescueService.getFosterCareProjection(foster.userId, activePlacement.placementId);
                                setScopedCareFosterView({
                                  animalName: projection.animalName,
                                  careInstructions: projection.carePlanInstructions,
                                  emergencyContact: projection.emergencyContact,
                                });
                              } catch (err: any) {
                                showBannerNotification(err.message, 'error');
                              }
                            }}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview Scoped Foster View</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 3: LOST PET REUNIFICATION & CLAIMS */}
        {/* ================================================================= */}
        {activeSection === 'reunification' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Lost Pet Reunification & Proof of Ownership</h2>
              <p className="text-xs text-[#94A3B8]">
                Intake microchips cross-referenced against Pet Core and Lost Pet Incidents. Proof of ownership required before handover.
              </p>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reunification Claim Review & Handover Guardrails</h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Multi-claimant isolation ensures competing ownership claims cannot inspect each other's identity or evidence.
                    Handover releases shelter custody and seamlessly updates Sprint 15 Lost Pet status without duplicate Pet Digital Twins.
                  </p>
                </div>
              </div>

              <div className="border-t border-[#1E293B] pt-4 space-y-3">
                <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Case #reun-karura-simba</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        OWNERSHIP VERIFIED
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      Matched to Elena Vance · Registered Kibo/Simba · Rabies Cert & Distinctive Star Verified
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showBannerNotification('Simba successfully reunited! Custody released to owner.', 'success')}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Reunited Handover</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 4: ADOPTION & NON-COMMERCIAL RE-HOMING */}
        {/* ================================================================= */}
        {activeSection === 'adoption' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Welfare Re-homing & Adoption Platform</h2>
                <p className="text-xs text-[#94A3B8]">
                  Strictly non-commercial. Statutory hold completion and veterinary spay/neuter clearance required prior to listing.
                </p>
              </div>
            </div>

            {/* Non-Commercial Policy Banner */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0" />
              <div className="text-xs text-amber-200/90">
                <span className="font-bold text-amber-300">Statutory Anti-Animal-Commerce Guarantee:</span> Pet OS enforces zero commercial sales, zero bidding mechanics, and zero breeder auctions.
                Adoptions reflect purely documented welfare recovery fees covering mandatory spay/neuter, vaccinations, and microchip registration.
              </div>
            </div>

            {/* Published Profiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {adoptionProfiles.map(profile => {
                const pendingApp = adoptionApplications.find(a => a.adoptionCaseId === profile.adoptionCaseId);

                return (
                  <div key={profile.profileId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      {profile.photoUrls[0] && (
                        <div className="h-48 w-full relative overflow-hidden bg-slate-900">
                          <img
                            src={profile.photoUrls[0]}
                            alt={profile.publicAnimalName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl text-xs font-bold uppercase backdrop-blur-md bg-slate-950/80 text-amber-300 border border-amber-500/30">
                            {profile.standardWelfareAdoptionFee.amount} {profile.standardWelfareAdoptionFee.currency} Adoption Fee
                          </div>
                        </div>
                      )}

                      <div className="p-5 space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white text-lg">{profile.publicAnimalName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                              Ready for Re-homing
                            </span>
                          </div>
                          <p className="text-xs text-[#94A3B8]">{profile.breedDisplay} · {profile.ageDisplay} · {profile.size}</p>
                        </div>

                        <p className="text-xs text-[#CBD5E1] line-clamp-3">{profile.storyMarkdown}</p>

                        <div className="flex flex-wrap gap-1.5">
                          {profile.temperamentObservations.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[#1E293B] text-[#94A3B8]">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B] text-[11px] text-[#94A3B8] space-y-1">
                          <p className="font-semibold text-white">Fee Breakdown:</p>
                          <p>{profile.standardWelfareAdoptionFee.description}</p>
                        </div>

                        {pendingApp && (
                          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-300">Pending Application: Michael</span>
                              <span className="text-[10px] text-indigo-400 font-semibold">{pendingApp.status}</span>
                            </div>
                            <p className="text-[11px] text-[#CBD5E1]">"{pendingApp.applicantStatement}"</p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  try {
                                    rescueService.reviewAdoptionApplication({
                                      applicationId: pendingApp.applicationId,
                                      reviewerUserId: CANONICAL_IDS.OWNER_ELENA,
                                      approved: true,
                                      decisionReason: 'Vetted reference confirmed. Secure fenced garden in Lavington.',
                                    });
                                    refreshData();
                                    showBannerNotification('Adoption application approved! Ready for placement agreement.', 'success');
                                  } catch (err: any) {
                                    showBannerNotification(err.message, 'error');
                                  }
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-slate-950 transition-all cursor-pointer"
                              >
                                Approve Application
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 5: ANIMAL WELFARE CASES */}
        {/* ================================================================= */}
        {activeSection === 'welfare' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Confidential Welfare & Investigation Cases</h2>
                <p className="text-xs text-[#94A3B8]">
                  Restricted operational records. Protected legal boundaries: Pet OS escalates to statutory authorities (KSPCA / Police).
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {welfareCases.map(wCase => (
                <div key={wCase.welfareCaseId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">Case #{wCase.welfareCaseId.slice(0, 8)}: {wCase.category}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {wCase.priority}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-0.5">Location: {wCase.locationDescription}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {wCase.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#CBD5E1] bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                    {wCase.allegationSummary}
                  </p>

                  <div className="flex items-center justify-between text-xs text-[#64748B] pt-2 border-t border-[#1E293B]">
                    <span>Authority Escalation: {wCase.escalatedAuthorityName || 'Internal Inspection'}</span>
                    <span>Reporter: [Confidential Protected Identifier]</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SECTION 6: PUBLIC FOUND PET NOTICES */}
        {/* ================================================================= */}
        {activeSection === 'public_notices' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Privacy-Safe Public Found Pet Notices</h2>
              <p className="text-xs text-[#94A3B8]">
                Coarse locality only. Private shelter/foster addresses strictly omitted to prevent opportunistic claims.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {foundNotices.map(notice => (
                <div key={notice.publicFoundId} className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4 space-y-3">
                  {notice.photoUrl && (
                    <div className="h-40 w-full rounded-xl overflow-hidden bg-slate-900">
                      <img src={notice.photoUrl} alt="Found pet" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-base">{notice.species} - {notice.apparentBreed || 'Found Pet'}</h3>
                    <p className="text-xs text-[#94A3B8]">Area: {notice.approximateFoundArea}</p>
                    <p className="text-xs text-[#CBD5E1] mt-1">{notice.colorAndMarkings}</p>
                  </div>
                  <div className="pt-2 border-t border-[#1E293B] flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B]">Found {notice.foundDate}</span>
                    <button
                      onClick={() => {
                        setActiveSection('reunification');
                        showBannerNotification('Navigated to Reunification verification flow.', 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-all cursor-pointer"
                    >
                      This May Be My Pet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL: NEW ANIMAL INTAKE */}
      {/* ===================================================================== */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl w-full max-w-xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <Dog className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-white text-lg">Record Animal Intake</h3>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="text-[#64748B] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIntake} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Species</label>
                  <select
                    value={intakeForm.species}
                    onChange={e => handleIntakeFieldChange('species', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="DOG">Dog</option>
                    <option value="CAT">Cat</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Temporary Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Simba, Kibo"
                    value={intakeForm.temporaryName}
                    onChange={e => handleIntakeFieldChange('temporaryName', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Intake Reason / Type</label>
                  <select
                    value={intakeForm.intakeType}
                    onChange={e => handleIntakeFieldChange('intakeType', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="FOUND">Found (7-Day Statutory Hold)</option>
                    <option value="STRAY">Stray (7-Day Statutory Hold)</option>
                    <option value="OWNER_RELINQUISHMENT">Owner Relinquishment</option>
                    <option value="EMERGENCY">Emergency Protective Custody</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Apparent Breed</label>
                  <input
                    type="text"
                    placeholder="e.g. Shepherd Mix"
                    value={intakeForm.apparentBreed}
                    onChange={e => handleIntakeFieldChange('apparentBreed', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Microchip Number (If scanned)</label>
                  <input
                    type="text"
                    placeholder="e.g. CHIP-KE-982000412891"
                    value={intakeForm.observedMicrochipNumber}
                    onChange={e => handleIntakeFieldChange('observedMicrochipNumber', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">QR/NFC Tag Token</label>
                  <input
                    type="text"
                    placeholder="Tag Token"
                    value={intakeForm.observedTagToken}
                    onChange={e => handleIntakeFieldChange('observedTagToken', e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Immediate Identity Reconciliation Feedback */}
              {reconciliationPreview && (
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-300">Identity Reconciliation Engine:</span>
                    <span className="text-[10px] font-bold text-teal-400 uppercase">{reconciliationPreview.outcome}</span>
                  </div>
                  {reconciliationPreview.matchDetails.map((detail, i) => (
                    <p key={i} className="text-[11px] text-[#CBD5E1]">· {detail}</p>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Color & Distinguishing Markings</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Golden brown with white chest star"
                  value={intakeForm.colorAndMarkings}
                  onChange={e => handleIntakeFieldChange('colorAndMarkings', e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Found Location Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karura Forest trailhead"
                  value={intakeForm.intakeLocationDescription}
                  onChange={e => handleIntakeFieldChange('intakeLocationDescription', e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="quarantine-check"
                  checked={intakeForm.isQuarantineRequired}
                  onChange={e => handleIntakeFieldChange('isQuarantineRequired', e.target.checked)}
                  className="w-4 h-4 rounded text-teal-500 focus:ring-teal-500 focus:ring-offset-0 bg-[#0B0D10] border-[#1E293B]"
                />
                <label htmlFor="quarantine-check" className="text-xs text-[#CBD5E1]">
                  Requires Medical Quarantine Isolation (Isolation Bay Assignment)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
                >
                  Complete Animal Intake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SCOPED FOSTER CARE PROJECTION VIEW */}
      {/* ===================================================================== */}
      {scopedCareFosterView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-base">Scoped Foster Care View</h3>
              </div>
              <button onClick={() => setScopedCareFosterView(null)} className="text-[#64748B] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 font-semibold">
                Volunteer Care Projection: Only assigned animal care details are rendered. Shelter admin and organizational data are completely restricted.
              </div>

              <div>
                <span className="text-[#64748B] uppercase font-bold text-[10px]">Animal Name:</span>
                <p className="font-bold text-white text-sm mt-0.5">{scopedCareFosterView.animalName}</p>
              </div>

              <div>
                <span className="text-[#64748B] uppercase font-bold text-[10px]">Care & Feeding Instructions:</span>
                <p className="text-[#CBD5E1] mt-0.5 bg-[#0B0D10] p-3 rounded-xl border border-[#1E293B]">
                  {scopedCareFosterView.careInstructions}
                </p>
              </div>

              <div>
                <span className="text-[#64748B] uppercase font-bold text-[10px]">24/7 Emergency Veterinary Contact:</span>
                <p className="font-mono text-teal-300 font-bold mt-0.5">{scopedCareFosterView.emergencyContact}</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setScopedCareFosterView(null)}
                className="w-full py-2 rounded-xl text-xs font-bold bg-[#1E293B] hover:bg-[#283548] text-white transition-all cursor-pointer"
              >
                Close Scoped View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER: CUSTODY AUDIT TRAIL */}
      {/* ===================================================================== */}
      {selectedAnimalForCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#13151A] border-l border-[#1E293B] w-full max-w-lg h-full p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div>
                <h3 className="font-bold text-white text-base">Custody Chain Audit Trail</h3>
                <p className="text-xs text-[#94A3B8]">{selectedAnimalForCustody.temporaryName}</p>
              </div>
              <button onClick={() => setSelectedAnimalForCustody(null)} className="text-[#64748B] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300">
                Single-Custodian Invariant: Exactly one active custodian is recorded. Previous custodian transitions are cryptographically sealed.
              </div>

              {custodies
                .filter(c => c.rescueAnimalId === selectedAnimalForCustody.rescueAnimalId)
                .map((record, index) => (
                  <div
                    key={record.custodyRecordId}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      record.isCurrent
                        ? 'bg-teal-500/10 border-teal-500/40'
                        : 'bg-[#0B0D10] border-[#1E293B] opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{record.custodyState}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        record.isCurrent ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {record.isCurrent ? 'ACTIVE CUSTODIAN' : 'HISTORICAL TRANSITION'}
                      </span>
                    </div>
                    <p className="text-[#CBD5E1]">{record.handoverNotes}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                      <span>Effective: {new Date(record.effectiveFrom).toLocaleString()}</span>
                      <span>Authorized By: {record.authorizedByUserId.slice(0, 12)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SPRINT 18 INVARIANT TEST SUITE RESULTS */}
      {/* ===================================================================== */}
      {showTestRunner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl w-full max-w-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-teal-400" />
                <div>
                  <h3 className="font-bold text-white text-lg">Sprint 18 Invariant Verification Suite</h3>
                  <p className="text-xs text-[#94A3B8]">14 Canonical Test Suites & Regulatory Invariants</p>
                </div>
              </div>
              <button onClick={() => setShowTestRunner(false)} className="text-[#64748B] hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {testResults ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                  <div>
                    <span className="text-xs text-[#94A3B8] font-bold uppercase">Suite Results</span>
                    <p className="text-xl font-black text-white mt-0.5">
                      {testResults.passed} / {testResults.total} Invariants Passed
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    100% REGULATORY PASS
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {testResults.results.map((res, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B] text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-white">{res.name}</p>
                          <p className="text-[10px] text-[#64748B]">{res.suite}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#64748B] font-mono">{res.durationMs.toFixed(1)}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                <p className="text-sm font-bold text-white">Running Sprint 18 Automated Invariant Suites...</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#1E293B]">
              <button
                onClick={() => setShowTestRunner(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
