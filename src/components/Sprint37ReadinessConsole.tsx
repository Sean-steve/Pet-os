import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Database, Server, ShieldCheck } from 'lucide-react';
import { ProductionReadinessService } from '../pet-os/readiness';

export const Sprint37ReadinessConsole: React.FC = () => {
  const report = useMemo(() => ProductionReadinessService.run(), []);
  const repositoryItems = report.items.filter((item) => item.ownerBoundary === 'REPOSITORY');
  const externalItems = report.items.filter((item) => item.ownerBoundary === 'PRODUCTION_PLATFORM');

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#EEF5F0] px-3 py-1 text-xs font-bold text-[#35634D]">
              <ShieldCheck className="h-4 w-4" />
              Sprint 37 · Production Readiness Closure
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              Codebase closure is complete only when production blockers stay explicit.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Sprint 37 closes repository technical debt and defines the migration contract from the certified browser prototype to durable production infrastructure. It does not convert prototype evidence into a production certification.
            </p>
          </div>
          <div className="min-w-[260px] rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Production ready</p>
            <p className="mt-1 text-2xl font-black text-amber-900">NO</p>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              Current verdict: <strong>{report.verdict.replaceAll('_', ' ')}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Repository gates closed', report.closedInRepo, CheckCircle2],
          ['External requirements', report.externalRequired, AlertTriangle],
          ['In-repo blockers', report.blocked, ShieldCheck],
          ['Migration boundaries', report.migrationBoundaries.length, Database],
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
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-bold text-[#1D2A23]">Closed inside this repository</h2>
              <p className="text-xs text-[#718078]">These gates are enforceable by source control and CI.</p>
            </div>
          </div>
          <div className="space-y-3">
            {repositoryItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#E5EAE7] bg-[#FAFCFA] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B8A82]">{item.id}</p>
                    <h3 className="mt-1 text-sm font-bold text-[#25342C]">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">CLOSED</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#68776F]">{item.evidence.join(' ')}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E8DDC8] bg-[#FFFCF6] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-bold text-[#33291D]">Required before a production launch</h2>
              <p className="text-xs text-[#897866]">These require real backend, infrastructure or independent evidence.</p>
            </div>
          </div>
          <div className="grid gap-3">
            {externalItems.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#EDE3D1] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B866F]">{item.id}</p>
                    <h3 className="mt-1 text-sm font-bold text-[#3A3025]">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">EXTERNAL</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#7B6D5E]">{item.evidence.join(' ')}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
        <div className="mb-5 flex items-center gap-2">
          <Database className="h-5 w-5 text-[#35634D]" />
          <div>
            <h2 className="font-bold text-[#1D2A23]">Backend migration boundaries</h2>
            <p className="text-xs text-[#718078]">Rules that preserve canonical ownership as in-memory prototype state moves to durable services.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {report.migrationBoundaries.map((boundary) => (
            <article key={boundary.domain} className="rounded-2xl border border-[#E4EAE6] bg-[#FBFCFB] p-4">
              <h3 className="text-sm font-bold text-[#26352D]">{boundary.domain}</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-bold text-[#74827A]">Today</dt>
                  <dd className="mt-0.5 text-[#55645C]">{boundary.currentSource}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#74827A]">Production target</dt>
                  <dd className="mt-0.5 text-[#55645C]">{boundary.productionTarget}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#74827A]">Migration rule</dt>
                  <dd className="mt-0.5 leading-5 text-[#405249]">{boundary.migrationRule}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
