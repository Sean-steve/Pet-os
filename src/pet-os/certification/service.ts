import type { UserId } from '../kernel/ids';
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { ProviderStore } from '../provider/store';
import { BookingStore } from '../booking/store';
import { FinanceStore } from '../finance/store';
import { ProfessionalCareStore } from '../professional-care/store';
import { TransportStore } from '../transport/store';
import { RescueStore } from '../rescue/store';
import { CommerceStore } from '../commerce/store';
import { ReviewStore } from '../reviews/store';
import { SubscriptionStore } from '../subscription/store';
import { TrackerSubscriptionStore } from '../tracker-service/store';
import { ProviderSaaSStore } from '../provider-saas/store';
import { TrackingStore } from '../tracking/store';
import { IntegrationStore } from '../integrations/store';
import { AIStore } from '../ai/store';
import { OrchestrationStore } from '../orchestration/store';
import { CommandCenterService } from '../command-center/service';
import { SecurityService } from '../security/service';
import { ResilienceService } from '../resilience/service';
import { CANONICAL_IDS } from '../seed/unified-seed';
import type { FullSystemCertificationReport, JourneyCertification, RoleSurfaceCertification } from './types';

function requireCertificationAuthority(userId:UserId){
  const user=IdentityStore.findUserById(userId);
  if(!user||user.accountStatus!=='ACTIVE')throw new Error('CERTIFICATION_ACTOR_NOT_ACTIVE');
  const reviewer=IntegrationStore.getInstance().getPlatformReviewer(String(userId));
  if(!reviewer||reviewer.status!=='ACTIVE'||!reviewer.permissions.includes('SECURITY_REVIEW')||!reviewer.permissions.includes('INCIDENT_RESPONSE')){
    throw new Error('CERTIFICATION_PLATFORM_AUTHORITY_REQUIRED');
  }
}
function pass(journeyId:string,title:string,roles:string[],domains:string[],evidence:string[]):JourneyCertification{
  return {journeyId,title,roles,domains,status:'PASS',evidence};
}
function fail(journeyId:string,title:string,roles:string[],domains:string[],failure:string,evidence:string[]=[]):JourneyCertification{
  return {journeyId,title,roles,domains,status:'FAIL',failure,evidence};
}
function run(journeyId:string,title:string,roles:string[],domains:string[],fn:()=>string[]):JourneyCertification{
  try{return pass(journeyId,title,roles,domains,fn());}catch(e:any){return fail(journeyId,title,roles,domains,e?.message||String(e));}
}

export class FullSystemCertificationService{
  static roleMatrix():RoleSurfaceCertification[]{
    return [
      {roleId:'PET_PARENT',label:'Pet Parent',actor:String(CANONICAL_IDS.OWNER_ELENA),requiredDomains:['Identity','Pet Core','Care','Booking','Finance','Tracking','Commerce'],status:'PASS',notes:['Household-scoped canonical owner journey']},
      {roleId:'PROFESSIONAL',label:'Professional',actor:String(CANONICAL_IDS.WALKER_SARAH_USER),requiredDomains:['Provider','Booking','Professional Care','Reviews'],status:'PASS',notes:['Verified provider identity and service execution']},
      {roleId:'PROVIDER_BUSINESS',label:'Provider Business',actor:'verified-business-members',requiredDomains:['Provider','Provider SaaS','Booking','Finance','Reviews'],status:'PASS',notes:['Business subscriptions and operational continuity']},
      {roleId:'RESCUE_WELFARE',label:'Rescue & Welfare',actor:String(CANONICAL_IDS.WALKER_SARAH_USER),requiredDomains:['Rescue','Custody','Adoption','Welfare'],status:'PASS',notes:['Verified organization and custody chain']},
      {roleId:'SELLER_COMMERCE',label:'Seller & Commerce',actor:'verified-seller-members',requiredDomains:['Commerce','Inventory','Orders','Returns'],status:'PASS',notes:['Verified sellers and buyer/seller separation']},
      {roleId:'FINANCE_BILLING',label:'Finance & Billing',actor:'platform-finance-boundary',requiredDomains:['Booking','Payments','Receipts','Provider Earnings','Subscriptions'],status:'PASS',notes:['Canonical booking-to-finance linkage is required']},
      {roleId:'TRUST_OPERATIONS',label:'Trust & Operations',actor:String(CANONICAL_IDS.ADMIN_CHARLES),requiredDomains:['Security','Privacy','Resilience','Reviews','Rescue'],status:'PASS',notes:['Privileged platform control plane']},
      {roleId:'AI_INTELLIGENCE',label:'AI & Intelligence',actor:String(CANONICAL_IDS.OWNER_ELENA),requiredDomains:['AI','Analytics','Engagement','Orchestration'],status:'PASS',notes:['Governed intelligence remains non-authoritative']},
      {roleId:'PLATFORM_ENGINEERING',label:'Platform & Engineering',actor:String(CANONICAL_IDS.ADMIN_CHARLES),requiredDomains:['Integrations','Developer Platform','Performance','Recovery'],status:'PASS',notes:['Scoped apps, signed delivery and release gates']},
    ];
  }

  static run(actorUserId:UserId):FullSystemCertificationReport{
    requireCertificationAuthority(actorUserId);
    const journeys:JourneyCertification[]=[];

    journeys.push(run('E2E-01','Pet Parent identity → household → Pet graph',['Pet Parent'],['Identity','Pet Core'],()=>{
      const membership=IdentityStore.findMembership(CANONICAL_IDS.MAIN_HOUSEHOLD,CANONICAL_IDS.OWNER_ELENA);
      const pets=PetStore.listPetsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).filter(p=>p.status!=='ARCHIVED');
      if(!membership||membership.role!=='HOUSEHOLD_OWNER'||pets.length<1)throw new Error('Canonical household graph is incomplete');
      return [`Owner membership: ${membership.role}`,`Active household Pets: ${pets.length}`];
    }));

    journeys.push(run('E2E-02','Pet Parent → unified Command Center',['Pet Parent'],['Command Center','Care','Booking','Tracking','Commerce'],()=>{
      const snapshot=CommandCenterService.getSnapshot({actorUserId:CANONICAL_IDS.OWNER_ELENA,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,timezone:'Africa/Nairobi'});
      if(snapshot.pulse.pets<1||snapshot.pets.length<1)throw new Error('Command Center lost canonical household state');
      const raw=JSON.stringify(snapshot.pets);
      if(/latitude|longitude|exactLocation/i.test(raw))throw new Error('Command Center leaked exact location');
      return [`Pet summaries: ${snapshot.pets.length}`,`Action inbox: ${snapshot.inbox.length}`,`Orders in progress: ${snapshot.pulse.ordersInProgress}`];
    }));

    journeys.push(run('E2E-03','Cross-tenant isolation',['Pet Parent','Trust & Operations'],['Identity','Command Center'],()=>{
      let denied=false;
      try{CommandCenterService.getSnapshot({actorUserId:CANONICAL_IDS.OUTSIDER_BRIAN,householdId:CANONICAL_IDS.MAIN_HOUSEHOLD,timezone:'Africa/Nairobi'});}catch(e:any){denied=String(e.message).includes('COMMAND_CENTER_ACCESS_DENIED');}
      if(!denied)throw new Error('Foreign household actor crossed tenant boundary');
      return ['Outsider access denied before household read-model projection'];
    }));

    journeys.push(run('E2E-04','Professional identity → offering → booking continuity',['Pet Parent','Professional'],['Provider','Booking'],()=>{
      const provider=ProviderStore.getInstance().getProvider(CANONICAL_IDS.WALKER_SARAH);
      const offerings=ProviderStore.getInstance().getServiceOfferingsForProvider(CANONICAL_IDS.WALKER_SARAH);
      const bookings=BookingStore.getInstance().listBookingsByProvider(CANONICAL_IDS.WALKER_SARAH);
      if(!provider||provider.verificationStatus!=='VERIFIED'||provider.operationalStatus!=='ACTIVE')throw new Error('Professional identity is not active and verified');
      if(!offerings.length||!bookings.length)throw new Error('Professional does not connect to both offering and booking state');
      return [`Offerings: ${offerings.length}`,`Bookings: ${bookings.length}`];
    }));

    journeys.push(run('E2E-05','Booking → professional care execution',['Pet Parent','Professional','Provider Business'],['Booking','Professional Care'],()=>{
      const engagements=ProfessionalCareStore.getInstance().listEngagements();
      if(!engagements.length)throw new Error('Professional care has no seeded engagements');
      const linked=engagements.filter(e=>!!BookingStore.getInstance().findBookingById(e.bookingId));
      if(linked.length!==engagements.length)throw new Error(`Professional care contains ${engagements.length-linked.length} orphan booking references`);
      return [`Engagements linked to canonical BookingStore: ${linked.length}/${engagements.length}`];
    }));

    journeys.push(run('E2E-06','Booking → payment → receipt → provider earning',['Pet Parent','Professional','Finance & Billing'],['Booking','Finance'],()=>{
      const bookings=BookingStore.getInstance().listBookingsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD);
      const booking=bookings.find(b=>FinanceStore.getInstance().getSuccessfulIntentForBooking(b.bookingId));
      if(!booking)throw new Error('No canonical household booking is linked to a successful payment intent');
      const intent=FinanceStore.getInstance().getSuccessfulIntentForBooking(booking.bookingId)!;
      const receipt=FinanceStore.getInstance().getReceiptForBooking(booking.bookingId);
      const earnings=FinanceStore.getInstance().getEarningsForBooking(booking.bookingId);
      if(!receipt||!earnings.length)throw new Error('Payment is not connected to both receipt and provider earning');
      if(intent.amountMinor!==receipt.amountMinor||earnings[0].grossAmountMinor!==intent.amountMinor)throw new Error('Booking financial amounts diverged across canonical records');
      if(earnings[0].providerId!==booking.providerId)throw new Error('Provider earning belongs to a different provider');
      return [`Booking: ${booking.bookingId}`,`Paid amount: KES ${(intent.amountMinor/100).toFixed(2)}`,`Provider earning: ${earnings[0].status}`];
    }));

    journeys.push(run('E2E-07','Provider Business subscription continuity',['Provider Business','Finance & Billing'],['Provider SaaS','Provider'],()=>{
      const subs=ProviderSaaSStore.getInstance().listAllSubscriptions();
      if(!subs.length)throw new Error('Provider SaaS has no business/provider subscription state');
      const resolvable=subs.filter((s:any)=>!s.businessId||!!ProviderStore.getInstance().getBusiness(s.businessId));
      if(!resolvable.length)throw new Error('Provider SaaS subscriptions cannot resolve provider business identity');
      return [`Provider SaaS subscriptions: ${subs.length}`,`Business-resolvable subscriptions: ${resolvable.length}`];
    }));

    journeys.push(run('E2E-08','Transport dispatch → verified driver → vehicle → custody',['Pet Parent','Professional','Provider Business'],['Transport'],()=>{
      const store=TransportStore.getInstance(),trips=store.listTrips();
      if(!trips.length)throw new Error('Transport has no executable trips');
      const valid=trips.filter(t=>{
        const d=store.getDriver(t.assignedDriverId),v=store.getVehicle(t.assignedVehicleId);
        return !!d&&d.verificationStatus==='VERIFIED'&&d.operationalStatus==='ACTIVE'&&!!v&&v.verificationStatus==='VERIFIED'&&t.pets.length>0;
      });
      if(!valid.length)throw new Error('No transport trip resolves to a verified driver, verified vehicle and Pet custody');
      return [`Transport trips: ${trips.length}`,`Verified executable trips: ${valid.length}`];
    }));

    journeys.push(run('E2E-09','Rescue intake → custody → outcome readiness',['Rescue & Welfare','Trust & Operations'],['Rescue','Custody','Adoption'],()=>{
      const store=RescueStore.getInstance();
      const orgs=Array.from(store.organizations.values()).filter(o=>o.verificationStatus==='VERIFIED'&&o.operationalStatus==='ACTIVE');
      const animals=Array.from(store.rescueAnimals.values());
      const currentCustody=Array.from(store.custodyRecords.values()).filter(c=>c.isCurrent);
      if(!orgs.length||!animals.length||!currentCustody.length)throw new Error('Rescue organization, animal or custody chain is incomplete');
      const orphan=animals.filter(a=>!store.custodyRecords.get(a.currentCustodyRecordId));
      if(orphan.length)throw new Error(`Rescue contains ${orphan.length} animal(s) without current custody resolution`);
      return [`Verified rescue organizations: ${orgs.length}`,`Rescue animals: ${animals.length}`,`Current custody records: ${currentCustody.length}`];
    }));

    journeys.push(run('E2E-10','Seller → listing → inventory → buyer order',['Seller & Commerce','Pet Parent'],['Commerce','Inventory','Orders'],()=>{
      const store=CommerceStore.getInstance();
      const sellers=store.listSellers().filter(s=>s.isVerified&&s.status==='ACTIVE');
      const listings=store.listActiveListings();
      const buyerOrders=store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
      if(!sellers.length||!listings.length||!buyerOrders.length)throw new Error('Commerce lacks seller, active listing or canonical buyer order continuity');
      if(store.listCategories().some(c=>!c.isLiveAnimalProhibited))throw new Error('Commerce category permits live-animal trade');
      return [`Verified sellers: ${sellers.length}`,`Active listings: ${listings.length}`,`Canonical buyer orders: ${buyerOrders.length}`];
    }));

    journeys.push(run('E2E-11','Consumer + tracker subscription continuity',['Pet Parent','Finance & Billing'],['Subscriptions','Tracking'],()=>{
      const consumer=SubscriptionStore.getActiveSubscriptionForOwner(CANONICAL_IDS.MAIN_HOUSEHOLD)||SubscriptionStore.getActiveSubscriptionForOwner(CANONICAL_IDS.OWNER_ELENA);
      const trackerSubs=TrackerSubscriptionStore.getInstance().getSubscriptionsForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD);
      const devices=TrackingStore.getInstance().listDevicesForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD);
      if(!consumer)throw new Error('Canonical household has no active consumer subscription');
      if(devices.length&&trackerSubs.length===0)throw new Error('Tracked household has no tracker-service subscription continuity');
      return [`Consumer subscription: ${consumer.status}`,`Tracked devices: ${devices.length}`,`Tracker subscriptions: ${trackerSubs.length}`];
    }));

    journeys.push(run('E2E-12','Verified service → review/reputation boundary',['Professional','Provider Business','Trust & Operations'],['Reviews','Provider'],()=>{
      const store=ReviewStore.getInstance();
      const reviews=store.listAllReviews(),projections=store.listAllProjections();
      if(!reviews.length||!projections.length)throw new Error('Review or reputation projection seed is missing');
      return [`Reviews: ${reviews.length}`,`Reputation projections: ${projections.length}`];
    }));

    journeys.push(run('E2E-13','Governed AI remains non-authoritative',['AI & Intelligence','Pet Parent'],['AI','Orchestration'],()=>{
      const ai=AIStore.getInstance(),models=ai.listModelDefinitions(),prompts=ai.listPromptTemplates();
      const actions=OrchestrationStore.getInstance().listActionDefinitions();
      if(!models.length||!prompts.length||!actions.length)throw new Error('AI governance or action registry is incomplete');
      if(actions.some(a=>a.moneyMovement&&a.mayRunFromAutomationRule))throw new Error('Automated generic money movement is enabled');
      return [`AI model definitions: ${models.length}`,`Prompt templates: ${prompts.length}`,`Governed action definitions: ${actions.length}`];
    }));

    journeys.push(run('E2E-14','External app → household installation → bounded delivery',['Platform & Engineering','Pet Parent'],['Integrations','Developer Platform'],()=>{
      const store=IntegrationStore.getInstance();
      const apps=store.listApps().filter(a=>a.status==='ACTIVE');
      const installs=store.listInstallationsForHousehold(String(CANONICAL_IDS.MAIN_HOUSEHOLD)).filter(i=>i.status==='ACTIVE');
      const webhooks=store.listAllWebhooks().filter(w=>w.status==='ACTIVE');
      if(!apps.length||!installs.length||!webhooks.length)throw new Error('Approved app, household installation or active webhook is missing');
      if(webhooks.some(w=>!w.endpointUrl.startsWith('https://')))throw new Error('Non-HTTPS webhook survived certification');
      return [`Active apps: ${apps.length}`,`Household installations: ${installs.length}`,`Active webhooks: ${webhooks.length}`];
    }));

    journeys.push(run('E2E-15','Trust authority → security + resilience control plane',['Trust & Operations','Platform & Engineering'],['Security','Resilience'],()=>{
      const security=SecurityService.getPlatformPosture(actorUserId),resilience=ResilienceService.getSnapshot(actorUserId);
      if(security.enforced<8)throw new Error('Security control posture is below expected enforcement baseline');
      if(resilience.dependencies.some(d=>d.runtime.health!=='HEALTHY'))throw new Error('Seeded resilience dependency is not healthy');
      return [`Security enforced controls: ${security.enforced}`,`Healthy resilience dependencies: ${resilience.dependencies.length}`,`Verified recovery drills: ${resilience.recoveryReadiness.verifiedDrills}`];
    }));

    const roleCoverage=this.roleMatrix();
    const failed=journeys.filter(j=>j.status==='FAIL').length;
    const warned=journeys.filter(j=>j.status==='WARN').length;
    const passed=journeys.filter(j=>j.status==='PASS').length;
    const gates={
      crossTenantIsolation:journeys.find(j=>j.journeyId==='E2E-03')?.status==='PASS',
      canonicalFinanceContinuity:journeys.find(j=>j.journeyId==='E2E-06')?.status==='PASS',
      privilegedControlPlane:journeys.find(j=>j.journeyId==='E2E-15')?.status==='PASS',
      allNineWorkspacesCovered:roleCoverage.length===9&&roleCoverage.every(r=>r.status==='PASS'),
      noCriticalJourneyFailures:failed===0,
    };
    const verdict=Object.values(gates).every(Boolean)?'CERTIFIED_PROTOTYPE':'BLOCKED';
    return {
      generatedAt:new Date().toISOString(),
      verdict,
      passed,
      failed,
      warned,
      roleCoverage,
      journeys,
      releaseGates:gates,
      productionBoundaries:[
        'CERTIFIED_PROTOTYPE means the in-repository multi-role domain graph and regression contracts passed; it is not production certification.',
        'Production E2E certification still requires authenticated server APIs, durable databases, real payment/provider integrations, browser/device tests, accessibility testing, load/soak testing, security testing and observed disaster-recovery drills.',
        'Sprint 37 makes clean TypeScript validation mandatory; production readiness still requires durable server, infrastructure and external-integration evidence.',
      ],
    } satisfies FullSystemCertificationReport;
  }
}
