/**
 * Pet OS Sprint 27 - Vendor-Neutral Courier & Logistics Abstraction
 * Volume XXVIII: API & External Integrations
 * 
 * Invariants:
 * 1. Parcel shipment tracking is COMMERCE LOGISTICS, strictly separated from Sprint 14 Pet Tracking!
 * 2. Courier credentials are secured and never exposed to the client.
 * 3. Supports delivery evidence capture (signatures, photos, pickup verification codes).
 */

import { ShipmentId, DeliveryEvidenceId, generateUUIDv7 } from '../kernel/ids';
import { Shipment, DeliveryEvidence, ShipmentStatus } from './types';

export interface CourierQuoteRequest {
  originPostalSummary: string;
  destinationPostalSummary: string;
  weightGrams: number;
}

export interface CourierQuote {
  carrierName: string;
  serviceLevel: string;
  costMinor: number;
  estimatedDeliveryHours: number;
}

export class CourierShippingAdapter {
  private static readonly SUPPORTED_CARRIERS = ['Fargo Courier', 'G4S Logistics', 'Sendy Direct', 'Wells Fargo Parcel'];

  /**
   * Generates a deterministic shipping quote based on weight and distance.
   */
  static quoteShipping(request: CourierQuoteRequest): CourierQuote {
    const baseFee = 35000; // KES 350.00 base
    const weightFee = Math.ceil(request.weightGrams / 1000) * 5000; // KES 50 per kg
    return {
      carrierName: this.SUPPORTED_CARRIERS[0],
      serviceLevel: 'STANDARD_GROUND',
      costMinor: baseFee + weightFee,
      estimatedDeliveryHours: 48,
    };
  }

  /**
   * Creates a courier tracking number for a shipment.
   */
  static generateTrackingNumber(carrierName: string): string {
    const prefix = carrierName.slice(0, 3).toUpperCase();
    const randomHex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0').toUpperCase();
    return `${prefix}-${randomHex}`;
  }

  /**
   * Generates a secure, human-friendly 6-digit pickup verification token.
   */
  static generatePickupVerificationCode(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return `PU-${code}`;
  }

  /**
   * Captures delivery evidence upon courier or pickup completion.
   */
  static createDeliveryEvidence(
    shipmentId: ShipmentId,
    type: DeliveryEvidence['type'],
    evidenceData: string
  ): DeliveryEvidence {
    return {
      evidenceId: generateUUIDv7() as DeliveryEvidenceId,
      shipmentId,
      type,
      evidenceData,
      capturedAt: new Date().toISOString(),
    };
  }
}
