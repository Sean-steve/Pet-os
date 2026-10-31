import { MigrationWave2Service } from './service';

interface Result {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export class MigrationWave2TestSuite {
  static async runAllTests() {
    const tests: Array<{ id: string; name: string; fn: () => void }> = [
      { id: 'W2-T01', name: 'All five care domains have durable stores', fn: () => {
        if (!MigrationWave2Service.run().gates.fiveDurableStores) throw new Error('five durable stores not certified');
      }},
      { id: 'W2-T02', name: 'All five care domains have authenticated Pet-scoped APIs', fn: () => {
        if (!MigrationWave2Service.run().gates.fiveAuthenticatedApis) throw new Error('five API boundaries not certified');
      }},
      { id: 'W2-T03', name: 'Tenant authorization and RLS are both mandatory', fn: () => {
        const gates = MigrationWave2Service.run().gates;
        if (!gates.tenantAuthorization || !gates.rowLevelSecurity) throw new Error('tenant isolation gate missing');
      }},
      { id: 'W2-T04', name: 'Writes are idempotent and outbox-backed', fn: () => {
        const gates = MigrationWave2Service.run().gates;
        if (!gates.payloadBoundIdempotency || !gates.transactionalOutbox) throw new Error('write-safety gate missing');
      }},
      { id: 'W2-T05', name: 'Mutable domains use optimistic concurrency and immutable revisions', fn: () => {
        const gates = MigrationWave2Service.run().gates;
        if (!gates.optimisticConcurrency || !gates.immutableRevisionHistory) throw new Error('revision safety gate missing');
      }},
      { id: 'W2-T06', name: 'Health remains append-only with amendments', fn: () => {
        if (!MigrationWave2Service.run().gates.healthAppendOnly) throw new Error('Health append-only boundary missing');
      }},
      { id: 'W2-T07', name: 'Real PostgreSQL and Redis integration is required', fn: () => {
        if (!MigrationWave2Service.run().gates.realPostgresRedisIntegration) throw new Error('real integration gate missing');
      }},
      { id: 'W2-T08', name: 'Wave 2 reports complete but not production ready', fn: () => {
        const report = MigrationWave2Service.run();
        if (report.verdict !== 'WAVE_2_DURABLE_BACKEND_COMPLETE') throw new Error('Wave 2 verdict blocked');
        if (report.productionReady !== false) throw new Error('Wave 2 incorrectly claims production readiness');
      }},
      { id: 'W2-T09', name: 'Frontend cutover remains explicit', fn: () => {
        if (!MigrationWave2Service.run().gates.frontendCutoverStillPending) throw new Error('frontend cutover boundary missing');
      }},
      { id: 'W2-T10', name: 'Wave 3 remains Provider Booking Professional Care Reviews', fn: () => {
        const next = MigrationWave2Service.run().nextWave;
        if (next.wave !== 3 || next.domains.join('|') !== 'Provider|Booking|Professional Care|Reviews') throw new Error('next migration wave drifted');
      }},
    ];

    const results: Result[] = [];
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
