
import { generateUUIDv7, HouseholdId, UserId } from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { BookingStore } from '../booking/store';
import { TrackingStore } from '../tracking/store';
import { CommandCenterService } from '../command-center/service';
import { CryptoUtils } from '../identity/crypto';
import { IntegrationStore } from './store';
import {
  ApiCredential,
  ApiCredentialId,
  ApiEndpointDefinition,
  AuthenticatedIntegration,
  BookingProjection,
  CareProjection,
  CommandCenterProjection,
  DeveloperApp,
  DeveloperAppId,
  IntegrationAuditEvent,
  IntegrationAuditEventId,
  IntegrationInstallation,
  IntegrationInstallationId,
  IntegrationScope,
  PetProfileProjection,
  PublicIntegrationEvent,
  PublicIntegrationEventType,
  TrackerHealthProjection,
  WebhookDelivery,
  WebhookDeliveryId,
  WebhookSubscription,
  WebhookSubscriptionId,
  WebhookTransport,
} from './types';

const store = IntegrationStore.getInstance();

export const SUPPORTED_INTEGRATION_SCOPES: IntegrationScope[] = [
  'pet:profile:read',
  'care:read',
  'booking:read',
  'tracker:health:read',
  'command-center:read',
  'webhook:manage',
];

export const PUBLIC_INTEGRATION_EVENTS: PublicIntegrationEventType[] = [
  'pet.profile.updated',
  'care.status.changed',
  'booking.status.changed',
  'tracker.health.changed',
  'command-center.attention.changed',
];

const API_CATALOG: ApiEndpointDefinition[] = [
  { method:'GET', path:'/v1/pets', requiredScope:'pet:profile:read', description:'Minimized household Pet profiles.', sensitiveFieldsExcluded:['owner contact details','microchip number','documents','clinical records'] },
  { method:'GET', path:'/v1/care', requiredScope:'care:read', description:'Household care obligations and due status.', sensitiveFieldsExcluded:['clinical notes','private document attachments'] },
  { method:'GET', path:'/v1/bookings', requiredScope:'booking:read', description:'Service booking status and schedule.', sensitiveFieldsExcluded:['home access secrets','phone numbers','private instructions'] },
  { method:'GET', path:'/v1/tracker-health', requiredScope:'tracker:health:read', description:'Tracker connectivity and battery health.', sensitiveFieldsExcluded:['latitude','longitude','route history','IMEI/external device reference'] },
  { method:'GET', path:'/v1/command-center', requiredScope:'command-center:read', description:'Aggregate household operational counts.', sensitiveFieldsExcluded:['item-level clinical content','precise location','financial details'] },
];

function nowIso(): string { return new Date().toISOString(); }

function asAppId(v:string):DeveloperAppId{return v as DeveloperAppId;}
function asInstallationId(v:string):IntegrationInstallationId{return v as IntegrationInstallationId;}
function asCredentialId(v:string):ApiCredentialId{return v as ApiCredentialId;}
function asWebhookId(v:string):WebhookSubscriptionId{return v as WebhookSubscriptionId;}
function asDeliveryId(v:string):WebhookDeliveryId{return v as WebhookDeliveryId;}
function asAuditId(v:string):IntegrationAuditEventId{return v as IntegrationAuditEventId;}

function uniqueScopes(scopes: readonly string[]): IntegrationScope[] {
  const unique = Array.from(new Set(scopes));
  for (const scope of unique) {
    if (!SUPPORTED_INTEGRATION_SCOPES.includes(scope as IntegrationScope)) {
      throw new Error('INTEGRATION_SCOPE_NOT_SUPPORTED: ' + scope);
    }
  }
  return unique as IntegrationScope[];
}

function requireActiveUser(userId:UserId):void{
  const user=IdentityStore.findUserById(userId);
  if(!user||user.accountStatus!=='ACTIVE')throw new Error('INTEGRATION_ACTOR_NOT_ACTIVE');
}

function requireHouseholdInstaller(userId:UserId,householdId:HouseholdId):void{
  requireActiveUser(userId);
  const membership=IdentityStore.findMembership(householdId,userId);
  if(!membership||!['HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN'].includes(membership.role)){
    throw new Error('INTEGRATION_INSTALL_REQUIRES_OWNER_OR_ADMIN');
  }
}

function requirePlatformReviewer(userId:UserId):void{
  requireActiveUser(userId);
  const reviewer=store.getPlatformReviewer(String(userId));
  if(!reviewer||reviewer.status!=='ACTIVE'||!reviewer.permissions.includes('APP_REVIEW')){
    throw new Error('INTEGRATION_PLATFORM_REVIEWER_REQUIRED');
  }
}

function assertSafeWebhookEndpoint(raw:string):string{
  let url:URL;
  try{url=new URL(raw);}catch{throw new Error('WEBHOOK_ENDPOINT_INVALID');}
  if(url.protocol!=='https:')throw new Error('WEBHOOK_HTTPS_REQUIRED');
  if(url.username||url.password)throw new Error('WEBHOOK_URL_CREDENTIALS_FORBIDDEN');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.local')||host==='::1'||host==='0.0.0.0'||host.startsWith('127.')||host.startsWith('10.')||host.startsWith('192.168.')){
    throw new Error('WEBHOOK_PRIVATE_NETWORK_FORBIDDEN');
  }
  const m=host.match(/^172\.(\d+)\./);
  if(m&&Number(m[1])>=16&&Number(m[1])<=31)throw new Error('WEBHOOK_PRIVATE_NETWORK_FORBIDDEN');
  return url.toString();
}

async function subtle():Promise<SubtleCrypto>{
  if(globalThis.crypto?.subtle)return globalThis.crypto.subtle;
  const nodeCrypto=await import('crypto');
  return nodeCrypto.webcrypto.subtle as unknown as SubtleCrypto;
}

async function hmac(secret:string,body:string):Promise<string>{
  const s=await subtle();
  const key=await s.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await s.sign('HMAC',key,new TextEncoder().encode(body));
  return 'sha256='+Array.from(new Uint8Array(signed)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function sanitizeEventData(eventType:PublicIntegrationEventType,raw:Record<string,unknown>):Record<string,unknown>{
  const allow:Record<PublicIntegrationEventType,string[]>={
    'pet.profile.updated':['petId','name','species','breed','lifecycleStage','status'],
    'care.status.changed':['careObligationId','petId','title','category','dueAt','status','priority'],
    'booking.status.changed':['bookingId','petIds','serviceTitle','status','startAt','endAt','timezone'],
    'tracker.health.changed':['deviceId','petId','displayName','provider','model','connectivityStatus','batteryStatus','batteryPercent','lastSeenAt'],
    'command-center.attention.changed':['pets','dueToday','overdueCare','upcomingBookings','unreadNotifications','onlineTrackers','actionInbox','ordersInProgress'],
  };
  const out:Record<string,unknown>={};
  for(const key of allow[eventType])if(raw[key]!==undefined)out[key]=raw[key];
  return out;
}

export class IntegrationService {
  private static webhookSecretVault=new Map<WebhookSubscriptionId,string>();
  private static requestWindows=new Map<ApiCredentialId,number[]>();

  static resetRuntime():void{
    this.webhookSecretVault.clear();
    this.requestWindows.clear();
  }

  private static audit(input:Omit<IntegrationAuditEvent,'integrationAuditEventId'|'createdAt'>):void{
    store.saveAudit({
      ...input,
      integrationAuditEventId:asAuditId('ia-'+generateUUIDv7()),
      createdAt:nowIso(),
    });
  }

  static getApiCatalog():ApiEndpointDefinition[]{return API_CATALOG.map(v=>({...v,sensitiveFieldsExcluded:[...v.sensitiveFieldsExcluded]}));}

  static async verifyWebhookSignature(signingSecret:string,body:string,signature:string):Promise<boolean>{
    const expected=await hmac(signingSecret,body);
    return CryptoUtils.constantTimeCompare(expected,signature);
  }

  static createDeveloperApp(actorUserId:UserId,input:{name:string;description:string;requestedScopes:IntegrationScope[];redirectUris?:string[];privacyPolicyUrl?:string;termsUrl?:string}):DeveloperApp{
    requireActiveUser(actorUserId);
    const scopes=uniqueScopes(input.requestedScopes);
    if(!input.name.trim())throw new Error('DEVELOPER_APP_NAME_REQUIRED');
    const now=nowIso();
    const app:DeveloperApp={
      developerAppId:asAppId('dapp-'+generateUUIDv7()),
      name:input.name.trim(),
      description:input.description.trim(),
      ownerUserId:actorUserId,
      appType:'THIRD_PARTY',
      status:'DRAFT',
      requestedScopes:scopes,
      approvedScopes:[],
      redirectUris:[...(input.redirectUris||[])],
      privacyPolicyUrl:input.privacyPolicyUrl,
      termsUrl:input.termsUrl,
      createdAt:now,
      updatedAt:now,
    };
    store.saveApp(app);
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'DEVELOPER_APP_CREATED',developerAppId:app.developerAppId,resourceType:'DeveloperApp',resourceId:String(app.developerAppId),outcome:'SUCCESS'});
    return app;
  }

  static activateApprovedAppForPlatform(input:{developerAppId:DeveloperAppId;reviewerUserId:UserId;approvedScopes:IntegrationScope[]}):DeveloperApp{
    requirePlatformReviewer(input.reviewerUserId);
    const app=store.getApp(input.developerAppId);
    if(!app)throw new Error('DEVELOPER_APP_NOT_FOUND');
    if(app.ownerUserId===input.reviewerUserId&&app.appType==='THIRD_PARTY')throw new Error('DEVELOPER_APP_SELF_APPROVAL_FORBIDDEN');
    const approved=uniqueScopes(input.approvedScopes);
    if(approved.some(s=>!app.requestedScopes.includes(s)))throw new Error('APPROVED_SCOPE_NOT_REQUESTED');
    const now=nowIso();
    const updated:{[K in keyof DeveloperApp]:DeveloperApp[K]}={...app,status:'ACTIVE',approvedScopes:approved,reviewedAt:now,reviewedBy:input.reviewerUserId,updatedAt:now};
    store.saveApp(updated);
    this.audit({actorType:'USER',actorId:String(input.reviewerUserId),action:'DEVELOPER_APP_APPROVED',developerAppId:app.developerAppId,resourceType:'DeveloperApp',resourceId:String(app.developerAppId),outcome:'SUCCESS'});
    return updated;
  }

  static installApp(actorUserId:UserId,householdId:HouseholdId,developerAppId:DeveloperAppId,requestedScopes:IntegrationScope[]):IntegrationInstallation{
    requireHouseholdInstaller(actorUserId,householdId);
    const app=store.getApp(developerAppId);
    if(!app||app.status!=='ACTIVE')throw new Error('DEVELOPER_APP_NOT_ACTIVE');
    const scopes=uniqueScopes(requestedScopes);
    if(scopes.some(s=>!app.approvedScopes.includes(s)))throw new Error('INSTALL_SCOPE_NOT_APPROVED');
    const existing=store.listInstallationsForApp(developerAppId).find(i=>i.householdId===householdId&&i.status==='ACTIVE');
    if(existing)return existing;
    const now=nowIso();
    const installation:IntegrationInstallation={
      installationId:asInstallationId('inst-'+generateUUIDv7()),
      developerAppId,
      householdId,
      authorizedByUserId:actorUserId,
      grantedScopes:scopes,
      status:'ACTIVE',
      consentVersion:'SPRINT31-1.0',
      installedAt:now,
      updatedAt:now,
    };
    store.saveInstallation(installation);
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'APP_INSTALLED',developerAppId,installationId:installation.installationId,householdId,resourceType:'IntegrationInstallation',resourceId:String(installation.installationId),outcome:'SUCCESS'});
    return installation;
  }

  static async createCredential(actorUserId:UserId,installationId:IntegrationInstallationId,rateLimitPerMinute=60):Promise<{credential:ApiCredential;rawToken:string}>{
    const installation=store.getInstallation(installationId);
    if(!installation||installation.status!=='ACTIVE')throw new Error('INSTALLATION_NOT_ACTIVE');
    requireHouseholdInstaller(actorUserId,installation.householdId);
    const app=store.getApp(installation.developerAppId);
    if(!app||app.status!=='ACTIVE')throw new Error('DEVELOPER_APP_NOT_ACTIVE');
    const prefix=CryptoUtils.generateSecureToken(6);
    const secret=CryptoUtils.generateSecureToken(32);
    const rawToken='petos_live.'+prefix+'.'+secret;
    const hash=await CryptoUtils.hashToken(rawToken);
    const now=nowIso();
    const credential:ApiCredential={
      credentialId:asCredentialId('cred-'+generateUUIDv7()),
      developerAppId:installation.developerAppId,
      installationId,
      tokenPrefix:prefix,
      tokenHash:hash,
      status:'ACTIVE',
      scopes:[...installation.grantedScopes],
      rateLimitPerMinute:Math.max(1,Math.min(rateLimitPerMinute,600)),
      createdAt:now,
      expiresAt:new Date(Date.now()+90*24*60*60*1000).toISOString(),
    };
    store.saveCredential(credential);
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'API_CREDENTIAL_CREATED',developerAppId:credential.developerAppId,installationId,householdId:installation.householdId,resourceType:'ApiCredential',resourceId:String(credential.credentialId),outcome:'SUCCESS'});
    return {credential,rawToken};
  }

  static async authenticate(rawToken:string):Promise<AuthenticatedIntegration>{
    const parts=rawToken.split('.');
    if(parts.length!==3||parts[0]!=='petos_live')throw new Error('API_CREDENTIAL_INVALID');
    const credential=store.findCredentialByPrefix(parts[1]);
    if(!credential)throw new Error('API_CREDENTIAL_INVALID');
    const hash=await CryptoUtils.hashToken(rawToken);
    if(!CryptoUtils.constantTimeCompare(hash,credential.tokenHash))throw new Error('API_CREDENTIAL_INVALID');
    if(credential.status!=='ACTIVE')throw new Error('API_CREDENTIAL_NOT_ACTIVE');
    if(new Date(credential.expiresAt).getTime()<=Date.now())throw new Error('API_CREDENTIAL_EXPIRED');
    const installation=store.getInstallation(credential.installationId);
    if(!installation||installation.status!=='ACTIVE')throw new Error('INSTALLATION_NOT_ACTIVE');
    const app=store.getApp(credential.developerAppId);
    if(!app||app.status!=='ACTIVE')throw new Error('DEVELOPER_APP_NOT_ACTIVE');
    credential.lastUsedAt=nowIso();
    store.saveCredential(credential);
    return {
      credentialId:credential.credentialId,
      developerAppId:credential.developerAppId,
      installationId:credential.installationId,
      householdId:installation.householdId,
      scopes:[...credential.scopes],
    };
  }

  private static authorizeApi(auth:AuthenticatedIntegration,scope:IntegrationScope,householdId:HouseholdId,resourceType:string):IntegrationInstallation{
    const installation=store.getInstallation(auth.installationId);
    if(!installation||installation.status!=='ACTIVE'||installation.householdId!==householdId||auth.householdId!==householdId){
      this.audit({actorType:'API_CLIENT',actorId:String(auth.credentialId),action:'API_REQUEST',developerAppId:auth.developerAppId,installationId:auth.installationId,householdId,resourceType,outcome:'DENIED',reason:'HOUSEHOLD_OR_INSTALLATION_MISMATCH'});
      throw new Error('API_HOUSEHOLD_ACCESS_DENIED');
    }
    const app=store.getApp(auth.developerAppId);
    const credential=store.getCredential(auth.credentialId);
    if(!app||app.status!=='ACTIVE'||!credential||credential.status!=='ACTIVE')throw new Error('API_CLIENT_NOT_ACTIVE');
    if(!installation.grantedScopes.includes(scope)||!credential.scopes.includes(scope)||!auth.scopes.includes(scope)){
      this.audit({actorType:'API_CLIENT',actorId:String(auth.credentialId),action:'API_REQUEST',developerAppId:auth.developerAppId,installationId:auth.installationId,householdId,resourceType,outcome:'DENIED',reason:'SCOPE_MISSING:'+scope});
      throw new Error('API_SCOPE_REQUIRED: '+scope);
    }
    const now=Date.now();
    const cutoff=now-60000;
    const history=(this.requestWindows.get(auth.credentialId)||[]).filter(ts=>ts>cutoff);
    if(history.length>=credential.rateLimitPerMinute){
      this.requestWindows.set(auth.credentialId,history);
      this.audit({actorType:'API_CLIENT',actorId:String(auth.credentialId),action:'API_REQUEST',developerAppId:auth.developerAppId,installationId:auth.installationId,householdId,resourceType,outcome:'DENIED',reason:'RATE_LIMIT'});
      throw new Error('API_RATE_LIMITED');
    }
    history.push(now);this.requestWindows.set(auth.credentialId,history);
    this.audit({actorType:'API_CLIENT',actorId:String(auth.credentialId),action:'API_REQUEST',developerAppId:auth.developerAppId,installationId:auth.installationId,householdId,resourceType,outcome:'ALLOWED'});
    return installation;
  }

  static readPetProfiles(auth:AuthenticatedIntegration,householdId:HouseholdId):PetProfileProjection[]{
    this.authorizeApi(auth,'pet:profile:read',householdId,'PetProfileProjection');
    return PetStore.listPetsByHousehold(householdId).filter(p=>p.status!=='ARCHIVED').map(p=>({
      petId:p.petId,name:p.name,species:p.speciesCode,breed:p.breedCode,lifecycleStage:p.lifecycleStage,status:p.status,
    }));
  }

  static readCare(auth:AuthenticatedIntegration,householdId:HouseholdId):CareProjection[]{
    this.authorizeApi(auth,'care:read',householdId,'CareProjection');
    return CareStore.getObligationsForHousehold(householdId).map(o=>({
      careObligationId:String(o.careObligationId),petId:o.petId,title:o.title,category:o.category,dueAt:o.dueAt,status:o.status,priority:o.priority,
    }));
  }

  static readBookings(auth:AuthenticatedIntegration,householdId:HouseholdId):BookingProjection[]{
    this.authorizeApi(auth,'booking:read',householdId,'BookingProjection');
    return BookingStore.getInstance().listBookingsByHousehold(householdId).map(b=>({
      bookingId:String(b.bookingId),petIds:[...b.petIds],serviceTitle:b.serviceSnapshot.title,status:b.status,startAt:b.startAt,endAt:b.endAt,timezone:b.timezone,
    }));
  }

  static readTrackerHealth(auth:AuthenticatedIntegration,householdId:HouseholdId):TrackerHealthProjection[]{
    this.authorizeApi(auth,'tracker:health:read',householdId,'TrackerHealthProjection');
    const tracking=TrackingStore.getInstance();
    return tracking.listDevicesForHousehold(householdId).map(d=>({
      deviceId:String(d.deviceId),
      petId:tracking.getActiveAssignmentForDevice(d.deviceId)?.petId,
      displayName:d.displayName,
      provider:d.provider,
      model:d.model,
      connectivityStatus:d.connectivityStatus,
      batteryStatus:d.batteryStatus,
      batteryPercent:d.batteryPercent,
      lastSeenAt:d.lastSeenAt,
    }));
  }

  static readCommandCenter(auth:AuthenticatedIntegration,householdId:HouseholdId):CommandCenterProjection{
    const installation=this.authorizeApi(auth,'command-center:read',householdId,'CommandCenterProjection');
    const membership=IdentityStore.findMembership(householdId,installation.authorizedByUserId);
    if(!membership)throw new Error('INSTALLATION_AUTHORIZER_INACTIVE');
    const snapshot=CommandCenterService.getSnapshot({actorUserId:installation.authorizedByUserId,householdId,timezone:'Africa/Nairobi'});
    return {generatedAt:snapshot.generatedAt,...snapshot.pulse};
  }

  static async createWebhookSubscription(actorUserId:UserId,installationId:IntegrationInstallationId,input:{endpointUrl:string;eventTypes:PublicIntegrationEventType[]}):Promise<{subscription:WebhookSubscription;signingSecret:string}>{
    const installation=store.getInstallation(installationId);
    if(!installation||installation.status!=='ACTIVE')throw new Error('INSTALLATION_NOT_ACTIVE');
    requireHouseholdInstaller(actorUserId,installation.householdId);
    if(!installation.grantedScopes.includes('webhook:manage'))throw new Error('API_SCOPE_REQUIRED: webhook:manage');
    const endpointUrl=assertSafeWebhookEndpoint(input.endpointUrl);
    const eventTypes=Array.from(new Set(input.eventTypes));
    if(!eventTypes.length||eventTypes.some(e=>!PUBLIC_INTEGRATION_EVENTS.includes(e)))throw new Error('WEBHOOK_EVENT_NOT_SUPPORTED');
    const secret=CryptoUtils.generateSecureToken(32);
    const hash=await CryptoUtils.hashToken(secret);
    const id=asWebhookId('wh-'+generateUUIDv7());
    const now=nowIso();
    const subscription:WebhookSubscription={
      webhookSubscriptionId:id,installationId,endpointUrl,eventTypes,status:'ACTIVE',
      signingKeyReference:'kms://prototype/pet-os/webhooks/'+id,
      signingSecretHash:hash,createdBy:actorUserId,createdAt:now,updatedAt:now,
    };
    this.webhookSecretVault.set(id,secret);
    store.saveWebhook(subscription);
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'WEBHOOK_CREATED',developerAppId:installation.developerAppId,installationId,householdId:installation.householdId,resourceType:'WebhookSubscription',resourceId:String(id),outcome:'SUCCESS'});
    return {subscription,signingSecret:secret};
  }

  static async publishEvent(input:{eventId?:string;eventType:PublicIntegrationEventType;householdId:HouseholdId;aggregateId:string;occurredAt?:string;data:Record<string,unknown>}):Promise<WebhookDelivery[]>{
    if(!PUBLIC_INTEGRATION_EVENTS.includes(input.eventType))throw new Error('WEBHOOK_EVENT_NOT_SUPPORTED');
    const event:PublicIntegrationEvent={
      eventId:input.eventId||'evt-'+generateUUIDv7(),eventType:input.eventType,householdId:input.householdId,
      occurredAt:input.occurredAt||nowIso(),aggregateId:input.aggregateId,data:sanitizeEventData(input.eventType,input.data),
    };
    const deliveries:WebhookDelivery[]=[];
    for(const subscription of store.listAllWebhooks().filter(s=>s.status==='ACTIVE'&&s.eventTypes.includes(event.eventType))){
      const installation=store.getInstallation(subscription.installationId);
      if(!installation||installation.status!=='ACTIVE'||installation.householdId!==input.householdId)continue;
      const existing=store.findDelivery(subscription.webhookSubscriptionId,event.eventId);
      if(existing){deliveries.push(existing);continue;}
      const secret=this.webhookSecretVault.get(subscription.webhookSubscriptionId);
      if(!secret)throw new Error('WEBHOOK_SIGNING_KEY_UNAVAILABLE');
      const body=JSON.stringify(event);
      const signature=await hmac(secret,body);
      const now=nowIso();
      const delivery:WebhookDelivery={
        webhookDeliveryId:asDeliveryId('whd-'+generateUUIDv7()),
        webhookSubscriptionId:subscription.webhookSubscriptionId,installationId:subscription.installationId,
        eventId:event.eventId,eventType:event.eventType,endpointUrl:subscription.endpointUrl,payload:event,signature,
        status:'PENDING',attemptCount:0,maxAttempts:5,createdAt:now,updatedAt:now,
      };
      store.saveDelivery(delivery);deliveries.push(delivery);
    }
    return deliveries;
  }

  static async deliverDue(transport?:WebhookTransport,at=new Date()):Promise<{delivered:number;retried:number;deadLettered:number;permanentFailures:number}>{
    const sender:WebhookTransport=transport||{deliver:async()=>({statusCode:204})};
    let delivered=0,retried=0,deadLettered=0,permanentFailures=0;
    for(const current of store.listDeliveries().filter(d=>['PENDING','RETRY_SCHEDULED'].includes(d.status)&&(!d.nextAttemptAt||new Date(d.nextAttemptAt).getTime()<=at.getTime()))){
      const delivery=store.getDelivery(current.webhookDeliveryId)!;
      delivery.attemptCount+=1;delivery.updatedAt=nowIso();
      try{
        const response=await sender.deliver({endpointUrl:delivery.endpointUrl,body:JSON.stringify(delivery.payload),signature:delivery.signature,eventId:delivery.eventId});
        delivery.lastResponseCode=response.statusCode;
        if(response.statusCode>=200&&response.statusCode<300){
          delivery.status='DELIVERED';delivery.deliveredAt=nowIso();delivery.nextAttemptAt=undefined;delivered++;
        }else if(response.statusCode===408||response.statusCode===429||response.statusCode>=500){
          if(delivery.attemptCount>=delivery.maxAttempts){delivery.status='DEAD_LETTER';delivery.nextAttemptAt=undefined;deadLettered++;}
          else{
            delivery.status='RETRY_SCHEDULED';
            const seconds=Math.min(3600,30*Math.pow(2,delivery.attemptCount-1));
            delivery.nextAttemptAt=new Date(at.getTime()+seconds*1000).toISOString();retried++;
          }
        }else{
          delivery.status='PERMANENT_FAILURE';delivery.nextAttemptAt=undefined;permanentFailures++;
        }
      }catch(error:any){
        delivery.lastError=error?.message||String(error);
        if(delivery.attemptCount>=delivery.maxAttempts){delivery.status='DEAD_LETTER';delivery.nextAttemptAt=undefined;deadLettered++;}
        else{
          delivery.status='RETRY_SCHEDULED';
          const seconds=Math.min(3600,30*Math.pow(2,delivery.attemptCount-1));
          delivery.nextAttemptAt=new Date(at.getTime()+seconds*1000).toISOString();retried++;
        }
      }
      store.saveDelivery(delivery);
    }
    return {delivered,retried,deadLettered,permanentFailures};
  }

  static revokeCredential(actorUserId:UserId,credentialId:ApiCredentialId):ApiCredential{
    const credential=store.getCredential(credentialId);if(!credential)throw new Error('API_CREDENTIAL_NOT_FOUND');
    const installation=store.getInstallation(credential.installationId);if(!installation)throw new Error('INSTALLATION_NOT_FOUND');
    requireHouseholdInstaller(actorUserId,installation.householdId);
    credential.status='REVOKED';credential.revokedAt=nowIso();store.saveCredential(credential);
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'API_CREDENTIAL_REVOKED',developerAppId:credential.developerAppId,installationId:credential.installationId,householdId:installation.householdId,resourceType:'ApiCredential',resourceId:String(credentialId),outcome:'SUCCESS'});
    return credential;
  }

  static revokeInstallation(actorUserId:UserId,installationId:IntegrationInstallationId):IntegrationInstallation{
    const installation=store.getInstallation(installationId);if(!installation)throw new Error('INSTALLATION_NOT_FOUND');
    requireHouseholdInstaller(actorUserId,installation.householdId);
    installation.status='REVOKED';installation.revokedAt=nowIso();installation.revokedBy=actorUserId;installation.updatedAt=nowIso();store.saveInstallation(installation);
    for(const c of store.listCredentialsForInstallation(installationId)){
      if(c.status==='ACTIVE'){c.status='REVOKED';c.revokedAt=nowIso();store.saveCredential(c);}
    }
    for(const w of store.listWebhooksForInstallation(installationId)){
      if(w.status!=='REVOKED'){w.status='REVOKED';w.updatedAt=nowIso();store.saveWebhook(w);}
      this.webhookSecretVault.delete(w.webhookSubscriptionId);
    }
    this.audit({actorType:'USER',actorId:String(actorUserId),action:'INSTALLATION_REVOKED',developerAppId:installation.developerAppId,installationId,householdId:installation.householdId,resourceType:'IntegrationInstallation',resourceId:String(installationId),outcome:'SUCCESS'});
    return installation;
  }
}
