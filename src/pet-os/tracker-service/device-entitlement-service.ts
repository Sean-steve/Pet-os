/**
 * Pet OS Sprint 25 - Device Entitlement Decision Engine
 * Authoritative evaluation of device-level capabilities.
 * 
 * Rules:
 * 1. Single source of truth for device cellular/telemetry permissions.
 * 2. Active Lost Pet Safety Fallback overrides payment suspensions.
 * 3. Grace period preserves connectivity while alert is dispatched.
 * 4. Billing status != Device physical connectivity.
 */

import { DeviceId } from '../kernel/ids';
import {
  DeviceEntitlementKey,
  DeviceEntitlementDecision,
  TrackerSubscription,
  TrackerCarrierServiceRecord,
  TrackerServicePlan,
} from './types';
import { TrackerSubscriptionStore } from './store';

export class DeviceEntitlementService {
  /**
   * Evaluates if a given device is entitled to a specific capability.
   */
  public static evaluate(
    deviceId: DeviceId,
    entitlement: DeviceEntitlementKey
  ): DeviceEntitlementDecision {
    const store = TrackerSubscriptionStore.getInstance();
    const evaluatedAt = new Date().toISOString();

    // 1. Check for Active Lost Pet Safety Override
    const safetyOverride = store.getActiveSafetyOverride(deviceId);
    if (safetyOverride) {
      if (
        entitlement === 'cellular.attach' ||
        entitlement === 'telemetry.upload' ||
        entitlement === 'tracking.lost_mode_high_freq' ||
        entitlement === 'geofence.cellular_alerts'
      ) {
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'SAFETY_OVERRIDE',
          reason: `Active Lost Pet Incident (${safetyOverride.incidentId}): Emergency safety uplink active until ${safetyOverride.expiresAt}.`,
          isSafetyFallback: true,
          minIntervalSec: 5,
          evaluatedAt,
        };
      }
    }

    // 2. Fetch Subscription
    const subscription = store.getSubscriptionForDevice(deviceId);
    if (!subscription) {
      return {
        deviceId,
        entitlement,
        isAllowed: false,
        decision: 'REQUIRES_ACTIVATION',
        reason: 'Device has no active connectivity subscription.',
        isSafetyFallback: false,
        evaluatedAt,
      };
    }

    // 3. Fetch Plan & Carrier Record
    const plan = store.getPlan(subscription.planId);
    const carrier = store.getCarrierRecordForDevice(deviceId);

    // 4. Check Carrier Outage status
    if (carrier?.carrierOutageReported && entitlement === 'cellular.attach') {
      return {
        deviceId,
        entitlement,
        isAllowed: false,
        decision: 'CARRIER_OUTAGE',
        reason: `Upstream cellular carrier outage detected (${carrier.carrierVendor}). Device service contract is valid, but network cell is currently degraded.`,
        isSafetyFallback: false,
        evaluatedAt,
      };
    }

    // 5. Evaluate Subscription Status
    const nowIso = new Date().toISOString();
    const isInGracePeriod =
      subscription.status === 'GRACE_PERIOD' &&
      !!subscription.gracePeriodEndsAt &&
      subscription.gracePeriodEndsAt > nowIso;

    const isSubscriptionActive =
      subscription.status === 'ACTIVE' ||
      subscription.status === 'TRIALING' ||
      subscription.status === 'CANCEL_AT_PERIOD_END' ||
      isInGracePeriod;

    if (!isSubscriptionActive) {
      return {
        deviceId,
        entitlement,
        isAllowed: false,
        decision: 'SUSPENDED_BILLING',
        reason: `Device subscription is ${subscription.status}. Cellular uplink suspended until payment resolution.`,
        isSafetyFallback: false,
        evaluatedAt,
      };
    }

    // 6. Capability evaluation based on plan
    if (!plan) {
      return {
        deviceId,
        entitlement,
        isAllowed: false,
        decision: 'DENIED',
        reason: 'Associated tracker service plan could not be located.',
        isSafetyFallback: false,
        evaluatedAt,
      };
    }

    const quotaRemainingMb = carrier
      ? Math.max(0, carrier.dataLimitMbCurrentCycle - carrier.dataUsageMbCurrentCycle)
      : plan.cellularDataAllowanceMbPerMonth;

    switch (entitlement) {
      case 'cellular.attach':
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'ALLOWED',
          reason: 'Active device subscription with valid carrier profile.',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          quotaRemainingMb,
          evaluatedAt,
        };

      case 'telemetry.upload':
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'ALLOWED',
          reason: 'Telemetry upload permitted under active plan allowance.',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          quotaRemainingMb,
          evaluatedAt,
        };

      case 'tracking.live_pin':
        // High frequency live pin (e.g. 5s-10s live updates) requires Premium Live or Pro Safety
        if (plan.tier === 'BASIC') {
          return {
            deviceId,
            entitlement,
            isAllowed: false,
            decision: 'DENIED',
            reason: 'Basic Cellular plan supports standard 60-second updates. Live 5-second tracking requires Premium Live.',
            effectivePlanTier: plan.tier,
            isSafetyFallback: false,
            minIntervalSec: 60,
            evaluatedAt,
          };
        }
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'ALLOWED',
          reason: 'High-frequency live tracking active.',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          minIntervalSec: plan.maxHighFreqSeconds,
          evaluatedAt,
        };

      case 'tracking.lost_mode_high_freq':
        return {
          deviceId,
          entitlement,
          isAllowed: plan.supportsLostModeHighFreq,
          decision: plan.supportsLostModeHighFreq ? 'ALLOWED' : 'DENIED',
          reason: plan.supportsLostModeHighFreq
            ? 'High frequency emergency lost mode active.'
            : 'Plan does not support high-frequency emergency lost mode.',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          minIntervalSec: 5,
          evaluatedAt,
        };

      case 'tracking.extended_retention':
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'ALLOWED',
          reason: `${plan.retentionDays} days of telemetry retention entitled.`,
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          historyRetentionDays: plan.retentionDays,
          evaluatedAt,
        };

      case 'geofence.cellular_alerts':
        return {
          deviceId,
          entitlement,
          isAllowed: true,
          decision: 'ALLOWED',
          reason: 'Cellular geofence breach alerting active.',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          evaluatedAt,
        };

      case 'roaming.international':
        return {
          deviceId,
          entitlement,
          isAllowed: plan.supportsInternationalRoaming,
          decision: plan.supportsInternationalRoaming ? 'ALLOWED' : 'DENIED',
          reason: plan.supportsInternationalRoaming
            ? 'International eSIM roaming active across 175+ countries.'
            : 'Plan is restricted to local carrier network (Kenya / East Africa).',
          effectivePlanTier: plan.tier,
          isSafetyFallback: false,
          evaluatedAt,
        };

      default:
        return {
          deviceId,
          entitlement,
          isAllowed: false,
          decision: 'DENIED',
          reason: `Unknown entitlement ${entitlement}`,
          isSafetyFallback: false,
          evaluatedAt,
        };
    }
  }
}
