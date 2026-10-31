import { MigrationWave3Service } from './service';

interface Result { id:string; name:string; passed:boolean; message:string; durationMs:number; }

export class MigrationWave3TestSuite {
  static async runAllTests() {
    const tests:Array<{id:string;name:string;fn:()=>void}> = [
      { id:'W3-T01', name:'All four professional lifecycle domains are durable', fn:()=> {
        const report=MigrationWave3Service.run();
        if(report.domains.length!==4 || report.domains.some((domain)=>domain.status!=='DURABLE_BACKEND')) throw new Error('domain authority incomplete');
      }},
      { id:'W3-T02', name:'Provider verification cannot be self-asserted', fn:()=> {
        if(!MigrationWave3Service.run().gates.providerVerificationBoundary) throw new Error('provider verification boundary missing');
      }},
      { id:'W3-T03', name:'Booking authority is conflict-safe and versioned', fn:()=> {
        const gates=MigrationWave3Service.run().gates;
        if(!gates.raceSafeBookingAuthority || !gates.bookingVersionHistory) throw new Error('booking safety incomplete');
      }},
      { id:'W3-T04', name:'Professional Care must originate from Booking', fn:()=> {
        if(!MigrationWave3Service.run().gates.bookingDerivedProfessionalCare) throw new Error('care booking linkage missing');
      }},
      { id:'W3-T05', name:'Owners read care but providers own execution writes', fn:()=> {
        if(!MigrationWave3Service.run().gates.ownerReadProviderWriteSeparation) throw new Error('care write authority missing');
      }},
      { id:'W3-T06', name:'Ordinary care records cannot contain home access secrets', fn:()=> {
        if(!MigrationWave3Service.run().gates.careSecretExclusion) throw new Error('secret exclusion boundary missing');
      }},
      { id:'W3-T07', name:'Review eligibility requires completed booking', fn:()=> {
        if(!MigrationWave3Service.run().gates.completedBookingReviewEligibility) throw new Error('review eligibility linkage missing');
      }},
      { id:'W3-T08', name:'Verified customer review cannot be rewritten by provider', fn:()=> {
        const gates=MigrationWave3Service.run().gates;
        if(!gates.verifiedServiceReviewIntegrity || !gates.providerCannotMutateCustomerReview) throw new Error('review integrity missing');
      }},
      { id:'W3-T09', name:'Cross-party RLS and transactional outbox are required', fn:()=> {
        const gates=MigrationWave3Service.run().gates;
        if(!gates.crossPartyRlsIsolation || !gates.transactionalLifecycleOutbox) throw new Error('cross-party safety incomplete');
      }},
      { id:'W3-T10', name:'Wave 3 requires real PostgreSQL and Redis integration', fn:()=> {
        if(!MigrationWave3Service.run().gates.realPostgresRedisIntegration) throw new Error('real integration missing');
      }},
      { id:'W3-T11', name:'Wave 3 completion does not claim production readiness', fn:()=> {
        const report=MigrationWave3Service.run();
        if(report.verdict!=='WAVE_3_DURABLE_SERVICE_LIFECYCLE_COMPLETE' || report.productionReady!==false) throw new Error('Wave 3 verdict invalid');
      }},
      { id:'W3-T12', name:'Wave 4 remains Finance Subscriptions Provider SaaS', fn:()=> {
        const next=MigrationWave3Service.run().nextWave;
        if(next.wave!==4 || next.domains.join('|')!=='Finance|Subscriptions|Provider SaaS') throw new Error('next wave drifted');
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
