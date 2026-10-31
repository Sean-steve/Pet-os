import { BackendFoundationService } from './service';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export class BackendFoundationTestSuite {
  static async runAllTests() {
    const tests: Array<{ id: string; name: string; fn: () => void }> = [
      {
        id: 'BFD-T01',
        name: 'Foundation verdict permits domain migration but not production certification',
        fn: () => {
          const report = BackendFoundationService.run();
          if (report.verdict !== 'BACKEND_FOUNDATION_READY_FOR_DOMAIN_MIGRATION') throw new Error('foundation is blocked');
          if (report.productionReady !== false) throw new Error('foundation incorrectly claims production readiness');
        },
      },
      {
        id: 'BFD-T02',
        name: 'Durable core persistence is represented as implemented',
        fn: () => {
          if (!BackendFoundationService.run().gates.durableCorePersistence) throw new Error('durable core persistence gate missing');
        },
      },
      {
        id: 'BFD-T03',
        name: 'Server authentication and tenant authorization are required gates',
        fn: () => {
          const gates = BackendFoundationService.run().gates;
          if (!gates.serverAuthentication || !gates.tenantAuthorization) throw new Error('auth gates missing');
        },
      },
      {
        id: 'BFD-T04',
        name: 'Transactional outbox and Redis runtime boundaries are required',
        fn: () => {
          const gates = BackendFoundationService.run().gates;
          if (!gates.transactionalOutbox || !gates.redisRuntimeBoundary) throw new Error('runtime gates missing');
        },
      },
      {
        id: 'BFD-T05',
        name: 'Deployable topology and real integration testing are required',
        fn: () => {
          const gates = BackendFoundationService.run().gates;
          if (!gates.deployableTopology || !gates.realIntegrationTest) throw new Error('deployment/integration gates missing');
        },
      },
      {
        id: 'BFD-T06',
        name: 'Waves 1-3 are complete; later migration waves remain pending',
        fn: () => {
          const waves = BackendFoundationService.run().migrationWaves;
          if (
            waves[0]?.status !== 'FOUNDATION_COMPLETE'
            || waves[1]?.status !== 'DURABLE_BACKEND_COMPLETE'
            || waves[2]?.status !== 'DURABLE_BACKEND_COMPLETE'
            || waves.slice(3).some((wave) => wave.status !== 'PENDING')
          ) {
            throw new Error('migration wave status is inaccurate');
          }
        },
      },
      {
        id: 'BFD-T07',
        name: 'Finance is explicitly not yet production migrated',
        fn: () => {
          const report = BackendFoundationService.run();
          if (!report.remaining.some((item) => /Finance ledger/.test(item.title))) throw new Error('finance migration boundary missing');
        },
      },
      {
        id: 'BFD-T08',
        name: 'Production evidence remains external',
        fn: () => {
          const report = BackendFoundationService.run();
          if (!report.remaining.some((item) => item.status === 'EXTERNAL_EVIDENCE_REQUIRED')) throw new Error('external evidence boundary missing');
        },
      },
    ];

    const results: TestResult[] = [];
    for (const test of tests) {
      const startedAt = Date.now();
      try {
        test.fn();
        results.push({ id: test.id, name: test.name, passed: true, message: 'PASS', durationMs: Date.now() - startedAt });
      } catch (error: any) {
        results.push({ id: test.id, name: test.name, passed: false, message: error?.message || String(error), durationMs: Date.now() - startedAt });
      }
    }
    return {
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      total: results.length,
      results,
    };
  }
}
