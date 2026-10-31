export type CertificationStatus='PASS'|'FAIL'|'WARN';
export type CertificationVerdict='CERTIFIED_PROTOTYPE'|'BLOCKED';

export interface RoleSurfaceCertification{
  roleId:'PET_PARENT'|'PROFESSIONAL'|'PROVIDER_BUSINESS'|'RESCUE_WELFARE'|'SELLER_COMMERCE'|'FINANCE_BILLING'|'TRUST_OPERATIONS'|'AI_INTELLIGENCE'|'PLATFORM_ENGINEERING';
  label:string;
  actor:string;
  requiredDomains:string[];
  status:CertificationStatus;
  notes:string[];
}

export interface JourneyCertification{
  journeyId:string;
  title:string;
  roles:string[];
  domains:string[];
  status:CertificationStatus;
  evidence:string[];
  failure?:string;
}

export interface FullSystemCertificationReport{
  generatedAt:string;
  verdict:CertificationVerdict;
  passed:number;
  failed:number;
  warned:number;
  roleCoverage:RoleSurfaceCertification[];
  journeys:JourneyCertification[];
  releaseGates:{
    crossTenantIsolation:boolean;
    canonicalFinanceContinuity:boolean;
    privilegedControlPlane:boolean;
    allNineWorkspacesCovered:boolean;
    noCriticalJourneyFailures:boolean;
  };
  productionBoundaries:string[];
}
