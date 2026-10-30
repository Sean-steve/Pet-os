import type { HouseholdId, UserId } from '../kernel/ids';

export type SecurityControlStatus='ENFORCED'|'MONITORED'|'PLANNED';
export type SecurityControlCategory='IDENTITY'|'ACCESS'|'DATA'|'INTEGRATIONS'|'AUDIT'|'PRIVACY'|'RESILIENCE';
export type SensitiveAction='CHANGE_PASSWORD'|'CHANGE_PRIMARY_EMAIL'|'EXPORT_PERSONAL_DATA'|'DELETE_ACCOUNT'|'ROTATE_API_CREDENTIAL'|'CHANGE_PAYOUT_DESTINATION'|'APPROVE_DEVELOPER_APP'|'ACCESS_RESTRICTED_HEALTH'|'EXPORT_EXACT_LOCATION';
export type PrivacyRequestType='ACCESS'|'EXPORT'|'CORRECT'|'DELETE'|'RESTRICT_PROCESSING';
export type PrivacyRequestStatus='OPEN'|'IN_REVIEW'|'FULFILLED'|'REJECTED'|'CANCELLED';
export type SecurityIncidentSeverity='LOW'|'MEDIUM'|'HIGH'|'CRITICAL';
export type SecurityIncidentStatus='OPEN'|'CONTAINED'|'RESOLVED';

export interface SecurityControl{
  controlId:string; category:SecurityControlCategory; label:string; status:SecurityControlStatus;
  implementation:string; evidence:string[]; productionBoundary?:string;
}
export interface SensitiveActionDecision{
  action:SensitiveAction; allowed:boolean; requiresRecentReauth:boolean; requiresMfa:boolean;
  maxReauthAgeMinutes:number; reasonCode:string;
}
export interface PrivacyRequest{
  requestId:string; requesterUserId:UserId; householdId?:HouseholdId; type:PrivacyRequestType;
  status:PrivacyRequestStatus; requestedAt:string; dueAt:string; fulfilledAt?:string; note?:string;
}
export interface RetentionRule{
  dataClass:string; retentionDays:number|null; basis:string; deleteOnAccountClosure:boolean; notes:string;
}
export interface SecurityIncident{
  incidentId:string; title:string; severity:SecurityIncidentSeverity; status:SecurityIncidentStatus;
  openedAt:string; containedAt?:string; resolvedAt?:string; affectedDataClasses:string[];
  evidencePreserved:boolean; notificationAssessmentRequired:boolean;
}
export interface ComplianceEvidence{
  evidenceId:string; controlFamily:string; title:string; source:string; status:'READY'|'PARTIAL';
  lastVerifiedAt:string;
}
export interface SecurityPostureSnapshot{
  generatedAt:string; controls:SecurityControl[]; enforced:number; monitored:number; planned:number;
  privacyRequests:PrivacyRequest[]; incidents:SecurityIncident[]; retention:RetentionRule[];
  complianceEvidence:ComplianceEvidence[]; productionDisclaimers:string[];
}
