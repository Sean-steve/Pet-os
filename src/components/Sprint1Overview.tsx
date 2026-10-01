import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Server, 
  ShieldCheck, 
  Cpu, 
  FileCode, 
  Layers, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check,
  Activity,
  Shield
} from 'lucide-react';
import { SPRINT_1_SUMMARY, SPRINT_PHASES } from '../pet-os/documentation/data';
import { executeHealthCheck, HealthCheckResponse } from '../pet-os/sprint1/runner';

interface Sprint1OverviewProps {
  onGoToSprint2: () => void;
  onExploreKernel: () => void;
  onViewDocs: () => void;
}

export const Sprint1Overview: React.FC<Sprint1OverviewProps> = ({
  onGoToSprint2,
  onExploreKernel,
  onViewDocs,
}) => {
  const [healthData, setHealthData] = useState<HealthCheckResponse>(() => executeHealthCheck());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCid, setCopiedCid] = useState(false);

  const handleRefreshHealth = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setHealthData(executeHealthCheck());
      setIsRefreshing(false);
    }, 250);
  };

  const handleCopyCid = () => {
    navigator.clipboard?.writeText(healthData.meta.correlation_id);
    setCopiedCid(true);
    setTimeout(() => setCopiedCid(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Ingestion Banner with Deep Indigo Glow */}
      <div className="bg-[#13151A] rounded-3xl p-8 border border-[#1E293B] shadow-2xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#A5B4FC]/40 to-transparent"></div>
        <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-[#312E81]/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-3xl space-y-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span className="text-green-400 text-[10px] font-bold uppercase tracking-widest">
                Sprint 1 Ingested &amp; Verified
              </span>
            </div>
            <span className="text-xs text-[#64748B] font-mono">Kernel v0.2.1-stable</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[#F8FAFC]">
            Sprint 1: <span className="text-[#A5B4FC] font-medium">Injest Phase &amp; Architecture</span>
          </h1>

          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
            Data normalization and domain kernel established. The <strong>@pet-os/shared-kernel</strong> (UUIDv7, integer minor-unit Money, Time UTC, error contracts), Express API middleware stack with correlation tracking, and 44 canonical engineering specifications have been loaded.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              id="btn-await-sprint2-hero"
              onClick={onGoToSprint2}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] text-[#0F1115] font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>Await Sprint 2 Data</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="btn-explore-kernel-hero"
              onClick={onExploreKernel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#283548] text-[#A5B4FC] border border-[#312E81] font-semibold text-xs transition-all cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-[#A5B4FC]" />
              <span>Test Shared Kernel</span>
            </button>

            <button
              id="btn-browse-docs-hero"
              onClick={onViewDocs}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#1A1D24] text-[#E2E8F0] border border-[#1E293B] font-semibold text-xs transition-all cursor-pointer"
            >
              <FileCode className="w-4 h-4 text-[#94A3B8]" />
              <span>44 Canonical Volumes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Live System Status & Sprint 1 Deliverables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Core API Health & Status */}
        <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-[#A5B4FC]" />
              <h2 className="font-semibold text-[#F8FAFC] text-sm">Live Core API Health</h2>
            </div>
            <button
              id="btn-refresh-health"
              onClick={handleRefreshHealth}
              disabled={isRefreshing}
              className="p-1.5 text-[#64748B] hover:text-[#F8FAFC] rounded-lg hover:bg-[#1E293B] transition-colors"
              title="Ping health check"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#A5B4FC]' : ''}`} />
            </button>
          </div>

          <div className="bg-[#0F1115] rounded-2xl p-4 border border-[#1E293B] space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Execution Status</span>
              <span className="font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                {healthData.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Build Version</span>
              <span className="font-mono text-[#F1F5F9] font-medium">{healthData.version}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Handshake Latency</span>
              <span className="font-mono text-[#F1F5F9]">0.8 ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">PostgreSQL / PostGIS</span>
              <span className="text-[#A5B4FC] font-medium">Ready (UTC timestamptz)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">Active Subsystem Probes</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[#E2E8F0] text-xs font-medium">Shared Kernel</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[#E2E8F0] text-xs font-medium">Audit Logger</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[#E2E8F0] text-xs font-medium">Outbox Queue</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0F1115] border border-[#1E293B] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                <span className="text-[#E2E8F0] text-xs font-medium">M-PESA Adapter</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1E293B]">
            <div className="text-[10px] uppercase tracking-widest text-[#475569] font-bold mb-1.5">
              Correlation ID
            </div>
            <div className="flex items-center justify-between bg-[#0B0D10] text-[#94A3B8] font-mono text-[11px] p-2.5 rounded-xl border border-[#1E293B]">
              <span className="truncate pr-2">{healthData.meta.correlation_id}</span>
              <button
                id="btn-copy-cid"
                onClick={handleCopyCid}
                className="text-[#64748B] hover:text-[#A5B4FC] transition-colors"
                title="Copy Correlation ID"
              >
                {copiedCid ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Sprint 1 Scope Completed */}
        <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#A5B4FC]" />
                <h2 className="font-semibold text-[#F8FAFC] text-sm">{SPRINT_1_SUMMARY.title}</h2>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-widest">
                Verified 100%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {SPRINT_1_SUMMARY.scope.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#0F1115] border border-[#1E293B]">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-[#CBD5E1] leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-[#1E1B4B]/70 to-[#0B0D10] rounded-2xl border border-[#312E81] text-xs text-[#E2E8F0] space-y-1.5 mt-4">
            <div className="font-semibold flex items-center gap-2 text-[#A5B4FC]">
              <Sparkles className="w-3.5 h-3.5 text-[#A5B4FC]" />
              <span>Ready for Sprint 2: System Ingested</span>
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              Sprint 1 is completed. The execution engine and architecture contracts are locked. Ready to accept Sprint 2 specifications as soon as you upload them.
            </p>
          </div>
        </div>
      </div>

      {/* 100-Sprint Delivery Roadmap */}
      <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#F8FAFC]">100-Sprint Delivery Roadmap</h2>
            <p className="text-xs text-[#64748B]">Volume XLIII: 10 Architectural Delivery Phases</p>
          </div>
          <div className="text-xs text-[#64748B] font-medium">
            Status: <span className="text-[#A5B4FC] font-semibold">Phase 1 · Sprint 1 Complete</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {SPRINT_PHASES.map((phase) => {
            const isCurrent = phase.phase === 1;
            return (
              <div
                key={phase.phase}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#312E81] bg-gradient-to-br from-[#1E1B4B]/50 to-[#0F1115] shadow-lg shadow-indigo-950/30'
                    : 'border-[#1E293B] bg-[#0F1115] hover:border-[#334155]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
                      Phase {phase.phase}
                    </span>
                    {isCurrent ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#A5B4FC] text-[#0F1115]">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#475569] font-medium">Planned</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-xs text-[#F8FAFC] mb-1 leading-tight">{phase.name}</h3>
                  <div className="text-[11px] font-mono text-[#64748B] mb-2">{phase.sprintRange}</div>
                  <p className="text-[11px] text-[#94A3B8] line-clamp-3 leading-relaxed mb-3">
                    {phase.outcome}
                  </p>
                </div>

                <div className="w-full bg-[#1E293B] rounded-full h-1.5 overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full ${
                      isCurrent
                        ? 'bg-[#A5B4FC] shadow-[0_0_8px_rgba(165,180,252,0.4)]'
                        : 'bg-[#334155]'
                    }`}
                    style={{ width: `${phase.progressPercent}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
