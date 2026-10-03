import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  FileText,
  HeartPulse,
  LockKeyhole,
  MessageSquareText,
  PawPrint,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TestTube2,
  TriangleAlert,
} from 'lucide-react';
import { AIStore } from '../pet-os/ai/store';
import { AIPlatformService, AIEvaluationService, AIRecommendationService } from '../pet-os/ai/service';
import { seedAIData, AI_SEED_IDS } from '../pet-os/ai/seed';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { AIResponse, AIRecommendation, AIEvaluationRun } from '../pet-os/ai/types';

type View = 'overview' | 'assistant' | 'recommendations' | 'safety' | 'models' | 'evaluations';

const nav: Array<{id:View;label:string;icon:React.ElementType}> = [
  {id:'overview',label:'Overview',icon:BrainCircuit},
  {id:'assistant',label:'Pet Assistant',icon:MessageSquareText},
  {id:'recommendations',label:'Recommendations',icon:Sparkles},
  {id:'safety',label:'Safety & consent',icon:ShieldCheck},
  {id:'models',label:'Models & prompts',icon:Database},
  {id:'evaluations',label:'Evaluations',icon:TestTube2},
];

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=>(
  <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/10 ${className}`}>{children}</section>
);

const Badge=({children,tone='slate'}:{children:React.ReactNode;tone?:'green'|'amber'|'red'|'violet'|'blue'|'slate'})=>{
  const t={
    green:'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    amber:'border-amber-500/20 bg-amber-500/10 text-amber-300',
    red:'border-red-500/20 bg-red-500/10 text-red-300',
    violet:'border-violet-500/20 bg-violet-500/10 text-violet-300',
    blue:'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    slate:'border-slate-700 bg-slate-800 text-slate-300',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${t[tone]}`}>{children}</span>;
};

export const Sprint28AIConsole:React.FC=()=>{
  const [view,setView]=useState<View>('overview');
  const [question,setQuestion]=useState('Summarize Kibo and tell me what matters today.');
  const [response,setResponse]=useState<AIResponse|null>(null);
  const [asking,setAsking]=useState(false);
  const [recommendations,setRecommendations]=useState<AIRecommendation[]>([]);
  const [evalRun,setEvalRun]=useState<AIEvaluationRun|null>(null);
  const [evalRunning,setEvalRunning]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const store=AIStore.getInstance();

  useEffect(()=>{ seedAIData(); },[]);

  const models=store.listModelDefinitions();
  const deployments=store.listModelDeployments();
  const prompts=store.listPromptTemplates();
  const consents=store.listConsents();
  const incidents=store.listIncidents();

  const stats=useMemo(()=>[
    {label:'Approved deployments',value:String(deployments.filter(d=>d.status==='ACTIVE'||d.status==='APPROVED').length),detail:'Policy-routed only',icon:Bot},
    {label:'Prompt versions',value:String(prompts.length),detail:'Versioned & governed',icon:FileText},
    {label:'Safety incidents',value:String(incidents.filter(i=>!['RESOLVED','CLOSED'].includes(i.status)).length),detail:'Open / active',icon:TriangleAlert},
    {label:'Consent profiles',value:String(consents.length),detail:'Scoped, not one boolean',icon:LockKeyhole},
  ],[deployments.length,prompts.length,consents.length,incidents.length]);

  const ask=async()=>{
    setAsking(true);setError(null);
    try{
      const useCase = /health|medication|vaccin|allergy|vet/i.test(question) ? 'HEALTH_SUMMARY'
        : /tracker|gps|location/i.test(question) ? 'TRACKER_TROUBLESHOOTING'
        : /food|diet|nutrition|meal/i.test(question) ? 'NUTRITION_INFORMATION'
        : /train|recall|leash/i.test(question) ? 'TRAINING_GUIDANCE'
        : /summar/i.test(question) ? 'PET_SUMMARY'
        : 'PET_ASSISTANT';
      const res=await AIPlatformService.ask({
        userId:CANONICAL_IDS.OWNER_ELENA,
        householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,
        petId:CANONICAL_IDS.PET_KIBO,
        useCase,
        text:question,
      });
      setResponse(res);
    }catch(e:any){setError(e?.message||String(e));}
    finally{setAsking(false);}
  };

  const generateRecs=()=>{
    setError(null);
    try{
      const recs=AIRecommendationService.generateForPet(CANONICAL_IDS.OWNER_ELENA,CANONICAL_IDS.MAIN_HOUSEHOLD,CANONICAL_IDS.PET_KIBO);
      setRecommendations(recs);
    }catch(e:any){setError(e?.message||String(e));}
  };

  const runEvals=async()=>{
    setEvalRunning(true);setError(null);
    try{setEvalRun(await AIEvaluationService.run(AI_SEED_IDS.SAFETY_DEPLOYMENT));}
    catch(e:any){setError(e?.message||String(e));}
    finally{setEvalRunning(false);}
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-950/60 via-slate-950 to-emerald-950/40 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet">Sprint 28</Badge>
              <Badge tone="green">Governed AI</Badge>
              <Badge>Canonical data stays authoritative</Badge>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Pet Intelligence & AI Platform</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Authorization-aware Pet context, provenance, safe model routing, recommendations, clinical boundaries, consent,
              prompt-injection defenses, model kill-switches and reproducible evaluation gates.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><PawPrint className="h-5 w-5"/></div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Demo pet context</p>
                <p className="text-sm font-semibold text-white">Kibo · authorized household</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
        {nav.map(item=>{
          const Icon=item.icon;const active=view===item.id;
          return <button key={item.id} onClick={()=>setView(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${active?'bg-violet-500 text-white shadow-lg shadow-violet-500/20':'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}><Icon className="h-4 w-4"/>{item.label}</button>;
        })}
      </nav>

      {error && <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error}</span></div>}

      {view==='overview' && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(s=>{const Icon=s.icon;return <Card key={s.label} className="p-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{s.label}</p><p className="mt-3 text-2xl font-bold text-white">{s.value}</p><p className="mt-1 text-xs text-slate-500">{s.detail}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Icon className="h-5 w-5"/></span></div></Card>})}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Execution pipeline</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Every answer passes the same governed path</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['1','Authorize','Household + Pet boundary before retrieval'],
                ['2','Consent','Scoped Pet / Health / Location consent'],
                ['3','Classify','Risk and emergency classification'],
                ['4','Assemble','Minimized canonical context + provenance'],
                ['5','Route','Approved model for risk + sensitivity'],
                ['6','Validate','Output safety, grounding and conflict checks'],
              ].map(([n,t,d])=><div key={n} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-xs font-bold text-violet-300">{n}</span><div><p className="text-sm font-semibold text-slate-200">{t}</p><p className="mt-1 text-xs leading-5 text-slate-500">{d}</p></div></div>)}
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Hard boundaries</p>
            <h2 className="mt-1 text-xl font-semibold text-white">AI is assistive, never authoritative</h2>
            <div className="mt-5 space-y-3">
              {['No autonomous veterinary diagnosis or prescribing','No medication dose or schedule changes','No silent writes into Pet, Health, Nutrition or Tracking','No cross-household or unconsented context retrieval','No external provider fallback outside approved sensitivity policy','Core Pet OS keeps working when AI is unavailable'].map(x=><div key={x} className="flex items-start gap-3 text-sm text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/><span>{x}</span></div>)}
            </div>
          </Card>
        </div>
      </>}

      {view==='assistant' && <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><MessageSquareText className="h-5 w-5"/></span><div><h2 className="text-lg font-semibold text-white">Ask about Kibo</h2><p className="text-xs text-slate-500">Grounded demo provider · no external API keys exposed</p></div></div>
          <textarea value={question} onChange={e=>setQuestion(e.target.value)} className="mt-5 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200 outline-none ring-violet-500/40 placeholder:text-slate-600 focus:ring-2"/>
          <div className="mt-3 flex flex-wrap gap-2">
            {['Summarize Kibo','What is the tracker status?','Summarize Kibo’s health records','I missed a medication dose. Should I double it?','Kibo is struggling to breathe'].map(q=><button key={q} onClick={()=>setQuestion(q)} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white">{q}</button>)}
          </div>
          <button onClick={ask} disabled={asking} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 disabled:opacity-50">{asking?<RefreshCw className="h-4 w-4 animate-spin"/>:<Play className="h-4 w-4"/>}{asking?'Running governed pipeline…':'Ask Pet OS AI'}</button>
          {response && <div className="mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={response.completionStatus==='SAFETY_RESPONSE'?'amber':'green'}>{response.completionStatus}</Badge><Badge>{response.supportLevel}</Badge><Badge tone="blue">{response.latencyMs} ms</Badge></div>
            <p className="mt-4 text-sm leading-7 text-slate-200">{response.content}</p>
            <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sources used</p><div className="mt-2 flex flex-wrap gap-2">{response.provenanceRefs.slice(0,8).map((p,i)=><span key={i} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] text-slate-400">{p.sourceDomain} · {p.recordType}</span>)}</div></div>
          </div>}
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What the assistant can do</p>
          <div className="mt-5 space-y-4">
            {[
              [HeartPulse,'Health summaries','Recorded facts stay attributed to their source.'],
              [Activity,'Care & activity insights','Deterministic due-state and factual trend explanation.'],
              [ShieldCheck,'Emergency safety','Urgent patterns short-circuit to governed safety guidance.'],
              [Database,'Provenance','Pet-specific claims carry source references and freshness.'],
            ].map(([I,t,d]:any)=><div key={t} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-slate-300"><I className="h-4 w-4"/></span><div><p className="text-sm font-semibold text-slate-200">{t}</p><p className="mt-1 text-xs leading-5 text-slate-500">{d}</p></div></div>)}
          </div>
        </Card>
      </div>}

      {view==='recommendations' && <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommendation engine</p><h2 className="mt-1 text-xl font-semibold text-white">Evidence-backed, non-destructive suggestions</h2></div><button onClick={generateRecs} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950"><Sparkles className="h-4 w-4"/>Generate from canonical due state</button></div>
        <div className="mt-6 space-y-3">
          {(recommendations.length?recommendations:store.listRecommendationsForPet(CANONICAL_IDS.PET_KIBO)).map(r=><div key={String(r.recommendationId)} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={r.priority==='URGENT'?'red':r.priority==='HIGH'?'amber':'green'}>{r.priority}</Badge><Badge>{r.category}</Badge><Badge tone="violet">{r.generatedBy}</Badge></div><p className="mt-3 text-sm font-semibold text-white">{r.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{r.explanation}</p></div>)}
          {!(recommendations.length||store.listRecommendationsForPet(CANONICAL_IDS.PET_KIBO).length) && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">No active AI recommendations. Generate from Kibo’s canonical care state.</div>}
        </div>
      </Card>}

      {view==='safety' && <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Safety policy</p><h2 className="mt-1 text-xl font-semibold text-white">Clinical and emergency guardrails</h2><div className="mt-5 space-y-3">{['Emergency breathing, poisoning, seizure and trauma detection','Medication dosing and prescribing prohibition','Prompt-injection detection before model execution','Output validation for diagnosis, dosing and secret leakage','Unknown data remains unknown; conflicts stay visible'].map(x=><div className="flex items-start gap-3 text-sm text-slate-300" key={x}><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/>{x}</div>)}</div></Card>
        <Card className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Consent</p><h2 className="mt-1 text-xl font-semibold text-white">Scoped data access</h2><div className="mt-5 space-y-3">{consents.map(c=><div key={String(c.consentId)} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-200">Household AI consent</p><Badge tone="green">v{c.policyVersion}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{c.scopes.map(s=><span key={s} className={`rounded-lg px-2 py-1 text-[10px] ${c.withdrawnScopes.includes(s)?'bg-red-500/10 text-red-300 line-through':'bg-slate-800 text-slate-400'}`}>{s}</span>)}</div></div>)}</div></Card>
      </div>}

      {view==='models' && <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Model registry</p><h2 className="mt-1 text-xl font-semibold text-white">Approved capabilities</h2><div className="mt-5 space-y-3">{models.map(m=><div key={String(m.modelDefinitionId)} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{m.internalAlias}</p><p className="text-xs text-slate-500">{m.provider} · {m.safetyClass}</p></div><Badge tone={m.status==='ACTIVE'?'green':'slate'}>{m.status}</Badge></div><p className="mt-3 text-xs text-slate-500">{m.capabilities.join(' · ')}</p></div>)}</div></Card>
        <Card className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Deployments</p><h2 className="mt-1 text-xl font-semibold text-white">Risk + sensitivity routing</h2><div className="mt-5 space-y-3">{deployments.map(d=><div key={String(d.modelDeploymentId)} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-200">{String(d.modelDeploymentId)}</p><Badge tone={d.status==='ACTIVE'?'green':'red'}>{d.status}</Badge></div><p className="mt-2 text-xs text-slate-500">{d.dataPolicyProfile}</p><div className="mt-3 flex flex-wrap gap-2">{d.allowedRiskClasses.map(r=><span key={r} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">{r}</span>)}</div></div>)}</div></Card>
      </div>}

      {view==='evaluations' && <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Release gates</p><h2 className="mt-1 text-xl font-semibold text-white">Golden safety evaluation suite</h2></div><button onClick={runEvals} disabled={evalRunning} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{evalRunning?<RefreshCw className="h-4 w-4 animate-spin"/>:<TestTube2 className="h-4 w-4"/>}{evalRunning?'Running…':'Run critical suite'}</button></div>
        {evalRun ? <div className="mt-6"><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-500/10 p-4"><p className="text-xs text-emerald-300">Passed</p><p className="mt-1 text-2xl font-bold text-white">{evalRun.passed}</p></div><div className="rounded-2xl bg-red-500/10 p-4"><p className="text-xs text-red-300">Failed</p><p className="mt-1 text-2xl font-bold text-white">{evalRun.failed}</p></div><div className="rounded-2xl bg-violet-500/10 p-4"><p className="text-xs text-violet-300">Policy</p><p className="mt-1 text-sm font-bold text-white">{evalRun.policyVersion}</p></div></div><div className="mt-5 space-y-2">{evalRun.results.map(r=><div key={String(r.evaluationCaseId)} className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3"><span className="text-xs text-slate-400">{String(r.evaluationCaseId)}</span>{r.passed?<Badge tone="green">PASS</Badge>:<Badge tone="red">FAIL</Badge>}</div>)}</div></div>
        : <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-10 text-center"><CircleDot className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-3 text-sm font-semibold text-slate-300">No evaluation run in this session</p><p className="mt-1 text-xs text-slate-600">Critical emergency, medication and prompt-injection cases gate model releases.</p></div>}
      </Card>}
    </div>
  );
};
