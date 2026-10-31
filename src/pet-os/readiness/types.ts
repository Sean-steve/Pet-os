export type ReadinessStatus = 'CLOSED_IN_REPO' | 'EXTERNAL_REQUIRED' | 'BLOCKED';
export type ReadinessVerdict = 'CODEBASE_READY_FOR_BACKEND_MIGRATION' | 'BLOCKED';

export type ReadinessCategory =
  | 'CODE_QUALITY'
  | 'VALIDATION'
  | 'PERSISTENCE'
  | 'IDENTITY_SECURITY'
  | 'INTEGRATIONS'
  | 'PLATFORM_RUNTIME'
  | 'OBSERVABILITY'
  | 'QUALITY_ASSURANCE'
  | 'DISASTER_RECOVERY';

export interface ProductionReadinessItem {
  id: string;
  category: ReadinessCategory;
  title: string;
  status: ReadinessStatus;
  evidence: string[];
  ownerBoundary: 'REPOSITORY' | 'PRODUCTION_PLATFORM';
}

export interface BackendMigrationBoundary {
  domain: string;
  currentSource: string;
  productionTarget: string;
  migrationRule: string;
}

export interface ProductionReadinessReport {
  generatedAt: string;
  verdict: ReadinessVerdict;
  productionReady: false;
  closedInRepo: number;
  externalRequired: number;
  blocked: number;
  items: ProductionReadinessItem[];
  migrationBoundaries: BackendMigrationBoundary[];
  releaseGates: {
    repositoryClosureComplete: boolean;
    noHiddenRepositoryBlockers: boolean;
    productionBlockersExplicit: boolean;
    migrationBoundariesExplicit: boolean;
  };
}
