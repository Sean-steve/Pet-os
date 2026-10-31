import React, { useMemo } from 'react';
import { CheckCircle2, Database, Server, ShieldCheck, Workflow } from 'lucide-react';
import { BackendFoundationService } from '../pet-os/backend-foundation';

export const Sprint38BackendFoundationConsole: React.FC = () => {
  const report = useMemo(() => BackendFoundationService.run(), []);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#EDF4F0] px-3 py-1 text-xs font-bold text-[#35634D]">
              <Server className="h-4 w-4" />
              Sprint 38 · Backend Migration Foundation
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              Pet OS now has a real server, database and runtime boundary.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Identity, Household and Pet Core are the first durable migration wave. PostgreSQL, authenticated APIs, Redis, idempotency, transactional outbox and deployable containers form the foundation for migrating the remaining bounded contexts.
            </p>
          </div>
          <div className="min-w-[280px] rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5C7165]">Foundation verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#214735]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#68776F]">Production ready: <strong>NO</strong>. Remaining domains still require durable migration and deployed-environment evidence.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Implemented capabilities', report.implemented.length, CheckCircle2],
          ['Remaining boundaries', report.remaining.length, ShieldCheck],
          ['Migration waves', report.migrationWaves.length, Workflow],
          ['Completed waves', '2 / 6', Database],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as React.ElementType;
          return (
            <div key={String(label)} className="rounded-2xl border border-[#E1E7E3] bg-white p-4">
              <MetricIcon className="h-5 w-5 text-[#4C6758]" />
              <p className="mt-5 text-2xl font-bold text-[#1B2821]">{String(value)}</p>
              <p className="mt-1 text-xs font-semibold text-[#718078]">{String(label)}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
          <h2 className="font-bold text-[#1D2A23]">Implemented production foundation</h2>
          <div className="mt-4 space-y-3">
            {report.implemented.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#E4EAE6] bg-[#FAFCFA] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8A82]">{item.id}</p>
                    <h3 className="mt-1 text-sm font-bold text-[#25342C]">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">IMPLEMENTED</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#68776F]">{item.evidence.join(' ')}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E7E0D2] bg-[#FFFCF7] p-5">
          <h2 className="font-bold text-[#342C22]">Still to migrate or prove</h2>
          <div className="mt-4 space-y-3">
            {report.remaining.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#EEE5D6] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A8873]">{item.id}</p>
                    <h3 className="mt-1 text-sm font-bold text-[#3A3025]">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                    {item.status === 'NEXT_MIGRATION' ? 'NEXT' : 'EXTERNAL'}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#786B5E]">{item.evidence.join(' ')}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
        <h2 className="font-bold text-[#1D2A23]">Backend migration waves</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {report.migrationWaves.map((wave) => (
            <article key={wave.wave} className="rounded-2xl border border-[#E4EAE6] bg-[#FBFCFB] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wider text-[#537061]">Wave {wave.wave}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${wave.status === 'PENDING' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  {wave.status.replaceAll('_', ' ')}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-[#27372E]">{wave.domains.join(' · ')}</h3>
              <p className="mt-2 text-xs leading-5 text-[#6B7971]">{wave.objective}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
