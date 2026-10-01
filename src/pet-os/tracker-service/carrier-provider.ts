/**
 * Pet OS Sprint 25 - Carrier & Telecom Vendor Integration Abstraction
 * Supports Safaricom IoT, Airtel IoT, 1P Global eSIM, and Third-Party Trackers (Tractive, Fi).
 * 
 * Invariants:
 * - NO raw SIM secrets (K, OPc, PIN/PUK) in ordinary tables.
 * - Masked ICCID, IMSI, and MSISDN only.
 * - Carrier outages are distinguished from billing failures.
 */

import {
  DeviceId,
  TrackerCarrierServiceRecordId,
  asTrackerCarrierServiceRecordId,
  generateUUIDv7,
} from '../kernel/ids';
import {
  CarrierVendor,
  CarrierProvisioningStatus,
  CarrierNetworkAttachStatus,
  TrackerCarrierServiceRecord,
} from './types';
import { TrackerSubscriptionStore } from './store';

export interface ICarrierAdapter {
  readonly vendor: CarrierVendor;
  provisionSim(deviceId: DeviceId, planQuotaMb: number): Promise<TrackerCarrierServiceRecord>;
  suspendSim(recordId: TrackerCarrierServiceRecordId, reason: string): Promise<boolean>;
  restoreSim(recordId: TrackerCarrierServiceRecordId): Promise<boolean>;
  simulateAttachState(recordId: TrackerCarrierServiceRecordId, status: CarrierNetworkAttachStatus): Promise<void>;
  reportUsage(recordId: TrackerCarrierServiceRecordId, mbIncrement: number): Promise<{ totalMb: number; quotaExceeded: boolean }>;
}

export class BaseCarrierAdapter implements ICarrierAdapter {
  constructor(public readonly vendor: CarrierVendor) {}

  public async provisionSim(deviceId: DeviceId, planQuotaMb: number): Promise<TrackerCarrierServiceRecord> {
    const store = TrackerSubscriptionStore.getInstance();
    const now = new Date().toISOString();

    // Pseudo-random deterministic masked ICCID/MSISDN
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const prefix = this.vendor === 'SAFARICOM_IOT' ? '89254' : this.vendor === 'AIRTEL_IOT' ? '89255' : '89882';
    const iccidMasked = `${prefix}02000***${suffix}`;
    const msisdnMasked = `+254-7**-***-${suffix}`;

    const record: TrackerCarrierServiceRecord = {
      id: asTrackerCarrierServiceRecordId(`csr-${generateUUIDv7().slice(0, 18)}`),
      deviceId,
      carrierVendor: this.vendor,
      carrierSubscriptionRef: `sub-${this.vendor.toLowerCase()}-${generateUUIDv7().slice(0, 10)}`,
      iccidMasked,
      msisdnMasked,
      provisioningStatus: 'PROVISIONED',
      networkAttachStatus: 'ATTACHED',
      isRoamingAllowed: this.vendor === 'GLOBAL_ESIM_1P' || this.vendor.startsWith('THIRD_PARTY'),
      dataUsageMbCurrentCycle: 1.2, // Initial handshake packets
      dataLimitMbCurrentCycle: planQuotaMb,
      lastCarrierPingAt: now,
      carrierOutageReported: false,
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    store.saveCarrierRecord(record);
    store.logAudit('CARRIER_SIM_PROVISIONED', {
      deviceId,
      vendor: this.vendor,
      iccidMasked,
      recordId: record.id,
    });

    return record;
  }

  public async suspendSim(recordId: TrackerCarrierServiceRecordId, reason: string): Promise<boolean> {
    const store = TrackerSubscriptionStore.getInstance();
    const record = store.getCarrierRecord(recordId);
    if (!record) return false;

    record.provisioningStatus = 'SUSPENDED_CARRIER';
    record.networkAttachStatus = 'DENIED';
    record.suspendedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    store.saveCarrierRecord(record);
    store.logAudit('CARRIER_SIM_SUSPENDED', { recordId, reason, vendor: this.vendor });
    return true;
  }

  public async restoreSim(recordId: TrackerCarrierServiceRecordId): Promise<boolean> {
    const store = TrackerSubscriptionStore.getInstance();
    const record = store.getCarrierRecord(recordId);
    if (!record) return false;

    record.provisioningStatus = 'ACTIVE_SESSION';
    record.networkAttachStatus = 'ATTACHED';
    record.suspendedAt = undefined;
    record.updatedAt = new Date().toISOString();
    record.lastCarrierPingAt = new Date().toISOString();

    store.saveCarrierRecord(record);
    store.logAudit('CARRIER_SIM_RESTORED', { recordId, vendor: this.vendor });
    return true;
  }

  public async simulateAttachState(recordId: TrackerCarrierServiceRecordId, status: CarrierNetworkAttachStatus): Promise<void> {
    const store = TrackerSubscriptionStore.getInstance();
    const record = store.getCarrierRecord(recordId);
    if (!record) return;

    record.networkAttachStatus = status;
    record.lastCarrierPingAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    if (status === 'CARRIER_OUTAGE') {
      record.carrierOutageReported = true;
      record.carrierOutageNotes = 'Upstream cell tower degraded connectivity';
    } else if (status === 'ATTACHED') {
      record.carrierOutageReported = false;
      record.carrierOutageNotes = undefined;
    }

    store.saveCarrierRecord(record);
  }

  public async reportUsage(recordId: TrackerCarrierServiceRecordId, mbIncrement: number): Promise<{ totalMb: number; quotaExceeded: boolean }> {
    const store = TrackerSubscriptionStore.getInstance();
    const record = store.getCarrierRecord(recordId);
    if (!record) return { totalMb: 0, quotaExceeded: false };

    record.dataUsageMbCurrentCycle = Number((record.dataUsageMbCurrentCycle + mbIncrement).toFixed(2));
    record.lastCarrierPingAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    const quotaExceeded = record.dataUsageMbCurrentCycle > record.dataLimitMbCurrentCycle;
    store.saveCarrierRecord(record);

    return { totalMb: record.dataUsageMbCurrentCycle, quotaExceeded };
  }
}

export class CarrierProviderRegistry {
  private static adapters: Map<CarrierVendor, ICarrierAdapter> = new Map([
    ['SAFARICOM_IOT', new BaseCarrierAdapter('SAFARICOM_IOT')],
    ['AIRTEL_IOT', new BaseCarrierAdapter('AIRTEL_IOT')],
    ['GLOBAL_ESIM_1P', new BaseCarrierAdapter('GLOBAL_ESIM_1P')],
    ['THIRD_PARTY_TRACTIVE', new BaseCarrierAdapter('THIRD_PARTY_TRACTIVE')],
    ['THIRD_PARTY_FI', new BaseCarrierAdapter('THIRD_PARTY_FI')],
    ['THIRD_PARTY_WHISTLE', new BaseCarrierAdapter('THIRD_PARTY_WHISTLE')],
  ]);

  public static getAdapter(vendor: CarrierVendor): ICarrierAdapter {
    const adapter = this.adapters.get(vendor);
    if (!adapter) {
      throw new Error(`Unsupported carrier vendor: ${vendor}`);
    }
    return adapter;
  }
}
