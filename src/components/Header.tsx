import React from 'react';
import { ShieldCheck, Database, Layers, BookOpen, Terminal, Sparkles, Activity, Users, Dog, Clock, Shield, Stethoscope, CalendarCheck, Utensils, GraduationCap, Footprints, Briefcase, Receipt, Scale, Radio, AlertOctagon, HeartHandshake, Scissors, Truck, Star, CreditCard, ShoppingBag } from 'lucide-react';

export type TabType = 'sprint27' | 'sprint26' | 'sprint25' | 'sprint24' | 'sprint23' | 'sprint22' | 'sprint21' | 'sprint20' | 'sprint19' | 'sprint18' | 'sprint17' | 'sprint16' | 'sprint15' | 'sprint14' | 'sprint13' | 'sprint12' | 'sprint11' | 'sprint10' | 'sprint9' | 'sprint8' | 'sprint7' | 'sprint6' | 'sprint5' | 'sprint4' | 'sprint3' | 'identity' | 'overview' | 'kernel' | 'documentation' | 'adrs' | 'sprint2';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-[#1E293B] bg-[#0B0D10]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="text-slate-950 font-black text-xl">P</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg text-[#F8FAFC] tracking-tight">Pet OS</span>
                <span className="text-[#64748B] font-mono text-xs hidden sm:inline">Kernel v0.27.0-sprint27</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)] mr-1.5 animate-pulse"></span>
                  Sprint 27 Active
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-[#475569] font-bold hidden sm:block">
                Marketplace Seller Platform · Product Catalogue · Inventory · Orders · Fulfillment · Returns &amp; Trust
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
              <button
                id="tab-btn-sprint27"
                onClick={() => setActiveTab('sprint27')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint27'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Sprint 27: Marketplace Commerce</span>
              </button>

              <button
                id="tab-btn-sprint26"
                onClick={() => setActiveTab('sprint26')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint26'
                    ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Sprint 26: Provider SaaS</span>
              </button>

              <button
                id="tab-btn-sprint25"
                onClick={() => setActiveTab('sprint25')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint25'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Sprint 25: Tracker Plans</span>
              </button>

              <button
                id="tab-btn-sprint24"
                onClick={() => setActiveTab('sprint24')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint24'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Sprint 24: Subscriptions</span>
              </button>

              <button
                id="tab-btn-sprint23"
                onClick={() => setActiveTab('sprint23')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint23'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Sprint 23: Reviews &amp; Trust</span>
              </button>

              <button
                id="tab-btn-sprint22"
                onClick={() => setActiveTab('sprint22')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint22'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Sprint 22: Transport</span>
              </button>

              <button
                id="tab-btn-sprint21"
                onClick={() => setActiveTab('sprint21')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint21'
                    ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Sprint 21: Care</span>
              </button>

              <button
                id="tab-btn-sprint20"
                onClick={() => setActiveTab('sprint20')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint20'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Sprint 20: Trainer</span>
              </button>

              <button
                id="tab-btn-sprint19"
                onClick={() => setActiveTab('sprint19')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint19'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Sprint 19: Vet Workspace</span>
              </button>

              <button
                id="tab-btn-sprint18"
                onClick={() => setActiveTab('sprint18')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint18'
                    ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Sprint 18: Rescue & Welfare</span>
              </button>

              <button
                id="tab-btn-sprint17"
                onClick={() => setActiveTab('sprint17')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint17'
                    ? 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Sprint 17: Crowd Recovery</span>
              </button>


              <button
                id="tab-btn-sprint16"
                onClick={() => setActiveTab('sprint16')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint16'
                    ? 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sprint 16: Community</span>
              </button>

              <button
                id="tab-btn-sprint15"
                onClick={() => setActiveTab('sprint15')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint15'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Sprint 15: Recovery</span>
              </button>

              <button
                id="tab-btn-sprint14"
                onClick={() => setActiveTab('sprint14')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint14'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Sprint 14: Tracking</span>
              </button>

              <button
                id="tab-btn-sprint13"
                onClick={() => setActiveTab('sprint13')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint13'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Sprint 13: Dog Walking</span>
              </button>

              <button
                id="tab-btn-sprint12"
                onClick={() => setActiveTab('sprint12')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint12'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sprint 12: Finance</span>
              </button>

              <button
                id="tab-btn-sprint11"
                onClick={() => setActiveTab('sprint11')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint11'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Sprint 11: Booking</span>
              </button>

              <button
                id="tab-btn-sprint10"
                onClick={() => setActiveTab('sprint10')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint10'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Sprint 10: Providers</span>
              </button>

              <button
                id="tab-btn-sprint9"
                onClick={() => setActiveTab('sprint9')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint9'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Sprint 9: Activity</span>
              </button>

              <button
                id="tab-btn-sprint8"
                onClick={() => setActiveTab('sprint8')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint8'
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Sprint 8: Training</span>
              </button>

              <button
                id="tab-btn-sprint7"
                onClick={() => setActiveTab('sprint7')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint7'
                    ? 'bg-amber-400 text-[#0F1115] shadow-lg shadow-amber-500/20'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Sprint 7: Nutrition</span>
              </button>

              <button
                id="tab-btn-sprint6"
                onClick={() => setActiveTab('sprint6')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint6'
                    ? 'bg-emerald-400 text-[#0F1115] shadow-lg shadow-emerald-500/20'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Sprint 6: Care</span>
              </button>

              <button
                id="tab-btn-sprint5"
                onClick={() => setActiveTab('sprint5')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint5'
                    ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Sprint 5: Health</span>
              </button>

              <button
                id="tab-btn-sprint4"
                onClick={() => setActiveTab('sprint4')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint4'
                    ? 'bg-[#A5B4FC] text-[#0F1115] shadow-lg shadow-indigo-500/20'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Sprint 4: Passport</span>
              </button>

              <button
                id="tab-btn-sprint3"
                onClick={() => setActiveTab('sprint3')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'sprint3'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Dog className="w-3.5 h-3.5" />
                <span>Sprint 3: Pet Core</span>
              </button>

              <button
                id="tab-btn-identity"
                onClick={() => setActiveTab('identity')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'identity'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Sprint 2: Identity</span>
              </button>

              <button
                id="tab-btn-overview"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                id="tab-btn-kernel"
                onClick={() => setActiveTab('kernel')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'kernel'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Shared Kernel</span>
              </button>

              <button
                id="tab-btn-docs"
                onClick={() => setActiveTab('documentation')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'documentation'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>44 Volumes</span>
              </button>

              <button
                id="tab-btn-adrs"
                onClick={() => setActiveTab('adrs')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'adrs'
                    ? 'bg-[#1E293B] text-[#A5B4FC] border border-[#312E81] shadow-sm'
                    : 'text-[#64748B] hover:text-[#E2E8F0] hover:bg-[#13151A]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>ADRs</span>
              </button>
            </nav>

            <div className="hidden xl:flex items-center gap-2 pl-4 border-l border-[#1E293B]">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-widest text-[#64748B] font-bold">Status</span>
                <span className="text-green-400 font-mono text-xs tracking-tight font-semibold">SPRINT_03_ACTIVE</span>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
