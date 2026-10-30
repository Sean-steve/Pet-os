
import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, CalendarDays, ChevronRight, Clock3,
  Search, ShieldCheck, Sparkles, Workflow, PawPrint, Radio, ShoppingBag
} from 'lucide-react';
import { CommandCenterService } from '../pet-os/command-center/service';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import type { GlobalSearchResult, AttentionSeverity } from '../pet-os/command-center/types';
import type { TabType } from './Header';

interface Props {
  onOpenModule: (tab: TabType) => void;
}

const tone: Record<AttentionSeverity, string> = {
  INFO: 'bg-[#EEF3EF] text-[#527061]',
  LOW: 'bg-[#EDF4F8] text-[#4E7184]',
  MEDIUM: 'bg-[#FAF1DD] text-[#916C2A]',
  HIGH: 'bg-[#FFF0E8] text-[#A65E43]',
  CRITICAL: 'bg-[#FDEDEA] text-[#A94943]',
};

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={'rounded-[24px] border border-[#E5E9E5] bg-white shadow-[0_14px_38px_rgba(31,52,42,.045)] ' + className}>{children}</section>
);

export const Sprint30CommandCenter: React.FC<Props> = ({ onOpenModule }) => {
  const [query, setQuery] = useState('');
  const [refresh, setRefresh] = useState(0);

  const snapshot = useMemo(() => CommandCenterService.getSnapshot({
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    timezone: 'Africa/Nairobi',
  }), [refresh]);

  const results = useMemo(() => query.trim().length >= 2
    ? CommandCenterService.search({
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        timezone: 'Africa/Nairobi',
        query,
        limit: 12,
      })
    : [], [query, refresh]);

  const open = (tab: string) => onOpenModule(tab as TabType);

  return (
    <div className="space-y-5 text-[#1B2A23]">
      <div className="overflow-hidden rounded-[28px] bg-[#173F31] p-6 text-white shadow-[0_20px_55px_rgba(23,63,49,.16)] md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#D4E2DB]">Sprint 30</span>
              <span className="rounded-full bg-[#F1D38F]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em] text-[#F1D38F]">Unified command center</span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">One place to know what matters now.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#BBD0C5]">
              Today, household pulse, search and action inbox are projections over the canonical Pet OS domains. Nothing here replaces the source records.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#A9C0B4]">Local operating date</p>
            <p className="mt-1 text-lg font-semibold text-white">{snapshot.localDate}</p>
            <p className="text-xs text-[#A9C0B4]">{snapshot.timezone}</p>
          </div>
        </div>

        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#79998A]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pets, care, bookings, devices, orders, actions or modules…"
            className="h-14 w-full rounded-2xl border border-white/10 bg-white px-12 text-sm text-[#203129] outline-none placeholder:text-[#9AA8A1] focus:ring-4 focus:ring-[#D6E9DE]/20"
          />
          {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-semibold text-[#69766F]">Clear</button>}
        </div>
      </div>

      {query.trim().length >= 2 && (
        <Card className="overflow-hidden">
          <div className="border-b border-[#EBEEEB] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Global search</p>
            <h3 className="mt-1 text-lg font-semibold">{results.length} result{results.length === 1 ? '' : 's'} for “{query}”</h3>
          </div>
          <div className="divide-y divide-[#EEF0EE]">
            {results.length ? results.map((r: GlobalSearchResult) => (
              <button key={r.id} onClick={() => open(r.tab)} className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#F8FAF8]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEF3EF] text-[#466A57]"><Search className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <span className="rounded-full bg-[#F2F4F2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-[#738078]">{r.category}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#87928C]">{r.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#A9B1AC]" />
              </button>
            )) : <div className="p-8 text-center text-sm text-[#8B9690]">No authorized Pet OS result matches that search.</div>}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Pets', snapshot.pulse.pets, 'Active household profiles', PawPrint],
          ['Care today', snapshot.pulse.dueToday, snapshot.pulse.overdueCare + ' overdue', CalendarDays],
          ['Action inbox', snapshot.pulse.actionInbox, 'Needs review or attention', Workflow],
          ['Trackers online', snapshot.pulse.onlineTrackers, snapshot.pulse.unreadNotifications + ' unread alerts', Radio],
        ].map(([label, value, detail, Icon]: any) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">{label}</p>
                <p className="mt-3 text-2xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-[#849089]">{detail}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EDF3EF] text-[#426854]"><Icon className="h-5 w-5" /></span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#EBEEEB] p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Today</p>
              <h3 className="mt-1 text-xl font-semibold">Household operating timeline</h3>
            </div>
            <Clock3 className="h-5 w-5 text-[#7E8983]" />
          </div>
          <div className="divide-y divide-[#EEF0EE]">
            {snapshot.today.length ? snapshot.today.map((item) => (
              <button key={item.id} onClick={() => open(item.tab)} className="flex w-full gap-4 p-5 text-left transition hover:bg-[#F8FAF8]">
                <div className="w-[72px] shrink-0">
                  <p className="text-sm font-semibold">{item.localTimeLabel}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#98A19C]">{item.kind}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-[#849089]">{item.subtitle}</p>
                </div>
                <span className={'h-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ' + tone[item.severity]}>{item.status}</span>
              </button>
            )) : <div className="p-10 text-center text-sm text-[#8B9690]">No scheduled household items for today.</div>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#EBEEEB] p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Action inbox</p>
              <h3 className="mt-1 text-xl font-semibold">What needs attention</h3>
            </div>
            <Bell className="h-5 w-5 text-[#7E8983]" />
          </div>
          <div className="divide-y divide-[#EEF0EE]">
            {snapshot.inbox.length ? snapshot.inbox.slice(0, 10).map((item) => (
              <button key={item.id} onClick={() => open(item.tab)} className="flex w-full gap-3 p-4 text-left transition hover:bg-[#F8FAF8]">
                <span className={'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ' + tone[item.severity]}>
                  {item.severity === 'CRITICAL' || item.severity === 'HIGH' ? <AlertTriangle className="h-4 w-4" /> : <Workflow className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.requiresHumanDecision && <span className="rounded-full bg-[#F0ECFB] px-2 py-0.5 text-[9px] font-bold uppercase text-[#6A5AA8]">Decision</span>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#849089]">{item.subtitle}</p>
                </div>
              </button>
            )) : <div className="p-10 text-center text-sm text-[#8B9690]">Nothing currently needs attention.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Pet switcher</p>
              <h3 className="mt-1 text-xl font-semibold">Household at a glance</h3>
            </div>
            <PawPrint className="h-5 w-5 text-[#75817A]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {snapshot.pets.map((pet) => (
              <button key={String(pet.petId)} onClick={() => open('sprint3')} className="rounded-2xl border border-[#E7EBE7] bg-[#FAFBF9] p-4 text-left hover:bg-[#F4F7F4]">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{pet.name}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#728078]">{pet.trackerStatus}</span>
                </div>
                <p className="mt-1 text-xs text-[#89938E]">{pet.species} · {pet.lifecycleStage}</p>
                <div className="mt-3 flex gap-3 text-xs text-[#617069]">
                  <span>{pet.dueToday} due today</span>
                  <span>{pet.overdue} overdue</span>
                  <span>{pet.upcomingBookings} bookings</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#909A94]">Recent activity</p>
              <h3 className="mt-1 text-xl font-semibold">Cross-domain changes</h3>
            </div>
            <Activity className="h-5 w-5 text-[#75817A]" />
          </div>
          <div className="mt-4 space-y-2">
            {snapshot.recentActivity.slice(0, 7).map((item) => (
              <button key={item.id} onClick={() => open(item.tab)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#F7F9F7]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EEF3EF] text-[#567363]">
                  {item.kind === 'ORDER' ? <ShoppingBag className="h-4 w-4" /> : item.kind === 'AUTOMATION' ? <Sparkles className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-[#89938E]">{item.status} · {item.sourceDomain}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#A8B0AB]" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] border border-[#DDE6E0] bg-[#EDF5F0] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#3E7658]" />
          <div>
            <p className="text-sm font-semibold text-[#2F493B]">Command Center is a read projection.</p>
            <p className="mt-1 text-xs leading-5 text-[#688075]">Search does not index exact tracker coordinates or notification body text, and state changes still route through the owning domain and Sprint 29 confirmation policies.</p>
          </div>
        </div>
        <button onClick={() => setRefresh((v) => v + 1)} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#426854] shadow-sm">Refresh snapshot</button>
      </div>
    </div>
  );
};
