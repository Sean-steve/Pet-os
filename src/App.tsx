import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { TabType } from './components/Header';
import { UnifiedPetOSExperience } from './components/UnifiedPetOSExperience';

const lazyNamed = (loader: () => Promise<any>, exportName: string) =>
  React.lazy(async () => ({ default: (await loader())[exportName] as React.ComponentType<any> }));

const Sprint1Overview = lazyNamed(() => import('./components/Sprint1Overview'), 'Sprint1Overview');
const KernelPlayground = lazyNamed(() => import('./components/KernelPlayground'), 'KernelPlayground');
const DocumentationExplorer = lazyNamed(() => import('./components/DocumentationExplorer'), 'DocumentationExplorer');
const AdrCatalog = lazyNamed(() => import('./components/AdrCatalog'), 'AdrCatalog');
const Sprint2Terminal = lazyNamed(() => import('./components/Sprint2Terminal'), 'Sprint2Terminal');
const Sprint2IdentityConsole = lazyNamed(() => import('./components/Sprint2IdentityConsole'), 'Sprint2IdentityConsole');
const Sprint3PetCoreConsole = lazyNamed(() => import('./components/Sprint3PetCoreConsole'), 'Sprint3PetCoreConsole');
const Sprint4Console = lazyNamed(() => import('./components/Sprint4Console'), 'Sprint4Console');
const Sprint5HealthConsole = lazyNamed(() => import('./components/Sprint5HealthConsole'), 'Sprint5HealthConsole');
const Sprint6CareConsole = lazyNamed(() => import('./components/Sprint6CareConsole'), 'Sprint6CareConsole');
const Sprint7NutritionConsole = lazyNamed(() => import('./components/Sprint7NutritionConsole'), 'Sprint7NutritionConsole');
const Sprint8TrainingConsole = lazyNamed(() => import('./components/Sprint8TrainingConsole'), 'Sprint8TrainingConsole');
const Sprint9ActivityConsole = lazyNamed(() => import('./components/Sprint9ActivityConsole'), 'Sprint9ActivityConsole');
const Sprint10ProviderConsole = lazyNamed(() => import('./components/Sprint10ProviderConsole'), 'Sprint10ProviderConsole');
const Sprint11BookingConsole = lazyNamed(() => import('./components/Sprint11BookingConsole'), 'Sprint11BookingConsole');
const Sprint12FinanceConsole = lazyNamed(() => import('./components/Sprint12FinanceConsole'), 'Sprint12FinanceConsole');
const Sprint13DogWalkingConsole = lazyNamed(() => import('./components/Sprint13DogWalkingConsole'), 'Sprint13DogWalkingConsole');
const Sprint14TrackingConsole = lazyNamed(() => import('./components/Sprint14TrackingConsole'), 'Sprint14TrackingConsole');
const Sprint15RecoveryConsole = lazyNamed(() => import('./components/Sprint15RecoveryConsole'), 'Sprint15RecoveryConsole');
const Sprint16CommunityConsole = lazyNamed(() => import('./components/Sprint16CommunityConsole'), 'Sprint16CommunityConsole');
const Sprint17CrowdRecoveryConsole = lazyNamed(() => import('./components/Sprint17CrowdRecoveryConsole'), 'Sprint17CrowdRecoveryConsole');
const Sprint18RescueConsole = lazyNamed(() => import('./components/Sprint18RescueConsole'), 'Sprint18RescueConsole');
const Sprint19VetWorkspaceConsole = lazyNamed(() => import('./components/Sprint19VetWorkspaceConsole'), 'Sprint19VetWorkspaceConsole');
const Sprint20TrainerWorkspaceConsole = lazyNamed(() => import('./components/Sprint20TrainerWorkspaceConsole'), 'Sprint20TrainerWorkspaceConsole');
const Sprint21CareConsole = lazyNamed(() => import('./components/Sprint21CareConsole'), 'Sprint21CareConsole');
const Sprint22TransportConsole = lazyNamed(() => import('./components/Sprint22TransportConsole'), 'Sprint22TransportConsole');
const Sprint23ReviewConsole = lazyNamed(() => import('./components/Sprint23ReviewConsole'), 'Sprint23ReviewConsole');
const Sprint24SubscriptionConsole = lazyNamed(() => import('./components/Sprint24SubscriptionConsole'), 'Sprint24SubscriptionConsole');
const Sprint25TrackerSubscriptionConsole = lazyNamed(() => import('./components/Sprint25TrackerSubscriptionConsole'), 'Sprint25TrackerSubscriptionConsole');
const Sprint26ProviderSaaSConsole = lazyNamed(() => import('./components/Sprint26ProviderSaaSConsole'), 'Sprint26ProviderSaaSConsole');
const Sprint27CommerceConsole = lazyNamed(() => import('./components/Sprint27CommerceConsole'), 'Sprint27CommerceConsole');
const Sprint28AIConsole = lazyNamed(() => import('./components/Sprint28AIConsole'), 'Sprint28AIConsole');
const Sprint29OrchestrationConsole = lazyNamed(() => import('./components/Sprint29OrchestrationConsole'), 'Sprint29OrchestrationConsole');
const Sprint30CommandCenter = lazyNamed(() => import('./components/Sprint30CommandCenter'), 'Sprint30CommandCenter');
const Sprint31DeveloperPlatform = lazyNamed(() => import('./components/Sprint31DeveloperPlatform'), 'Sprint31DeveloperPlatform');
const Sprint32AnalyticsConsole = lazyNamed(() => import('./components/Sprint32AnalyticsConsole'), 'Sprint32AnalyticsConsole');
const Sprint33EngagementConsole = lazyNamed(() => import('./components/Sprint33EngagementConsole'), 'Sprint33EngagementConsole');
const Sprint34SecurityConsole = lazyNamed(() => import('./components/Sprint34SecurityConsole'), 'Sprint34SecurityConsole');
const Sprint35ResilienceConsole = lazyNamed(() => import('./components/Sprint35ResilienceConsole'), 'Sprint35ResilienceConsole');
const Sprint36CertificationConsole = lazyNamed(() => import('./components/Sprint36CertificationConsole'), 'Sprint36CertificationConsole');
const Sprint37ReadinessConsole = lazyNamed(() => import('./components/Sprint37ReadinessConsole'), 'Sprint37ReadinessConsole');
const Sprint38BackendFoundationConsole = lazyNamed(() => import('./components/Sprint38BackendFoundationConsole'), 'Sprint38BackendFoundationConsole');
const Sprint39MigrationWave2Console = lazyNamed(() => import('./components/Sprint39MigrationWave2Console'), 'Sprint39MigrationWave2Console');

const ModuleLoading = () => (
  <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-[#E4E9E5] bg-white">
    <div className="text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#D6E0DA] border-t-[#35634D]" />
      <p className="mt-3 text-sm font-semibold text-[#52645A]">Loading workspace…</p>
      <p className="mt-1 text-xs text-[#8B9690]">Operational modules load only when opened.</p>
    </div>
  </div>
);

export default function App() {
  const [activeModule, setActiveModule] = useState<TabType | null>(null);
  const seedPromiseRef = useRef<Promise<void> | null>(null);

  const ensureSeeded = useCallback(() => {
    if (!seedPromiseRef.current) {
      seedPromiseRef.current = import('./pet-os/seed/unified-seed').then(({ seedUnifiedPetOS }) => seedUnifiedPetOS());
    }
    return seedPromiseRef.current;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void ensureSeeded(); }, 250);
    return () => window.clearTimeout(timer);
  }, [ensureSeeded]);

  const openModule = (tab: TabType) => {
    void ensureSeeded().then(() => setActiveModule(tab));
  };

  const renderModule = (tab: TabType): React.ReactNode => {
    let content: React.ReactNode;
    switch (tab) {
      case 'sprint39': content = <Sprint39MigrationWave2Console />; break;
      case 'sprint38': content = <Sprint38BackendFoundationConsole />; break;
      case 'sprint37': content = <Sprint37ReadinessConsole />; break;
      case 'sprint36': content = <Sprint36CertificationConsole />; break;
      case 'sprint35': content = <Sprint35ResilienceConsole />; break;
      case 'sprint34': content = <Sprint34SecurityConsole />; break;
      case 'sprint33': content = <Sprint33EngagementConsole onOpenModule={setActiveModule} />; break;
      case 'sprint32': content = <Sprint32AnalyticsConsole onOpenModule={setActiveModule} />; break;
      case 'sprint31': content = <Sprint31DeveloperPlatform />; break;
      case 'sprint30': content = <Sprint30CommandCenter onOpenModule={setActiveModule} />; break;
      case 'sprint29': content = <Sprint29OrchestrationConsole />; break;
      case 'sprint28': content = <Sprint28AIConsole />; break;
      case 'sprint27': content = <Sprint27CommerceConsole />; break;
      case 'sprint26': content = <Sprint26ProviderSaaSConsole />; break;
      case 'sprint25': content = <Sprint25TrackerSubscriptionConsole />; break;
      case 'sprint24': content = <Sprint24SubscriptionConsole />; break;
      case 'sprint23': content = <Sprint23ReviewConsole />; break;
      case 'sprint22': content = <Sprint22TransportConsole />; break;
      case 'sprint21': content = <Sprint21CareConsole />; break;
      case 'sprint20': content = <Sprint20TrainerWorkspaceConsole />; break;
      case 'sprint19': content = <Sprint19VetWorkspaceConsole />; break;
      case 'sprint18': content = <Sprint18RescueConsole />; break;
      case 'sprint17': content = <Sprint17CrowdRecoveryConsole />; break;
      case 'sprint16': content = <Sprint16CommunityConsole />; break;
      case 'sprint15': content = <Sprint15RecoveryConsole />; break;
      case 'sprint14': content = <Sprint14TrackingConsole />; break;
      case 'sprint13': content = <Sprint13DogWalkingConsole />; break;
      case 'sprint12': content = <Sprint12FinanceConsole />; break;
      case 'sprint11': content = <Sprint11BookingConsole />; break;
      case 'sprint10': content = <Sprint10ProviderConsole />; break;
      case 'sprint9': content = <Sprint9ActivityConsole />; break;
      case 'sprint8': content = <Sprint8TrainingConsole />; break;
      case 'sprint7': content = <Sprint7NutritionConsole />; break;
      case 'sprint6': content = <Sprint6CareConsole />; break;
      case 'sprint5': content = <Sprint5HealthConsole />; break;
      case 'sprint4': content = <Sprint4Console />; break;
      case 'sprint3': content = <Sprint3PetCoreConsole />; break;
      case 'identity': content = <Sprint2IdentityConsole />; break;
      case 'kernel': content = <KernelPlayground />; break;
      case 'documentation': content = <DocumentationExplorer />; break;
      case 'adrs': content = <AdrCatalog />; break;
      case 'sprint2': content = <Sprint2Terminal />; break;
      case 'overview':
        content = (
          <Sprint1Overview
            onGoToSprint2={() => setActiveModule('identity')}
            onExploreKernel={() => setActiveModule('kernel')}
            onViewDocs={() => setActiveModule('documentation')}
          />
        );
        break;
      default:
        content = null;
    }
    return <Suspense fallback={<ModuleLoading />}>{content}</Suspense>;
  };

  return (
    <UnifiedPetOSExperience
      activeModule={activeModule}
      onOpenModule={openModule}
      onCloseModule={() => setActiveModule(null)}
      renderModule={renderModule}
    />
  );
}
