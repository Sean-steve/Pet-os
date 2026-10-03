import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Database,
  Dog,
  FileText,
  FlaskConical,
  Footprints,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  Layers3,
  MapPin,
  Menu,
  Package,
  PawPrint,
  Radio,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Truck,
  UserRoundCheck,
  Users,
  Utensils,
  Warehouse,
  X,
} from 'lucide-react';
import type { TabType } from './Header';

type WorkspaceId =
  | 'owner'
  | 'professional'
  | 'business'
  | 'rescue'
  | 'commerce'
  | 'finance'
  | 'trust'
  | 'intelligence'
  | 'platform';

interface UnifiedPetOSExperienceProps {
  onOpenModule: (tab: TabType) => void;
}

interface ModuleDef {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tab: TabType;
  status?: string;
  accent?: 'sage' | 'blue' | 'violet' | 'peach' | 'amber';
}

interface WorkspaceDef {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  modules: ModuleDef[];
  metrics: Array<{ label: string; value: string; detail: string; icon: React.ElementType }>;
  queue: Array<{ title: string; meta: string; status: string }>;
}

const toneClasses = {
  sage: 'bg-[#E6F2EA] text-[#2F6B50]',
  blue: 'bg-[#EAF1FA] text-[#426E9B]',
  violet: 'bg-[#F0ECFB] text-[#6A5AA8]',
  peach: 'bg-[#FFF0E8] text-[#B85F43]',
  amber: 'bg-[#FAF1DD] text-[#99702C]',
};

const workspaces: WorkspaceDef[] = [
  {
    id: 'owner',
    label: 'Pet Parent',
    shortLabel: 'Home',
    eyebrow: 'Household workspace',
    title: 'Everything your pet needs, connected.',
    description: 'Identity, health, daily care, training, tracking, recovery, services, community, commerce and subscriptions in one household experience.',
    icon: PawPrint,
    accent: '#1F5F46',
    metrics: [
      { label: 'Pets', value: '4', detail: '3 dogs · 1 cat', icon: PawPrint },
      { label: 'Care today', value: '8 / 11', detail: '3 tasks remaining', icon: Calendar },
      { label: 'Upcoming', value: '3', detail: 'Bookings this month', icon: Stethoscope },
      { label: 'Devices', value: '2 online', detail: '1 tracker charging', icon: Radio },
    ],
    queue: [
      { title: 'Kibo · evening medication', meta: 'Due at 8:00 PM', status: 'Due today' },
      { title: 'Simba · annual wellness', meta: 'Westlands Vet Centre · 20 Oct', status: 'Booked' },
      { title: 'Luna · feeding plan review', meta: 'Nutrition plan has changed twice this month', status: 'Review' },
    ],
    modules: [
      { id: 'identity', title: 'Identity & Household', description: 'Accounts, caregivers, household roles and access.', icon: Users, tab: 'identity', accent: 'sage' },
      { id: 'pet-core', title: 'Pet Digital Twin', description: 'Canonical identity, lifecycle, ownership and core profile.', icon: Dog, tab: 'sprint3', accent: 'sage' },
      { id: 'passport', title: 'Timeline & Passport', description: 'Documents, provenance, lifecycle timeline and shareable passport.', icon: FileText, tab: 'sprint4', accent: 'blue' },
      { id: 'health', title: 'Health', description: 'Clinical history, vaccinations, medications, allergies and diagnostics.', icon: HeartPulse, tab: 'sprint5', accent: 'peach' },
      { id: 'preventive', title: 'Preventive Care', description: 'Due care, schedules, reminders and caregiver execution.', icon: Calendar, tab: 'sprint6', accent: 'sage' },
      { id: 'nutrition', title: 'Nutrition', description: 'Feeding plans, meals, hydration, restrictions and appetite logs.', icon: Utensils, tab: 'sprint7', accent: 'amber' },
      { id: 'training', title: 'Training', description: 'Skills, programs, behavior observations and progress evidence.', icon: GraduationCap, tab: 'sprint8', accent: 'violet' },
      { id: 'activity', title: 'Activity', description: 'Walks, play, exercise, enrichment and rest.', icon: Footprints, tab: 'sprint9', accent: 'blue' },
      { id: 'booking', title: 'Services & Booking', description: 'Discover providers, availability, reservations and cancellations.', icon: Calendar, tab: 'sprint11', accent: 'violet' },
      { id: 'tracking', title: 'Tracking & Devices', description: 'Live location, routes, device health and telemetry.', icon: MapPin, tab: 'sprint14', accent: 'blue' },
      { id: 'recovery', title: 'Lost Pet Recovery', description: 'Safe zones, Lost Pet Mode, sightings and recovery profiles.', icon: ShieldCheck, tab: 'sprint15', accent: 'peach' },
      { id: 'community', title: 'Community', description: 'Groups, events and recovery-network participation.', icon: Users, tab: 'sprint16', accent: 'violet' },
      { id: 'crowd', title: 'Crowd Recovery', description: 'Privacy-preserving BLE recovery network.', icon: Radio, tab: 'sprint17', accent: 'blue' },
      { id: 'subscription', title: 'Membership & Premium', description: 'Consumer plans, entitlements, billing and usage.', icon: CreditCard, tab: 'sprint24', accent: 'amber' },
      { id: 'tracker-plan', title: 'Tracker Plans', description: 'Per-device connectivity subscriptions and service status.', icon: Radio, tab: 'sprint25', accent: 'blue' },
      { id: 'store', title: 'Store & Orders', description: 'Marketplace products, checkout, orders, returns and buyer protection.', icon: ShoppingBag, tab: 'sprint27', accent: 'peach' },
      { id: 'ai', title: 'Pet OS AI', description: 'Grounded assistant, summaries, recommendations and safety-aware guidance.', icon: Sparkles, tab: 'sprint28', accent: 'violet' },
    ],
  },
  {
    id: 'professional',
    label: 'Professional',
    shortLabel: 'Care team',
    eyebrow: 'Professional workspace',
    title: 'One clinical and care workspace across every service.',
    description: 'Verified professionals can manage referrals, appointments, service execution, records, handoffs and outcomes without losing domain provenance.',
    icon: Stethoscope,
    accent: '#526AA3',
    metrics: [
      { label: 'Today', value: '9', detail: 'Appointments & services', icon: Calendar },
      { label: 'Active care', value: '4', detail: 'Pets currently in service', icon: HeartPulse },
      { label: 'Messages', value: '6', detail: '2 need response', icon: Bell },
      { label: 'Outcomes', value: '92%', detail: 'Completed as planned', icon: CheckCircle2 },
    ],
    queue: [
      { title: 'Kibo · veterinary follow-up', meta: 'Record review · 10:30 AM', status: 'Next' },
      { title: 'Simba · recall training', meta: 'Program session · 1:00 PM', status: 'Confirmed' },
      { title: 'Luna · sitter handoff', meta: 'Medication instructions updated', status: 'Needs review' },
    ],
    modules: [
      { id: 'providers', title: 'Professional Identity', description: 'Profiles, verification, credentials, offerings and availability.', icon: UserRoundCheck, tab: 'sprint10', accent: 'blue' },
      { id: 'booking', title: 'Appointments & Bookings', description: 'Availability, reservations, rescheduling and cancellation.', icon: Calendar, tab: 'sprint11', accent: 'violet' },
      { id: 'walks', title: 'Dog Walking', description: 'Live walk execution, custody, evidence and incidents.', icon: Footprints, tab: 'sprint13', accent: 'sage' },
      { id: 'vet', title: 'Veterinary Workspace', description: 'Clinical encounters, records, care plans and professional sign-off.', icon: Stethoscope, tab: 'sprint19', accent: 'peach' },
      { id: 'trainer', title: 'Trainer Workspace', description: 'Assessments, programs, sessions, homework and progress.', icon: GraduationCap, tab: 'sprint20', accent: 'violet' },
      { id: 'care', title: 'Grooming, Sitting & Boarding', description: 'Care handover, custody, medication, feeding and incidents.', icon: HeartPulse, tab: 'sprint21', accent: 'sage' },
      { id: 'transport', title: 'Pet Transport', description: 'Verified drivers, vehicles, custody-in-transit and handovers.', icon: Truck, tab: 'sprint22', accent: 'blue' },
      { id: 'reviews', title: 'Reviews & Reputation', description: 'Verified-service feedback, responses, disputes and reputation.', icon: Star, tab: 'sprint23', accent: 'amber' },
      { id: 'professional-ai', title: 'Professional AI', description: 'Authorized drafting and summaries that remain review-required.', icon: Sparkles, tab: 'sprint28', accent: 'violet' },
    ],
  },
  {
    id: 'business',
    label: 'Provider Business',
    shortLabel: 'Business',
    eyebrow: 'Provider business workspace',
    title: 'Run the entire pet-care business from one operating layer.',
    description: 'Team, locations, services, bookings, professional workspaces, SaaS entitlements, quality signals and finance remain connected but independently governed.',
    icon: Building2,
    accent: '#6B5DA8',
    metrics: [
      { label: 'Bookings', value: '42', detail: 'This week', icon: Calendar },
      { label: 'Team', value: '8 / 10', detail: 'Active SaaS seats', icon: Users },
      { label: 'Locations', value: '2', detail: 'Both operating normally', icon: Building2 },
      { label: 'Rating', value: '4.8', detail: '127 verified reviews', icon: Star },
    ],
    queue: [
      { title: 'Two staff invitations pending', meta: 'Seat limit: 8 of 10 used', status: 'Team' },
      { title: 'Saturday capacity nearing limit', meta: 'Boarding · Westlands', status: 'Capacity' },
      { title: 'October payout reconciliation', meta: 'One provider reference needs review', status: 'Finance' },
    ],
    modules: [
      { id: 'provider', title: 'Provider Platform', description: 'Business profile, offerings, locations and professional identity.', icon: Briefcase, tab: 'sprint10', accent: 'blue' },
      { id: 'booking', title: 'Scheduling & Booking', description: 'Availability, reservations, capacity and recurring bookings.', icon: Calendar, tab: 'sprint11', accent: 'violet' },
      { id: 'finance', title: 'Payments & Earnings', description: 'Service payments, commissions, earnings, refunds and payouts.', icon: CircleDollarSign, tab: 'sprint12', accent: 'sage' },
      { id: 'reviews', title: 'Quality & Reputation', description: 'Reviews, responses, disputes and service-quality signals.', icon: Star, tab: 'sprint23', accent: 'amber' },
      { id: 'saas', title: 'Business SaaS', description: 'Plans, seats, locations, advanced operations and business entitlements.', icon: CreditCard, tab: 'sprint26', accent: 'violet' },
      { id: 'vet', title: 'Veterinary Operations', description: 'Clinical work queues and authorized professional workflows.', icon: Stethoscope, tab: 'sprint19', accent: 'peach' },
      { id: 'trainer', title: 'Training Operations', description: 'Trainer programs, sessions and household handoffs.', icon: GraduationCap, tab: 'sprint20', accent: 'violet' },
      { id: 'care', title: 'Care Operations', description: 'Grooming, sitting, daycare and boarding execution.', icon: HeartPulse, tab: 'sprint21', accent: 'sage' },
      { id: 'transport', title: 'Transport Operations', description: 'Drivers, vehicles, trip custody and arrival handoffs.', icon: Truck, tab: 'sprint22', accent: 'blue' },
    ],
  },
  {
    id: 'rescue',
    label: 'Rescue & Welfare',
    shortLabel: 'Rescue',
    eyebrow: 'Animal welfare workspace',
    title: 'From intake to safe outcome, without losing the animal’s story.',
    description: 'Rescue organizations can manage intake, shelter, foster care, reunification, adoption, welfare cases and cross-domain care safely.',
    icon: HeartHandshake,
    accent: '#A76354',
    metrics: [
      { label: 'In care', value: '27', detail: 'Shelter + foster', icon: HeartHandshake },
      { label: 'Reunification', value: '3', detail: 'Claims under review', icon: PawPrint },
      { label: 'Adoption', value: '8', detail: 'Applications active', icon: Users },
      { label: 'Welfare', value: '2', detail: 'Restricted cases', icon: ShieldCheck },
    ],
    queue: [
      { title: 'Microchip match needs human review', meta: 'Intake animal #R-204', status: 'Identity' },
      { title: 'Foster handoff due today', meta: 'Temporary custody transfer', status: 'Custody' },
      { title: 'Reunification claim evidence', meta: 'Two competing claims', status: 'Review' },
    ],
    modules: [
      { id: 'rescue', title: 'Rescue Operations', description: 'Organizations, intake, custody, foster, reunification, adoption and welfare.', icon: HeartHandshake, tab: 'sprint18', accent: 'peach' },
      { id: 'passport', title: 'Identity & History', description: 'Pet identity reconciliation, documents and provenance.', icon: FileText, tab: 'sprint4', accent: 'blue' },
      { id: 'health', title: 'Veterinary Records', description: 'Clinical records and restricted health access.', icon: Stethoscope, tab: 'sprint5', accent: 'peach' },
      { id: 'care', title: 'Daily Care', description: 'Preventive care, feeding and caregiver execution.', icon: Calendar, tab: 'sprint6', accent: 'sage' },
      { id: 'recovery', title: 'Lost Pet & Reunification', description: 'Lost Pet incidents, sightings and recovery evidence.', icon: ShieldCheck, tab: 'sprint15', accent: 'amber' },
      { id: 'community', title: 'Community Network', description: 'Privacy-aware recovery distribution and local support.', icon: Users, tab: 'sprint16', accent: 'violet' },
      { id: 'transport', title: 'Rescue Transport', description: 'Custody-aware transfers between facilities and care providers.', icon: Truck, tab: 'sprint22', accent: 'blue' },
    ],
  },
  {
    id: 'commerce',
    label: 'Seller & Commerce',
    shortLabel: 'Commerce',
    eyebrow: 'Marketplace seller workspace',
    title: 'Commerce that feels trustworthy to buyers and operationally serious to sellers.',
    description: 'Seller onboarding, catalogue, inventory, orders, fulfillment, returns, commissions and payouts are unified without mixing seller identity with service-provider identity.',
    icon: Store,
    accent: '#9A6D2E',
    metrics: [
      { label: 'Orders', value: '31', detail: '7 awaiting action', icon: ShoppingBag },
      { label: 'Inventory', value: '184', detail: '12 low-stock SKUs', icon: Warehouse },
      { label: 'Returns', value: '3', detail: '1 needs inspection', icon: Package },
      { label: 'Payouts', value: 'KES 84k', detail: 'Available', icon: CircleDollarSign },
    ],
    queue: [
      { title: '7 orders awaiting fulfillment', meta: 'Oldest order: 2h 14m', status: 'Orders' },
      { title: 'Harness SKU low stock', meta: '4 units available', status: 'Inventory' },
      { title: 'Damaged-item return', meta: 'Evidence submitted by buyer', status: 'Return' },
    ],
    modules: [
      { id: 'commerce', title: 'Seller Operations', description: 'Seller onboarding, products, listings, inventory, orders, returns and trust.', icon: Store, tab: 'sprint27', accent: 'amber' },
      { id: 'finance', title: 'Marketplace Finance', description: 'Commissions, seller earnings, refunds, holds and payouts.', icon: CircleDollarSign, tab: 'sprint12', accent: 'sage' },
      { id: 'reviews', title: 'Reputation Boundary', description: 'Provider/service reviews remain distinct from commerce product trust.', icon: Star, tab: 'sprint23', accent: 'violet' },
      { id: 'provider', title: 'Business Identity Link', description: 'Optional linkage when a service business also operates as a seller.', icon: Building2, tab: 'sprint10', accent: 'blue' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Billing',
    shortLabel: 'Finance',
    eyebrow: 'Financial control plane',
    title: 'One financial source of truth across the whole platform.',
    description: 'Payments, double-entry ledger, commissions, refunds, earnings, payouts and subscription billing remain centrally reconciled.',
    icon: CircleDollarSign,
    accent: '#2F6B50',
    metrics: [
      { label: 'Collected', value: 'KES 1.42m', detail: 'Current demo period', icon: Receipt },
      { label: 'Refunds', value: 'KES 38k', detail: '11 completed', icon: CreditCard },
      { label: 'Payouts', value: 'KES 904k', detail: 'Provider + seller', icon: CircleDollarSign },
      { label: 'Reconciliation', value: '99.8%', detail: '2 items for review', icon: CheckCircle2 },
    ],
    queue: [
      { title: 'Two reconciliation mismatches', meta: 'Provider and marketplace references', status: 'Review' },
      { title: 'Payout destination verification', meta: 'One seller awaiting approval', status: 'Payout' },
      { title: 'Tracker renewal failed', meta: 'Grace period active', status: 'Billing' },
    ],
    modules: [
      { id: 'finance', title: 'Payments, Ledger & Payouts', description: 'Payment intents, journals, commissions, refunds, earnings and payouts.', icon: Receipt, tab: 'sprint12', accent: 'sage' },
      { id: 'consumer-sub', title: 'Consumer Billing', description: 'Pet-parent subscriptions, entitlements, trials, grace and renewal.', icon: CreditCard, tab: 'sprint24', accent: 'amber' },
      { id: 'tracker-sub', title: 'Tracker Billing', description: 'Device plans, connectivity service and renewal state.', icon: Radio, tab: 'sprint25', accent: 'blue' },
      { id: 'provider-saas', title: 'Provider SaaS Billing', description: 'Business plans, seats, locations and continuity policy.', icon: Building2, tab: 'sprint26', accent: 'violet' },
      { id: 'commerce', title: 'Commerce Economics', description: 'Order economics, seller commission snapshots, refunds and payout references.', icon: ShoppingBag, tab: 'sprint27', accent: 'peach' },
    ],
  },
  {
    id: 'trust',
    label: 'Trust & Operations',
    shortLabel: 'Operations',
    eyebrow: 'Platform operations',
    title: 'Safety, trust and operational continuity across every side of Pet OS.',
    description: 'Verification, review moderation, recovery abuse controls, product safety, continuity management and platform oversight stay separated from commercial incentives.',
    icon: ShieldCheck,
    accent: '#805B8C',
    metrics: [
      { label: 'Open reviews', value: '12', detail: 'Moderation queue', icon: Star },
      { label: 'Safety cases', value: '3', detail: '1 high priority', icon: AlertTriangle },
      { label: 'Verifications', value: '9', detail: 'Provider + seller', icon: UserRoundCheck },
      { label: 'Continuity', value: '0', detail: 'No blocked active care', icon: ShieldCheck },
    ],
    queue: [
      { title: 'Provider credential review', meta: 'Veterinary practice application', status: 'Verification' },
      { title: 'Unsafe product allegation', meta: 'Listing temporarily restricted', status: 'Safety' },
      { title: 'Review privacy report', meta: 'Potential contact information exposure', status: 'Moderation' },
    ],
    modules: [
      { id: 'provider', title: 'Provider Verification', description: 'Professional/business verification and service eligibility.', icon: UserRoundCheck, tab: 'sprint10', accent: 'blue' },
      { id: 'reviews', title: 'Reviews & Moderation', description: 'Reports, disputes, appeals, abuse signals and reputation integrity.', icon: Star, tab: 'sprint23', accent: 'amber' },
      { id: 'community', title: 'Community Safety', description: 'Community moderation, blocking, reporting and recovery distribution.', icon: Users, tab: 'sprint16', accent: 'violet' },
      { id: 'recovery', title: 'Recovery Safety', description: 'Lost Pet abuse protection, sightings and protected recovery data.', icon: ShieldCheck, tab: 'sprint15', accent: 'peach' },
      { id: 'crowd', title: 'Crowd Privacy', description: 'BLE recovery privacy, rotating identifiers and anti-stalking controls.', icon: Radio, tab: 'sprint17', accent: 'blue' },
      { id: 'rescue', title: 'Welfare Operations', description: 'Restricted welfare cases, custody and reunification review.', icon: HeartHandshake, tab: 'sprint18', accent: 'peach' },
      { id: 'commerce', title: 'Commerce Trust', description: 'Seller verification, product moderation, safety reports and recalls.', icon: Store, tab: 'sprint27', accent: 'amber' },
      { id: 'saas', title: 'Continuity Controls', description: 'Ensure active care continues safely through SaaS billing changes.', icon: ShieldCheck, tab: 'sprint26', accent: 'sage' },
      { id: 'ai-safety', title: 'AI Safety Operations', description: 'Model governance, prompt safety, incidents, consent and release gates.', icon: Sparkles, tab: 'sprint28', accent: 'violet' },
    ],
  },
  {
    id: 'intelligence',
    label: 'AI & Intelligence',
    shortLabel: 'Intelligence',
    eyebrow: 'Governed intelligence workspace',
    title: 'Useful intelligence, without surrendering control.',
    description: 'Pet OS AI assembles only authorized context, preserves provenance, applies safety policies before and after generation, and never becomes the source of clinical, financial, tracking or operational truth.',
    icon: Sparkles,
    accent: '#7058A8',
    metrics: [
      { label: 'Models', value: '2 active', detail: 'Risk-aware routing', icon: Sparkles },
      { label: 'Safety', value: '4 gates', detail: 'Critical golden cases', icon: ShieldCheck },
      { label: 'Consent', value: 'Scoped', detail: 'Pet · Health · Location', icon: UserRoundCheck },
      { label: 'Autonomy', value: 'Read-only', detail: 'No unconfirmed writes', icon: Database },
    ],
    queue: [
      { title: 'Sprint 28 evaluation suite', meta: 'Emergency, medication and injection gates', status: 'Safety' },
      { title: 'External model providers', meta: 'Production adapter deferred until server-side secrets are available', status: 'Architecture' },
      { title: 'Action orchestration', meta: 'Human-confirmed write tools begin in Sprint 29', status: 'Next' },
    ],
    modules: [
      { id: 'ai-platform', title: 'Pet Intelligence & AI', description: 'Assistant, recommendations, safety, models, consent and evaluations.', icon: Sparkles, tab: 'sprint28', accent: 'violet' },
      { id: 'health-source', title: 'Clinical Source Context', description: 'Review the canonical health records AI is permitted to summarize.', icon: HeartPulse, tab: 'sprint5', accent: 'peach' },
      { id: 'care-source', title: 'Care Source Context', description: 'Deterministic due-state remains the source for care recommendations.', icon: Calendar, tab: 'sprint6', accent: 'sage' },
      { id: 'training-source', title: 'Training Source Context', description: 'AI guidance respects active plans and professional provenance.', icon: GraduationCap, tab: 'sprint8', accent: 'violet' },
      { id: 'tracking-source', title: 'Tracking Source Context', description: 'Device state, telemetry truth and exact-location privacy remain separate.', icon: MapPin, tab: 'sprint14', accent: 'blue' },
      { id: 'subscription-source', title: 'AI Entitlements', description: 'Premium access is evaluated centrally and cannot override safety.', icon: CreditCard, tab: 'sprint24', accent: 'amber' },
      { id: 'platform-governance', title: 'Platform Governance', description: 'Shared kernel, documentation and architecture decisions behind AI.', icon: Database, tab: 'kernel', accent: 'blue' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform & Engineering',
    shortLabel: 'Platform',
    eyebrow: 'Platform workspace',
    title: 'The system underneath every Pet OS experience.',
    description: 'Shared kernel, engineering baseline, canonical documentation, ADRs, domain verification and the full Sprint 1–27 build lab.',
    icon: Database,
    accent: '#465B6B',
    metrics: [
      { label: 'Product domains', value: '27', detail: 'Implemented sprint surfaces', icon: Layers3 },
      { label: 'Regression', value: 'Passing', detail: 'Unified suite', icon: CheckCircle2 },
      { label: 'Docs', value: '44+', detail: 'Canonical volumes', icon: BookOpen },
      { label: 'Pages', value: 'Live', detail: 'Auto-deployed from main', icon: Activity },
    ],
    queue: [
      { title: 'Sprint 28 readiness', meta: 'Governed Pet Intelligence & AI Platform', status: 'Next' },
      { title: 'Legacy console typing drift', meta: 'Advisory static typecheck remains', status: 'Debt' },
      { title: 'Production persistence', meta: 'In-memory stores still need durable backend', status: 'Roadmap' },
    ],
    modules: [
      { id: 'foundation', title: 'Engineering Foundation', description: 'Repository baseline, build, testing and architecture overview.', icon: Activity, tab: 'overview', accent: 'blue' },
      { id: 'identity', title: 'Identity & Access', description: 'Authentication, households, memberships and authorization.', icon: Users, tab: 'identity', accent: 'sage' },
      { id: 'kernel', title: 'Shared Kernel', description: 'Canonical IDs, event envelope and shared technical primitives.', icon: Database, tab: 'kernel', accent: 'blue' },
      { id: 'docs', title: 'Canonical Documentation', description: 'Architecture volumes and implementation references.', icon: BookOpen, tab: 'documentation', accent: 'violet' },
      { id: 'adrs', title: 'Architecture Decisions', description: 'Formal ADR catalogue and architectural constraints.', icon: Layers3, tab: 'adrs', accent: 'amber' },
      { id: 'sprint2', title: 'Sprint 2 Terminal', description: 'Original identity engineering verification surface.', icon: FlaskConical, tab: 'sprint2', accent: 'peach' },
      { id: 'pet-core', title: 'Pet Core', description: 'Pet identity and lifecycle engineering console.', icon: Dog, tab: 'sprint3', accent: 'sage' },
      { id: 'passport', title: 'Timeline & Passport', description: 'Lifecycle, documents, sharing and provenance console.', icon: FileText, tab: 'sprint4', accent: 'blue' },
      { id: 'health', title: 'Health', description: 'Veterinary health engineering console.', icon: HeartPulse, tab: 'sprint5', accent: 'peach' },
      { id: 'care', title: 'Preventive Care', description: 'Care scheduling and reminders console.', icon: Calendar, tab: 'sprint6', accent: 'sage' },
      { id: 'nutrition', title: 'Nutrition', description: 'Feeding and dietary record console.', icon: Utensils, tab: 'sprint7', accent: 'amber' },
      { id: 'training', title: 'Training', description: 'Skills and behavior console.', icon: GraduationCap, tab: 'sprint8', accent: 'violet' },
      { id: 'activity', title: 'Activity', description: 'Activity, exercise and routine console.', icon: Footprints, tab: 'sprint9', accent: 'blue' },
      { id: 'providers', title: 'Providers', description: 'Provider platform console.', icon: Briefcase, tab: 'sprint10', accent: 'blue' },
      { id: 'booking', title: 'Booking', description: 'Booking and availability console.', icon: Calendar, tab: 'sprint11', accent: 'violet' },
      { id: 'finance', title: 'Finance', description: 'Ledger and payments console.', icon: Receipt, tab: 'sprint12', accent: 'sage' },
      { id: 'walking', title: 'Dog Walking', description: 'Walking execution console.', icon: Footprints, tab: 'sprint13', accent: 'sage' },
      { id: 'tracking', title: 'Tracking', description: 'Device and live location console.', icon: MapPin, tab: 'sprint14', accent: 'blue' },
      { id: 'recovery', title: 'Lost Pet Recovery', description: 'Safe zones and incident recovery console.', icon: ShieldCheck, tab: 'sprint15', accent: 'peach' },
      { id: 'community', title: 'Community', description: 'Community platform console.', icon: Users, tab: 'sprint16', accent: 'violet' },
      { id: 'crowd', title: 'Crowd Recovery', description: 'BLE recovery network console.', icon: Radio, tab: 'sprint17', accent: 'blue' },
      { id: 'rescue', title: 'Rescue & Welfare', description: 'Rescue, foster and adoption console.', icon: HeartHandshake, tab: 'sprint18', accent: 'peach' },
      { id: 'vet', title: 'Vet Workspace', description: 'Veterinary professional console.', icon: Stethoscope, tab: 'sprint19', accent: 'peach' },
      { id: 'trainer', title: 'Trainer Workspace', description: 'Trainer professional console.', icon: GraduationCap, tab: 'sprint20', accent: 'violet' },
      { id: 'care-pro', title: 'Care Workspaces', description: 'Grooming, sitter, daycare and boarding console.', icon: HeartPulse, tab: 'sprint21', accent: 'sage' },
      { id: 'transport', title: 'Transport', description: 'Pet transport console.', icon: Truck, tab: 'sprint22', accent: 'blue' },
      { id: 'reviews', title: 'Reviews & Trust', description: 'Review and reputation console.', icon: Star, tab: 'sprint23', accent: 'amber' },
      { id: 'subscriptions', title: 'Consumer Subscriptions', description: 'Consumer entitlement and billing console.', icon: CreditCard, tab: 'sprint24', accent: 'amber' },
      { id: 'tracker-plans', title: 'Tracker Plans', description: 'Connectivity subscription console.', icon: Radio, tab: 'sprint25', accent: 'blue' },
      { id: 'provider-saas', title: 'Provider SaaS', description: 'Business SaaS console.', icon: Building2, tab: 'sprint26', accent: 'violet' },
      { id: 'commerce', title: 'Marketplace Commerce', description: 'Seller and commerce console.', icon: Store, tab: 'sprint27', accent: 'amber' },
      { id: 'ai', title: 'Pet Intelligence & AI', description: 'Governed context, model routing, recommendations and evaluation console.', icon: Sparkles, tab: 'sprint28', accent: 'violet' },
    ],
  },
];

const WorkspaceIcon = ({ icon: Icon, active = false }: { icon: React.ElementType; active?: boolean }) => (
  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${active ? 'bg-white/14 text-white' : 'bg-[#EEF1ED] text-[#68766E]'}`}>
    <Icon className="h-[18px] w-[18px]" />
  </span>
);

const MetricCard = ({ metric }: { metric: WorkspaceDef['metrics'][number] }) => {
  const Icon = metric.icon;
  return (
    <div className="rounded-[22px] border border-[#E7EAE6] bg-white p-5 shadow-[0_12px_35px_rgba(30,49,40,0.045)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A948E]">{metric.label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#1A2922]">{metric.value}</p>
          <p className="mt-1 text-sm text-[#7D8781]">{metric.detail}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EEF3EF] text-[#426854]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
};

const ModuleCard = ({ module, onOpen }: { module: ModuleDef; onOpen: () => void }) => {
  const Icon = module.icon;
  const tone = toneClasses[module.accent || 'sage'];
  return (
    <button
      onClick={onOpen}
      className="group flex min-h-[170px] flex-col rounded-[24px] border border-[#E6E9E5] bg-white p-5 text-left shadow-[0_14px_38px_rgba(32,52,43,0.045)] transition hover:-translate-y-0.5 hover:border-[#D6DED8] hover:shadow-[0_18px_44px_rgba(32,52,43,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-[#BAC2BD] transition group-hover:translate-x-0.5 group-hover:text-[#557262]" />
      </div>
      <div className="mt-5">
        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[#26352D]">{module.title}</h3>
        <p className="mt-1.5 text-[13px] leading-5 text-[#7A8580]">{module.description}</p>
      </div>
      <div className="mt-auto pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8E9892]">
        Open workspace
      </div>
    </button>
  );
};

export const UnifiedPetOSExperience: React.FC<UnifiedPetOSExperienceProps> = ({ onOpenModule }) => {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>('owner');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspace = useMemo(() => workspaces.find((item) => item.id === workspaceId) || workspaces[0], [workspaceId]);

  const selectWorkspace = (id: WorkspaceId) => {
    setWorkspaceId(id);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const SidebarContent = () => (
    <>
      <div className="flex h-[82px] items-center gap-3 px-5">
        <div className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#1F5F46] text-white shadow-[0_8px_20px_rgba(31,95,70,0.2)]">
          <PawPrint className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.03em] text-[#18271F]">Pet OS</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#9AA39E]">One platform · every side</p>
        </div>
      </div>

      <div className="px-4">
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A0A8A4]">Workspaces</p>
        <div className="space-y-1">
          {workspaces.map((item) => {
            const Icon = item.icon;
            const active = item.id === workspaceId;
            return (
              <button
                key={item.id}
                onClick={() => selectWorkspace(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-[#173F31] text-white shadow-sm' : 'text-[#67736D] hover:bg-[#EFF2EE] hover:text-[#314038]'}`}
              >
                <WorkspaceIcon icon={Icon} active={active} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[#E6C27A]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-[#ECEEEC] p-4">
        <div className="rounded-[20px] border border-[#E5E9E5] bg-white p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E7DDD2] text-xs font-bold text-[#765A48]">EV</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#2C3A33]">Elena Vance</p>
              <p className="truncate text-[11px] text-[#909995]">Household owner · Nairobi</p>
            </div>
            <Settings className="h-4 w-4 text-[#9BA39F]" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F6F7F4] text-[#1B2A23]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-[#E5E8E3] bg-[#FBFCFA] lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-[#13271E]/30 backdrop-blur-sm" />
          <div className="relative flex h-full w-[88%] max-w-[350px] flex-col bg-[#FBFCFA] shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#65716B]"><X className="h-5 w-5" /></button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-[#E6E9E5]/90 bg-[#F6F7F4]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[74px] max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-10">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-[#4C5A53] lg:hidden"><Menu className="h-5 w-5" /></button>

            <div className="relative">
              <button
                onClick={() => setWorkspaceMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl px-2 py-2 text-left transition hover:bg-white"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[#4E675A] shadow-sm">
                  {React.createElement(workspace.icon, { className: 'h-4 w-4' })}
                </span>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A0A8A4]">Current workspace</p>
                  <p className="text-sm font-semibold text-[#34433B]">{workspace.label}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-[#98A09C]" />
              </button>

              {workspaceMenuOpen && (
                <div className="absolute left-0 top-[54px] z-40 w-[280px] rounded-[22px] border border-[#E3E7E3] bg-white p-2 shadow-[0_22px_60px_rgba(32,52,43,0.16)]">
                  {workspaces.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={() => selectWorkspace(item.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-[#F5F7F4]">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF2EE] text-[#627069]"><Icon className="h-[17px] w-[17px]" /></span>
                        <div>
                          <p className="text-sm font-semibold text-[#324038]">{item.label}</p>
                          <p className="text-[11px] text-[#929B96]">{item.shortLabel}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="hidden h-10 items-center gap-2 rounded-2xl border border-[#E1E5E1] bg-white px-3.5 text-sm text-[#858F8A] shadow-sm md:flex md:w-72">
                <Search className="h-4 w-4" />
                <span className="truncate">Search Pet OS…</span>
                <span className="ml-auto rounded-md border border-[#E7EAE7] px-1.5 py-0.5 text-[10px] text-[#A0A8A4]">⌘K</span>
              </button>
              <button className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[#E1E5E1] bg-white text-[#5F6C65] shadow-sm">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E3795A] ring-2 ring-white" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1540px] px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
          <div className="relative overflow-hidden rounded-[30px] border border-[#E3E7E3] bg-white px-6 py-7 shadow-[0_18px_55px_rgba(31,52,42,0.055)] md:px-8 md:py-8">
            <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full opacity-[0.09]" style={{ background: workspace.accent }} />
            <div className="relative z-10 max-w-4xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.17em]" style={{ color: workspace.accent }}>{workspace.eyebrow}</p>
              <h1 className="mt-3 text-[31px] font-semibold tracking-[-0.045em] text-[#1B2A23] md:text-[42px]">{workspace.title}</h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-6 text-[#748079]">{workspace.description}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspace.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-[26px] border border-[#E6E9E5] bg-white p-5 shadow-[0_16px_45px_rgba(31,52,42,0.045)] md:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8B9590]">Workspace map</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#223129]">Everything in {workspace.label}</h2>
                </div>
                <span className="rounded-full bg-[#F0F3F0] px-3 py-1 text-xs font-semibold text-[#68746E]">{workspace.modules.length} modules</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#7E8983]">
                The product shell gives each side of Pet OS a clear home. Open any module to access the full operational implementation already built through Sprint 27.
              </p>
            </section>

            <section className="rounded-[26px] border border-[#DDE6E0] bg-[#EDF5F0] p-5 md:p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#6656A2] shadow-sm"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-semibold text-[#26362E]">Pet OS intelligence</p>
                  <p className="text-xs text-[#7E8983]">Sprint 28 active</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#61716A]">
                AI will sit across these workspaces as a governed assistive layer — never as a replacement for clinical, financial, safety or operational source-of-truth domains.
              </p>
            </section>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8B9590]">Operational modules</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#223129]">Open a domain</h2>
              </div>
              {workspace.id === 'platform' && (
                <span className="hidden rounded-full bg-[#EEF1F5] px-3 py-1 text-xs font-semibold text-[#667381] sm:inline">Sprint 1–28 coverage</span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {workspace.modules.map((module) => (
                <ModuleCard key={module.id} module={module} onOpen={() => onOpenModule(module.tab)} />
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
            <section className="rounded-[26px] border border-[#E6E9E5] bg-white p-5 shadow-[0_16px_45px_rgba(31,52,42,0.045)] md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8B9590]">Needs attention</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#223129]">Operational queue</h2>
                </div>
                <ClipboardList className="h-5 w-5 text-[#7C8982]" />
              </div>
              <div className="mt-5 divide-y divide-[#EEF0ED]">
                {workspace.queue.map((item) => (
                  <div key={item.title} className="flex items-center gap-3 py-4">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: workspace.accent }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#34433B]">{item.title}</p>
                      <p className="truncate text-xs text-[#909A94]">{item.meta}</p>
                    </div>
                    <span className="rounded-full bg-[#F2F4F2] px-2.5 py-1 text-[11px] font-semibold text-[#68746E]">{item.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] bg-[#173F31] p-6 text-white shadow-[0_22px_55px_rgba(23,63,49,0.18)]">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Layers3 className="h-5 w-5 text-[#F1D38F]" /></span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-[#C9D9D1]">Unified platform</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">Nothing is hidden behind the pet-parent view anymore.</h3>
              <p className="mt-2 text-sm leading-6 text-[#B9CEC3]">
                Professional care, provider business operations, rescue, commerce, finance, trust, subscriptions, device plans and engineering are first-class workspaces in the same product shell.
              </p>
              <button onClick={() => selectWorkspace('platform')} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#F1D38F]">
                View platform coverage <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          </div>
        </main>

        <footer className="mx-auto max-w-[1540px] px-4 pb-8 pt-2 text-xs text-[#9AA39E] sm:px-6 lg:px-8 xl:px-10">
          <div className="flex flex-col gap-2 border-t border-[#E4E8E4] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <span>Pet OS · Pet parents, professionals, businesses, rescue, sellers and operations on one platform.</span>
            <span>Privacy · Safety · Provenance · Financial integrity</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
