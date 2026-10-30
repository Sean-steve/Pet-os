import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  CheckCircle2, Clock3, Database, Gauge, Info, LineChart, ShieldCheck, Sparkles,
  Stethoscope, Users, WalletCards
} from 'lucide-react';
import { AnalyticsService } from '../pet-os/analytics/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { AnalyticsAudience, AnalyticsMetric, IntelligenceStatus } from '../pet-os/analytics/types';
import type { TabType } from './Header';

interface Props { onOpenModule:(tab:TabType)=>void; }

const statusClass:Record<IntelligenceStatus,string>={
  HEALTHY:'bg-[#E8F4ED] text-[#2F6B50]',
  WATCH:'bg-[#FAF1DD] text-[#8F6825]',
  ACTION_NEEDED:'bg-[#FFF0E8] text-[#A25B40]',
  CRITICAL:'bg-[#FDEDEA] text-[#A94943]',
  INFORMATIONAL:'bg-[#EEF2F4] text-[#60717B]',
};

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=>(
  <section className={'rounded-[24px] border border-[#E4E9E5] bg-white shadow-[0_14px_38px_rgba(31,52,42,.045)] '+className}>{children}</section>
);

function metricValue(m:AnalyticsMetric){
  if(m.unit==='PERCENT')return m.value.toFixed(1)+'%';
  if(m.unit==='MINUTES')return m.value.toLocaleString()+' min';
  if(m.unit==='RATING')return m.value?m.value.toFixed(2)+'/5':'—';
  if(m.unit==='MINOR_UNITS')return 'KES '+(m.value/100).toLocaleString(undefined,{maximumFractionDigits:2});
  return m.value.toLocaleString();
}

const Direction=({m}:{m:AnalyticsMetric})=>{
  if(m.direction==='UP')return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#397157]"><ArrowUpRight className="h-3.5 w-3.5"/>vs prior</span>;
  if(m.direction==='DOWN')return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A36A46]"><ArrowDownRight className="h-3.5 w-3.5"/>vs prior</span>;
  if(m.direction==='FLAT')return <span className="text-[11px] font-semibold text-[#7D8982]">Flat vs prior</span>;
  return <span className="text-[11px] text-[#9AA39E]">Point-in-time / no prior comparison</span>;
};

export const Sprint32AnalyticsConsole:React.FC<Props>=({onOpenModule})=>{
  const [audience,setAudience]=useState<AnalyticsAudience>('HOUSEHOLD');
  const [days,setDays]=useState(30);
  const [selectedMetric,setSelectedMetric]=useState<string | null>(null);
  const windowEnd=new Date();
  const windowStart=new Date(windowEnd.getTime()-days*24*60*60*1000);

  const context=useMemo(()=>{
    if(audience==='HOUSEHOLD')return {
      actorUserId:CANONICAL_IDS.OWNER_ELENA,audience,
      householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,timezone:'Africa/Nairobi',
      windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()
    };
    if(audience==='PROVIDER')return {
      actorUserId:CANONICAL_IDS.WALKER_SARAH_USER,audience,
      providerId:CANONICAL_IDS.WALKER_SARAH,timezone:'Africa/Nairobi',
      windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()
    };
    return {
      actorUserId:CANONICAL_IDS.ADMIN_CHARLES,audience,timezone:'Africa/Nairobi',
      windowStart:windowStart.toISOString(),windowEnd:windowEnd.toISOString()
    };
  },[audience,days]);

  const snapshot=useMemo(()=>AnalyticsService.getSnapshot(context),[context]);
  const activeMetric=selectedMetric&&snapshot.metrics.some(m=>m.metricId===selectedMetric)?selectedMetric:snapshot.metrics[0]?.metricId;
  const series=useMemo(()=>activeMetric?AnalyticsService.metricSeries(context,activeMetric,6):null,[context,activeMetric]);
  const maxPoint=Math.max(1,...(series?.points.map(p=>p.value)||[1]));

  const drill=(tab:string)=>onOpenModule(tab as TabType);

  return <div className="space-y-5 text-[#1B2A23]">
    <div className="overflow-hidden rounded-[28px] bg-[#173F31] p-6 text-white shadow-[0_20px_55px_rgba(23,63,49,.16)] md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#D4E2DB]">Sprint 32</span>
            <span className="rounded-full bg-[#F1D38F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#F1D38F]">Derived intelligence · canonical truth preserved</span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Analytics, Outcomes & Operations Intelligence</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#BBD0C5]">
            Read-only intelligence built from Pet OS source domains. Every metric carries its formula and provenance; outcome signals describe operations and behavior without claiming diagnosis or causality.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A9C0B4]">Analysis window</p>
          <p className="mt-1 text-lg font-semibold text-white">{days} days</p>
          <p className="text-xs text-[#A9C0B4]">{snapshot.timezone}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {([
            ['HOUSEHOLD','Household',Users],
            ['PROVIDER','Provider',Stethoscope],
            ['PLATFORM_OPS','Platform Ops',ShieldCheck],
          ] as Array<[AnalyticsAudience,string,React.ElementType]>).map(([id,label,Icon])=>
            <button key={id} onClick={()=>{setAudience(id);setSelectedMetric(null);}} className={'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition '+(audience===id?'bg-white text-[#173F31]':'bg-white/8 text-[#C7D8CF] hover:bg-white/12')}>
              <Icon className="h-4 w-4"/>{label}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {[7,30,90].map(d=><button key={d} onClick={()=>setDays(d)} className={'rounded-xl px-3 py-2 text-xs font-bold '+(days===d?'bg-[#F1D38F] text-[#473A1C]':'bg-white/8 text-[#C7D8CF]')}>{d}d</button>)}
        </div>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {snapshot.metrics.slice(0,4).map((m)=><Card key={m.metricId} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{m.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-.03em]">{metricValue(m)}</p>
            <div className="mt-2"><Direction m={m}/></div>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><Gauge className="h-5 w-5"/></span>
        </div>
      </Card>)}
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Metric trend</p>
            <h3 className="mt-1 text-xl font-semibold">{series?.label||'Metric series'}</h3>
          </div>
          <select value={activeMetric||''} onChange={e=>setSelectedMetric(e.target.value)} className="rounded-xl border border-[#E0E6E1] bg-[#FAFBF9] px-3 py-2 text-xs font-semibold text-[#536158] outline-none">
            {snapshot.metrics.filter(m=>m.unit!=='MINOR_UNITS').map(m=><option key={m.metricId} value={m.metricId}>{m.label}</option>)}
          </select>
        </div>
        <div className="mt-6 flex h-52 items-end gap-3 rounded-2xl bg-[#F7F9F7] p-4">
          {series?.points.map((p,i)=><div key={p.periodStart} className="flex h-full flex-1 flex-col justify-end gap-2">
            <div className="flex min-h-0 flex-1 items-end">
              <div className="w-full rounded-t-xl bg-[#4D8066]" style={{height:Math.max(5,(p.value/maxPoint)*100)+'%'}} title={String(p.value)}/>
            </div>
            <p className="truncate text-center text-[9px] font-semibold text-[#8A958F]">{i+1}</p>
          </div>)}
        </div>
        <div className="mt-4 rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4">
          {snapshot.metrics.filter(m=>m.metricId===activeMetric).map(m=><div key={m.metricId}>
            <div className="flex items-start gap-3"><Database className="mt-0.5 h-4 w-4 shrink-0 text-[#5E7E6C]"/><div><p className="text-xs font-bold text-[#536158]">Formula & source</p><p className="mt-1 text-xs leading-5 text-[#7F8B84]">{m.definition}</p><p className="mt-2 font-mono text-[10px] text-[#8A958F]">{m.source} · {m.metricId}</p></div></div>
          </div>)}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Outcome indicators</p>
          <h3 className="mt-1 text-xl font-semibold">Descriptive outcomes</h3>
        </div>
        <div className="divide-y divide-[#EEF0EE]">
          {snapshot.outcomes.map(o=><div key={o.outcomeId} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold">{o.title}</p><p className="mt-1 text-2xl font-semibold">{o.unit==='PERCENT'?o.value.toFixed(1)+'%':o.unit==='RATING'?(o.value?o.value.toFixed(2)+'/5':'—'):o.value.toLocaleString()}</p></div>
              <span className={'rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] '+statusClass[o.status]}>{o.status.replace('_',' ')}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#718078]">{o.interpretation}</p>
            <div className="mt-3 flex gap-2 rounded-xl bg-[#FFF9F0] p-3 text-[11px] leading-5 text-[#765F46]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{o.caveat}</div>
          </div>)}
        </div>
      </Card>
    </div>

    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#EBEEEB] p-5">
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Operations intelligence</p><h3 className="mt-1 text-xl font-semibold">Signals that need attention</h3></div>
        <Activity className="h-5 w-5 text-[#79857E]"/>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4">
        {snapshot.operations.map(s=><button key={s.signalId} onClick={()=>drill(s.drilldownTab)} className="border-b border-r border-[#EEF0EE] p-5 text-left transition hover:bg-[#F8FAF8]">
          <div className="flex items-start justify-between gap-2">
            <span className={'grid h-9 w-9 place-items-center rounded-xl '+statusClass[s.status]}>{s.status==='HEALTHY'?<CheckCircle2 className="h-4 w-4"/>:s.status==='INFORMATIONAL'?<Info className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>}</span>
            <ArrowRight className="h-4 w-4 text-[#A8B0AB]"/>
          </div>
          <p className="mt-4 text-sm font-semibold">{s.title}</p>
          <p className="mt-1 text-xl font-semibold">{s.unit==='PERCENT'?s.value.toFixed(1)+'%':s.value.toLocaleString()}</p>
          <p className="mt-2 text-xs leading-5 text-[#7E8A83]">{s.explanation}</p>
          {s.threshold&&<p className="mt-2 text-[10px] font-semibold uppercase tracking-[.08em] text-[#9AA39E]">{s.threshold}</p>}
        </button>)}
      </div>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#42745A]"/><div><p className="text-sm font-semibold">Analytics safety contract</p><div className="mt-3 space-y-2">{snapshot.disclaimers.map(d=><p key={d} className="text-xs leading-5 text-[#718078]">• {d}</p>)}</div></div></div>
      </Card>
      <Card className="p-5">
        <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Provenance</p><h3 className="mt-1 text-xl font-semibold">Canonical sources</h3></div><LineChart className="h-5 w-5 text-[#718078]"/></div>
        <div className="mt-4 flex flex-wrap gap-2">{snapshot.provenance.map(p=><span key={p} className="rounded-xl border border-[#E3E8E4] bg-[#F8FAF8] px-3 py-2 font-mono text-[11px] text-[#5F6F66]">{p}</span>)}</div>
        <p className="mt-4 text-xs leading-5 text-[#829088]">Generated {new Date(snapshot.generatedAt).toLocaleString()}. Analytics caches or charts may be rebuilt at any time because source domains remain authoritative.</p>
      </Card>
    </div>
  </div>;
};
