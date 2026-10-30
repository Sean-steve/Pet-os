
import { UserId, HouseholdId } from '../kernel/ids';
import { IntegrationStore } from './store';
import { IntegrationService } from './service';

export async function seedIntegrationData(ownerUserId:UserId,platformReviewerUserId:UserId,householdId:HouseholdId):Promise<void>{
  const store=IntegrationStore.getInstance();
  if(!store.getPlatformReviewer(String(platformReviewerUserId))){
    store.savePlatformReviewer({
      userId:platformReviewerUserId,
      status:'ACTIVE',
      permissions:['APP_REVIEW','SECURITY_REVIEW','INCIDENT_RESPONSE'],
      grantedAt:new Date().toISOString(),
      grantedBy:'PET_OS_PLATFORM_BOOTSTRAP',
    });
  }
  if(store.listApps().length>0)return;

  const draft=IntegrationService.createDeveloperApp(ownerUserId,{
    name:'PawHome Sync',
    description:'Demo third-party household integration using minimized Pet OS read APIs and signed webhooks.',
    requestedScopes:['pet:profile:read','care:read','booking:read','tracker:health:read','command-center:read','webhook:manage'],
    redirectUris:['https://pawhome.example.invalid/oauth/callback'],
    privacyPolicyUrl:'https://pawhome.example.invalid/privacy',
    termsUrl:'https://pawhome.example.invalid/terms',
  });

  const app=IntegrationService.activateApprovedAppForPlatform({
    developerAppId:draft.developerAppId,
    reviewerUserId:platformReviewerUserId,
    approvedScopes:[...draft.requestedScopes],
  });

  const installation=IntegrationService.installApp(
    ownerUserId,
    householdId,
    app.developerAppId,
    [...app.approvedScopes],
  );

  await IntegrationService.createCredential(ownerUserId,installation.installationId,120);

  await IntegrationService.createWebhookSubscription(ownerUserId,installation.installationId,{
    endpointUrl:'https://pawhome.example.invalid/webhooks/pet-os',
    eventTypes:['pet.profile.updated','care.status.changed','booking.status.changed','tracker.health.changed','command-center.attention.changed'],
  });

  const deliveries=await IntegrationService.publishEvent({
    eventId:'evt-sprint31-seed-attention',
    eventType:'command-center.attention.changed',
    householdId,
    aggregateId:String(householdId),
    data:{pets:4,dueToday:3,overdueCare:1,upcomingBookings:2,unreadNotifications:4,onlineTrackers:2,actionInbox:1,ordersInProgress:1,exactLocation:'MUST_NOT_LEAK'},
  });
  if(deliveries.length)await IntegrationService.deliverDue();
}
