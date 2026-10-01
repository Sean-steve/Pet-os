import React, { useState } from 'react';
import { 
  Terminal, 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  AlertCircle,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';

export const Sprint2Terminal: React.FC = () => {
  const [sprint2Text, setSprint2Text] = useState('');
  const [ingestedStatus, setIngestedStatus] = useState<null | {
    title: string;
    itemsCount: number;
    timestamp: string;
  }>(null);

  const sampleSprint2Options = [
    {
      title: 'Sprint 2: User Accounts & Household Multi-Caregiver Membership',
      backlog: `### Sprint 2 Scope: Identity & Household Governance (Volumes IV & V)
- US-201: Implement UserAccount aggregate with email/phone verification (Kenya E.164 +254).
- US-202: Implement Household aggregate with atomic owner membership creation.
- US-203: Implement HouseholdInvitation with role-based access (ADMIN, CAREGIVER, TEMP_CAREGIVER) and automatic expiry.
- US-204: Server-side RBAC/ABAC gate denying access to non-household pets by default.
- US-205: Audit logging for all household membership mutations.`
    },
    {
      title: 'Sprint 2: Pet Digital Twin & Breed Registry (Volumes V & VI)',
      backlog: `### Sprint 2 Scope: Pet Aggregate & Digital Twin (Volume V)
- US-206: Implement Pet aggregate with birth_date_precision ('exact' | 'estimated_month' | 'estimated_year' | 'unknown').
- US-207: Implement PetBreedAssignment supporting mixed/unknown breeds and proportion percentages <= 100%.
- US-208: Pet ownership history record (immutable starts_at/ends_at).
- US-209: Microchip identifier registry (scan-time RFID only, never GPS).
- US-210: Initial PetTimelineEvent normalized projection engine.`
    }
  ];

  const handleSimulateIngest = (sampleText: string, title: string) => {
    setSprint2Text(sampleText);
    setIngestedStatus({
      title,
      itemsCount: sampleText.split('- US-').length - 1,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  const handleManualIngest = () => {
    if (!sprint2Text.trim()) return;
    setIngestedStatus({
      title: 'Custom Sprint 2 Backlog',
      itemsCount: sprint2Text.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*')).length || 1,
      timestamp: new Date().toLocaleTimeString()
    });
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Ready Gate Banner — Inspired by Elegant Dark Showcase */}
      <div className="bg-gradient-to-br from-[#1E1B4B] to-[#0B0D10] rounded-3xl border border-[#312E81] p-8 sm:p-10 shadow-2xl shadow-indigo-900/30 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#A5B4FC]/40 to-transparent"></div>
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#A5B4FC]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-start gap-6 relative z-10 max-w-2xl">
          <div className="w-16 h-16 rounded-2xl border border-dashed border-[#A5B4FC]/50 flex items-center justify-center relative shrink-0 bg-[#0F1115]/60 shadow-inner">
            <div className="w-8 h-8 bg-[#A5B4FC] rounded-full blur-md opacity-25 absolute"></div>
            <div className="w-3.5 h-3.5 bg-[#A5B4FC] rounded-full shadow-[0_0_15px_rgba(165,180,252,0.8)]"></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-semibold text-[#F8FAFC] tracking-tight">Ready for Sprint 2</h2>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                Terminal Listening
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              System environment is staged and verified. Upload or paste your Sprint 2 documentation, user stories, or requirements below to proceed with the next layer of Pet OS development.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center md:items-end gap-2 w-full md:w-auto relative z-10">
          <div className="px-4 py-2 rounded-2xl bg-[#0F1115] border border-[#1E293B] text-center md:text-right">
            <span className="text-[10px] uppercase tracking-widest text-[#64748B] font-bold block">Deployment Gate</span>
            <span className="text-[#A5B4FC] font-mono text-xs font-semibold">WAITING_FOR_SPRINT_02</span>
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <div className="w-2 h-2 rounded-full bg-[#1E293B]"></div>
          </div>
        </div>
      </div>

      {/* Upload / Paste Area */}
      <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UploadCloud className="w-4 h-4 text-[#A5B4FC]" />
            <h3 className="font-semibold text-[#F8FAFC] text-sm">Sprint 2 Intake Payload</h3>
          </div>
          <span className="text-xs text-[#64748B] font-mono">Markdown / Text / Stories</span>
        </div>

        <div className="space-y-3">
          <textarea
            id="textarea-sprint2-input"
            rows={8}
            placeholder="Paste your Sprint 2 backlog, requirements, user stories, or instructions here..."
            value={sprint2Text}
            onChange={(e) => setSprint2Text(e.target.value)}
            className="w-full p-4 rounded-2xl border border-[#1E293B] bg-[#0F1115] font-mono text-xs text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:border-[#312E81]"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#64748B] font-medium">Quick load templates:</span>
              {sampleSprint2Options.map((opt, i) => (
                <button
                  key={i}
                  id={`btn-load-sample-${i}`}
                  onClick={() => handleSimulateIngest(opt.backlog, opt.title)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1E293B] hover:bg-[#283548] text-[#A5B4FC] border border-[#312E81] transition-all cursor-pointer"
                >
                  {i === 0 ? 'Template A (Identity & Households)' : 'Template B (Pet Digital Twin)'}
                </button>
              ))}
            </div>

            <button
              id="btn-confirm-sprint2-intake"
              onClick={handleManualIngest}
              disabled={!sprint2Text.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#A5B4FC] hover:bg-[#C7D2FE] disabled:opacity-30 disabled:hover:bg-[#A5B4FC] text-[#0F1115] font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Confirm &amp; Load Sprint 2</span>
            </button>
          </div>
        </div>

        {/* Confirmation Status Badge if loaded */}
        {ingestedStatus && (
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-xs text-[#E2E8F0] space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 font-semibold text-green-400">
              <Check className="w-4 h-4 text-green-400" />
              <span>{ingestedStatus.title} Registered in Staging Area</span>
            </div>
            <p className="text-[#CBD5E1] leading-relaxed">
              Detected {ingestedStatus.itemsCount} user stories / tasks at {ingestedStatus.timestamp}.
              The Pet OS kernel and environment are ready to implement Sprint 2!
            </p>
          </div>
        )}
      </div>

      {/* Sprint 1 Gate Verification Matrix */}
      <div className="bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span>Sprint 1 Readiness Gate Checklist (PETXLIII-001)</span>
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            "A sprint MUST NOT begin when predecessor invariants are unstable." All Sprint 1 foundation invariants are locked and verified:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              Shared Kernel UUIDv7
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">RFC 9562 time-ordered IDs active across all aggregates.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              Money &amp; M-PESA Engine
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">Integer minor units and lossless multi-party allocation.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              Correlation Propagation
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">Trace correlation IDs propagated across every operation.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              Audit Trail Storage
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">Append-only immutable audit events with actor scope.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              Machine Error Contracts
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">25 standardized codes with HTTP status mapping.</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F1115] border border-[#1E293B] space-y-1">
            <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
              44 Volumes Governance
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">Complete canonical architecture library indexed.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
