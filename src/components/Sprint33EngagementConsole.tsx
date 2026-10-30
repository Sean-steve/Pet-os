import React,{useMemo,useState} from 'react';
import {
  Activity,ArrowRight,BarChart3,CheckCircle2,ChevronRight,EyeOff,Gauge,
  Layers3,LineChart,LockKeyhole,ShieldCheck,Sparkles,Users,Workflow
} from 'lucide-react';
import { EngagementService } from '../pet-os/engagement/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { EngagementAudience } from '../pet-os/engagement/types';
import type { TabType } from './Header';

interface Props{onOpenModule:(tab:TabType)=>void;}
const Card=({children,className=''}:{children:React.ReactNode;className?:string})=><section className={'rounded-[24px] border border-[#E4E9E5] bg-white shadow-[0_14px_38px_rgba(31,52,42,.045)] '+className}>{children}</section>;

export const Sprint33EngagementConsole:React.FC<Props>=({onOpenModule})=>{
  const [audience,setAudience]=useState<EngagementAudience>('HOUSEHOLD');
  const [days,setDays]=useState(30);
  const [refresh,setRefresh]=useState(0);
  const context=useMemo(()=>{
    const windowEnd=new Date(),windowStart=new Date(windowEnd.getTime()-days*24*60*60*1000);
    if(audience==='HOUSEHOLD')return {actorUserId:CANONICAL_IDS.OWNER_ELENA,audience,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()};
    if(audience==='PROVIDER')return {actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience,providerId:CANONICAL_IDS.WALKER_SARAH,windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()};
    return {actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience,windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()};
  },[audience,days,refresh]);
  const snap=useMemo(()=>EngagementService.getSnapshot(context),[context]);
  const adoption=snap.metrics.find(m=>/adoption|activation_rate/.test(m.metricId));
  const workflow=snap.metrics.find(m=>/workflow_completion/.test(m.metricId));
  const meaningful=snap.metrics.find(m=>/meaningful_events|activated_households|meaningful_active_households/.test(m.metricId));
  const telemetry=snap.metrics.find(m=>/telemetry_opt_in/.test(m.metricId));
  const enabled=audience==='HOUSEHOLD'?!!(awaitablePreference()):false;

  function awaitablePreference(){
    try{return (window as any).__petos_engagement_pref ?? true;}catch{return true;}
  }
  function toggleTelemetry(){
    const current=awaitablePreference();
    EngagementService.setTelemetryPreference(CANONICAL_IDS.OWNER_ELENA,!current);
    try{(window as any).__petos_engagement_pref=!current;}catch{}
    setRefresh(v=>v+1);
  }

  const metricValue=(m:any)=>{
    if(!m)return '—';
    if(m.unit==='PERCENT')return m.value.toFixed(1)+'%';
    return m.value.toLocaleString();
  };

  return <div className="space-y-5 text-[#1B2A23]">
    <div className="overflow-hidden rounded-[28px] bg-[#173F31] p-6 text-white shadow-[0_20px_55px_rgba(23,63,49,.16)] md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#D4E2DB]">Sprint 33</span>
            <span className="rounded-full bg-[#F1D38F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#F1D38F]">Meaningful adoption · not attention capture</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Engagement & Platform Intelligence</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#BBD0C5]">
            Understand whether Pet OS is helping people complete meaningful pet-care and operating workflows. Time spent, click volume, streaks and compulsion are intentionally excluded from success.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A9C0B4]">Measurement window</p>
          <p className="mt-1 text-lg font-semibold text-white">{days} days</p>
          <p className="text-xs text-[#A9C0B4]">Max 180 days</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {([['HOUSEHOLD','Household',Users],['PROVIDER','Provider',Workflow],['PLATFORM_OPS','Platform Ops',ShieldCheck]] as Array<[EngagementAudience,string,React.ElementType]>).map(([id,label,Icon])=>
            <button key={id} onClick={()=>setAudience(id)} className={'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition '+(audience===id?'bg-white text-[#173F31]':'bg-white/8 text-[#C7D8CF] hover:bg-white/12')}><Icon className="h-4 w-4"/>{label}</button>
          )}
        </div>
        <div className="flex gap-2">{[7,30,90].map(d=><button key={d} onClick={()=>setDays(d)} className={'rounded-xl px-3 py-2 text-xs font-bold '+(days===d?'bg-[#F1D38F] text-[#473A1C]':'bg-white/8 text-[#C7D8CF]')}>{d}d</button>)}</div>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Adoption / activation',metricValue(adoption),'Canonical milestones',Layers3],
        ['Meaningful use',metricValue(meaningful),'Value events or activated households',Sparkles],
        ['Workflow completion',metricValue(workflow),'Started → completed',Workflow],
        ['Telemetry choice',telemetry?metricValue(telemetry):(audience==='HOUSEHOLD'?(enabled?'Enabled':'Disabled'):'—'),'Optional product analytics',EyeOff],
      ].map(([label,value,detail,Icon]:any)=><Card key={label} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-.03em]">{value}</p><p className="mt-1 text-xs text-[#829087]">{detail}</p></div>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><Icon className="h-5 w-5"/></span>
        </div>
      </Card>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Activation funnel</p><h3 className="mt-1 text-xl font-semibold">From setup to meaningful value</h3></div>
          <BarChart3 className="h-5 w-5 text-[#74817A]"/>
        </div>
        <div className="mt-5 space-y-4">
          {snap.funnel.map((step,i)=><div key={step.stepId}>
            <div className="mb-2 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">{i+1}. {step.label}</p><p className="mt-0.5 text-xs text-[#87928C]">{step.definition}</p></div><div className="text-right"><p className="text-sm font-bold">{step.count}</p><p className="text-[10px] text-[#8B9690]">{step.percentOfBase.toFixed(1)}%</p></div></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EDF0ED]"><div className="h-full rounded-full bg-[#4D8066]" style={{width:Math.max(2,step.percentOfBase)+'%'}}/></div>
          </div>)}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Platform health</p><h3 className="mt-1 text-xl font-semibold">Signals worth investigating</h3></div>
        <div className="divide-y divide-[#EEF0EE]">
          {snap.signals.map(s=><div key={s.signalId} className="p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{s.label}</p><p className="mt-1 text-2xl font-semibold">{s.unit==='PERCENT'?s.value.toFixed(1)+'%':s.value.toLocaleString()}</p></div><span className={'rounded-full px-2.5 py-1 text-[9px] font-bold uppercase '+(s.status==='HEALTHY'?'bg-[#E8F4ED] text-[#2F6B50]':s.status==='WATCH'?'bg-[#FAF1DD] text-[#8F6825]':s.status==='ACTION_NEEDED'?'bg-[#FFF0E8] text-[#A25B40]':'bg-[#EEF2F4] text-[#60717B]')}>{s.status.replace('_',' ')}</span></div>
            <p className="mt-3 text-xs leading-5 text-[#7B8981]">{s.explanation}</p>
          </div>)}
        </div>
      </Card>
    </div>

    {!!snap.milestones.length&&<Card className="p-5">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Canonical milestones</p><h3 className="mt-1 text-xl font-semibold">Capability adoption</h3></div><Gauge className="h-5 w-5 text-[#74817A]"/></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snap.milestones.map(m=><div key={m.milestoneId} className="rounded-2xl border border-[#E6EAE6] bg-[#FAFBF9] p-4">
          <div className="flex items-start gap-3"><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-xl '+(m.achieved?'bg-[#E8F4ED] text-[#2F6B50]':'bg-[#EEF1EE] text-[#8B9690]')}>{m.achieved?<CheckCircle2 className="h-4 w-4"/>:<Activity className="h-4 w-4"/>}</span><div><p className="text-sm font-semibold">{m.label}</p><p className="mt-1 text-xs leading-5 text-[#7D8982]">{m.definition}</p><p className="mt-2 font-mono text-[10px] text-[#98A19C]">{m.sourceDomain}</p></div></div>
        </div>)}
      </div>
    </Card>}

    {audience==='HOUSEHOLD'&&<Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 text-[#4A745E]"/><div><p className="text-sm font-semibold">Optional product analytics</p><p className="mt-1 max-w-2xl text-xs leading-5 text-[#7A8780]">You can disable Sprint 33 product telemetry. Pet profiles, care, bookings, tracking, subscriptions and every other core Pet OS feature continue to work because canonical domains—not telemetry—own the product.</p></div></div>
        <button onClick={toggleTelemetry} className="shrink-0 rounded-xl border border-[#DCE4DE] bg-[#F7FAF8] px-4 py-2 text-xs font-bold text-[#496653]">{enabled?'Disable telemetry':'Enable telemetry'}</button>
      </div>
    </Card>}

    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#42745A]"/><div><p className="text-sm font-semibold">Engagement safety contract</p><div className="mt-3 space-y-2">{snap.guardrails.map(g=><p key={g} className="text-xs leading-5 text-[#718078]">• {g}</p>)}</div></div></div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Provenance</p><h3 className="mt-1 text-xl font-semibold">What powers this view</h3></div><LineChart className="h-5 w-5 text-[#74817A]"/></div>
        <div className="mt-4 flex flex-wrap gap-2">{snap.provenance.map(p=><span key={p} className="rounded-xl border border-[#E3E8E4] bg-[#F8FAF8] px-3 py-2 font-mono text-[11px] text-[#5F6F66]">{p}</span>)}</div>
        <button onClick={()=>onOpenModule('sprint32')} className="mt-5 flex items-center gap-2 rounded-xl bg-[#173F31] px-4 py-2 text-xs font-bold text-white">Open Analytics & Outcomes <ChevronRight className="h-4 w-4"/></button>
      </Card>
    </div>
  </div>;
};
