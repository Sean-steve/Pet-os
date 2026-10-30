
import {
  ApiCredential, ApiCredentialId, DeveloperApp, DeveloperAppId,
  IntegrationAuditEvent, IntegrationAuditEventId, IntegrationInstallation,
  IntegrationInstallationId, WebhookDelivery, WebhookDeliveryId,
  WebhookSubscription, WebhookSubscriptionId
} from './types';

export class IntegrationStore {
  private static instance: IntegrationStore;
  static getInstance(): IntegrationStore {
    if (!this.instance) this.instance = new IntegrationStore();
    return this.instance;
  }

  private apps = new Map<DeveloperAppId, DeveloperApp>();
  private installations = new Map<IntegrationInstallationId, IntegrationInstallation>();
  private credentials = new Map<ApiCredentialId, ApiCredential>();
  private credentialByPrefix = new Map<string, ApiCredentialId>();
  private webhooks = new Map<WebhookSubscriptionId, WebhookSubscription>();
  private deliveries = new Map<WebhookDeliveryId, WebhookDelivery>();
  private audits = new Map<IntegrationAuditEventId, IntegrationAuditEvent>();
  private deliveryBySubscriptionEvent = new Map<string, WebhookDeliveryId>();

  reset(): void {
    this.apps.clear();
    this.installations.clear();
    this.credentials.clear();
    this.credentialByPrefix.clear();
    this.webhooks.clear();
    this.deliveries.clear();
    this.audits.clear();
    this.deliveryBySubscriptionEvent.clear();
  }

  saveApp(app: DeveloperApp): void { this.apps.set(app.developerAppId, { ...app, requestedScopes:[...app.requestedScopes], approvedScopes:[...app.approvedScopes], redirectUris:[...app.redirectUris] }); }
  getApp(id: DeveloperAppId): DeveloperApp | undefined {
    const v=this.apps.get(id); return v ? { ...v, requestedScopes:[...v.requestedScopes], approvedScopes:[...v.approvedScopes], redirectUris:[...v.redirectUris] } : undefined;
  }
  listApps(): DeveloperApp[] { return Array.from(this.apps.values()).map(v=>({ ...v, requestedScopes:[...v.requestedScopes], approvedScopes:[...v.approvedScopes], redirectUris:[...v.redirectUris] })); }

  saveInstallation(v: IntegrationInstallation): void { this.installations.set(v.installationId,{...v,grantedScopes:[...v.grantedScopes]}); }
  getInstallation(id: IntegrationInstallationId): IntegrationInstallation | undefined {
    const v=this.installations.get(id); return v ? {...v,grantedScopes:[...v.grantedScopes]} : undefined;
  }
  listInstallationsForHousehold(householdId:string): IntegrationInstallation[] {
    return Array.from(this.installations.values()).filter(v=>v.householdId===householdId).map(v=>({...v,grantedScopes:[...v.grantedScopes]}));
  }
  listInstallationsForApp(appId:DeveloperAppId): IntegrationInstallation[] {
    return Array.from(this.installations.values()).filter(v=>v.developerAppId===appId).map(v=>({...v,grantedScopes:[...v.grantedScopes]}));
  }

  saveCredential(v:ApiCredential):void{
    this.credentials.set(v.credentialId,{...v,scopes:[...v.scopes]});
    this.credentialByPrefix.set(v.tokenPrefix,v.credentialId);
  }
  getCredential(id:ApiCredentialId):ApiCredential|undefined{
    const v=this.credentials.get(id);return v?{...v,scopes:[...v.scopes]}:undefined;
  }
  findCredentialByPrefix(prefix:string):ApiCredential|undefined{
    const id=this.credentialByPrefix.get(prefix);return id?this.getCredential(id):undefined;
  }
  listCredentialsForInstallation(id:IntegrationInstallationId):ApiCredential[]{
    return Array.from(this.credentials.values()).filter(v=>v.installationId===id).map(v=>({...v,scopes:[...v.scopes]}));
  }

  saveWebhook(v:WebhookSubscription):void{this.webhooks.set(v.webhookSubscriptionId,{...v,eventTypes:[...v.eventTypes]});}
  getWebhook(id:WebhookSubscriptionId):WebhookSubscription|undefined{
    const v=this.webhooks.get(id);return v?{...v,eventTypes:[...v.eventTypes]}:undefined;
  }
  listWebhooksForInstallation(id:IntegrationInstallationId):WebhookSubscription[]{
    return Array.from(this.webhooks.values()).filter(v=>v.installationId===id).map(v=>({...v,eventTypes:[...v.eventTypes]}));
  }
  listAllWebhooks():WebhookSubscription[]{return Array.from(this.webhooks.values()).map(v=>({...v,eventTypes:[...v.eventTypes]}));}

  saveDelivery(v:WebhookDelivery):void{
    this.deliveries.set(v.webhookDeliveryId,{...v,payload:{...v.payload,data:{...v.payload.data}}});
    this.deliveryBySubscriptionEvent.set(String(v.webhookSubscriptionId)+'|'+v.eventId,v.webhookDeliveryId);
  }
  getDelivery(id:WebhookDeliveryId):WebhookDelivery|undefined{
    const v=this.deliveries.get(id);return v?{...v,payload:{...v.payload,data:{...v.payload.data}}}:undefined;
  }
  findDelivery(subscriptionId:WebhookSubscriptionId,eventId:string):WebhookDelivery|undefined{
    const id=this.deliveryBySubscriptionEvent.get(String(subscriptionId)+'|'+eventId);
    return id?this.getDelivery(id):undefined;
  }
  listDeliveries():WebhookDelivery[]{return Array.from(this.deliveries.values()).map(v=>({...v,payload:{...v.payload,data:{...v.payload.data}}})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}

  saveAudit(v:IntegrationAuditEvent):void{this.audits.set(v.integrationAuditEventId,{...v});}
  listAudits():IntegrationAuditEvent[]{return Array.from(this.audits.values()).map(v=>({...v})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
}
