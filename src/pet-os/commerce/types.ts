/**
 * Pet OS Sprint 27 - Marketplace Seller & Commerce Operations Platform
 * Volume XV: First-Party Commerce
 * Volume XVI: Third-Party Marketplace
 * Volume XVII: Payments, Ledger, Revenue & Financial Architecture
 * Volume XXIII: Rescue, Adoption & Welfare (Live Animal Protection)
 * Volume XXXI: Security, Privacy, Trust & Abuse
 * 
 * Strict Invariants:
 * 1. SELLER vs SERVICE PROVIDER: Explicitly separated; identities link to business but are never conflated.
 * 2. LIVE ANIMALS PROHIBITED: Dogs, cats, puppies, kittens can NEVER be commercial SKUs.
 * 3. PRESCRIPTION PHARMACY BOUNDARY: Ordinary open marketplace sale of restricted prescription meds is blocked.
 * 4. EXACT MONEY: Integer minor units + ISO currency, never floating-point.
 * 5. SERVER-AUTHORITATIVE CHECKOUT: Client totals/prices are never trusted.
 * 6. ATOMIC INVENTORY & OVERSELL PREVENTION: Reservations prevent negative stock; expired reservations auto-release.
 * 7. MULTI-SELLER SPLIT: 1 Buyer Order splits into isolated SellerOrders; Seller sees ONLY their order portion.
 * 8. IMMUTABLE SNAPSHOTS: Product snapshots and commission rules captured at purchase cannot be altered by future updates.
 * 9. PET HEALTH & PRIVACY: Sellers NEVER receive Pet medical, nutrition, or GPS tracking data.
 * 10. FINANCE SOURCE OF TRUTH: Sprint 12 remains authoritative for payments, ledger, refunds, earnings, and payouts.
 */

import {
  UserId,
  HouseholdId,
  PetId,
  BusinessId,
  PaymentIntentId,
  PaymentTransactionId,
  RefundId,
  CommissionSnapshotId,
  SellerId,
  SellerMembershipId,
  SellerVerificationCaseId,
  SellerAgreementId,
  ProductCategoryId,
  ProductBrandId,
  ProductId,
  ProductVariantId,
  SkuId,
  ProductMediaId,
  ProductDocumentId,
  ProductModerationCaseId,
  SellerListingId,
  ListingPriceHistoryId,
  InventoryLocationId,
  InventoryItemId,
  InventoryMovementId,
  InventoryReservationId,
  CartId,
  CartItemId,
  CheckoutId,
  CheckoutSnapshotId,
  OrderId,
  SellerOrderId,
  OrderItemId,
  FulfillmentId,
  ShipmentId,
  ShipmentStatusHistoryId,
  DeliveryEvidenceId,
  ReturnRequestId,
  ReturnItemId,
  ReturnEvidenceId,
  ReturnInspectionId,
  CommerceDisputeId,
  CommerceSupportCaseId,
  ProductSafetyReportId,
  ProductRecallNoticeId,
  CommerceReconciliationRunId,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';

// ============================================================================
// 1. SELLER ENUMS & TYPES
// ============================================================================

export type SellerType = 'INDIVIDUAL' | 'BUSINESS' | 'FIRST_PARTY_STORE';

export type SellerOnboardingStatus =
  | 'ACCOUNT_CREATED'
  | 'BUSINESS_DETAILS_PENDING'
  | 'VERIFICATION_PENDING'
  | 'PAYOUT_SETUP_PENDING'
  | 'AGREEMENT_PENDING'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'REJECTED';

export type SellerStatus = 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'CLOSED';

export type SellerRole =
  | 'OWNER'
  | 'ADMIN'
  | 'CATALOG_MANAGER'
  | 'ORDER_MANAGER'
  | 'FULFILLMENT'
  | 'FINANCE_VIEWER'
  | 'SUPPORT';

export interface SellerProfile {
  sellerId: SellerId;
  sellerType: SellerType;
  businessId?: BusinessId; // Links to Sprint 10 Business if entity is a business
  primaryOwnerUserId: UserId;
  tradingName: string;
  legalEntityName: string;
  registrationNumber?: string;
  taxIdentifierMasked?: string;
  supportEmail: string;
  supportPhone: string;
  status: SellerStatus;
  onboardingStatus: SellerOnboardingStatus;
  isVerified: boolean;
  verifiedAt?: string;
  verificationMethod?: string;
  payoutDestinationConfigured: boolean;
  payoutDestinationMasked?: string;
  agreementAcceptedVersion?: string;
  agreementAcceptedAt?: string;
  returnPolicyText?: string;
  standardLeadTimeHours: number;
  isFirstParty: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerMembership {
  membershipId: SellerMembershipId;
  sellerId: SellerId;
  userId: UserId;
  role: SellerRole;
  isActive: boolean;
  invitedAt: string;
  acceptedAt?: string;
}

export interface SellerVerificationCase {
  caseId: SellerVerificationCaseId;
  sellerId: SellerId;
  submittedByUserId: UserId;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ADDITIONAL_INFO_REQUIRED';
  documentReferences: string[];
  rejectionReason?: string;
  reviewerNotes?: string;
  reviewedByUserId?: UserId;
  submittedAt: string;
  reviewedAt?: string;
}

export interface SellerAgreement {
  agreementId: SellerAgreementId;
  sellerId: SellerId;
  userId: UserId;
  agreementVersion: string;
  acceptedAt: string;
  ipAddressMasked: string;
  termsTitle: string;
}

export interface SellerPayoutDestination {
  sellerId: SellerId;
  destinationType: 'BANK_ACCOUNT' | 'MPESA_PAYBILL' | 'MPESA_TILL';
  accountName: string;
  accountNumberMasked: string;
  bankCodeOrPaybill: string;
  isVerified: boolean;
  verifiedAt?: string;
}

// ============================================================================
// 2. PRODUCT CATALOGUE, VARIANTS & SKUS
// ============================================================================

export type SpeciesApplicability = 'DOG' | 'CAT' | 'MULTI_SPECIES' | 'SMALL_PET' | 'BIRD';

export type LifeStageApplicability = 'PUPPY_KITTEN' | 'ADULT' | 'SENIOR' | 'ALL_STAGES';

export type ProductModerationStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESTRICTED';

export type ProductSafetyClassification = 'STANDARD' | 'REGULATED' | 'HAZARDOUS' | 'PROHIBITED';

export interface ProductCategory {
  categoryId: ProductCategoryId;
  code: string;
  displayName: string;
  parentCategoryId?: ProductCategoryId;
  isLeaf: boolean;
  isLiveAnimalProhibited: boolean; // INVARIANT: true for all pet product categories!
  isPrescriptionRestricted: boolean;
  isReturnableByDefault: boolean;
  standardReturnWindowDays: number;
  requiresLotNumber: boolean;
  requiresExpiryDate: boolean;
  allowedSpecies: SpeciesApplicability[];
}

export interface ProductBrand {
  brandId: ProductBrandId;
  name: string;
  slug: string;
  verifiedBrandOwner?: boolean;
  websiteUrl?: string;
}

export interface ProductAttribute {
  name: string;
  value: string;
  unit?: string;
}

export interface ProductMedia {
  mediaId: ProductMediaId;
  productId: ProductId;
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  isPrimary: boolean;
  altText: string;
}

export interface ProductDocument {
  documentId: ProductDocumentId;
  productId: ProductId;
  title: string;
  documentType: 'SPEC_SHEET' | 'SAFETY_DATA' | 'MANUAL' | 'WARRANTY';
  url: string;
}

export interface ProductVariant {
  variantId: ProductVariantId;
  productId: ProductId;
  title: string;
  options: Record<string, string>; // e.g. { size: 'Large', color: 'Blue' }
  skuId: SkuId;
}

export interface ProductSku {
  skuId: SkuId;
  productId: ProductId;
  skuCode: string;
  barcode?: string;
  weightGrams?: number;
  dimensionsCm?: { length: number; width: number; height: number };
  status: 'ACTIVE' | 'DISCONTINUED';
  createdAt: string;
}

export interface Product {
  productId: ProductId;
  categoryId: ProductCategoryId;
  brandId: ProductBrandId;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  speciesApplicability: SpeciesApplicability;
  lifeStageApplicability: LifeStageApplicability;
  attributes: ProductAttribute[];
  safetyClassification: ProductSafetyClassification;
  moderationStatus: ProductModerationStatus;
  moderationReason?: string;
  isFirstParty: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProductModerationCase {
  caseId: ProductModerationCaseId;
  productId: ProductId;
  trigger: 'NEW_SUBMISSION' | 'PROHIBITED_CLAIM' | 'SAFETY_REPORT' | 'COUNTERFEIT_ALLEGATION' | 'ROUTINE_AUDIT';
  status: 'OPEN' | 'APPROVED' | 'REJECTED' | 'RESTRICTED';
  moderatorNotes?: string;
  reviewedByUserId?: UserId;
  reviewedAt?: string;
  createdAt: string;
}

// ============================================================================
// 3. SELLER LISTINGS & PRICING
// ============================================================================

export type SellerListingStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'OUT_OF_STOCK'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export interface SellerListing {
  listingId: SellerListingId;
  sellerId: SellerId;
  productId: ProductId;
  skuId: SkuId;
  sellerSkuCode?: string;
  status: SellerListingStatus;
  priceMinor: number; // Integer minor units (e.g. 250000 = KES 2,500.00)
  salePriceMinor?: number;
  salePriceStartsAt?: string;
  salePriceEndsAt?: string;
  currency: CurrencyCode;
  fulfillmentMethods: Array<'SELLER_DELIVERY' | 'PLATFORM_DELIVERY' | 'THIRD_PARTY_COURIER' | 'PICKUP'>;
  shippingProfileId: string;
  condition: 'NEW' | 'REFURBISHED';
  createdAt: string;
  updatedAt: string;
}

export interface ListingPriceHistory {
  historyId: ListingPriceHistoryId;
  listingId: SellerListingId;
  previousPriceMinor: number;
  newPriceMinor: number;
  currency: CurrencyCode;
  changedByUserId: UserId;
  reason: string;
  timestamp: string;
}

// ============================================================================
// 4. INVENTORY CONTEXT
// ============================================================================

export type InventoryLocationType = 'WAREHOUSE' | 'STORE' | 'SELLER_LOCATION' | 'FULFILLMENT_CENTER';

export interface InventoryLocation {
  locationId: InventoryLocationId;
  sellerId: SellerId;
  name: string;
  locationType: InventoryLocationType;
  addressSummary: string;
  isActive: boolean;
}

export interface InventoryItem {
  inventoryItemId: InventoryItemId;
  sellerId: SellerId;
  skuId: SkuId;
  locationId: InventoryLocationId;
  onHandQuantity: number;
  reservedQuantity: number;
  availableToSell: number; // Derived: onHand - reserved (must never be negative)
  lowStockThreshold: number;
  lotNumber?: string;
  expirationDate?: string; // ISO Date if consumable
  lastAdjustedAt: string;
}

export type InventoryMovementType =
  | 'RECEIPT'
  | 'SALE'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'RETURN'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'TRANSFER';

export interface InventoryMovement {
  movementId: InventoryMovementId;
  inventoryItemId: InventoryItemId;
  sellerId: SellerId;
  skuId: SkuId;
  movementType: InventoryMovementType;
  quantityDelta: number; // can be positive or negative
  resultingOnHand: number;
  resultingReserved: number;
  resultingAvailable: number;
  referenceId?: string; // CheckoutId, OrderId, or ReturnId
  reason: string;
  actorUserId: UserId;
  timestamp: string;
}

export type InventoryReservationStatus = 'ACTIVE' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';

export interface InventoryReservation {
  reservationId: InventoryReservationId;
  checkoutId: CheckoutId;
  sellerId: SellerId;
  skuId: SkuId;
  inventoryItemId: InventoryItemId;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: string;
  createdAt: string;
  committedAt?: string;
  releasedAt?: string;
}

// ============================================================================
// 5. SHOPPING CART & CHECKOUT
// ============================================================================

export interface CartItem {
  cartItemId: CartItemId;
  listingId: SellerListingId;
  productId: ProductId;
  skuId: SkuId;
  sellerId: SellerId;
  quantity: number;
  unitPriceMinor: number;
  currency: CurrencyCode;
  addedAt: string;
}

export interface ShoppingCart {
  cartId: CartId;
  userId: UserId;
  householdId?: HouseholdId;
  items: CartItem[];
  updatedAt: string;
}

export type DeliveryMethod = 'SELLER_DELIVERY' | 'PLATFORM_DELIVERY' | 'THIRD_PARTY_COURIER' | 'PICKUP';

export interface ShippingAddressSnapshot {
  recipientName: string;
  recipientPhone: string;
  streetLine1: string;
  streetLine2?: string;
  city: string;
  countyOrState: string;
  postalCode?: string;
  country: string;
  deliveryInstructions?: string;
  maskedAddressSummary: string; // Sanitized view for privacy
}

export interface CheckoutSellerGrouping {
  sellerId: SellerId;
  sellerTradingName: string;
  items: Array<{
    listingId: SellerListingId;
    skuId: SkuId;
    productId: ProductId;
    title: string;
    variantTitle: string;
    quantity: number;
    unitPriceMinor: number;
    subtotalMinor: number;
  }>;
  subtotalMinor: number;
  shippingFeeMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  fulfillmentMethod: DeliveryMethod;
  shippingProfileId?: string;
}

export interface CheckoutSnapshot {
  snapshotId: CheckoutSnapshotId;
  checkoutId: CheckoutId;
  buyerUserId: UserId;
  currency: CurrencyCode;
  itemsSubtotalMinor: number;
  shippingTotalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  grandTotalMinor: number;
  deliveryAddress: ShippingAddressSnapshot;
  sellerGroupings: CheckoutSellerGrouping[];
  createdAt: string;
}

export type CheckoutStatus = 'DRAFT' | 'RESERVED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface CommerceCheckout {
  checkoutId: CheckoutId;
  cartId: CartId;
  buyerUserId: UserId;
  householdId?: HouseholdId;
  status: CheckoutStatus;
  snapshot: CheckoutSnapshot;
  reservationIds: InventoryReservationId[];
  paymentIntentId?: PaymentIntentId;
  orderId?: OrderId;
  expiresAt: string;
  createdAt: string;
  completedAt?: string;
}

// ============================================================================
// 6. ORDER AGGREGATE & SELLER ORDERS
// ============================================================================

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'PARTIALLY_CANCELLED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'CLOSED';

export type SellerOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_DISPATCH'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'PARTIALLY_FULFILLED'
  | 'CANCELLED'
  | 'RETURN_IN_PROGRESS'
  | 'CLOSED';

export interface ProductSnapshot {
  productId: ProductId;
  skuId: SkuId;
  productTitle: string;
  variantTitle: string;
  skuCode: string;
  brandName: string;
  categoryName: string;
  primaryImageUrl: string;
}

export interface OrderItem {
  orderItemId: OrderItemId;
  orderId: OrderId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  listingId: SellerListingId;
  skuId: SkuId;
  productId: ProductId;
  productSnapshot: ProductSnapshot;
  quantityOrdered: number;
  quantityFulfilled: number;
  quantityCancelled: number;
  quantityReturned: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  taxMinor: number;
  currency: CurrencyCode;
}

export interface CommissionSnapshot {
  commissionSnapshotId: CommissionSnapshotId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  ruleCode: string;
  ratePercentage: number;
  fixedFeeMinor: number;
  grossAmountMinor: number;
  commissionAmountMinor: number;
  sellerNetAmountMinor: number;
  currency: CurrencyCode;
  calculatedAt: string;
}

export interface SellerOrder {
  sellerOrderId: SellerOrderId;
  orderId: OrderId;
  sellerId: SellerId;
  buyerUserId: UserId;
  status: SellerOrderStatus;
  items: OrderItem[];
  itemsSubtotalMinor: number;
  shippingFeeMinor: number;
  taxMinor: number;
  discountMinor: number;
  sellerGrossMinor: number;
  commissionSnapshot: CommissionSnapshot;
  sellerNetMinor: number;
  currency: CurrencyCode;
  fulfillmentMethod: DeliveryMethod;
  shippingAddressSnapshot: ShippingAddressSnapshot;
  sellerNotes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  orderId: OrderId;
  buyerUserId: UserId;
  householdId?: HouseholdId;
  checkoutId: CheckoutId;
  status: OrderStatus;
  currency: CurrencyCode;
  itemsSubtotalMinor: number;
  shippingTotalMinor: number;
  taxTotalMinor: number;
  discountTotalMinor: number;
  totalMinor: number;
  sellerOrderIds: SellerOrderId[];
  paymentIntentId: PaymentIntentId;
  paymentTransactionId?: PaymentTransactionId;
  isPaid: boolean;
  deliveryAddress: ShippingAddressSnapshot;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// ============================================================================
// 7. FULFILLMENT, SHIPMENTS & PICKUP
// ============================================================================

export type ShipmentStatus =
  | 'CREATED'
  | 'LABEL_CREATED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'RETURN_TO_SENDER'
  | 'CANCELLED';

export interface ShipmentItem {
  orderItemId: OrderItemId;
  skuId: SkuId;
  quantity: number;
}

export interface DeliveryEvidence {
  evidenceId: DeliveryEvidenceId;
  shipmentId: ShipmentId;
  type: 'CARRIER_CONFIRMATION' | 'RECIPIENT_SIGNATURE' | 'PHOTO_PROOF' | 'PICKUP_CODE';
  evidenceData: string;
  capturedAt: string;
}

export interface Shipment {
  shipmentId: ShipmentId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  carrierName: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  items: ShipmentItem[];
  shippedAt?: string;
  deliveredAt?: string;
  failedReason?: string;
  deliveryEvidence?: DeliveryEvidence;
  pickupVerificationCode?: string;
  isPickup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Fulfillment {
  fulfillmentId: FulfillmentId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  shipments: Shipment[];
  status: 'PENDING' | 'PACKED' | 'DISPATCHED' | 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 8. RETURNS, INSPECTIONS & REFUNDS
// ============================================================================

export type ReturnReason =
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'MISSING_PARTS'
  | 'BUYER_CHANGED_MIND'
  | 'SAFETY_CONCERN'
  | 'OTHER';

export type ReturnStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURN_IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'REFUND_APPROVED'
  | 'REFUNDED'
  | 'CLOSED';

export type ReturnDisposition = 'SELLABLE' | 'DAMAGED' | 'QUARANTINED' | 'DISCARDED' | 'RETURN_TO_VENDOR';

export interface ReturnItem {
  returnItemId: ReturnItemId;
  orderItemId: OrderItemId;
  skuId: SkuId;
  quantity: number;
  reason: ReturnReason;
  buyerNotes?: string;
  disposition?: ReturnDisposition;
}

export interface ReturnEvidence {
  evidenceId: ReturnEvidenceId;
  url: string;
  evidenceType: 'PHOTO' | 'VIDEO' | 'DOCUMENT';
  description: string;
}

export interface ReturnInspection {
  inspectionId: ReturnInspectionId;
  returnRequestId: ReturnRequestId;
  inspectedByUserId: UserId;
  conditionRating: 'EXCELLENT' | 'DAMAGED' | 'UNUSABLE' | 'WRONG_ITEM_RETURNED';
  findings: string;
  disposition: ReturnDisposition;
  recommendedRefundMinor: number;
  inspectedAt: string;
}

export interface ReturnRequest {
  returnRequestId: ReturnRequestId;
  orderId: OrderId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  buyerUserId: UserId;
  items: ReturnItem[];
  evidence: ReturnEvidence[];
  status: ReturnStatus;
  rejectionReason?: string;
  inspection?: ReturnInspection;
  refundId?: RefundId;
  refundAmountMinor?: number;
  isSafetyException: boolean; // Safety complaints bypass standard return window
  requestedAt: string;
  resolvedAt?: string;
}

export interface CommerceDispute {
  disputeId: CommerceDisputeId;
  orderId: OrderId;
  sellerOrderId: SellerOrderId;
  sellerId: SellerId;
  buyerUserId: UserId;
  category: 'ITEM_NOT_RECEIVED' | 'UNAUTHORIZED_CHARGE' | 'RETURN_DENIED' | 'DAMAGED_ITEM' | 'WRONG_ITEM';
  status: 'OPEN' | 'UNDER_REVIEW' | 'SELLER_RESPONDED' | 'RESOLVED_BUYER_FAVORED' | 'RESOLVED_SELLER_FAVORED' | 'CLOSED';
  buyerStatement: string;
  sellerStatement?: string;
  resolutionNotes?: string;
  openedAt: string;
  resolvedAt?: string;
}

// ============================================================================
// 9. PRODUCT SAFETY & RECALL FOUNDATION
// ============================================================================

export interface ProductSafetyReport {
  reportId: ProductSafetyReportId;
  productId: ProductId;
  skuId?: SkuId;
  sellerId?: SellerId;
  orderId?: OrderId;
  reportedByUserId: UserId;
  petId?: PetId;
  incidentDescription: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'INVESTIGATING' | 'CONFIRMED_HAZARD' | 'UNFOUNDED' | 'RESOLVED';
  moderationActionTaken?: string;
  createdAt: string;
}

export interface ProductRecallNotice {
  recallId: ProductRecallNoticeId;
  productId: ProductId;
  affectedSkuIds: SkuId[];
  affectedLotNumbers?: string[];
  title: string;
  hazardDescription: string;
  actionRequiredBuyer: string;
  actionRequiredSeller: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  notifiedBuyerCount: number;
  issuedAt: string;
}

export interface CommerceSupportCase {
  caseId: CommerceSupportCaseId;
  orderId?: OrderId;
  sellerId?: SellerId;
  buyerUserId?: UserId;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  subject: string;
  notes: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

// ============================================================================
// 10. PROJECTIONS, READ MODELS & RECONCILIATION
// ============================================================================

export interface SellerDashboardReadModel {
  sellerId: SellerId;
  tradingName: string;
  status: SellerStatus;
  pendingOrdersCount: number;
  preparingOrdersCount: number;
  shippedOrdersCount: number;
  openReturnsCount: number;
  activeListingsCount: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  pendingEarningsMinor: number;
  availableBalanceMinor: number;
  currency: CurrencyCode;
}

export interface BuyerStoreProductReadModel {
  productId: ProductId;
  title: string;
  categoryName: string;
  brandName: string;
  species: SpeciesApplicability;
  lowestPriceMinor: number;
  currency: CurrencyCode;
  sellerCount: number;
  inStock: boolean;
  primaryImageUrl: string;
  isFirstParty: boolean;
}

export interface CommerceReconciliationRun {
  runId: CommerceReconciliationRunId;
  timestamp: string;
  totalOrdersChecked: number;
  totalSellerOrdersChecked: number;
  totalFulfillmentsChecked: number;
  inventoryIntegrityPassed: boolean;
  commissionMathBalanced: boolean;
  refundsMatchedFinance: boolean;
  errorsDetected: string[];
}
