import React, { useState, useEffect, useRef } from 'react';
import {
  Stethoscope,
  HeartPulse,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Clock,
  Pill,
  Syringe,
  Activity,
  FileText,
  UserCheck,
  CheckCircle2,
  XCircle,
  Play,
  Filter,
  Plus,
  Info,
  ChevronRight,
  AlertCircle,
  Eye,
  Trash2,
  FileCheck,
  Building,
  User,
  Sparkles,
  ClipboardList,
  Flame,
  Search,
  Check
} from 'lucide-react';
import { HealthService } from '../pet-os/health/service';
import { HealthStore } from '../pet-os/health/store';
import {
  PetHealthSummaryDto,
  PetConditionDto,
  PetAllergyDto,
  PetVaccinationDto,
  PetMedicationDto,
  PetEncounterDto,
  PetDiagnosticDto,
  PetProcedureDto,
  PetClinicalNoteDto,
  ConditionCategory,
  ClinicalSeverity,
  ClinicalProvenanceType,
  AllergenCategory,
  AllergyType,
  MedicationRoute,
  MedicationType,
  EncounterType,
  DiagnosticTestType,
  ProcedureType,
  HealthRecordAmendment
} from '../pet-os/health/types';
import { CANONICAL_VACCINES } from '../pet-os/health/vaccines';
import { seedSprint5HealthData } from '../pet-os/health/seed';
import { Sprint5HealthTestSuite, TestResult } from '../pet-os/health/tests';
import { PetCoreService } from '../pet-os/pet-core/service';
import { PetStore } from '../pet-os/pet-core/store';
import { PetDetailDto, PetSummaryDto } from '../pet-os/pet-core/types';
import { IdentityStore } from '../pet-os/identity/store';
import { TimelineService } from '../pet-os/timeline/service';
import { TimelineEvent } from '../pet-os/timeline/types';
import { asUserId, asHouseholdId, asPetId } from '../pet-os/kernel/ids';

type HealthSubTab =
  | 'overview'
  | 'conditions'
  | 'allergies'
  | 'vaccinations'
  | 'medications'
  | 'encounters'
  | 'diagnostics'
  | 'procedures'
  | 'timeline'
  | 'tests';

export const Sprint5HealthConsole: React.FC = () => {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<HealthSubTab>('overview');

  // Multi-Tenant Context Simulation
  const [actorRole, setActorRole] = useState<'OWNER' | 'CAREGIVER' | 'OUTSIDER'>('OWNER');
  const [pets, setPets] = useState<PetSummaryDto[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [selectedPet, setSelectedPet] = useState<PetDetailDto | null>(null);

  // Health State
  const [healthSummary, setHealthSummary] = useState<PetHealthSummaryDto | null>(null);
  const [conditions, setConditions] = useState<PetConditionDto[]>([]);
  const [allergies, setAllergies] = useState<PetAllergyDto[]>([]);
  const [vaccinations, setVaccinations] = useState<PetVaccinationDto[]>([]);
  const [medications, setMedications] = useState<PetMedicationDto[]>([]);
  const [encounters, setEncounters] = useState<PetEncounterDto[]>([]);
  const [diagnostics, setDiagnostics] = useState<PetDiagnosticDto[]>([]);
  const [procedures, setProcedures] = useState<PetProcedureDto[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<PetClinicalNoteDto[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [amendments, setAmendments] = useState<HealthRecordAmendment[]>([]);

  // Modals
  const [showConditionModal, setShowConditionModal] = useState<boolean>(false);
  const [showAllergyModal, setShowAllergyModal] = useState<boolean>(false);
  const [showVaccineModal, setShowVaccineModal] = useState<boolean>(false);
  const [showMedicationModal, setShowMedicationModal] = useState<boolean>(false);
  const [showEncounterModal, setShowEncounterModal] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [showProcedureModal, setShowProcedureModal] = useState<boolean>(false);
  const [showEnteredInErrorModal, setShowEnteredInErrorModal] = useState<{
    type: 'CONDITION' | 'ALLERGY' | 'VACCINATION' | 'MEDICATION';
    id: string;
    title: string;
  } | null>(null);
  const [enteredInErrorReason, setEnteredInErrorReason] = useState<string>('');

  // Form State: Condition
  const [condForm, setCondForm] = useState({
    isDiagnosis: false,
    conditionName: '',
    category: 'DERMATOLOGY' as ConditionCategory,
    severity: 'MODERATE' as ClinicalSeverity,
    description: '',
    chronic: false,
    provenance: 'OWNER_ENTERED' as ClinicalProvenanceType,
    externalProviderName: 'Dr. Kiprono Mutai (KVB #7821)',
    notes: ''
  });

  // Form State: Allergy
  const [allergyForm, setAllergyForm] = useState({
    allergen: '',
    allergenCategory: 'FOOD' as AllergenCategory,
    allergyType: 'ALLERGY' as AllergyType,
    severity: 'SEVERE' as ClinicalSeverity,
    reaction: '',
    clinicalNotes: '',
    provenance: 'VETERINARY_PROFESSIONAL' as ClinicalProvenanceType
  });

  // Form State: Vaccine
  const [vaccineForm, setVaccineForm] = useState({
    vaccineCode: 'CANINE_RABIES',
    vaccineName: 'Rabies Virus Vaccine',
    dose: '1.0 mL',
    administeredAt: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    batchLotNumber: 'LOT-2025-01',
    manufacturer: 'Zoetis Animal Health',
    externalClinicName: 'Nairobi Veterinary Hospital',
    externalProviderName: 'Dr. Kiprono Mutai'
  });

  // Form State: Medication
  const [medForm, setMedForm] = useState({
    medicationName: '',
    genericName: '',
    medicationType: 'PRESCRIPTION' as MedicationType,
    dosage: '10',
    dosageUnit: 'mg',
    route: 'ORAL' as MedicationRoute,
    frequency: 'Once Daily',
    startAt: new Date().toISOString().slice(0, 10),
    instructions: 'Administer with food.',
    reason: '',
    prescribingProvider: 'Dr. Kiprono Mutai'
  });

  // Form State: Encounter
  const [encForm, setEncForm] = useState({
    encounterType: 'ROUTINE_CHECKUP' as EncounterType,
    occurredAt: new Date().toISOString().slice(0, 16),
    reason: 'Clinical Wellness & Checkup',
    chiefComplaint: '',
    outcome: 'Patient examined and in sound clinical condition.',
    followUpRequired: false,
    followUpDate: '',
    externalClinicName: 'Nairobi Veterinary Hospital',
    externalProviderName: 'Dr. Kiprono Mutai'
  });

  // Test Suite State
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testsRunning, setTestsRunning] = useState<boolean>(false);
  const [testSummary, setTestSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  } | null>(null);

  // Notifications
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const seedingRef = useRef(false);

  // Initialize Data
  useEffect(() => {
    if (seedingRef.current) return;
    seedingRef.current = true;
    bootstrapSprint5();
  }, []);

  const bootstrapSprint5 = async () => {
    try {
      const hhAId = asHouseholdId('hh-sprint4-main');
      const ownerAId = asUserId('usr-alice-owner');
      const caregiverAId = asUserId('usr-bob-caregiver');
      const outsiderBId = asUserId('usr-charlie-outsider');
      const now = new Date().toISOString();

      // Ensure users exist
      IdentityStore.saveUser({
        userId: ownerAId,
        email: 'alice@wambuipets.co.ke',
        normalizedEmail: 'alice@wambuipets.co.ke',
        passwordHash: 'hash',
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
        passwordHash: 'hash',
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
        locale: 'en-KE',
        timezone: 'Africa/Nairobi',
        communicationPreferences: { emailNotifications: true, smsNotifications: true, emergencyAlerts: true },
        privacyPreferences: { profileVisibility: 'HOUSEHOLD_ONLY', shareActivityWithHousehold: true },
        updatedAt: now
      });

      IdentityStore.saveUser({
        userId: outsiderBId,
        email: 'charlie@outsider.com',
        normalizedEmail: 'charlie@outsider.com',
        passwordHash: 'hash',
        accountStatus: 'ACTIVE',
        failedLoginAttempts: 0,
        createdAt: now,
        updatedAt: now,
        policyAcceptedAt: now,
        policyVersion: '1.0'
      });

      IdentityStore.saveHousehold({
        householdId: hhAId,
        name: 'Wambui Residence (Nairobi)',
        status: 'ACTIVE',
        ownerUserId: ownerAId,
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

      // Get or create pets
      let existingPets = await PetCoreService.listPetsForHousehold(ownerAId, hhAId);
      if (existingPets.length === 0) {
        const simbaChip = '985141004455667';
        const nalaChip = '985141004455668';

        let pet1: any = PetStore.findActiveMicrochipByNumber(simbaChip)?.pet;
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
            pet1 = PetStore.findActiveMicrochipByNumber(simbaChip)?.pet;
          }
        }

        let pet2: any = PetStore.findActiveMicrochipByNumber(nalaChip)?.pet;
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
            pet2 = PetStore.findActiveMicrochipByNumber(nalaChip)?.pet;
          }
        }

        existingPets = [pet1, pet2].filter(Boolean);
      }

      setPets(existingPets);
      if (existingPets.length > 0) {
        const pId = existingPets[0].petId;
        setSelectedPetId(pId);
        // Seed initial health data for Simba
        await seedSprint5HealthData(ownerAId, asPetId(pId));
      }
    } catch (err) {
      console.error('Error bootstrapping Sprint 5:', err);
    }
  };

  // Resolve actor ID
  const getCurrentActorId = (): string => {
    if (actorRole === 'OWNER') return 'usr-alice-owner';
    if (actorRole === 'CAREGIVER') return 'usr-bob-caregiver';
    return 'usr-charlie-outsider';
  };

  // Refresh data when pet or actor changes
  useEffect(() => {
    if (!selectedPetId) return;
    refreshData();
  }, [selectedPetId, actorRole]);

  const refreshData = async () => {
    if (!selectedPetId) return;
    const actorId = getCurrentActorId();
    const currentPetId = asPetId(selectedPetId);

    try {
      // Pet details
      const detail = await PetCoreService.getPetById(actorId, currentPetId);
      setSelectedPet(detail);

      // Assemble health summary
      try {
        const summary = HealthService.assembleHealthSummary(actorId, currentPetId);
        setHealthSummary(summary);
      } catch (err: any) {
        setHealthSummary(null);
        setActionNotice({ type: 'error', message: err.message || 'Access denied to health summary' });
        return;
      }

      // Collections
      setConditions(HealthStore.listConditionsForPet(currentPetId, true));
      setAllergies(HealthStore.listAllergiesForPet(currentPetId, true));
      setVaccinations(HealthStore.listVaccinationsForPet(currentPetId, true));
      setMedications(HealthStore.listMedicationsForPet(currentPetId, true));
      setEncounters(HealthStore.listEncountersForPet(currentPetId, true));
      setDiagnostics(HealthStore.listDiagnosticsForPet(currentPetId, true));
      setProcedures(HealthStore.listProceduresForPet(currentPetId, true));
      setClinicalNotes(HealthStore.listClinicalNotesForPet(currentPetId, true));
      setAmendments(HealthStore.listAmendmentsForPet(currentPetId));

      // Timeline events from health domain
      const tl = TimelineService.listPetTimeline(actorId, currentPetId);
      setTimelineEvents(tl.events.filter(e => e.sourceDomain === 'VETERINARY_HEALTH'));
    } catch (err: any) {
      console.warn('Error loading health data:', err);
      setActionNotice({ type: 'error', message: err.message || 'Authorization check failed' });
    }
  };

  // Handlers for Submitting Health Records
  const handleCreateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPetId || !condForm.conditionName) return;

    try {
      HealthService.recordCondition(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        isDiagnosis: condForm.isDiagnosis,
        conditionName: condForm.conditionName,
        category: condForm.category,
        severity: condForm.severity,
        description: condForm.description,
        chronic: condForm.chronic,
        provenance: condForm.provenance,
        externalProviderName: condForm.isDiagnosis ? condForm.externalProviderName : undefined,
        notes: condForm.notes
      });

      setShowConditionModal(false);
      setCondForm({
        isDiagnosis: false,
        conditionName: '',
        category: 'DERMATOLOGY',
        severity: 'MODERATE',
        description: '',
        chronic: false,
        provenance: 'OWNER_ENTERED',
        externalProviderName: 'Dr. Kiprono Mutai (KVB #7821)',
        notes: ''
      });
      setActionNotice({
        type: 'success',
        message: condForm.isDiagnosis
          ? 'Professional diagnosis recorded with clinical provenance.'
          : 'Owner observation recorded (marked as unverified symptom).'
      });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to record condition.' });
    }
  };

  const handleCreateAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPetId || !allergyForm.allergen) return;

    try {
      HealthService.recordAllergy(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        allergen: allergyForm.allergen,
        allergenCategory: allergyForm.allergenCategory,
        allergyType: allergyForm.allergyType,
        severity: allergyForm.severity,
        reaction: allergyForm.reaction,
        clinicalNotes: allergyForm.clinicalNotes,
        provenance: allergyForm.provenance
      });

      setShowAllergyModal(false);
      setAllergyForm({
        allergen: '',
        allergenCategory: 'FOOD',
        allergyType: 'ALLERGY',
        severity: 'SEVERE',
        reaction: '',
        clinicalNotes: '',
        provenance: 'VETERINARY_PROFESSIONAL'
      });
      setActionNotice({ type: 'success', message: 'Allergy and reaction registered.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to record allergy.' });
    }
  };

  const handleCreateVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPetId || !vaccineForm.vaccineName) return;

    try {
      HealthService.recordVaccination(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        vaccineCode: vaccineForm.vaccineCode,
        vaccineName: vaccineForm.vaccineName,
        dose: vaccineForm.dose || '1.0 mL',
        administeredAt: vaccineForm.administeredAt,
        validFrom: vaccineForm.administeredAt,
        validUntil: vaccineForm.validUntil,
        nextDueAt: vaccineForm.validUntil,
        batchLotNumber: vaccineForm.batchLotNumber,
        manufacturer: vaccineForm.manufacturer,
        externalClinicName: vaccineForm.externalClinicName,
        externalProviderName: vaccineForm.externalProviderName
      });

      setShowVaccineModal(false);
      setActionNotice({ type: 'success', message: 'Vaccination certificate and lot recorded.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to record vaccination.' });
    }
  };

  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPetId || !medForm.medicationName) return;

    try {
      HealthService.recordMedication(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        medicationName: medForm.medicationName,
        genericName: medForm.genericName || undefined,
        medicationType: medForm.medicationType,
        dosage: medForm.dosage,
        dosageUnit: medForm.dosageUnit,
        route: medForm.route,
        frequency: medForm.frequency,
        startAt: medForm.startAt,
        instructions: medForm.instructions,
        reason: medForm.reason,
        prescribingProvider: medForm.prescribingProvider
      });

      setShowMedicationModal(false);
      setActionNotice({ type: 'success', message: 'Active medication regimen saved.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to record medication.' });
    }
  };

  const handleCreateEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPetId || !encForm.reason) return;

    try {
      HealthService.recordEncounter(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        encounterType: encForm.encounterType,
        occurredAt: encForm.occurredAt,
        reason: encForm.reason,
        chiefComplaint: encForm.chiefComplaint || undefined,
        outcome: encForm.outcome,
        followUpRequired: encForm.followUpRequired,
        followUpDate: encForm.followUpDate || undefined,
        externalClinicName: encForm.externalClinicName,
        externalProviderName: encForm.externalProviderName
      });

      setShowEncounterModal(false);
      setActionNotice({ type: 'success', message: 'Veterinary clinical encounter recorded.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to record encounter.' });
    }
  };

  const handleEnteredInError = async () => {
    if (!showEnteredInErrorModal || !enteredInErrorReason || !selectedPetId) return;

    try {
      HealthService.markRecordEnteredInError(getCurrentActorId(), {
        petId: asPetId(selectedPetId),
        recordType: showEnteredInErrorModal.type,
        recordId: showEnteredInErrorModal.id,
        reason: enteredInErrorReason
      });

      setShowEnteredInErrorModal(null);
      setEnteredInErrorReason('');
      setActionNotice({
        type: 'success',
        message: 'Record marked as entered in error. Snapshot preserved in audit amendment log.'
      });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to amend record.' });
    }
  };

  const handleStopMedication = async (medId: string) => {
    const reason = prompt('Please enter clinical reason for discontinuing this medication:');
    if (!reason || !selectedPetId) return;

    try {
      HealthService.stopMedication(getCurrentActorId(), asPetId(selectedPetId), medId as any, reason);
      setActionNotice({ type: 'success', message: 'Medication discontinued with clinical reason.' });
      refreshData();
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to discontinue medication.' });
    }
  };

  const runSprint5Tests = async () => {
    setTestsRunning(true);
    setTestSummary(null);
    try {
      const suite = await Sprint5HealthTestSuite.runAllTests();
      setTestResults(suite.results);
      setTestSummary({
        total: suite.total,
        passed: suite.passed,
        failed: suite.failed,
        durationMs: suite.durationMs
      });
    } catch (err: any) {
      console.error('Test execution failed:', err);
    } finally {
      setTestsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Clinical Architecture & Provenance Governance */}
      <div className="bg-[#131722] border border-[#1E293B] rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    Veterinary Health, Medical Records &amp; Clinical Provenance
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Sprint 5 Canonical
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Volume VII &amp; Volume XXVIII · ADR-005 Provenance · Append-Only Immutability · Cross-Household Isolation
                </p>
              </div>
            </div>
          </div>

          {/* Actor Role Simulator */}
          <div className="flex items-center gap-3 bg-[#0B0D10] border border-[#1E293B] px-3 py-2 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-[#CBD5E1]">Simulate Actor:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActorRole('OWNER')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  actorRole === 'OWNER'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Alice (Owner)
              </button>
              <button
                onClick={() => setActorRole('CAREGIVER')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  actorRole === 'CAREGIVER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Bob (Caregiver)
              </button>
              <button
                onClick={() => setActorRole('OUTSIDER')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  actorRole === 'OUTSIDER'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Charlie (Outsider)
              </button>
            </div>
          </div>
        </div>

        {/* Pet Switcher Bar */}
        <div className="mt-4 pt-4 border-t border-[#1E293B]/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Patient:</span>
            <div className="flex items-center gap-2">
              {pets.map((p) => (
                <button
                  key={p.petId}
                  onClick={() => setSelectedPetId(p.petId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    selectedPetId === p.petId
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-[#1E293B]/60 text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{p.name}</span>
                  <span className="text-[10px] opacity-70">
                    ({p.speciesCode === 'SPECIES_DOG' ? 'Canine' : 'Feline'})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedPet && (
            <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
              <span>
                Breed: <strong className="text-white font-medium">{selectedPet.breedName || (selectedPet.breedCode ? selectedPet.breedCode.replace('BREED_DOG_', '').replace(/_/g, ' ') : 'Not Specified')}</strong>
              </span>
              <span>·</span>
              <span>
                Microchip:{' '}
                <strong className="text-amber-400 font-mono">
                  {selectedPet.microchip?.microchipNumber || 'Unchipped'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Status: <strong className="text-emerald-400 font-medium">{selectedPet.status}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
              : 'bg-red-950/40 text-red-300 border-red-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[#94A3B8] hover:text-white text-xs font-bold px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Outsider Warning Banner */}
      {actorRole === 'OUTSIDER' && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 text-red-200 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-300">Access Denied: Cross-Household Isolation Active</h4>
            <p className="mt-1 text-red-300/80 leading-relaxed">
              Actor <strong>Charlie (Outsider)</strong> does not belong to the household owning this pet. All clinical records,
              allergies, medications, and summary views are strictly protected under ADR-005 and Volume VII permissions.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-[#1E293B] flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { id: 'overview', label: 'Clinical Summary', icon: HeartPulse, count: healthSummary?.careAlerts.length },
          { id: 'conditions', label: 'Conditions & Observations', icon: Activity, count: conditions.length },
          { id: 'allergies', label: 'Allergies & Reactions', icon: AlertTriangle, count: allergies.length },
          { id: 'vaccinations', label: 'Vaccinations & Boosters', icon: Syringe, count: vaccinations.length },
          { id: 'medications', label: 'Medications', icon: Pill, count: medications.filter(m => m.status === 'ACTIVE').length },
          { id: 'encounters', label: 'Clinical Visits', icon: Stethoscope, count: encounters.length },
          { id: 'diagnostics', label: 'Diagnostics & Labs', icon: FileCheck, count: diagnostics.length },
          { id: 'procedures', label: 'Procedures', icon: ClipboardList, count: procedures.length },
          { id: 'timeline', label: 'Audit & Timeline', icon: Clock, count: timelineEvents.length },
          { id: 'tests', label: 'Sprint 5 Test Suite', icon: Play, count: testSummary ? `${testSummary.passed}/${testSummary.total}` : undefined }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as HealthSubTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1E293B] text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-[#94A3B8] hover:text-white hover:bg-[#131722]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-[#64748B]'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#0B0D10] text-[#64748B]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: CLINICAL SUMMARY & OVERVIEW */}
      {activeSubTab === 'overview' && healthSummary && (
        <div className="space-y-6">
          {/* Critical Care Alerts Banner */}
          {healthSummary.careAlerts.length > 0 && (
            <div className="space-y-2">
              {healthSummary.careAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-red-950/40 border-red-800/60 text-red-200'
                      : alert.severity === 'WARNING'
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                  }`}
                >
                  <AlertCircle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      alert.severity === 'CRITICAL'
                        ? 'text-red-400'
                        : alert.severity === 'WARNING'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider">{alert.title}</h4>
                      <span className="text-[10px] font-mono opacity-70">Source: {alert.source}</span>
                    </div>
                    <p className="text-xs mt-0.5 opacity-90">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between text-[#64748B] text-xs">
                <span>Active Conditions</span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-1">{healthSummary.activeConditionsCount}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Diagnoses &amp; observations</p>
            </div>

            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between text-[#64748B] text-xs">
                <span>Known Allergies</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-1">{healthSummary.activeAllergiesCount}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Food, drug &amp; environmental</p>
            </div>

            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between text-[#64748B] text-xs">
                <span>Active Medications</span>
                <Pill className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-1">{healthSummary.activeMedicationsCount}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Under current administration</p>
            </div>

            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-4">
              <div className="flex items-center justify-between text-[#64748B] text-xs">
                <span>Immunization Status</span>
                <Syringe className="w-4 h-4 text-blue-400" />
              </div>
              <p
                className={`text-sm font-bold mt-2 ${
                  healthSummary.vaccinationStatus === 'UP_TO_DATE'
                    ? 'text-emerald-400'
                    : healthSummary.vaccinationStatus === 'DUE_SOON'
                    ? 'text-amber-400'
                    : healthSummary.vaccinationStatus === 'NO_RECORDS'
                    ? 'text-[#94A3B8]'
                    : 'text-red-400'
                }`}
              >
                {(healthSummary.vaccinationStatus || 'UP_TO_DATE').replace(/_/g, ' ')}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                {vaccinations.filter(v => v.status === 'ACTIVE').length} recorded doses
              </p>
            </div>
          </div>

          {/* Two-Column Clinical Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Regimen & Allergies */}
            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400" />
                  Active Medications &amp; Care Regimen
                </h3>
                <button
                  onClick={() => setActiveSubTab('medications')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {medications.filter(m => m.status === 'ACTIVE').length === 0 ? (
                <p className="text-xs text-[#64748B] py-3">No active medications currently prescribed.</p>
              ) : (
                <div className="space-y-3">
                  {medications
                    .filter(m => m.status === 'ACTIVE')
                    .map((med) => (
                      <div
                        key={med.medicationId}
                        className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl flex items-start justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{med.medicationName}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {med.dosage} {med.dosageUnit} · {med.route}
                            </span>
                          </div>
                          <p className="text-xs text-[#94A3B8] mt-1">{med.frequency} — {med.instructions}</p>
                          {med.prescribingProvider && (
                            <p className="text-[11px] text-[#64748B] mt-0.5">Rx: {med.prescribingProvider}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleStopMedication(med.medicationId)}
                          className="px-2 py-1 text-[11px] font-medium bg-red-950/40 text-red-300 border border-red-800/40 rounded-lg hover:bg-red-900/60"
                        >
                          Discontinue
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Active Allergies List */}
              <div className="pt-3 border-t border-[#1E293B]">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Known Allergies &amp; Anaphylaxis Risks
                </h4>
                {allergies.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No documented allergies.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allergies.map((a) => (
                      <span
                        key={a.allergyId}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                          a.severity === 'SEVERE'
                            ? 'bg-red-950/40 text-red-300 border-red-800/50'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <strong>{a.allergen}</strong>
                        <span className="text-[10px] opacity-75">({a.allergenCategory})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Encounters & Vitals */}
            <div className="bg-[#131722] border border-[#1E293B] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-indigo-400" />
                  Recent Veterinary Encounters
                </h3>
                <button
                  onClick={() => setActiveSubTab('encounters')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  History <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {encounters.length === 0 ? (
                <p className="text-xs text-[#64748B] py-3">No veterinary visits on record.</p>
              ) : (
                <div className="space-y-3">
                  {encounters.slice(0, 3).map((enc) => (
                    <div
                      key={enc.encounterId}
                      className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{enc.reason}</span>
                        <span className="text-[11px] text-[#64748B]">
                          {new Date(enc.occurredAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-1">{enc.outcome}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[#64748B]">
                        <span>{enc.externalClinicName || 'Clinical Facility'}</span>
                        {enc.externalProviderName && <span>· {enc.externalProviderName}</span>}
                        {enc.followUpRequired && (
                          <span className="text-amber-400 font-medium">· Follow-up: {enc.followUpDate}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CONDITIONS & OBSERVATIONS */}
      {activeSubTab === 'conditions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Conditions, Diagnoses &amp; Observations</h2>
              <p className="text-xs text-[#94A3B8]">
                ADR-005 Principle: Professional veterinary diagnoses are strictly separated from owner symptom observations.
              </p>
            </div>
            <button
              onClick={() => setShowConditionModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Condition</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conditions.map((cond) => (
              <div
                key={cond.conditionId}
                className={`p-4 rounded-xl border relative transition-all ${
                  cond.status === 'ENTERED_IN_ERROR'
                    ? 'bg-[#131722]/50 border-red-900/30 opacity-60'
                    : 'bg-[#131722] border-[#1E293B]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        cond.isDiagnosis
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {cond.isDiagnosis ? 'Clinical Diagnosis' : 'Owner Observation'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1E293B] text-[#94A3B8]">
                      {cond.category}
                    </span>
                    {cond.chronic && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Chronic
                      </span>
                    )}
                  </div>

                  {cond.status !== 'ENTERED_IN_ERROR' && (
                    <button
                      onClick={() =>
                        setShowEnteredInErrorModal({
                          type: 'CONDITION',
                          id: cond.conditionId,
                          title: cond.conditionName
                        })
                      }
                      title="Mark as entered in error (audit amendment)"
                      className="text-[#64748B] hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white mt-2">{cond.conditionName}</h3>
                {cond.description && <p className="text-xs text-[#94A3B8] mt-1">{cond.description}</p>}

                <div className="mt-3 pt-3 border-t border-[#1E293B]/60 flex flex-wrap items-center justify-between text-[11px] text-[#64748B] gap-2">
                  <div className="flex items-center gap-2">
                    <span>Provenance:</span>
                    <span className="text-white font-medium">{cond.provenance}</span>
                    <span>·</span>
                    <span
                      className={`font-semibold ${
                        cond.verificationStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {cond.verificationStatus}
                    </span>
                  </div>
                  {cond.externalProviderName && (
                    <span className="text-indigo-400 font-medium">By: {cond.externalProviderName}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ALLERGIES & ADVERSE REACTIONS */}
      {activeSubTab === 'allergies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Allergies &amp; Adverse Reactions</h2>
              <p className="text-xs text-[#94A3B8]">
                Critical clinical flags for feeding, medication administration, and emergency triage.
              </p>
            </div>
            <button
              onClick={() => setShowAllergyModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Allergy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allergies.map((allergy) => (
              <div
                key={allergy.allergyId}
                className="p-4 bg-[#131722] border border-[#1E293B] rounded-xl space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        allergy.severity === 'SEVERE'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {allergy.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1E293B] text-[#94A3B8]">
                      {allergy.allergenCategory}
                    </span>
                  </div>
                  {allergy.status !== 'ENTERED_IN_ERROR' && (
                    <button
                      onClick={() =>
                        setShowEnteredInErrorModal({
                          type: 'ALLERGY',
                          id: allergy.allergyId,
                          title: allergy.allergen
                        })
                      }
                      className="text-[#64748B] hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white">{allergy.allergen}</h3>
                <p className="text-xs text-red-300/90 font-medium">Reaction: {allergy.reaction}</p>
                {allergy.clinicalNotes && (
                  <p className="text-xs text-[#94A3B8]">{allergy.clinicalNotes}</p>
                )}

                <div className="pt-2 border-t border-[#1E293B]/60 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>Type: {allergy.allergyType}</span>
                  <span>Recorded By: {allergy.provenance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: VACCINATIONS & IMMUNIZATIONS */}
      {activeSubTab === 'vaccinations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Immunization &amp; Vaccination Records</h2>
              <p className="text-xs text-[#94A3B8]">
                Canonical vaccines, batch lot verification, rabies compliance, and overdue booster warnings.
              </p>
            </div>
            <button
              onClick={() => setShowVaccineModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Vaccination</span>
            </button>
          </div>

          <div className="space-y-3">
            {vaccinations.map((vac) => {
              const isExpired = vac.validUntil && new Date(vac.validUntil) < new Date();
              return (
                <div
                  key={vac.vaccinationId}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isExpired
                      ? 'bg-red-950/20 border-red-900/40'
                      : 'bg-[#131722] border-[#1E293B]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{vac.vaccineName}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isExpired
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isExpired ? 'OVERDUE / EXPIRED' : 'VALID & PROTECTED'}
                      </span>
                      {vac.batchLotNumber && (
                        <span className="font-mono text-[10px] text-[#94A3B8] bg-[#0B0D10] px-1.5 py-0.5 rounded border border-[#1E293B]">
                          Lot #{vac.batchLotNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      Protects against: <strong>{vac.targetDiseases.join(', ')}</strong>
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
                      <span>Administered: {vac.administeredAt}</span>
                      {vac.validUntil && <span>· Valid until: {vac.validUntil}</span>}
                      {vac.externalClinicName && <span>· Clinic: {vac.externalClinicName}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {vac.status !== 'ENTERED_IN_ERROR' && (
                      <button
                        onClick={() =>
                          setShowEnteredInErrorModal({
                            type: 'VACCINATION',
                            id: vac.vaccinationId,
                            title: vac.vaccineName
                          })
                        }
                        className="text-[#64748B] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-950/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: MEDICATIONS & PRESCRIPTIONS */}
      {activeSubTab === 'medications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Medications &amp; Prescriptions</h2>
              <p className="text-xs text-[#94A3B8]">
                Active daily regimens, dosage schedules, routes, and discontinuation clinical audits.
              </p>
            </div>
            <button
              onClick={() => setShowMedicationModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Medication</span>
            </button>
          </div>

          <div className="space-y-3">
            {medications.map((med) => (
              <div
                key={med.medicationId}
                className="p-4 bg-[#131722] border border-[#1E293B] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{med.medicationName}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        med.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#1E293B] text-[#94A3B8]'
                      }`}
                    >
                      {med.status}
                    </span>
                    <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-800/40">
                      {med.dosage} {med.dosageUnit} · {med.route}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    <strong>Instructions:</strong> {med.instructions} ({med.frequency})
                  </p>
                  {med.discontinuedReason && (
                    <p className="text-xs text-amber-300 font-medium">
                      Discontinued: {med.discontinuedReason}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
                    <span>Started: {med.startAt}</span>
                    {med.prescribingProvider && <span>· Prescriber: {med.prescribingProvider}</span>}
                  </div>
                </div>

                {med.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleStopMedication(med.medicationId)}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-950/40 text-red-300 border border-red-800/40 rounded-xl hover:bg-red-900/60 transition-all shrink-0"
                  >
                    Discontinue Course
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: ENCOUNTERS & CLINICAL VISITS */}
      {activeSubTab === 'encounters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Veterinary Clinical Encounters</h2>
              <p className="text-xs text-[#94A3B8]">
                Professional veterinary visits, physical examinations, SOAP notes, and follow-ups.
              </p>
            </div>
            <button
              onClick={() => setShowEncounterModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Encounter</span>
            </button>
          </div>

          <div className="space-y-4">
            {encounters.map((enc) => (
              <div key={enc.encounterId} className="p-5 bg-[#131722] border border-[#1E293B] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {enc.encounterType}
                    </span>
                    <h3 className="text-sm font-bold text-white">{enc.reason}</h3>
                  </div>
                  <span className="text-xs text-[#64748B]">{new Date(enc.occurredAt).toLocaleString()}</span>
                </div>

                <div className="bg-[#0B0D10] border border-[#1E293B] rounded-xl p-3 text-xs text-[#CBD5E1] space-y-1">
                  <p>
                    <strong className="text-white">Outcome / Findings:</strong> {enc.outcome}
                  </p>
                  {enc.chiefComplaint && (
                    <p className="text-[#94A3B8]">
                      <strong>Chief Complaint:</strong> {enc.chiefComplaint}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-[#64748B] pt-2 border-t border-[#1E293B]/60">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{enc.externalClinicName}</span>
                    {enc.externalProviderName && <span>· Attending: {enc.externalProviderName}</span>}
                  </div>
                  {enc.followUpRequired && (
                    <span className="text-amber-400 font-bold">Follow-Up Required: {enc.followUpDate}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: DIAGNOSTICS & LABS */}
      {activeSubTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Diagnostic Laboratory Panels</h2>
              <p className="text-xs text-[#94A3B8]">
                Hematology CBC, Serum Biochemistry, Urinalysis, and imaging panels with reference ranges.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {diagnostics.map((diag) => (
              <div key={diag.diagnosticId} className="p-5 bg-[#131722] border border-[#1E293B] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {diag.testType}
                    </span>
                    <h3 className="text-sm font-bold text-white">{diag.testName}</h3>
                  </div>
                  <span className="text-xs text-[#64748B]">{new Date(diag.collectedAt).toLocaleDateString()}</span>
                </div>

                <p className="text-xs text-[#94A3B8]">{diag.resultSummary}</p>

                {diag.structuredResults && diag.structuredResults.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-[#1E293B] rounded-xl overflow-hidden">
                      <thead className="bg-[#0B0D10] text-[#94A3B8] border-b border-[#1E293B]">
                        <tr>
                          <th className="p-2.5">Marker</th>
                          <th className="p-2.5">Result</th>
                          <th className="p-2.5">Reference Range</th>
                          <th className="p-2.5">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B] bg-[#0F1115]">
                        {diag.structuredResults.map((r, i) => (
                          <tr key={i} className={r.abnormalFlag ? 'bg-amber-950/20 text-amber-200' : ''}>
                            <td className="p-2.5 font-medium text-white">{r.marker}</td>
                            <td className="p-2.5 font-mono font-bold">
                              {r.value} {r.unit}
                            </td>
                            <td className="p-2.5 text-[#94A3B8]">{r.referenceRange}</td>
                            <td className="p-2.5">
                              {r.abnormalFlag ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  ABNORMAL
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-medium">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 8: PROCEDURES */}
      {activeSubTab === 'procedures' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white">Surgical &amp; Clinical Procedures</h2>
          <div className="space-y-3">
            {procedures.map((proc) => (
              <div key={proc.procedureId} className="p-4 bg-[#131722] border border-[#1E293B] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {proc.procedureType}
                    </span>
                    <h3 className="text-sm font-bold text-white">{proc.procedureName}</h3>
                  </div>
                  <span className="text-xs text-[#64748B]">{proc.performedAt}</span>
                </div>
                <p className="text-xs text-[#94A3B8]">
                  <strong>Indication:</strong> {proc.reasonIndication}
                </p>
                <p className="text-xs text-white">
                  <strong>Outcome:</strong> {proc.outcome}
                </p>
                <div className="text-[11px] text-[#64748B] pt-2 border-t border-[#1E293B]/60">
                  <span>Clinic: {proc.clinicName}</span> · <span>Surgeon: {proc.providerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 9: AUDIT & TIMELINE PROJECTION */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Unified Timeline Projection &amp; Audit Trail</h2>
            <p className="text-xs text-[#94A3B8]">
              Idempotent event projection into Sprint 4 Unified Pet Timeline with sourceDomain `VETERINARY_HEALTH`.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">
              Projected Health Events ({timelineEvents.length})
            </h3>
            {timelineEvents.map((ev) => (
              <div key={ev.eventId} className="p-3.5 bg-[#131722] border border-[#1E293B] rounded-xl flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{ev.title}</h4>
                    <span className="text-[10px] font-mono text-[#64748B]">{ev.occurredAt}</span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">{ev.summary}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-[#64748B]">
                    <span>Deduplication: {ev.deduplicationKey}</span>
                    <span>·</span>
                    <span>Provenance: {ev.provenanceType}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Immutability Amendments Log */}
          {amendments.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#1E293B]">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Audit Amendments (Entered in Error Records)
              </h3>
              {amendments.map((am) => (
                <div
                  key={am.amendmentId}
                  className="p-3 bg-[#0B0D10] border border-amber-900/40 rounded-xl text-xs text-amber-200/90 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-300">
                      {am.recordType} amended: {am.actionType}
                    </strong>
                    <span className="font-mono text-[10px] text-[#64748B]">{am.amendedAt}</span>
                  </div>
                  <p>Reason: {am.reason}</p>
                  <p className="text-[10px] font-mono text-[#64748B]">Actor: {am.amendedByUserId}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 10: AUTOMATED TEST SUITE */}
      {activeSubTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Sprint 5 Automated Veterinary Health Test Suite</h2>
              <p className="text-xs text-[#94A3B8]">
                Runs 13 rigorous assertion tests validating ADR-005 provenance, role authorization, and timeline projection.
              </p>
            </div>
            <button
              onClick={runSprint5Tests}
              disabled={testsRunning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Play className="w-4 h-4" />
              <span>{testsRunning ? 'Running Tests...' : 'Run Test Suite'}</span>
            </button>
          </div>

          {testSummary && (
            <div className="p-4 bg-[#131722] border border-[#1E293B] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#94A3B8]">Result:</span>
                <span
                  className={`text-sm font-bold ${
                    testSummary.failed === 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {testSummary.passed} / {testSummary.total} Passed
                </span>
              </div>
              <span className="text-xs font-mono text-[#64748B]">{testSummary.durationMs}ms</span>
            </div>
          )}

          <div className="space-y-2">
            {testResults.map((t) => (
              <div
                key={t.code}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  t.passed ? 'bg-[#131722] border-[#1E293B]' : 'bg-red-950/40 border-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="font-mono text-emerald-400 font-bold">{t.code}</span>
                  <span className="text-white font-medium">{t.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0B0D10] text-[#94A3B8]">
                    {t.category}
                  </span>
                  <span className="text-[#64748B] font-mono text-[10px]">{t.durationMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: RECORD CONDITION */}
      {showConditionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131722] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Record Clinical Condition or Owner Observation
            </h3>

            <form onSubmit={handleCreateCondition} className="space-y-3">
              {/* Type Switcher: Diagnosis vs Observation */}
              <div className="p-3 bg-[#0B0D10] border border-[#1E293B] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#CBD5E1] block">Entry Classification:</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCondForm({
                        ...condForm,
                        isDiagnosis: false,
                        provenance: 'OWNER_ENTERED'
                      })
                    }
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                      !condForm.isDiagnosis
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                        : 'text-[#94A3B8] border-transparent hover:bg-[#1E293B]'
                    }`}
                  >
                    Owner Symptom Observation
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCondForm({
                        ...condForm,
                        isDiagnosis: true,
                        provenance: 'VETERINARY_PROFESSIONAL'
                      })
                    }
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border text-center transition-all ${
                      condForm.isDiagnosis
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                        : 'text-[#94A3B8] border-transparent hover:bg-[#1E293B]'
                    }`}
                  >
                    Professional Diagnosis
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Condition Name / Symptom</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canine Atopic Dermatitis, Limping on hind leg"
                  value={condForm.conditionName}
                  onChange={(e) => setCondForm({ ...condForm, conditionName: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Category</label>
                  <select
                    value={condForm.category}
                    onChange={(e) => setCondForm({ ...condForm, category: e.target.value as ConditionCategory })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="DERMATOLOGY">Dermatology</option>
                    <option value="ORTHOPEDIC">Orthopedic</option>
                    <option value="GASTROINTESTINAL">Gastrointestinal</option>
                    <option value="CARDIOLOGY">Cardiology</option>
                    <option value="OPHTHALMOLOGY">Ophthalmology</option>
                    <option value="NEUROLOGY">Neurology</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Severity</label>
                  <select
                    value={condForm.severity}
                    onChange={(e) => setCondForm({ ...condForm, severity: e.target.value as ClinicalSeverity })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="MILD">Mild</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="SEVERE">Severe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={condForm.description}
                  onChange={(e) => setCondForm({ ...condForm, description: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  placeholder="Clinical findings, frequency, or triggers..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chronicCheck"
                  checked={condForm.chronic}
                  onChange={(e) => setCondForm({ ...condForm, chronic: e.target.checked })}
                  className="rounded border-[#1E293B]"
                />
                <label htmlFor="chronicCheck" className="text-xs text-white font-medium">
                  Chronic / Lifelong Condition
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowConditionModal(false)}
                  className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD ALLERGY */}
      {showAllergyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131722] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Register Allergy or Adverse Drug Reaction
            </h3>

            <form onSubmit={handleCreateAllergy} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Allergen / Substance</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chicken Protein, Penicillin, Bee Venom"
                  value={allergyForm.allergen}
                  onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Category</label>
                  <select
                    value={allergyForm.allergenCategory}
                    onChange={(e) => setAllergyForm({ ...allergyForm, allergenCategory: e.target.value as AllergenCategory })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="FOOD">Food / Dietary</option>
                    <option value="MEDICATION">Medication / Drug</option>
                    <option value="ENVIRONMENTAL">Environmental / Pollen</option>
                    <option value="PARASITE_FLEA">Flea / Parasite</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Severity</label>
                  <select
                    value={allergyForm.severity}
                    onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value as ClinicalSeverity })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="MILD">Mild (Local itch/sneezing)</option>
                    <option value="MODERATE">Moderate (Urticaria/vomiting)</option>
                    <option value="SEVERE">Severe (Anaphylaxis/Shock)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Observed Reaction</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Facial swelling, severe pruritus, collapse"
                  value={allergyForm.reaction}
                  onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowAllergyModal(false)}
                  className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Allergy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG VACCINATION */}
      {showVaccineModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131722] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Syringe className="w-4 h-4 text-emerald-400" />
              Log Vaccination Administration
            </h3>

            <form onSubmit={handleCreateVaccine} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Vaccine From Catalog</label>
                <select
                  value={vaccineForm.vaccineCode}
                  onChange={(e) => {
                    const found = CANONICAL_VACCINES.find(v => v.code === e.target.value);
                    setVaccineForm({
                      ...vaccineForm,
                      vaccineCode: e.target.value,
                      vaccineName: found?.name || e.target.value
                    });
                  }}
                  className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                >
                  {CANONICAL_VACCINES.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Administered Date</label>
                  <input
                    type="date"
                    required
                    value={vaccineForm.administeredAt}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, administeredAt: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Valid Until / Next Due</label>
                  <input
                    type="date"
                    required
                    value={vaccineForm.validUntil}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, validUntil: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Batch / Lot #</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RB-2025-998"
                    value={vaccineForm.batchLotNumber}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, batchLotNumber: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#94A3B8] block mb-1">Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. Zoetis, MSD"
                    value={vaccineForm.manufacturer}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, manufacturer: e.target.value })}
                    className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setShowVaccineModal(false)}
                  className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Save Vaccination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ENTERED IN ERROR AUDIT AMENDMENT */}
      {showEnteredInErrorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131722] border border-red-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Clinical Audit Amendment</h3>
            </div>

            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              In accordance with veterinary provenance governance, clinical records are{' '}
              <strong>never hard-deleted</strong>. This entry will be marked as{' '}
              <strong className="text-red-300">ENTERED_IN_ERROR</strong>, preserved in the immutable audit log,
              and excluded from active summaries.
            </p>

            <div className="p-2.5 bg-[#0B0D10] border border-[#1E293B] rounded-xl text-xs text-white font-medium">
              Target Record: {showEnteredInErrorModal.title}
            </div>

            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1">
                Clinical Amendment Reason (Mandatory)
              </label>
              <textarea
                rows={2}
                required
                placeholder="e.g. Accidental duplicate entry, incorrect patient selected..."
                value={enteredInErrorReason}
                onChange={(e) => setEnteredInErrorReason(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowEnteredInErrorModal(null);
                  setEnteredInErrorReason('');
                }}
                className="px-3 py-1.5 text-xs text-[#94A3B8] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!enteredInErrorReason}
                onClick={handleEnteredInError}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
              >
                Amend Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
