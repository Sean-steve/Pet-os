
import type { Brand, UserId, HouseholdId, PetId } from '../kernel/ids';

export type DeveloperAppId = Brand<string, 'DeveloperAppId'>;
export type IntegrationInstallationId = Brand<string, 'IntegrationInstallationId'>;
export type ApiCredentialId = Brand<string, 'ApiCredentialId'>;
export type WebhookSubscriptionId = Brand<string, 'WebhookSubscriptionId'>;
export type WebhookDeliveryId = Brand<string, 'WebhookDeliveryId'>;
export type IntegrationAuditEventId = Brand<string, 'IntegrationAuditEventId'>;

export type IntegrationScope =
  | 'pet:profile:read'
  | 'care:read'
  | 'booking:read'
  | 'tracker:health:read'
  | 'command-center:read'
  | 'webhook:manage';

export const FORBIDDEN_EXTERNAL_SCOPES = [
  'tracking:exact-location:read',
  'tracking:route-history:read',
  'health:clinical-record:write',
  'health:prescription:write',
  'finance:payment:execute',
  'finance:payout:execute',
  'commerce:purchase:execute',
  'lost-pet:close',
  'orchestration:action:execute',
  'identity:ownership:write',
] as const;

export type DeveloperAppStatus = 'DRAFT' | 'UNDER_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type InstallationStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type CredentialStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
export type WebhookStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED';
export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'RETRY_SCHEDULED' | 'PERMANENT_FAILURE' | 'DEAD_LETTER';

export type PublicIntegrationEventType =
  | 'pet.profile.updated'
  | 'care.status.changed'
  | 'booking.status.changed'
  | 'tracker.health.changed'
  | 'command-center.attention.changed';

export interface PlatformIntegrationReviewer {
  userId: UserId;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: Array<'APP_REVIEW' | 'SECURITY_REVIEW' | 'INCIDENT_RESPONSE'>;
  grantedAt: string;
  grantedBy: string;
  revokedAt?: string;
}

export interface DeveloperApp {
  developerAppId: DeveloperAppId;
  name: string;
  description: string;
  ownerUserId: UserId;
  appType: 'FIRST_PARTY' | 'THIRD_PARTY';
  status: DeveloperAppStatus;
  requestedScopes: IntegrationScope[];
  approvedScopes: IntegrationScope[];
  redirectUris: string[];
  privacyPolicyUrl?: string;
  termsUrl?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: UserId;
}

export interface IntegrationInstallation {
  installationId: IntegrationInstallationId;
  developerAppId: DeveloperAppId;
  householdId: HouseholdId;
  authorizedByUserId: UserId;
  grantedScopes: IntegrationScope[];
  status: InstallationStatus;
  consentVersion: string;
  installedAt: string;
  updatedAt: string;
  revokedAt?: string;
  revokedBy?: UserId;
}

export interface ApiCredential {
  credentialId: ApiCredentialId;
  developerAppId: DeveloperAppId;
  installationId: IntegrationInstallationId;
  tokenPrefix: string;
  tokenHash: string;
  status: CredentialStatus;
  scopes: IntegrationScope[];
  rateLimitPerMinute: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
}

export interface AuthenticatedIntegration {
  credentialId: ApiCredentialId;
  developerAppId: DeveloperAppId;
  installationId: IntegrationInstallationId;
  householdId: HouseholdId;
  scopes: IntegrationScope[];
}

export interface WebhookSubscription {
  webhookSubscriptionId: WebhookSubscriptionId;
  installationId: IntegrationInstallationId;
  endpointUrl: string;
  eventTypes: PublicIntegrationEventType[];
  status: WebhookStatus;
  signingKeyReference: string;
  signingSecretHash: string;
  createdBy: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface PublicIntegrationEvent {
  eventId: string;
  eventType: PublicIntegrationEventType;
  householdId: HouseholdId;
  occurredAt: string;
  aggregateId: string;
  data: Record<string, unknown>;
}

export interface WebhookDelivery {
  webhookDeliveryId: WebhookDeliveryId;
  webhookSubscriptionId: WebhookSubscriptionId;
  installationId: IntegrationInstallationId;
  eventId: string;
  eventType: PublicIntegrationEventType;
  endpointUrl: string;
  payload: PublicIntegrationEvent;
  signature: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  lastResponseCode?: number;
  lastError?: string;
}

export interface IntegrationAuditEvent {
  integrationAuditEventId: IntegrationAuditEventId;
  actorType: 'USER' | 'API_CLIENT' | 'SYSTEM';
  actorId: string;
  action: string;
  developerAppId?: DeveloperAppId;
  installationId?: IntegrationInstallationId;
  householdId?: HouseholdId;
  resourceType: string;
  resourceId?: string;
  outcome: 'ALLOWED' | 'DENIED' | 'SUCCESS' | 'FAILURE';
  reason?: string;
  createdAt: string;
}

export interface PetProfileProjection {
  petId: PetId;
  name: string;
  species: string;
  breed?: string;
  lifecycleStage: string;
  status: string;
}

export interface CareProjection {
  careObligationId: string;
  petId: PetId;
  title: string;
  category: string;
  dueAt: string;
  status: string;
  priority: string;
}

export interface BookingProjection {
  bookingId: string;
  petIds: PetId[];
  serviceTitle: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
}

export interface TrackerHealthProjection {
  deviceId: string;
  petId?: PetId;
  displayName: string;
  provider: string;
  model: string;
  connectivityStatus: string;
  batteryStatus: string;
  batteryPercent?: number;
  lastSeenAt?: string;
}

export interface CommandCenterProjection {
  generatedAt: string;
  pets: number;
  dueToday: number;
  overdueCare: number;
  upcomingBookings: number;
  unreadNotifications: number;
  onlineTrackers: number;
  actionInbox: number;
  ordersInProgress: number;
}

export interface ApiEndpointDefinition {
  method: 'GET';
  path: string;
  requiredScope: IntegrationScope;
  description: string;
  sensitiveFieldsExcluded: string[];
}

export interface WebhookTransport {
  deliver(input: { endpointUrl: string; body: string; signature: string; eventId: string }): Promise<{ statusCode: number; responseBody?: string }>;
}
