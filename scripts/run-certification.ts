import { seedUnifiedPetOS, CANONICAL_IDS } from '../src/pet-os/seed/unified-seed';
import { FullSystemCertificationService } from '../src/pet-os/certification/service';

await seedUnifiedPetOS({forceReset:true});
const report=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);
console.log(`Pet OS full-system certification: ${report.verdict}`);
for(const j of report.journeys){
  console.log(`[${j.status}] ${j.journeyId} — ${j.title}`);
  if(j.failure)console.error('  '+j.failure);
}
console.log(`Roles: ${report.roleCoverage.length}/9 | Journeys: ${report.passed} passed, ${report.failed} failed, ${report.warned} warned`);
if(report.verdict!=='CERTIFIED_PROTOTYPE')process.exit(1);
