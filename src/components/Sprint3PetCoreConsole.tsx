import React, { useState, useEffect } from 'react';
import { 
  Dog, 
  Cat, 
  Plus, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  QrCode, 
  Camera, 
  Heart, 
  UserCheck, 
  Archive, 
  RefreshCw, 
  Play, 
  Lock, 
  Sparkles, 
  Sliders, 
  Info,
  BookOpen,
  FileText,
  Search,
  ExternalLink
} from 'lucide-react';
import { PetCoreService } from '../pet-os/pet-core/service';
import { PetStore } from '../pet-os/pet-core/store';
import { ReferenceDataService, BREED_CATALOG } from '../pet-os/pet-core/reference-data';
import { LifecycleEngine } from '../pet-os/pet-core/lifecycle';
import { PetCoreTestSuite, TestResult } from '../pet-os/pet-core/tests';
import { IdentityStore } from '../pet-os/identity/store';
import { 
  PetDetailDto, 
  PetSummaryDto, 
  Sex, 
  ReproductiveStatus, 
  BirthdatePrecision, 
  SizeClassification, 
  PetStatus 
} from '../pet-os/pet-core/types';
import { 
  generateUUIDv7, 
  asUserId, 
  asHouseholdId, 
  asPetId, 
  asPetPhotoId 
} from '../pet-os/kernel/ids';

export const Sprint3PetCoreConsole: React.FC = () => {
  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'pets' | 'breeds' | 'tests' | 'report'>('pets');

  // Multi-Tenant Context Simulation
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'CAREGIVER' | 'OUTSIDER'>('OWNER');
  const [households, setHouseholds] = useState<any[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('');
  const [pets, setPets] = useState<PetSummaryDto[]>([]);
  const [selectedPet, setSelectedPet] = useState<PetDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeceasedModal, setShowDeceasedModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showMicrochipModal, setShowMicrochipModal] = useState(false);

  // Form states for Creation
  const [createForm, setCreateForm] = useState({
    name: '',
    speciesCode: 'SPECIES_DOG',
    breedCode: 'BREED_DOG_AFRICANIS',
    mixedBreed: false,
    unknownBreed: false,
    customBreedName: '',
    sex: 'MALE' as Sex,
    reproductiveStatus: 'STERILIZED' as ReproductiveStatus,
    dateOfBirth: '2022-04-12',
    birthdatePrecision: 'EXACT' as BirthdatePrecision,
    primaryColor: 'Golden Tan',
    secondaryColor: 'White',
    markings: 'White patch on chest and paws',
    coatType: 'Short, smooth',
    sizeClassification: 'MEDIUM' as SizeClassification,
    microchipNumber: '',
    microchipIssuer: 'Kenya Vet Board / Identipet',
    initialPhotoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600'
  });

  // Photo & Microchip Form states
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [microchipInput, setMicrochipInput] = useState({
    number: '',
    issuer: 'Kenyan National Companion Register'
  });
  const [deceasedInput, setDeceasedInput] = useState({
    date: new Date().toISOString().slice(0, 10),
    note: 'Passed away peacefully surrounded by family.'
  });

  // Automated Tests
  const [testReport, setTestReport] = useState<{
    results: TestResult[];
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  } | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Filter for Breed Catalog
  const [breedSearch, setBreedSearch] = useState('');
  const [breedSpeciesFilter, setBreedSpeciesFilter] = useState('ALL');

  // Setup seed environment once
  useEffect(() => {
    bootstrapDefaultData();
  }, []);

  const bootstrapDefaultData = () => {
    // Check if households already exist in IdentityStore
    let hList = IdentityStore.listAllHouseholds();
    if (hList.length === 0) {
      const now = new Date().toISOString();

      // Seed initial households and users
      const ownerUserId = asUserId(generateUUIDv7());
      IdentityStore.saveUser({
        userId: ownerUserId,
        email: 'waweru.kamau@petos.local',
        normalizedEmail: 'waweru.kamau@petos.local',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });
      IdentityStore.saveProfile({
        userId: ownerUserId,
        displayName: 'Waweru Kamau',
        firstName: 'Waweru',
        lastName: 'Kamau',
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      const caregiverUserId = asUserId(generateUUIDv7());
      IdentityStore.saveUser({
        userId: caregiverUserId,
        email: 'amina.caregiver@petos.local',
        normalizedEmail: 'amina.caregiver@petos.local',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });
      IdentityStore.saveProfile({
        userId: caregiverUserId,
        displayName: 'Amina Odhiambo',
        firstName: 'Amina',
        lastName: 'Odhiambo',
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      const outsiderUserId = asUserId(generateUUIDv7());
      IdentityStore.saveUser({
        userId: outsiderUserId,
        email: 'outsider.user@otherdomain.local',
        normalizedEmail: 'outsider.user@otherdomain.local',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });
      IdentityStore.saveProfile({
        userId: outsiderUserId,
        displayName: 'Brian Outside',
        firstName: 'Brian',
        lastName: 'Outside',
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      const hAId = asHouseholdId(generateUUIDv7());
      const hA = {
        householdId: hAId,
        name: 'Kamau Residence Nairobi (Kilimani)',
        ownerUserId: ownerUserId,
        status: 'ACTIVE' as const,
        createdAt: now,
        updatedAt: now
      };
      IdentityStore.saveHousehold(hA);

      const hBId = asHouseholdId(generateUUIDv7());
      const hB = {
        householdId: hBId,
        name: 'Mombasa Coastal Villa',
        ownerUserId: outsiderUserId,
        status: 'ACTIVE' as const,
        createdAt: now,
        updatedAt: now
      };
      IdentityStore.saveHousehold(hB);

      IdentityStore.saveMembership({
        membershipId: generateUUIDv7() as any,
        householdId: hAId,
        userId: ownerUserId,
        role: 'HOUSEHOLD_OWNER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      IdentityStore.saveMembership({
        membershipId: generateUUIDv7() as any,
        householdId: hAId,
        userId: caregiverUserId,
        role: 'CAREGIVER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      IdentityStore.saveMembership({
        membershipId: generateUUIDv7() as any,
        householdId: hBId,
        userId: outsiderUserId,
        role: 'HOUSEHOLD_OWNER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      // Seed 2 initial pets in Household A safely
      const chip1 = '985141001234567';
      const chip2 = '985141009876543';

      if (!PetStore.findActiveMicrochipByNumber(chip1)) {
        PetCoreService.createPet(ownerUserId, hAId, {
          name: 'Simba',
          speciesCode: 'SPECIES_DOG',
          breedCode: 'BREED_DOG_AFRICANIS',
          sex: 'MALE',
          reproductiveStatus: 'STERILIZED',
          dateOfBirth: '2021-08-14',
          birthdatePrecision: 'EXACT',
          primaryColor: 'Golden Brown',
          secondaryColor: 'White Chest',
          markings: 'Distinctive tan markings over ears',
          coatType: 'Short, smooth',
          sizeClassification: 'MEDIUM',
          microchipNumber: chip1,
          microchipIssuer: 'Kenya Vet Board / KES-ID',
          initialPhotoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600'
        }).catch(() => {});
      }

      if (!PetStore.findActiveMicrochipByNumber(chip2)) {
        PetCoreService.createPet(ownerUserId, hAId, {
          name: 'Zawadi',
          speciesCode: 'SPECIES_CAT',
          breedCode: 'BREED_CAT_SIAMESE',
          sex: 'FEMALE',
          reproductiveStatus: 'INTACT',
          dateOfBirth: '2023-01-20',
          birthdatePrecision: 'EXACT',
          primaryColor: 'Cream',
          secondaryColor: 'Seal Point',
          coatType: 'Short, silky',
          sizeClassification: 'SMALL',
          microchipNumber: chip2,
          initialPhotoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600'
        }).catch(() => {});
      }

      hList = [hA, hB];
    }

    setHouseholds(hList);
    if (hList.length > 0) {
      setSelectedHouseholdId(hList[0].householdId);
      refreshPets(hList[0].householdId);
    }
  };

  const getActiveActorId = (): string => {
    const members = IdentityStore.listMembersForHousehold(selectedHouseholdId as any);
    if (currentUserRole === 'OWNER') {
      const owner = members.find(m => m.role === 'HOUSEHOLD_OWNER');
      return owner ? owner.userId : 'user-unknown';
    } else if (currentUserRole === 'CAREGIVER') {
      const cg = members.find(m => m.role === 'CAREGIVER');
      return cg ? cg.userId : 'user-caregiver';
    } else {
      // Outsider user
      const users = IdentityStore.listAllUsers();
      const outsider = users.find(u => u.email.includes('outsider'));
      return outsider ? outsider.userId : 'user-outsider';
    }
  };

  const refreshPets = async (householdId: string) => {
    setLoading(true);
    try {
      const actorId = getActiveActorId();
      const list = await PetCoreService.listPetsForHousehold(actorId, householdId as any, { includeArchived: true });
      setPets(list);
      if (selectedPet) {
        // refresh selected pet detail
        try {
          const detail = await PetCoreService.getPetById(actorId, selectedPet.petId);
          setSelectedPet(detail);
        } catch {
          setSelectedPet(null);
        }
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectPet = async (petId: string) => {
    try {
      const actorId = getActiveActorId();
      const detail = await PetCoreService.getPetById(actorId, asPetId(petId));
      setSelectedPet(detail);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('Pet name is required', 'error');
      return;
    }

    try {
      const actorId = getActiveActorId();
      const newPet = await PetCoreService.createPet(actorId, selectedHouseholdId as any, {
        name: createForm.name,
        speciesCode: createForm.speciesCode,
        breedCode: createForm.unknownBreed || createForm.mixedBreed ? undefined : createForm.breedCode,
        mixedBreed: createForm.mixedBreed,
        unknownBreed: createForm.unknownBreed,
        customBreedName: createForm.customBreedName || undefined,
        sex: createForm.sex,
        reproductiveStatus: createForm.reproductiveStatus,
        dateOfBirth: createForm.dateOfBirth || undefined,
        birthdatePrecision: createForm.birthdatePrecision,
        primaryColor: createForm.primaryColor,
        secondaryColor: createForm.secondaryColor || undefined,
        markings: createForm.markings || undefined,
        coatType: createForm.coatType || undefined,
        sizeClassification: createForm.sizeClassification,
        microchipNumber: createForm.microchipNumber || undefined,
        microchipIssuer: createForm.microchipIssuer || undefined,
        initialPhotoUrl: createForm.initialPhotoUrl || undefined
      });

      showToast(`Digital Twin created for ${newPet.name}!`, 'success');
      setShowCreateModal(false);
      refreshPets(selectedHouseholdId);
      setSelectedPet(newPet);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleArchivePet = async () => {
    if (!selectedPet) return;
    try {
      const actorId = getActiveActorId();
      const updated = await PetCoreService.archivePet(actorId, selectedPet.petId, selectedPet.version);
      setSelectedPet(updated);
      showToast(`${updated.name} has been archived.`, 'info');
      refreshPets(selectedHouseholdId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRestorePet = async () => {
    if (!selectedPet) return;
    try {
      const actorId = getActiveActorId();
      const updated = await PetCoreService.restorePet(actorId, selectedPet.petId, selectedPet.version);
      setSelectedPet(updated);
      showToast(`${updated.name} restored to ACTIVE state!`, 'success');
      refreshPets(selectedHouseholdId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleMarkDeceased = async () => {
    if (!selectedPet) return;
    try {
      const actorId = getActiveActorId();
      const updated = await PetCoreService.markDeceased(
        actorId,
        selectedPet.petId,
        deceasedInput.date,
        deceasedInput.note,
        selectedPet.version
      );
      setSelectedPet(updated);
      setShowDeceasedModal(false);
      showToast(`${updated.name} recorded as deceased (terminal state).`, 'info');
      refreshPets(selectedHouseholdId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedPet || !photoUrlInput.trim()) return;
    try {
      const actorId = getActiveActorId();
      const updated = await PetCoreService.uploadPhoto(actorId, selectedPet.petId, {
        storageKey: photoUrlInput.trim(),
        mimeType: 'image/jpeg',
        fileSize: 1024 * 250,
        purpose: 'GALLERY',
        setAsProfile: true
      });
      setSelectedPet(updated);
      setShowPhotoModal(false);
      setPhotoUrlInput('');
      showToast('Photo uploaded and set as profile photo!', 'success');
      refreshPets(selectedHouseholdId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRegisterMicrochip = async () => {
    if (!selectedPet || !microchipInput.number.trim()) return;
    try {
      const actorId = getActiveActorId();
      const updated = await PetCoreService.registerMicrochip(actorId, selectedPet.petId, {
        microchipNumber: microchipInput.number,
        issuer: microchipInput.issuer
      });
      setSelectedPet(updated);
      setShowMicrochipModal(false);
      showToast('Microchip registered successfully!', 'success');
      refreshPets(selectedHouseholdId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRunAllTests = async () => {
    setRunningTests(true);
    try {
      const res = await PetCoreTestSuite.runAllTests();
      setTestReport(res);
      showToast(`Ran ${res.total} tests: ${res.passed} passed, ${res.failed} failed.`, res.failed === 0 ? 'success' : 'error');
    } catch (err: any) {
      showToast(`Test suite run failed: ${err.message}`, 'error');
    } finally {
      setRunningTests(false);
    }
  };

  // Filtered breeds for reference catalog
  const filteredBreeds = BREED_CATALOG.filter(b => {
    if (breedSpeciesFilter !== 'ALL' && b.speciesCode !== breedSpeciesFilter) return false;
    if (breedSearch.trim()) {
      const q = breedSearch.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q) || b.aliases.some(a => a.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-Tenant Role Switcher */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#312E81] text-[#A5B4FC] border border-[#4338CA]">
                Sprint 3 Feature Domain
              </span>
              <span className="text-xs text-[#94A3B8] font-mono">Pet Core · Digital Twin · RFC 9562</span>
            </div>
            <h1 className="text-2xl font-black text-[#F8FAFC] tracking-tight">
              Pet Core, Digital Twin &amp; Ownership Foundation
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1 max-w-3xl">
              The persistent digital identity of companion animals. Enforces atomic household containment, passive RFID microchips, multi-species reference modeling, dynamic age derivation, and optimistic concurrency.
            </p>
          </div>

          {/* Role & Household Simulator */}
          <div className="bg-[#0B0D10] border border-[#1E293B] p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#64748B] mb-1">
                Active Household
              </label>
              <select
                id="household-selector"
                value={selectedHouseholdId}
                onChange={(e) => {
                  setSelectedHouseholdId(e.target.value);
                  setSelectedPet(null);
                  refreshPets(e.target.value);
                }}
                className="bg-[#13151A] border border-[#334155] text-xs text-[#F1F5F9] rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#A5B4FC] outline-none"
              >
                {households.map(h => (
                  <option key={h.householdId} value={h.householdId}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-wider text-[#64748B] mb-1">
                Simulated Actor Role
              </label>
              <div className="flex items-center gap-1 bg-[#13151A] p-1 rounded-lg border border-[#334155]">
                <button
                  id="role-btn-owner"
                  onClick={() => {
                    setCurrentUserRole('OWNER');
                    refreshPets(selectedHouseholdId);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    currentUserRole === 'OWNER'
                      ? 'bg-[#A5B4FC] text-[#0F1115] font-bold shadow'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  Owner
                </button>
                <button
                  id="role-btn-caregiver"
                  onClick={() => {
                    setCurrentUserRole('CAREGIVER');
                    refreshPets(selectedHouseholdId);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    currentUserRole === 'CAREGIVER'
                      ? 'bg-[#A5B4FC] text-[#0F1115] font-bold shadow'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  Caregiver
                </button>
                <button
                  id="role-btn-outsider"
                  onClick={() => {
                    setCurrentUserRole('OUTSIDER');
                    refreshPets(selectedHouseholdId);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    currentUserRole === 'OUTSIDER'
                      ? 'bg-red-500 text-white font-bold shadow'
                      : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                  }`}
                >
                  Cross-Household Outsider
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Bar */}
        <div className="flex items-center gap-2 border-t border-[#1E293B] mt-6 pt-4">
          <button
            id="subtab-pets"
            onClick={() => setActiveSubTab('pets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'pets'
                ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
            }`}
          >
            <Dog className="w-4 h-4" />
            <span>Pet Registry &amp; Digital Twins ({pets.length})</span>
          </button>

          <button
            id="subtab-breeds"
            onClick={() => setActiveSubTab('breeds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'breeds'
                ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Species &amp; Breeds Reference ({BREED_CATALOG.length})</span>
          </button>

          <button
            id="subtab-tests"
            onClick={() => setActiveSubTab('tests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'tests'
                ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Automated Test Runner</span>
            {testReport && (
              <span className="ml-1 px-1.5 py-0.2 bg-green-500/20 text-green-400 text-[10px] rounded-full">
                {testReport.passed}/{testReport.total}
              </span>
            )}
          </button>

          <button
            id="subtab-report"
            onClick={() => setActiveSubTab('report')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'report'
                ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#1E293B]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Sprint 3 Completion Report</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center gap-3 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : toastMessage.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
          }`}
        >
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />}
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />}
          {toastMessage.type === 'info' && <Info className="w-4 h-4 shrink-0 text-indigo-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* SUBTAB 1: PET REGISTRY & DIGITAL TWINS */}
      {activeSubTab === 'pets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Pet List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-wider font-bold text-[#64748B]">
                Household Pets ({pets.length})
              </h2>
              <button
                id="btn-open-create-pet"
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 bg-[#A5B4FC] hover:bg-[#818CF8] text-[#0F1115] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register Pet</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-[#64748B] bg-[#13151A] rounded-2xl border border-[#1E293B]">
                Loading pets for household...
              </div>
            ) : pets.length === 0 ? (
              <div className="p-8 text-center bg-[#13151A] rounded-2xl border border-[#1E293B]">
                <Dog className="w-10 h-10 text-[#475569] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#F1F5F9]">No pets registered</p>
                <p className="text-xs text-[#64748B] mt-1">Register the first digital twin for this household.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pets.map((p) => {
                  const isSelected = selectedPet?.petId === p.petId;
                  return (
                    <div
                      key={p.petId}
                      id={`pet-card-${p.petId}`}
                      onClick={() => handleSelectPet(p.petId)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${
                        isSelected
                          ? 'bg-[#1E293B] border-[#A5B4FC] shadow-lg shadow-indigo-500/10'
                          : 'bg-[#13151A] border-[#1E293B] hover:border-[#334155] hover:bg-[#181B22]'
                      }`}
                    >
                      {/* Pet Avatar */}
                      <div className="w-14 h-14 rounded-2xl bg-[#0B0D10] overflow-hidden shrink-0 border border-[#334155] flex items-center justify-center">
                        {p.profilePhotoUrl ? (
                          <img
                            src={p.profilePhotoUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : p.speciesCode === 'SPECIES_CAT' ? (
                          <Cat className="w-7 h-7 text-[#A5B4FC]" />
                        ) : (
                          <Dog className="w-7 h-7 text-[#A5B4FC]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#F8FAFC] truncate">{p.name}</h3>
                          {p.status === 'DECEASED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-700 text-zinc-300">
                              Deceased
                            </span>
                          ) : p.status === 'ARCHIVED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Archived
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                          {p.breedName} · {p.speciesName}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0F1115] text-[#A5B4FC] border border-[#1E293B]">
                            {p.derivedAge.display}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0F1115] text-[#94A3B8] border border-[#1E293B]">
                            {p.lifecycleStage}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#0F1115] text-[#94A3B8] border border-[#1E293B]">
                            {p.sex} · {p.reproductiveStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Pet Digital Twin Detail View */}
          <div className="lg:col-span-7">
            {selectedPet ? (
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
                {/* Header Profile Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-2xl bg-[#0B0D10] border border-[#334155] overflow-hidden shrink-0">
                      {selectedPet.profilePhotoUrl ? (
                        <img
                          src={selectedPet.profilePhotoUrl}
                          alt={selectedPet.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Dog className="w-10 h-10 text-[#64748B]" />
                        </div>
                      )}
                      <button
                        onClick={() => setShowPhotoModal(true)}
                        title="Upload photo"
                        className="absolute bottom-1 right-1 p-1 rounded-lg bg-[#0F1115]/80 hover:bg-[#A5B4FC] hover:text-[#0F1115] text-[#E2E8F0] transition-all cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-[#F8FAFC]">{selectedPet.name}</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1E293B] text-[#A5B4FC] border border-[#312E81]">
                          v{selectedPet.version}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] font-mono mt-1">
                        UUIDv7: {selectedPet.petId}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-500/10 text-[#A5B4FC] border border-indigo-500/20">
                          {selectedPet.speciesName} · {selectedPet.breedName}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[#0F1115] text-[#CBD5E1] border border-[#1E293B]">
                          Stage: {selectedPet.lifecycleStage}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Archive, Restore, Mark Deceased) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedPet.status === 'ACTIVE' && (
                      <>
                        <button
                          id="btn-archive-pet"
                          onClick={handleArchivePet}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archive</span>
                        </button>
                        <button
                          id="btn-deceased-modal"
                          onClick={() => setShowDeceasedModal(true)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Mark Deceased</span>
                        </button>
                      </>
                    )}

                    {selectedPet.status === 'ARCHIVED' && (
                      <button
                        id="btn-restore-pet"
                        onClick={handleRestorePet}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Restore Pet</span>
                      </button>
                    )}

                    {selectedPet.status === 'DECEASED' && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Terminal Deceased Record</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Identity & Physical Characteristics Grid */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#64748B] mb-3">
                    Core Digital Twin Identity
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Derived Age</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        {selectedPet.derivedAge.display}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        Precision: {selectedPet.birthdatePrecision}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Sex &amp; Sterilization</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        {selectedPet.sex}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {selectedPet.reproductiveStatus}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Size Category</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        {selectedPet.sizeClassification}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        Coat: {selectedPet.coatType || 'Standard'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Color &amp; Markings</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        {selectedPet.primaryColor}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] truncate block">
                        {selectedPet.markings || 'No markings noted'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Date of Birth</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        {selectedPet.dateOfBirth || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {selectedPet.estimatedBirthdate ? 'Estimated' : 'Confirmed'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                      <span className="block text-[10px] font-bold text-[#64748B] uppercase">Containment</span>
                      <span className="text-sm font-bold text-[#F1F5F9] mt-0.5 block">
                        Atomic Household
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono truncate block">
                        {selectedPet.householdId.slice(0, 18)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passive RFID Microchip Card (Explicit Invariant Check: Microchip != GPS) */}
                <div className="p-4 rounded-2xl bg-[#0B0D10] border border-[#312E81]/60 relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-5 h-5 text-[#A5B4FC]" />
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          Passive RFID Microchip Identity
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1E1B4B] text-[#A5B4FC] border border-[#3730A3]">
                          ISO 11784 / 11785
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1 max-w-xl">
                        A passive RFID transponder used for universal veterinary identification. 
                        <strong className="text-amber-400 font-semibold ml-1">
                          A microchip is NOT a GPS tracker and cannot transmit real-time location.
                        </strong>
                      </p>
                    </div>

                    <button
                      id="btn-register-microchip-modal"
                      onClick={() => setShowMicrochipModal(true)}
                      className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#312E81] text-[#A5B4FC] text-xs font-bold rounded-xl border border-[#3730A3] transition-all cursor-pointer"
                    >
                      {selectedPet.microchip ? 'Update Chip' : 'Attach Microchip'}
                    </button>
                  </div>

                  {selectedPet.microchip ? (
                    <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">Microchip Number</span>
                        <span className="font-mono text-base font-black text-[#A5B4FC] tracking-wider">
                          {selectedPet.microchip.microchipNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">Issuer Registry</span>
                        <span className="text-xs text-[#E2E8F0] font-semibold">
                          {selectedPet.microchip.issuer || 'National Companion Registry'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B] uppercase font-bold block">Verification Status</span>
                        <span className="inline-flex items-center gap-1 text-xs text-green-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{selectedPet.microchip.verificationStatus}</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t border-[#1E293B] text-xs text-[#64748B]">
                      No microchip currently attached to this digital twin.
                    </div>
                  )}
                </div>

                {/* Ownership & Caregiver Relationships */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#64748B] mb-3">
                    Household Relationships &amp; Care Team
                  </h3>
                  <div className="space-y-2">
                    {selectedPet.relationships.map((rel) => (
                      <div
                        key={rel.relationshipId}
                        className="p-3 rounded-xl bg-[#0B0D10] border border-[#1E293B] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center font-bold text-xs text-[#A5B4FC]">
                            {rel.userName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#F1F5F9]">{rel.userName}</span>
                              {rel.isPrimaryContact && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-green-500/20 text-green-400 font-bold border border-green-500/30">
                                  Primary Contact
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#64748B] font-mono">{rel.userId}</span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#13151A] text-[#A5B4FC] border border-[#312E81]">
                          {rel.relationshipType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Photo Gallery */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-[#64748B]">
                      Media Attachments ({selectedPet.photos.length})
                    </h3>
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      className="text-xs font-semibold text-[#A5B4FC] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Photo</span>
                    </button>
                  </div>

                  {selectedPet.photos.length === 0 ? (
                    <p className="text-xs text-[#64748B]">No photo attachments yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {selectedPet.photos.map((ph) => (
                        <div
                          key={ph.photoId}
                          className={`relative group rounded-xl overflow-hidden border aspect-square ${
                            ph.isProfile ? 'border-[#A5B4FC] ring-2 ring-[#A5B4FC]/30' : 'border-[#1E293B]'
                          }`}
                        >
                          <img
                            src={ph.storageKey}
                            alt="Pet"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {ph.isProfile && (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-[#A5B4FC] text-[#0F1115]">
                              Profile
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-12 text-center text-[#64748B]">
                <Dog className="w-12 h-12 text-[#334155] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#F1F5F9]">Select a Pet</h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                  Click on any pet on the left to inspect their complete digital twin, passive RFID microchip, and audit history.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: SPECIES & BREEDS REFERENCE CATALOG */}
      {activeSubTab === 'breeds' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">
                Managed Reference Catalog (Dog &amp; Multi-Species)
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Volume V &amp; XXXVIII authoritative reference data with Kenya-first landrace and working dog integration.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
                <input
                  id="breed-search-input"
                  type="text"
                  placeholder="Search breed or alias..."
                  value={breedSearch}
                  onChange={(e) => setBreedSearch(e.target.value)}
                  className="bg-[#0B0D10] border border-[#334155] text-xs text-[#F1F5F9] rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[#A5B4FC]"
                />
              </div>

              <select
                id="breed-species-filter"
                value={breedSpeciesFilter}
                onChange={(e) => setBreedSpeciesFilter(e.target.value)}
                className="bg-[#0B0D10] border border-[#334155] text-xs text-[#F1F5F9] rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#A5B4FC]"
              >
                <option value="ALL">All Species</option>
                <option value="SPECIES_DOG">Dogs Only</option>
                <option value="SPECIES_CAT">Cats Only</option>
                <option value="SPECIES_RABBIT">Rabbits</option>
                <option value="SPECIES_BIRD">Birds</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBreeds.map((breed) => (
              <div
                key={breed.code}
                className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] hover:border-[#334155] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#F1F5F9]">{breed.name}</h3>
                    <span className="text-[10px] text-[#A5B4FC] font-mono block mt-0.5">
                      {breed.code}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#13151A] text-[#94A3B8] border border-[#334155]">
                    {breed.sizeCategory}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-[#94A3B8]">
                  {breed.origin && (
                    <p>
                      <span className="text-[#64748B]">Origin:</span> {breed.origin}
                    </p>
                  )}
                  {breed.coatType && (
                    <p>
                      <span className="text-[#64748B]">Coat:</span> {breed.coatType}
                    </p>
                  )}
                  {breed.aliases && breed.aliases.length > 0 && (
                    <p className="text-[11px] text-[#64748B]">
                      Aliases: {breed.aliases.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: AUTOMATED TEST SUITE RUNNER */}
      {activeSubTab === 'tests' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#F8FAFC]">
                Sprint 3 Automated Verification Test Suite
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                18 comprehensive integration tests covering cross-household authorization, microchip uniqueness, leap years, optimistic concurrency, and lifecycle state machines.
              </p>
            </div>

            <button
              id="btn-run-all-tests"
              onClick={handleRunAllTests}
              disabled={runningTests}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#A5B4FC] hover:bg-[#818CF8] text-[#0F1115] flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{runningTests ? 'Running Suite...' : 'Execute Test Suite'}</span>
            </button>
          </div>

          {testReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Total Tests</span>
                <span className="text-xl font-black text-[#F8FAFC] block mt-1">{testReport.total}</span>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D10] border border-green-500/30">
                <span className="text-[10px] font-bold text-green-400 uppercase">Passed</span>
                <span className="text-xl font-black text-green-400 block mt-1">{testReport.passed}</span>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D10] border border-red-500/30">
                <span className="text-[10px] font-bold text-red-400 uppercase">Failed</span>
                <span className="text-xl font-black text-red-400 block mt-1">{testReport.failed}</span>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Execution Duration</span>
                <span className="text-xl font-black text-[#A5B4FC] block mt-1">{testReport.durationMs} ms</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {(testReport?.results || []).map((t, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0B0D10] border border-[#1E293B] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-[#F1F5F9]">{t.name}</span>
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      Category: {t.category} · {t.message}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#94A3B8]">{t.durationMs}ms</span>
              </div>
            ))}
            {!testReport && (
              <div className="p-8 text-center text-xs text-[#64748B]">
                Click "Execute Test Suite" to run the full verification engine.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: SPRINT 3 COMPLETION REPORT */}
      {activeSubTab === 'report' && (
        <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-[#1E293B] pb-4">
            <h2 className="text-lg font-black text-[#F8FAFC]">
              Sprint 3 Completion Report: Pet Core &amp; Digital Twin Foundation
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1 font-mono">
              Status: VERIFIED &amp; COMPLIANT · Version: v0.4.0 · Volumes: V, VI, XXI, XXVII, XXVIII, XXX, XXXI
            </p>
          </div>

          <div className="space-y-4 text-xs text-[#CBD5E1] leading-relaxed">
            <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
              <h3 className="font-bold text-sm text-[#A5B4FC] mb-2">1. Architectural Invariants Enforced</h3>
              <ul className="list-disc list-inside space-y-1 text-[#94A3B8]">
                <li><strong>No Pet Without Household (PETV-INV-001):</strong> Guaranteed at domain, schema, and API levels via foreign key and transactional repository containment.</li>
                <li><strong>No Future Birthdate (PETV-INV-002):</strong> Calendar validation rejects future dates and handles leap years accurately.</li>
                <li><strong>Species / Breed Matching (PETV-INV-003):</strong> Validates species catalog and rejects cross-species mismatch unless explicitly flagged as mixed/unknown.</li>
                <li><strong>Terminal Deceased Status (PETV-INV-004):</strong> Once a pet transitions to DECEASED, the state machine strictly blocks reversal to ACTIVE or MISSING.</li>
                <li><strong>Passive RFID Microchip Only (ADR &amp; Volume XXI):</strong> Contractually invariant that microchips are passive RFID (ISO 11784/11785) and NOT GPS location trackers.</li>
                <li><strong>Microchip Global Uniqueness:</strong> Enforced across active pets with privacy-safe duplicate rejection.</li>
                <li><strong>Multi-Tenant Cross-Household Isolation:</strong> Cross-household pet retrieval or mutation is blocked by AuthorizationService.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B]">
              <h3 className="font-bold text-sm text-[#A5B4FC] mb-2">2. Deliverables &amp; Files Generated</h3>
              <ul className="list-disc list-inside space-y-1 font-mono text-[#94A3B8]">
                <li>/src/pet-os/pet-core/types.ts - Domain entities, value objects, and safe DTOs</li>
                <li>/src/pet-os/pet-core/reference-data.ts - Managed species and 30+ breed catalog</li>
                <li>/src/pet-os/pet-core/lifecycle.ts - Dynamic age calculation, stage engine &amp; state machine</li>
                <li>/src/pet-os/pet-core/events.ts - Domain events with Outbox payload wrapping</li>
                <li>/src/pet-os/pet-core/store.ts - Transactional repository &amp; audit logging</li>
                <li>/src/pet-os/pet-core/service.ts - Use cases for creation, update, microchips, and photos</li>
                <li>/src/pet-os/pet-core/schema.sql - PostgreSQL 16+ DDL migration 0003_pet_core.sql</li>
                <li>/src/pet-os/pet-core/tests.ts - Automated test suite with 18 assertions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PET MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
              <h3 className="text-base font-bold text-[#F8FAFC]">Register New Pet Digital Twin</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#64748B] hover:text-[#E2E8F0] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Pet Name *</label>
                <input
                  id="create-pet-name"
                  type="text"
                  required
                  placeholder="e.g. Simba"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none focus:ring-2 focus:ring-[#A5B4FC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Species *</label>
                  <select
                    id="create-pet-species"
                    value={createForm.speciesCode}
                    onChange={(e) => {
                      const newSpecies = e.target.value;
                      const breeds = ReferenceDataService.getBreedsForSpecies(newSpecies);
                      setCreateForm({
                        ...createForm,
                        speciesCode: newSpecies,
                        breedCode: breeds[0]?.code || ''
                      });
                    }}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option value="SPECIES_DOG">Dog (Canine)</option>
                    <option value="SPECIES_CAT">Cat (Feline)</option>
                    <option value="SPECIES_RABBIT">Rabbit</option>
                    <option value="SPECIES_BIRD">Bird</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Breed</label>
                  <select
                    id="create-pet-breed"
                    disabled={createForm.mixedBreed || createForm.unknownBreed}
                    value={createForm.breedCode}
                    onChange={(e) => setCreateForm({ ...createForm, breedCode: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none disabled:opacity-50"
                  >
                    {ReferenceDataService.getBreedsForSpecies(createForm.speciesCode).map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mixed / Unknown Toggles */}
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8]">
                  <input
                    type="checkbox"
                    checked={createForm.mixedBreed}
                    onChange={(e) => setCreateForm({ ...createForm, mixedBreed: e.target.checked })}
                    className="rounded bg-[#0B0D10] border-[#334155] text-[#A5B4FC]"
                  />
                  <span>Mixed Breed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8]">
                  <input
                    type="checkbox"
                    checked={createForm.unknownBreed}
                    onChange={(e) => setCreateForm({ ...createForm, unknownBreed: e.target.checked })}
                    className="rounded bg-[#0B0D10] border-[#334155] text-[#A5B4FC]"
                  />
                  <span>Unknown Breed</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Sex</label>
                  <select
                    value={createForm.sex}
                    onChange={(e) => setCreateForm({ ...createForm, sex: e.target.value as Sex })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Sterilization Status</label>
                  <select
                    value={createForm.reproductiveStatus}
                    onChange={(e) => setCreateForm({ ...createForm, reproductiveStatus: e.target.value as ReproductiveStatus })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option value="STERILIZED">Sterilized (Neutered / Spayed)</option>
                    <option value="INTACT">Intact</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Date of Birth</label>
                  <input
                    type="date"
                    value={createForm.dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Precision</label>
                  <select
                    value={createForm.birthdatePrecision}
                    onChange={(e) => setCreateForm({ ...createForm, birthdatePrecision: e.target.value as BirthdatePrecision })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option value="EXACT">Exact Day</option>
                    <option value="ESTIMATED_MONTH_YEAR">Estimated Month/Year</option>
                    <option value="ESTIMATED_YEAR">Estimated Year</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Primary Color *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Golden Tan"
                    value={createForm.primaryColor}
                    onChange={(e) => setCreateForm({ ...createForm, primaryColor: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Size Classification</label>
                  <select
                    value={createForm.sizeClassification}
                    onChange={(e) => setCreateForm({ ...createForm, sizeClassification: e.target.value as SizeClassification })}
                    className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                  >
                    <option value="TOY">Toy (&lt;5kg)</option>
                    <option value="SMALL">Small (5-10kg)</option>
                    <option value="MEDIUM">Medium (10-25kg)</option>
                    <option value="LARGE">Large (25-45kg)</option>
                    <option value="GIANT">Giant (&gt;45kg)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">
                  Passive RFID Microchip (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 985141001234567"
                  value={createForm.microchipNumber}
                  onChange={(e) => setCreateForm({ ...createForm, microchipNumber: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                />
                <span className="text-[10px] text-[#64748B] mt-0.5 block">
                  ISO 11784/11785 15-digit passive transponder. Not a GPS device.
                </span>
              </div>

              <div className="pt-4 border-t border-[#1E293B] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  id="submit-create-pet"
                  type="submit"
                  className="px-4 py-2 bg-[#A5B4FC] hover:bg-[#818CF8] text-[#0F1115] text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Create Digital Twin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK DECEASED MODAL */}
      {showDeceasedModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <Heart className="w-6 h-6" />
              <h3 className="text-base font-bold text-[#F8FAFC]">Record Pet Passing</h3>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Pet OS handles the passing of companion animals with solemnity.
              <strong className="text-red-400 block mt-1">
                Notice: Marking a pet as DECEASED is a terminal state (PETV-INV-004) and cannot be reversed.
              </strong>
            </p>

            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Date of Passing</label>
                <input
                  type="date"
                  value={deceasedInput.date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDeceasedInput({ ...deceasedInput, date: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Memorial Note</label>
                <textarea
                  rows={3}
                  value={deceasedInput.note}
                  onChange={(e) => setDeceasedInput({ ...deceasedInput, note: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#1E293B] flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowDeceasedModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B]"
              >
                Cancel
              </button>
              <button
                id="submit-mark-deceased"
                onClick={handleMarkDeceased}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Confirm Terminal Deceased State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO UPLOAD MODAL */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
              <h3 className="text-base font-bold text-[#F8FAFC]">Upload Pet Photo</h3>
              <button onClick={() => setShowPhotoModal(false)} className="text-[#64748B] cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Photo Image URL</label>
                <input
                  id="photo-url-input"
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none focus:ring-2 focus:ring-[#A5B4FC]"
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">
                  Accepted formats: JPEG, PNG, WebP. Maximum file size: 10MB.
                </span>
              </div>

              <div className="pt-3 border-t border-[#1E293B] flex justify-end gap-3">
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  id="submit-upload-photo"
                  onClick={handleUploadPhoto}
                  className="px-4 py-2 bg-[#A5B4FC] hover:bg-[#818CF8] text-[#0F1115] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Set as Profile Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER MICROCHIP MODAL */}
      {showMicrochipModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3 mb-4">
              <h3 className="text-base font-bold text-[#F8FAFC]">Register / Update Microchip</h3>
              <button onClick={() => setShowMicrochipModal(false)} className="text-[#64748B] cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">
                  Microchip Number (9 to 15 digits) *
                </label>
                <input
                  id="microchip-number-input"
                  type="text"
                  placeholder="e.g. 985141001234567"
                  value={microchipInput.number}
                  onChange={(e) => setMicrochipInput({ ...microchipInput, number: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1 uppercase">Registry Issuer</label>
                <input
                  type="text"
                  value={microchipInput.issuer}
                  onChange={(e) => setMicrochipInput({ ...microchipInput, issuer: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#334155] rounded-xl px-3 py-2 text-xs text-[#F1F5F9] outline-none"
                />
              </div>

              <div className="p-3 bg-[#0B0D10] rounded-xl border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>Microchips are passive radio-frequency identifiers. They do not hold batteries or broadcast GPS.</span>
              </div>

              <div className="pt-3 border-t border-[#1E293B] flex justify-end gap-3">
                <button
                  onClick={() => setShowMicrochipModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B]"
                >
                  Cancel
                </button>
                <button
                  id="submit-register-microchip"
                  onClick={handleRegisterMicrochip}
                  className="px-4 py-2 bg-[#A5B4FC] hover:bg-[#818CF8] text-[#0F1115] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Save Microchip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
