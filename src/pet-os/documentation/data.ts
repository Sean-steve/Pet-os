/**
 * Pet OS Canonical Architecture Documentation & Specifications
 * Summarizes the 44 Canonical Engineering Volumes, 20 ADRs, and 100-Sprint Roadmap.
 */

export interface VolumeSpec {
  id: string;
  romanNumeral: string;
  volumeNumber: number;
  title: string;
  category: 'Foundation' | 'Care & Health' | 'Services & Commerce' | 'IoT & Tracking' | 'AI & Safety' | 'Governance & Platform';
  description: string;
  normativePrefix: string;
  coreRule: string;
  keyInvariants: string[];
  canonicalDataModels: string[];
}

export const CANONICAL_VOLUMES: VolumeSpec[] = [
  {
    id: 'vol-1',
    romanNumeral: 'I',
    volumeNumber: 1,
    title: 'Product Vision, Scope & System Context',
    category: 'Foundation',
    description: 'Defines the complete Pet OS product, actors, system boundary, dog-first rollout and ecosystem outcomes.',
    normativePrefix: 'PETI',
    coreRule: 'Pet OS MUST model the pet as a first-class lifecycle entity rather than disconnected features. Kenya-first launch prioritizes provider density and M-PESA.',
    keyInvariants: [
      'Dog-first V1 MUST NOT embed canine assumptions in species-neutral core contracts',
      'V1 MUST exclude unrestricted live-animal selling from generic commerce',
      'Prioritize Kenya provider density and M-PESA interoperability'
    ],
    canonicalDataModels: ['PetOwner', 'Household', 'Caregiver', 'Provider']
  },
  {
    id: 'vol-2',
    romanNumeral: 'II',
    volumeNumber: 2,
    title: 'Enterprise & Reference Architecture',
    category: 'Foundation',
    description: 'Defines applications, services, bounded contexts, deployment topology, trust boundaries and cross-cutting services.',
    normativePrefix: 'PETII',
    coreRule: 'Transactional domains default to modular monolith. Clients MUST never connect directly to database.',
    keyInvariants: [
      'Single repository monorepo for mobile, web, APIs, workers and tests',
      'Telemetry ingestion may deploy independently due to traffic profile',
      'Cross-context writes MUST occur through owning application services or commands'
    ],
    canonicalDataModels: ['BoundedContextMap', 'RuntimeTopology']
  },
  {
    id: 'vol-3',
    romanNumeral: 'III',
    volumeNumber: 3,
    title: 'Domain-Driven Design Architecture',
    category: 'Foundation',
    description: 'Defines bounded contexts, aggregates, entities, value objects, invariants and domain ownership.',
    normativePrefix: 'PETIII',
    coreRule: 'Each entity MUST have one authoritative bounded context. Foreign aggregates are referenced by ID only.',
    keyInvariants: [
      'Business invariants live strictly server-side',
      'Eventual consistency MUST be explicit, never accidental',
      'Anti-corruption layers protect domain purity'
    ],
    canonicalDataModels: ['AggregateOwnership', 'DomainEvents']
  },
  {
    id: 'vol-4',
    romanNumeral: 'IV',
    volumeNumber: 4,
    title: 'Identity, Accounts, Households & Access Control',
    category: 'Foundation',
    description: 'Defines authentication, household collaboration, temporary caregivers, permissions and authorization.',
    normativePrefix: 'PETIPET',
    coreRule: 'Every pet access MUST be justified by household membership, provider grant, or audited duty.',
    keyInvariants: [
      'Temporary caregiver access MUST expire automatically',
      'Exact location and clinical-document access are separately permissioned',
      'Platform administrators MUST use audited break-glass procedures'
    ],
    canonicalDataModels: ['UserAccount', 'UserProfile', 'Household', 'HouseholdMembership', 'HouseholdInvitation']
  },
  {
    id: 'vol-5',
    romanNumeral: 'V',
    volumeNumber: 5,
    title: 'Pet Identity & Digital Twin',
    category: 'Care & Health',
    description: 'Defines the canonical pet aggregate, species taxonomy, identifiers, ownership, lifecycle and digital representation.',
    normativePrefix: 'PETPET',
    coreRule: 'Birth date MUST record precision (exact, estimated-month/year, unknown). Microchip is never described as GPS.',
    keyInvariants: [
      'Pet household transfer MUST preserve history and revoke prior access',
      'Breed MUST support mixed/unknown and source provenance',
      'Photos are private by default; lost mode generates public derivatives'
    ],
    canonicalDataModels: ['Pet', 'PetBreedAssignment', 'PetIdentifier', 'PetPhoto', 'PetOwnershipRecord']
  },
  {
    id: 'vol-6',
    romanNumeral: 'VI',
    volumeNumber: 6,
    title: 'Pet Lifecycle & Timeline Engine',
    category: 'Care & Health',
    description: 'Defines normalized historical events, lifecycle stages, milestones and cross-domain timeline projection.',
    normativePrefix: 'PETPETI',
    coreRule: 'Timeline events MUST reference authoritative source entities. Identical dedupe keys prevent duplicate events.',
    keyInvariants: [
      'Corrections update projections without erasing audit history',
      'Timeline visibility respects underlying source data classification',
      'Stage recalculation is rule-driven based on species rules'
    ],
    canonicalDataModels: ['PetTimelineEvent']
  },
  {
    id: 'vol-7',
    romanNumeral: 'VII',
    volumeNumber: 7,
    title: 'Veterinary Health & Medical Records',
    category: 'Care & Health',
    description: 'Defines clinical records, provenance, professional authoring, document security and owner observations.',
    normativePrefix: 'PETPETII',
    coreRule: 'Owner-entered information MUST be visibly labeled owner-reported. Prescription instructions MUST never be modified by AI.',
    keyInvariants: [
      'Only verified clinicians with active care relationships author clinical records',
      'Clinical document downloads are RESTRICTED and audited',
      'Weight corrections supersede rather than silently overwrite'
    ],
    canonicalDataModels: ['MedicalCondition', 'Allergy', 'Medication', 'Vaccination', 'ClinicalEncounter', 'ClinicalDocument', 'WeightMeasurement']
  },
  {
    id: 'vol-8',
    romanNumeral: 'VIII',
    volumeNumber: 8,
    title: 'Preventive Care, Reminders & Health Scheduling',
    category: 'Care & Health',
    description: 'Defines preventive care plans, due/overdue logic, recurring reminders, assignment and escalation.',
    normativePrefix: 'PETPETIII',
    coreRule: 'Clinician-defined due dates take precedence over generic templates. Recurring completion creates next instance transactionally.',
    keyInvariants: [
      'Notification failure does not alter underlying due state',
      'Medical reminders must not imply diagnosis or guaranteed prevention',
      'Snooze and overdue escalation follow household policy'
    ],
    canonicalDataModels: ['PreventiveCarePlan', 'CareReminder']
  },
  {
    id: 'vol-9',
    romanNumeral: 'IX',
    volumeNumber: 9,
    title: 'Nutrition & Feeding Architecture',
    category: 'Care & Health',
    description: 'Defines feeding plans, foods, meal/water logs, allergies and safe guidance.',
    normativePrefix: 'PETIX',
    coreRule: 'All quantities MUST include units. Incomplete user logs MUST NOT be treated as complete intake.',
    keyInvariants: [
      'AI nutrition guidance must avoid therapeutic medical claims without clinician record',
      'Food recommendations MUST strictly respect known allergies',
      'Duplicate feeding detection warns if fed within guard window'
    ],
    canonicalDataModels: ['FoodProductReference', 'FeedingPlan', 'FeedingPlanItem', 'MealLog', 'WaterLog']
  },
  {
    id: 'vol-10',
    romanNumeral: 'X',
    volumeNumber: 10,
    title: 'Training, Skills & Behavioral Development',
    category: 'Care & Health',
    description: 'Defines training programs, skills, sessions, progress and behavior observations.',
    normativePrefix: 'PETX',
    coreRule: 'Published program versions MUST be immutable. Behavior observations MUST NOT be labeled diagnoses.',
    keyInvariants: [
      'Provider access to media requires household permission',
      'High-risk aggression observations recommend professional escalation',
      'Completion does not automatically equal mastery'
    ],
    canonicalDataModels: ['TrainingSkill', 'TrainingProgram', 'PetTrainingEnrollment', 'TrainingSession', 'BehaviorObservation']
  },
  {
    id: 'vol-11',
    romanNumeral: 'XI',
    volumeNumber: 11,
    title: 'Activity, Exercise & Daily Care',
    category: 'Care & Health',
    description: 'Defines activity, care routines, household assignment and completion semantics.',
    normativePrefix: 'PETXI',
    coreRule: 'Care-task completion MUST be idempotent. Feeding workflows warn about likely duplicate feeding.',
    keyInvariants: [
      'Device-derived activity preserves source and confidence metadata',
      'Activity/wellness scores MUST NOT be represented as diagnoses',
      'Care task templates produce instances without mutating historical logs'
    ],
    canonicalDataModels: ['ActivitySession', 'CareTaskTemplate', 'CareTask']
  },
  {
    id: 'vol-12',
    romanNumeral: 'XII',
    volumeNumber: 12,
    title: 'Pet Services Marketplace',
    category: 'Services & Commerce',
    description: 'Defines provider organizations, service offerings, discovery, verification, availability and booking.',
    normativePrefix: 'PETXII',
    coreRule: 'Only verified providers show verified status. Booking price/policy MUST be snapshotted at confirmation.',
    keyInvariants: [
      'Search ranking clearly distinguishes organic relevance from sponsored placement',
      'Provider staff see only booking-relevant pet data',
      'Service area discovery uses geometry without exposing private addresses'
    ],
    canonicalDataModels: ['ProviderOrganization', 'ProviderStaff', 'ServiceOffering', 'ServiceArea', 'AvailabilityRule', 'Booking']
  },
  {
    id: 'vol-13',
    romanNumeral: 'XIII',
    volumeNumber: 13,
    title: 'Dog Walking Platform',
    category: 'Services & Commerce',
    description: 'Defines walker onboarding, walk sessions, live tracking, incidents and recurring plans.',
    normativePrefix: 'PETXIII',
    coreRule: 'A walker MUST NOT start without assignment. Only one active walk session per pet/booking.',
    keyInvariants: [
      'Live route access is household-authorized and purpose-bound',
      'High-severity incidents trigger immediate owner notification and trust/safety workflow',
      'Walk checkpoints record GPS with location privacy restrictions'
    ],
    canonicalDataModels: ['WalkSession', 'WalkCheckpoint', 'WalkIncident']
  },
  {
    id: 'vol-14',
    romanNumeral: 'XIV',
    volumeNumber: 14,
    title: 'Veterinary, Trainer, Groomer, Sitter & Boarding Workspaces',
    category: 'Services & Commerce',
    description: 'Defines professional operating surfaces and category-specific workflows.',
    normativePrefix: 'PETXIPET',
    coreRule: 'Professional workspaces MUST NOT grant org-wide access to every pet. Access starts from active booking.',
    keyInvariants: [
      'Clinical notes and ordinary service notes use different authorization semantics',
      'Medication/feeding instructions shown to care providers are read-only',
      'Provider data minimization applies per role'
    ],
    canonicalDataModels: ['ProviderWorkspace', 'StaffRole', 'CareAuthorization']
  },
  {
    id: 'vol-15',
    romanNumeral: 'XV',
    volumeNumber: 15,
    title: 'Commerce & Pet OS Store',
    category: 'Services & Commerce',
    description: 'Defines first-party catalog, inventory, cart, checkout, fulfillment and returns.',
    normativePrefix: 'PETXPET',
    coreRule: 'First-party products labeled sold by Pet OS. Inventory reservations are transactional and time-bounded.',
    keyInvariants: [
      'Order lines retain immutable price and title snapshots',
      'Checkout revalidates price, stock, shipping and entitlement',
      'Live animal sales strictly prohibited'
    ],
    canonicalDataModels: ['Product', 'ProductVariant', 'InventoryLevel', 'Cart', 'CartItem', 'Order', 'OrderItem', 'Shipment']
  },
  {
    id: 'vol-16',
    romanNumeral: 'XVI',
    volumeNumber: 16,
    title: 'Third-Party Marketplace',
    category: 'Services & Commerce',
    description: 'Defines merchant onboarding, seller verification, multi-merchant orders, commission and settlement.',
    normativePrefix: 'PETXPETI',
    coreRule: 'Unverified merchants MUST NOT publish sellable inventory. Payouts derive from settled ledger balance.',
    keyInvariants: [
      'Third-party products clearly distinguished from first-party items',
      'Multi-merchant checkout partitions shipments and payments correctly',
      'Prohibited product policies centrally enforced'
    ],
    canonicalDataModels: ['Merchant', 'SellerSettlementProfile', 'MarketplaceDispute']
  },
  {
    id: 'vol-17',
    romanNumeral: 'XVII',
    volumeNumber: 17,
    title: 'Payments, Ledger, Revenue & Financial Architecture',
    category: 'Services & Commerce',
    description: 'Defines payment intents, M-PESA/card orchestration, double-entry ledger, refunds and payouts.',
    normativePrefix: 'PETXPETII',
    coreRule: 'Provider callbacks MUST be authenticated and idempotent. Every balance movement maps to a balanced ledger journal.',
    keyInvariants: [
      'Payment amount and currency match Pet OS intent before marking success',
      'Posted ledger journals are immutable (corrections via reversals only)',
      'Debits equal credits per journal and currency'
    ],
    canonicalDataModels: ['PaymentIntent', 'PaymentTransaction', 'LedgerAccount', 'LedgerJournal', 'LedgerEntry', 'Payout', 'Refund']
  },
  {
    id: 'vol-18',
    romanNumeral: 'XVIII',
    volumeNumber: 18,
    title: 'Subscription & Monetization Architecture',
    category: 'Services & Commerce',
    description: 'Defines consumer premium, tracker plans, business SaaS, marketplace fees, ads and entitlements.',
    normativePrefix: 'PETXPETIII',
    coreRule: 'Feature access MUST be entitlement-driven. Core lost-pet safety is never disabled mid-incident solely for billing failure.',
    keyInvariants: [
      'Sold plan versions remain stable until explicit migration',
      'Sponsored content visibly labeled',
      'Effective entitlement is the union of active grants'
    ],
    canonicalDataModels: ['SubscriptionPlan', 'Subscription', 'EntitlementGrant']
  },
  {
    id: 'vol-19',
    romanNumeral: 'XIX',
    volumeNumber: 19,
    title: 'Pet Tracking & Device Architecture',
    category: 'IoT & Tracking',
    description: 'Defines device registry, pairing, credentials, telemetry, connectivity, battery and vendor adapters.',
    normativePrefix: 'PETXIX',
    coreRule: 'Device MUST be claimed before pet assignment. Ownership transfer revokes prior device credentials.',
    keyInvariants: [
      'Telemetry dedupes ingest/event identifiers',
      'Third-party tracker integration precedes proprietary hardware dependency',
      'Hardware serial numbers hashed; raw coordinates never in plain logs'
    ],
    canonicalDataModels: ['Device', 'DeviceAssignment', 'DeviceCredential', 'LocationPoint']
  },
  {
    id: 'vol-20',
    romanNumeral: 'XX',
    volumeNumber: 20,
    title: 'Location, Geofencing & Lost-Pet Recovery',
    category: 'IoT & Tracking',
    description: 'Defines exact location storage, safe zones, geofence detection, lost mode, sightings and recovery.',
    normativePrefix: 'PETXX',
    coreRule: 'Exact location MUST be RESTRICTED. Public recovery views never expose home geofence geometry or exact address.',
    keyInvariants: [
      'Geofence transitions use hysteresis/debounce to prevent jitter storms',
      'Lost mode recovery revokes public tokens and restores normal privacy policy',
      'Public sightings use approximate geometry; authorized users see exact'
    ],
    canonicalDataModels: ['Geofence', 'GeofenceEvent', 'LostPetIncident', 'LostPetSighting']
  },
  {
    id: 'vol-21',
    romanNumeral: 'XXI',
    volumeNumber: 21,
    title: 'QR, NFC, Microchip & Pet Identity Network',
    category: 'IoT & Tracking',
    description: 'Defines pet identity tags, finder UX, contact relay and public recovery profiles.',
    normativePrefix: 'PETXXI',
    coreRule: 'QR/NFC tags resolve through revocable opaque server IDs. Public recovery fields are owner-controlled.',
    keyInvariants: [
      'Microchip scanning is not represented as continuous telemetry',
      'Revoked tags fail closed without historical owner exposure',
      'Contact relay protects owner phone numbers by default'
    ],
    canonicalDataModels: ['PublicRecoveryProfile', 'TagToken', 'ContactRelaySession']
  },
  {
    id: 'vol-22',
    romanNumeral: 'XXII',
    volumeNumber: 22,
    title: 'Pet Community & Social Platform',
    category: 'Governance & Platform',
    description: 'Defines pet profiles, feeds, groups, events, interactions and community governance.',
    normativePrefix: 'PETXXII',
    coreRule: 'Community visibility MUST remain separate from core care visibility. Users not encouraged to post live exact locations.',
    keyInvariants: [
      'Reported content retained for moderation even if deleted by user',
      'Sponsored community content clearly labeled',
      'Groups have active moderation ownership'
    ],
    canonicalDataModels: ['CommunityPost', 'CommunityGroup', 'CommunityReport']
  },
  {
    id: 'vol-23',
    romanNumeral: 'XXIII',
    volumeNumber: 23,
    title: 'Rescue, Adoption & Animal Welfare',
    category: 'Governance & Platform',
    description: 'Defines rescue organizations, foster/adoption cases, screening and welfare governance.',
    normativePrefix: 'PETXXIII',
    coreRule: 'Adoption MUST NOT reuse merchandise checkout. Welfare history must survive listing withdrawal.',
    keyInvariants: [
      'Rescue organizations verified before publishing adoption cases',
      'Future breeder/sale features require separate welfare governance',
      'State flow: Intake -> Assessment -> Available -> Application Review -> Matched -> Handover -> Adopted'
    ],
    canonicalDataModels: ['RescueOrganization', 'RescueAnimalCase', 'AdoptionApplication']
  },
  {
    id: 'vol-24',
    romanNumeral: 'XXIV',
    volumeNumber: 24,
    title: 'Pet Intelligence & AI Architecture',
    category: 'AI & Safety',
    description: 'Defines context assembly, recommendations, lifecycle intelligence, AI coach and trend detection.',
    normativePrefix: 'PETXXIPET',
    coreRule: 'AI context MUST be filtered by authorization before model use. Deterministic safety rules never delegated to LLMs.',
    keyInvariants: [
      'Stored recommendations keep reason codes and context version',
      'Pet-specific facts grounded in trusted context or labeled general guidance',
      'Decisioning layers: Deterministic Rules -> Scoring -> Generative AI -> Human/Pro Authority'
    ],
    canonicalDataModels: ['AiInteraction', 'AiRecommendation']
  },
  {
    id: 'vol-25',
    romanNumeral: 'XXV',
    volumeNumber: 25,
    title: 'AI Safety, Veterinary Boundaries & Escalation',
    category: 'AI & Safety',
    description: 'Defines risk detection, medical boundaries, emergency routing, evaluation and audit.',
    normativePrefix: 'PETXXPET',
    coreRule: 'AI MUST NOT diagnose or claim medical certainty. AI MUST NOT invent or modify prescription dosage.',
    keyInvariants: [
      'Potential emergencies prioritize urgent veterinary care over coaching/commerce',
      'Safety prompts and policies versioned and regression tested',
      'Risk classes: LOW (routine), MODERATE (consult), HIGH (vet assessment), EMERGENCY (immediate vet)'
    ],
    canonicalDataModels: ['TrustSafetyCase', 'AiSafetyGate']
  },
  {
    id: 'vol-26',
    romanNumeral: 'XXVI',
    volumeNumber: 26,
    title: 'Notification, Communication & Engagement Architecture',
    category: 'Governance & Platform',
    description: 'Defines in-app, push, email/SMS policies, retries, preferences and provider messaging.',
    normativePrefix: 'PETXXPETI',
    coreRule: 'Critical safety notifications may override marketing preferences. Lock-screen push text never exposes restricted medical/location data.',
    keyInvariants: [
      'Delivery retries are idempotent',
      'Marketing preferences separated from transactional/safety channels',
      'Channels supported: In-app, push, email, SMS'
    ],
    canonicalDataModels: ['Notification', 'NotificationDelivery']
  },
  {
    id: 'vol-27',
    romanNumeral: 'XXVII',
    volumeNumber: 27,
    title: 'UX/UI & Pet Command Center Specification',
    category: 'Governance & Platform',
    description: 'Defines information architecture, screens, states, mobile/web behavior and accessibility.',
    normativePrefix: 'PETXXPETII',
    coreRule: 'Every data screen MUST define loading, empty, error, denied and offline states. Critical safety actions shallow and obvious.',
    keyInvariants: [
      'Location screens communicate who can view exact data',
      'Owner/walker mobile flows one-hand operable where practical',
      'Web targets WCAG 2.2 AA standards'
    ],
    canonicalDataModels: ['ScreenStateRegistry', 'DesignTokenSystem']
  },
  {
    id: 'vol-28',
    romanNumeral: 'XXVIII',
    volumeNumber: 28,
    title: 'API & Integration Specification',
    category: 'Foundation',
    description: 'Defines HTTP conventions, auth, versioning, idempotency, pagination, filtering, errors and webhooks.',
    normativePrefix: 'PETXXPETIII',
    coreRule: 'Every state-changing API authorizes server-side. Duplicate-sensitive creates/payments support idempotency.',
    keyInvariants: [
      'Standard error envelope with stable machine code and safe human message',
      'Responses filter fields caller cannot read',
      'Standard response structure: { data, meta: { correlation_id } }'
    ],
    canonicalDataModels: ['ApiErrorEnvelope', 'ApiResponseEnvelope']
  },
  {
    id: 'vol-29',
    romanNumeral: 'XXIX',
    volumeNumber: 29,
    title: 'Event, Command & Asynchronous Architecture',
    category: 'Foundation',
    description: 'Defines domain events, outbox, queues, ordering, retry and dead-letter handling.',
    normativePrefix: 'PETXXIX',
    coreRule: 'Transactional events MUST use an outbox pattern. Consumers MUST be idempotent.',
    keyInvariants: [
      'At-least-once delivery assumed across message brokers',
      'Dead-lettered safety/payment messages alert operations immediately',
      'Message envelope: event_id, event_name, occurred_at, producer, correlation_id, payload'
    ],
    canonicalDataModels: ['DomainEventEnvelope', 'OutboxRecord']
  },
  {
    id: 'vol-30',
    romanNumeral: 'XXX',
    volumeNumber: 30,
    title: 'Database Schema & Technical Data Dictionary',
    category: 'Foundation',
    description: 'Defines physical schema conventions, tables, constraints, indexes, partitioning and retention.',
    normativePrefix: 'PETXXX',
    coreRule: 'Primary IDs use UUIDv7. Money uses integer minor units. LocationPoint is time-partitioned & PostGIS backed.',
    keyInvariants: [
      'Ledger/audit records MUST NOT be hard-deleted',
      'snake_case naming, timestamptz UTC for timestamps',
      'Integer version column for optimistic concurrency guards'
    ],
    canonicalDataModels: ['SchemaDefinitions', 'IndexStrategy']
  },
  {
    id: 'vol-31',
    romanNumeral: 'XXXI',
    volumeNumber: 31,
    title: 'Security, Privacy, Trust & Abuse Prevention',
    category: 'Governance & Platform',
    description: 'Defines threat model, session security, authorization, encryption, fraud, stalking prevention and audit.',
    normativePrefix: 'PETXXXI',
    coreRule: 'Stalking through location is an explicit threat scenario. Restricted data must be masked in logs/support tooling.',
    keyInvariants: [
      'Sensitive uploads scanned before trusted storage',
      'Authorization tests include malicious cross-household/provider attacks',
      'Replay defense and signature validation on payment webhooks'
    ],
    canonicalDataModels: ['ConsentGrant', 'AccessAuditEvent', 'SupportCase', 'TrustSafetyCase']
  },
  {
    id: 'vol-32',
    romanNumeral: 'XXXII',
    volumeNumber: 32,
    title: 'Kenyan Privacy, Regulatory & Compliance Architecture',
    category: 'Governance & Platform',
    description: 'Defines Kenya-first privacy governance, consent, data-subject workflows and launch review.',
    normativePrefix: 'PETXXXII',
    coreRule: 'Pet OS MUST maintain processing inventory and data classification map for Kenyan ODPC compliance.',
    keyInvariants: [
      'Export, correction, and deletion workflows operable and auditable',
      'Exact location and KYC data receive heightened safeguards',
      'Kenyan privacy/legal review before public production launch'
    ],
    canonicalDataModels: ['DataSubjectRequest', 'ProcessingInventory']
  },
  {
    id: 'vol-33',
    romanNumeral: 'XXXIII',
    volumeNumber: 33,
    title: 'Infrastructure, Cloud, DevOps & Reliability',
    category: 'Governance & Platform',
    description: 'Defines environments, deployment, networking, secrets, CI/CD, data services, backups and DR.',
    normativePrefix: 'PETXXXIII',
    coreRule: 'Production secrets MUST live in managed secret storage. Migrations MUST be rolling-deployment compatible.',
    keyInvariants: [
      'Backups count only after verified restore tests',
      'Telemetry ingestion failure must not take down ordinary APIs',
      'SLO: 99.9% API availability, p95 <=500ms reads, p95 <=250ms telemetry ingest'
    ],
    canonicalDataModels: ['InfraTopology', 'DeploymentPipeline']
  },
  {
    id: 'vol-34',
    romanNumeral: 'XXXIV',
    volumeNumber: 34,
    title: 'Observability, Operations & Support',
    category: 'Governance & Platform',
    description: 'Defines logging, metrics, tracing, SLOs, alerting, incident response and support.',
    normativePrefix: 'PETXXXIPET',
    coreRule: 'Every request/job/device batch MUST carry correlation ID. Logs must exclude raw coordinates and clinical contents.',
    keyInvariants: [
      'Critical alerts have explicit owners and runbooks',
      'Restricted support access is purpose-bound and audited',
      'Standard dashboards: Core API, Payments, Tracking, Lost Pet, Notifications, AI'
    ],
    canonicalDataModels: ['ObservabilityMetrics', 'IncidentRunbook']
  },
  {
    id: 'vol-35',
    romanNumeral: 'XXXV',
    volumeNumber: 35,
    title: 'Testing, QA & Validation',
    category: 'Governance & Platform',
    description: 'Defines unit, integration, contract, E2E, security, payment, tracking and AI tests.',
    normativePrefix: 'PETXXXPET',
    coreRule: 'Every state transition MUST have positive and invalid-transition tests. Payment callbacks tested duplicate/reordered.',
    keyInvariants: [
      'Location authorization maliciously cross-tested',
      'AI safety suites run before prompt or model changes ship',
      'Release test matrix covers Unit, Integration, Contract, E2E, Security, Perf, AI Safety'
    ],
    canonicalDataModels: ['TestPyramidMatrix', 'AcceptanceCriteria']
  },
  {
    id: 'vol-36',
    romanNumeral: 'XXXVI',
    volumeNumber: 36,
    title: 'Analytics & Outcome Measurement',
    category: 'Governance & Platform',
    description: 'Defines product analytics, marketplace KPIs, pet-care indicators, revenue and privacy.',
    normativePrefix: 'PETXXXPETI',
    coreRule: 'Analytics should be pseudonymous. GMV MUST be distinguished from net platform revenue.',
    keyInvariants: [
      'Restricted health/location data must not enter general analytics',
      'Care indicators must not be called medical outcomes without validation',
      'KPIs: Activated household, Monthly active pet, Booking conversion, GMV, Lost recovery time'
    ],
    canonicalDataModels: ['KpiDefinitions', 'AnalyticsEvent']
  },
  {
    id: 'vol-37',
    romanNumeral: 'XXXVII',
    volumeNumber: 37,
    title: 'Administration & Internal Operations Console',
    category: 'Governance & Platform',
    description: 'Defines privileged user, provider, merchant, finance, device, incident and moderation operations.',
    normativePrefix: 'PETXXXPETII',
    coreRule: 'Admin UI MUST enforce role separation. High-risk actions require reason codes and break-glass time limits.',
    keyInvariants: [
      'Ledger corrections use reversal journals, never direct edits',
      'Trust & safety console handles animal welfare and harassment cases',
      'No raw location viewing without audited break-glass'
    ],
    canonicalDataModels: ['AdminRole', 'ReasonCode', 'BreakGlassSession']
  },
  {
    id: 'vol-38',
    romanNumeral: 'XXXVIII',
    volumeNumber: 38,
    title: 'Multi-Species Architecture',
    category: 'Care & Health',
    description: 'Defines species-neutral core, dog-first specialization and future cat/rabbit/bird extension.',
    normativePrefix: 'PETXXXPETIII',
    coreRule: 'Core identity, household, timeline and consent remain species-neutral. Species schedules are rule-driven.',
    keyInvariants: [
      'Unsupported species features fail gracefully',
      'New species enablement requires veterinary and safety validation',
      'V1 focuses on Dog specialization while keeping core contracts species-agnostic'
    ],
    canonicalDataModels: ['SpeciesTaxonomy', 'SpeciesCapabilityMatrix']
  },
  {
    id: 'vol-39',
    romanNumeral: 'XXXIX',
    volumeNumber: 39,
    title: 'External Integrations & Developer Platform',
    category: 'Services & Commerce',
    description: 'Defines adapters, payments, maps, messaging, KYC, trackers, developer API and webhooks.',
    normativePrefix: 'PETXXXIX',
    coreRule: 'External outages MUST degrade gracefully. Vendor secrets MUST NOT reach browser clients.',
    keyInvariants: [
      'Inbound webhooks authenticated and idempotent',
      'Developer scopes are least-privilege and consent-aware',
      'Adapters for M-PESA, Maps, SMS/Push, KYC, GPS Trackers, Object Storage'
    ],
    canonicalDataModels: ['IntegrationAdapterContract', 'WebhookPayload']
  },
  {
    id: 'vol-40',
    romanNumeral: 'XL',
    volumeNumber: 40,
    title: 'Human Kernel / Life OS Integration',
    category: 'Governance & Platform',
    description: 'Defines controlled interoperability with identity, family, calendar, finance, rewards and travel.',
    normativePrefix: 'PETXL',
    coreRule: 'Pet OS MUST remain independently usable. Pet location MUST NEVER be shared cross-OS by default.',
    keyInvariants: [
      'Cross-OS sharing requires explicit contract and user authorization',
      'Finance receives financial facts rather than unrestricted clinical records',
      'Consent boundaries strictly maintained across ecosystems'
    ],
    canonicalDataModels: ['CrossOsContract', 'IdentityLink']
  },
  {
    id: 'vol-41',
    romanNumeral: 'XLI',
    volumeNumber: 41,
    title: 'Architecture Decision Records (ADRs)',
    category: 'Foundation',
    description: 'Records canonical architecture decisions, rationale, and supersession rules.',
    normativePrefix: 'PETXLI',
    coreRule: 'Material deviations require an approved ADR. Superseded ADRs remain immutable history.',
    keyInvariants: [
      'ADRs 001 through 020 establish the baseline architectural foundation',
      'Code comments are not substitutes for architecture decisions',
      'Every major design decision documented with alternatives considered'
    ],
    canonicalDataModels: ['ArchitectureDecisionRecord']
  },
  {
    id: 'vol-42',
    romanNumeral: 'XLII',
    volumeNumber: 42,
    title: 'Engineering Standards & Coding-Agent Manual',
    category: 'Foundation',
    description: 'Defines repository conventions, module rules, coding standards, migrations, tests and agent constraints.',
    normativePrefix: 'PETXLII',
    coreRule: 'Coding agents MUST inspect existing implementation before editing and NOT cross sprint boundaries.',
    keyInvariants: [
      'No TODO/mock/placeholder may be reported complete',
      'Schema, API, and event changes must update contracts, tests, and documentation',
      'Definition of Done enforced across every story'
    ],
    canonicalDataModels: ['EngineeringStandard', 'DefinitionOfDone']
  },
  {
    id: 'vol-43',
    romanNumeral: 'XLIII',
    volumeNumber: 43,
    title: 'Implementation Roadmap & Dependency Graph',
    category: 'Foundation',
    description: 'Defines phased delivery, 100-sprint mapping, dependencies and quality gates.',
    normativePrefix: 'PETXLIII',
    coreRule: 'A sprint MUST NOT begin when predecessor invariants are unstable. Foundations precede dependent features.',
    keyInvariants: [
      '10 Delivery Phases spanning 100 sprints',
      'Sprint 1 completes Foundation setup and Shared Kernel',
      'Every sprint ends with an evidence-based completion report'
    ],
    canonicalDataModels: ['DeliveryPhase', 'SprintPlan', 'QualityGate']
  },
  {
    id: 'vol-44',
    romanNumeral: 'XLIV',
    volumeNumber: 44,
    title: 'Production Readiness, Launch & Acceptance',
    category: 'Governance & Platform',
    description: 'Defines launch gates, beta, rollback, acceptance and full-system delivery criteria.',
    normativePrefix: 'PETXLIPET',
    coreRule: 'P0/P1 defects MUST block production certification. Location, privacy, AI, and payment gates pass independently.',
    keyInvariants: [
      'Backup restore and rollback drills tested before launch',
      'Completion requires architecture conformance, not merely build/deploy',
      'Final certification checklist across all 44 volumes'
    ],
    canonicalDataModels: ['CertificationGate', 'DefectSeverity']
  }
];

export interface ADRItem {
  id: string;
  number: string;
  title: string;
  decision: string;
  rule: string;
  rationale: string;
  status: 'ACCEPTED' | 'ACTIVE';
}

export const CANONICAL_ADRS: ADRItem[] = [
  {
    id: 'adr-001',
    number: 'ADR-001',
    title: 'Modular Monolith Before Microservices',
    decision: 'Build Pet OS backend as a modular monolith with clear bounded contexts and strict interfaces.',
    rule: 'Transactional contexts live in modular monolith; telemetry and async workers may deploy independently.',
    rationale: 'Lower operational complexity, transactional consistency, enforceable boundaries without distributed network partition overhead.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-002',
    number: 'ADR-002',
    title: 'PostgreSQL + PostGIS as Primary Data Store',
    decision: 'Use PostgreSQL with PostGIS extension for relational integrity and spatial queries.',
    rule: 'System of record and spatial geofences / tracking queries live in PostgreSQL + PostGIS.',
    rationale: 'ACID compliance, mature spatial indexing (GIST), JSONB support for flexible metadata, auditability.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-003',
    number: 'ADR-003',
    title: 'UUIDv7 for Externally Visible Primary IDs',
    decision: 'All public primary keys and resource IDs use RFC 9562 UUIDv7.',
    rule: 'Externally visible primary IDs use UUIDv7; no sequential integers exposed.',
    rationale: 'Global uniqueness, approximately time-ordered B-tree indexing efficiency, leak-proof against enumeration attacks.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-004',
    number: 'ADR-004',
    title: 'Household as Primary Access Boundary',
    decision: 'Pets belong to Households; human access derives from household memberships and explicit time-bound grants.',
    rule: 'Authorization resolves household/provider/merchant scope on every resource operation; deny by default.',
    rationale: 'Reflects real multi-caregiver dynamics (partners, kids, dog walkers, sitters, vets).',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-005',
    number: 'ADR-005',
    title: 'Clinical Provenance Preserved',
    decision: 'Owner-reported observations and clinician-authored clinical records remain strictly separated.',
    rule: 'Owner and clinician records never flattened; clinical notes writable only by verified veterinary clinicians.',
    rationale: 'Clinical safety, legal compliance, clarity of medical authority vs home observations.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-006',
    number: 'ADR-006',
    title: 'Microchip is Scan-Time Identity, Not GPS',
    decision: 'Microchip numbers represent passive scan-time identification, never advertised as live trackers.',
    rule: 'Microchip scanning MUST NOT be represented as continuous telemetry.',
    rationale: 'Prevents false expectations of location tracking; microchips are passive RFID tags.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-007',
    number: 'ADR-007',
    title: 'Third-Party Trackers First',
    decision: 'Integrate open BLE / GPS third-party tracker adapters before proprietary hardware.',
    rule: 'Third-party tracker integration precedes proprietary collar manufacturing.',
    rationale: 'Validates user demand and telemetry pipelines with minimal hardware risk.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-008',
    number: 'ADR-008',
    title: 'Exact Location is RESTRICTED Data',
    decision: 'Exact pet and walker location coordinates are classified as RESTRICTED.',
    rule: 'Purpose-bound location access; raw exact coordinates never logged in plaintext.',
    rationale: 'Mitigates stalking and home-burglary risks; preserves owner privacy.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-009',
    number: 'ADR-009',
    title: 'Public Lost Pet Map Approximate Geometry',
    decision: 'Public recovery flyers and maps display fuzzed/approximate zones; exact coordinates restricted to verified owners.',
    rule: 'Public lost maps approximate; exact sightings visible to authorized household only.',
    rationale: 'Prevents extortion, theft, or stalker tracking of lost pets and owners.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-010',
    number: 'ADR-010',
    title: 'Hybrid Commerce (Store + Marketplace)',
    decision: 'Pet OS operates a direct first-party essential store and a verified third-party vendor marketplace.',
    rule: 'Third-party products clearly distinguished from first-party items; live animal sales excluded.',
    rationale: 'Margin profitability on core goods combined with breadth for niche supplies.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-011',
    number: 'ADR-011',
    title: 'No Generic Live-Animal Marketplace',
    decision: 'Unrestricted selling of live animals is prohibited; rescue, foster, and adoption use dedicated welfare workflows.',
    rule: 'V1 excludes unrestricted live-animal selling; adoption requires screening and verification.',
    rationale: 'Animal welfare, ethical standards, anti-puppy-mill prevention.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-012',
    number: 'ADR-012',
    title: 'Double-Entry Internal Ledger for All Money Movements',
    decision: 'All payments, payouts, platform commissions, fees, and refunds are posted to a double-entry ledger.',
    rule: 'Every balance movement maps to a balanced ledger journal (debit = credit); posted journals are immutable.',
    rationale: 'Auditable, fault-tolerant financial accounting and reconciliation across M-PESA and card rails.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-013',
    number: 'ADR-013',
    title: 'Payment Provider Abstraction (M-PESA First)',
    decision: 'Isolate payment gateways behind a unified adapter; prioritize Safaricom M-PESA STK push and C2B.',
    rule: 'Normalize provider callbacks into Pet OS PaymentIntent state machine; vendor-agnostic core.',
    rationale: 'Crucial for Kenya launch where 95%+ of everyday pet services and store transactions use M-PESA.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-014',
    number: 'ADR-014',
    title: 'AI Advisory Only (No Autonomous Diagnosis)',
    decision: 'AI Coach provides context-aware guidance and education but NEVER diagnoses or changes prescriptions.',
    rule: 'AI MUST NOT diagnose or modify prescription dosage; emergency symptoms trigger urgent vet escalation.',
    rationale: 'Veterinary patient safety and legal liability boundaries.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-015',
    number: 'ADR-015',
    title: 'Recommendation Provenance & Explainability',
    decision: 'Every AI or algorithmic recommendation must record reason codes and context version.',
    rule: 'Stored recommendations MUST keep reason codes and context version.',
    rationale: 'Trust, explainability, auditability, and clinical validation.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-016',
    number: 'ADR-016',
    title: 'Transactional Outbox Pattern for Domain Events',
    decision: 'Write domain events to an outbox table within the same database transaction as the aggregate state change.',
    rule: 'Transactional events MUST use an outbox; background publishers deliver to message broker.',
    rationale: 'Guarantees at-least-once delivery without dual-write inconsistency bugs.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-017',
    number: 'ADR-017',
    title: 'Relay Contact for Lost Pet Recovery',
    decision: 'Smart tags and public posters route finder communication through an anonymized relay by default.',
    rule: 'Do not publish owner phone number by default; use secure relay session.',
    rationale: 'Protects pet owners from spam, scams, harassment, and ransom extortion.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-018',
    number: 'ADR-018',
    title: 'Mobile First-Class for Owners and Walkers',
    decision: 'Native mobile experience (React Native + Expo) for push notifications, background GPS, and walk tracking.',
    rule: 'Owner/walker field execution requires offline-safe local state and background location capture.',
    rationale: 'Walkers and pet owners operate primarily on mobile devices outdoors.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-019',
    number: 'ADR-019',
    title: 'Vendor Adapters Isolated Behind Ports',
    decision: 'Third-party APIs (M-PESA, Google Maps, Twilio/SMS, AWS S3, Gemini) reside strictly behind adapter interfaces.',
    rule: 'Vendor adapters isolated behind interfaces; secrets never sent to browser.',
    rationale: 'Easy unit/integration testing with mocks, provider portability, resilience against API deprecation.',
    status: 'ACCEPTED'
  },
  {
    id: 'adr-020',
    number: 'ADR-020',
    title: 'Documentation as Architecture Governance',
    decision: 'The 44 Canonical Engineering Volumes act as the single source of truth for all requirements and test suites.',
    rule: 'Code cannot invent unapproved domain concepts; tests must verify normative PET requirements.',
    rationale: 'Prevents architectural drift and ensures compliance across 100 sprints.',
    status: 'ACCEPTED'
  }
];

export interface SprintPhase {
  phase: number;
  name: string;
  sprintRange: string;
  outcome: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  progressPercent: number;
}

export const SPRINT_PHASES: SprintPhase[] = [
  {
    phase: 1,
    name: 'Foundation & Kernel',
    sprintRange: 'Sprints 001-007',
    outcome: 'Monorepo, DB schema baseline, shared kernel, correlation IDs, error contracts, audit trail, authentication foundation.',
    status: 'IN_PROGRESS',
    progressPercent: 20 // Sprint 1 done out of 7
  },
  {
    phase: 2,
    name: 'Pet Core & Daily Care',
    sprintRange: 'Sprints 008-020',
    outcome: 'Pet aggregate, digital twin, timeline engine, clinical records, vaccines, preventive care, nutrition, behavior & training.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 3,
    name: 'Services & Walking',
    sprintRange: 'Sprints 021-029',
    outcome: 'Provider directory, availability engine, booking lifecycle, live dog walking tracking session, and walk incidents.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 4,
    name: 'Commerce & Store',
    sprintRange: 'Sprints 030-033',
    outcome: 'First-party store, multi-merchant marketplace, catalog, inventory reservations, cart, order fulfillment, returns.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 5,
    name: 'Tracking & Lost Pet Network',
    sprintRange: 'Sprints 034-041',
    outcome: 'QR/NFC tags, third-party GPS telemetry, geofences, lost pet mode, public recovery flyers, contact relay.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 6,
    name: 'AI & Community',
    sprintRange: 'Sprints 042-051',
    outcome: 'Context engine, AI coach, veterinary safety gates, community groups, events, posts, content moderation.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 7,
    name: 'Professional & Monetization',
    sprintRange: 'Sprints 052-069',
    outcome: 'Vet/Walker/Trainer B2B workspaces, consumer premium, SaaS subscriptions, double-entry ledger, M-PESA payouts.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 8,
    name: 'Hardening & Kenya Launch',
    sprintRange: 'Sprints 070-082',
    outcome: 'Security audits, Kenyan ODPC privacy compliance, load testing, M-PESA reconciliation, Nairobi pilot beta.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 9,
    name: 'Hardware & Ecosystem',
    sprintRange: 'Sprints 083-093',
    outcome: 'Proprietary collar prototype, multi-species expansion (cats, rabbits), developer public API, Life OS Human Kernel link.',
    status: 'UPCOMING',
    progressPercent: 0
  },
  {
    phase: 10,
    name: 'Production Certification',
    sprintRange: 'Sprints 094-100',
    outcome: 'Full conformance validation, zero P0/P1 defects, disaster recovery drills, production certification.',
    status: 'UPCOMING',
    progressPercent: 0
  }
];

export const SPRINT_1_SUMMARY = {
  title: 'Sprint 1: Architecture Baseline & Shared Kernel',
  status: 'COMPLETED & INGESTED',
  completedAt: '2026-09-04',
  scope: [
    'Repository structure & ADR baseline established (ADR-001 to ADR-020)',
    'Shared Kernel (@pet-os/shared-kernel): UUIDv7 Generator, Branded IDs, Money Value Object, Time UTC Engine, AppError & Machine Error Code Registry',
    'Core API Foundation (apps/api): Express Server, Correlation ID Propagation, Structured Redacting Logger, Centralized Error Handling, Health Endpoint (/health, /ready)',
    'Audit Trail Foundation: Immutable AuditEvent aggregate & in-memory/DB audit recording with correlation ID',
    'Test Architecture: Unit tests for Kernel, boundary checks, and API smoke tests',
    '44 Canonical Engineering Documentation Volumes ingested and indexed'
  ],
  invariantsVerified: [
    'UUIDv7 timestamp ordering and RFC 9562 compliance',
    'Money uses integer minor units (never floating point)',
    'Every state-changing command preserves Correlation ID',
    'RESTRICTED location/PII data is scrubbed before logging',
    'Standard error responses use machine code and safe user messages'
  ]
};
