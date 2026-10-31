import React,{useMemo} from 'react';
import {BadgeCheck,CheckCircle2,ChevronRight,Network,ShieldCheck,Users,Workflow,XCircle} from 'lucide-react';
import { FullSystemCertificationService } from '../pet-os/certification/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=><section className={'rounded-[24px] border border-[#E4E9E5] bg-white p-5 shadow-[0_14px_38px_rgba(31,52,42,.045)] '+className}>{children}</section>;

export const Sprint36CertificationConsole:React.FC=()=>{
  const report=useMemo(()=>FullSystemCertificationService.run(CANONICAL_IDS.ADMIN_CHARLES),[]);
  return <div className="space-y-5 text-[#1B2A23]">
    <div className="rounded-[28px] bg-[#142F42] p-6 text-white shadow-[0_20px_55px_rgba(20,47,66,.16)] md:p-8">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em]">Sprint 36</span><span className="rounded-full bg-[#9FD3F1]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#BFE6FB]">Full-System E2E Certification</span></div>
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-semibold tracking-[-.04em]">One release verdict across every side of Pet OS.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#B8CFDC]">Cross-role journeys verify that canonical identities, bookings, professional execution, finance, rescue, commerce, intelligence, trust and engineering controls connect without bypassing tenant or authority boundaries.</p></div><div className="rounded-2xl bg-white/10 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9FC1D3]">Verdict</p><p className="mt-1 flex items-center gap-2 text-lg font-semibold text-[#CBEED9]"><BadgeCheck className="h-5 w-5"/>{report.verdict.replace('_',' ')}</p></div></div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Role surfaces',report.roleCoverage.length+'/9','Every unified workspace',Users],
      ['Journeys passed',report.passed+'/'+report.journeys.length,'Cross-domain certification',Workflow],
      ['Release gates',Object.values(report.releaseGates).filter(Boolean).length+'/'+Object.keys(report.releaseGates).length,'Critical gates satisfied',ShieldCheck],
      ['Failures',report.failed,'Must remain zero',XCircle],
    ].map(([l,v,d,I]:any)=><Card key={l}><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{l}</p><p className="mt-3 text-2xl font-semibold">{v}</p><p className="mt-1 text-xs text-[#829087]">{d}</p></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3F6] text-[#426579]"><I className="h-5 w-5"/></span></div></Card>)}</div>

    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <Card><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Cross-role matrix</p><h3 className="mt-1 text-xl font-semibold">9 product sides certified</h3></div><Network className="h-5 w-5 text-[#64766D]"/></div><div className="mt-4 space-y-2">{report.roleCoverage.map(r=><div key={r.roleId} className="rounded-2xl border border-[#E8EBE8] p-3"><div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#2F6B50]"/><div className="min-w-0"><p className="text-sm font-semibold">{r.label}</p><p className="truncate text-[10px] text-[#8A958F]">{r.requiredDomains.join(' · ')}</p></div></div></div>)}</div></Card>
      <Card><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Certification journeys</p><h3 className="mt-1 text-xl font-semibold">Cross-domain release proof</h3></div><div className="mt-4 divide-y divide-[#EEF0EE]">{report.journeys.map(j=><div key={j.journeyId} className="py-4"><div className="flex gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E8F4ED] text-[#2F6B50]">{j.status==='PASS'?<CheckCircle2 className="h-4 w-4"/>:<XCircle className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{j.journeyId} · {j.title}</p><span className="rounded-full bg-[#F1F4F2] px-2 py-0.5 text-[9px] font-bold">{j.status}</span></div><p className="mt-1 text-[10px] uppercase tracking-[.08em] text-[#99A29D]">{j.roles.join(' → ')}</p><div className="mt-2 space-y-1">{j.evidence.slice(0,3).map(e=><p key={e} className="flex items-start gap-1.5 text-xs text-[#738078]"><ChevronRight className="mt-0.5 h-3 w-3 shrink-0"/>{e}</p>)}</div>{j.failure&&<p className="mt-2 text-xs font-medium text-[#A25242]">{j.failure}</p>}</div></div></div>)}</div></Card>
    </div>

    <Card><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4D745F]"/><div><p className="text-sm font-semibold">Certification boundary</p>{report.productionBoundaries.map(x=><p key={x} className="mt-1 text-xs leading-5 text-[#748179]">• {x}</p>)}</div></div></Card>
  </div>;
};
