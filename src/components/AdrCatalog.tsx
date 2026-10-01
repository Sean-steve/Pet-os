import React, { useState } from 'react';
import { CANONICAL_ADRS, ADRItem } from '../pet-os/documentation/data';
import { Layers, Search, CheckCircle, Info, ShieldCheck } from 'lucide-react';

export const AdrCatalog: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAdrs = CANONICAL_ADRS.filter(adr => {
    const q = searchQuery.toLowerCase().trim();
    return !q || 
      adr.number.toLowerCase().includes(q) || 
      adr.title.toLowerCase().includes(q) || 
      adr.decision.toLowerCase().includes(q) ||
      adr.rule.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-[#A5B4FC]" />
              <h2 className="text-base font-semibold text-[#F8FAFC]">Pet OS Architecture Decision Records (ADRs)</h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Volume XLI &amp; Volume 0: Foundational, binding architectural decisions ADR-001 through ADR-020.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-adrs"
              type="text"
              placeholder="Search ADRs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs text-[#F1F5F9] placeholder-[#475569] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
            />
          </div>
        </div>
      </div>

      {/* Grid of ADRs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAdrs.map((adr) => (
          <div
            key={adr.id}
            className="p-5 rounded-3xl bg-[#13151A] border border-[#1E293B] shadow-sm hover:border-[#312E81] transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#A5B4FC] bg-[#1E1B4B] px-2.5 py-1 rounded-lg border border-[#312E81]">
                {adr.number}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                {adr.status}
              </span>
            </div>

            <h3 className="font-semibold text-sm text-[#F8FAFC]">{adr.title}</h3>

            <div className="space-y-2 text-xs">
              <div className="bg-[#0F1115] p-3 rounded-2xl border border-[#1E293B]">
                <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                  Decision
                </span>
                <p className="text-[#CBD5E1] font-medium leading-relaxed">{adr.decision}</p>
              </div>

              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#1E1B4B]/60 to-[#0F1115] border border-[#312E81]">
                <span className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-wider block mb-1">
                  Operational Rule
                </span>
                <p className="text-[#E2E8F0] font-medium leading-relaxed">{adr.rule}</p>
              </div>

              <div className="text-[11px] text-[#64748B] leading-relaxed pt-1">
                <strong className="text-[#94A3B8]">Rationale:</strong> {adr.rationale}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
