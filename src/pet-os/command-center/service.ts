
import { IdentityStore } from '../identity/store';
import { PetStore } from '../pet-core/store';
import { CareStore } from '../care/store';
import { BookingStore } from '../booking/store';
import { NotificationStore } from '../notifications/store';
import { TrackingStore } from '../tracking/store';
import { CommerceStore } from '../commerce/store';
import { OrchestrationStore } from '../orchestration/store';
import {
  ActionInboxItem,
  AttentionSeverity,
  CommandCenterContext,
  CommandCenterModuleTab,
  CommandCenterSnapshot,
  GlobalSearchResult,
  SearchCategory,
  SearchOptions,
  TodayItem,
} from './types';

interface ModuleSearchEntry {
  id: string;
  title: string;
  subtitle: string;
  tab: CommandCenterModuleTab;
  keywords: string[];
}

export const COMMAND_CENTER_MODULES: ModuleSearchEntry[] = [
  { id: 'identity', title: 'Identity & Household', subtitle: 'Accounts, caregivers, roles and access.', tab: 'identity', keywords: ['household', 'caregiver', 'member', 'access', 'identity'] },
  { id: 'pet-core', title: 'Pet Digital Twin', subtitle: 'Canonical Pet identity and lifecycle profile.', tab: 'sprint3', keywords: ['pet', 'profile', 'identity', 'breed', 'microchip'] },
  { id: 'passport', title: 'Timeline & Passport', subtitle: 'Documents, provenance and portable Pet Passport.', tab: 'sprint4', keywords: ['passport', 'documents', 'timeline', 'share'] },
  { id: 'health', title: 'Health', subtitle: 'Clinical history, vaccinations, medications and allergies.', tab: 'sprint5', keywords: ['health', 'vet', 'vaccination', 'medication', 'allergy'] },
  { id: 'care', title: 'Preventive Care', subtitle: 'Care obligations, schedules, due tasks and reminders.', tab: 'sprint6', keywords: ['care', 'task', 'reminder', 'due', 'overdue'] },
  { id: 'nutrition', title: 'Nutrition', subtitle: 'Feeding plans, meals, hydration and dietary restrictions.', tab: 'sprint7', keywords: ['food', 'feeding', 'meal', 'nutrition', 'diet'] },
  { id: 'training', title: 'Training', subtitle: 'Skills, programs and behavior progress.', tab: 'sprint8', keywords: ['training', 'skill', 'behavior', 'program'] },
  { id: 'activity', title: 'Activity', subtitle: 'Walks, play, exercise, enrichment and rest.', tab: 'sprint9', keywords: ['activity', 'walk', 'exercise', 'rest', 'play'] },
  { id: 'providers', title: 'Providers', subtitle: 'Professional identity, services and verification.', tab: 'sprint10', keywords: ['provider', 'vet', 'trainer', 'groomer', 'walker'] },
  { id: 'booking', title: 'Services & Booking', subtitle: 'Availability, reservations and appointments.', tab: 'sprint11', keywords: ['booking', 'appointment', 'service', 'reservation'] },
  { id: 'finance', title: 'Payments & Finance', subtitle: 'Payments, refunds, earnings and payouts.', tab: 'sprint12', keywords: ['payment', 'money', 'refund', 'payout', 'finance'] },
  { id: 'walking', title: 'Dog Walking', subtitle: 'Walk execution, custody, safety and evidence.', tab: 'sprint13', keywords: ['walker', 'walk', 'handover', 'route'] },
  { id: 'tracking', title: 'Tracking & Devices', subtitle: 'Live location, routes and tracker health.', tab: 'sprint14', keywords: ['tracker', 'device', 'gps', 'location', 'battery'] },
  { id: 'lost-pet', title: 'Lost Pet Recovery', subtitle: 'Lost Pet incidents, sightings and recovery.', tab: 'sprint15', keywords: ['lost', 'missing', 'recovery', 'sighting'] },
  { id: 'community', title: 'Community', subtitle: 'Groups, events and recovery-network participation.', tab: 'sprint16', keywords: ['community', 'group', 'event', 'recovery'] },
  { id: 'crowd', title: 'Crowd Recovery', subtitle: 'Privacy-preserving BLE recovery network.', tab: 'sprint17', keywords: ['ble', 'crowd', 'beacon', 'recovery'] },
  { id: 'rescue', title: 'Rescue & Welfare', subtitle: 'Intake, foster, reunification and adoption.', tab: 'sprint18', keywords: ['rescue', 'foster', 'adoption', 'welfare', 'shelter'] },
  { id: 'vet-workspace', title: 'Veterinary Workspace', subtitle: 'Clinical encounters and professional records.', tab: 'sprint19', keywords: ['veterinary', 'clinic', 'encounter', 'clinical'] },
  { id: 'trainer-workspace', title: 'Trainer Workspace', subtitle: 'Professional training programs and sessions.', tab: 'sprint20', keywords: ['trainer', 'training', 'session'] },
  { id: 'care-workspace', title: 'Care Workspaces', subtitle: 'Grooming, sitting, boarding and daycare.', tab: 'sprint21', keywords: ['grooming', 'sitter', 'boarding', 'daycare'] },
  { id: 'transport', title: 'Pet Transport', subtitle: 'Drivers, vehicles, trip custody and handovers.', tab: 'sprint22', keywords: ['transport', 'driver', 'vehicle', 'trip'] },
  { id: 'reviews', title: 'Reviews & Reputation', subtitle: 'Verified reviews, disputes and reputation.', tab: 'sprint23', keywords: ['review', 'rating', 'reputation', 'dispute'] },
  { id: 'subscription', title: 'Membership & Premium', subtitle: 'Consumer plans, entitlements and billing.', tab: 'sprint24', keywords: ['subscription', 'premium', 'plan', 'billing'] },
  { id: 'tracker-plan', title: 'Tracker Plans', subtitle: 'Device connectivity subscriptions.', tab: 'sprint25', keywords: ['tracker', 'connectivity', 'sim', 'plan'] },
  { id: 'provider-saas', title: 'Provider SaaS', subtitle: 'Seats, locations and business entitlements.', tab: 'sprint26', keywords: ['saas', 'seat', 'business', 'location'] },
  { id: 'commerce', title: 'Store & Orders', subtitle: 'Products, checkout, orders and returns.', tab: 'sprint27', keywords: ['store', 'product', 'order', 'return', 'commerce'] },
  { id: 'ai', title: 'Pet OS AI', subtitle: 'Grounded assistant, recommendations and safety.', tab: 'sprint28', keywords: ['ai', 'assistant', 'recommendation', 'intelligence'] },
  { id: 'automation', title: 'Automation & Actions', subtitle: 'Human-confirmed actions, rules and workflows.', tab: 'sprint29', keywords: ['automation', 'action', 'workflow', 'approval', 'confirmation'] },
  { id: 'command-center', title: 'Command Center', subtitle: 'Today, search, action inbox and household pulse.', tab: 'sprint30', keywords: ['home', 'today', 'search', 'inbox', 'command center'] },
  { id: 'integrations', title: 'Integrations & Developer Platform', subtitle: 'Connected apps, scoped APIs, signed webhooks and audit.', tab: 'sprint31', keywords: ['integration', 'developer', 'api', 'webhook', 'connected app', 'credential'] },
];

function requireAccess(ctx: CommandCenterContext): void {
  const membership = IdentityStore.findMembership(ctx.householdId, ctx.actorUserId);
  if (!membership || membership.status !== 'ACTIVE') {
    throw new Error('COMMAND_CENTER_ACCESS_DENIED');
  }
}

function dateParts(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const parts = dateFmt.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '0000';
  const month = parts.find((p) => p.type === 'month')?.value || '00';
  const day = parts.find((p) => p.type === 'day')?.value || '00';
  return { date: year + '-' + month + '-' + day, time: timeFmt.format(d) };
}

function severityForCare(status: string): AttentionSeverity {
  if (status === 'OVERDUE') return 'HIGH';
  if (status === 'DUE') return 'MEDIUM';
  return 'LOW';
}

function normalize(value: unknown): string {
  return String(value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

function scoreDocument(query: string, title: string, subtitle: string, keywords: string[]): number {
  const q = normalize(query);
  if (!q) return 0;
  const tokens = q.split(/\s+/).filter(Boolean);
  const titleN = normalize(title);
  const subtitleN = normalize(subtitle);
  const keywordN = keywords.map(normalize);
  let score = 0;
  if (titleN === q) score += 120;
  if (titleN.startsWith(q)) score += 70;
  if (titleN.includes(q)) score += 45;
  if (subtitleN.includes(q)) score += 20;
  for (const token of tokens) {
    if (titleN.startsWith(token)) score += 24;
    else if (titleN.includes(token)) score += 16;
    if (subtitleN.includes(token)) score += 8;
    if (keywordN.some((k) => k === token)) score += 18;
    else if (keywordN.some((k) => k.includes(token))) score += 10;
  }
  return score;
}

function bookingIsOpen(status: string): boolean {
  return !['DECLINED', 'EXPIRED', 'CANCELLED_BY_OWNER', 'CANCELLED_BY_PROVIDER', 'COMPLETED', 'NO_SHOW'].includes(status);
}

function orderIsOpen(status: string): boolean {
  return !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(status);
}

export class CommandCenterService {
  static getSnapshot(ctx: CommandCenterContext): CommandCenterSnapshot {
    requireAccess(ctx);
    const timezone = ctx.timezone || 'Africa/Nairobi';
    const now = ctx.now || new Date().toISOString();
    const localDate = dateParts(now, timezone).date;
    const nowMs = new Date(now).getTime();

    const pets = PetStore.listPetsByHousehold(ctx.householdId).filter((p) => p.status !== 'ARCHIVED');
    const care = CareStore.getAllOccurrences().filter((o) => o.householdId === ctx.householdId);
    const bookings = BookingStore.getInstance().listBookingsByHousehold(ctx.householdId);
    const notifications = NotificationStore.getNotificationsForUser(ctx.actorUserId);
    const tracking = TrackingStore.getInstance();
    const orchestration = OrchestrationStore.getInstance();
    const orders = CommerceStore.getInstance().listOrdersForBuyer(ctx.actorUserId)
      .filter((o) => !o.householdId || o.householdId === ctx.householdId);

    const today: TodayItem[] = [];

    for (const o of care) {
      const local = dateParts(o.scheduledFor, timezone);
      if (local.date !== localDate || ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(o.status)) continue;
      today.push({
        id: 'care:' + o.occurrenceId,
        kind: 'CARE',
        title: o.title,
        subtitle: o.status === 'OVERDUE' ? 'Care is overdue' : o.status === 'DUE' ? 'Care is due today' : 'Scheduled care',
        occurredAt: o.scheduledFor,
        localTimeLabel: local.time,
        status: o.status,
        severity: severityForCare(o.status),
        tab: 'sprint6',
        petId: o.petId,
        resourceId: String(o.occurrenceId),
        sourceDomain: 'CARE',
      });
    }

    for (const b of bookings) {
      const local = dateParts(b.startAt, timezone);
      if (local.date !== localDate || !bookingIsOpen(b.status)) continue;
      today.push({
        id: 'booking:' + b.bookingId,
        kind: 'BOOKING',
        title: b.serviceSnapshot.title,
        subtitle: b.petSnapshots.map((p) => p.displayName).join(', ') || 'Service booking',
        occurredAt: b.startAt,
        localTimeLabel: local.time,
        status: b.status,
        severity: b.status === 'PENDING_PROVIDER' ? 'MEDIUM' : 'INFO',
        tab: 'sprint11',
        petId: b.petIds[0],
        resourceId: String(b.bookingId),
        sourceDomain: 'BOOKING',
      });
    }

    for (const n of notifications) {
      const local = dateParts(n.scheduledAt, timezone);
      if (local.date !== localDate || n.isDismissed) continue;
      today.push({
        id: 'notification:' + n.notificationId,
        kind: 'NOTIFICATION',
        title: n.title,
        subtitle: n.body,
        occurredAt: n.scheduledAt,
        localTimeLabel: local.time,
        status: n.status,
        severity: n.priority === 'CRITICAL' ? 'CRITICAL' : n.priority === 'HIGH' ? 'HIGH' : 'INFO',
        tab: n.notificationType.startsWith('BOOKING') ? 'sprint11' : 'sprint6',
        petId: n.petId,
        resourceId: String(n.notificationId),
        sourceDomain: 'NOTIFICATIONS',
      });
    }

    for (const s of orchestration.listSchedules()) {
      const local = dateParts(s.executeAt, timezone);
      const p = orchestration.getProposal(s.actionProposalId);
      if (local.date !== localDate || !p) continue;
      today.push({
        id: 'automation:' + s.scheduledActionId,
        kind: 'AUTOMATION',
        title: p.preview?.title || p.actionType,
        subtitle: p.preview?.summary || 'Scheduled Pet OS action',
        occurredAt: s.executeAt,
        localTimeLabel: local.time,
        status: s.status,
        severity: 'LOW',
        tab: 'sprint29',
        petId: p.petId,
        resourceId: String(s.scheduledActionId),
        sourceDomain: 'ORCHESTRATION',
      });
    }

    for (const o of orders) {
      const local = dateParts(o.updatedAt, timezone);
      if (local.date !== localDate || !orderIsOpen(o.status)) continue;
      today.push({
        id: 'order:' + o.orderId,
        kind: 'ORDER',
        title: 'Order ' + String(o.orderId).slice(-8),
        subtitle: o.currency + ' ' + (o.totalMinor / 100).toFixed(2),
        occurredAt: o.updatedAt,
        localTimeLabel: local.time,
        status: o.status,
        severity: o.status === 'PENDING_PAYMENT' ? 'MEDIUM' : 'INFO',
        tab: 'sprint27',
        resourceId: String(o.orderId),
        sourceDomain: 'COMMERCE',
      });
    }

    today.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    const inbox: ActionInboxItem[] = [];
    for (const p of orchestration.listProposals().filter((p) => p.householdId === ctx.householdId)) {
      if (p.actorUserId === ctx.actorUserId && p.status === 'AWAITING_CONFIRMATION') {
        inbox.push({
          id: 'confirm:' + p.actionProposalId,
          kind: 'ACTION_CONFIRMATION',
          title: p.preview?.title || p.actionType,
          subtitle: p.preview?.summary || 'Review and confirm this action.',
          severity: p.preview?.privacyImpact === 'PUBLIC' ? 'HIGH' : 'MEDIUM',
          createdAt: p.createdAt,
          tab: 'sprint29',
          resourceId: String(p.actionProposalId),
          petId: p.petId,
          requiresHumanDecision: true,
          sourceDomain: 'ORCHESTRATION',
        });
      } else if (p.actorUserId === ctx.actorUserId && ['STALE', 'FAILED', 'PARTIALLY_COMPLETED'].includes(p.status)) {
        inbox.push({
          id: 'recover:' + p.actionProposalId,
          kind: 'ACTION_RECOVERY',
          title: p.preview?.title || p.actionType,
          subtitle: 'Action needs review: ' + p.status,
          severity: 'HIGH',
          createdAt: p.updatedAt,
          tab: 'sprint29',
          resourceId: String(p.actionProposalId),
          petId: p.petId,
          requiresHumanDecision: true,
          sourceDomain: 'ORCHESTRATION',
        });
      }
    }

    for (const approval of orchestration.listApprovals().filter((a) => a.status === 'PENDING' && a.requestedFromUserIds.includes(ctx.actorUserId))) {
      const p = orchestration.getProposal(approval.actionProposalId);
      if (!p || p.householdId !== ctx.householdId) continue;
      inbox.push({
        id: 'approval:' + approval.approvalRequestId,
        kind: 'APPROVAL',
        title: p.preview?.title || p.actionType,
        subtitle: approval.reason,
        severity: 'MEDIUM',
        createdAt: approval.requestedAt,
        tab: 'sprint29',
        resourceId: String(approval.approvalRequestId),
        petId: p.petId,
        requiresHumanDecision: true,
        sourceDomain: 'ORCHESTRATION',
      });
    }

    for (const o of care.filter((o) => o.status === 'OVERDUE')) {
      inbox.push({
        id: 'overdue:' + o.occurrenceId,
        kind: 'OVERDUE_CARE',
        title: o.title,
        subtitle: 'Overdue care needs household attention.',
        severity: 'HIGH',
        createdAt: o.updatedAt,
        tab: 'sprint6',
        resourceId: String(o.occurrenceId),
        petId: o.petId,
        requiresHumanDecision: false,
        sourceDomain: 'CARE',
      });
    }

    for (const n of notifications.filter((n) => !n.isRead && !n.isDismissed && ['HIGH', 'CRITICAL'].includes(n.priority))) {
      inbox.push({
        id: 'important:' + n.notificationId,
        kind: 'IMPORTANT_NOTIFICATION',
        title: n.title,
        subtitle: n.body,
        severity: n.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        createdAt: n.createdAt,
        tab: n.notificationType.startsWith('BOOKING') ? 'sprint11' : 'sprint6',
        resourceId: String(n.notificationId),
        petId: n.petId,
        requiresHumanDecision: false,
        sourceDomain: 'NOTIFICATIONS',
      });
    }

    const rank: Record<AttentionSeverity, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
    inbox.sort((a, b) => rank[b.severity] - rank[a.severity] || b.createdAt.localeCompare(a.createdAt));

    const petSummaries = pets.map((p) => {
      const petCare = care.filter((o) => o.petId === p.petId);
      const assignment = tracking.getActiveAssignmentForPet(p.petId);
      const device = assignment ? tracking.getDevice(assignment.deviceId) : undefined;
      const trackerStatus = device ? device.connectivityStatus : 'NOT_ASSIGNED';
      return {
        petId: p.petId,
        name: p.name,
        species: p.speciesCode,
        lifecycleStage: p.lifecycleStage,
        status: p.status,
        dueToday: petCare.filter((o) => dateParts(o.scheduledFor, timezone).date === localDate && !['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(o.status)).length,
        overdue: petCare.filter((o) => o.status === 'OVERDUE').length,
        upcomingBookings: bookings.filter((b) => b.petIds.includes(p.petId) && bookingIsOpen(b.status) && new Date(b.startAt).getTime() >= nowMs).length,
        trackerStatus,
        batteryPercent: device?.batteryPercent,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const recentActivity: TodayItem[] = [];
    for (const p of orchestration.listProposals().filter((p) => p.householdId === ctx.householdId && ['COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED'].includes(p.status)).slice(0, 8)) {
      recentActivity.push({
        id: 'activity-action:' + p.actionProposalId,
        kind: 'AUTOMATION',
        title: p.preview?.title || p.actionType,
        subtitle: p.preview?.summary || p.status,
        occurredAt: p.updatedAt,
        localTimeLabel: dateParts(p.updatedAt, timezone).time,
        status: p.status,
        severity: p.status === 'COMPLETED' ? 'INFO' : 'HIGH',
        tab: 'sprint29',
        petId: p.petId,
        resourceId: String(p.actionProposalId),
        sourceDomain: 'ORCHESTRATION',
      });
    }
    for (const b of bookings.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)) {
      recentActivity.push({
        id: 'activity-booking:' + b.bookingId,
        kind: 'BOOKING',
        title: b.serviceSnapshot.title,
        subtitle: b.petSnapshots.map((p) => p.displayName).join(', '),
        occurredAt: b.updatedAt,
        localTimeLabel: dateParts(b.updatedAt, timezone).time,
        status: b.status,
        severity: 'INFO',
        tab: 'sprint11',
        petId: b.petIds[0],
        resourceId: String(b.bookingId),
        sourceDomain: 'BOOKING',
      });
    }
    for (const o of orders.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)) {
      recentActivity.push({
        id: 'activity-order:' + o.orderId,
        kind: 'ORDER',
        title: 'Order ' + String(o.orderId).slice(-8),
        subtitle: o.currency + ' ' + (o.totalMinor / 100).toFixed(2),
        occurredAt: o.updatedAt,
        localTimeLabel: dateParts(o.updatedAt, timezone).time,
        status: o.status,
        severity: 'INFO',
        tab: 'sprint27',
        resourceId: String(o.orderId),
        sourceDomain: 'COMMERCE',
      });
    }
    recentActivity.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    return {
      actorUserId: ctx.actorUserId,
      householdId: ctx.householdId,
      timezone,
      localDate,
      generatedAt: new Date().toISOString(),
      pulse: {
        pets: pets.length,
        dueToday: care.filter((o) => dateParts(o.scheduledFor, timezone).date === localDate && !['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(o.status)).length,
        overdueCare: care.filter((o) => o.status === 'OVERDUE').length,
        upcomingBookings: bookings.filter((b) => bookingIsOpen(b.status) && new Date(b.startAt).getTime() >= nowMs).length,
        unreadNotifications: notifications.filter((n) => !n.isRead && !n.isDismissed).length,
        onlineTrackers: tracking.listDevicesForHousehold(ctx.householdId).filter((d) => d.connectivityStatus === 'ONLINE').length,
        actionInbox: inbox.length,
        ordersInProgress: orders.filter((o) => orderIsOpen(o.status)).length,
      },
      pets: petSummaries,
      today,
      inbox,
      recentActivity: recentActivity.slice(0, 12),
    };
  }

  static search(options: SearchOptions): GlobalSearchResult[] {
    requireAccess(options);
    const query = normalize(options.query);
    if (query.length < 2) return [];
    const allowed = options.categories ? new Set(options.categories) : undefined;
    const limit = Math.max(1, Math.min(options.limit || 20, 50));
    const results: GlobalSearchResult[] = [];

    const add = (
      category: SearchCategory,
      id: string,
      title: string,
      subtitle: string,
      keywords: string[],
      tab: CommandCenterModuleTab,
      resourceId?: string,
      petId?: any,
      sourceDomain = 'PLATFORM',
    ) => {
      if (allowed && !allowed.has(category)) return;
      const score = scoreDocument(query, title, subtitle, keywords);
      if (score <= 0) return;
      results.push({ id, category, title, subtitle, keywords, tab, resourceId, petId, score, sourceDomain });
    };

    for (const m of COMMAND_CENTER_MODULES) {
      add('MODULE', 'module:' + m.id, m.title, m.subtitle, m.keywords, m.tab, undefined, undefined, 'PLATFORM');
    }

    for (const p of PetStore.listPetsByHousehold(options.householdId).filter((p) => p.status !== 'ARCHIVED')) {
      add('PET', 'pet:' + p.petId, p.name, p.speciesCode + ' · ' + (p.breedCode || 'Unknown breed') + ' · ' + p.lifecycleStage, [p.name, p.speciesCode, p.breedCode || '', p.lifecycleStage, p.status], 'sprint3', String(p.petId), p.petId, 'PET_CORE');
    }

    for (const o of CareStore.getObligationsForHousehold(options.householdId)) {
      add('CARE', 'care:' + o.careObligationId, o.title, o.category + ' · ' + o.status, [o.title, o.category, o.careType, o.status], 'sprint6', String(o.careObligationId), o.petId, 'CARE');
    }

    for (const b of BookingStore.getInstance().listBookingsByHousehold(options.householdId)) {
      add('BOOKING', 'booking:' + b.bookingId, b.serviceSnapshot.title, b.petSnapshots.map((p) => p.displayName).join(', ') + ' · ' + b.status, [b.serviceSnapshot.title, b.status].concat(b.petSnapshots.map((p) => p.displayName)), 'sprint11', String(b.bookingId), b.petIds[0], 'BOOKING');
    }

    for (const n of NotificationStore.getNotificationsForUser(options.actorUserId).filter((n) => !n.isDismissed)) {
      add('NOTIFICATION', 'notification:' + n.notificationId, n.title, n.notificationType + ' · ' + n.status, [n.title, n.notificationType, n.status], n.notificationType.startsWith('BOOKING') ? 'sprint11' : 'sprint6', String(n.notificationId), n.petId, 'NOTIFICATIONS');
    }

    for (const o of CommerceStore.getInstance().listOrdersForBuyer(options.actorUserId).filter((o) => !o.householdId || o.householdId === options.householdId)) {
      add('ORDER', 'order:' + o.orderId, 'Order ' + String(o.orderId).slice(-8), o.status + ' · ' + o.currency + ' ' + (o.totalMinor / 100).toFixed(2), [String(o.orderId), o.status, o.currency], 'sprint27', String(o.orderId), undefined, 'COMMERCE');
    }

    const tracking = TrackingStore.getInstance();
    for (const d of tracking.listDevicesForHousehold(options.householdId)) {
      add('DEVICE', 'device:' + d.deviceId, d.displayName, d.model + ' · ' + d.connectivityStatus + ' · battery ' + d.batteryStatus, [d.displayName, d.model, d.provider, d.connectivityStatus, d.batteryStatus], 'sprint14', String(d.deviceId), tracking.getActiveAssignmentForDevice(d.deviceId)?.petId, 'TRACKING');
    }

    for (const p of OrchestrationStore.getInstance().listProposals().filter((p) => p.householdId === options.householdId && p.actorUserId === options.actorUserId)) {
      add('ACTION', 'action:' + p.actionProposalId, p.preview?.title || p.actionType, p.status + ' · ' + p.origin, [p.actionType, p.status, p.origin, p.preview?.summary || ''], 'sprint29', String(p.actionProposalId), p.petId, 'ORCHESTRATION');
    }

    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
  }
}
