import React, { useMemo } from 'react';
import { MapPin, Route, ShieldCheck, Truck, Users, Workflow } from 'lucide-react';
import { MigrationWave5Service } from '../pet-os/migration-wave5';

export const Sprint42MigrationWave5Console: React.FC = () => {
  const report = useMemo(() => MigrationWave5Service.run(), []);
  const closed = Object.values(report.gates).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5DF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#EAF5F8] px-3 py-1 text-xs font-bold text-[#346B79]">
              <MapPin className="h-4 w-4" />
              Sprint 42 · Migration Wave 5
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#18231D]">
              Tracking, custody, recovery and community now share durable event authority.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#65736B]">
              Exact location stays private to Tracking and Recovery, Transport stores custody plus opaque route references, and Community receives only coarse recovery-safe projections.
            </p>
          </div>
          <div className="min-w-[300px] rounded-2xl border border-[#D8E7EA] bg-[#F7FCFD] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5B7379]">Wave 5 verdict</p>
            <p className="mt-2 text-lg font-black leading-6 text-[#254E59]">{report.verdict.replaceAll('_', ' ')}</p>
            <p className="mt-3 text-xs leading-5 text-[#68787C]">
              Production ready: <strong>NO</strong>. Live tracker-provider credentials/signatures, async workers and frontend API cutover remain external.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Durable domains', '4 / 4', Route],
          ['Safety gates', `${closed} / ${Object.keys(report.gates).length}`, ShieldCheck],
          ['Migration progress', '5 / 6 waves', Workflow],
          ['Location boundary', 'Exact stays private', MapPin],
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

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {report.domains.map((domain) => (
          <article key={domain.domain} className="rounded-[22px] border border-[#DDE5DF] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#708178]">Durable authority</p>
                <h2 className="mt-1 text-lg font-bold text-[#24342B]">{domain.domain}</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">DURABLE</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#65736B]">{domain.authority}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-[#DDE5DF] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#24342B]"><Truck className="h-4 w-4" /> Custody & tracking invariants</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#65736B]">
            <p>• Trusted telemetry is deduplicated and stale packets cannot regress live Pet location.</p>
            <p>• Safe-zone transitions are derived from authoritative Tracking observations.</p>
            <p>• Transport exact addresses remain encrypted references and are not returned in owner projections.</p>
            <p>• Custody records are append-only and trip completion requires successful Pet handover.</p>
          </div>
        </article>
        <article className="rounded-[24px] border border-[#E7E0D2] bg-[#FFFCF7] p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#3A3025]"><Users className="h-4 w-4" /> Recovery privacy & community</h2>
          <div className="mt-4 space-y-2 text-xs leading-5 text-[#75695D]">
            <p>• Lost Pet incidents reference the last authoritative Tracking observation.</p>
            <p>• Exact sightings are visible only to authorized recovery participants.</p>
            <p>• Public recovery profiles expose coarse area only.</p>
            <p>• Community content rejects structured exact location and recovery volunteering requires explicit opt-in.</p>
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#E3DED1] bg-[#FFFCF7] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9A8063]">Final migration wave</p>
        <h2 className="mt-2 text-lg font-bold text-[#3A3025]">Wave {report.nextWave.wave} · {report.nextWave.domains.join(' · ')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#75695D]">{report.nextWave.objective}</p>
      </section>
    </div>
  );
};
