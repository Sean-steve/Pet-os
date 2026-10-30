import React,{useMemo,useState} from 'react';
import {AlertTriangle,Archive,CheckCircle2,FileCheck2,KeyRound,LockKeyhole,ShieldCheck,UserRoundCheck} from 'lucide-react';
import { SecurityService } from '../pet-os/security/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';

const Card=({children}:{children:React.ReactNode})=><section className="rounded-[24px] border border-[#E4E9E5] bg-white p-5 shadow-[0_14px_38px_rgba(31,52,42,.045)]">{children}</section>;
export const Sprint34SecurityConsole:React.FC=()=>{
  const [refresh,setRefresh]=useState(0);
  const posture=useMemo(()=>SecurityService.getPlatformPosture(CANONICAL_IDS.ADMIN_CHARLES),[refresh]);
  const createRequest=()=>{SecurityService.createPrivacyRequest({requesterUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,type:'EXPORT',note:'User-requested portable Pet OS data export'});setRefresh(v=>v+1);};
  const openIncident=()=>{SecurityService.openIncident(CANONICAL_IDS.ADMIN_CHARLES,{title:'Security response drill',severity:'MEDIUM',affectedDataClasses:['Account/Profile'],notificationAssessmentRequired:true});setRefresh(v=>v+1);};
  return <div className="space-y-5 text-[#1B2A23]">
    <div className="rounded-[28px] bg-[#173F31] p-6 text-white md:p-8">
      <div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em]">Sprint 34</span><span className="rounded-full bg-[#F1D38F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#F1D38F]">Security · Privacy · Compliance</span></div>
      <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Security, Privacy & Compliance Hardening</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#BBD0C5]">A cross-platform control plane for identity hardening, sensitive-action step-up, privacy rights, retention, incident response and auditable compliance evidence—without pretending a browser prototype is infrastructure-certified.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Enforced controls',posture.enforced,'Application controls live',ShieldCheck],
      ['Monitored',posture.monitored,'Needs production enforcement',FileCheck2],
      ['Planned',posture.planned,'Infrastructure boundary',Archive],
      ['Open privacy requests',posture.privacyRequests.filter(r=>r.status==='OPEN').length,'Tracked DSAR workflow',UserRoundCheck],
    ].map(([l,v,d,I]:any)=><Card key={l}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{l}</p><p className="mt-3 text-2xl font-semibold">{v}</p><p className="mt-1 text-xs text-[#829087]">{d}</p></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><I className="h-5 w-5"/></span></div></Card>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Control catalog</p><h3 className="mt-1 text-xl font-semibold">Defense in depth</h3></div><LockKeyhole className="h-5 w-5 text-[#5D7468]"/></div>
        <div className="mt-4 divide-y divide-[#EEF0EE]">{posture.controls.map(c=><div key={c.controlId} className="py-4"><div className="flex items-start gap-3"><span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl '+(c.status==='ENFORCED'?'bg-[#E8F4ED] text-[#2F6B50]':c.status==='MONITORED'?'bg-[#FAF1DD] text-[#8F6825]':'bg-[#EEF1F4] text-[#65727C]')}>{c.status==='ENFORCED'?<CheckCircle2 className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{c.label}</p><span className="rounded-full bg-[#F2F4F2] px-2 py-0.5 font-mono text-[9px]">{c.controlId}</span></div><p className="mt-1 text-xs leading-5 text-[#718078]">{c.implementation}</p>{c.productionBoundary&&<p className="mt-1 text-[11px] leading-5 text-[#9A6D2E]">{c.productionBoundary}</p>}</div></div></div>)}</div>
      </Card>
      <div className="space-y-5">
        <Card><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Sensitive actions</p><h3 className="mt-1 text-xl font-semibold">Step-up authentication</h3><div className="mt-4 space-y-2">{['Account deletion','Payout destination changes','Restricted health access','Exact-location export','Developer-app approval'].map(x=><div key={x} className="flex items-center gap-2 text-xs text-[#65756D]"><KeyRound className="h-3.5 w-3.5 text-[#5B7667]"/>{x}</div>)}</div><p className="mt-4 text-xs leading-5 text-[#7B8981]">Recent reauthentication is required for sensitive operations; the highest-risk classes also require MFA.</p></Card>
        <Card><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Exercise workflows</p><div className="mt-3 flex flex-col gap-2"><button onClick={createRequest} className="rounded-xl bg-[#173F31] px-4 py-2 text-xs font-bold text-white">Create privacy export request</button><button onClick={openIncident} className="rounded-xl border border-[#DCE4DE] bg-[#F7FAF8] px-4 py-2 text-xs font-bold text-[#496653]">Open incident-response drill</button></div></Card>
      </div>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Retention registry</p><h3 className="mt-1 text-xl font-semibold">Purpose-limited data lifecycle</h3><div className="mt-4 space-y-3">{posture.retention.map(r=><div key={r.dataClass} className="rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{r.dataClass}</p><span className="text-xs font-bold text-[#607168]">{r.retentionDays===null?'Policy/legal':'≤ '+r.retentionDays+'d'}</span></div><p className="mt-1 text-xs leading-5 text-[#7D8982]">{r.notes}</p></div>)}</div></Card>
      <Card><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Compliance evidence</p><h3 className="mt-1 text-xl font-semibold">Ready vs. production-dependent</h3><div className="mt-4 space-y-3">{posture.complianceEvidence.map(e=><div key={e.evidenceId} className="flex gap-3 rounded-2xl border border-[#E7EBE7] p-4"><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-xl '+(e.status==='READY'?'bg-[#E8F4ED] text-[#2F6B50]':'bg-[#FAF1DD] text-[#8F6825]')}><FileCheck2 className="h-4 w-4"/></span><div><p className="text-sm font-semibold">{e.title}</p><p className="mt-1 text-xs text-[#7D8982]">{e.controlFamily} · {e.source}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#8A958F]">{e.status}</p></div></div>)}</div></Card>
    </div>
    <Card><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#9A6D2E]"/><div><p className="text-sm font-semibold">Certification boundary</p><div className="mt-2 space-y-1">{posture.productionDisclaimers.map(x=><p key={x} className="text-xs leading-5 text-[#748179]">• {x}</p>)}</div></div></div></Card>
  </div>;
};
