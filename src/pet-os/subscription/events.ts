/**
 * Pet OS Subscription & Entitlements Domain - Domain & Integration Events
 * Implements Volume XXIX: Event, Command & Asynchronous Architecture.
 */

import {
  ConsumerSubscriptionId,
  EntitlementGrantId,
  UserId,
  HouseholdId,
  PlanVersionId,
  PlanPriceId,
  SubscriptionInvoiceId,
  SupportGrantId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode } from '../kernel/money';
import { SubscriptionStatus } from './types';

export interface BaseSubscriptionEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly actorUserId?: UserId;
}

export interface ConsumerSubscriptionCreatedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionCreated';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly planVersionId: PlanVersionId;
  readonly planPriceId: PlanPriceId;
  readonly status: SubscriptionStatus;
}

export interface ConsumerSubscriptionActivatedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionActivated';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly planVersionId: PlanVersionId;
  readonly currency: CurrencyCode;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
}

export interface ConsumerSubscriptionRenewedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionRenewed';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly previousPeriodEnd: string;
  readonly newPeriodEnd: string;
  readonly invoiceId: SubscriptionInvoiceId;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export interface ConsumerSubscriptionPaymentFailedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionPaymentFailed';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly failureReason: string;
  readonly gracePeriodEnd: string;
}

export interface ConsumerSubscriptionEnteredGracePeriodEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionEnteredGracePeriod';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly gracePeriodEnd: string;
}

export interface ConsumerSubscriptionRecoveredEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionRecovered';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
}

export interface ConsumerSubscriptionCancellationScheduledEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionCancellationScheduled';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly effectiveAt: string;
  readonly reason?: string;
}

export interface ConsumerSubscriptionCancelledEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionCancelled';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
}

export interface ConsumerSubscriptionExpiredEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionExpired';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
}

export interface ConsumerSubscriptionReactivatedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionReactivated';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
}

export interface ConsumerSubscriptionPlanChangedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'ConsumerSubscriptionPlanChanged';
  readonly subscriptionId: ConsumerSubscriptionId;
  readonly ownerId: HouseholdId | UserId;
  readonly previousPlanVersionId: PlanVersionId;
  readonly newPlanVersionId: PlanVersionId;
  readonly effectiveTiming: 'IMMEDIATE' | 'NEXT_RENEWAL';
}

export interface EntitlementGrantedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'EntitlementGranted';
  readonly grantId: EntitlementGrantId;
  readonly subjectId: string;
  readonly entitlementCode: string;
  readonly value: any;
}

export interface EntitlementRevokedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'EntitlementRevoked';
  readonly grantId: EntitlementGrantId;
  readonly subjectId: string;
  readonly entitlementCode: string;
  readonly reason: string;
}

export interface EntitlementLimitReachedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'EntitlementLimitReached';
  readonly subjectId: string;
  readonly entitlementCode: string;
  readonly currentUsage: number;
  readonly maxLimit: number;
}

export interface EntitlementReconciledEvent extends BaseSubscriptionEvent {
  readonly eventType: 'EntitlementReconciled';
  readonly checkedCount: number;
  readonly repairedCount: number;
}

export interface SupportGrantCreatedEvent extends BaseSubscriptionEvent {
  readonly eventType: 'SupportGrantCreated';
  readonly grantId: SupportGrantId;
  readonly subjectId: string;
  readonly authorizedByUserId: UserId;
  readonly reason: string;
  readonly validUntil: string;
}

export type SubscriptionDomainEvent =
  | ConsumerSubscriptionCreatedEvent
  | ConsumerSubscriptionActivatedEvent
  | ConsumerSubscriptionRenewedEvent
  | ConsumerSubscriptionPaymentFailedEvent
  | ConsumerSubscriptionEnteredGracePeriodEvent
  | ConsumerSubscriptionRecoveredEvent
  | ConsumerSubscriptionCancellationScheduledEvent
  | ConsumerSubscriptionCancelledEvent
  | ConsumerSubscriptionExpiredEvent
  | ConsumerSubscriptionReactivatedEvent
  | ConsumerSubscriptionPlanChangedEvent
  | EntitlementGrantedEvent
  | EntitlementRevokedEvent
  | EntitlementLimitReachedEvent
  | EntitlementReconciledEvent
  | SupportGrantCreatedEvent;

export type SubscriptionEventPayload =
  | Omit<ConsumerSubscriptionCreatedEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionActivatedEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionRenewedEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionPaymentFailedEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionEnteredGracePeriodEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionRecoveredEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionCancellationScheduledEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionCancelledEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionExpiredEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionReactivatedEvent, 'eventId' | 'timestamp'>
  | Omit<ConsumerSubscriptionPlanChangedEvent, 'eventId' | 'timestamp'>
  | Omit<EntitlementGrantedEvent, 'eventId' | 'timestamp'>
  | Omit<EntitlementRevokedEvent, 'eventId' | 'timestamp'>
  | Omit<EntitlementLimitReachedEvent, 'eventId' | 'timestamp'>
  | Omit<EntitlementReconciledEvent, 'eventId' | 'timestamp'>
  | Omit<SupportGrantCreatedEvent, 'eventId' | 'timestamp'>;

export class SubscriptionOutbox {
  private static events: SubscriptionDomainEvent[] = [];

  public static publish(event: SubscriptionEventPayload): SubscriptionDomainEvent {
    const fullEvent = {
      ...event,
      eventId: generateUUIDv7(),
      timestamp: new Date().toISOString(),
    } as SubscriptionDomainEvent;

    this.events.push(fullEvent);
    return fullEvent;
  }

  public static getEvents(): readonly SubscriptionDomainEvent[] {
    return [...this.events];
  }

  public static clear(): void {
    this.events = [];
  }
}
