import { MigrationWave4Service } from './service';

interface Result { id:string; name:string; passed:boolean; message:string; durationMs:number; }

export class MigrationWave4TestSuite {
  static async runAllTests() {
    const tests:Array<{id:string;name:string;fn:()=>void}> = [
      { id:'W4-T01', name:'Finance Subscriptions Provider SaaS are durable', fn:()=> {
        const report=MigrationWave4Service.run();
        if(report.domains.length!==3 || report.domains.some((domain)=>domain.status!=='DURABLE_BACKEND')) throw new Error('Wave 4 domain authority incomplete');
      }},
      { id:'W4-T02', name:'Booking payments are server-derived', fn:()=> {
        if(!MigrationWave4Service.run().gates.serverDerivedBookingPayments) throw new Error('payment authority missing');
      }},
      { id:'W4-T03', name:'Ledger is immutable and balanced', fn:()=> {
        if(!MigrationWave4Service.run().gates.immutableBalancedDoubleEntryLedger) throw new Error('ledger invariant missing');
      }},
      { id:'W4-T04', name:'Receipts refunds earnings and payouts are durable', fn:()=> {
        if(!MigrationWave4Service.run().gates.durableReceiptsRefundsEarningsPayouts) throw new Error('finance lifecycle incomplete');
      }},
      { id:'W4-T05', name:'Settlement is isolated behind trusted adapter', fn:()=> {
        if(!MigrationWave4Service.run().gates.trustedBillingAdapterBoundary) throw new Error('trusted adapter boundary missing');
      }},
      { id:'W4-T06', name:'Consumer billing produces durable entitlements', fn:()=> {
        const gates=MigrationWave4Service.run().gates;
        if(!gates.consumerSubscriptionBilling || !gates.durableConsumerEntitlements) throw new Error('consumer billing entitlement boundary incomplete');
      }},
      { id:'W4-T07', name:'Provider SaaS restriction preserves active service continuity', fn:()=> {
        const gates=MigrationWave4Service.run().gates;
        if(!gates.providerSaaSBilling || !gates.providerEntitlementRestriction || !gates.activeServiceContinuity) throw new Error('Provider SaaS continuity incomplete');
      }},
      { id:'W4-T08', name:'Payment and billing reconciliation are durable', fn:()=> {
        const gates=MigrationWave4Service.run().gates;
        if(!gates.paymentReconciliation || !gates.billingReconciliation) throw new Error('reconciliation authority incomplete');
      }},
      { id:'W4-T09', name:'RLS and payload-bound idempotency remain mandatory', fn:()=> {
        const gates=MigrationWave4Service.run().gates;
        if(!gates.crossTenantRlsIsolation || !gates.payloadBoundIdempotency) throw new Error('financial isolation incomplete');
      }},
      { id:'W4-T10', name:'Wave 4 requires real PostgreSQL and Redis integration', fn:()=> {
        if(!MigrationWave4Service.run().gates.realPostgresRedisIntegration) throw new Error('real integration missing');
      }},
      { id:'W4-T11', name:'Wave 4 completion does not claim live-provider production readiness', fn:()=> {
        const report=MigrationWave4Service.run();
        if(report.verdict!=='WAVE_4_DURABLE_MONEY_BILLING_COMPLETE' || report.productionReady!==false || !report.gates.liveExternalPaymentProviderStillRequired) throw new Error('production boundary invalid');
      }},
      { id:'W4-T12', name:'Wave 5 remains Tracking Transport Recovery Community', fn:()=> {
        const next=MigrationWave4Service.run().nextWave;
        if(next.wave!==5 || next.domains.join('|')!=='Tracking|Transport|Recovery|Community') throw new Error('next wave drifted');
      }},
    ];
    const results:Result[]=[];
    for(const test of tests){
      const startedAt=Date.now();
      try{test.fn();results.push({id:test.id,name:test.name,passed:true,message:'PASS',durationMs:Date.now()-startedAt});}
      catch(error:any){results.push({id:test.id,name:test.name,passed:false,message:error?.message||String(error),durationMs:Date.now()-startedAt});}
    }
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
