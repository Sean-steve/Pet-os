import React, { useMemo } from 'react';
import { CircleDollarSign, CreditCard, Database, ShieldCheck, Workflow } from 'lucide-react';
import { MigrationWave4Service } from '../pet-os/migration-wave4';

export const Sprint41MigrationWave4Console: React.FC = () => {
  const report = useMemo(() => MigrationWave4Service.run(), []);
  const closed = Object.values(report.gates).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#FBF2DE] px-3 py-1 text-xs font-bold text-[#8A6828]">
              <CircleDollarSign className="h-4 w-4" />
              Sprint 41 · Migration Wave 4
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              Money, billing and entitlements now have durable server authority.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Finance, consumer subscriptions and Provider SaaS now use PostgreSQL-backed authority with immutable double-entry journals, server-derived prices, trusted settlement adapters, entitlement grants, reconciliation and Pet-safety continuity.
            </p>
          </div>
          <div className="min-w-[300px] rounded-2xl border border-[#E6DFC9] bg-[#FFFCF5] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7D6B44]">Wave 4 verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#594315]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#74664C]">
              Production ready: <strong>NO</strong>. Live provider credentials/signature verification and frontend API cutover remain external requirements.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Durable domains', '3 / 3', Database],
          ['Safety gates', `${closed} / ${Object.keys(report.gates).length}`, ShieldCheck],
          ['Migration progress', '4 / 6 waves', Workflow],
          ['External boundary', 'Live providers', CreditCard],
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

      <section className="grid gap-4 lg:grid-cols-3">
        {report.domains.map((domain) => (
          <article key={domain.domain} className="rounded-[22px] border border-[#DDE5DF] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#708178]">Durable authority</p>
                <h2 className="mt-1 text-lg font-bold text-[#24342B]">{domain.domain}</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">DURABLE BACKEND</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#65736B]">{domain.authority}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
          <h2 className="text-sm font-bold text-[#24342B]">Financial invariants</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#65736B]">
            <p>• Booking payment amounts come from the server-owned price snapshot.</p>
            <p>• Posted double-entry journals are balanced and immutable.</p>
            <p>• Provider payout amounts come from available earnings, not browser-entered money.</p>
            <p>• Payment and billing reconciliation preserve durable drift evidence.</p>
          </div>
        </article>
        <article className="rounded-[24px] border border-[#E7E0D2] bg-[#FFFCF7] p-5">
          <h2 className="text-sm font-bold text-[#3A3025]">Safety and production boundary</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#75695D]">
            <p>• Consumer safety-critical entitlements are not silently stripped during billing failure.</p>
            <p>• Restricted Provider SaaS cannot interrupt an active Pet-care engagement.</p>
            <p>• Settlement endpoints require a trusted server-to-server adapter secret.</p>
            <p>• Real payment-provider signing, credentials and production reconciliation evidence remain external.</p>
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#E3DED1] bg-[#FFFCF7] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A8063]">Next migration wave</p>
        <h2 className="mt-2 text-lg font-bold text-[#3A3025]">Wave {report.nextWave.wave} · {report.nextWave.domains.join(' · ')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#75695D]">{report.nextWave.objective}</p>
      </section>
    </div>
  );
};
