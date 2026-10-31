import { MigrationWave5Service } from './service';
interface Result { id:string; name:string; passed:boolean; message:string; durationMs:number; }

export class MigrationWave5TestSuite {
  static async runAllTests() {
    const tests:Array<{id:string;name:string;fn:()=>void}> = [
      {id:'W5-T01',name:'Tracking Transport Recovery Community are durable',fn:()=>{const r=MigrationWave5Service.run();if(r.domains.length!==4||r.domains.some(d=>d.status!=='DURABLE_BACKEND'))throw new Error('Wave 5 domain authority incomplete');}},
      {id:'W5-T02',name:'Telemetry is trusted deduplicated and monotonic',fn:()=>{const g=MigrationWave5Service.run().gates;if(!g.trustedLocationAdapter||!g.telemetryDeduplication||!g.monotonicLiveLocation)throw new Error('telemetry authority incomplete');}},
      {id:'W5-T03',name:'Exact location remains private durable authority',fn:()=>{if(!MigrationWave5Service.run().gates.exactLocationPrivateAuthority)throw new Error('exact-location boundary missing');}},
      {id:'W5-T04',name:'Geofence transitions are derived from Tracking observations',fn:()=>{if(!MigrationWave5Service.run().gates.geofenceTransitionAuthority)throw new Error('geofence authority missing');}},
      {id:'W5-T05',name:'Transport derives from Booking with encrypted address boundary',fn:()=>{const g=MigrationWave5Service.run().gates;if(!g.transportBookingAuthority||!g.encryptedTransportAddressBoundary)throw new Error('Transport authority incomplete');}},
      {id:'W5-T06',name:'Transport custody is immutable and completion-safe',fn:()=>{const g=MigrationWave5Service.run().gates;if(!g.immutableCustodyChain||!g.transportCompletionSafety)throw new Error('custody safety incomplete');}},
      {id:'W5-T07',name:'Recovery references Tracking and minimizes public location',fn:()=>{const g=MigrationWave5Service.run().gates;if(!g.recoveryTrackingReference||!g.coarsePublicRecoveryProjection||!g.privateSightingAuthority)throw new Error('Recovery privacy incomplete');}},
      {id:'W5-T08',name:'Community is coarse-location only',fn:()=>{if(!MigrationWave5Service.run().gates.communityCoarseLocationOnly)throw new Error('Community location boundary missing');}},
      {id:'W5-T09',name:'Recovery and Community remain continuous',fn:()=>{if(!MigrationWave5Service.run().gates.recoveryCommunityContinuity)throw new Error('Recovery Community continuity missing');}},
      {id:'W5-T10',name:'RLS and idempotency remain mandatory',fn:()=>{const g=MigrationWave5Service.run().gates;if(!g.crossTenantRlsIsolation||!g.payloadBoundIdempotency)throw new Error('isolation/idempotency missing');}},
      {id:'W5-T11',name:'Wave 5 requires real PostgreSQL Redis integration',fn:()=>{if(!MigrationWave5Service.run().gates.realPostgresRedisIntegration)throw new Error('real integration missing');}},
      {id:'W5-T12',name:'Wave 5 does not claim live device-provider production readiness',fn:()=>{const r=MigrationWave5Service.run();if(r.productionReady!==false||!r.gates.liveDeviceProviderStillRequired)throw new Error('production boundary invalid');}},
      {id:'W5-T13',name:'Wave 6 remains commercial integration intelligence backend',fn:()=>{const n=MigrationWave5Service.run().nextWave;if(n.wave!==6||n.domains.join('|')!=='Commerce|Integrations|AI|Automation|Analytics')throw new Error('next wave drifted');}},
    ];
    const results:Result[]=[];
    for(const t of tests){const s=Date.now();try{t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-s});}catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-s});}}
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
