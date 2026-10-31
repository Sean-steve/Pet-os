import React,{useMemo,useState} from 'react';
import {Activity,AlertTriangle,CheckCircle2,CloudCog,DatabaseBackup,Gauge,RefreshCw,ServerCog,ShieldCheck,Zap} from 'lucide-react';
import { ResilienceService } from '../pet-os/resilience/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=><section className={'rounded-[24px] border border-[#E4E9E5] bg-white p-5 shadow-[0_14px_38px_rgba(31,52,42,.045)] '+className}>{children}</section>;
export const Sprint35ResilienceConsole:React.FC=()=>{
  const [refresh,setRefresh]=useState(0);
  const snap=useMemo(()=>ResilienceService.getSnapshot(CANONICAL_IDS.ADMIN_CHARLES),[refresh]);
  const runDrill=()=>{
    const d=ResilienceService.startRecoveryDrill(CANONICAL_IDS.ADMIN_CHARLES,{objectiveId:'RTO-IDENTITY',scenario:'Operator-initiated identity recovery simulation'});
    ResilienceService.completeRecoveryDrill(CANONICAL_IDS.ADMIN_CHARLES,d.drillId,{observedRtoMinutes:18,observedRpoMinutes:3,restoreVerified:true,evidence:'Prototype simulated recovery exercise'});
    setRefresh(v=>v+1);
  };
  return <div className="space-y-5 text-[#1B2A23]">
    <div className="rounded-[28px] bg-[#173F31] p-6 text-white shadow-[0_20px_55px_rgba(23,63,49,.16)] md:p-8">
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em]">Sprint 35</span><span className="rounded-full bg-[#F1D38F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#F1D38F]">Resilience · Performance · Disaster Recovery</span></div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Operational resilience that fails safely.</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#BBD0C5]">Bounded retries, circuit breakers, graceful degradation, recovery objectives, restore drills and enforced bundle budgets protect Pet OS without inventing availability or disaster-recovery claims the prototype cannot prove.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Healthy dependencies',snap.dependencies.filter(d=>d.runtime.health==='HEALTHY').length+'/'+snap.dependencies.length,'Current simulated control-plane state',Activity],
      ['Verified drills',snap.recoveryReadiness.verifiedDrills,'Restore exercises meeting objectives',DatabaseBackup],
      ['Untested objectives',snap.recoveryReadiness.untestedObjectives,'Require future restore evidence',AlertTriangle],
      ['CI performance gates',snap.performanceBudgets.filter(b=>b.enforcement==='CI').length,'Bundle budgets enforced in build',Gauge],
    ].map(([l,v,d,I]:any)=><Card key={l}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{l}</p><p className="mt-3 text-2xl font-semibold">{v}</p><p className="mt-1 text-xs text-[#829087]">{d}</p></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><I className="h-5 w-5"/></span></div></Card>)}</div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Dependencies</p><h3 className="mt-1 text-xl font-semibold">Circuit & degradation policy</h3></div><ServerCog className="h-5 w-5 text-[#64766D]"/></div>
        <div className="mt-4 divide-y divide-[#EEF0EE]">{snap.dependencies.map(({policy,runtime})=><div key={policy.dependencyId} className="py-4"><div className="flex items-start gap-3"><span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl '+(runtime.health==='HEALTHY'?'bg-[#E8F4ED] text-[#2F6B50]':runtime.health==='UNKNOWN'?'bg-[#EEF1F4] text-[#65727C]':'bg-[#FAF1DD] text-[#8F6825]')}>{runtime.health==='HEALTHY'?<CheckCircle2 className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{policy.label}</p><span className="rounded-full bg-[#F2F4F2] px-2 py-0.5 text-[9px] font-bold uppercase">{policy.criticality}</span><span className="rounded-full bg-[#F2F4F2] px-2 py-0.5 font-mono text-[9px]">{runtime.circuitState}</span></div><p className="mt-1 text-xs leading-5 text-[#718078]">{policy.degradationMessage}</p><p className="mt-1 text-[10px] text-[#98A19C]">{policy.maxAttempts} attempts · {policy.timeoutMs}ms timeout · {policy.degradationMode}</p></div></div></div>)}</div>
      </Card>
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Performance</p><h3 className="mt-1 text-xl font-semibold">Budgets, not wishes</h3></div><Zap className="h-5 w-5 text-[#64766D]"/></div>
        <div className="mt-4 space-y-3">{snap.performanceBudgets.map(b=><div key={b.budgetId} className="rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{b.label}</p><p className="mt-1 text-xs leading-5 text-[#7D8982]">{b.notes}</p></div><span className="shrink-0 rounded-full bg-[#EEF2EF] px-2.5 py-1 text-[10px] font-bold">{b.limit} {b.unit}</span></div><p className="mt-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#8A958F]">{b.enforcement} · {b.status}</p></div>)}</div>
      </Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Disaster recovery</p><h3 className="mt-1 text-xl font-semibold">RTO / RPO objectives</h3></div><CloudCog className="h-5 w-5 text-[#64766D]"/></div><div className="mt-4 space-y-3">{snap.recoveryObjectives.map(o=><div key={o.objectiveId} className="rounded-2xl border border-[#E7EBE7] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{o.domain}</p><span className="text-[10px] font-bold text-[#65756D]">{o.tier}</span></div><div className="mt-2 flex gap-2 text-xs"><span className="rounded-lg bg-[#EDF3EF] px-2 py-1">RTO ≤ {o.targetRtoMinutes}m</span><span className="rounded-lg bg-[#EDF3EF] px-2 py-1">RPO ≤ {o.targetRpoMinutes}m</span></div><p className="mt-2 text-xs leading-5 text-[#7D8982]">{o.notes}</p></div>)}</div></Card>
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Recovery drills</p><h3 className="mt-1 text-xl font-semibold">Restore verification</h3></div><button onClick={runDrill} className="flex items-center gap-2 rounded-xl bg-[#173F31] px-3 py-2 text-xs font-bold text-white"><RefreshCw className="h-3.5 w-3.5"/>Run drill</button></div><div className="mt-4 space-y-3">{snap.drills.length?snap.drills.slice(0,6).map(d=><div key={d.drillId} className="rounded-2xl border border-[#E7EBE7] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{d.objectiveId}</p><span className={'rounded-full px-2 py-1 text-[9px] font-bold '+(d.status==='PASSED'?'bg-[#E8F4ED] text-[#2F6B50]':d.status==='FAILED'?'bg-[#FFF0E8] text-[#A25B40]':'bg-[#EEF1F4] text-[#65727C]')}>{d.status}</span></div><p className="mt-1 text-xs leading-5 text-[#7D8982]">{d.scenario}</p>{d.observedRtoMinutes!==undefined&&<p className="mt-2 text-[10px] text-[#8A958F]">Observed RTO {d.observedRtoMinutes}m · RPO {d.observedRpoMinutes}m · restore {d.restoreVerified?'verified':'not verified'}</p>}</div>):<p className="text-sm text-[#7D8982]">No recovery drill evidence yet.</p>}</div></Card>
    </div>

    <Card><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4D745F]"/><div><p className="text-sm font-semibold">Production boundary</p><div className="mt-2 space-y-1">{snap.productionBoundaries.map(x=><p key={x} className="text-xs leading-5 text-[#748179]">• {x}</p>)}</div></div></div></Card>
  </div>;
};
