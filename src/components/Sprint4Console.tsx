import React, { useState, useEffect, useRef } from 'react';
import { 
  Dog, 
  Clock, 
  FileText, 
  Shield, 
  ShieldCheck, 
  Key, 
  Share2, 
  Download, 
  Upload, 
  History, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  Play, 
  Lock, 
  Sparkles, 
  BookOpen, 
  Calendar, 
  FileCheck, 
  Copy, 
  UserCheck, 
  Users,
  ChevronRight,
  Archive,
  Info
} from 'lucide-react';
import { TimelineService } from '../pet-os/timeline/service';
import { TimelineStore } from '../pet-os/timeline/store';
import { TimelineEvent, TimelineEventCategory, TimelineSourceDomain } from '../pet-os/timeline/types';
import { DocumentService } from '../pet-os/documents/service';
import { DocumentStore } from '../pet-os/documents/store';
import { PetDocument, PetDocumentType, isDocumentExpired, isDocumentExpiringSoon } from '../pet-os/documents/types';
import { PassportService } from '../pet-os/passport/service';
import { PassportStore } from '../pet-os/passport/store';
import { PetPassportReadModel, PassportShareScope, PassportShareToken } from '../pet-os/passport/types';
import { PetCoreService } from '../pet-os/pet-core/service';
import { PetStore } from '../pet-os/pet-core/store';
import { PetDetailDto, PetSummaryDto } from '../pet-os/pet-core/types';
import { IdentityStore } from '../pet-os/identity/store';
import { Sprint4TestSuite, TestResult } from '../pet-os/sprint4/tests';
import { asUserId, asHouseholdId, asPetId, generateUUIDv7 } from '../pet-os/kernel/ids';

export const Sprint4Console: React.FC = () => {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'documents' | 'passport' | 'tests' | 'report'>('passport');

  // Multi-Tenant Context Simulation
  const [actorRole, setActorRole] = useState<'OWNER' | 'CAREGIVER' | 'OUTSIDER'>('OWNER');
  const [pets, setPets] = useState<PetSummaryDto[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedPet, setSelectedPet] = useState<PetDetailDto | null>(null);

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineCategory, setTimelineCategory] = useState<string>('ALL');
  const [timelineSearch, setTimelineSearch] = useState<string>('');
  const [timelineSortAsc, setTimelineSortAsc] = useState<boolean>(false);
  const [newObsTitle, setNewObsTitle] = useState<string>('');
  const [newObsSummary, setNewObsSummary] = useState<string>('');
  const [newObsCategory, setNewObsCategory] = useState<TimelineEventCategory>('ACTIVITY');
  const [showObsModal, setShowObsModal] = useState<boolean>(false);

  // Documents State
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadType, setUploadType] = useState<PetDocumentType>('VACCINATION_CERTIFICATE');
  const [uploadOrg, setUploadOrg] = useState<string>('Nairobi Veterinary Hospital');
  const [uploadFilename, setUploadFilename] = useState<string>('rabies_cert.pdf');
  const [uploadFileContent, setUploadFileContent] = useState<string>('%PDF-1.4 Official rabies vaccination certificate details');
  const [downloadGrantMessage, setDownloadGrantMessage] = useState<string | null>(null);

  // Passport State
  const [passportScope, setPassportScope] = useState<PassportShareScope>('PRIVATE');
  const [passport, setPassport] = useState<PetPassportReadModel | null>(null);
  const [shares, setShares] = useState<PassportShareToken[]>([]);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareScope, setShareScope] = useState<PassportShareScope>('CARE_PROVIDER_SHARE');
  const [shareRecipient, setShareRecipient] = useState<string>('Karen Pet Boarding');
  const [shareHours, setShareHours] = useState<number>(72);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [resolvedSharedPassport, setResolvedSharedPassport] = useState<any | null>(null);
  const [inspectTokenInput, setInspectTokenInput] = useState<string>('');

  // Test Suite State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testsRunning, setTestsRunning] = useState<boolean>(false);
  const [testSummary, setTestSummary] = useState<{ total: number; passed: number; failed: number; durationMs: number } | null>(null);

  // Notifications / Feedback
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initial Data Seeding
  const seedingRef = useRef(false);

  useEffect(() => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    seedSprint4Data();
  }, []);

  const seedSprint4Data = async () => {
    try {
      const hhAId = asHouseholdId('hh-sprint4-main');
      const hhBId = asHouseholdId('hh-sprint4-outsider');
      const ownerAId = asUserId('usr-alice-owner');
      const caregiverAId = asUserId('usr-bob-caregiver');
      const outsiderBId = asUserId('usr-charlie-outsider');

      const now = new Date().toISOString();

      // Setup Identity Store
      IdentityStore.saveUser({
        userId: ownerAId,
        email: 'alice@wambuipets.co.ke',
        normalizedEmail: 'alice@wambuipets.co.ke',
        phoneNumber: '+254 712 345 678',
        passwordHash: 'hash_alice',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });

      IdentityStore.saveProfile({
        userId: ownerAId,
        displayName: 'Alice Wambui (Household Owner)',
        firstName: 'Alice',
        lastName: 'Wambui',
        avatarUrl: undefined,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      IdentityStore.saveUser({
        userId: caregiverAId,
        email: 'bob@caregiving.co.ke',
        normalizedEmail: 'bob@caregiving.co.ke',
        phoneNumber: '+254 722 987 654',
        passwordHash: 'hash_bob',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });

      IdentityStore.saveProfile({
        userId: caregiverAId,
        displayName: 'Bob Otieno (Caregiver)',
        firstName: 'Bob',
        lastName: 'Otieno',
        avatarUrl: undefined,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      IdentityStore.saveUser({
        userId: outsiderBId,
        email: 'charlie@otherdomain.com',
        normalizedEmail: 'charlie@otherdomain.com',
        phoneNumber: '+254 733 111 222',
        passwordHash: 'hash_charlie',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });

      IdentityStore.saveProfile({
        userId: outsiderBId,
        displayName: 'Charlie Njoroge (Outsider B)',
        firstName: 'Charlie',
        lastName: 'Njoroge',
        avatarUrl: undefined,
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      IdentityStore.saveHousehold({
        householdId: hhAId,
        name: 'Wambui Residence (Nairobi)',
        status: 'ACTIVE',
        ownerUserId: ownerAId,
        createdAt: now,
        updatedAt: now
      });

      IdentityStore.saveHousehold({
        householdId: hhBId,
        name: 'Mombasa Coastal Sanctuary',
        status: 'ACTIVE',
        ownerUserId: outsiderBId,
        createdAt: now,
        updatedAt: now
      });

      IdentityStore.saveMembership({
        membershipId: 'mem-a1' as any,
        householdId: hhAId,
        userId: ownerAId,
        role: 'HOUSEHOLD_OWNER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      IdentityStore.saveMembership({
        membershipId: 'mem-a2' as any,
        householdId: hhAId,
        userId: caregiverAId,
        role: 'CAREGIVER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      IdentityStore.saveMembership({
        membershipId: 'mem-b1' as any,
        householdId: hhBId,
        userId: outsiderBId,
        role: 'HOUSEHOLD_OWNER',
        status: 'ACTIVE',
        joinedAt: now,
        updatedAt: now
      });

      // Create Pets in Household A if empty
      let existingPets = await PetCoreService.listPetsForHousehold(ownerAId, hhAId);
      if (existingPets.length === 0) {
        const simbaChip = '985141004455667';
        const nalaChip = '985141004455668';

        const existingChip1 = PetStore.findActiveMicrochipByNumber(simbaChip);
        const existingChip2 = PetStore.findActiveMicrochipByNumber(nalaChip);

        let pet1: any = existingChip1 ? existingChip1.pet : null;
        if (!pet1) {
          try {
            pet1 = await PetCoreService.createPet(ownerAId, hhAId, {
              name: 'Simba',
              speciesCode: 'SPECIES_DOG',
              breedCode: 'BREED_DOG_GERMAN_SHEPHERD',
              sex: 'MALE',
              reproductiveStatus: 'STERILIZED',
              birthdatePrecision: 'EXACT',
              dateOfBirth: '2022-04-12',
              primaryColor: 'SABLE',
              secondaryColor: 'BLACK',
              sizeClassification: 'LARGE',
              microchipNumber: simbaChip,
              microchipIssuer: 'KVA RFID Registry'
            });
          } catch (e) {
            const recheck = PetStore.findActiveMicrochipByNumber(simbaChip);
            if (recheck) pet1 = recheck.pet;
            else console.warn('Could not create or recheck Simba:', e);
          }
        }

        let pet2: any = existingChip2 ? existingChip2.pet : null;
        if (!pet2) {
          try {
            pet2 = await PetCoreService.createPet(ownerAId, hhAId, {
              name: 'Nala',
              speciesCode: 'SPECIES_DOG',
              breedCode: 'BREED_DOG_LABRADOR',
              sex: 'FEMALE',
              reproductiveStatus: 'STERILIZED',
              birthdatePrecision: 'ESTIMATED_MONTH_YEAR',
              dateOfBirth: '2023-01-01',
              primaryColor: 'YELLOW',
              sizeClassification: 'LARGE',
              microchipNumber: nalaChip,
              microchipIssuer: 'East Africa Animal Health'
            });
          } catch (e) {
            const recheck = PetStore.findActiveMicrochipByNumber(nalaChip);
            if (recheck) pet2 = recheck.pet;
            else console.warn('Could not create or recheck Nala:', e);
          }
        }

        // Seed initial documents for Simba if none exist
        const existingDocs = DocumentStore.listForPet(pet1.petId);
        if (existingDocs.length === 0) {
          await DocumentService.uploadDocument(ownerAId, {
            petId: pet1.petId,
            documentType: 'VACCINATION_CERTIFICATE',
            title: 'Rabies Vaccination Certificate (3-Year)',
            description: 'Official KVA certified rabies vaccination',
            originalFilename: 'simba_rabies_cert_2024.pdf',
            mediaType: 'application/pdf',
            fileData: '%PDF-1.4 Nairobi West Vet Rabies Certification',
            issuedAt: '2024-01-15',
            expiresAt: '2027-01-15',
            issuingOrganization: 'Nairobi West Veterinary Clinic',
            provenanceType: 'OWNER_ENTERED'
          });

          await DocumentService.uploadDocument(ownerAId, {
            petId: pet1.petId,
            documentType: 'MICROCHIP_CERTIFICATE',
            title: 'Official Microchip Implantation Certificate',
            description: '15-digit ISO 11784/11785 RFID registration form',
            originalFilename: 'microchip_reg_simba.pdf',
            mediaType: 'application/pdf',
            fileData: `%PDF-1.4 RFID Chip ${simbaChip} Certification`,
            issuedAt: '2022-06-20',
            issuingOrganization: 'Kenya Veterinary Association',
            provenanceType: 'OWNER_ENTERED'
          });

          // Seed historical timeline events
          TimelineService.recordEvent({
            petId: pet1.petId,
            householdId: hhAId,
            eventType: 'pet.adoption',
            eventCategory: 'LIFECYCLE',
            occurredAt: '2022-06-10T09:00:00Z',
            recordedAt: new Date().toISOString(),
            sourceDomain: 'PET_CORE',
            sourceEntityType: 'adoption_record',
            sourceEntityId: 'adopt-simba',
            sourceActorType: 'USER',
            sourceActorId: ownerAId,
            provenanceType: 'OWNER_ENTERED',
            title: 'Adoption from KSPCA Nairobi Shelter',
            summary: 'Simba was welcomed into the Wambui family at 8 weeks old.',
            deduplicationKey: 'LIFECYCLE:adoption:simba-2022'
          });
        }

        existingPets = [pet1, pet2];
      }

      setPets(existingPets);
      if (existingPets.length > 0) {
        setSelectedPetId(existingPets[0].petId);
      }
    } catch (err) {
      console.error('Error seeding Sprint 4 data:', err);
    }
  };

  // Current Actor based on Actor Role selector
  const getCurrentActorId = (): string => {
    if (actorRole === 'OWNER') return 'usr-alice-owner';
    if (actorRole === 'CAREGIVER') return 'usr-bob-caregiver';
    return 'usr-charlie-outsider';
  };

  // Refresh current pet data
  useEffect(() => {
    if (!selectedPetId) return;
    refreshData();
  }, [selectedPetId, actorRole, passportScope]);

  const refreshData = async () => {
    if (!selectedPetId) return;
    const actorId = getCurrentActorId();
    const currentPetId = asPetId(selectedPetId);

    try {
      // Pet details
      const detail = await PetCoreService.getPetById(actorId, currentPetId);
      setSelectedPet(detail);

      // Timeline
      const tl = TimelineService.listPetTimeline(actorId, currentPetId, {
        category: timelineCategory === 'ALL' ? undefined : (timelineCategory as TimelineEventCategory),
        search: timelineSearch || undefined,
        ascending: timelineSortAsc
      });
      setTimelineEvents(tl.events);

      // Documents
      const docs = DocumentService.listDocuments(actorId, currentPetId, {
        documentType: docTypeFilter === 'ALL' ? undefined : (docTypeFilter as PetDocumentType)
      });
      setDocuments(docs);

      // Passport
      const pass = await PassportService.generatePassport(actorId, currentPetId, passportScope);
      setPassport(pass);

      // Shares
      const activeShares = PassportService.listShares(actorId, currentPetId);
      setShares(activeShares);

      setActionNotice(null);
    } catch (err: any) {
      console.warn('Refresh error (expected for outsider tests):', err.message);
      setActionNotice({ type: 'error', message: err.message });
      setSelectedPet(null);
      setTimelineEvents([]);
      setDocuments([]);
      setPassport(null);
    }
  };

  // Record Manual Observation
  const handleAddObservation = () => {
    if (!selectedPetId || !newObsTitle.trim() || !newObsSummary.trim()) return;
    try {
      const actorId = getCurrentActorId();
      TimelineService.recordManualObservation(
        actorId,
        asPetId(selectedPetId),
        newObsTitle,
        newObsSummary,
        newObsCategory
      );
      setNewObsTitle('');
      setNewObsSummary('');
      setShowObsModal(false);
      setActionNotice({ type: 'success', message: 'Observation recorded into pet timeline with OWNER_ENTERED provenance.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message });
    }
  };

  // Upload Document
  const handleUploadDocument = async () => {
    if (!selectedPetId || !uploadTitle.trim()) return;
    try {
      const actorId = getCurrentActorId();
      await DocumentService.uploadDocument(actorId, {
        petId: asPetId(selectedPetId),
        documentType: uploadType,
        title: uploadTitle,
        originalFilename: uploadFilename,
        mediaType: uploadFilename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        fileData: uploadFileContent,
        issuingOrganization: uploadOrg,
        provenanceType: 'OWNER_ENTERED'
      });
      setShowUploadModal(false);
      setUploadTitle('');
      setActionNotice({ type: 'success', message: 'Document verified, stored in secure private repository, and projected into Timeline.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message });
    }
  };

  // Download Document simulator
  const handleDownload = (docId: any) => {
    try {
      const actorId = getCurrentActorId();
      const grant = DocumentService.generateSecureDownloadGrant(actorId, asPetId(selectedPetId), docId);
      setDownloadGrantMessage(`Signed Download Token Issued: ${grant.grantToken.slice(0, 16)}... (15-min expiry). Storage Key never exposed.`);
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message });
    }
  };

  // Create Passport Share
  const handleCreateShare = async () => {
    if (!selectedPetId) return;
    try {
      const actorId = getCurrentActorId();
      const res = await PassportService.createShareToken(actorId, {
        petId: asPetId(selectedPetId),
        scope: shareScope,
        expiresInHours: shareHours,
        recipientLabel: shareRecipient
      });
      setCreatedShareLink(res.shareUrl);
      setInspectTokenInput(res.shareToken.token);
      setShowShareModal(false);
      setActionNotice({ type: 'success', message: `Share link generated with scope ${shareScope}.` });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message });
    }
  };

  // Inspect Shared Token
  const handleInspectToken = async () => {
    if (!inspectTokenInput.trim()) return;
    try {
      const res = await PassportService.resolveSharedPassport(inspectTokenInput.trim());
      setResolvedSharedPassport(res);
      setActionNotice({ type: 'success', message: 'Shared passport token resolved and projected.' });
    } catch (err: any) {
      setResolvedSharedPassport(null);
      setActionNotice({ type: 'error', message: err.message });
    }
  };

  // Run Test Suite
  const handleRunTests = async () => {
    setTestsRunning(true);
    try {
      const summary = await Sprint4TestSuite.runAll();
      setTestResults(summary.results);
      setTestSummary({
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        durationMs: summary.durationMs
      });
      // Refresh app data after test runs
      await seedSprint4Data();
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setTestsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-Tenant Control Strip */}
      <div className="bg-[#131720] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20">
                SPRINT 4
              </span>
              <h1 className="text-xl font-bold text-[#F8FAFC] tracking-tight">
                Pet Lifecycle Timeline, Documents &amp; Digital Passport
              </h1>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Longitudinal historical record, secure document repository, and controlled read-model passport.
            </p>
          </div>

          {/* Actor Role Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 bg-[#0B0D10] border border-[#1E293B] p-1 rounded-xl text-xs">
              <span className="text-[10px] uppercase font-bold text-[#64748B] px-2">Actor Role:</span>
              <button
                onClick={() => setActorRole('OWNER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  actorRole === 'OWNER'
                    ? 'bg-[#6366F1] text-white shadow-md shadow-indigo-500/30'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Alice (Owner)
              </button>
              <button
                onClick={() => setActorRole('CAREGIVER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  actorRole === 'CAREGIVER'
                    ? 'bg-[#6366F1] text-white shadow-md shadow-indigo-500/30'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Bob (Caregiver)
              </button>
              <button
                onClick={() => setActorRole('OUTSIDER')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  actorRole === 'OUTSIDER'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                    : 'text-[#94A3B8] hover:text-rose-400'
                }`}
              >
                Charlie (Outsider B)
              </button>
            </div>

            {/* Pet Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#64748B] hidden sm:inline">Active Pet:</span>
              <select
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
                className="bg-[#0B0D10] border border-[#1E293B] text-xs font-semibold text-[#F1F5F9] rounded-xl px-3 py-2 outline-none focus:border-[#6366F1]"
              >
                {pets.map((p) => (
                  <option key={p.petId} value={p.petId}>
                    {p.name} ({p.breedName || p.breedCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionNotice && (
          <div className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            actionNotice.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
          }`}>
            {actionNotice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.message}</span>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1E293B] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('passport')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'passport'
              ? 'bg-[#1E1B4B] text-[#A5B4FC] border border-[#4338CA]'
              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Digital Pet Passport</span>
        </button>

        <button
          onClick={() => setActiveSubTab('timeline')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'timeline'
              ? 'bg-[#1E1B4B] text-[#A5B4FC] border border-[#4338CA]'
              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Unified Pet Timeline</span>
        </button>

        <button
          onClick={() => setActiveSubTab('documents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'documents'
              ? 'bg-[#1E1B4B] text-[#A5B4FC] border border-[#4338CA]'
              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Document Repository</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'tests'
              ? 'bg-[#1E1B4B] text-[#A5B4FC] border border-[#4338CA]'
              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Verification Test Suite (14 Invariants)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('report')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'report'
              ? 'bg-[#1E1B4B] text-[#A5B4FC] border border-[#4338CA]'
              : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Architecture Report</span>
        </button>
      </div>

      {/* SUB-TAB: PASSPORT */}
      {activeSubTab === 'passport' && (
        <div className="space-y-6">
          {/* Passport Scope & Action Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#131720] border border-[#1E293B] p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#64748B]">Passport Privacy Scope:</span>
              <div className="flex items-center bg-[#0B0D10] border border-[#1E293B] p-1 rounded-xl text-xs">
                {(['PRIVATE', 'CARE_PROVIDER_SHARE', 'FINDER_RECOVERY', 'TRAVEL_EXPORT'] as PassportShareScope[]).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setPassportScope(scope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      passportScope === scope
                        ? 'bg-[#6366F1] text-white'
                        : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {(scope || '').replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#6366F1] text-white flex items-center gap-1.5 hover:bg-[#4F46E5] transition-all cursor-pointer shadow-md shadow-indigo-500/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Create Share Link</span>
              </button>
            </div>
          </div>

          {/* Render Passport Projection */}
          {passport ? (
            <div className="bg-[#131720] border border-[#1E293B] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              {/* Passport Header Strip */}
              <div className="border-b border-[#1E293B] pb-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
                    {passport.name.slice(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-extrabold text-white">{passport.name}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {passport.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        SCOPE: {passport.scope}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      {passport.speciesName} · {passport.breedName} · {passport.sex} · {passport.reproductiveStatus}
                    </p>
                  </div>
                </div>

                {/* QR / NFC Verification Badge */}
                <div className="flex items-center gap-3 bg-[#0B0D10] border border-[#1E293B] px-4 py-2.5 rounded-2xl">
                  <QrCode className="w-8 h-8 text-[#A5B4FC]" />
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#64748B]">Digital Verification</div>
                    <div className="text-xs font-mono font-bold text-emerald-400">PASSPORT-V1 VALID</div>
                  </div>
                </div>
              </div>

              {/* Passport Body Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Physical & Identity Attributes */}
                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-[#818CF8] tracking-wider flex items-center gap-1.5">
                    <Dog className="w-4 h-4" />
                    <span>Physical Profile</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Life Stage:</span>
                      <span className="font-semibold text-white">{passport.lifecycleStage} ({passport.ageDisplay})</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Color / Coat:</span>
                      <span className="font-semibold text-white">{passport.primaryColor} {passport.secondaryColor ? `/ ${passport.secondaryColor}` : ''}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Size Class:</span>
                      <span className="font-semibold text-white">{passport.sizeClassification}</span>
                    </div>
                    <div className="flex justify-between pb-1.5">
                      <span className="text-[#64748B]">Date of Birth:</span>
                      <span className="font-semibold text-white">
                        {passport.dateOfBirth ? `${passport.dateOfBirth} (${passport.birthdatePrecision})` : 'Redacted in Finder Scope'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Microchip RFID Identity */}
                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-[#818CF8] tracking-wider flex items-center gap-1.5">
                    <Key className="w-4 h-4" />
                    <span>Microchip RFID Identity</span>
                  </h3>
                  {passport.microchip ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                        <span className="text-[#64748B]">RFID Number:</span>
                        <span className="font-mono font-bold text-amber-400">{passport.microchip.microchipNumber}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                        <span className="text-[#64748B]">Registry Issuer:</span>
                        <span className="font-semibold text-white">{passport.microchip.issuer || 'Standard ISO 11784'}</span>
                      </div>
                      <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                        <span className="text-[#64748B]">Status:</span>
                        <span className="font-semibold text-emerald-400">{passport.microchip.verificationStatus}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
                        <strong>Architectural Guarantee (ADR-006):</strong> Passive RFID tag only. Not a live GPS tracking device.
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B] italic">No microchip registered on this profile.</p>
                  )}
                </div>

                {/* Contact Pathway & Privacy Masking */}
                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-2xl p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-[#818CF8] tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>Contact Pathway</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Household:</span>
                      <span className="font-semibold text-white">{passport.contactPathway.householdName}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Primary Guardian:</span>
                      <span className="font-semibold text-white">{passport.contactPathway.primaryCaregiverName}</span>
                    </div>
                    <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                      <span className="text-[#64748B]">Emergency Contact:</span>
                      <span className="font-mono font-bold text-emerald-400">{passport.contactPathway.emergencyPhone || 'Relay Protected'}</span>
                    </div>
                    {passport.contactPathway.emergencyEmail && (
                      <div className="flex justify-between border-b border-[#1E293B]/60 pb-1.5">
                        <span className="text-[#64748B]">Email:</span>
                        <span className="font-semibold text-white">{passport.contactPathway.emergencyEmail}</span>
                      </div>
                    )}
                    {passport.contactPathway.notes && (
                      <p className="text-[10px] text-[#94A3B8] italic">{passport.contactPathway.notes}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Verified Documents in Scope */}
              <div className="mt-6 pt-6 border-t border-[#1E293B]">
                <h3 className="text-xs font-bold uppercase text-[#818CF8] tracking-wider mb-3 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  <span>Verified Credentials in this Passport Scope ({passport.documents.length})</span>
                </h3>
                {passport.documents.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] text-xs text-[#64748B] italic">
                    {passport.scope === 'FINDER_RECOVERY'
                      ? 'Private medical and household documents are completely redacted in Finder Recovery mode for owner privacy.'
                      : 'No verified credentials available in this scope.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {passport.documents.map((doc) => (
                      <div key={doc.documentId} className="bg-[#0B0D10] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{doc.title}</div>
                          <div className="text-[10px] text-[#64748B]">{doc.issuingOrganization || doc.documentType}</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {doc.verificationStatus}
                          </span>
                          {doc.expiresAt && (
                            <div className="text-[9px] text-[#94A3B8] mt-1">Exp: {doc.expiresAt}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Explicit Medical Boundary Banner */}
              <div className="mt-6 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-start gap-3 text-xs text-indigo-300">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-indigo-200">Clinical Safety &amp; Non-Mocking Guarantee:</strong>{' '}
                  {passport.futureHealthNotice.message}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-[#131720] border border-[#1E293B] rounded-2xl text-xs text-[#94A3B8]">
              {actionNotice?.message || 'Access blocked. Please switch to an authorized actor role.'}
            </div>
          )}

          {/* Active Shares & Inspector */}
          <div className="bg-[#131720] border border-[#1E293B] p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>Active Cryptographic Share Tokens ({shares.length})</span>
            </h3>

            {shares.length === 0 ? (
              <p className="text-xs text-[#64748B] italic">No active share links created yet.</p>
            ) : (
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.shareId} className="bg-[#0B0D10] border border-[#1E293B] p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{s.recipientLabel || 'External Recipient'}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400">
                          {s.scope}
                        </span>
                        {s.revokedAt ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400">
                            REVOKED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        Access Count: {s.accessCount} · Expires: {new Date(s.expiresAt).toLocaleString()}
                      </div>
                    </div>

                    {!s.revokedAt && (
                      <button
                        onClick={async () => {
                          await PassportService.revokeShareToken(getCurrentActorId(), asPetId(selectedPetId), s.shareId);
                          setActionNotice({ type: 'success', message: 'Share token revoked immediately.' });
                          refreshData();
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Token Resolution Tester */}
            <div className="mt-4 pt-4 border-t border-[#1E293B]">
              <div className="text-xs font-bold text-[#818CF8] mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>Simulate Public / External Token Consumer</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste 64-character cryptographic share token..."
                  value={inspectTokenInput}
                  onChange={(e) => setInspectTokenInput(e.target.value)}
                  className="flex-1 bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleInspectToken}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all cursor-pointer"
                >
                  Consume Token
                </button>
              </div>

              {resolvedSharedPassport && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                  <div className="font-bold mb-1">
                    Token Valid! Resolved Passport: {resolvedSharedPassport.passport.name} (Scope: {resolvedSharedPassport.shareMeta.scope})
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Access Count: {resolvedSharedPassport.shareMeta.accessCount} · Recipient: {resolvedSharedPassport.shareMeta.recipientLabel}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: TIMELINE */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-6">
          {/* Filter and Control Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#131720] border border-[#1E293B] p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#64748B] font-bold text-[10px] uppercase">Category:</span>
                <select
                  value={timelineCategory}
                  onChange={(e) => setTimelineCategory(e.target.value)}
                  className="bg-[#0B0D10] border border-[#1E293B] text-xs font-semibold text-white rounded-xl px-2.5 py-1.5 outline-none"
                >
                  <option value="ALL">All Categories</option>
                  <option value="LIFECYCLE">LIFECYCLE</option>
                  <option value="IDENTITY">IDENTITY</option>
                  <option value="DOCUMENT">DOCUMENT</option>
                  <option value="ACTIVITY">ACTIVITY</option>
                  <option value="HEALTH">HEALTH</option>
                  <option value="ADMINISTRATIVE">ADMINISTRATIVE</option>
                </select>
              </div>

              {/* Keyword Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search timeline..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  className="bg-[#0B0D10] border border-[#1E293B] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Order Toggle */}
              <button
                onClick={() => setTimelineSortAsc(!timelineSortAsc)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-white bg-[#0B0D10] border border-[#1E293B] cursor-pointer"
              >
                Sort: {timelineSortAsc ? 'Oldest First' : 'Newest First'}
              </button>
            </div>

            <button
              onClick={() => setShowObsModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white flex items-center gap-1.5 hover:bg-indigo-500 transition-all cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Add Observation</span>
            </button>
          </div>

          {/* Timeline Feed */}
          <div className="space-y-4">
            {timelineEvents.length === 0 ? (
              <div className="p-8 text-center bg-[#131720] border border-[#1E293B] rounded-2xl text-xs text-[#64748B]">
                No timeline events matching the current criteria.
              </div>
            ) : (
              timelineEvents.map((ev, idx) => (
                <div
                  key={ev.timelineEventId}
                  className="bg-[#131720] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {ev.eventCategory}
                      </span>
                      <h4 className="text-sm font-bold text-white">{ev.title}</h4>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                      <span className="font-semibold text-[#94A3B8]">
                        Occurred: {new Date(ev.occurredAt).toLocaleDateString()}
                      </span>
                      <span>·</span>
                      <span className="italic text-[10px]">
                        Recorded: {new Date(ev.recordedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#CBD5E1] mb-3">{ev.summary}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#1E293B]/70 text-[10px] text-[#64748B]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#818CF8]">Provenance: {ev.provenanceType}</span>
                      <span>·</span>
                      <span>Source: {ev.sourceDomain} ({ev.sourceActorType})</span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[9px] text-[#475569]">
                      <span>ID: {ev.timelineEventId.slice(0, 12)}...</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: DOCUMENTS */}
      {activeSubTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#131720] border border-[#1E293B] p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B] font-bold text-[10px] uppercase">Document Type:</span>
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="bg-[#0B0D10] border border-[#1E293B] text-xs font-semibold text-white rounded-xl px-2.5 py-1.5 outline-none"
              >
                <option value="ALL">All Documents</option>
                <option value="VACCINATION_CERTIFICATE">Vaccination Certificates</option>
                <option value="MICROCHIP_CERTIFICATE">Microchip Records</option>
                <option value="VET_REPORT">Vet Reports</option>
                <option value="PRESCRIPTION">Prescriptions</option>
                <option value="TRAVEL_DOCUMENT">Travel Documents</option>
              </select>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white flex items-center gap-1.5 hover:bg-indigo-500 transition-all cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          {downloadGrantMessage && (
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
              <span>{downloadGrantMessage}</span>
              <button
                onClick={() => setDownloadGrantMessage(null)}
                className="text-[10px] font-bold text-indigo-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Document Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-[#131720] border border-[#1E293B] rounded-2xl text-xs text-[#64748B]">
                No documents found for this pet.
              </div>
            ) : (
              documents.map((doc) => {
                const expired = isDocumentExpired(doc);
                const expiringSoon = isDocumentExpiringSoon(doc);

                return (
                  <div
                    key={doc.documentId}
                    className="bg-[#131720] border border-[#1E293B] rounded-2xl p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {(doc.documentType || 'DOCUMENT').replace(/_/g, ' ')}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1">{doc.title}</h4>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {doc.verificationStatus}
                        </span>
                      </div>

                      {doc.description && <p className="text-xs text-[#94A3B8] mb-3">{doc.description}</p>}

                      <div className="space-y-1.5 text-xs text-[#64748B] mb-4">
                        <div className="flex justify-between">
                          <span>File:</span>
                          <span className="font-mono text-white">{doc.originalFilename} ({(doc.fileSize / 1024).toFixed(1)} KB)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Issuer:</span>
                          <span className="font-semibold text-white">{doc.issuingOrganization || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Validity:</span>
                          <span className={expired ? 'text-rose-400 font-bold' : expiringSoon ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                            {expired ? 'EXPIRED' : doc.expiresAt ? `Valid until ${doc.expiresAt}` : 'No Expiry'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span>Checksum:</span>
                          <span className="font-mono text-[#94A3B8]">{doc.checksum.slice(0, 16)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1E293B] text-xs">
                      <span className="text-[10px] text-[#64748B]">v{doc.versionNumber} · {doc.documentStatus}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(doc.documentId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0D10] text-[#A5B4FC] border border-[#1E293B] hover:bg-[#1E293B] flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB: TESTS */}
      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-[#131720] border border-[#1E293B] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Sprint 4 Automated Invariant Test Runner</span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">
                Verifies Timeline immutability &amp; supersession, secure document sandbox, and privacy-preserving Passport scopes.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={testsRunning}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {testsRunning ? 'Executing Invariants...' : 'Run Verification Tests'}
            </button>
          </div>

          {testSummary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#131720] border border-[#1E293B] p-4 rounded-xl text-center">
                <div className="text-xs text-[#64748B]">Total Tests</div>
                <div className="text-xl font-black text-white">{testSummary.total}</div>
              </div>
              <div className="bg-[#131720] border border-emerald-500/30 p-4 rounded-xl text-center">
                <div className="text-xs text-emerald-400">Passed</div>
                <div className="text-xl font-black text-emerald-400">{testSummary.passed}</div>
              </div>
              <div className="bg-[#131720] border border-rose-500/30 p-4 rounded-xl text-center">
                <div className="text-xs text-rose-400">Failed</div>
                <div className="text-xl font-black text-rose-400">{testSummary.failed}</div>
              </div>
              <div className="bg-[#131720] border border-[#1E293B] p-4 rounded-xl text-center">
                <div className="text-xs text-[#64748B]">Duration</div>
                <div className="text-xl font-black text-[#A5B4FC]">{testSummary.durationMs}ms</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {testResults.map((t) => (
              <div
                key={t.id}
                className="bg-[#131720] border border-[#1E293B] p-4 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  {t.status === 'PASSED' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span className="font-mono text-indigo-400">[{t.id}]</span>
                      <span>{t.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0B0D10] text-[#64748B]">
                        {t.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">{t.message}</div>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-[#64748B]">{t.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: REPORT */}
      {activeSubTab === 'report' && (
        <div className="bg-[#131720] border border-[#1E293B] rounded-2xl p-6 space-y-6 text-xs text-[#CBD5E1]">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Sprint 4 Architecture &amp; Specification Compliance Report</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] space-y-2">
              <h4 className="font-bold text-indigo-400">Timeline Immutability</h4>
              <p className="text-[11px] text-[#94A3B8]">
                Strict separation between reality (<code className="text-amber-400">occurred_at</code>) and database entry (<code className="text-amber-400">recorded_at</code>). Corrections follow append-only supersession rather than in-place overwrites.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] space-y-2">
              <h4 className="font-bold text-indigo-400">Hardened Document Storage</h4>
              <p className="text-[11px] text-[#94A3B8]">
                Strict MIME and extension allow-lists (PDF, JPEG, PNG, WEBP), 15MB limit, path traversal defense, SHA-256 checksums, and short-lived signed grant download tokens.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0B0D10] border border-[#1E293B] space-y-2">
              <h4 className="font-bold text-indigo-400">Digital Pet Passport</h4>
              <p className="text-[11px] text-[#94A3B8]">
                Read-model projection across 4 privacy scopes (Private, Care Provider, Finder Recovery, Travel Export) with field-level redaction and cryptographic share tokens.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200">
            <strong>Domain Isolation &amp; Veterinary Care Boundary:</strong> Clinical veterinary logic (diagnosis, active prescriptions, vaccines) is isolated for upcoming sprints. Pet OS explicitly presents a clean boundary notice rather than synthetic mock data.
          </div>
        </div>
      )}

      {/* Modal: Add Manual Observation */}
      {showObsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#1E293B] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Record Timeline Observation</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-bold mb-1">Observation Title</label>
                <input
                  type="text"
                  placeholder="e.g. Weight Check or Training Session"
                  value={newObsTitle}
                  onChange={(e) => setNewObsTitle(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Category</label>
                <select
                  value={newObsCategory}
                  onChange={(e) => setNewObsCategory(e.target.value as TimelineEventCategory)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="ACTIVITY">ACTIVITY</option>
                  <option value="HEALTH">HEALTH</option>
                  <option value="TRAINING">TRAINING</option>
                  <option value="NUTRITION">NUTRITION</option>
                  <option value="BEHAVIOR">BEHAVIOR</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Notes / Summary</label>
                <textarea
                  rows={3}
                  placeholder="Details of the observation..."
                  value={newObsSummary}
                  onChange={(e) => setNewObsSummary(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowObsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddObservation}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
              >
                Save Observation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Upload Document */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#1E293B] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Upload Pet Credential</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-bold mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Rabies Vaccination Certificate"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value as PetDocumentType)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="VACCINATION_CERTIFICATE">Vaccination Certificate</option>
                  <option value="MICROCHIP_CERTIFICATE">Microchip Certificate</option>
                  <option value="VET_REPORT">Vet Report</option>
                  <option value="LAB_RESULT">Lab Result</option>
                  <option value="PRESCRIPTION">Prescription</option>
                  <option value="TRAVEL_DOCUMENT">Travel Document</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Issuing Organization</label>
                <input
                  type="text"
                  value={uploadOrg}
                  onChange={(e) => setUploadOrg(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Filename (.pdf, .jpg, .png)</label>
                <input
                  type="text"
                  value={uploadFilename}
                  onChange={(e) => setUploadFilename(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadDocument}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
              >
                Validate &amp; Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Share Link */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131720] border border-[#1E293B] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>Create Scoped Passport Share Link</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#64748B] font-bold mb-1">Share Scope</label>
                <select
                  value={shareScope}
                  onChange={(e) => setShareScope(e.target.value as PassportShareScope)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="CARE_PROVIDER_SHARE">CARE_PROVIDER_SHARE (Sitter / Boarding)</option>
                  <option value="FINDER_RECOVERY">FINDER_RECOVERY (Public Lost Pet Finder)</option>
                  <option value="TRAVEL_EXPORT">TRAVEL_EXPORT (Border / Transport)</option>
                  <option value="PRIVATE">PRIVATE (Full Household View)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Recipient Label</label>
                <input
                  type="text"
                  placeholder="e.g. Karen Pet Boarding"
                  value={shareRecipient}
                  onChange={(e) => setShareRecipient(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[#64748B] font-bold mb-1">Expiry (Hours)</label>
                <input
                  type="number"
                  value={shareHours}
                  onChange={(e) => setShareHours(Number(e.target.value))}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateShare}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
              >
                Generate Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
