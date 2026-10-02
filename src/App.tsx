import React, { useEffect, useState } from 'react';
import { Header, TabType } from './components/Header';
import { UnifiedPetOSExperience } from './components/UnifiedPetOSExperience';
import { seedUnifiedPetOS } from './pet-os/seed/unified-seed';
import { Sprint1Overview } from './components/Sprint1Overview';
import { KernelPlayground } from './components/KernelPlayground';
import { DocumentationExplorer } from './components/DocumentationExplorer';
import { AdrCatalog } from './components/AdrCatalog';
import { Sprint2Terminal } from './components/Sprint2Terminal';
import { Sprint2IdentityConsole } from './components/Sprint2IdentityConsole';
import { Sprint3PetCoreConsole } from './components/Sprint3PetCoreConsole';
import { Sprint4Console } from './components/Sprint4Console';
import { Sprint5HealthConsole } from './components/Sprint5HealthConsole';
import { Sprint6CareConsole } from './components/Sprint6CareConsole';
import { Sprint7NutritionConsole } from './components/Sprint7NutritionConsole';
import { Sprint8TrainingConsole } from './components/Sprint8TrainingConsole';
import { Sprint9ActivityConsole } from './components/Sprint9ActivityConsole';
import { Sprint10ProviderConsole } from './components/Sprint10ProviderConsole';
import { Sprint11BookingConsole } from './components/Sprint11BookingConsole';
import { Sprint12FinanceConsole } from './components/Sprint12FinanceConsole';
import { Sprint13DogWalkingConsole } from './components/Sprint13DogWalkingConsole';
import { Sprint14TrackingConsole } from './components/Sprint14TrackingConsole';
import { Sprint15RecoveryConsole } from './components/Sprint15RecoveryConsole';
import { Sprint16CommunityConsole } from './components/Sprint16CommunityConsole';
import { Sprint17CrowdRecoveryConsole } from './components/Sprint17CrowdRecoveryConsole';
import { Sprint18RescueConsole } from './components/Sprint18RescueConsole';
import { Sprint19VetWorkspaceConsole } from './components/Sprint19VetWorkspaceConsole';
import { Sprint20TrainerWorkspaceConsole } from './components/Sprint20TrainerWorkspaceConsole';
import { Sprint21CareConsole } from './components/Sprint21CareConsole';
import { Sprint22TransportConsole } from './components/Sprint22TransportConsole';
import { Sprint23ReviewConsole } from './components/Sprint23ReviewConsole';
import { Sprint24SubscriptionConsole } from './components/Sprint24SubscriptionConsole';
import { Sprint25TrackerSubscriptionConsole } from './components/Sprint25TrackerSubscriptionConsole';
import { Sprint26ProviderSaaSConsole } from './components/Sprint26ProviderSaaSConsole';
import { Sprint27CommerceConsole } from './components/Sprint27CommerceConsole';

export default function App() {
  const [mode, setMode] = useState<'product' | 'lab'>('product');
  const [activeTab, setActiveTab] = useState<TabType>('sprint27');

  useEffect(() => {
    seedUnifiedPetOS();
  }, []);

  if (mode === 'product') {
    return (
      <UnifiedPetOSExperience
        onOpenModule={(tab) => {
          setActiveTab(tab);
          setMode('lab');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E2E8F0] flex flex-col font-sans selection:bg-[#A5B4FC] selection:text-[#0F1115]">
      <div className="border-b border-emerald-500/15 bg-emerald-950/30 px-4 py-2 text-center text-xs text-emerald-300">
        Operational Console · full Sprint 1–27 domain execution and engineering validation
        <button
          onClick={() => setMode('product')}
          className="ml-3 rounded-lg bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-200 hover:bg-emerald-400/20"
        >
          Return to unified Pet OS
        </button>
      </div>

      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'sprint27' && <Sprint27CommerceConsole />}
        {activeTab === 'sprint26' && <Sprint26ProviderSaaSConsole />}
        {activeTab === 'sprint25' && <Sprint25TrackerSubscriptionConsole />}
        {activeTab === 'sprint24' && <Sprint24SubscriptionConsole />}
        {activeTab === 'sprint23' && <Sprint23ReviewConsole />}
        {activeTab === 'sprint22' && <Sprint22TransportConsole />}
        {activeTab === 'sprint21' && <Sprint21CareConsole />}
        {activeTab === 'sprint20' && <Sprint20TrainerWorkspaceConsole />}
        {activeTab === 'sprint19' && <Sprint19VetWorkspaceConsole />}
        {activeTab === 'sprint18' && <Sprint18RescueConsole />}
        {activeTab === 'sprint17' && <Sprint17CrowdRecoveryConsole />}
        {activeTab === 'sprint16' && <Sprint16CommunityConsole />}
        {activeTab === 'sprint15' && <Sprint15RecoveryConsole />}
        {activeTab === 'sprint14' && <Sprint14TrackingConsole />}
        {activeTab === 'sprint13' && <Sprint13DogWalkingConsole />}
        {activeTab === 'sprint12' && <Sprint12FinanceConsole />}
        {activeTab === 'sprint11' && <Sprint11BookingConsole />}
        {activeTab === 'sprint10' && <Sprint10ProviderConsole />}
        {activeTab === 'sprint9' && <Sprint9ActivityConsole />}
        {activeTab === 'sprint8' && <Sprint8TrainingConsole />}
        {activeTab === 'sprint7' && <Sprint7NutritionConsole />}
        {activeTab === 'sprint6' && <Sprint6CareConsole />}
        {activeTab === 'sprint5' && <Sprint5HealthConsole />}
        {activeTab === 'sprint4' && <Sprint4Console />}
        {activeTab === 'sprint3' && <Sprint3PetCoreConsole />}

        {activeTab === 'overview' && (
          <Sprint1Overview
            onGoToSprint2={() => setActiveTab('identity')}
            onExploreKernel={() => setActiveTab('kernel')}
            onViewDocs={() => setActiveTab('documentation')}
          />
        )}

        {activeTab === 'identity' && <Sprint2IdentityConsole />}
        {activeTab === 'kernel' && <KernelPlayground />}
        {activeTab === 'documentation' && <DocumentationExplorer />}
        {activeTab === 'adrs' && <AdrCatalog />}
        {activeTab === 'sprint2' && <Sprint2Terminal />}
      </main>

      <footer className="border-t border-[#1E293B] bg-[#0B0D10] py-6 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F1F5F9]">Pet OS Operational Console</span>
            <span className="text-[#334155]">·</span>
            <span>Engineering architecture through Sprint 27</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#475569]">
            <span className="text-[#94A3B8]">Regression suites</span>
            <span className="text-[#334155]">·</span>
            <span className="text-[#94A3B8]">Domain consoles</span>
            <span className="text-[#334155]">·</span>
            <span className="text-[#94A3B8]">Canonical source ownership</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
