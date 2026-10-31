import React, { useMemo } from 'react';
import { Activity, Database, HeartPulse, ShieldCheck, Workflow } from 'lucide-react';
import { MigrationWave2Service } from '../pet-os/migration-wave2';

export const Sprint39MigrationWave2Console: React.FC = () => {
  const report = useMemo(() => MigrationWave2Service.run(), []);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#EAF4EE] px-3 py-1 text-xs font-bold text-[#2F684C]">
              <Database className="h-4 w-4" />
              Sprint 39 · Migration Wave 2
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              Longitudinal Pet care data now has durable server authority.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Health, Care, Nutrition, Training and Activity now have separate PostgreSQL stores, authenticated Pet-scoped APIs, tenant isolation, RLS, idempotent writes, outbox events and revision-safe lifecycle controls.
            </p>
          </div>
          <div className="min-w-[290px] rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5C7165]">Wave 2 verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#214735]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#68776F]">
              Production ready: <strong>NO</strong>. The static prototype still requires frontend API cutover and later migration waves.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Durable domains', `${report.domains.length} / 5`, HeartPulse],
          ['Safety gates', `${Object.values(report.gates).filter(Boolean).length} / ${Object.keys(report.gates).length}`, ShieldCheck],
          ['Migration progress', '2 / 6 waves', Workflow],
          ['Next wave', 'Provider lifecycle', Activity],
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

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {report.domains.map((domain) => (
          <article key={domain.domain} className="rounded-[22px] border border-[#DDE5DF] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#708178]">Durable domain</p>
                <h2 className="mt-1 text-lg font-bold text-[#24342B]">{domain.domain}</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">DURABLE BACKEND</span>
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div>
                <dt className="font-bold text-[#66756D]">PostgreSQL</dt>
                <dd className="mt-1 font-mono text-[#314239]">{domain.durableTable}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#66756D]">API</dt>
                <dd className="mt-1 break-all font-mono text-[#314239]">{domain.apiBasePath}</dd>
              </div>
              <div>
                <dt className="font-bold text-[#66756D]">Lifecycle</dt>
                <dd className="mt-1 text-[#314239]">{domain.lifecycle.replaceAll('_', ' ')}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {domain.recordTypes.slice(0, 8).map((recordType) => (
                <span key={recordType} className="rounded-full bg-[#F2F5F3] px-2 py-1 text-[9px] font-bold text-[#607068]">
                  {recordType.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[24px] border border-[#E3DED1] bg-[#FFFCF7] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A8063]">Next migration wave</p>
        <h2 className="mt-2 text-lg font-bold text-[#3A3025]">Wave {report.nextWave.wave} · {report.nextWave.domains.join(' · ')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#75695D]">{report.nextWave.objective}</p>
      </section>
    </div>
  );
};
