# Sprint 31 — External Integrations & Developer Platform

## Status

Implemented in the Pet OS prototype.

## Purpose

Sprint 31 creates a controlled boundary between Pet OS and external applications. It does not expose internal stores or allow third parties to bypass canonical domain services.

## Core model

- DeveloperApp
- IntegrationInstallation
- ApiCredential
- WebhookSubscription
- WebhookDelivery
- IntegrationAuditEvent

## Scope model

Supported public scopes are intentionally narrow:

- pet:profile:read
- care:read
- booking:read
- tracker:health:read
- command-center:read
- webhook:manage

The developer platform does not expose generic scopes for exact location, route history, prescriptions, payment execution, payouts, purchases, ownership changes, Lost Pet closure or Sprint 29 action execution.

## Installation and consent

Third-party applications begin in DRAFT state and require platform approval before they can be installed. A household installation requires an active HOUSEHOLD_OWNER or HOUSEHOLD_ADMIN and can grant only scopes that were approved for the app.

## API credentials

Credentials are shown once. The store retains only:

- token prefix;
- SHA-256 token hash;
- installation/app references;
- granted scopes;
- rate limit;
- status and expiry metadata.

Raw API tokens are not persisted.

## Public API v1

Sprint 31 exposes read-only projection contracts for:

- minimized Pet profiles;
- Care obligations;
- booking status and schedule;
- tracker device health;
- aggregate Command Center counts.

These are projections, not new sources of truth.

Tracker health explicitly excludes latitude, longitude, route history and provider hardware secrets. Booking projections exclude home access secrets, phone contacts and private instructions. Pet projections exclude ownership/contact information, microchip identifiers and clinical records.

## Webhooks

Webhook subscriptions:

- require the webhook:manage scope;
- require HTTPS;
- reject obvious localhost and private-network targets;
- subscribe only to approved public event types;
- use event-specific payload allowlists;
- use HMAC-SHA256 signatures;
- deduplicate by subscription + event ID;
- retry 408, 429 and 5xx responses with bounded exponential backoff;
- permanently fail non-retryable 4xx responses;
- dead-letter after the maximum retry count.

Public events currently include:

- pet.profile.updated
- care.status.changed
- booking.status.changed
- tracker.health.changed
- command-center.attention.changed

## Revocation

Revoking an installation revokes its active API credentials and webhook subscriptions. Runtime API authorization rechecks the app, installation, credential, household and scope state.

## Audit

Integration access records ALLOWED and DENIED decisions with app/installation/household context. Denied cross-household access and rate-limit decisions are audit-visible.

## Production boundary

This repository remains an in-browser/in-memory prototype. Production implementation must move:

- credential hashing/lookup to server-side authenticated APIs;
- raw webhook signing keys into a real KMS/secret manager;
- webhook delivery into durable queues/workers;
- DNS resolution and egress filtering into a server-side SSRF protection layer;
- developer-app approval into a real platform-admin authorization model;
- API rate limits into distributed infrastructure;
- audit logs into durable append-only storage.

The browser prototype deliberately does not contain production external credentials.

## Next

Sprint 32 should build the consolidated Analytics, Outcomes & Operations Intelligence platform across the canonical domains without creating duplicate financial, clinical, tracking or product truth.
