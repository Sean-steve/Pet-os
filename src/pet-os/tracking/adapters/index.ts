/**
 * Pet OS Sprint 14 - Vendor Adapters Registry
 */

import { TrackerVendorAdapter } from './types';
import { TractiveVendorAdapter } from './tractive-adapter';
import { FiVendorAdapter } from './fi-adapter';
import { WhistleVendorAdapter } from './whistle-adapter';
import { MobilePhoneLocationAdapter } from './mobile-adapter';
import { PetOSHardwareAdapter } from './petos-hardware-adapter';

export * from './types';
export * from './tractive-adapter';
export * from './fi-adapter';
export * from './whistle-adapter';
export * from './mobile-adapter';
export * from './petos-hardware-adapter';

export class VendorAdapterRegistry {
  private static instance: VendorAdapterRegistry;
  private adapters = new Map<string, TrackerVendorAdapter>();

  private constructor() {
    this.register(new TractiveVendorAdapter());
    this.register(new FiVendorAdapter());
    this.register(new WhistleVendorAdapter());
    this.register(new MobilePhoneLocationAdapter());
    this.register(new PetOSHardwareAdapter());
  }

  static getInstance(): VendorAdapterRegistry {
    if (!VendorAdapterRegistry.instance) {
      VendorAdapterRegistry.instance = new VendorAdapterRegistry();
    }
    return VendorAdapterRegistry.instance;
  }

  register(adapter: TrackerVendorAdapter): void {
    this.adapters.set(adapter.provider.toUpperCase(), adapter);
  }

  getAdapter(provider: string): TrackerVendorAdapter | undefined {
    return this.adapters.get(provider.toUpperCase());
  }

  getAllAdapters(): TrackerVendorAdapter[] {
    return Array.from(this.adapters.values());
  }
}
