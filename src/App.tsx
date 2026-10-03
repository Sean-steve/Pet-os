import React, { useEffect, useState } from 'react';
import type { TabType } from './components/Header';
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
import { Sprint28AIConsole } from './components/Sprint28AIConsole';

export default function App() {
  const [activeModule, setActiveModule] = useState<TabType | null>(null);

  useEffect(() => {
    seedUnifiedPetOS();
  }, []);

  const renderModule = (tab: TabType): React.ReactNode => {
    switch (tab) {
      case 'sprint28': return <Sprint28AIConsole />;
      case 'sprint27': return <Sprint27CommerceConsole />;
      case 'sprint26': return <Sprint26ProviderSaaSConsole />;
      case 'sprint25': return <Sprint25TrackerSubscriptionConsole />;
      case 'sprint24': return <Sprint24SubscriptionConsole />;
      case 'sprint23': return <Sprint23ReviewConsole />;
      case 'sprint22': return <Sprint22TransportConsole />;
      case 'sprint21': return <Sprint21CareConsole />;
      case 'sprint20': return <Sprint20TrainerWorkspaceConsole />;
      case 'sprint19': return <Sprint19VetWorkspaceConsole />;
      case 'sprint18': return <Sprint18RescueConsole />;
      case 'sprint17': return <Sprint17CrowdRecoveryConsole />;
      case 'sprint16': return <Sprint16CommunityConsole />;
      case 'sprint15': return <Sprint15RecoveryConsole />;
      case 'sprint14': return <Sprint14TrackingConsole />;
      case 'sprint13': return <Sprint13DogWalkingConsole />;
      case 'sprint12': return <Sprint12FinanceConsole />;
      case 'sprint11': return <Sprint11BookingConsole />;
      case 'sprint10': return <Sprint10ProviderConsole />;
      case 'sprint9': return <Sprint9ActivityConsole />;
      case 'sprint8': return <Sprint8TrainingConsole />;
      case 'sprint7': return <Sprint7NutritionConsole />;
      case 'sprint6': return <Sprint6CareConsole />;
      case 'sprint5': return <Sprint5HealthConsole />;
      case 'sprint4': return <Sprint4Console />;
      case 'sprint3': return <Sprint3PetCoreConsole />;
      case 'identity': return <Sprint2IdentityConsole />;
      case 'kernel': return <KernelPlayground />;
      case 'documentation': return <DocumentationExplorer />;
      case 'adrs': return <AdrCatalog />;
      case 'sprint2': return <Sprint2Terminal />;
      case 'overview':
        return (
          <Sprint1Overview
            onGoToSprint2={() => setActiveModule('identity')}
            onExploreKernel={() => setActiveModule('kernel')}
            onViewDocs={() => setActiveModule('documentation')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <UnifiedPetOSExperience
      activeModule={activeModule}
      onOpenModule={setActiveModule}
      onCloseModule={() => setActiveModule(null)}
      renderModule={renderModule}
    />
  );
}
