import type { UserId } from '../kernel/ids';
import { ResilienceService } from './service';

export function seedResilienceData(platformAdmin:UserId){
  for(const dependencyId of ['IDENTITY','FINANCE','HEALTH','BOOKING','TRACKING','NOTIFICATIONS','INTEGRATIONS','AI'] as const){
    ResilienceService.recordDependencyResult({dependencyId,success:true});
  }
  const drill=ResilienceService.startRecoveryDrill(platformAdmin,{objectiveId:'RTO-TRACKING',scenario:'Simulated loss of primary tracking persistence followed by verified restore and service re-entry.'});
  ResilienceService.completeRecoveryDrill(platformAdmin,drill.drillId,{observedRtoMinutes:11,observedRpoMinutes:3,restoreVerified:true,evidence:'Prototype deterministic restore drill; production infrastructure evidence still required.'});
}
