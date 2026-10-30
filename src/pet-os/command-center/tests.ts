
import { seedUnifiedPetOS, CANONICAL_IDS } from '../seed/unified-seed';
import { CommandCenterService } from './service';
import { PetStore } from '../pet-core/store';
import { NotificationStore } from '../notifications/store';
import { OrchestrationService } from '../orchestration/service';
import { OrchestrationStore } from '../orchestration/store';
import { CareStore } from '../care/store';
import { TrackingStore } from '../tracking/store';
import { CommerceStore } from '../commerce/store';
import { asNotificationId, asPetId } from '../kernel/ids';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

async function setup() {
  await seedUnifiedPetOS({ forceReset: true });
}

function ctx() {
  return {
    actorUserId: CANONICAL_IDS.OWNER_ELENA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    timezone: 'Africa/Nairobi',
    now: new Date().toISOString(),
  };
}

export class CommandCenterTestSuite {
  static async runAllTests(): Promise<{ passed: number; failed: number; total: number; results: TestResult[] }> {
    const tests: Array<{ id: string; name: string; fn: () => Promise<void> | void }> = [
      {
        id: 'CC-01',
        name: 'Active household member receives a canonical snapshot',
        fn: async () => {
          await setup();
          const snapshot = CommandCenterService.getSnapshot(ctx());
          if (snapshot.householdId !== CANONICAL_IDS.MAIN_HOUSEHOLD) throw new Error('wrong household');
          if (snapshot.pulse.pets < 1 || snapshot.pets.length < 1) throw new Error('household Pets missing');
        },
      },
      {
        id: 'CC-02',
        name: 'Non-member is denied Command Center access',
        fn: async () => {
          await setup();
          let denied = false;
          try {
            CommandCenterService.getSnapshot({
              actorUserId: CANONICAL_IDS.OUTSIDER_BRIAN,
              householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
              timezone: 'Africa/Nairobi',
            });
          } catch (error: any) {
            denied = String(error.message).includes('COMMAND_CENTER_ACCESS_DENIED');
          }
          if (!denied) throw new Error('outsider received household read model');
        },
      },
      {
        id: 'CC-03',
        name: 'Global search refuses one-character broad scans',
        fn: async () => {
          await setup();
          const results = CommandCenterService.search({ ...ctx(), query: 'k' });
          if (results.length !== 0) throw new Error('one-character search returned results');
        },
      },
      {
        id: 'CC-04',
        name: 'Pet search resolves authorized household Pets with deep links',
        fn: async () => {
          await setup();
          const results = CommandCenterService.search({ ...ctx(), query: 'Kibo', categories: ['PET'] });
          const kibo = results.find((r) => r.petId === CANONICAL_IDS.PET_KIBO);
          if (!kibo || kibo.tab !== 'sprint3' || kibo.sourceDomain !== 'PET_CORE') throw new Error('Kibo search result missing or misrouted');
        },
      },
      {
        id: 'CC-05',
        name: 'Search never leaks another household Pet',
        fn: async () => {
          await setup();
          const foreignId = asPetId('pet-command-center-foreign');
          PetStore.savePet({
            petId: foreignId,
            householdId: CANONICAL_IDS.OUTSIDER_HOUSEHOLD,
            name: 'SecretForeignPet',
            speciesCode: 'DOG',
            breedCode: 'UNKNOWN',
            mixedBreed: false,
            unknownBreed: true,
            sex: 'UNKNOWN',
            reproductiveStatus: 'UNKNOWN',
            birthdatePrecision: 'UNKNOWN',
            estimatedBirthdate: true,
            primaryColor: 'Unknown',
            sizeClassification: 'UNKNOWN',
            lifecycleStage: 'UNKNOWN',
            status: 'ACTIVE',
            createdBy: CANONICAL_IDS.OUTSIDER_BRIAN,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            metadata: {},
          });
          const results = CommandCenterService.search({ ...ctx(), query: 'SecretForeignPet' });
          if (results.some((r) => r.petId === foreignId)) throw new Error('cross-household Pet leaked');
        },
      },
      {
        id: 'CC-06',
        name: 'Notification body text is not indexed by global search',
        fn: async () => {
          await setup();
          const now = new Date().toISOString();
          NotificationStore.saveNotification({
            notificationId: asNotificationId('notif-command-center-private'),
            recipientUserId: CANONICAL_IDS.OWNER_ELENA,
            petId: CANONICAL_IDS.PET_KIBO,
            notificationType: 'CARE_DUE',
            sourceType: 'TEST',
            sourceId: 'private-test',
            title: 'Private care notice',
            body: 'ultra-private-body-token-9347',
            channel: 'IN_APP',
            priority: 'NORMAL',
            scheduledAt: now,
            status: 'SCHEDULED',
            attemptCount: 0,
            maxAttempts: 3,
            deduplicationKey: 'cc-private-body-test',
            isRead: false,
            isDismissed: false,
            createdAt: now,
            updatedAt: now,
          });
          const results = CommandCenterService.search({ ...ctx(), query: '9347' });
          if (results.some((r) => r.category === 'NOTIFICATION')) throw new Error('notification body was indexed');
        },
      },
      {
        id: 'CC-07',
        name: 'Module search maps user intent to the owning workspace',
        fn: async () => {
          await setup();
          const results = CommandCenterService.search({ ...ctx(), query: 'lost pet' });
          if (!results.some((r) => r.category === 'MODULE' && r.tab === 'sprint15')) throw new Error('Lost Pet module not found');
        },
      },
      {
        id: 'CC-08',
        name: 'Awaiting confirmation appears in the action inbox',
        fn: async () => {
          await setup();
          const proposal = OrchestrationService.propose({
            actionType: 'CARE_CREATE_OWNER_TASK',
            actorUserId: CANONICAL_IDS.OWNER_ELENA,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            petId: CANONICAL_IDS.PET_KIBO,
            origin: 'USER_UI',
            payload: {
              petId: CANONICAL_IDS.PET_KIBO,
              title: 'Command Center confirmation test',
              dueAt: new Date(Date.now() + 3600000).toISOString(),
            },
            idempotencyKey: 'cc-confirmation-test',
          });
          const snapshot = CommandCenterService.getSnapshot(ctx());
          if (!snapshot.inbox.some((i) => i.resourceId === String(proposal.actionProposalId) && i.kind === 'ACTION_CONFIRMATION')) {
            throw new Error('confirmation proposal not surfaced');
          }
        },
      },
      {
        id: 'CC-09',
        name: 'Approval inbox is scoped only to requested approvers',
        fn: async () => {
          await setup();
          const store = OrchestrationStore.getInstance();
          const original = store.getActionDefinitionByType('OPEN_DOMAIN_WORKSPACE')!;
          store.saveActionDefinition({ ...original, confirmationLevel: 'MULTI_PARTY' });
          const proposal = OrchestrationService.propose({
            actionType: 'OPEN_DOMAIN_WORKSPACE',
            actorUserId: CANONICAL_IDS.OWNER_ELENA,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            origin: 'USER_UI',
            payload: { module: 'care' },
            idempotencyKey: 'cc-approval-test',
          });
          const approval = OrchestrationService.requestApproval(proposal.actionProposalId, [CANONICAL_IDS.CAREGIVER_SEAN], 'Second-person review');
          const owner = CommandCenterService.getSnapshot(ctx());
          const caregiver = CommandCenterService.getSnapshot({
            actorUserId: CANONICAL_IDS.CAREGIVER_SEAN,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            timezone: 'Africa/Nairobi',
          });
          if (owner.inbox.some((i) => i.resourceId === String(approval.approvalRequestId))) throw new Error('owner saw approval assigned to another user');
          if (!caregiver.inbox.some((i) => i.resourceId === String(approval.approvalRequestId))) throw new Error('requested approver did not see approval');
        },
      },
      {
        id: 'CC-10',
        name: 'Household pulse derives from canonical source stores',
        fn: async () => {
          await setup();
          const snapshot = CommandCenterService.getSnapshot(ctx());
          const petCount = PetStore.listPetsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).filter((p) => p.status !== 'ARCHIVED').length;
          const unread = NotificationStore.getNotificationsForUser(CANONICAL_IDS.OWNER_ELENA).filter((n) => !n.isRead && !n.isDismissed).length;
          const online = TrackingStore.getInstance().listDevicesForHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).filter((d) => d.connectivityStatus === 'ONLINE').length;
          if (snapshot.pulse.pets !== petCount || snapshot.pulse.unreadNotifications !== unread || snapshot.pulse.onlineTrackers !== online) {
            throw new Error('pulse diverged from canonical stores');
          }
        },
      },
      {
        id: 'CC-11',
        name: 'Pet summaries expose tracker health without exact coordinates',
        fn: async () => {
          await setup();
          const summary: any = CommandCenterService.getSnapshot(ctx()).pets.find((p) => p.petId === CANONICAL_IDS.PET_KIBO);
          if (!summary) throw new Error('Kibo summary missing');
          if ('latitude' in summary || 'longitude' in summary || 'route' in summary) throw new Error('precise location leaked into command summary');
        },
      },
      {
        id: 'CC-12',
        name: 'Category filters constrain global search',
        fn: async () => {
          await setup();
          const results = CommandCenterService.search({ ...ctx(), query: 'care', categories: ['MODULE'] });
          if (results.length === 0 || results.some((r) => r.category !== 'MODULE')) throw new Error('category filter failed');
        },
      },
      {
        id: 'CC-13',
        name: 'Search result limit is enforced',
        fn: async () => {
          await setup();
          const results = CommandCenterService.search({ ...ctx(), query: 'pet', limit: 3 });
          if (results.length > 3) throw new Error('result limit ignored');
        },
      },
      {
        id: 'CC-14',
        name: 'Action search is scoped to the current actor',
        fn: async () => {
          await setup();
          OrchestrationService.propose({
            actionType: 'CARE_CREATE_OWNER_TASK',
            actorUserId: CANONICAL_IDS.CAREGIVER_SEAN,
            householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
            petId: CANONICAL_IDS.PET_KIBO,
            origin: 'USER_UI',
            payload: {
              petId: CANONICAL_IDS.PET_KIBO,
              title: 'CaregiverOnlyActionMarker',
              dueAt: new Date(Date.now() + 7200000).toISOString(),
            },
            idempotencyKey: 'cc-caregiver-action',
          });
          const ownerResults = CommandCenterService.search({ ...ctx(), query: 'CaregiverOnlyActionMarker', categories: ['ACTION'] });
          if (ownerResults.length !== 0) throw new Error('another actor action proposal leaked');
        },
      },
      {
        id: 'CC-15',
        name: 'Archived Pets are excluded from Command Center surfaces',
        fn: async () => {
          await setup();
          const pet = PetStore.findPetById(CANONICAL_IDS.PET_KIBO)!;
          PetStore.savePet({ ...pet, status: 'ARCHIVED', updatedAt: new Date().toISOString(), version: pet.version + 1 });
          const snapshot = CommandCenterService.getSnapshot(ctx());
          const search = CommandCenterService.search({ ...ctx(), query: 'Kibo', categories: ['PET'] });
          if (snapshot.pets.some((p) => p.petId === CANONICAL_IDS.PET_KIBO) || search.some((r) => r.petId === CANONICAL_IDS.PET_KIBO)) {
            throw new Error('archived Pet remained discoverable');
          }
        },
      },
      {
        id: 'CC-16',
        name: 'Today view returns only household-scoped canonical resources',
        fn: async () => {
          await setup();
          const snapshot = CommandCenterService.getSnapshot(ctx());
          const householdPetIds = new Set(PetStore.listPetsByHousehold(CANONICAL_IDS.MAIN_HOUSEHOLD).map((p) => String(p.petId)));
          if (snapshot.today.some((i) => i.petId && !householdPetIds.has(String(i.petId)))) throw new Error('Today leaked foreign Pet resource');
        },
      },
      {
        id: 'CC-17',
        name: 'Order pulse is derived from buyer-scoped Commerce records',
        fn: async () => {
          await setup();
          const snapshot = CommandCenterService.getSnapshot(ctx());
          const expected = CommerceStore.getInstance().listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA)
            .filter((o) => (!o.householdId || o.householdId === CANONICAL_IDS.MAIN_HOUSEHOLD) && !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(o.status)).length;
          if (snapshot.pulse.ordersInProgress !== expected) throw new Error('commerce pulse mismatch');
        },
      },
      {
        id: 'CC-18',
        name: 'Search index does not expose exact tracker location fields',
        fn: async () => {
          await setup();
          const results: any[] = CommandCenterService.search({ ...ctx(), query: 'tracker' });
          if (results.some((r) => 'latitude' in r || 'longitude' in r || 'exactLocation' in r)) throw new Error('exact location leaked into search result');
        },
      },
    ];

    const results: TestResult[] = [];
    for (const test of tests) {
      const start = Date.now();
      try {
        await test.fn();
        results.push({ id: test.id, name: test.name, passed: true, message: 'PASS', durationMs: Date.now() - start });
      } catch (error: any) {
        results.push({ id: test.id, name: test.name, passed: false, message: error?.message || String(error), durationMs: Date.now() - start });
      }
    }

    return {
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      total: results.length,
      results,
    };
  }
}
