/**
 * Pet OS Sprint 27 - Marketplace Seller & Commerce Domain Events
 * Volume XXIX: Events & Asynchronous Architecture
 */

import {
  EventId,
  UserId,
  HouseholdId,
  SellerId,
  ProductId,
  SkuId,
  SellerListingId,
  InventoryItemId,
  InventoryReservationId,
  CartId,
  CheckoutId,
  OrderId,
  SellerOrderId,
  ShipmentId,
  ReturnRequestId,
  ProductSafetyReportId,
  ProductRecallNoticeId,
  generateUUIDv7,
} from '../kernel/ids';

export type CommerceEventType =
  | 'SELLER_CREATED'
  | 'SELLER_ACTIVATED'
  | 'SELLER_RESTRICTED'
  | 'SELLER_SUSPENDED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_SUBMITTED_FOR_REVIEW'
  | 'PRODUCT_APPROVED'
  | 'PRODUCT_RESTRICTED'
  | 'SELLER_LISTING_ACTIVATED'
  | 'SELLER_LISTING_SUSPENDED'
  | 'LISTING_PRICE_CHANGED'
  | 'INVENTORY_RECEIVED'
  | 'INVENTORY_ADJUSTED'
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_RESERVATION_RELEASED'
  | 'INVENTORY_COMMITTED'
  | 'CART_CREATED'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_EXPIRED'
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'SELLER_ORDER_CREATED'
  | 'SELLER_ORDER_ACCEPTED'
  | 'SELLER_ORDER_PREPARING'
  | 'SELLER_ORDER_SHIPPED'
  | 'SELLER_ORDER_DELIVERED'
  | 'SELLER_ORDER_CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_RECEIVED'
  | 'RETURN_INSPECTION_COMPLETED'
  | 'COMMERCE_REFUND_REQUESTED'
  | 'PRODUCT_SAFETY_CONCERN_REPORTED'
  | 'PRODUCT_RECALL_STARTED';

export interface CommerceDomainEvent {
  eventId: EventId;
  eventType: CommerceEventType;
  occurredAt: string;
  actorUserId?: UserId;
  sellerId?: SellerId;
  orderId?: OrderId;
  sellerOrderId?: SellerOrderId;
  productId?: ProductId;
  skuId?: SkuId;
  payload: Record<string, any>;
}

export function createCommerceEvent(
  eventType: CommerceEventType,
  params: {
    actorUserId?: UserId;
    sellerId?: SellerId;
    orderId?: OrderId;
    sellerOrderId?: SellerOrderId;
    productId?: ProductId;
    skuId?: SkuId;
    payload?: Record<string, any>;
  }
): CommerceDomainEvent {
  return {
    eventId: generateUUIDv7() as EventId,
    eventType,
    occurredAt: new Date().toISOString(),
    actorUserId: params.actorUserId,
    sellerId: params.sellerId,
    orderId: params.orderId,
    sellerOrderId: params.sellerOrderId,
    productId: params.productId,
    skuId: params.skuId,
    payload: params.payload || {},
  };
}
