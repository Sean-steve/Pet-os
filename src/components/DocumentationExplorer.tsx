import React, { useState } from 'react';
import { CANONICAL_VOLUMES, VolumeSpec } from '../pet-os/documentation/data';
import { 
  BookOpen, 
  Search, 
  Filter, 
  ShieldAlert, 
  FileText, 
  ChevronRight, 
  CheckCircle,
  ExternalLink,
  Layers
} from 'lucide-react';

export const DocumentationExplorer: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVolume, setSelectedVolume] = useState<VolumeSpec>(CANONICAL_VOLUMES[0]);

  const categories = ['ALL', 'Foundation', 'Care & Health', 'Services & Commerce', 'IoT & Tracking', 'AI & Safety', 'Governance & Platform'];

  const filteredVolumes = CANONICAL_VOLUMES.filter((vol) => {
    const matchesCat = selectedCategory === 'ALL' || vol.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = 
      !q || 
      vol.title.toLowerCase().includes(q) ||
      vol.romanNumeral.toLowerCase().includes(q) ||
      vol.normativePrefix.toLowerCase().includes(q) ||
      vol.description.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Search & Filter Header */}
      <div className="bg-[#13151A] rounded-3xl p-6 border border-[#1E293B] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-[#A5B4FC]" />
              <h2 className="text-base font-semibold text-[#F8FAFC]">Pet OS Canonical Engineering Documentation</h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Complete index of all 44 canonical volumes defining the end-to-end Pet OS architecture.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-volumes"
              type="text"
              placeholder="Search by title, prefix, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs text-[#F1F5F9] placeholder-[#475569] rounded-xl border border-[#1E293B] bg-[#0F1115] focus:outline-none focus:border-[#312E81]"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#1E293B]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                  : 'bg-[#0F1115] text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#1E293B]/50 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Dual-Pane Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Volumes (5 cols) */}
        <div className="lg:col-span-5 bg-[#13151A] rounded-3xl border border-[#1E293B] shadow-sm overflow-hidden flex flex-col max-h-[720px]">
          <div className="px-5 py-3.5 border-b border-[#1E293B] bg-[#0B0D10] flex items-center justify-between text-xs text-[#64748B] font-semibold">
            <span>Showing {filteredVolumes.length} Volumes</span>
            <span className="font-mono text-[#A5B4FC]">44 Total</span>
          </div>

          <div className="overflow-y-auto divide-y divide-[#1E293B]/60">
            {filteredVolumes.map((vol) => {
              const isSelected = selectedVolume.id === vol.id;
              return (
                <button
                  key={vol.id}
                  onClick={() => setSelectedVolume(vol)}
                  className={`w-full text-left p-4 transition-all flex items-start justify-between gap-3 ${
                    isSelected 
                      ? 'bg-[#1E293B]/70 border-l-4 border-l-[#A5B4FC]' 
                      : 'hover:bg-[#0F1115]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#A5B4FC]">
                        Vol {vol.romanNumeral}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0F1115] text-[#94A3B8] border border-[#1E293B] font-medium">
                        {vol.category}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#F1F5F9] leading-snug">
                      {vol.title}
                    </div>
                    <div className="text-[11px] text-[#64748B] line-clamp-1">
                      {vol.description}
                    </div>
                  </div>

                  <span className="font-mono text-[10px] text-[#A5B4FC] bg-[#0F1115] border border-[#1E293B] px-2 py-0.5 rounded-md shrink-0 mt-1">
                    {vol.normativePrefix}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Volume Deep Dive Pane (7 cols) */}
        <div className="lg:col-span-7 bg-[#13151A] rounded-3xl p-6 sm:p-8 border border-[#1E293B] shadow-sm space-y-6">
          <div className="space-y-3 border-b border-[#1E293B] pb-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#A5B4FC] bg-[#1E1B4B] px-3 py-1 rounded-xl border border-[#312E81]">
                Volume {selectedVolume.romanNumeral} (#{selectedVolume.volumeNumber})
              </span>
              <span className="text-xs font-mono text-[#64748B]">
                Prefix: <strong className="text-[#F1F5F9]">{selectedVolume.normativePrefix}</strong>
              </span>
            </div>

            <h3 className="text-xl font-semibold text-[#F8FAFC] tracking-tight">
              {selectedVolume.title}
            </h3>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {selectedVolume.description}
            </p>
          </div>

          {/* Core Normative Mandate */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1E1B4B]/80 to-[#0F1115] border border-[#312E81] space-y-1.5 shadow-lg shadow-indigo-950/20">
            <div className="text-[10px] font-bold text-[#A5B4FC] uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#A5B4FC]" />
              <span>Core Normative Mandate</span>
            </div>
            <p className="text-xs text-[#E2E8F0] font-medium leading-relaxed">
              {selectedVolume.coreRule}
            </p>
          </div>

          {/* Key Invariants */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              Architectural Invariants
            </div>
            <div className="space-y-2">
              {selectedVolume.keyInvariants.map((inv, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-[#CBD5E1] bg-[#0F1115] p-3 rounded-xl border border-[#1E293B]">
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{inv}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Canonical Data Models */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              Primary Aggregates &amp; Data Models
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedVolume.canonicalDataModels.map((model) => (
                <span key={model} className="px-3 py-1 rounded-xl text-xs font-mono font-semibold bg-[#0F1115] text-[#A5B4FC] border border-[#1E293B]">
                  {model}
                </span>
              ))}
            </div>
          </div>

          {/* Canonical 5-Step Processing Flow */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">
              Canonical 5-Step Processing Flow (PET Standard)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#1E293B]">
                <span className="font-bold text-[#F1F5F9] block mb-0.5">1. Command</span>
                <span className="text-[#64748B] text-[10px]">Auth actor &amp; resolve scope</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#1E293B]">
                <span className="font-bold text-[#F1F5F9] block mb-0.5">2. Validate</span>
                <span className="text-[#64748B] text-[10px]">Schema &amp; domain invariants</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#1E293B]">
                <span className="font-bold text-[#F1F5F9] block mb-0.5">3. Transact</span>
                <span className="text-[#64748B] text-[10px]">Atomic mutation + outbox</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#1E293B]">
                <span className="font-bold text-[#F1F5F9] block mb-0.5">4. Effects</span>
                <span className="text-[#64748B] text-[10px]">Async events &amp; notify</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0F1115] border border-[#1E293B]">
                <span className="font-bold text-[#F1F5F9] block mb-0.5">5. Retries</span>
                <span className="text-[#64748B] text-[10px]">Idempotent safe replay</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
