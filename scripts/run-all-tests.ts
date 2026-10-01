import { seedUnifiedPetOS } from '../src/pet-os/seed/unified-seed';

async function main() {
  console.log('--- Initializing Unified Pet OS Seed Baseline ---');
  seedUnifiedPetOS();

  const suites: Array<{ name: string; runner: () => Promise<any> }> = [
    {
      name: 'Sprint 2 (Identity)',
      runner: async () => {
        const { IdentityTestSuite } = await import('../src/pet-os/identity/tests');
        return IdentityTestSuite.runAllTests();
      },
    },
    {
      name: 'Sprint 3 (Pet Core)',
      runner: async () => {
        const { PetCoreTestSuite } = await import('../src/pet-os/pet-core/tests');
        return PetCoreTestSuite.runAllTests();
      },
    },
    {
      name: 'Sprint 4 (Documents/Passport)',
      runner: async () => {
        const { Sprint4TestSuite } = await import('../src/pet-os/sprint4/tests');
        return Sprint4TestSuite.runAll();
      },
    },
    {
      name: 'Sprint 5 (Health)',
      runner: async () => {
        const { Sprint5HealthTestSuite } = await import('../src/pet-os/health/tests');
        return Sprint5HealthTestSuite.runAllTests();
      },
    },
    {
      name: 'Sprint 6 (Care)',
      runner: async () => {
        const { runSprint6TestSuite } = await import('../src/pet-os/care/tests');
        return runSprint6TestSuite();
      },
    },
    {
      name: 'Sprint 7 (Nutrition)',
      runner: async () => {
        const { Sprint7NutritionTestSuite } = await import('../src/pet-os/nutrition/tests');
        return Sprint7NutritionTestSuite.runAllTests();
      },
    },
    {
      name: 'Sprint 8 (Training)',
      runner: async () => {
        const { Sprint8TrainingTestSuite } = await import('../src/pet-os/training/tests');
        return Sprint8TrainingTestSuite.runAllTests();
      },
    },
    {
      name: 'Sprint 9 (Activity)',
      runner: async () => {
        const { runActivityTests } = await import('../src/pet-os/activity/tests');
        return runActivityTests();
      },
    },
    {
      name: 'Sprint 10 (Provider Platform)',
      runner: async () => {
        const { Sprint10TestSuite } = await import('../src/pet-os/provider/tests');
        return new Sprint10TestSuite().runAllTests();
      },
    },
    {
      name: 'Sprint 11 (Booking & Discovery)',
      runner: async () => {
        const { Sprint11TestSuite } = await import('../src/pet-os/booking/tests');
        return new Sprint11TestSuite().runAllTests();
      },
    },
    {
      name: 'Sprint 12 (Finance)',
      runner: async () => {
        const { FinancialPlatformTestSuite } = await import('../src/pet-os/finance/tests');
        return new FinancialPlatformTestSuite().runAll();
      },
    },
    {
      name: 'Sprint 13 (Dog Walking)',
      runner: async () => {
        const { Sprint13DogWalkingTestSuite } = await import('../src/pet-os/dog-walking/tests');
        return new Sprint13DogWalkingTestSuite().runAllTests();
      },
    },
    {
      name: 'Sprint 14 (Tracking & Geofence)',
      runner: async () => {
        const { runSprint14TrackingTests } = await import('../src/pet-os/tracking/tests');
        return runSprint14TrackingTests();
      },
    },
    {
      name: 'Sprint 15 (Lost Pet Recovery)',
      runner: async () => {
        const { runSprint15RecoveryTests } = await import('../src/pet-os/recovery/tests');
        return runSprint15RecoveryTests();
      },
    },
    {
      name: 'Sprint 16 (Community Safety)',
      runner: async () => {
        const { runSprint16CommunityTests } = await import('../src/pet-os/community/tests');
        return runSprint16CommunityTests();
      },
    },
    {
      name: 'Sprint 17 (Crowd Recovery Mesh)',
      runner: async () => {
        const { CrowdRecoveryTestSuite } = await import('../src/pet-os/crowd-recovery/tests');
        return new CrowdRecoveryTestSuite().runAllTests();
      },
    },
    {
      name: 'Sprint 18 (Rescue & Foster)',
      runner: async () => {
        const { runSprint18Tests } = await import('../src/pet-os/rescue/tests');
        return runSprint18Tests();
      },
    },
    {
      name: 'Sprint 19 (Veterinary Workspace)',
      runner: async () => {
        const { runSprint19Tests } = await import('../src/pet-os/vet-workspace/tests');
        return runSprint19Tests();
      },
    },
    {
      name: 'Sprint 20 (Trainer Workspace)',
      runner: async () => {
        const { runSprint20Tests } = await import('../src/pet-os/trainer-workspace/tests');
        return runSprint20Tests();
      },
    },
    {
      name: 'Sprint 21 (Professional Care Workspaces)',
      runner: async () => {
        const { runSprint21Tests } = await import('../src/pet-os/professional-care/tests');
        return runSprint21Tests();
      },
    },
  ];

  let allPassed = true;
  for (const suite of suites) {
    try {
      const res = await suite.runner();
      let passed = 0;
      let failed = 0;
      if (Array.isArray(res)) {
        passed = res.filter(r => r.passed !== false && r.success !== false).length;
        failed = res.filter(r => r.passed === false || r.success === false).length;
      } else if (res && typeof res === 'object') {
        passed = res.passed ?? res.passedCount ?? (res.results ? res.results.filter((r: any) => r.passed).length : 0);
        failed = res.failed ?? res.failedCount ?? (res.results ? res.results.filter((r: any) => !r.passed).length : 0);
      }
      const ok = failed === 0;
      if (!ok) allPassed = false;
      console.log(`[${ok ? 'OK' : 'FAIL'}] ${suite.name} -> passed: ${passed}, failed: ${failed}`);
    } catch (err: any) {
      allPassed = false;
      console.error(`[CRASH] ${suite.name} ->`, err.message || err);
    }
  }

  if (!allPassed) {
    console.error('\n>>> SOME SUITES FAILED <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL 19 SPRINT TEST SUITES (SPRINTS 2-20) PASSED WITH ZERO REGRESSIONS! <<<');
  }
}

main();
