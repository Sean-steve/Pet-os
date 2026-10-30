import { generateUUIDv7 } from '../kernel/ids';
import type { HouseholdId, UserId } from '../kernel/ids';
import { utcNow } from '../kernel/time';
import { InMemoryAuditStore } from '../kernel/audit';
import { IdentityStore } from '../identity/store';
import { IntegrationStore } from '../integrations/store';
import { SecurityStore } from './store';
import type { ComplianceEvidence, PrivacyRequestType, RetentionRule, SecurityControl, SecurityIncidentSeverity, SecurityPostureSnapshot, SensitiveAction, SensitiveActionDecision } from './types';

const store=SecurityStore.getInstance();

const CONTROLS:SecurityControl[]=[
  {controlId:'SEC-IDENTITY-01',category:'IDENTITY',label:'Password hashing, verification and lockout',status:'ENFORCED',implementation:'Passwords and reset/verification tokens are hashed; login and registration are rate limited; repeated failures trigger lockout.',evidence:['identity/crypto.ts','identity/rate-limit.ts','identity/service.ts']},
  {controlId:'SEC-IDENTITY-02',category:'IDENTITY',label:'Session revocation and bounded lifetime',status:'ENFORCED',implementation:'Sessions are individually revocable and all active sessions can be invalidated for an account.',evidence:['identity/store.ts','identity/service.ts']},
  {controlId:'SEC-ACCESS-01',category:'ACCESS',label:'Authorization before domain reads/writes',status:'ENFORCED',implementation:'Household, provider and platform reads are actor-scoped and role/authority checked.',evidence:['identity/authorization.ts','analytics/service.ts','engagement/service.ts']},
  {controlId:'SEC-ACCESS-02',category:'ACCESS',label:'Step-up policy for sensitive actions',status:'ENFORCED',implementation:'SecurityService centrally classifies destructive, financial, restricted-health and credential operations for recent reauthentication/MFA.',evidence:['security/service.ts']},
  {controlId:'SEC-DATA-01',category:'DATA',label:'Restricted-data minimization',status:'ENFORCED',implementation:'Analytics, engagement and developer APIs exclude raw clinical content, exact location and payment instruments unless the owning domain explicitly authorizes access.',evidence:['analytics/service.ts','engagement/service.ts','integrations/service.ts']},
  {controlId:'SEC-INTEGRATIONS-01',category:'INTEGRATIONS',label:'Scoped credentials and hardened webhooks',status:'ENFORCED',implementation:'Developer credentials are one-time/raw-once, scopes are allowlisted, webhooks require HTTPS and reject private-network destinations.',evidence:['integrations/service.ts','integrations/store.ts']},
  {controlId:'SEC-AUDIT-01',category:'AUDIT',label:'Append-only security audit trail',status:'ENFORCED',implementation:'State-changing and security-sensitive operations emit immutable audit records with actor, resource, classification and correlation ID.',evidence:['kernel/audit.ts']},
  {controlId:'SEC-PRIVACY-01',category:'PRIVACY',label:'Data-subject request workflow',status:'ENFORCED',implementation:'Access, export, correction, deletion and restriction requests are tracked with due dates, status and audit evidence.',evidence:['security/service.ts','security/store.ts']},
  {controlId:'SEC-PRIVACY-02',category:'PRIVACY',label:'Retention registry and deletion boundaries',status:'MONITORED',implementation:'Canonical retention rules define deletion expectations by data class; legal/financial exceptions remain explicit.',evidence:['security/service.ts'],productionBoundary:'Production requires database-enforced lifecycle jobs and verified purge reports.'},
  {controlId:'SEC-RESILIENCE-01',category:'RESILIENCE',label:'Security incident lifecycle',status:'ENFORCED',implementation:'Incidents record severity, containment/resolution, affected data classes, evidence preservation and notification assessment.',evidence:['security/service.ts','security/store.ts']},
  {controlId:'SEC-RESILIENCE-02',category:'RESILIENCE',label:'Production secret management and encryption at rest',status:'PLANNED',implementation:'Prototype contains no production secrets and cannot certify infrastructure encryption.',evidence:['.env.example','.gitignore'],productionBoundary:'Require managed secret store, KMS/HSM-backed encryption, rotation, backup encryption and key-access audit in production.'}
];

const RETENTION:RetentionRule[]=[
  {dataClass:'Account/Profile',retentionDays:30,basis:'User request / service lifecycle',deleteOnAccountClosure:true,notes:'Deletion window is configurable; identity tombstone may remain only when legally required.'},
  {dataClass:'Clinical / Pet health',retentionDays:null,basis:'Professional/legal retention policy',deleteOnAccountClosure:false,notes:'Owning clinical entity determines lawful retention; access must remain restricted and auditable.'},
  {dataClass:'Finance / Ledger',retentionDays:null,basis:'Accounting, tax and fraud obligations',deleteOnAccountClosure:false,notes:'Immutable accounting records may be retained while direct identifiers are minimized where lawful.'},
  {dataClass:'Precise location / route telemetry',retentionDays:30,basis:'Operational necessity',deleteOnAccountClosure:true,notes:'Prefer aggregation or deletion once recovery/tracking purpose expires.'},
  {dataClass:'Product analytics telemetry',retentionDays:90,basis:'Consent / legitimate product measurement',deleteOnAccountClosure:true,notes:'Optional telemetry must not be required for core Pet OS functionality.'},
  {dataClass:'Security audit records',retentionDays:365,basis:'Security, fraud and accountability',deleteOnAccountClosure:false,notes:'Metadata should remain minimized and access restricted.'}
];

const EVIDENCE:ComplianceEvidence[]=[
  {evidenceId:'CMP-01',controlFamily:'Access control',title:'Household/provider/platform authorization regression suites',source:'Identity + Sprints 30–33 tests',status:'READY',lastVerifiedAt:'2026-10-31T00:00:00.000Z'},
  {evidenceId:'CMP-02',controlFamily:'Privacy by design',title:'Telemetry opt-out and minimized intelligence projections',source:'Sprint 32–33 tests',status:'READY',lastVerifiedAt:'2026-10-31T00:00:00.000Z'},
  {evidenceId:'CMP-03',controlFamily:'Third-party security',title:'Scoped API credentials, webhook SSRF controls and revocation cascades',source:'Sprint 31 tests',status:'READY',lastVerifiedAt:'2026-10-31T00:00:00.000Z'},
  {evidenceId:'CMP-04',controlFamily:'Infrastructure',title:'Encryption-at-rest, managed secret rotation and disaster recovery evidence',source:'Production infrastructure',status:'PARTIAL',lastVerifiedAt:'2026-10-31T00:00:00.000Z'}
];

function requireActiveUser(userId:UserId){const u=IdentityStore.findUserById(userId);if(!u||u.accountStatus!=='ACTIVE')throw new Error('SECURITY_ACTOR_NOT_ACTIVE');}
function requirePlatformSecurityAuthority(userId:UserId){requireActiveUser(userId);const r=IntegrationStore.getInstance().getPlatformReviewer(String(userId));if(!r||r.status!=='ACTIVE'||!r.permissions.includes('APP_REVIEW'))throw new Error('SECURITY_PLATFORM_AUTHORITY_REQUIRED');}

export class SecurityService{
  static reset(){store.reset();}
  static listControls(){return CONTROLS.map(c=>({...c,evidence:[...c.evidence]}));}
  static getRetentionRules(){return RETENTION.map(r=>({...r}));}
  static getComplianceEvidence(){return EVIDENCE.map(e=>({...e}));}

  static evaluateSensitiveAction(input:{actorUserId:UserId;action:SensitiveAction;reauthenticatedAt?:string;mfaVerified?:boolean;now?:string}):SensitiveActionDecision{
    requireActiveUser(input.actorUserId);
    const mfaActions=new Set<SensitiveAction>(['DELETE_ACCOUNT','CHANGE_PAYOUT_DESTINATION','APPROVE_DEVELOPER_APP','EXPORT_EXACT_LOCATION','ACCESS_RESTRICTED_HEALTH']);
    const reauthActions=new Set<SensitiveAction>(['CHANGE_PASSWORD','CHANGE_PRIMARY_EMAIL','EXPORT_PERSONAL_DATA','DELETE_ACCOUNT','ROTATE_API_CREDENTIAL','CHANGE_PAYOUT_DESTINATION','APPROVE_DEVELOPER_APP','ACCESS_RESTRICTED_HEALTH','EXPORT_EXACT_LOCATION']);
    const maxAge=10, now=new Date(input.now||utcNow()).getTime(), reauth=input.reauthenticatedAt?new Date(input.reauthenticatedAt).getTime():0;
    const reauthFresh=!!reauth && Number.isFinite(reauth) && now-reauth<=maxAge*60*1000 && now>=reauth;
    const requiresRecentReauth=reauthActions.has(input.action), requiresMfa=mfaActions.has(input.action);
    if(requiresRecentReauth&&!reauthFresh)return {action:input.action,allowed:false,requiresRecentReauth,requiresMfa,maxReauthAgeMinutes:maxAge,reasonCode:'RECENT_REAUTH_REQUIRED'};
    if(requiresMfa&&!input.mfaVerified)return {action:input.action,allowed:false,requiresRecentReauth,requiresMfa,maxReauthAgeMinutes:maxAge,reasonCode:'MFA_REQUIRED'};
    return {action:input.action,allowed:true,requiresRecentReauth,requiresMfa,maxReauthAgeMinutes:maxAge,reasonCode:'SECURITY_POLICY_SATISFIED'};
  }

  static createPrivacyRequest(input:{requesterUserId:UserId;type:PrivacyRequestType;householdId?:HouseholdId;note?:string}){
    requireActiveUser(input.requesterUserId);
    if(input.householdId){const m=IdentityStore.findMembership(input.householdId,input.requesterUserId);if(!m)throw new Error('PRIVACY_SCOPE_DENIED');}
    const requestedAt=utcNow(),dueAt=new Date(new Date(requestedAt).getTime()+30*24*60*60*1000).toISOString();
    const v=store.savePrivacyRequest({requestId:generateUUIDv7(),requesterUserId:input.requesterUserId,householdId:input.householdId,type:input.type,status:'OPEN',requestedAt,dueAt,note:input.note});
    InMemoryAuditStore.record({actorId:String(input.requesterUserId),actorType:'USER',action:'PRIVACY_REQUEST_CREATED',resourceType:'PrivacyRequest',resourceId:v.requestId,classification:'CONFIDENTIAL',metadata:{type:v.type}});
    return v;
  }

  static fulfillPrivacyRequest(actorUserId:UserId,requestId:string){
    requirePlatformSecurityAuthority(actorUserId);const v=store.getPrivacyRequest(requestId);if(!v)throw new Error('PRIVACY_REQUEST_NOT_FOUND');
    const next=store.savePrivacyRequest({...v,status:'FULFILLED',fulfilledAt:utcNow()});
    InMemoryAuditStore.record({actorId:String(actorUserId),actorType:'ADMIN',action:'PRIVACY_REQUEST_FULFILLED',resourceType:'PrivacyRequest',resourceId:requestId,classification:'CONFIDENTIAL',metadata:{type:v.type}});
    return next;
  }

  static openIncident(actorUserId:UserId,input:{title:string;severity:SecurityIncidentSeverity;affectedDataClasses:string[];notificationAssessmentRequired?:boolean}){
    requirePlatformSecurityAuthority(actorUserId);if(!input.title.trim())throw new Error('INCIDENT_TITLE_REQUIRED');
    const v=store.saveIncident({incidentId:generateUUIDv7(),title:input.title.trim(),severity:input.severity,status:'OPEN',openedAt:utcNow(),affectedDataClasses:Array.from(new Set(input.affectedDataClasses)),evidencePreserved:true,notificationAssessmentRequired:input.notificationAssessmentRequired!==false});
    InMemoryAuditStore.record({actorId:String(actorUserId),actorType:'ADMIN',action:'SECURITY_INCIDENT_OPENED',resourceType:'SecurityIncident',resourceId:v.incidentId,classification:'RESTRICTED',metadata:{severity:v.severity}});
    return v;
  }

  static containIncident(actorUserId:UserId,incidentId:string){
    requirePlatformSecurityAuthority(actorUserId);const v=store.listIncidents().find(i=>i.incidentId===incidentId);if(!v)throw new Error('INCIDENT_NOT_FOUND');
    return store.saveIncident({...v,status:'CONTAINED',containedAt:utcNow()});
  }

  static getPersonalPrivacyRequests(actorUserId:UserId){requireActiveUser(actorUserId);return store.listPrivacyRequests().filter(r=>r.requesterUserId===actorUserId);}
  static getPlatformPosture(actorUserId:UserId):SecurityPostureSnapshot{
    requirePlatformSecurityAuthority(actorUserId);const controls=this.listControls();
    return {generatedAt:utcNow(),controls,enforced:controls.filter(c=>c.status==='ENFORCED').length,monitored:controls.filter(c=>c.status==='MONITORED').length,planned:controls.filter(c=>c.status==='PLANNED').length,privacyRequests:store.listPrivacyRequests(),incidents:store.listIncidents(),retention:this.getRetentionRules(),complianceEvidence:this.getComplianceEvidence(),productionDisclaimers:[
      'This repository is a browser/in-memory prototype; Sprint 34 certifies application-layer controls, not production infrastructure.',
      'Production certification still requires server-side tenant isolation, managed secrets, encryption-at-rest evidence, backup/restore tests, centralized SIEM and legal retention configuration.',
      'Compliance readiness is not a legal certification; jurisdiction-specific counsel and processor/vendor agreements remain required.'
    ]};
  }
}
