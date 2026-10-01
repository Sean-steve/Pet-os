/**
 * Pet OS Sprint 26 - Provider SaaS Active Service Continuity Engine
 * 
 * Critical Animal Safety & Operational Continuity Invariant:
 * Commercial subscription expiration or billing disputes MUST NEVER disrupt
 * active pet care, custody, clinical care, dog walking, or transport.
 * 
 * Scoped continuity grants temporarily bridge essential operational capabilities
 * until the animal is safely returned to owner custody or the clinical encounter concludes.
 */

import {
  BusinessId,
  ProviderId,
  PetId,
  ProviderSaaSContinuityGrantId,
  asProviderSaaSContinuityGrantId,
  generateUUIDv7,
} from '../kernel/ids';
import { ActiveServiceSafetyType, ProviderSaaSContinuityGrant } from './types';
import { ProviderSaaSStore } from './store';

export class ProviderSaaSContinuityEngine {
  /**
   * Evaluates if a business or provider requires active service continuity protection.
   * If an active service or custody obligation exists, ensures a scoped continuity grant is active.
   */
  public static ensureContinuityGrant(params: {
    businessId?: BusinessId;
    providerId?: ProviderId;
    serviceType: ActiveServiceSafetyType;
    contextId: string;
    petId: PetId;
    reason: string;
    durationHours?: number;
  }): ProviderSaaSContinuityGrant {
    const store = ProviderSaaSStore.getInstance();
    const existing = store.getContinuityGrantByContext(params.contextId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const duration = params.durationHours ?? 72; // standard 72h maximum safety window
    const expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();

    const grant: ProviderSaaSContinuityGrant = {
      grantId: asProviderSaaSContinuityGrantId(`cnt-grt-${generateUUIDv7().slice(0, 18)}`),
      businessId: params.businessId,
      providerId: params.providerId,
      serviceType: params.serviceType,
      contextId: params.contextId,
      petId: params.petId,
      reason: params.reason,
      activatedAt: now.toISOString(),
      expiresAt,
      isActive: true,
      auditLog: [
        `Continuity shield engaged at ${now.toISOString()} for active ${params.serviceType} (${params.contextId}).`,
      ],
    };

    store.saveContinuityGrant(grant);
    store.logAudit('PROVIDER_SAAS_CONTINUITY_GRANTED', {
      grantId: grant.grantId,
      serviceType: params.serviceType,
      contextId: params.contextId,
      petId: params.petId,
      expiresAt,
    });

    return grant;
  }

  /**
   * Resolves a continuity grant when service is completed or custody is safely returned.
   */
  public static resolveContinuityGrant(contextId: string, resolutionNote?: string): boolean {
    const store = ProviderSaaSStore.getInstance();
    const grant = store.getContinuityGrantByContext(contextId);
    if (!grant) return false;

    grant.isActive = false;
    grant.auditLog.push(
      `Continuity shield safely concluded at ${new Date().toISOString()}: ${resolutionNote || 'Service safely completed.'}`
    );
    store.saveContinuityGrant(grant);

    store.logAudit('PROVIDER_SAAS_CONTINUITY_ENDED', {
      grantId: grant.grantId,
      contextId,
      serviceType: grant.serviceType,
    });

    return true;
  }

  /**
   * Checks whether an active continuity grant covers the given business or provider for safety-critical execution.
   */
  public static hasActiveContinuityProtection(params: {
    businessId?: BusinessId;
    providerId?: ProviderId;
    contextId?: string;
  }): boolean {
    const store = ProviderSaaSStore.getInstance();

    if (params.contextId) {
      const grant = store.getContinuityGrantByContext(params.contextId);
      if (grant && grant.isActive) return true;
    }

    if (params.businessId) {
      const bizGrants = store.getActiveContinuityGrantsForBusiness(params.businessId);
      if (bizGrants.length > 0) return true;
    }

    if (params.providerId) {
      const prvGrants = store.getActiveContinuityGrantsForProvider(params.providerId);
      if (prvGrants.length > 0) return true;
    }

    return false;
  }
}
