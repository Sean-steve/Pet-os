/**
 * Pet OS Sprint 8 - Training & Behavior In-Memory Store
 * Implements Volume X & Volume XXX (Database Schema & Repository Layer)
 */

import {
  SkillId,
  TrainingProgramId,
  ProgramVersionId,
  ProgramStageId,
  TrainingExerciseId,
  TrainingGoalId,
  TrainingPlanId,
  TrainingSessionId,
  ExerciseAttemptId,
  SkillProgressId,
  TrainingMilestoneId,
  TrainingEvidenceId,
  BehaviorObservationId,
  PetId,
  HouseholdId
} from '../kernel/ids';
import {
  Skill,
  TrainingProgram,
  ProgramVersion,
  TrainingGoal,
  TrainingPlan,
  TrainingSession,
  ExerciseAttempt,
  PetSkillProgress,
  PetSkillProgressHistory,
  TrainingMilestone,
  TrainingEvidence,
  BehaviorObservation
} from './types';

export class TrainingStore {
  private static skills = new Map<SkillId, Skill>();
  private static programs = new Map<TrainingProgramId, TrainingProgram>();
  private static programVersions = new Map<ProgramVersionId, ProgramVersion>();
  private static trainingGoals = new Map<TrainingGoalId, TrainingGoal>();
  private static plans = new Map<TrainingPlanId, TrainingPlan>();
  private static sessions = new Map<TrainingSessionId, TrainingSession>();
  private static attempts = new Map<ExerciseAttemptId, ExerciseAttempt>();
  private static skillProgress = new Map<string, PetSkillProgress>(); // `${petId}_${skillId}`
  private static progressHistory: PetSkillProgressHistory[] = [];
  private static milestones = new Map<TrainingMilestoneId, TrainingMilestone>();
  private static milestoneIdempotency = new Map<string, TrainingMilestoneId>();
  private static evidence = new Map<TrainingEvidenceId, TrainingEvidence>();
  private static behaviorObservations = new Map<BehaviorObservationId, BehaviorObservation>();

  static clear(): void {
    this.skills.clear();
    this.programs.clear();
    this.programVersions.clear();
    this.trainingGoals.clear();
    this.plans.clear();
    this.sessions.clear();
    this.attempts.clear();
    this.skillProgress.clear();
    this.progressHistory = [];
    this.milestones.clear();
    this.milestoneIdempotency.clear();
    this.evidence.clear();
    this.behaviorObservations.clear();
  }

  // ==========================================
  // SKILLS & PREREQUISITES
  // ==========================================

  static saveSkill(skill: Skill): void {
    this.validateSkillPrerequisitesNoCycles(skill);
    this.skills.set(skill.skillId, { ...skill });
  }

  static findSkillById(id: SkillId): Skill | undefined {
    const s = this.skills.get(id);
    return s ? { ...s } : undefined;
  }

  static findSkillByCode(code: string): Skill | undefined {
    for (const s of this.skills.values()) {
      if (s.skillCode === code) return { ...s };
    }
    return undefined;
  }

  static listSkills(filter?: { species?: string; category?: string }): Skill[] {
    let list = Array.from(this.skills.values());
    if (filter?.species) {
      list = list.filter(s => s.speciesScope === 'ALL' || s.speciesScope === filter.species);
    }
    if (filter?.category) {
      list = list.filter(s => s.category === filter.category);
    }
    return list.map(s => ({ ...s }));
  }

  static listAllSkills(): Skill[] {
    return this.listSkills();
  }

  /**
   * Validates that adding or updating this skill does NOT create a cyclic dependency.
   * Uses Depth-First Search cycle detection.
   */
  static validateSkillPrerequisitesNoCycles(newOrUpdatedSkill: Skill): void {
    if (!newOrUpdatedSkill.prerequisiteSkillIds || newOrUpdatedSkill.prerequisiteSkillIds.length === 0) {
      return;
    }

    const adjacency = new Map<SkillId, SkillId[]>();
    for (const [id, s] of this.skills.entries()) {
      adjacency.set(id, [...s.prerequisiteSkillIds]);
    }
    adjacency.set(newOrUpdatedSkill.skillId, [...newOrUpdatedSkill.prerequisiteSkillIds]);

    // Check for cycle starting from this skill
    const visited = new Set<SkillId>();
    const recursionStack = new Set<SkillId>();

    const dfs = (currentId: SkillId): boolean => {
      visited.add(currentId);
      recursionStack.add(currentId);

      const prereqs = adjacency.get(currentId) || [];
      for (const prereqId of prereqs) {
        if (!visited.has(prereqId)) {
          if (dfs(prereqId)) return true;
        } else if (recursionStack.has(prereqId)) {
          return true; // cycle found
        }
      }

      recursionStack.delete(currentId);
      return false;
    };

    if (dfs(newOrUpdatedSkill.skillId)) {
      throw new Error(
        `Prerequisite cycle detected involving skill "${newOrUpdatedSkill.name}" (${newOrUpdatedSkill.skillId}). Circular prerequisites are forbidden.`
      );
    }
  }

  // ==========================================
  // PROGRAMS & VERSIONS
  // ==========================================

  static saveProgram(program: TrainingProgram): void {
    this.programs.set(program.programId, { ...program });
  }

  static findProgramById(id: TrainingProgramId): TrainingProgram | undefined {
    const p = this.programs.get(id);
    return p ? { ...p } : undefined;
  }

  static listPrograms(): TrainingProgram[] {
    return Array.from(this.programs.values()).map(p => ({ ...p }));
  }

  static listAllPrograms(): TrainingProgram[] {
    return this.listPrograms();
  }

  static saveProgramVersion(version: ProgramVersion): void {
    // Immutability: If version is already PUBLISHED or RETIRED, it cannot be rewritten.
    const existing = this.programVersions.get(version.programVersionId);
    if (existing && existing.status !== 'DRAFT') {
      // Content changes to published/retired program versions are strictly forbidden
      if (
        existing.stages.length !== version.stages.length ||
        JSON.stringify(existing.stages) !== JSON.stringify(version.stages)
      ) {
        throw new Error(
          `Cannot mutate published program version ${version.programVersionId}. Create a new version instead.`
        );
      }
    }
    this.programVersions.set(version.programVersionId, {
      ...version,
      stages: version.stages.map(st => ({
        ...st,
        exercises: st.exercises.map(e => ({ ...e }))
      }))
    });
  }

  static findProgramVersionById(id: ProgramVersionId): ProgramVersion | undefined {
    const v = this.programVersions.get(id);
    if (!v) return undefined;
    return {
      ...v,
      stages: v.stages.map(st => ({
        ...st,
        exercises: st.exercises.map(e => ({ ...e }))
      }))
    };
  }

  static listVersionsForProgram(programId: TrainingProgramId): ProgramVersion[] {
    return Array.from(this.programVersions.values())
      .filter(v => v.programId === programId)
      .map(v => ({
        ...v,
        stages: v.stages.map(st => ({
          ...st,
          exercises: st.exercises.map(e => ({ ...e }))
        }))
      }));
  }

  // ==========================================
  // TRAINING GOALS
  // ==========================================

  static saveGoal(goal: TrainingGoal): void {
    this.trainingGoals.set(goal.trainingGoalId, { ...goal });
  }

  static findGoalById(id: TrainingGoalId): TrainingGoal | undefined {
    const g = this.trainingGoals.get(id);
    return g ? { ...g } : undefined;
  }

  static listGoalsForPet(petId: PetId): TrainingGoal[] {
    return Array.from(this.trainingGoals.values())
      .filter(g => g.petId === petId)
      .map(g => ({ ...g }));
  }

  // ==========================================
  // TRAINING PLANS
  // ==========================================

  static savePlan(plan: TrainingPlan): void {
    const existing = this.plans.get(plan.trainingPlanId);
    if (existing && existing.concurrencyVersion !== plan.concurrencyVersion - 1 && plan.concurrencyVersion !== 1) {
      throw new Error(
        `Concurrency conflict on TrainingPlan ${plan.trainingPlanId}. Expected version ${existing.concurrencyVersion + 1}, got ${plan.concurrencyVersion}.`
      );
    }
    this.plans.set(plan.trainingPlanId, { ...plan });
  }

  static findPlanById(id: TrainingPlanId): TrainingPlan | undefined {
    const p = this.plans.get(id);
    return p ? { ...p } : undefined;
  }

  static findActivePlanForPet(petId: PetId): TrainingPlan | undefined {
    for (const p of this.plans.values()) {
      if (p.petId === petId && p.status === 'ACTIVE') {
        return { ...p };
      }
    }
    return undefined;
  }

  static listPlansForPet(petId: PetId): TrainingPlan[] {
    return Array.from(this.plans.values())
      .filter(p => p.petId === petId)
      .map(p => ({ ...p }));
  }

  // ==========================================
  // SESSIONS & ATTEMPTS
  // ==========================================

  static saveSession(session: TrainingSession): void {
    const existing = this.sessions.get(session.trainingSessionId);
    if (existing && existing.concurrencyVersion !== session.concurrencyVersion - 1 && session.concurrencyVersion !== 1) {
      throw new Error(
        `Concurrency conflict on TrainingSession ${session.trainingSessionId}. Expected version ${existing.concurrencyVersion + 1}, got ${session.concurrencyVersion}.`
      );
    }
    this.sessions.set(session.trainingSessionId, {
      ...session,
      attempts: session.attempts.map(a => ({ ...a }))
    });
  }

  static findSessionById(id: TrainingSessionId): TrainingSession | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    return {
      ...s,
      attempts: s.attempts.map(a => ({ ...a }))
    };
  }

  static findActiveSessionForPet(petId: PetId): TrainingSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.petId === petId && s.status === 'IN_PROGRESS') {
        return { ...s, attempts: s.attempts.map(a => ({ ...a })) };
      }
    }
    return undefined;
  }

  static listSessionsForPet(petId: PetId): TrainingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.petId === petId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .map(s => ({ ...s, attempts: s.attempts.map(a => ({ ...a })) }));
  }

  static saveAttempt(attempt: ExerciseAttempt): void {
    this.attempts.set(attempt.attemptId, { ...attempt });
  }

  static listAttemptsForSession(sessionId: TrainingSessionId): ExerciseAttempt[] {
    return Array.from(this.attempts.values())
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => a.sequence - b.sequence)
      .map(a => ({ ...a }));
  }

  // ==========================================
  // SKILL PROFICIENCY & PROGRESS
  // ==========================================

  static saveSkillProgress(progress: PetSkillProgress): void {
    const key = `${progress.petId}_${progress.skillId}`;
    this.skillProgress.set(key, { ...progress });
  }

  static findSkillProgress(petId: PetId, skillId: SkillId): PetSkillProgress | undefined {
    const key = `${petId}_${skillId}`;
    const p = this.skillProgress.get(key);
    return p ? { ...p } : undefined;
  }

  static listSkillProgressForPet(petId: PetId): PetSkillProgress[] {
    return Array.from(this.skillProgress.values())
      .filter(p => p.petId === petId)
      .map(p => ({ ...p }));
  }

  static recordProgressHistory(history: PetSkillProgressHistory): void {
    this.progressHistory.push({ ...history });
  }

  static listProgressHistoryForSkill(petId: PetId, skillId: SkillId): PetSkillProgressHistory[] {
    return this.progressHistory
      .filter(h => h.petId === petId && h.skillId === skillId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .map(h => ({ ...h }));
  }

  // ==========================================
  // MILESTONES & IDEMPOTENCY
  // ==========================================

  static saveMilestone(milestone: TrainingMilestone): boolean {
    if (this.milestoneIdempotency.has(milestone.idempotencyKey)) {
      // Idempotency: Duplicate rejected without error, returning false
      return false;
    }
    this.milestones.set(milestone.milestoneId, { ...milestone });
    this.milestoneIdempotency.set(milestone.idempotencyKey, milestone.milestoneId);
    return true;
  }

  static listMilestonesForPet(petId: PetId): TrainingMilestone[] {
    return Array.from(this.milestones.values())
      .filter(m => m.petId === petId)
      .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
      .map(m => ({ ...m }));
  }

  // ==========================================
  // TRAINING EVIDENCE
  // ==========================================

  static saveEvidence(evidence: TrainingEvidence): void {
    this.evidence.set(evidence.evidenceId, { ...evidence });
  }

  static findEvidenceById(id: TrainingEvidenceId): TrainingEvidence | undefined {
    const e = this.evidence.get(id);
    return e ? { ...e } : undefined;
  }

  static listEvidenceForPet(petId: PetId): TrainingEvidence[] {
    return Array.from(this.evidence.values())
      .filter(e => e.petId === petId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
      .map(e => ({ ...e }));
  }

  // ==========================================
  // BEHAVIOR OBSERVATIONS
  // ==========================================

  static saveBehaviorObservation(obs: BehaviorObservation): void {
    this.behaviorObservations.set(obs.observationId, {
      ...obs,
      amendments: obs.amendments.map(a => ({ ...a }))
    });
  }

  static findBehaviorObservationById(id: BehaviorObservationId): BehaviorObservation | undefined {
    const o = this.behaviorObservations.get(id);
    if (!o) return undefined;
    return {
      ...o,
      amendments: o.amendments.map(a => ({ ...a }))
    };
  }

  static listBehaviorObservationsForPet(petId: PetId): BehaviorObservation[] {
    return Array.from(this.behaviorObservations.values())
      .filter(o => o.petId === petId)
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
      .map(o => ({
        ...o,
        amendments: o.amendments.map(a => ({ ...a }))
      }));
  }

  static listObservationsForPet(petId: PetId): BehaviorObservation[] {
    return this.listBehaviorObservationsForPet(petId);
  }
}
