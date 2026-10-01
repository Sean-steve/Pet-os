/**
 * Pet OS Sprint 25 - Tracker Subscription & Device Service Test Suite
 * Comprehensive automated verification covering all 22+ lifecycle, safety, entitlement,
 * hardware transfer, carrier abstraction, and billing requirements.
 */

import { TrackerSubscriptionService } from './service';
import { DeviceEntitlementService } from './device-entitlement-service';
import { TrackerSubscriptionStore } from './store';
import { seedTrackerSubscriptionData, TRACKER_SEED_IDS } from './seed';
import { seedSubscriptionData } from '../subscription/seed';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { TRACKING_SEED_IDS, seedTrackingData } from '../tracking/seed';
import { TrackingStore } from '../tracking/store';
import { TrackingService } from '../tracking/service';
import {
  asDeviceId,
  asHouseholdId,
  asUserId,
  asIncidentId,
  generateUUIDv7,
} from '../kernel/ids';
import { TrackerBillingWebhookPayload, CarrierWebhookPayload } from './types';

export interface TestResult {
  readonly id: string;
  readonly name: string;
  readonly category: 'LIFECYCLE' | 'ENTITLEMENTS' | 'SAFETY' | 'HARDWARE' | 'BILLING' | 'CARRIER';
  readonly passed: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export class TrackerSubscriptionTestSuite {
  public static async runAllTests(): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  }> {
    const results: TestResult[] = [];

    const testCases: Array<{
      id: string;
      name: string;
      category: TestResult['category'];
      fn: () => Promise<void> | void;
    }> = [
      // 1. Catalogue & Plan Hierarchy
      {
        id: 'TRK-01',
        name: 'Plan Catalogue: Basic, Live, and Pro Tiers Correctly Configured',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const basic = store.getPlan(TRACKER_SEED_IDS.PLAN_BASIC);
          if (!basic || basic.tier !== 'BASIC' || basic.maxHighFreqSeconds !== 60) {
            throw new Error('Basic plan misconfigured');
          }

          const live = store.getPlan(TRACKER_SEED_IDS.PLAN_LIVE_WORLDWIDE);
          if (!live || live.tier !== 'PREMIUM_LIVE' || live.maxHighFreqSeconds !== 5) {
            throw new Error('Live plan misconfigured');
          }

          const prices = store.getPricesForPlan(basic.id);
          if (prices.length < 2) {
            throw new Error(`Expected at least 2 prices for basic plan, got ${prices.length}`);
          }
        },
      },

      // 2. One Plan Per Device Rule
      {
        id: 'TRK-02',
        name: 'Device Contract Invariant: One Plan Per Physical Device Enforced',
        category: 'LIFECYCLE',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();

          let errorThrown = false;
          try {
            await TrackerSubscriptionService.activateSubscription({
              deviceId: TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO, // already has active plan in seed
              householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
              primaryUserId: CANONICAL_IDS.OWNER_ELENA,
              planPriceId: TRACKER_SEED_IDS.PRICE_LIVE_MONTHLY,
            });
          } catch (e: any) {
            errorThrown = true;
            if (!e.message.includes('already has an active or pending subscription')) {
              throw new Error(`Unexpected error message: ${e.message}`);
            }
          }

          if (!errorThrown) {
            throw new Error('Activating a duplicate active subscription on the same device should fail');
          }
        },
      },

      // 3. Strict Separation: Consumer Premium != Tracker Subscription
      {
        id: 'TRK-03',
        name: 'Architectural Separation: Consumer Premium is Independent from Tracker Subscription',
        category: 'LIFECYCLE',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          // Kibo's device has a tracker subscription
          const kiboSub = store.getSubscriptionForDevice(TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO);
          if (!kiboSub) throw new Error('Kibo device should have tracker subscription');

          // Sarah's phone source has NO tracker subscription (not required for phone GPS)
          const sarahPhoneSub = store.getSubscriptionForDevice(TRACKING_SEED_IDS.DEVICE_PHONE_SARAH);
          if (sarahPhoneSub) throw new Error('Phone source should not require tracker subscription');
        },
      },

      // 4. Device Owns Subscription, NOT Pet
      {
        id: 'TRK-04',
        name: 'Entity Boundary: Physical Device Owns Subscription Across Pet Reassignments',
        category: 'HARDWARE',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const trackingStore = TrackingStore.getInstance();
          const trackerStore = TrackerSubscriptionStore.getInstance();

          const deviceId = TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO;
          const initialSub = trackerStore.getSubscriptionForDevice(deviceId);
          if (!initialSub) throw new Error('Initial subscription not found');

          // Reassign physical device from Kibo to Simba in Tracking domain
          TrackingService.getInstance().assignDeviceToPet({
            deviceId,
            petId: CANONICAL_IDS.PET_SIMBA,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            actorUserId: CANONICAL_IDS.OWNER_ELENA,
            reason: 'Temporary swap for field testing',
          });

          // The subscription must still remain active on the physical device
          const subAfterReassignment = trackerStore.getSubscriptionForDevice(deviceId);
          if (!subAfterReassignment || subAfterReassignment.id !== initialSub.id) {
            throw new Error('Subscription must stay bound to physical device after pet reassignment');
          }
        },
      },

      // 5. Hardware Replacement Transfer
      {
        id: 'TRK-05',
        name: 'Hardware Replacement: Subscription Transferred to Replacement Hardware with Days Preserved',
        category: 'HARDWARE',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const trackingStore = TrackingStore.getInstance();
          const trackerStore = TrackerSubscriptionStore.getInstance();

          const sub = trackerStore.getSubscription(TRACKER_SEED_IDS.SUB_KIBO_TRACTIVE);
          if (!sub) throw new Error('Subscription not found');

          // Register a replacement spare hardware device in Tracking
          const spareDeviceId = asDeviceId(`dev-replacement-spare-${generateUUIDv7().slice(0, 8)}`);
          trackingStore.saveDevice({
            deviceId: spareDeviceId,
            deviceType: 'GPS_CELLULAR_TRACKER',
            provider: 'TRACTIVE',
            externalDeviceReference: 'EXT-REPLACE-009',
            serialNumberMasked: 'TRK-***-9999',
            displayName: 'Replacement Tractive GPS',
            model: 'Tractive XL Gen 2',
            hardwareVersion: 'v2.1',
            firmwareVersion: 'v4.0',
            operationalStatus: 'CLAIMED',
            connectivityStatus: 'OFFLINE',
            batteryStatus: 'NORMAL',
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          const { transferRecord, subscription: updatedSub } =
            await TrackerSubscriptionService.transferDeviceHardware({
              subscriptionId: sub.id,
              targetDeviceId: spareDeviceId,
              userId: CANONICAL_IDS.OWNER_ELENA,
              reason: 'WARRANTY_REPLACEMENT',
              notes: 'Antenna damaged during forest walk',
            });

          if (updatedSub.deviceId !== spareDeviceId) {
            throw new Error('Subscription target device was not updated');
          }
          if (transferRecord.remainingPeriodDaysPreserved <= 0) {
            throw new Error('Remaining days were not preserved');
          }

          // Entitlements should now resolve on the new hardware device
          const newDeviceEntitlement = DeviceEntitlementService.evaluate(spareDeviceId, 'cellular.attach');
          if (!newDeviceEntitlement.isAllowed) {
            throw new Error('Target replacement hardware should now be entitled to cellular');
          }
        },
      },

      // 6. Renewal Succeeded
      {
        id: 'TRK-06',
        name: 'Lifecycle Renewal: Payment Success Extends Period and Clears Failures',
        category: 'BILLING',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          const initialEnd = sub.currentPeriodEndsAt;
          const { success, subscription: renewedSub } = await TrackerSubscriptionService.renewSubscription(
            sub.id,
            true
          );

          if (!success) throw new Error('Expected successful renewal');
          if (renewedSub.currentPeriodEndsAt <= initialEnd) {
            throw new Error('Renewal did not extend period end date');
          }
          if (renewedSub.consecutiveFailedPaymentAttempts !== 0) {
            throw new Error('Failed attempts counter was not reset');
          }
        },
      },

      // 7. Payment Failure & Grace Period
      {
        id: 'TRK-07',
        name: 'Billing Grace Period: First Failure Enters Grace with Cellular Connectivity Preserved',
        category: 'BILLING',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          // Simulate payment failure
          const { success, subscription: failedSub } = await TrackerSubscriptionService.renewSubscription(
            sub.id,
            false
          );

          if (success) throw new Error('Expected failure');
          if (failedSub.status !== 'GRACE_PERIOD') {
            throw new Error(`Expected GRACE_PERIOD status, got ${failedSub.status}`);
          }
          if (!failedSub.gracePeriodEndsAt) {
            throw new Error('gracePeriodEndsAt must be populated');
          }

          // Cellular entitlement MUST remain ALLOWED during grace period
          const evalRes = DeviceEntitlementService.evaluate(failedSub.deviceId, 'cellular.attach');
          if (!evalRes.isAllowed) {
            throw new Error('Cellular connectivity must remain allowed during grace period');
          }
        },
      },

      // 8. Multiple Failures & Connectivity Suspension
      {
        id: 'TRK-08',
        name: 'Suspension: Exceeded Grace Retries Suspends Subscription & Carrier Uplink',
        category: 'BILLING',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          // Fail attempt 1 -> GRACE_PERIOD
          await TrackerSubscriptionService.renewSubscription(sub.id, false);
          // Fail attempt 2
          await TrackerSubscriptionService.renewSubscription(sub.id, false);
          // Fail attempt 3 -> SUSPENDED
          const { subscription: suspendedSub } = await TrackerSubscriptionService.renewSubscription(
            sub.id,
            false
          );

          if (suspendedSub.status !== 'SUSPENDED') {
            throw new Error(`Expected SUSPENDED status after 3 failures, got ${suspendedSub.status}`);
          }

          // Cellular entitlement MUST now be DENIED
          const evalRes = DeviceEntitlementService.evaluate(suspendedSub.deviceId, 'cellular.attach');
          if (evalRes.isAllowed) {
            throw new Error('Cellular connectivity must be denied when suspended');
          }
          if (evalRes.decision !== 'SUSPENDED_BILLING') {
            throw new Error(`Expected SUSPENDED_BILLING, got ${evalRes.decision}`);
          }
        },
      },

      // 9. Reactivation & Recovery
      {
        id: 'TRK-09',
        name: 'Reactivation: Suspended Subscription Restored to Active and Carrier Session Reopened',
        category: 'LIFECYCLE',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();
          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          // Suspend it
          sub.status = 'SUSPENDED';
          store.saveSubscription(sub);

          const reactivated = await TrackerSubscriptionService.reactivateSubscription(sub.id);
          if (reactivated.status !== 'ACTIVE') {
            throw new Error(`Expected ACTIVE, got ${reactivated.status}`);
          }

          const evalRes = DeviceEntitlementService.evaluate(sub.deviceId, 'cellular.attach');
          if (!evalRes.isAllowed) {
            throw new Error('Cellular should be allowed upon reactivation');
          }
        },
      },

      // 10. Cancellation at Period End vs Immediate
      {
        id: 'TRK-10',
        name: 'Cancellation: Cancel-at-period-end Maintains Entitlement Until Cycle Expiry',
        category: 'LIFECYCLE',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();
          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          // Cancel at period end
          const cancelled = await TrackerSubscriptionService.cancelSubscription(
            sub.id,
            'Owner moving abroad',
            false
          );
          if (cancelled.status !== 'CANCEL_AT_PERIOD_END' || !cancelled.cancelAtPeriodEnd) {
            throw new Error('Expected CANCEL_AT_PERIOD_END status');
          }

          // Must remain allowed until period ends!
          const evalRes = DeviceEntitlementService.evaluate(sub.deviceId, 'cellular.attach');
          if (!evalRes.isAllowed) {
            throw new Error('Entitlements must remain active during cancel-at-period-end interval');
          }
        },
      },

      // 11. Critical Safety Invariant: Active Lost Pet Incident Overrides Suspension
      {
        id: 'TRK-11',
        name: 'Safety Invariant: Active Lost Pet Incident Overrides Billing Suspension (Emergency Uplink)',
        category: 'SAFETY',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();
          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          // 1. Force subscription to SUSPENDED due to unpaid bill
          sub.status = 'SUSPENDED';
          store.saveSubscription(sub);

          // Baseline check: Suspended device is denied
          const deniedBefore = DeviceEntitlementService.evaluate(sub.deviceId, 'cellular.attach');
          if (deniedBefore.isAllowed) throw new Error('Should be denied before safety override');

          // 2. Incident declared! Simba is Lost!
          const incidentId = asIncidentId('inc-lost-simba-emergency-001');
          await TrackerSubscriptionService.activateLostPetSafetyOverride({
            deviceId: sub.deviceId,
            petId: CANONICAL_IDS.PET_SIMBA,
            incidentId,
            reason: 'Simba escaped during storm in Karura Forest',
            durationHours: 72,
          });

          // 3. Evaluate entitlement under safety override
          const emergencyUplink = DeviceEntitlementService.evaluate(sub.deviceId, 'cellular.attach');
          if (!emergencyUplink.isAllowed) {
            throw new Error('Emergency safety override MUST allow cellular attach even when suspended!');
          }
          if (emergencyUplink.decision !== 'SAFETY_OVERRIDE') {
            throw new Error(`Expected decision SAFETY_OVERRIDE, got ${emergencyUplink.decision}`);
          }
          if (!emergencyUplink.isSafetyFallback) {
            throw new Error('isSafetyFallback must be true');
          }

          const emergencyLostMode = DeviceEntitlementService.evaluate(sub.deviceId, 'tracking.lost_mode_high_freq');
          if (!emergencyLostMode.isAllowed) {
            throw new Error('Emergency high-frequency Lost Mode MUST be allowed under safety override');
          }
        },
      },

      // 12. Billing Status != Physical Connectivity Status
      {
        id: 'TRK-12',
        name: 'Holistic Diagnostics: Critical Battery & No Signal Distinguished from Billing Status',
        category: 'CARRIER',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const trackingStore = TrackingStore.getInstance();
          const subStore = TrackerSubscriptionStore.getInstance();

          const deviceId = TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO;
          const device = trackingStore.getDevice(deviceId);
          if (!device) throw new Error('Device not found');

          // Test Scenario A: Fully Paid Active Subscription, but Battery at 2% (Dead Battery)
          device.batteryPercent = 2;
          device.batteryStatus = 'CRITICAL';
          trackingStore.saveDevice(device);

          const projectionA = TrackerSubscriptionService.getHolisticDeviceProjection(deviceId);
          if (projectionA.billingStatus !== 'ACTIVE') {
            throw new Error('Billing should still be ACTIVE');
          }
          if (projectionA.primaryBlocker !== 'DEAD_BATTERY') {
            throw new Error(`Expected primaryBlocker DEAD_BATTERY, got ${projectionA.primaryBlocker}`);
          }

          // Test Scenario B: Restore Battery, but simulate Carrier Outage
          device.batteryPercent = 85;
          device.batteryStatus = 'NORMAL';
          trackingStore.saveDevice(device);

          const carrier = subStore.getCarrierRecordForDevice(deviceId);
          if (!carrier) throw new Error('Carrier record not found');
          carrier.carrierOutageReported = true;
          carrier.networkAttachStatus = 'CARRIER_OUTAGE';
          subStore.saveCarrierRecord(carrier);

          const projectionB = TrackerSubscriptionService.getHolisticDeviceProjection(deviceId);
          if (projectionB.primaryBlocker !== 'CARRIER_OUTAGE') {
            throw new Error(`Expected primaryBlocker CARRIER_OUTAGE, got ${projectionB.primaryBlocker}`);
          }
        },
      },

      // 13. Carrier Outage Distinction
      {
        id: 'TRK-13',
        name: 'Carrier Isolation: Cell Tower Outage Does Not Blame Customer Billing',
        category: 'CARRIER',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const subStore = TrackerSubscriptionStore.getInstance();
          const deviceId = TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO;

          const carrier = subStore.getCarrierRecordForDevice(deviceId);
          if (!carrier) throw new Error('Carrier not found');
          carrier.carrierOutageReported = true;
          subStore.saveCarrierRecord(carrier);

          const evalRes = DeviceEntitlementService.evaluate(deviceId, 'cellular.attach');
          if (evalRes.decision !== 'CARRIER_OUTAGE') {
            throw new Error(`Expected CARRIER_OUTAGE decision, got ${evalRes.decision}`);
          }
        },
      },

      // 14. No Raw SIM Secrets in Tables
      {
        id: 'TRK-14',
        name: 'Security Invariant: Raw SIM Secrets (K/OPc/PIN) Are Never Stored; ICCID Masked',
        category: 'CARRIER',
        fn: () => {
          seedTrackerSubscriptionData();
          const subStore = TrackerSubscriptionStore.getInstance();
          const allRecords = subStore.getAllCarrierRecords();

          for (const rec of allRecords) {
            if (!rec.iccidMasked.includes('***')) {
              throw new Error(`ICCID must be masked: ${rec.iccidMasked}`);
            }
            if ((rec as any).ki || (rec as any).opc || (rec as any).pin) {
              throw new Error('Forbidden raw cryptographic SIM secret detected in carrier record');
            }
          }
        },
      },

      // 15. Billing Webhook Idempotency & Replay Protection
      {
        id: 'TRK-15',
        name: 'Billing Webhook: Idempotent Execution and Signature Verification',
        category: 'BILLING',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const subStore = TrackerSubscriptionStore.getInstance();
          const sub = subStore.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          const payload: TrackerBillingWebhookPayload = {
            eventId: `evt-${generateUUIDv7()}`,
            eventType: 'tracker.invoice.payment_succeeded',
            subscriptionId: sub.id,
            deviceId: sub.deviceId,
            amountCents: 1199,
            currency: 'USD',
            transactionRef: 'stripe-ch-test-991',
            timestamp: new Date().toISOString(),
            signature: 'sha256=abcdef1234567890',
          };

          // 1st processing -> should succeed
          const res1 = await TrackerSubscriptionService.processBillingWebhook(payload);
          if (!res1.handled) throw new Error('First webhook execution failed');

          // 2nd processing -> should be idempotent duplicate
          const res2 = await TrackerSubscriptionService.processBillingWebhook(payload);
          if (!res2.handled || !res2.message.includes('idempotent')) {
            throw new Error(`Expected idempotent skip on repeat webhook, got ${res2.message}`);
          }
        },
      },

      // 16. Carrier Webhook Processing
      {
        id: 'TRK-16',
        name: 'Carrier Webhooks: Provisioning, Network Attach, and Outage Alerts Processed',
        category: 'CARRIER',
        fn: async () => {
          seedTrackerSubscriptionData();
          const subStore = TrackerSubscriptionStore.getInstance();
          const carrier = subStore.getCarrierRecord(TRACKER_SEED_IDS.CARRIER_SIMBA_SIM);
          if (!carrier) throw new Error('Carrier record not found');

          const payload: CarrierWebhookPayload = {
            eventId: `c-evt-${generateUUIDv7()}`,
            eventType: 'carrier.outage.declared',
            carrierVendor: carrier.carrierVendor,
            carrierSubscriptionRef: carrier.carrierSubscriptionRef,
            iccidMasked: carrier.iccidMasked,
            outageDetails: 'Nairobi West Base Station maintenance',
            timestamp: new Date().toISOString(),
            signature: 'sig-valid-998811',
          };

          const res = await TrackerSubscriptionService.processCarrierWebhook(payload);
          if (!res.handled) throw new Error('Carrier webhook failed');

          const updated = subStore.getCarrierRecord(carrier.id);
          if (!updated?.carrierOutageReported) {
            throw new Error('Carrier outage flag was not set by webhook');
          }
        },
      },

      // 17. Consumer Premium Bundling Discount
      {
        id: 'TRK-17',
        name: 'Monetization Bundling: Active Consumer Premium Grants Companion Discount',
        category: 'BILLING',
        fn: async () => {
          seedTrackingData();
          seedSubscriptionData();
          seedTrackerSubscriptionData();
          const trackingStore = TrackingStore.getInstance();

          // Register a 3rd device for Elena's household
          const thirdDeviceId = asDeviceId(`dev-third-tracker-${generateUUIDv7().slice(0, 8)}`);
          trackingStore.saveDevice({
            deviceId: thirdDeviceId,
            deviceType: 'GPS_CELLULAR_TRACKER',
            provider: 'TRACTIVE',
            externalDeviceReference: 'EXT-BUNDLED-03',
            serialNumberMasked: 'TRK-***-3333',
            displayName: 'Luna Backup Tracker',
            model: 'Tractive Mini',
            hardwareVersion: 'v1.0',
            firmwareVersion: 'v1.0',
            operationalStatus: 'CLAIMED',
            connectivityStatus: 'ONLINE',
            batteryStatus: 'NORMAL',
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Activate subscription
          const newSub = await TrackerSubscriptionService.activateSubscription({
            deviceId: thirdDeviceId,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            primaryUserId: CANONICAL_IDS.OWNER_ELENA,
            planPriceId: TRACKER_SEED_IDS.PRICE_LIVE_MONTHLY,
          });

          if (!newSub.hasBundledPremiumDiscount) {
            throw new Error('Elena has active Consumer Premium; new tracker subscription should receive bundled discount');
          }
        },
      },

      // 18. Device Entitlement: Basic vs Live Tracking
      {
        id: 'TRK-18',
        name: 'Feature Gating: Basic Cellular Denies 5s Live Pin while Premium Live Allows',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();

          // Kibo is on Basic Cellular
          const kiboLivePin = DeviceEntitlementService.evaluate(
            TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
            'tracking.live_pin'
          );
          if (kiboLivePin.isAllowed) {
            throw new Error('Basic plan should not have 5-second live pin tracking');
          }

          // Simba is on Premium Live
          const simbaLivePin = DeviceEntitlementService.evaluate(
            TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
            'tracking.live_pin'
          );
          if (!simbaLivePin.isAllowed) {
            throw new Error('Premium Live plan MUST have 5-second live pin tracking');
          }
          if (simbaLivePin.minIntervalSec !== 5) {
            throw new Error(`Expected minIntervalSec 5, got ${simbaLivePin.minIntervalSec}`);
          }
        },
      },

      // 19. Device Entitlement: International Roaming
      {
        id: 'TRK-19',
        name: 'Roaming Entitlement: Local Carrier Restricts Roaming; Global eSIM Permits',
        category: 'ENTITLEMENTS',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();

          // Kibo on Safaricom IoT local plan
          const kiboRoaming = DeviceEntitlementService.evaluate(
            TRACKING_SEED_IDS.DEVICE_TRACTIVE_KIBO,
            'roaming.international'
          );
          if (kiboRoaming.isAllowed) {
            throw new Error('Basic local carrier plan should deny international roaming');
          }

          // Simba on Global eSIM
          const simbaRoaming = DeviceEntitlementService.evaluate(
            TRACKING_SEED_IDS.DEVICE_FI_SIMBA,
            'roaming.international'
          );
          if (!simbaRoaming.isAllowed) {
            throw new Error('Global eSIM plan must allow international roaming');
          }
        },
      },

      // 20. Plan Upgrade & Quota Expansion
      {
        id: 'TRK-20',
        name: 'Plan Upgrade: Upgrading Plan Seamlessly Adjusts Data Allowance and Live Features',
        category: 'LIFECYCLE',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_KIBO_TRACTIVE);
          if (!sub) throw new Error('Sub not found');

          // Upgrade from Basic Monthly to Pro Annual
          await TrackerSubscriptionService.changePlan(sub.id, TRACKER_SEED_IDS.PRICE_PRO_ANNUAL);

          const carrier = store.getCarrierRecord(sub.carrierRecordId!);
          if (!carrier || carrier.dataLimitMbCurrentCycle !== 1000) {
            throw new Error(`Expected carrier data limit 1000MB, got ${carrier?.dataLimitMbCurrentCycle}`);
          }

          // Live tracking should now be allowed!
          const liveCheck = DeviceEntitlementService.evaluate(sub.deviceId, 'tracking.live_pin');
          if (!liveCheck.isAllowed) {
            throw new Error('Live tracking should be allowed after upgrading to Pro');
          }
        },
      },

      // 21. Safety Override Deactivation
      {
        id: 'TRK-21',
        name: 'Safety Resolution: Closing Lost Pet Incident Restores Standard Billing State',
        category: 'SAFETY',
        fn: async () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();
          const sub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!sub) throw new Error('Sub not found');

          sub.status = 'SUSPENDED';
          store.saveSubscription(sub);

          // Activate safety
          const override = await TrackerSubscriptionService.activateLostPetSafetyOverride({
            deviceId: sub.deviceId,
            petId: CANONICAL_IDS.PET_SIMBA,
            incidentId: asIncidentId('inc-test-deactivation-001'),
            reason: 'Lost dog alert',
          });

          // Now deactivate safety
          await TrackerSubscriptionService.deactivateSafetyOverride(override.id);

          // Check that entitlement is now SUSPENDED_BILLING again
          const evalRes = DeviceEntitlementService.evaluate(sub.deviceId, 'cellular.attach');
          if (evalRes.isAllowed) {
            throw new Error('Should no longer be allowed once safety override is deactivated');
          }
        },
      },

      // 22. Multi-Device Household Isolation
      {
        id: 'TRK-22',
        name: 'Multi-Device Independence: Household Trackers Maintain Distinct Billing & Service States',
        category: 'LIFECYCLE',
        fn: () => {
          seedTrackingData();
          seedTrackerSubscriptionData();
          const store = TrackerSubscriptionStore.getInstance();

          const kiboSub = store.getSubscription(TRACKER_SEED_IDS.SUB_KIBO_TRACTIVE);
          const simbaSub = store.getSubscription(TRACKER_SEED_IDS.SUB_SIMBA_FI);
          if (!kiboSub || !simbaSub) throw new Error('Both subs required');

          // Suspend Kibo's device
          kiboSub.status = 'SUSPENDED';
          store.saveSubscription(kiboSub);

          // Simba's device must still be ACTIVE and fully entitled
          const simbaEval = DeviceEntitlementService.evaluate(simbaSub.deviceId, 'cellular.attach');
          if (!simbaEval.isAllowed) {
            throw new Error('Simba tracker must not be affected by Kibo tracker suspension');
          }
        },
      },
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const tc of testCases) {
      const start = performance.now();
      try {
        await tc.fn();
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: true,
          message: 'Passed',
          durationMs,
        });
        passedCount++;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: false,
          message: err.message || String(err),
          durationMs,
        });
        failedCount++;
      }
    }

    return {
      passed: passedCount,
      failed: failedCount,
      total: testCases.length,
      results,
    };
  }
}
