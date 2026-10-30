
import { UserId, HouseholdId, PetId } from '../kernel/ids';

export type CommandCenterModuleTab =
  | 'identity' | 'sprint3' | 'sprint4' | 'sprint5' | 'sprint6' | 'sprint7'
  | 'sprint8' | 'sprint9' | 'sprint10' | 'sprint11' | 'sprint12' | 'sprint13'
  | 'sprint14' | 'sprint15' | 'sprint16' | 'sprint17' | 'sprint18' | 'sprint19'
  | 'sprint20' | 'sprint21' | 'sprint22' | 'sprint23' | 'sprint24' | 'sprint25'
  | 'sprint26' | 'sprint27' | 'sprint28' | 'sprint29' | 'sprint30' | 'sprint31' | 'sprint32' | 'sprint33';

export type TodayItemKind = 'CARE' | 'BOOKING' | 'NOTIFICATION' | 'AUTOMATION' | 'ORDER';
export type AttentionSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TodayItem {
  id: string;
  kind: TodayItemKind;
  title: string;
  subtitle: string;
  occurredAt: string;
  localTimeLabel: string;
  status: string;
  severity: AttentionSeverity;
  tab: CommandCenterModuleTab;
  petId?: PetId;
  resourceId?: string;
  sourceDomain: string;
}

export type SearchCategory = 'MODULE' | 'PET' | 'CARE' | 'BOOKING' | 'NOTIFICATION' | 'ORDER' | 'DEVICE' | 'ACTION';

export interface GlobalSearchResult {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  keywords: string[];
  tab: CommandCenterModuleTab;
  resourceId?: string;
  petId?: PetId;
  score: number;
  sourceDomain: string;
}

export type InboxItemKind = 'ACTION_CONFIRMATION' | 'APPROVAL' | 'ACTION_RECOVERY' | 'OVERDUE_CARE' | 'IMPORTANT_NOTIFICATION';

export interface ActionInboxItem {
  id: string;
  kind: InboxItemKind;
  title: string;
  subtitle: string;
  severity: AttentionSeverity;
  createdAt: string;
  tab: CommandCenterModuleTab;
  resourceId?: string;
  petId?: PetId;
  requiresHumanDecision: boolean;
  sourceDomain: string;
}

export interface PetCommandSummary {
  petId: PetId;
  name: string;
  species: string;
  lifecycleStage: string;
  status: string;
  dueToday: number;
  overdue: number;
  upcomingBookings: number;
  trackerStatus: 'ONLINE' | 'RECENTLY_SEEN' | 'OFFLINE' | 'UNKNOWN' | 'NOT_ASSIGNED';
  batteryPercent?: number;
}

export interface HouseholdPulse {
  pets: number;
  dueToday: number;
  overdueCare: number;
  upcomingBookings: number;
  unreadNotifications: number;
  onlineTrackers: number;
  actionInbox: number;
  ordersInProgress: number;
}

export interface CommandCenterSnapshot {
  actorUserId: UserId;
  householdId: HouseholdId;
  timezone: string;
  localDate: string;
  generatedAt: string;
  pulse: HouseholdPulse;
  pets: PetCommandSummary[];
  today: TodayItem[];
  inbox: ActionInboxItem[];
  recentActivity: TodayItem[];
}

export interface CommandCenterContext {
  actorUserId: UserId;
  householdId: HouseholdId;
  timezone?: string;
  now?: string;
}

export interface SearchOptions extends CommandCenterContext {
  query: string;
  categories?: SearchCategory[];
  limit?: number;
}
