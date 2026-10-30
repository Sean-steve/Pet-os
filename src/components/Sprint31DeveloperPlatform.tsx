
import React, { useMemo, useState } from 'react';
import {
  Activity, AppWindow, Braces, CheckCircle2, ChevronRight, CloudCog,
  Code2, ExternalLink, Fingerprint, KeyRound, Link2, LockKeyhole,
  RefreshCw, RotateCcw, Send, ServerCog, ShieldCheck, Webhook, XCircle
} from 'lucide-react';
import { IntegrationStore } from '../pet-os/integrations/store';
import { IntegrationService, SUPPORTED_INTEGRATION_SCOPES } from '../pet-os/integrations/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { DeveloperApp, IntegrationInstallation, WebhookDelivery } from '../pet-os/integrations/types';

type View='overview'|'apps'|'api'|'webhooks'|'security';

const Card=({children,className=''}:{children:React.ReactNode;className?:string})=>(
  <section className={'rounded-[24px] border border-[#E5E9E5] bg-white shadow-[0_14px_38px_rgba(31,52,42,.045)] '+className}>{children}</section>
);

const Badge=({children,tone='neutral'}:{children:React.ReactNode;tone?:'green'|'amber'|'red'|'blue'|'neutral'})=>{
  const cls={
    green:'bg-[#E8F4ED] text-[#2F6B50]',
    amber:'bg-[#FAF1DD] text-[#916C2A]',
    red:'bg-[#FDEDEA] text-[#A94943]',
    blue:'bg-[#EAF1FA] text-[#426E9B]',
    neutral:'bg-[#F1F3F0] text-[#68746E]',
  }[tone];
  return <span className={'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] '+cls}>{children}</span>;
};

export const Sprint31DeveloperPlatform:React.FC=()=>{
  const [view,setView]=useState<View>('overview');
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{type:'success'|'error';text:string}|null>(null);
  const store=IntegrationStore.getInstance();

  const apps=store.listApps();
  const installations=store.listInstallationsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD);
  const credentials=installations.flatMap(i=>store.listCredentialsForInstallation(i.installationId));
  const webhooks=installations.flatMap(i=>store.listWebhooksForInstallation(i.installationId));
  const deliveries=store.listDeliveries();
  const audits=store.listAudits();
  const api=IntegrationService.getApiCatalog();

  const stats=useMemo(()=>[
    {label:'Connected apps',value:installations.filter(i=>i.status==='ACTIVE').length,detail:apps.filter(a=>a.status==='ACTIVE').length+' approved app definitions',icon:AppWindow},
    {label:'API credentials',value:credentials.filter(c=>c.status==='ACTIVE').length,detail:'Hashed at rest · scoped per install',icon:KeyRound},
    {label:'Webhook endpoints',value:webhooks.filter(w=>w.status==='ACTIVE').length,detail:deliveries.filter(d=>d.status==='DELIVERED').length+' successful deliveries',icon:Webhook},
    {label:'Audit events',value:audits.length,detail:audits.filter(a=>a.outcome==='DENIED').length+' denied requests recorded',icon:ShieldCheck},
  ],[refresh,apps.length,installations.length,credentials.length,webhooks.length,deliveries.length,audits.length]);

  const sendDemo=async()=>{
    setBusy(true);setMessage(null);
    try{
      const result=await IntegrationService.publishEvent({
        eventType:'tracker.health.changed',
        householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,
        aggregateId:'demo-tracker-health',
        data:{
          deviceId:'demo-device',petId:CANONICAL_IDS.PET_KIBO,displayName:'Kibo tracker',
          provider:'Pet OS Demo',model:'T1',connectivityStatus:'ONLINE',batteryStatus:'NORMAL',
          batteryPercent:82,lastSeenAt:new Date().toISOString(),
          latitude:-1.28,longitude:36.82,exactRoute:'THIS_FIELD_MUST_BE_REMOVED',
        },
      });
      await IntegrationService.deliverDue();
      setMessage({type:'success',text:'Published '+result.length+' signed, privacy-minimized webhook delivery record(s). Exact location fields were removed.'});
      setRefresh(v=>v+1);
    }catch(e:any){setMessage({type:'error',text:e?.message||String(e)});}
    finally{setBusy(false);}
  };

  return <div className="space-y-5 text-[#1B2A23]">
    <div className="overflow-hidden rounded-[28px] bg-[#172F3A] p-6 text-white shadow-[0_20px_55px_rgba(23,47,58,.17)] md:p-8">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2"><Badge tone="blue">Sprint 31</Badge><Badge tone="green">External integrations</Badge><Badge>Least privilege</Badge></div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Developer Platform & Integration Hub</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#BDD0D8]">Connect trusted apps without giving them Pet OS internals. Every installation is household-scoped, every credential is least-privilege, and every webhook is minimized, signed and auditable.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9BB4BF]">Public API posture</p>
          <p className="mt-1 text-lg font-semibold text-white">Read-only v1</p>
          <p className="text-xs text-[#9BB4BF]">State changes stay inside Pet OS</p>
        </div>
      </div>
    </div>

    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[#E5E9E5] bg-[#FAFBF9] p-2">
      {([
        ['overview','Overview',CloudCog],['apps','Connected apps',AppWindow],['api','API catalog',Code2],['webhooks','Webhooks',Webhook],['security','Security & audit',ShieldCheck]
      ] as Array<[View,string,React.ElementType]>).map(([id,label,Icon])=><button key={id} onClick={()=>setView(id)} className={'flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition '+(view===id?'bg-[#173F31] text-white':'text-[#68746E] hover:bg-[#EEF3EF]')}><Icon className="h-4 w-4"/>{label}</button>)}
    </nav>

    {message&&<div className={'flex items-start gap-3 rounded-2xl border p-4 text-sm '+(message.type==='success'?'border-[#CFE2D6] bg-[#EEF7F1] text-[#315D47]':'border-[#F1D1CC] bg-[#FFF4F1] text-[#9B4A3F]')}>{message.type==='success'?<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>:<XCircle className="mt-0.5 h-4 w-4 shrink-0"/>}<span>{message.text}</span></div>}

    {view==='overview'&&<>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(s=>{const Icon=s.icon;return <Card key={s.label} className="p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{s.label}</p><p className="mt-3 text-2xl font-semibold">{s.value}</p><p className="mt-1 text-xs text-[#849089]">{s.detail}</p></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><Icon className="h-5 w-5"/></span></div></Card>})}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.12fr_.88fr]">
        <Card className="p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Integration contract</p>
          <h3 className="mt-1 text-xl font-semibold">Scoped access from consent to delivery</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['1','App approval','Requested scopes are reviewed before an app can be installed.',AppWindow],
              ['2','Household consent','Owner/admin grants only approved scopes to one household.',Link2],
              ['3','Credential boundary','API token is shown once; only its SHA-256 hash persists.',KeyRound],
              ['4','Minimized API','Projections exclude clinical detail, secrets and exact location.',Braces],
              ['5','Signed webhooks','Payloads are allowlisted and HMAC-SHA256 signed.',Webhook],
              ['6','Revoke instantly','Revoking an install disables its credentials and webhooks.',LockKeyhole],
            ].map(([n,t,d,I]:any)=><div key={n} className="flex gap-3 rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E7F0EA] text-[#2F6B50]"><I className="h-4 w-4"/></span><div><p className="text-sm font-semibold">{t}</p><p className="mt-1 text-xs leading-5 text-[#7D8982]">{d}</p></div></div>)}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Live privacy test</p>
          <h3 className="mt-1 text-xl font-semibold">Send a tracker-health event</h3>
          <p className="mt-2 text-sm leading-6 text-[#7B8780]">The demo deliberately includes latitude, longitude and a route field before publication. Sprint 31 strips them before any third-party delivery is created.</p>
          <button disabled={busy||webhooks.length===0} onClick={sendDemo} className="mt-5 flex w-full items-center justify-between rounded-2xl bg-[#173F31] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><span>Publish minimized signed webhook</span>{busy?<RefreshCw className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}</button>
          <div className="mt-4 rounded-2xl bg-[#F7F9F7] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89948E]">Never exposed by this platform</p>
            <p className="mt-2 text-xs leading-5 text-[#617069]">Exact GPS or route history · raw clinical records or prescriptions · payment execution · payouts · purchases · ownership mutation · direct Sprint 29 action execution.</p>
          </div>
        </Card>
      </div>
    </>}

    {view==='apps'&&<div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Developer apps</p><h3 className="mt-1 text-xl font-semibold">Approved application registry</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{apps.length?apps.map((app:DeveloperApp)=><div key={String(app.developerAppId)} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge tone={app.status==='ACTIVE'?'green':app.status==='DRAFT'?'amber':'neutral'}>{app.status}</Badge><Badge tone="blue">{app.appType}</Badge></div><p className="mt-3 text-sm font-semibold">{app.name}</p><p className="mt-1 text-xs leading-5 text-[#849089]">{app.description}</p></div><AppWindow className="h-5 w-5 text-[#8D9992]"/></div><div className="mt-3 flex flex-wrap gap-1.5">{app.approvedScopes.map(s=><span key={s} className="rounded-lg bg-[#F1F4F1] px-2 py-1 font-mono text-[10px] text-[#5E6C64]">{s}</span>)}</div></div>):<div className="p-10 text-center text-sm text-[#8B9690]">No developer apps.</div>}</div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Household installations</p><h3 className="mt-1 text-xl font-semibold">Consent & credential scope</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{installations.map((i:IntegrationInstallation)=><div key={String(i.installationId)} className="p-5"><div className="flex items-center justify-between"><Badge tone={i.status==='ACTIVE'?'green':'red'}>{i.status}</Badge><span className="text-[10px] text-[#929C96]">{i.consentVersion}</span></div><p className="mt-3 font-mono text-xs text-[#66736C]">{String(i.installationId)}</p><p className="mt-2 text-xs text-[#849089]">{i.grantedScopes.length} granted scopes · {store.listCredentialsForInstallation(i.installationId).filter(c=>c.status==='ACTIVE').length} active credentials</p></div>)}</div>
      </Card>
    </div>}

    {view==='api'&&<div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Public API v1</p><h3 className="mt-1 text-xl font-semibold">Explicit read projections</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{api.map(e=><div key={e.path} className="p-5"><div className="flex flex-wrap items-center gap-2"><Badge tone="green">{e.method}</Badge><code className="text-sm font-semibold text-[#2C4638]">{e.path}</code></div><p className="mt-2 text-xs leading-5 text-[#7D8982]">{e.description}</p><div className="mt-3 flex items-start gap-2 text-xs text-[#836052]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>Excluded: {e.sensitiveFieldsExcluded.join(' · ')}</span></div><p className="mt-2 font-mono text-[10px] text-[#8E9892]">scope: {e.requiredScope}</p></div>)}</div>
      </Card>
      <Card className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Supported scopes</p>
        <h3 className="mt-1 text-xl font-semibold">Least privilege by installation</h3>
        <div className="mt-4 space-y-2">{SUPPORTED_INTEGRATION_SCOPES.map(scope=><div key={scope} className="flex items-center gap-3 rounded-2xl border border-[#E7EBE7] px-4 py-3"><Fingerprint className="h-4 w-4 text-[#567363]"/><code className="text-xs font-semibold text-[#46564D]">{scope}</code></div>)}</div>
        <div className="mt-5 rounded-2xl bg-[#FFF4F1] p-4 text-xs leading-5 text-[#7B534A]"><strong>Write APIs are intentionally absent.</strong> Third-party integrations cannot execute payments, purchases, prescriptions, ownership changes, exact-location reads or orchestration actions through a generic developer credential.</div>
      </Card>
    </div>}

    {view==='webhooks'&&<div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Subscriptions</p><h3 className="mt-1 text-xl font-semibold">HTTPS endpoints</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{webhooks.map(w=><div key={String(w.webhookSubscriptionId)} className="p-5"><div className="flex items-center justify-between"><Badge tone={w.status==='ACTIVE'?'green':'red'}>{w.status}</Badge><Webhook className="h-4 w-4 text-[#87938C]"/></div><p className="mt-3 truncate text-xs font-semibold text-[#42534A]">{w.endpointUrl}</p><div className="mt-3 flex flex-wrap gap-1.5">{w.eventTypes.map(e=><span key={e} className="rounded-lg bg-[#F2F4F2] px-2 py-1 font-mono text-[9px] text-[#65736B]">{e}</span>)}</div></div>)}</div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Delivery ledger</p><h3 className="mt-1 text-xl font-semibold">Retries, signatures & dead letters</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{deliveries.slice(0,14).map((d:WebhookDelivery)=><div key={String(d.webhookDeliveryId)} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={d.status==='DELIVERED'?'green':d.status==='DEAD_LETTER'||d.status==='PERMANENT_FAILURE'?'red':d.status==='RETRY_SCHEDULED'?'amber':'blue'}>{d.status}</Badge><code className="text-[10px] text-[#738079]">{d.eventType}</code></div><p className="mt-2 text-xs text-[#68756E]">Attempts {d.attemptCount}/{d.maxAttempts} · signature {d.signature.slice(0,18)}…</p></div>)}</div>
      </Card>
    </div>}

    {view==='security'&&<div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
      <Card className="p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Security posture</p>
        <h3 className="mt-1 text-xl font-semibold">Controls enforced in Sprint 31</h3>
        <div className="mt-5 space-y-3">{[
          'Raw API credentials are never persisted; only SHA-256 token hashes and prefixes remain.',
          'Webhook URLs require HTTPS and reject obvious localhost/private-network SSRF targets.',
          'Runtime access rechecks app, installation, credential, household and scope state.',
          'Per-credential request limits prevent unbounded integration traffic.',
          'Webhook payload fields are event-specific allowlists, not raw domain event dumps.',
          'HMAC-SHA256 signatures let receivers verify event authenticity.',
          'Retries use bounded exponential backoff and end in dead-letter state.',
          'Revoking an installation immediately revokes credentials and webhook subscriptions.',
        ].map(x=><div key={x} className="flex gap-3 text-sm leading-5 text-[#536159]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4A8765]"/>{x}</div>)}</div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-[#EBEEEB] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Audit trail</p><h3 className="mt-1 text-xl font-semibold">Integration access history</h3></div>
        <div className="divide-y divide-[#EEF0EE]">{audits.slice(0,16).map(a=><div key={String(a.integrationAuditEventId)} className="flex items-start gap-3 p-4"><span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl '+(a.outcome==='DENIED'||a.outcome==='FAILURE'?'bg-[#FFF0E8] text-[#A65E43]':'bg-[#E8F4ED] text-[#2F6B50]')}>{a.outcome==='DENIED'?<XCircle className="h-4 w-4"/>:<Activity className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{a.action}</p><p className="mt-1 truncate text-[11px] text-[#89938E]">{a.actorType} · {a.resourceType}{a.reason?' · '+a.reason:''}</p></div><span className="text-[10px] text-[#A0A8A4]">{new Date(a.createdAt).toLocaleTimeString()}</span></div>)}</div>
      </Card>
    </div>}
  </div>;
};
