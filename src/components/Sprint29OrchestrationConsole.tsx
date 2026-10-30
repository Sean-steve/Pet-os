import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileCheck2,
  GitBranch, ListChecks, Play, RefreshCw, Repeat2, ShieldCheck, Sparkles,
  WandSparkles, Workflow, XCircle
} from 'lucide-react';
import { OrchestrationStore } from '../pet-os/orchestration/store';
import { OrchestrationService } from '../pet-os/orchestration/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { ActionProposal, WorkflowInstance } from '../pet-os/orchestration/types';

type View='overview'|'actions'|'automation'|'workflows'|'policy';

const Badge=({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'amber'|'red'|'violet'|'neutral'})=>{
  const cls={
    green:'bg-[#E8F4ED] text-[#2F6B50]',
    amber:'bg-[#FAF1DD] text-[#926823]',
    red:'bg-[#FDEDEA] text-[#A94E42]',
    violet:'bg-[#F0ECFB] text-[#6959A9]',
    neutral:'bg-[#F1F3F0] text-[#68746E]'
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${cls}`}>{children}</span>;
};

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=>(
  <section className={`rounded-[22px] border border-[#E5E9E5] bg-white shadow-[0_12px_34px_rgba(31,52,42,.04)] ${className}`}>{children}</section>
);

export const Sprint29OrchestrationConsole:React.FC=()=>{
  const [view,setView]=useState<View>('overview');
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{type:'success'|'error';text:string}|null>(null);
  const store=OrchestrationStore.getInstance();

  const definitions=store.listActionDefinitions();
  const proposals=store.listProposals();
  const workflows=store.listWorkflows();
  const rules=store.listRules();
  const incidents=store.listIncidents();
  const approvals=store.listApprovals();

  const stats=useMemo(()=>[
    {label:'Allowed actions',value:String(definitions.filter(d=>d.enabled).length),detail:'Strict registry only',icon:ListChecks},
    {label:'Proposals',value:String(proposals.length),detail:'Preview before execution',icon:FileCheck2},
    {label:'Workflows',value:String(workflows.length),detail:'Idempotent saga instances',icon:Workflow},
    {label:'Safety incidents',value:String(incidents.filter(i=>!['RESOLVED','CLOSED'].includes(i.status)).length),detail:'Open orchestration incidents',icon:ShieldCheck},
  ],[definitions.length,proposals.length,workflows.length,incidents.length,refresh]);

  const notify=()=>{
    setMessage({type:'success',text:'Updated orchestration state.'});
    setRefresh(v=>v+1);
  };

  const demoCareAction=async()=>{
    setBusy(true);setMessage(null);
    try{
      const p=OrchestrationService.propose({
        actionType:'CARE_CREATE_OWNER_TASK',
        actorUserId:CANONICAL_IDS.OWNER_ELENA,
        householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,
        petId:CANONICAL_IDS.PET_KIBO,
        origin:'USER_UI',
        payload:{petId:CANONICAL_IDS.PET_KIBO,title:'Check Kibo’s paws after evening walk',description:'Household care task created from Sprint 29 action preview.',dueAt:new Date(Date.now()+4*3600000).toISOString()},
        idempotencyKey:`ui-demo-care-${new Date().toISOString().slice(0,16)}`
      });
      OrchestrationService.confirmProposal(p.actionProposalId,CANONICAL_IDS.OWNER_ELENA);
      await OrchestrationService.executeProposal(p.actionProposalId);
      setMessage({type:'success',text:'Care action previewed, confirmed and executed through the canonical Care domain.'});
      setRefresh(v=>v+1);
    }catch(e:any){setMessage({type:'error',text:e?.message||String(e)});}
    finally{setBusy(false);}
  };

  const demoAutomation=async()=>{
    setBusy(true);setMessage(null);
    try{
      const rule=OrchestrationService.createRule({
        ownerUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,
        name:'Evening care heads-up',description:'Low-risk notification automation only.',
        triggerType:'DOMAIN_EVENT',triggerConfig:{eventType:'DemoCareDue'},
        actionType:'NOTIFICATION_SCHEDULE_SELF',
        actionPayloadTemplate:{title:'Care reminder',body:'A household care task needs attention.',petId:CANONICAL_IDS.PET_KIBO},
        maxExecutionsPerDay:3
      });
      await OrchestrationService.triggerRule(rule.automationRuleId,`ui-event-${Date.now()}`);
      setMessage({type:'success',text:'Safe notification rule triggered. No Pet, clinical, financial or location state was mutated.'});
      setRefresh(v=>v+1);
    }catch(e:any){setMessage({type:'error',text:e?.message||String(e)});}
    finally{setBusy(false);}
  };

  const statusTone=(p:ActionProposal['status'])=>p==='COMPLETED'?'green':p==='FAILED'?'red':p.includes('AWAITING')?'amber':'violet';

  return (
    <div className="space-y-5 text-[#1B2A23]">
      <div className="overflow-hidden rounded-[26px] border border-[#E3E7E3] bg-[#173F31] p-6 text-white shadow-[0_20px_55px_rgba(23,63,49,.16)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2"><Badge tone="green">Sprint 29</Badge><Badge tone="violet">Human-confirmed actions</Badge><Badge>Canonical domains stay authoritative</Badge></div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Automation & Action Orchestration</h2>
            <p className="mt-2 text-sm leading-6 text-[#BBD0C5]">AI can propose. Rules can coordinate. Pet OS still rechecks authorization, policy, target state and confirmation immediately before a domain command is executed.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A9C0B4]">Policy version</p>
            <p className="mt-1 font-mono text-sm font-semibold text-[#F1D38F]">{OrchestrationService.getPolicyVersion()}</p>
          </div>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[#E5E9E5] bg-[#FAFBF9] p-2">
        {([
          ['overview','Overview',Activity],['actions','Action proposals',WandSparkles],['automation','Automation rules',Repeat2],['workflows','Workflows',GitBranch],['policy','Policy & safety',ShieldCheck]
        ] as Array<[View,string,React.ElementType]>).map(([id,label,Icon])=><button key={id} onClick={()=>setView(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${view===id?'bg-[#173F31] text-white':'text-[#68746E] hover:bg-[#EEF3EF]'}`}><Icon className="h-4 w-4"/>{label}</button>)}
      </nav>

      {message&&<div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${message.type==='success'?'border-[#CFE2D6] bg-[#EEF7F1] text-[#315D47]':'border-[#F1D1CC] bg-[#FFF4F1] text-[#9B4A3F]'}`}>{message.type==='success'?<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>:<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>}<span>{message.text}</span></div>}

      {view==='overview'&&<>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(s=>{const Icon=s.icon;return <Card key={s.label} className="p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{s.label}</p><p className="mt-3 text-2xl font-semibold">{s.value}</p><p className="mt-1 text-xs text-[#849089]">{s.detail}</p></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><Icon className="h-5 w-5"/></span></div></Card>})}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <Card className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Execution contract</p>
            <h3 className="mt-1 text-xl font-semibold">Proposal → preview → confirmation → domain command</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['1','Allowlist','Only registered action types exist.'],
                ['2','Preview','Exact effects, privacy and money impact are shown first.'],
                ['3','Policy','Membership, risk, origin and target scope are evaluated.'],
                ['4','Confirm','Confirmation is bound to actor, proposal, preview and expiry.'],
                ['5','Execute','Target domain validates again and remains source of truth.'],
                ['6','Recover','Partial workflows compensate only where reversal is truthful.'],
              ].map(([n,t,d])=><div key={n} className="flex gap-3 rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E7F0EA] text-xs font-bold text-[#2F6B50]">{n}</span><div><p className="text-sm font-semibold">{t}</p><p className="mt-1 text-xs leading-5 text-[#7D8982]">{d}</p></div></div>)}
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Live demos</p>
            <h3 className="mt-1 text-xl font-semibold">Exercise the safe path</h3>
            <button disabled={busy} onClick={demoCareAction} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[#173F31] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><span>Create confirmed Care task</span>{busy?<RefreshCw className="h-4 w-4 animate-spin"/>:<ArrowRight className="h-4 w-4"/>}</button>
            <button disabled={busy} onClick={demoAutomation} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#DCE5DF] bg-[#F6F9F6] px-4 py-3 text-sm font-semibold text-[#365545] disabled:opacity-50"><span>Trigger safe reminder rule</span><Play className="h-4 w-4"/></button>
            <p className="mt-4 text-xs leading-5 text-[#849089]">Financial movement, medication changes, signed clinical records, generic public posts and exact-location publication are intentionally absent from the action registry.</p>
          </Card>
        </div>
      </>}

      {view==='actions'&&<Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EBEEEB] p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Action proposals</p><h3 className="mt-1 text-xl font-semibold">Human-reviewable execution queue</h3></div><button onClick={notify} className="rounded-xl border border-[#E1E6E2] p-2 text-[#65736B]"><RefreshCw className="h-4 w-4"/></button></div>
        <div className="divide-y divide-[#EEF0EE]">
          {proposals.length?proposals.slice(0,20).map(p=><div key={String(p.actionProposalId)} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge tone={statusTone(p.status) as any}>{p.status}</Badge><Badge>{p.actionType}</Badge><Badge tone="violet">{p.origin}</Badge></div><p className="mt-3 text-sm font-semibold">{p.preview?.summary||p.actionType}</p><p className="mt-1 text-xs text-[#849089]">Proposal {String(p.actionProposalId).slice(0,22)}…</p></div><span className="text-[11px] text-[#929C96]">{new Date(p.createdAt).toLocaleString()}</span></div></div>):<div className="p-10 text-center text-sm text-[#8B9690]">No action proposals yet.</div>}
        </div>
      </Card>}

      {view==='automation'&&<div className="grid gap-5 xl:grid-cols-[1fr_.75fr]">
        <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Rules</p><h3 className="mt-1 text-xl font-semibold">Pre-authorized low-risk automation</h3><div className="mt-5 space-y-3">{rules.map(r=><div key={String(r.automationRuleId)} className="rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{r.name}</p><Badge tone={r.status==='ACTIVE'?'green':'neutral'}>{r.status}</Badge></div><p className="mt-1 text-xs leading-5 text-[#849089]">{r.description}</p></div>)}</div></Card>
        <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Rule guardrails</p><div className="mt-4 space-y-3">{['No arbitrary code / eval / SQL conditions','Sensitive actions cannot be standing automations','Daily execution caps prevent floods','Trigger replay uses deterministic idempotency keys','Causal depth and cycle detection stop loops','Authorization is rechecked when the rule actually fires'].map(x=><div key={x} className="flex items-start gap-3 text-sm text-[#4E5D55]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4B8A68]"/>{x}</div>)}</div></Card>
      </div>}

      {view==='workflows'&&<Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Saga execution</p><h3 className="mt-1 text-xl font-semibold">Workflow history</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{workflows.length?workflows.slice(0,20).map(w=><WorkflowRow key={String(w.workflowInstanceId)} workflow={w}/>):<div className="p-10 text-center text-sm text-[#8B9690]">No workflow executions yet.</div>}</div>
      </Card>}

      {view==='policy'&&<div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Action registry</p><h3 className="mt-1 text-xl font-semibold">What orchestration is allowed to call</h3><div className="mt-5 space-y-3">{definitions.map(d=><div key={String(d.actionDefinitionId)} className="rounded-2xl border border-[#E7EBE7] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={d.risk==='SAFETY_CRITICAL'?'red':d.risk==='SENSITIVE'?'amber':'green'}>{d.risk}</Badge><Badge>{d.confirmationLevel}</Badge></div><p className="mt-2 text-sm font-semibold">{d.title}</p><p className="mt-1 text-xs leading-5 text-[#849089]">{d.description}</p></div>)}</div></Card>
        <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Hard stops</p><h3 className="mt-1 text-xl font-semibold">Actions Sprint 29 will not automate</h3><div className="mt-5 space-y-3">{['Move money, issue generic refunds, submit payouts or auto-purchase','Diagnose, prescribe, alter medication dose/frequency or sign clinical records','Publish exact Pet location, household address or BLE detector identity','Create generic Community posts from AI without explicit user action','Change ownership or access permissions through a general automation rule','Pretend a real-world effect can be rolled back when it cannot'].map(x=><div key={x} className="flex gap-3 rounded-2xl bg-[#FFF7F4] p-3 text-sm text-[#704D45]"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45F50]"/>{x}</div>)}</div>{approvals.length>0&&<p className="mt-5 text-xs text-[#849089]">{approvals.length} approval request(s) recorded.</p>}</Card>
      </div>}
    </div>
  );
};

const WorkflowRow=({workflow}:{workflow:WorkflowInstance})=>{
  const tone=workflow.status==='COMPLETED'?'green':workflow.status==='FAILED'?'red':workflow.status==='PARTIALLY_COMPLETED'?'amber':'violet';
  return <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Badge tone={tone as any}>{workflow.status}</Badge><span className="text-xs font-medium text-[#738079]">{workflow.correlationId}</span></div><p className="mt-2 text-sm font-semibold">Workflow {String(workflow.workflowInstanceId).slice(0,24)}…</p><p className="mt-1 text-xs text-[#8A948E]">Current step {workflow.currentStep}</p></div><Clock3 className="h-4 w-4 text-[#9AA39E]"/></div>;
};
