import React, { useMemo } from 'react';
import { BarChart3, Bot, CheckCircle2, Plug, ShoppingBag, Workflow } from 'lucide-react';
import { MigrationWave6Service } from '../pet-os/migration-wave6';

export const Sprint43MigrationWave6Console: React.FC = () => {
  const report = useMemo(() => MigrationWave6Service.run(), []);
  const closed = Object.values(report.gates).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F1EEFA] px-3 py-1 text-xs font-bold text-[#5D4C86]">
              <Workflow className="h-4 w-4" />
              Sprint 43 · Migration Wave 6
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              The planned Pet OS backend domain migration is now complete.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Commerce, external Integrations, governed AI, confirmation-bound Automation and privacy-minimized Analytics now have durable server authority alongside Waves 1–5.
            </p>
          </div>
          <div className="min-w-[310px] rounded-2xl border border-[#E1DCEF] bg-[#FAF8FE] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#75678F]">Wave 6 verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#443568]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#756E80]">
              Domain migration complete: <strong>YES</strong>. Production ready: <strong>NO</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Durable Wave 6 domains', '5 / 5', CheckCircle2],
          ['Backend migration waves', '6 / 6', Workflow],
          ['Wave 6 gates', `${closed} / ${Object.keys(report.gates).length}`, CheckCircle2],
          ['Production certification', 'Still pending', Bot],
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

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        {report.domains.map((domain) => {
          const Icon = domain.domain === 'Commerce'
            ? ShoppingBag
            : domain.domain === 'Integrations'
              ? Plug
              : domain.domain === 'AI'
                ? Bot
                : domain.domain === 'Automation'
                  ? Workflow
                  : BarChart3;
          return (
            <article key={domain.domain} className="rounded-[22px] border border-[#DDE5DF] bg-white p-5">
              <Icon className="h-5 w-5 text-[#53685D]" />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#708178]">Durable authority</p>
              <h2 className="mt-1 text-lg font-bold text-[#24342B]">{domain.domain}</h2>
              <p className="mt-3 text-xs leading-5 text-[#65736B]">{domain.authority}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
          <h2 className="font-bold text-[#24342B]">Certified Wave 6 boundaries</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#65736B]">
            <p>• Commerce prices and inventory are server authoritative; live-animal and restricted-product marketplace paths are blocked.</p>
            <p>• Integration credentials are stored as hashes and external apps receive only explicitly granted projections.</p>
            <p>• AI requires consent, persists safety/provenance and cannot become authoritative domain truth.</p>
            <p>• Automation cannot bypass canonical policy, preview/confirmation binding or explicit execution settlement.</p>
            <p>• Analytics snapshots are derived from canonical stores and exclude raw sensitive data.</p>
          </div>
        </article>

        <article className="rounded-[24px] border border-[#E7E0D2] bg-[#FFFCF7] p-5">
          <h2 className="font-bold text-[#3A3025]">Production closure still required</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#75695D]">
            {report.remainingProductionClosure.map((item) => <p key={item}>• {item}</p>)}
          </div>
        </article>
      </section>
    </div>
  );
};
