import { MigrationWave6Service } from './service';

interface Result { id:string; name:string; passed:boolean; message:string; durationMs:number; }

export class MigrationWave6TestSuite {
  static async runAllTests() {
    const tests:Array<{id:string;name:string;fn:()=>void}> = [
      {id:'W6-T01',name:'All five Wave 6 domains are durable',fn:()=>{const r=MigrationWave6Service.run();if(r.domains.length!==5||r.domains.some(d=>d.status!=='DURABLE_BACKEND'))throw new Error('Wave 6 domains incomplete');}},
      {id:'W6-T02',name:'Commerce remains server-priced and inventory-safe',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.commerceServerPricing||!g.commerceInventoryReservation)throw new Error('Commerce authority incomplete');}},
      {id:'W6-T03',name:'Commerce policy and Finance continuity are mandatory',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.commercePolicyBoundaries||!g.commerceFinanceLedgerContinuity)throw new Error('Commerce policy/ledger boundary missing');}},
      {id:'W6-T04',name:'Integration credentials are hashed and scope-bound',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.integrationHashedCredentials||!g.integrationScopeIsolation)throw new Error('Integration security incomplete');}},
      {id:'W6-T05',name:'Webhook delivery state is durable',fn:()=>{if(!MigrationWave6Service.run().gates.integrationWebhookQueue)throw new Error('Webhook delivery authority missing');}},
      {id:'W6-T06',name:'AI requires consent and remains non-authoritative',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.aiConsentGovernance||!g.aiNonAuthoritative)throw new Error('AI governance incomplete');}},
      {id:'W6-T07',name:'AI emergency inference is blocked',fn:()=>{if(!MigrationWave6Service.run().gates.aiEmergencyBlocking)throw new Error('AI emergency safety missing');}},
      {id:'W6-T08',name:'Automation requires policy and confirmation binding',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.automationPolicyAuthority||!g.automationConfirmationBinding)throw new Error('Automation policy incomplete');}},
      {id:'W6-T09',name:'Automation execution settlement remains explicit',fn:()=>{if(!MigrationWave6Service.run().gates.automationWorkerSettlement)throw new Error('Automation worker settlement missing');}},
      {id:'W6-T10',name:'Analytics are derived and privacy-minimized',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.analyticsDerivedAuthority||!g.analyticsPrivacyMinimization)throw new Error('Analytics authority incomplete');}},
      {id:'W6-T11',name:'Cross-tenant isolation and real integration remain mandatory',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.crossTenantIsolation||!g.realPostgresRedisIntegration)throw new Error('Isolation/integration incomplete');}},
      {id:'W6-T12',name:'All six backend migration waves are complete',fn:()=>{if(!MigrationWave6Service.run().domainMigrationComplete)throw new Error('Domain migration not complete');}},
      {id:'W6-T13',name:'Production readiness is not claimed',fn:()=>{const r=MigrationWave6Service.run();if(r.productionReady!==false||!r.gates.externalProductionEvidenceStillPending)throw new Error('Production boundary invalid');}},
      {id:'W6-T14',name:'Frontend cutover and async workers remain explicit closure work',fn:()=>{const g=MigrationWave6Service.run().gates;if(!g.frontendCutoverStillPending||!g.asyncWorkersStillPending)throw new Error('Remaining closure boundaries hidden');}},
    ];
    const results:Result[]=[];
    for(const t of tests){const s=Date.now();try{t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-s});}catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-s});}}
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
