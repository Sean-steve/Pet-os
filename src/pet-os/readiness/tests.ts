import { ProductionReadinessService } from './service';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export class ProductionReadinessTestSuite {
  static async runAllTests() {
    const tests: Array<{ id: string; name: string; fn: () => void }> = [
      {
        id: 'PRD-01',
        name: 'Repository closure yields backend-migration readiness, not production readiness',
        fn: () => {
          const report = ProductionReadinessService.run();
          if (report.verdict !== 'CODEBASE_READY_FOR_BACKEND_MIGRATION') throw new Error('codebase readiness remained blocked');
          if (report.productionReady !== false) throw new Error('prototype was incorrectly marked production ready');
        },
      },
      {
        id: 'PRD-02',
        name: 'All repository-owned readiness items are closed in-repo',
        fn: () => {
          const report = ProductionReadinessService.run();
          const open = report.items.filter((item) => item.ownerBoundary === 'REPOSITORY' && item.status !== 'CLOSED_IN_REPO');
          if (open.length) throw new Error('repository-owned readiness items remain open: ' + open.map((item) => item.id).join(', '));
        },
      },
      {
        id: 'PRD-03',
        name: 'External production blockers remain explicit',
        fn: () => {
          const report = ProductionReadinessService.run();
          if (report.externalRequired < 10 || !report.releaseGates.productionBlockersExplicit) throw new Error('production blockers are incomplete');
        },
      },
      {
        id: 'PRD-04',
        name: 'Durable persistence, server auth, real payments and DR remain external requirements',
        fn: () => {
          const report = ProductionReadinessService.run();
          const ids = new Set(report.items.filter((item) => item.status === 'EXTERNAL_REQUIRED').map((item) => item.id));
          for (const id of ['PRD-EXT-01', 'PRD-EXT-02', 'PRD-EXT-05', 'PRD-EXT-11']) {
            if (!ids.has(id)) throw new Error('missing external production requirement: ' + id);
          }
        },
      },
      {
        id: 'PRD-05',
        name: 'Backend migration boundaries cover canonical state and infrastructure seams',
        fn: () => {
          const report = ProductionReadinessService.run();
          const text = report.migrationBoundaries.map((boundary) => boundary.domain).join(' ');
          for (const term of ['Identity', 'Health', 'Finance', 'Events', 'Tracking', 'Documents', 'Integrations', 'Platform']) {
            if (!text.includes(term)) throw new Error('missing migration boundary: ' + term);
          }
        },
      },
      {
        id: 'PRD-06',
        name: 'No readiness item can emit a PRODUCTION_READY claim',
        fn: () => {
          const report = ProductionReadinessService.run();
          const serialized = JSON.stringify(report);
          if (serialized.includes('"PRODUCTION_READY"')) throw new Error('forbidden production-ready verdict found');
        },
      },
      {
        id: 'PRD-07',
        name: 'Migration rules preserve canonical sources of truth',
        fn: () => {
          const report = ProductionReadinessService.run();
          const rules = report.migrationBoundaries.map((boundary) => boundary.migrationRule).join(' ');
          if (!/canonical/i.test(rules) || !/idempotent/i.test(rules) || !/server/i.test(rules)) {
            throw new Error('migration rules do not preserve canonical server-authoritative boundaries');
          }
        },
      },
      {
        id: 'PRD-08',
        name: 'Production-readiness register contains no hidden in-repo BLOCKED item',
        fn: () => {
          const report = ProductionReadinessService.run();
          if (report.blocked !== 0 || !report.releaseGates.noHiddenRepositoryBlockers) throw new Error('repository readiness contains a blocking item');
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
