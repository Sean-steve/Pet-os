
import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { IntegrationStore } from './store';
import { IntegrationService } from './service';
import type { IntegrationScope, WebhookTransport } from './types';

interface TestResult {
  id:string;
  name:string;
  passed:boolean;
  message:string;
  durationMs:number;
}

async function setup(){
  await seedUnifiedPetOS({forceReset:true});
  IntegrationStore.getInstance().reset();
  IntegrationService.resetRuntime();
  IntegrationStore.getInstance().savePlatformReviewer({
    userId:CANONICAL_IDS.ADMIN_CHARLES,
    status:'ACTIVE',
    permissions:['APP_REVIEW','SECURITY_REVIEW','INCIDENT_RESPONSE'],
    grantedAt:new Date().toISOString(),
    grantedBy:'TEST_BOOTSTRAP',
  });
}

async function activeInstallation(scopes:IntegrationScope[]=['pet:profile:read','care:read','booking:read','tracker:health:read','command-center:read','webhook:manage']){
  const draft=IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{
    name:'Sprint31 Test App',
    description:'Scoped developer platform test application.',
    requestedScopes:scopes,
  });
  const app=IntegrationService.activateApprovedAppForPlatform({
    developerAppId:draft.developerAppId,
    reviewerUserId:CANONICAL_IDS.ADMIN_CHARLES,
    approvedScopes:scopes,
  });
  const installation=IntegrationService.installApp(CANONICAL_IDS.OWNER_ELENA,CANONICAL_IDS.MAIN_HOUSEHOLD,app.developerAppId,scopes);
  return {app,installation};
}

export class IntegrationTestSuite {
  static async runAllTests():Promise<{passed:number;failed:number;total:number;results:TestResult[]}>{
    const tests:Array<{id:string;name:string;fn:()=>Promise<void>|void}>=[
      {id:'INT-00A',name:'Only an explicit platform reviewer can approve third-party apps',fn:async()=>{
        await setup();
        const draft=IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{name:'Reviewer Gate App',description:'test',requestedScopes:['pet:profile:read']});
        let blocked=false;
        try{IntegrationService.activateApprovedAppForPlatform({developerAppId:draft.developerAppId,reviewerUserId:CANONICAL_IDS.CAREGIVER_SEAN,approvedScopes:['pet:profile:read']});}
        catch(e:any){blocked=e.message.includes('PLATFORM_REVIEWER_REQUIRED');}
        if(!blocked)throw new Error('ordinary active user approved third-party app');
      }},
      {id:'INT-00B',name:'Third-party app owner cannot self-approve even when reviewer authority exists',fn:async()=>{
        await setup();
        IntegrationStore.getInstance().savePlatformReviewer({
          userId:CANONICAL_IDS.OWNER_ELENA,status:'ACTIVE',permissions:['APP_REVIEW'],grantedAt:new Date().toISOString(),grantedBy:'TEST_BOOTSTRAP'
        });
        const draft=IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{name:'Self Approval App',description:'test',requestedScopes:['pet:profile:read']});
        let blocked=false;
        try{IntegrationService.activateApprovedAppForPlatform({developerAppId:draft.developerAppId,reviewerUserId:CANONICAL_IDS.OWNER_ELENA,approvedScopes:['pet:profile:read']});}
        catch(e:any){blocked=e.message.includes('SELF_APPROVAL_FORBIDDEN');}
        if(!blocked)throw new Error('developer app owner self-approved');
      }},
      {id:'INT-01',name:'Draft third-party apps cannot be installed',fn:async()=>{
        await setup();
        const app=IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{name:'Draft App',description:'test',requestedScopes:['pet:profile:read']});
        let blocked=false;try{IntegrationService.installApp(CANONICAL_IDS.OWNER_ELENA,CANONICAL_IDS.MAIN_HOUSEHOLD,app.developerAppId,['pet:profile:read']);}catch(e:any){blocked=e.message.includes('DEVELOPER_APP_NOT_ACTIVE');}
        if(!blocked)throw new Error('draft app installation was allowed');
      }},
      {id:'INT-02',name:'Unsupported or dangerous scopes are rejected',fn:async()=>{
        await setup();
        let blocked=false;try{IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{name:'Unsafe App',description:'test',requestedScopes:['tracking:exact-location:read' as any]});}catch(e:any){blocked=e.message.includes('INTEGRATION_SCOPE_NOT_SUPPORTED');}
        if(!blocked)throw new Error('dangerous scope was accepted');
      }},
      {id:'INT-03',name:'Only household owner/admin can install integrations',fn:async()=>{
        await setup();
        const draft=IntegrationService.createDeveloperApp(CANONICAL_IDS.OWNER_ELENA,{name:'Install Auth App',description:'test',requestedScopes:['pet:profile:read']});
        const app=IntegrationService.activateApprovedAppForPlatform({developerAppId:draft.developerAppId,reviewerUserId:CANONICAL_IDS.ADMIN_CHARLES,approvedScopes:['pet:profile:read']});
        let blocked=false;try{IntegrationService.installApp(CANONICAL_IDS.CAREGIVER_SEAN,CANONICAL_IDS.MAIN_HOUSEHOLD,app.developerAppId,['pet:profile:read']);}catch(e:any){blocked=e.message.includes('OWNER_OR_ADMIN');}
        if(!blocked)throw new Error('caregiver installed third-party app');
      }},
      {id:'INT-04',name:'API credentials persist only a hash and authenticate correctly',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const stored=IntegrationStore.getInstance().getCredential(created.credential.credentialId)! as any;
        if(stored.rawToken||stored.secret||stored.token===created.rawToken)throw new Error('raw API token persisted');
        if(stored.tokenHash===created.rawToken||stored.tokenHash.length<32)throw new Error('credential hash invalid');
        const auth=await IntegrationService.authenticate(created.rawToken);
        if(auth.installationId!==installation.installationId)throw new Error('credential did not authenticate');
      }},
      {id:'INT-05',name:'Invalid API credential is rejected',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        let blocked=false;try{await IntegrationService.authenticate(created.rawToken+'tampered');}catch(e:any){blocked=e.message.includes('API_CREDENTIAL_INVALID');}
        if(!blocked)throw new Error('tampered credential authenticated');
      }},
      {id:'INT-06',name:'API scope enforcement blocks ungranted resources',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        let blocked=false;try{IntegrationService.readTrackerHealth(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);}catch(e:any){blocked=e.message.includes('API_SCOPE_REQUIRED');}
        if(!blocked)throw new Error('tracker health read bypassed missing scope');
      }},
      {id:'INT-07',name:'API credential cannot cross household boundary',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        let blocked=false;try{IntegrationService.readPetProfiles(auth,CANONICAL_IDS.OUTSIDER_HOUSEHOLD);}catch(e:any){blocked=e.message.includes('API_HOUSEHOLD_ACCESS_DENIED');}
        if(!blocked)throw new Error('cross-household API access allowed');
      }},
      {id:'INT-08',name:'Pet projection is minimized and excludes ownership/microchip data',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        const pet:any=IntegrationService.readPetProfiles(auth,CANONICAL_IDS.MAIN_HOUSEHOLD)[0];
        if(!pet||'microchipNumber'in pet||'ownerUserId'in pet||'householdId'in pet||'documents'in pet)throw new Error('Pet projection leaked sensitive fields');
      }},
      {id:'INT-09',name:'Tracker health API never exposes exact location or hardware secret identifiers',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['tracker:health:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        const devices:any[]=IntegrationService.readTrackerHealth(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);
        if(devices.some(d=>'latitude'in d||'longitude'in d||'route'in d||'externalDeviceReference'in d||'serialNumberMasked'in d))throw new Error('tracker API leaked location/hardware identifier');
      }},
      {id:'INT-10',name:'Booking API excludes home access and contact details',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['booking:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        const rows:any[]=IntegrationService.readBookings(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);
        if(rows.some(b=>'instructions'in b||'emergencyContactPhone'in b||'accessCodeOrKeyLocationMasked'in b||'deliveryAddress'in b))throw new Error('booking projection leaked private instructions');
      }},
      {id:'INT-11',name:'Command Center API exposes counts rather than item-level sensitive data',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['command-center:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(created.rawToken);
        const projection:any=IntegrationService.readCommandCenter(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);
        if(typeof projection.pets!=='number'||'today'in projection||'inbox'in projection||'recentActivity'in projection)throw new Error('command center projection not minimized');
      }},
      {id:'INT-12',name:'Per-credential rate limit is enforced',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const created=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId,2);
        const auth=await IntegrationService.authenticate(created.rawToken);
        IntegrationService.readPetProfiles(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);
        IntegrationService.readPetProfiles(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);
        let blocked=false;try{IntegrationService.readPetProfiles(auth,CANONICAL_IDS.MAIN_HOUSEHOLD);}catch(e:any){blocked=e.message.includes('API_RATE_LIMITED');}
        if(!blocked)throw new Error('rate limit not enforced');
      }},
      {id:'INT-13',name:'Webhook endpoints require HTTPS',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        let blocked=false;try{await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'http://example.com/webhook',eventTypes:['pet.profile.updated']});}catch(e:any){blocked=e.message.includes('WEBHOOK_HTTPS_REQUIRED');}
        if(!blocked)throw new Error('HTTP webhook accepted');
      }},
      {id:'INT-14',name:'Webhook endpoints reject localhost/private-network SSRF targets',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        for(const url of ['https://localhost/hook','https://127.0.0.1/hook','https://10.0.0.4/hook','https://192.168.1.4/hook','https://172.16.5.2/hook']){
          let blocked=false;try{await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:url,eventTypes:['pet.profile.updated']});}catch(e:any){blocked=e.message.includes('PRIVATE_NETWORK_FORBIDDEN');}
          if(!blocked)throw new Error('unsafe webhook target accepted: '+url);
        }
      }},
      {id:'INT-15',name:'Webhook creation requires explicit webhook management scope',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        let blocked=false;try{await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['pet.profile.updated']});}catch(e:any){blocked=e.message.includes('webhook:manage');}
        if(!blocked)throw new Error('webhook created without scope');
      }},
      {id:'INT-16',name:'Webhook payload is field-allowlisted and strips sensitive additions',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['tracker.health.changed']});
        const deliveries=await IntegrationService.publishEvent({eventId:'evt-safe-fields',eventType:'tracker.health.changed',householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,aggregateId:'device-1',data:{deviceId:'device-1',petId:CANONICAL_IDS.PET_KIBO,displayName:'Kibo tracker',provider:'demo',model:'T1',connectivityStatus:'ONLINE',batteryStatus:'NORMAL',batteryPercent:80,latitude:-1.2,longitude:36.8,routeHistory:['secret'],ownerPhone:'+254700000000'}});
        const data:any=deliveries[0]?.payload.data;
        if(!data||'latitude'in data||'longitude'in data||'routeHistory'in data||'ownerPhone'in data)throw new Error('webhook payload minimization failed');
      }},
      {id:'INT-17',name:'Webhook signatures verify with the one-time signing secret',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        const created=await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['pet.profile.updated']});
        const [delivery]=await IntegrationService.publishEvent({eventId:'evt-signature',eventType:'pet.profile.updated',householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,aggregateId:String(CANONICAL_IDS.PET_KIBO),data:{petId:CANONICAL_IDS.PET_KIBO,name:'Kibo',species:'DOG',status:'ACTIVE'}});
        const valid=await IntegrationService.verifyWebhookSignature(created.signingSecret,JSON.stringify(delivery.payload),delivery.signature);
        const invalid=await IntegrationService.verifyWebhookSignature('wrong-secret',JSON.stringify(delivery.payload),delivery.signature);
        if(!valid||invalid)throw new Error('webhook signature verification failed');
      }},
      {id:'INT-18',name:'Duplicate event delivery is idempotent per subscription',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['care.status.changed']});
        const input={eventId:'evt-dedupe',eventType:'care.status.changed' as const,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,aggregateId:'care-1',data:{careObligationId:'care-1',petId:CANONICAL_IDS.PET_KIBO,title:'Care',status:'ACTIVE'}};
        const a=await IntegrationService.publishEvent(input),b=await IntegrationService.publishEvent(input);
        if(a[0]?.webhookDeliveryId!==b[0]?.webhookDeliveryId||IntegrationStore.getInstance().listDeliveries().length!==1)throw new Error('duplicate webhook delivery created');
      }},
      {id:'INT-19',name:'Retryable webhook failures back off and dead-letter after max attempts',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['pet.profile.updated']});
        await IntegrationService.publishEvent({eventId:'evt-retry',eventType:'pet.profile.updated',householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,aggregateId:'pet-1',data:{petId:'pet-1',name:'Kibo',species:'DOG',status:'ACTIVE'}});
        const failing:WebhookTransport={deliver:async()=>({statusCode:503})};
        for(let i=0;i<5;i++)await IntegrationService.deliverDue(failing,new Date(Date.now()+(i+1)*2*60*60*1000));
        const delivery=IntegrationStore.getInstance().listDeliveries()[0];
        if(delivery.status!=='DEAD_LETTER'||delivery.attemptCount!==5)throw new Error('retry/dead-letter policy failed');
      }},
      {id:'INT-20',name:'Non-retryable 4xx webhook response fails permanently',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['webhook:manage']);
        await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['pet.profile.updated']});
        await IntegrationService.publishEvent({eventId:'evt-400',eventType:'pet.profile.updated',householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,aggregateId:'pet-1',data:{petId:'pet-1',name:'Kibo'}});
        await IntegrationService.deliverDue({deliver:async()=>({statusCode:400})});
        if(IntegrationStore.getInstance().listDeliveries()[0].status!=='PERMANENT_FAILURE')throw new Error('400 response incorrectly retried');
      }},
      {id:'INT-21',name:'Revoking installation cascades to credentials and webhooks',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read','webhook:manage']);
        const credential=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const webhook=await IntegrationService.createWebhookSubscription(CANONICAL_IDS.OWNER_ELENA,installation.installationId,{endpointUrl:'https://hooks.example.com/pet-os',eventTypes:['pet.profile.updated']});
        IntegrationService.revokeInstallation(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        if(IntegrationStore.getInstance().getCredential(credential.credential.credentialId)?.status!=='REVOKED'||IntegrationStore.getInstance().getWebhook(webhook.subscription.webhookSubscriptionId)?.status!=='REVOKED')throw new Error('revocation cascade incomplete');
        let blocked=false;try{await IntegrationService.authenticate(credential.rawToken);}catch(e:any){blocked=e.message.includes('NOT_ACTIVE');}
        if(!blocked)throw new Error('revoked installation credential still authenticated');
      }},
      {id:'INT-22',name:'Denied API access is recorded in integration audit log',fn:async()=>{
        await setup();const {installation}=await activeInstallation(['pet:profile:read']);
        const credential=await IntegrationService.createCredential(CANONICAL_IDS.OWNER_ELENA,installation.installationId);
        const auth=await IntegrationService.authenticate(credential.rawToken);
        try{IntegrationService.readPetProfiles(auth,CANONICAL_IDS.OUTSIDER_HOUSEHOLD);}catch{}
        if(!IntegrationStore.getInstance().listAudits().some(a=>a.outcome==='DENIED'&&a.reason==='HOUSEHOLD_OR_INSTALLATION_MISMATCH'))throw new Error('denied access not audited');
      }},
      {id:'INT-23',name:'Public developer API catalog is read-only and excludes dangerous generic write endpoints',fn:async()=>{
        await setup();const catalog=IntegrationService.getApiCatalog();
        if(!catalog.length||catalog.some(e=>e.method!=='GET'||/execute|payment|payout|prescription|exact-location|purchase/i.test(e.path)))throw new Error('unsafe public API catalog');
      }},
    ];

    const results:TestResult[]=[];
    for(const t of tests){
      const start=Date.now();
      try{await t.fn();results.push({id:t.id,name:t.name,passed:true,message:'PASS',durationMs:Date.now()-start});}
      catch(e:any){results.push({id:t.id,name:t.name,passed:false,message:e?.message||String(e),durationMs:Date.now()-start});}
    }
    return {passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,total:results.length,results};
  }
}
