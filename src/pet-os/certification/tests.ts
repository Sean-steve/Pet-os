import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { FullSystemCertificationService } from './service';

interface TestResult{id:string;name:string;passed:boolean;message:string;durationMs:number;}
async function setup(){await seedUnifiedPetOS({forceReset:true});}

export class FullSystemCertificationTestSuite{
  static async runAllTests(){
    const tests:Array<{id:string;name:string;fn:()=>Promise<void>|void}>=[
      {id:'CERT-01',name:'Certification requires platform security and incident authority',fn:async()=>{await setup();let denied=false;try{FullSystemCertificationService.run(CANONICAL_IDS.OWNER_ELENA);}catch(e:any){denied=String(e.message).includes('CERTIFICATION_PLATFORM_AUTHORITY_REQUIRED');}if(!denied)throw new Error('ordinary user ran platform certification');}},
      {id:'CERT-02',name:'All nine multi-sided Pet OS workspaces are covered',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.roleCoverage.length!==9||!r.releaseGates.allNineWorkspacesCovered)throw new Error('workspace certification coverage incomplete');}},
      {id:'CERT-03',name:'Canonical household graph passes end-to-end',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-01')?.status!=='PASS')throw new Error('household graph failed');}},
      {id:'CERT-04',name:'Cross-tenant isolation is a release gate',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(!r.releaseGates.crossTenantIsolation)throw new Error('tenant isolation gate failed');}},
      {id:'CERT-05',name:'Professional offering and booking continuity passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-04')?.status!=='PASS')throw new Error('professional booking continuity failed');}},
      {id:'CERT-06',name:'Professional care has no orphan booking engagements',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-05')?.status!=='PASS')throw new Error('professional care booking link failed');}},
      {id:'CERT-07',name:'Canonical booking connects to payment receipt and provider earning',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(!r.releaseGates.canonicalFinanceContinuity)throw new Error('canonical finance continuity failed');}},
      {id:'CERT-08',name:'Provider business subscription continuity passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-07')?.status!=='PASS')throw new Error('provider SaaS continuity failed');}},
      {id:'CERT-09',name:'Transport resolves verified driver vehicle and custody',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-08')?.status!=='PASS')throw new Error('transport certification failed');}},
      {id:'CERT-10',name:'Rescue custody graph passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-09')?.status!=='PASS')throw new Error('rescue custody certification failed');}},
      {id:'CERT-11',name:'Commerce seller inventory buyer-order journey passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-10')?.status!=='PASS')throw new Error('commerce certification failed');}},
      {id:'CERT-12',name:'Subscription and tracker continuity passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-11')?.status!=='PASS')throw new Error('subscription certification failed');}},
      {id:'CERT-13',name:'AI action governance prevents automated money movement',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-13')?.status!=='PASS')throw new Error('AI governance certification failed');}},
      {id:'CERT-14',name:'Developer integration continuity passes',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.journeys.find(j=>j.journeyId==='E2E-14')?.status!=='PASS')throw new Error('integration certification failed');}},
      {id:'CERT-15',name:'Security and resilience authority forms a release gate',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(!r.releaseGates.privilegedControlPlane)throw new Error('privileged control-plane gate failed');}},
      {id:'CERT-16',name:'Full seeded platform receives CERTIFIED_PROTOTYPE verdict',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(r.verdict!=='CERTIFIED_PROTOTYPE'||r.failed!==0||!r.releaseGates.noCriticalJourneyFailures)throw new Error('full system remained blocked: '+r.journeys.filter(j=>j.status==='FAIL').map(j=>j.journeyId+':'+j.failure).join(', '));}},
      {id:'CERT-17',name:'Certification never misrepresents prototype as production certified',fn:async()=>{await setup();const r=FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES);if(!r.productionBoundaries.some(x=>/not production certification/i.test(x))||!r.productionBoundaries.some(x=>/production readiness still requires/i.test(x)))throw new Error('production boundary missing');}},
    ];
    const results:TestResult[]=[];
    for(const t of tests){const s=Date.now();try{await t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-s});}catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-s});}}
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
