import React, { useMemo } from 'react';
import { Briefcase, CalendarCheck, Database, ShieldCheck, Star, Workflow } from 'lucide-react';
import { MigrationWave3Service } from '../pet-os/migration-wave3';

export const Sprint40MigrationWave3Console: React.FC = () => {
  const report = useMemo(() => MigrationWave3Service.run(), []);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ECF2F8] px-3 py-1 text-xs font-bold text-[#3E6287]">
              <Workflow className="h-4 w-4" />
              Sprint 40 · Migration Wave 3
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              The professional service lifecycle now has durable cross-party authority.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Provider identity and offerings, Booking, Professional Care execution, and verified-service Reviews are now linked through relational PostgreSQL authority with authenticated APIs, RLS, idempotency, version history and transactional lifecycle events.
            </p>
          </div>
          <div className="min-w-[300px] rounded-2xl border border-[#DCE7E0] bg-[#F7FAF8] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5C7165]">Wave 3 verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#214735]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#68776F]">
              Production ready: <strong>NO</strong>. Frontend API cutover and Waves 4–6 still remain.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Durable domains', '4 / 4', Database],
          ['Migration progress', '3 / 6 waves', Workflow],
          ['Cross-party isolation', 'RLS + API', ShieldCheck],
          ['Next wave', 'Money & billing', Briefcase],
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

      <section className="grid gap-4 lg:grid-cols-2">
        {report.domains.map((domain) => {
          const Icon = domain.domain === 'Provider' ? Briefcase : domain.domain === 'Booking' ? CalendarCheck : domain.domain === 'Reviews' ? Star : Workflow;
          return (
            <article key={domain.domain} className="rounded-[22px] border border-[#DDE5DF] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Icon className="h-5 w-5 text-[#4C6758]" />
                  <h2 className="mt-3 text-lg font-bold text-[#24342B]">{domain.domain}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">DURABLE BACKEND</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#69776F]">{domain.authority}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
        <h2 className="font-bold text-[#1D2A23]">Certified service chain</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {['Verified Provider', 'Active Offering', 'Household Booking', 'Professional Care', 'Verified Review'].map((label, index) => (
            <div key={label} className="rounded-2xl bg-[#F6F9F7] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#789086]">0{index + 1}</p>
              <p className="mt-2 text-xs font-bold text-[#2C4035]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#E3DED1] bg-[#FFFCF7] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A8063]">Next migration wave</p>
        <h2 className="mt-2 text-lg font-bold text-[#3A3025]">Wave {report.nextWave.wave} · {report.nextWave.domains.join(' · ')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#75695D]">{report.nextWave.objective}</p>
      </section>
    </div>
  );
};
