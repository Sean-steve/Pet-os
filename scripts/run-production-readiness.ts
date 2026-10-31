import { readFileSync } from 'node:fs';
import { ProductionReadinessService } from '../src/pet-os/readiness/service';

const read = (path: string) => readFileSync(path, 'utf8');
const ci = read('.github/workflows/ci.yml');
const pages = read('.github/workflows/pages.yml');
const pkg = JSON.parse(read('package.json')) as { version?: string; scripts?: Record<string, string> };
const regression = read('scripts/run-all-tests.ts');

const failures: string[] = [];
const requireText = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

requireText(!ci.includes('continue-on-error: true'), 'CI still contains an advisory continue-on-error bypass.');
requireText(!pages.includes('continue-on-error: true'), 'Pages still contains an advisory continue-on-error bypass.');
requireText(ci.includes('npm run typecheck'), 'CI does not enforce npm run typecheck.');
requireText(pages.includes('npm run typecheck'), 'Pages does not enforce npm run typecheck.');
requireText(ci.includes('npm run production-readiness:check'), 'CI does not enforce the Sprint 37 production-readiness gate.');
requireText(pages.includes('npm run production-readiness:check'), 'Pages does not enforce the Sprint 37 production-readiness gate.');
requireText(regression.includes('Sprint 37 (Production Readiness Closure)'), 'Sprint 37 is missing from the unified regression runner.');
requireText(pkg.version === '0.37.0', 'package.json version must be 0.37.0 for Sprint 37.');
requireText(Boolean(pkg.scripts?.['production-readiness:check']), 'package.json is missing production-readiness:check.');

const report = ProductionReadinessService.run();
requireText(report.verdict === 'CODEBASE_READY_FOR_BACKEND_MIGRATION', 'Readiness verdict is blocked.');
requireText(report.productionReady === false, 'Sprint 37 must never mark the prototype production ready.');
requireText(report.externalRequired >= 10, 'Production blocker register is incomplete.');
requireText(report.migrationBoundaries.length >= 6, 'Backend migration boundary register is incomplete.');

console.log(`Pet OS production-readiness closure: ${report.verdict}`);
console.log(`Repository gates closed: ${report.closedInRepo} | External production requirements: ${report.externalRequired} | In-repo blocked: ${report.blocked}`);
console.log('Production ready: NO — backend/infrastructure certification remains required.');

if (failures.length) {
  for (const failure of failures) console.error('[FAIL] ' + failure);
  process.exit(1);
}
