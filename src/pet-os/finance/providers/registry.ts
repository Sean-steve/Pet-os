/**
 * Pet OS Financial Platform - Payment Provider Registry
 */

import { PaymentProviderGateway } from './gateway';
import { PaymentProviderName } from '../types';
import { MpesaPaymentProvider } from './mpesa-provider';
import { CardPaymentProvider } from './card-provider';
import { MockPaymentProvider } from './mock-provider';

export class PaymentProviderRegistry {
  private providers = new Map<PaymentProviderName, PaymentProviderGateway>();

  constructor() {
    this.register(new MpesaPaymentProvider());
    this.register(new CardPaymentProvider());
    this.register(new MockPaymentProvider());
  }

  register(provider: PaymentProviderGateway): void {
    this.providers.set(provider.providerName, provider);
  }

  get(name: PaymentProviderName): PaymentProviderGateway {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider not found: ${name}`);
    }
    return provider;
  }

  getMpesa(): MpesaPaymentProvider {
    return this.get('MPESA_SAFARICOM') as MpesaPaymentProvider;
  }

  getCard(): CardPaymentProvider {
    return this.get('CARD_GATEWAY') as CardPaymentProvider;
  }

  getMock(): MockPaymentProvider {
    return this.get('MOCK_PROVIDER') as MockPaymentProvider;
  }
}
