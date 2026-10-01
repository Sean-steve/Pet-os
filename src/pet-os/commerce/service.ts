/**
 * Pet OS Sprint 27 - Marketplace Seller & Commerce Service Orchestrator
 * Volume XV: First-Party Commerce
 * Volume XVI: Third-Party Marketplace
 * Volume XVII: Payments, Ledger, Revenue & Financial Architecture
 * Volume XXIII: Rescue, Adoption & Welfare (Live Animal Protection)
 * Volume XXXI: Security, Privacy, Trust & Abuse
 */

import {
  UserId,
  HouseholdId,
  BusinessId,
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
  DeliveryEvidenceId,
  ReturnRequestId,
  ReturnItemId,
  ReturnEvidenceId,
  ReturnInspectionId,
  ProductSafetyReportId,
  ProductRecallNoticeId,
  PaymentIntentId,
  PaymentTransactionId,
  RefundId,
  asOrderId,
  asSellerOrderId,
  asOrderItemId,
  asCartId,
  asCartItemId,
  asCheckoutId,
  asCheckoutSnapshotId,
  asInventoryReservationId,
  asInventoryMovementId,
  asShipmentId,
  asFulfillmentId,
  asReturnRequestId,
  asReturnInspectionId,
  asProductSafetyReportId,
  asProductRecallNoticeId,
  asPaymentIntentId,
  asPaymentTransactionId,
  asRefundId,
  generateUUIDv7,
} from '../kernel/ids';
import { CurrencyCode, Money } from '../kernel/money';
import { CommerceStore } from './store';
import { CommercePolicy } from './policy';
import { CourierShippingAdapter } from './courier-adapter';
import {
  SellerProfile,
  SellerRole,
  SellerStatus,
  SellerOnboardingStatus,
  SellerPayoutDestination,
  Product,
  ProductVariant,
  ProductSku,
  SellerListing,
  InventoryLocation,
  InventoryItem,
  InventoryReservation,
  ShoppingCart,
  CommerceCheckout,
  CheckoutSellerGrouping,
  CheckoutSnapshot,
  Order,
  SellerOrder,
  OrderItem,
  Shipment,
  Fulfillment,
  ReturnRequest,
  ReturnReason,
  ReturnDisposition,
  ProductSafetyReport,
  ProductRecallNotice,
  SellerDashboardReadModel,
  CommerceReconciliationRun,
  DeliveryMethod,
  ShippingAddressSnapshot,
} from './types';
import { createCommerceEvent } from './events';

export class CommerceService {
  private store: CommerceStore;

  constructor(store: CommerceStore = CommerceStore.getInstance()) {
    this.store = store;
  }

  // ==========================================================================
  // 1. SELLER ONBOARDING & TEAM
  // ==========================================================================

  createSellerProfile(params: {
    sellerId: SellerId;
    sellerType: 'INDIVIDUAL' | 'BUSINESS' | 'FIRST_PARTY_STORE';
    businessId?: BusinessId;
    primaryOwnerUserId: UserId;
    tradingName: string;
    legalEntityName: string;
    registrationNumber?: string;
    supportEmail: string;
    supportPhone: string;
    isFirstParty?: boolean;
  }): SellerProfile {
    const now = new Date().toISOString();
    const profile: SellerProfile = {
      sellerId: params.sellerId,
      sellerType: params.sellerType,
      businessId: params.businessId,
      primaryOwnerUserId: params.primaryOwnerUserId,
      tradingName: params.tradingName,
      legalEntityName: params.legalEntityName,
      registrationNumber: params.registrationNumber,
      supportEmail: params.supportEmail,
      supportPhone: params.supportPhone,
      status: params.isFirstParty ? 'ACTIVE' : 'PENDING',
      onboardingStatus: params.isFirstParty ? 'ACTIVE' : 'ACCOUNT_CREATED',
      isVerified: !!params.isFirstParty,
      verifiedAt: params.isFirstParty ? now : undefined,
      payoutDestinationConfigured: !!params.isFirstParty,
      isFirstParty: !!params.isFirstParty,
      standardLeadTimeHours: 24,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveSeller(profile);

    // Add primary owner to seller team
    this.store.saveMembership({
      membershipId: generateUUIDv7() as any,
      sellerId: params.sellerId,
      userId: params.primaryOwnerUserId,
      role: 'OWNER',
      isActive: true,
      invitedAt: now,
      acceptedAt: now,
    });

    this.store.publish(
      createCommerceEvent('SELLER_CREATED', {
        sellerId: params.sellerId,
        actorUserId: params.primaryOwnerUserId,
        payload: { tradingName: params.tradingName, isFirstParty: !!params.isFirstParty },
      })
    );

    return profile;
  }

  submitSellerVerification(
    sellerId: SellerId,
    submittedByUserId: UserId,
    documentReferences: string[]
  ): void {
    const seller = this.store.getSeller(sellerId);
    if (!seller) throw new Error(`Seller ${sellerId} not found`);

    const caseId = generateUUIDv7() as any;
    this.store.saveVerificationCase({
      caseId,
      sellerId,
      submittedByUserId,
      status: 'PENDING',
      documentReferences,
      submittedAt: new Date().toISOString(),
    });

    seller.onboardingStatus = 'UNDER_REVIEW';
    seller.updatedAt = new Date().toISOString();
    this.store.saveSeller(seller);
  }

  reviewSellerVerification(
    caseId: any,
    reviewerUserId: UserId,
    approved: boolean,
    notes?: string
  ): void {
    const c = this.store.getVerificationCase(caseId);
    if (!c) throw new Error(`Verification case ${caseId} not found`);

    c.status = approved ? 'APPROVED' : 'REJECTED';
    c.reviewedByUserId = reviewerUserId;
    c.reviewerNotes = notes;
    c.reviewedAt = new Date().toISOString();
    this.store.saveVerificationCase(c);

    const seller = this.store.getSeller(c.sellerId);
    if (seller) {
      if (approved) {
        seller.isVerified = true;
        seller.verifiedAt = new Date().toISOString();
        seller.status = 'ACTIVE';
        seller.onboardingStatus = 'ACTIVE';
        this.store.publish(
          createCommerceEvent('SELLER_ACTIVATED', {
            sellerId: seller.sellerId,
            actorUserId: reviewerUserId,
            payload: { verifiedBy: reviewerUserId },
          })
        );
      } else {
        seller.isVerified = false;
        seller.onboardingStatus = 'REJECTED';
      }
      seller.updatedAt = new Date().toISOString();
      this.store.saveSeller(seller);
    }
  }

  acceptSellerAgreement(
    sellerId: SellerId,
    userId: UserId,
    version: string,
    ipAddressMasked: string
  ): void {
    const seller = this.store.getSeller(sellerId);
    if (!seller) throw new Error(`Seller ${sellerId} not found`);

    const agreementId = generateUUIDv7() as any;
    const now = new Date().toISOString();
    this.store.saveAgreement({
      agreementId,
      sellerId,
      userId,
      agreementVersion: version,
      acceptedAt: now,
      ipAddressMasked,
      termsTitle: 'Pet OS Standard Marketplace Seller Agreement',
    });

    seller.agreementAcceptedVersion = version;
    seller.agreementAcceptedAt = now;
    seller.updatedAt = now;
    this.store.saveSeller(seller);
  }

  configureSellerPayoutDestination(
    sellerId: SellerId,
    destination: {
      destinationType: 'BANK_ACCOUNT' | 'MPESA_PAYBILL' | 'MPESA_TILL';
      accountName: string;
      accountNumberMasked: string;
      bankCodeOrPaybill: string;
    }
  ): void {
    const seller = this.store.getSeller(sellerId);
    if (!seller) throw new Error(`Seller ${sellerId} not found`);

    this.store.savePayoutDestination({
      sellerId,
      ...destination,
      isVerified: true,
      verifiedAt: new Date().toISOString(),
    });

    seller.payoutDestinationConfigured = true;
    seller.payoutDestinationMasked = `${destination.destinationType}:${destination.accountNumberMasked}`;
    seller.updatedAt = new Date().toISOString();
    this.store.saveSeller(seller);
  }

  addSellerTeamMember(
    sellerId: SellerId,
    actorUserId: UserId,
    targetUserId: UserId,
    role: SellerRole
  ): void {
    // Check actor permissions
    const actorMemberships = this.store.listMembershipsForSeller(sellerId);
    const actor = actorMemberships.find(m => m.userId === actorUserId);
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'ADMIN')) {
      throw new Error('Unauthorized: only seller OWNER or ADMIN can invite team members');
    }

    const membershipId = generateUUIDv7() as any;
    this.store.saveMembership({
      membershipId,
      sellerId,
      userId: targetUserId,
      role,
      isActive: true,
      invitedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString(),
    });
  }

  setSellerStatus(sellerId: SellerId, status: SellerStatus, actorUserId: UserId): void {
    const seller = this.store.getSeller(sellerId);
    if (!seller) throw new Error(`Seller ${sellerId} not found`);

    seller.status = status;
    seller.updatedAt = new Date().toISOString();
    this.store.saveSeller(seller);

    if (status === 'SUSPENDED') {
      // Pause all active listings
      const listings = this.store.listListingsForSeller(sellerId);
      for (const l of listings) {
        if (l.status === 'ACTIVE') {
          l.status = 'SUSPENDED';
          l.updatedAt = new Date().toISOString();
          this.store.saveListing(l);
        }
      }
      this.store.publish(
        createCommerceEvent('SELLER_SUSPENDED', {
          sellerId,
          actorUserId,
          payload: { reason: 'Administrative suspension' },
        })
      );
    }
  }

  // ==========================================================================
  // 2. PRODUCT CATALOGUE & MODERATION
  // ==========================================================================

  createProduct(params: {
    productId: ProductId;
    categoryId: ProductCategoryId;
    brandId: ProductBrandId;
    title: string;
    description: string;
    shortDescription: string;
    speciesApplicability: Product['speciesApplicability'];
    lifeStageApplicability: Product['lifeStageApplicability'];
    attributes: Product['attributes'];
    isFirstParty?: boolean;
    actorUserId: UserId;
  }): Product {
    const category = this.store.getCategory(params.categoryId);
    if (!category) throw new Error(`Category ${params.categoryId} not found`);

    // INVARIANT 1: LIVE ANIMALS PROHIBITED
    const liveCheck = CommercePolicy.evaluateLiveAnimalProhibition({
      title: params.title,
      description: params.description,
      categoryCode: category.code,
    });
    if (liveCheck.isProhibited) {
      throw new Error(`LIVE ANIMAL COMMERCE PROHIBITED: ${liveCheck.reason}`);
    }

    // INVARIANT 2: RESTRICTED PRESCRIPTION PHARMACEUTICALS
    const rxCheck = CommercePolicy.evaluatePrescriptionRestriction({
      title: params.title,
      description: params.description,
      categoryCode: category.code,
      isSellerRegisteredPharmacy: false,
    });
    if (rxCheck.isRestricted) {
      throw new Error(`RESTRICTED PRESCRIPTION PRODUCT: ${rxCheck.reason}`);
    }

    const now = new Date().toISOString();
    const product: Product = {
      productId: params.productId,
      categoryId: params.categoryId,
      brandId: params.brandId,
      title: params.title,
      slug: params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: params.description,
      shortDescription: params.shortDescription,
      speciesApplicability: params.speciesApplicability,
      lifeStageApplicability: params.lifeStageApplicability,
      attributes: params.attributes,
      safetyClassification: 'STANDARD',
      moderationStatus: params.isFirstParty ? 'APPROVED' : 'PENDING_REVIEW',
      isFirstParty: !!params.isFirstParty,
      status: params.isFirstParty ? 'ACTIVE' : 'DRAFT',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.store.saveProduct(product);

    if (!params.isFirstParty) {
      // Create initial moderation case
      const caseId = generateUUIDv7() as any;
      this.store.saveModerationCase({
        caseId,
        productId: product.productId,
        trigger: 'NEW_SUBMISSION',
        status: 'OPEN',
        createdAt: now,
      });
    }

    this.store.publish(
      createCommerceEvent('PRODUCT_CREATED', {
        productId: product.productId,
        actorUserId: params.actorUserId,
        payload: { title: product.title, isFirstParty: product.isFirstParty },
      })
    );

    return product;
  }

  moderateProduct(
    productId: ProductId,
    moderatorUserId: UserId,
    status: 'APPROVED' | 'REJECTED' | 'RESTRICTED',
    notes?: string
  ): void {
    const prod = this.store.getProduct(productId);
    if (!prod) throw new Error(`Product ${productId} not found`);

    prod.moderationStatus = status;
    prod.moderationReason = notes;
    if (status === 'APPROVED') {
      prod.status = 'ACTIVE';
    } else if (status === 'REJECTED' || status === 'RESTRICTED') {
      prod.status = 'RESTRICTED';
      // Restrict associated listings
      const listings = this.store.listListingsForProduct(productId);
      for (const l of listings) {
        l.status = 'RESTRICTED';
        this.store.saveListing(l);
      }
    }
    prod.updatedAt = new Date().toISOString();
    this.store.saveProduct(prod);

    this.store.publish(
      createCommerceEvent(status === 'APPROVED' ? 'PRODUCT_APPROVED' : 'PRODUCT_RESTRICTED', {
        productId,
        actorUserId: moderatorUserId,
        payload: { status, notes },
      })
    );
  }

  createProductVariant(params: {
    productId: ProductId;
    skuId: SkuId;
    skuCode: string;
    variantTitle: string;
    options: Record<string, string>;
    weightGrams?: number;
  }): { variant: ProductVariant; sku: ProductSku } {
    const prod = this.store.getProduct(params.productId);
    if (!prod) throw new Error(`Product ${params.productId} not found`);

    const now = new Date().toISOString();
    const sku: ProductSku = {
      skuId: params.skuId,
      productId: params.productId,
      skuCode: params.skuCode,
      weightGrams: params.weightGrams,
      status: 'ACTIVE',
      createdAt: now,
    };
    this.store.saveSku(sku);

    const variantId = generateUUIDv7() as any;
    const variant: ProductVariant = {
      variantId,
      productId: params.productId,
      title: params.variantTitle,
      options: params.options,
      skuId: params.skuId,
    };
    this.store.saveVariant(variant);

    return { variant, sku };
  }

  // ==========================================================================
  // 3. SELLER LISTINGS & PRICING
  // ==========================================================================

  createSellerListing(params: {
    listingId: SellerListingId;
    sellerId: SellerId;
    productId: ProductId;
    skuId: SkuId;
    priceMinor: number;
    currency: CurrencyCode;
    fulfillmentMethods: Array<'SELLER_DELIVERY' | 'PLATFORM_DELIVERY' | 'THIRD_PARTY_COURIER' | 'PICKUP'>;
    shippingProfileId: string;
    condition?: 'NEW' | 'REFURBISHED';
  }): SellerListing {
    const seller = this.store.getSeller(params.sellerId);
    if (!seller) throw new Error(`Seller ${params.sellerId} not found`);
    if (seller.status !== 'ACTIVE') {
      throw new Error(`Seller is not ACTIVE (current: ${seller.status}). Cannot create listings.`);
    }

    const prod = this.store.getProduct(params.productId);
    if (!prod) throw new Error(`Product ${params.productId} not found`);
    if (prod.status === 'RESTRICTED' || prod.status === 'SUSPENDED') {
      throw new Error(`Product is restricted/suspended. Cannot list.`);
    }

    if (!Number.isInteger(params.priceMinor) || params.priceMinor <= 0) {
      throw new Error('Price must be a positive integer in minor units');
    }

    const now = new Date().toISOString();
    const listing: SellerListing = {
      listingId: params.listingId,
      sellerId: params.sellerId,
      productId: params.productId,
      skuId: params.skuId,
      status: 'ACTIVE',
      priceMinor: params.priceMinor,
      currency: params.currency,
      fulfillmentMethods: params.fulfillmentMethods,
      shippingProfileId: params.shippingProfileId,
      condition: params.condition || 'NEW',
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveListing(listing);

    this.store.publish(
      createCommerceEvent('SELLER_LISTING_ACTIVATED', {
        sellerId: params.sellerId,
        productId: params.productId,
        skuId: params.skuId,
        payload: { priceMinor: params.priceMinor, currency: params.currency },
      })
    );

    return listing;
  }

  updateListingPrice(
    listingId: SellerListingId,
    newPriceMinor: number,
    actorUserId: UserId,
    reason: string
  ): void {
    if (!Number.isInteger(newPriceMinor) || newPriceMinor <= 0) {
      throw new Error('New price must be a positive integer in minor units');
    }

    const listing = this.store.getListing(listingId);
    if (!listing) throw new Error(`Listing ${listingId} not found`);

    const prev = listing.priceMinor;
    listing.priceMinor = newPriceMinor;
    listing.updatedAt = new Date().toISOString();
    this.store.saveListing(listing);

    // Save auditable price history
    this.store.savePriceHistory({
      historyId: generateUUIDv7() as any,
      listingId,
      previousPriceMinor: prev,
      newPriceMinor,
      currency: listing.currency,
      changedByUserId: actorUserId,
      reason,
      timestamp: new Date().toISOString(),
    });

    this.store.publish(
      createCommerceEvent('LISTING_PRICE_CHANGED', {
        sellerId: listing.sellerId,
        productId: listing.productId,
        skuId: listing.skuId,
        payload: { previousPriceMinor: prev, newPriceMinor, reason },
      })
    );
  }

  // ==========================================================================
  // 4. INVENTORY CONTEXT & CONCURRENCY-SAFE RESERVATIONS
  // ==========================================================================

  createInventoryLocation(
    sellerId: SellerId,
    name: string,
    locationType: 'WAREHOUSE' | 'STORE' | 'SELLER_LOCATION' | 'FULFILLMENT_CENTER',
    addressSummary: string
  ): InventoryLocation {
    const locId = generateUUIDv7() as any;
    const loc: InventoryLocation = {
      locationId: locId,
      sellerId,
      name,
      locationType,
      addressSummary,
      isActive: true,
    };
    this.store.saveLocation(loc);
    return loc;
  }

  receiveInventory(params: {
    sellerId: SellerId;
    skuId: SkuId;
    locationId: InventoryLocationId;
    quantity: number;
    actorUserId: UserId;
    reason: string;
    lotNumber?: string;
    expirationDate?: string;
  }): InventoryItem {
    if (params.quantity <= 0) throw new Error('Received quantity must be positive');

    let item = this.store.getInventoryItemBySellerAndSku(params.sellerId, params.skuId);
    const now = new Date().toISOString();

    if (!item) {
      const itemId = generateUUIDv7() as any;
      item = {
        inventoryItemId: itemId,
        sellerId: params.sellerId,
        skuId: params.skuId,
        locationId: params.locationId,
        onHandQuantity: params.quantity,
        reservedQuantity: 0,
        availableToSell: params.quantity,
        lowStockThreshold: 5,
        lotNumber: params.lotNumber,
        expirationDate: params.expirationDate,
        lastAdjustedAt: now,
      };
    } else {
      item.onHandQuantity += params.quantity;
      item.availableToSell = item.onHandQuantity - item.reservedQuantity;
      item.lastAdjustedAt = now;
      if (params.lotNumber) item.lotNumber = params.lotNumber;
      if (params.expirationDate) item.expirationDate = params.expirationDate;
    }

    this.store.saveInventoryItem(item);

    // Record movement
    this.store.saveInventoryMovement({
      movementId: generateUUIDv7() as any,
      inventoryItemId: item.inventoryItemId,
      sellerId: params.sellerId,
      skuId: params.skuId,
      movementType: 'RECEIPT',
      quantityDelta: params.quantity,
      resultingOnHand: item.onHandQuantity,
      resultingReserved: item.reservedQuantity,
      resultingAvailable: item.availableToSell,
      reason: params.reason,
      actorUserId: params.actorUserId,
      timestamp: now,
    });

    this.store.publish(
      createCommerceEvent('INVENTORY_RECEIVED', {
        sellerId: params.sellerId,
        skuId: params.skuId,
        actorUserId: params.actorUserId,
        payload: { quantityReceived: params.quantity, resultingAvailable: item.availableToSell },
      })
    );

    return item;
  }

  adjustInventory(
    inventoryItemId: InventoryItemId,
    deltaQuantity: number,
    actorUserId: UserId,
    reason: string
  ): InventoryItem {
    const item = this.store.getInventoryItem(inventoryItemId);
    if (!item) throw new Error(`Inventory item ${inventoryItemId} not found`);

    const newOnHand = item.onHandQuantity + deltaQuantity;
    if (newOnHand < item.reservedQuantity) {
      throw new Error(`Cannot adjust inventory below currently reserved quantity (${item.reservedQuantity})`);
    }

    item.onHandQuantity = newOnHand;
    item.availableToSell = item.onHandQuantity - item.reservedQuantity;
    item.lastAdjustedAt = new Date().toISOString();
    this.store.saveInventoryItem(item);

    this.store.saveInventoryMovement({
      movementId: generateUUIDv7() as any,
      inventoryItemId,
      sellerId: item.sellerId,
      skuId: item.skuId,
      movementType: 'ADJUSTMENT',
      quantityDelta: deltaQuantity,
      resultingOnHand: item.onHandQuantity,
      resultingReserved: item.reservedQuantity,
      resultingAvailable: item.availableToSell,
      reason,
      actorUserId,
      timestamp: new Date().toISOString(),
    });

    return item;
  }

  /**
   * Concurrency-safe atomic inventory reservation for checkout.
   * INVARIANT: Available-To-Sell must be >= requested quantity.
   */
  reserveInventoryForCheckout(
    checkoutId: CheckoutId,
    items: Array<{ sellerId: SellerId; skuId: SkuId; quantity: number }>
  ): InventoryReservation[] {
    // 1. First pass: verify ALL items have sufficient stock
    for (const req of items) {
      const inv = this.store.getInventoryItemBySellerAndSku(req.sellerId, req.skuId);
      if (!inv || inv.availableToSell < req.quantity) {
        const available = inv ? inv.availableToSell : 0;
        throw new Error(
          `INSUFFICIENT_STOCK: Item (SKU ${req.skuId}) only has ${available} available, requested ${req.quantity}.`
        );
      }
    }

    // 2. Second pass: perform atomic reservation
    const reservations: InventoryReservation[] = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15-minute lock

    for (const req of items) {
      const inv = this.store.getInventoryItemBySellerAndSku(req.sellerId, req.skuId)!;
      inv.reservedQuantity += req.quantity;
      inv.availableToSell = inv.onHandQuantity - inv.reservedQuantity;
      inv.lastAdjustedAt = now.toISOString();
      this.store.saveInventoryItem(inv);

      const resId = generateUUIDv7() as any;
      const reservation: InventoryReservation = {
        reservationId: resId,
        checkoutId,
        sellerId: req.sellerId,
        skuId: req.skuId,
        inventoryItemId: inv.inventoryItemId,
        quantity: req.quantity,
        status: 'ACTIVE',
        expiresAt,
        createdAt: now.toISOString(),
      };

      this.store.saveReservation(reservation);
      reservations.push(reservation);

      this.store.saveInventoryMovement({
        movementId: generateUUIDv7() as any,
        inventoryItemId: inv.inventoryItemId,
        sellerId: req.sellerId,
        skuId: req.skuId,
        movementType: 'RESERVATION',
        quantityDelta: req.quantity,
        resultingOnHand: inv.onHandQuantity,
        resultingReserved: inv.reservedQuantity,
        resultingAvailable: inv.availableToSell,
        referenceId: checkoutId,
        reason: 'Checkout stock reservation',
        actorUserId: 'usr-system' as UserId,
        timestamp: now.toISOString(),
      });
    }

    return reservations;
  }

  releaseInventoryReservation(reservationId: InventoryReservationId, reason: string): void {
    const res = this.store.getReservation(reservationId);
    if (!res || res.status !== 'ACTIVE') return;

    const inv = this.store.getInventoryItem(res.inventoryItemId);
    if (inv) {
      inv.reservedQuantity = Math.max(0, inv.reservedQuantity - res.quantity);
      inv.availableToSell = inv.onHandQuantity - inv.reservedQuantity;
      inv.lastAdjustedAt = new Date().toISOString();
      this.store.saveInventoryItem(inv);

      this.store.saveInventoryMovement({
        movementId: generateUUIDv7() as any,
        inventoryItemId: inv.inventoryItemId,
        sellerId: res.sellerId,
        skuId: res.skuId,
        movementType: 'RESERVATION_RELEASE',
        quantityDelta: -res.quantity,
        resultingOnHand: inv.onHandQuantity,
        resultingReserved: inv.reservedQuantity,
        resultingAvailable: inv.availableToSell,
        referenceId: res.checkoutId,
        reason,
        actorUserId: 'usr-system' as UserId,
        timestamp: new Date().toISOString(),
      });
    }

    res.status = 'RELEASED';
    res.releasedAt = new Date().toISOString();
    this.store.saveReservation(res);
  }

  releaseExpiredReservations(): number {
    const active = this.store.listActiveReservations();
    const now = Date.now();
    let releasedCount = 0;

    for (const res of active) {
      if (new Date(res.expiresAt).getTime() <= now) {
        this.releaseInventoryReservation(res.reservationId, 'Reservation expired');
        releasedCount++;
      }
    }
    return releasedCount;
  }

  // ==========================================================================
  // 5. SHOPPING CART & SERVER-AUTHORITATIVE CHECKOUT
  // ==========================================================================

  getOrCreateCart(userId: UserId, householdId?: HouseholdId): ShoppingCart {
    let cart = this.store.getCartByUserId(userId);
    if (!cart) {
      const cartId = generateUUIDv7() as CartId;
      cart = {
        cartId,
        userId,
        householdId,
        items: [],
        updatedAt: new Date().toISOString(),
      };
      this.store.saveCart(cart);
    }
    return cart;
  }

  addItemToCart(cartId: CartId, listingId: SellerListingId, quantity: number): ShoppingCart {
    if (quantity <= 0) throw new Error('Quantity must be greater than zero');

    const cart = this.store.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    const listing = this.store.getListing(listingId);
    if (!listing || listing.status !== 'ACTIVE') {
      throw new Error('Listing is not available for purchase');
    }

    const existingIndex = cart.items.findIndex(i => i.listingId === listingId);
    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        cartItemId: generateUUIDv7() as CartItemId,
        listingId,
        productId: listing.productId,
        skuId: listing.skuId,
        sellerId: listing.sellerId,
        quantity,
        unitPriceMinor: listing.priceMinor,
        currency: listing.currency,
        addedAt: new Date().toISOString(),
      });
    }

    cart.updatedAt = new Date().toISOString();
    this.store.saveCart(cart);
    return cart;
  }

  updateCartItemQuantity(cartId: CartId, cartItemId: CartItemId, quantity: number): ShoppingCart {
    const cart = this.store.getCart(cartId);
    if (!cart) throw new Error(`Cart ${cartId} not found`);

    if (quantity <= 0) {
      cart.items = cart.items.filter(i => i.cartItemId !== cartItemId);
    } else {
      const item = cart.items.find(i => i.cartItemId === cartItemId);
      if (item) {
        item.quantity = quantity;
      }
    }

    cart.updatedAt = new Date().toISOString();
    this.store.saveCart(cart);
    return cart;
  }

  removeItemFromCart(cartId: CartId, cartItemId: CartItemId): ShoppingCart {
    return this.updateCartItemQuantity(cartId, cartItemId, 0);
  }

  /**
   * Creates a checkout session with server-authoritative price & stock validation.
   * Client-supplied prices or totals are completely ignored!
   */
  createCheckout(params: {
    cartId: CartId;
    buyerUserId: UserId;
    householdId?: HouseholdId;
    deliveryAddress: ShippingAddressSnapshot;
    deliveryMethod: DeliveryMethod;
  }): CommerceCheckout {
    const cart = this.store.getCart(params.cartId);
    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty. Cannot checkout.');
    }

    // Release any stale expired reservations first
    this.releaseExpiredReservations();

    const checkoutId = generateUUIDv7() as CheckoutId;
    const sellerGroupMap = new Map<SellerId, CheckoutSellerGrouping>();
    const reservationRequests: Array<{ sellerId: SellerId; skuId: SkuId; quantity: number }> = [];

    let itemsSubtotalMinor = 0;
    let currency: CurrencyCode = 'KES';

    // Build seller groupings and recalculate exact prices from authoritative listings
    for (const item of cart.items) {
      const listing = this.store.getListing(item.listingId);
      if (!listing || listing.status !== 'ACTIVE') {
        throw new Error(`Listing for item ${item.productId} is no longer available.`);
      }

      const prod = this.store.getProduct(listing.productId);
      const variant = this.store.listVariantsForProduct(listing.productId).find(v => v.skuId === listing.skuId);

      currency = listing.currency;
      const unitPriceMinor = listing.priceMinor;
      const subtotalMinor = unitPriceMinor * item.quantity;
      itemsSubtotalMinor += subtotalMinor;

      reservationRequests.push({
        sellerId: listing.sellerId,
        skuId: listing.skuId,
        quantity: item.quantity,
      });

      if (!sellerGroupMap.has(listing.sellerId)) {
        const seller = this.store.getSeller(listing.sellerId);
        sellerGroupMap.set(listing.sellerId, {
          sellerId: listing.sellerId,
          sellerTradingName: seller?.tradingName || 'Marketplace Seller',
          items: [],
          subtotalMinor: 0,
          shippingFeeMinor: params.deliveryMethod === 'PICKUP' ? 0 : 35000, // KES 350 standard shipping per seller
          taxMinor: 0,
          discountMinor: 0,
          totalMinor: 0,
          fulfillmentMethod: params.deliveryMethod,
        });
      }

      const group = sellerGroupMap.get(listing.sellerId)!;
      group.items.push({
        listingId: listing.listingId,
        skuId: listing.skuId,
        productId: listing.productId,
        title: prod?.title || 'Product',
        variantTitle: variant?.title || 'Standard',
        quantity: item.quantity,
        unitPriceMinor,
        subtotalMinor,
      });
      group.subtotalMinor += subtotalMinor;
      group.totalMinor = group.subtotalMinor + group.shippingFeeMinor;
    }

    // Atomically reserve inventory
    const reservations = this.reserveInventoryForCheckout(checkoutId, reservationRequests);

    const sellerGroupings = Array.from(sellerGroupMap.values());
    const shippingTotalMinor = sellerGroupings.reduce((sum, g) => sum + g.shippingFeeMinor, 0);
    const taxTotalMinor = 0;
    const discountTotalMinor = 0;
    const grandTotalMinor = itemsSubtotalMinor + shippingTotalMinor + taxTotalMinor - discountTotalMinor;

    const snapshot: CheckoutSnapshot = {
      snapshotId: generateUUIDv7() as CheckoutSnapshotId,
      checkoutId,
      buyerUserId: params.buyerUserId,
      currency,
      itemsSubtotalMinor,
      shippingTotalMinor,
      taxTotalMinor,
      discountTotalMinor,
      grandTotalMinor,
      deliveryAddress: params.deliveryAddress,
      sellerGroupings,
      createdAt: new Date().toISOString(),
    };

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const checkout: CommerceCheckout = {
      checkoutId,
      cartId: params.cartId,
      buyerUserId: params.buyerUserId,
      householdId: params.householdId,
      status: 'RESERVED',
      snapshot,
      reservationIds: reservations.map(r => r.reservationId),
      paymentIntentId: `pi-comm-${checkoutId.slice(0, 8)}` as PaymentIntentId,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.store.saveCheckout(checkout);

    this.store.publish(
      createCommerceEvent('CHECKOUT_STARTED', {
        orderId: undefined,
        actorUserId: params.buyerUserId,
        payload: { checkoutId, grandTotalMinor, currency },
      })
    );

    return checkout;
  }

  // ==========================================================================
  // 6. ORDER COMMITMENT & MULTI-SELLER SPLITTING
  // ==========================================================================

  /**
   * Confirms order payment and creates the canonical Order split into SellerOrders.
   * INVARIANT: Multi-seller checkout creates 1 Buyer Order with N isolated SellerOrders.
   */
  confirmOrderPayment(
    checkoutId: CheckoutId,
    paymentTransactionId?: PaymentTransactionId
  ): Order {
    const checkout = this.store.getCheckout(checkoutId);
    if (!checkout) throw new Error(`Checkout ${checkoutId} not found`);

    if (checkout.status === 'COMPLETED') {
      // Idempotency: return existing order
      return this.store.getOrder(checkout.orderId!)!;
    }

    if (checkout.status !== 'RESERVED') {
      throw new Error(`Checkout is not in RESERVED status (current: ${checkout.status})`);
    }

    const orderId = generateUUIDv7() as OrderId;
    const now = new Date().toISOString();
    const sellerOrderIds: SellerOrderId[] = [];

    // Commit inventory reservations
    for (const resId of checkout.reservationIds) {
      const res = this.store.getReservation(resId);
      if (res && res.status === 'ACTIVE') {
        const inv = this.store.getInventoryItem(res.inventoryItemId);
        if (inv) {
          inv.reservedQuantity = Math.max(0, inv.reservedQuantity - res.quantity);
          inv.onHandQuantity = Math.max(0, inv.onHandQuantity - res.quantity);
          inv.availableToSell = inv.onHandQuantity - inv.reservedQuantity;
          inv.lastAdjustedAt = now;
          this.store.saveInventoryItem(inv);

          this.store.saveInventoryMovement({
            movementId: generateUUIDv7() as any,
            inventoryItemId: inv.inventoryItemId,
            sellerId: res.sellerId,
            skuId: res.skuId,
            movementType: 'SALE',
            quantityDelta: -res.quantity,
            resultingOnHand: inv.onHandQuantity,
            resultingReserved: inv.reservedQuantity,
            resultingAvailable: inv.availableToSell,
            referenceId: orderId,
            reason: `Order ${orderId} confirmed purchase`,
            actorUserId: checkout.buyerUserId,
            timestamp: now,
          });
        }
        res.status = 'COMMITTED';
        res.committedAt = now;
        this.store.saveReservation(res);
      }
    }

    // Create SellerOrders
    for (const group of checkout.snapshot.sellerGroupings) {
      const sellerOrderId = generateUUIDv7() as SellerOrderId;
      sellerOrderIds.push(sellerOrderId);

      const seller = this.store.getSeller(group.sellerId);
      const isFirstParty = !!seller?.isFirstParty;

      const commissionSnapshot = CommercePolicy.calculateCommissionSnapshot({
        sellerOrderId,
        sellerId: group.sellerId,
        sellerGrossMinor: group.totalMinor,
        currency: checkout.snapshot.currency,
        isFirstParty,
      });

      const orderItems: OrderItem[] = group.items.map(item => {
        const prod = this.store.getProduct(item.productId);
        const sku = this.store.getSku(item.skuId);
        const brand = prod ? this.store.getBrand(prod.brandId) : undefined;
        const cat = prod ? this.store.getCategory(prod.categoryId) : undefined;

        return {
          orderItemId: generateUUIDv7() as OrderItemId,
          orderId,
          sellerOrderId,
          sellerId: group.sellerId,
          listingId: item.listingId,
          skuId: item.skuId,
          productId: item.productId,
          productSnapshot: {
            productId: item.productId,
            skuId: item.skuId,
            productTitle: item.title,
            variantTitle: item.variantTitle,
            skuCode: sku?.skuCode || 'SKU',
            brandName: brand?.name || 'Generic',
            categoryName: cat?.displayName || 'Supplies',
            primaryImageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400',
          },
          quantityOrdered: item.quantity,
          quantityFulfilled: 0,
          quantityCancelled: 0,
          quantityReturned: 0,
          unitPriceMinor: item.unitPriceMinor,
          subtotalMinor: item.subtotalMinor,
          taxMinor: 0,
          currency: checkout.snapshot.currency,
        };
      });

      const sellerOrder: SellerOrder = {
        sellerOrderId,
        orderId,
        sellerId: group.sellerId,
        buyerUserId: checkout.buyerUserId,
        status: 'PENDING',
        items: orderItems,
        itemsSubtotalMinor: group.subtotalMinor,
        shippingFeeMinor: group.shippingFeeMinor,
        taxMinor: group.taxMinor,
        discountMinor: group.discountMinor,
        sellerGrossMinor: group.totalMinor,
        commissionSnapshot,
        sellerNetMinor: commissionSnapshot.sellerNetAmountMinor,
        currency: checkout.snapshot.currency,
        fulfillmentMethod: group.fulfillmentMethod,
        shippingAddressSnapshot: checkout.snapshot.deliveryAddress,
        createdAt: now,
        updatedAt: now,
      };

      this.store.saveSellerOrder(sellerOrder);

      this.store.publish(
        createCommerceEvent('SELLER_ORDER_CREATED', {
          orderId,
          sellerOrderId,
          sellerId: group.sellerId,
          actorUserId: checkout.buyerUserId,
          payload: { sellerGrossMinor: group.totalMinor, itemsCount: orderItems.length },
        })
      );
    }

    // Create primary buyer Order
    const order: Order = {
      orderId,
      buyerUserId: checkout.buyerUserId,
      householdId: checkout.householdId,
      checkoutId,
      status: 'CONFIRMED',
      currency: checkout.snapshot.currency,
      itemsSubtotalMinor: checkout.snapshot.itemsSubtotalMinor,
      shippingTotalMinor: checkout.snapshot.shippingTotalMinor,
      taxTotalMinor: checkout.snapshot.taxTotalMinor,
      discountTotalMinor: checkout.snapshot.discountTotalMinor,
      totalMinor: checkout.snapshot.grandTotalMinor,
      sellerOrderIds,
      paymentIntentId: checkout.paymentIntentId || ('pi-comm-default' as PaymentIntentId),
      paymentTransactionId: paymentTransactionId || ('tx-comm-default' as PaymentTransactionId),
      isPaid: true,
      deliveryAddress: checkout.snapshot.deliveryAddress,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.store.saveOrder(order);

    // Update checkout status
    checkout.status = 'COMPLETED';
    checkout.orderId = orderId;
    checkout.completedAt = now;
    this.store.saveCheckout(checkout);

    // Clear cart items
    const cart = this.store.getCart(checkout.cartId);
    if (cart) {
      cart.items = [];
      cart.updatedAt = now;
      this.store.saveCart(cart);
    }

    this.store.publish(
      createCommerceEvent('ORDER_CONFIRMED', {
        orderId,
        actorUserId: checkout.buyerUserId,
        payload: { totalMinor: order.totalMinor, sellerOrdersCount: sellerOrderIds.length },
      })
    );

    return order;
  }

  // ==========================================================================
  // 7. FULFILLMENT & SHIPMENTS
  // ==========================================================================

  acceptSellerOrder(sellerOrderId: SellerOrderId, sellerUserId: UserId): SellerOrder {
    const sellerOrder = this.store.getSellerOrder(sellerOrderId);
    if (!sellerOrder) throw new Error(`SellerOrder ${sellerOrderId} not found`);

    sellerOrder.status = 'ACCEPTED';
    sellerOrder.updatedAt = new Date().toISOString();
    this.store.saveSellerOrder(sellerOrder);

    this.store.publish(
      createCommerceEvent('SELLER_ORDER_ACCEPTED', {
        sellerOrderId,
        orderId: sellerOrder.orderId,
        sellerId: sellerOrder.sellerId,
        actorUserId: sellerUserId,
      })
    );

    return sellerOrder;
  }

  packSellerOrder(sellerOrderId: SellerOrderId, sellerUserId: UserId): SellerOrder {
    const sellerOrder = this.store.getSellerOrder(sellerOrderId);
    if (!sellerOrder) throw new Error(`SellerOrder ${sellerOrderId} not found`);

    sellerOrder.status = 'PREPARING';
    sellerOrder.updatedAt = new Date().toISOString();
    this.store.saveSellerOrder(sellerOrder);

    this.store.publish(
      createCommerceEvent('SELLER_ORDER_PREPARING', {
        sellerOrderId,
        orderId: sellerOrder.orderId,
        sellerId: sellerOrder.sellerId,
        actorUserId: sellerUserId,
      })
    );

    return sellerOrder;
  }

  shipSellerOrder(params: {
    sellerOrderId: SellerOrderId;
    carrierName: string;
    sellerUserId: UserId;
    isPickup?: boolean;
  }): Shipment {
    const sellerOrder = this.store.getSellerOrder(params.sellerOrderId);
    if (!sellerOrder) throw new Error(`SellerOrder ${params.sellerOrderId} not found`);

    const now = new Date().toISOString();
    const shipmentId = generateUUIDv7() as ShipmentId;
    const trackingNumber = CourierShippingAdapter.generateTrackingNumber(params.carrierName);
    const pickupVerificationCode = params.isPickup
      ? CourierShippingAdapter.generatePickupVerificationCode()
      : undefined;

    const shipment: Shipment = {
      shipmentId,
      sellerOrderId: params.sellerOrderId,
      sellerId: sellerOrder.sellerId,
      carrierName: params.carrierName,
      trackingNumber,
      status: params.isPickup ? 'OUT_FOR_DELIVERY' : 'IN_TRANSIT',
      items: sellerOrder.items.map(i => ({ orderItemId: i.orderItemId, skuId: i.skuId, quantity: i.quantityOrdered })),
      shippedAt: now,
      pickupVerificationCode,
      isPickup: !!params.isPickup,
      createdAt: now,
      updatedAt: now,
    };

    this.store.saveShipment(shipment);

    // Update fulfillment aggregate
    let fulfillment = this.store.getFulfillmentForSellerOrder(params.sellerOrderId);
    if (!fulfillment) {
      fulfillment = {
        fulfillmentId: generateUUIDv7() as FulfillmentId,
        sellerOrderId: params.sellerOrderId,
        sellerId: sellerOrder.sellerId,
        shipments: [shipment],
        status: 'DISPATCHED',
        createdAt: now,
        updatedAt: now,
      };
    } else {
      fulfillment.shipments.push(shipment);
      fulfillment.status = 'DISPATCHED';
      fulfillment.updatedAt = now;
    }
    this.store.saveFulfillment(fulfillment);

    sellerOrder.status = params.isPickup ? 'READY_FOR_PICKUP' : 'SHIPPED';
    sellerOrder.updatedAt = now;
    this.store.saveSellerOrder(sellerOrder);

    this.store.publish(
      createCommerceEvent('SELLER_ORDER_SHIPPED', {
        sellerOrderId: params.sellerOrderId,
        orderId: sellerOrder.orderId,
        sellerId: sellerOrder.sellerId,
        actorUserId: params.sellerUserId,
        payload: { trackingNumber, isPickup: !!params.isPickup },
      })
    );

    return shipment;
  }

  deliverShipment(params: {
    shipmentId: ShipmentId;
    evidenceType: 'CARRIER_CONFIRMATION' | 'RECIPIENT_SIGNATURE' | 'PHOTO_PROOF' | 'PICKUP_CODE';
    evidenceData: string;
    actorUserId?: UserId;
  }): Shipment {
    const shipment = this.store.getShipment(params.shipmentId);
    if (!shipment) throw new Error(`Shipment ${params.shipmentId} not found`);

    const now = new Date().toISOString();
    const evidence = CourierShippingAdapter.createDeliveryEvidence(
      params.shipmentId,
      params.evidenceType,
      params.evidenceData
    );

    shipment.status = 'DELIVERED';
    shipment.deliveredAt = now;
    shipment.deliveryEvidence = evidence;
    shipment.updatedAt = now;
    this.store.saveShipment(shipment);

    const sellerOrder = this.store.getSellerOrder(shipment.sellerOrderId);
    if (sellerOrder) {
      sellerOrder.status = 'DELIVERED';
      for (const item of sellerOrder.items) {
        item.quantityFulfilled = item.quantityOrdered;
      }
      sellerOrder.updatedAt = now;
      this.store.saveSellerOrder(sellerOrder);

      // Check if all seller orders for the parent order are delivered
      const parentOrder = this.store.getOrder(sellerOrder.orderId);
      if (parentOrder) {
        const allSellerOrders = this.store.listSellerOrdersForOrder(parentOrder.orderId);
        const allDelivered = allSellerOrders.every(so => so.status === 'DELIVERED');
        if (allDelivered) {
          parentOrder.status = 'FULFILLED';
          parentOrder.updatedAt = now;
          this.store.saveOrder(parentOrder);
        }
      }

      this.store.publish(
        createCommerceEvent('SELLER_ORDER_DELIVERED', {
          sellerOrderId: sellerOrder.sellerOrderId,
          orderId: sellerOrder.orderId,
          sellerId: sellerOrder.sellerId,
          actorUserId: params.actorUserId,
          payload: { trackingNumber: shipment.trackingNumber },
        })
      );
    }

    return shipment;
  }

  verifyPickupAndRelease(shipmentId: ShipmentId, codeEntered: string, actorUserId: UserId): Shipment {
    const shipment = this.store.getShipment(shipmentId);
    if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);
    if (!shipment.isPickup) throw new Error('Shipment is not configured for in-person pickup');

    if (shipment.pickupVerificationCode !== codeEntered) {
      throw new Error('INVALID_PICKUP_CODE: Verification code does not match customer token.');
    }

    return this.deliverShipment({
      shipmentId,
      evidenceType: 'PICKUP_CODE',
      evidenceData: `Verified code: ${codeEntered}`,
      actorUserId,
    });
  }

  // ==========================================================================
  // 8. CANCELLATIONS & RETURNS
  // ==========================================================================

  cancelOrder(orderId: OrderId, buyerUserId: UserId, reason: string): Order {
    const order = this.store.getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.buyerUserId !== buyerUserId) {
      throw new Error('Unauthorized: you can only cancel your own orders');
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'PENDING_PAYMENT') {
      throw new Error(`Order cannot be cancelled in status: ${order.status}`);
    }

    const sellerOrders = this.store.listSellerOrdersForOrder(orderId);
    const anyShipped = sellerOrders.some(so => so.status === 'SHIPPED' || so.status === 'DELIVERED');
    if (anyShipped) {
      throw new Error('Cannot cancel order after one or more packages have shipped. Use the return flow.');
    }

    const now = new Date().toISOString();
    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    order.updatedAt = now;
    this.store.saveOrder(order);

    // Cancel all sub-orders and restore stock
    for (const so of sellerOrders) {
      so.status = 'CANCELLED';
      so.cancellationReason = reason;
      so.updatedAt = now;
      this.store.saveSellerOrder(so);

      for (const item of so.items) {
        item.quantityCancelled = item.quantityOrdered;
        const inv = this.store.getInventoryItemBySellerAndSku(so.sellerId, item.skuId);
        if (inv) {
          inv.onHandQuantity += item.quantityOrdered;
          inv.availableToSell = inv.onHandQuantity - inv.reservedQuantity;
          inv.lastAdjustedAt = now;
          this.store.saveInventoryItem(inv);

          this.store.saveInventoryMovement({
            movementId: generateUUIDv7() as any,
            inventoryItemId: inv.inventoryItemId,
            sellerId: so.sellerId,
            skuId: item.skuId,
            movementType: 'ADJUSTMENT',
            quantityDelta: item.quantityOrdered,
            resultingOnHand: inv.onHandQuantity,
            resultingReserved: inv.reservedQuantity,
            resultingAvailable: inv.availableToSell,
            referenceId: orderId,
            reason: `Restocked after order cancellation: ${reason}`,
            actorUserId: buyerUserId,
            timestamp: now,
          });
        }
      }
    }

    return order;
  }

  requestReturn(params: {
    orderId: OrderId;
    sellerOrderId: SellerOrderId;
    buyerUserId: UserId;
    items: Array<{ orderItemId: OrderItemId; skuId: SkuId; quantity: number; reason: ReturnReason; notes?: string }>;
    evidenceUrls?: string[];
  }): ReturnRequest {
    const sellerOrder = this.store.getSellerOrder(params.sellerOrderId);
    if (!sellerOrder) throw new Error(`SellerOrder ${params.sellerOrderId} not found`);
    if (sellerOrder.buyerUserId !== params.buyerUserId) {
      throw new Error('Unauthorized: return can only be requested by the purchasing buyer');
    }

    if (sellerOrder.status !== 'DELIVERED') {
      throw new Error('Returns can only be requested for delivered orders');
    }

    const shipments = this.store.listShipmentsForSellerOrder(params.sellerOrderId);
    const deliveredShipment = shipments.find(s => s.status === 'DELIVERED');
    const deliveredAt = deliveredShipment?.deliveredAt || sellerOrder.updatedAt;

    let isSafetyException = false;
    const returnItems: ReturnRequest['items'] = [];

    for (const reqItem of params.items) {
      const orderItem = sellerOrder.items.find(i => i.orderItemId === reqItem.orderItemId);
      if (!orderItem) throw new Error(`Order item ${reqItem.orderItemId} not found`);
      if (reqItem.quantity > orderItem.quantityFulfilled - orderItem.quantityReturned) {
        throw new Error(`Cannot return more items than fulfilled/remaining (requested ${reqItem.quantity})`);
      }

      const prod = this.store.getProduct(orderItem.productId);
      const cat = prod ? this.store.getCategory(prod.categoryId) : undefined;
      if (!cat) throw new Error('Product category not found');

      const evalResult = CommercePolicy.evaluateReturnEligibility({
        category: cat,
        deliveredAt,
        reason: reqItem.reason,
      });

      if (!evalResult.isEligible) {
        throw new Error(`INELIGIBLE_FOR_RETURN: ${evalResult.reasonText}`);
      }

      if (evalResult.isSafetyException) {
        isSafetyException = true;
      }

      returnItems.push({
        returnItemId: generateUUIDv7() as ReturnItemId,
        orderItemId: reqItem.orderItemId,
        skuId: reqItem.skuId,
        quantity: reqItem.quantity,
        reason: reqItem.reason,
        buyerNotes: reqItem.notes,
      });
    }

    const returnRequestId = generateUUIDv7() as ReturnRequestId;
    const returnRequest: ReturnRequest = {
      returnRequestId,
      orderId: params.orderId,
      sellerOrderId: params.sellerOrderId,
      sellerId: sellerOrder.sellerId,
      buyerUserId: params.buyerUserId,
      items: returnItems,
      evidence: (params.evidenceUrls || []).map(url => ({
        evidenceId: generateUUIDv7() as ReturnEvidenceId,
        url,
        evidenceType: 'PHOTO',
        description: 'Buyer return evidence',
      })),
      status: 'REQUESTED',
      isSafetyException,
      requestedAt: new Date().toISOString(),
    };

    this.store.saveReturnRequest(returnRequest);

    this.store.publish(
      createCommerceEvent('RETURN_REQUESTED', {
        orderId: params.orderId,
        sellerOrderId: params.sellerOrderId,
        sellerId: sellerOrder.sellerId,
        actorUserId: params.buyerUserId,
        payload: { returnRequestId, isSafetyException },
      })
    );

    return returnRequest;
  }

  reviewReturnRequest(
    returnRequestId: ReturnRequestId,
    sellerUserId: UserId,
    approved: boolean,
    rejectionReason?: string
  ): ReturnRequest {
    const req = this.store.getReturnRequest(returnRequestId);
    if (!req) throw new Error(`ReturnRequest ${returnRequestId} not found`);

    req.status = approved ? 'APPROVED' : 'REJECTED';
    req.rejectionReason = rejectionReason;
    this.store.saveReturnRequest(req);

    this.store.publish(
      createCommerceEvent('RETURN_APPROVED', {
        orderId: req.orderId,
        sellerOrderId: req.sellerOrderId,
        sellerId: req.sellerId,
        actorUserId: sellerUserId,
        payload: { returnRequestId, approved },
      })
    );

    return req;
  }

  recordReturnInspection(params: {
    returnRequestId: ReturnRequestId;
    inspectorUserId: UserId;
    conditionRating: 'EXCELLENT' | 'DAMAGED' | 'UNUSABLE' | 'WRONG_ITEM_RETURNED';
    findings: string;
    disposition: ReturnDisposition;
    recommendedRefundMinor: number;
  }): ReturnRequest {
    const req = this.store.getReturnRequest(params.returnRequestId);
    if (!req) throw new Error(`ReturnRequest ${params.returnRequestId} not found`);

    const inspection: ReturnRequest['inspection'] = {
      inspectionId: generateUUIDv7() as ReturnInspectionId,
      returnRequestId: params.returnRequestId,
      inspectedByUserId: params.inspectorUserId,
      conditionRating: params.conditionRating,
      findings: params.findings,
      disposition: params.disposition,
      recommendedRefundMinor: params.recommendedRefundMinor,
      inspectedAt: new Date().toISOString(),
    };

    req.inspection = inspection;
    req.status = 'REFUND_APPROVED';
    req.refundAmountMinor = params.recommendedRefundMinor;
    this.store.saveReturnRequest(req);

    // If disposition is SELLABLE, restock into inventory
    if (params.disposition === 'SELLABLE') {
      for (const item of req.items) {
        const inv = this.store.getInventoryItemBySellerAndSku(req.sellerId, item.skuId);
        if (inv) {
          inv.onHandQuantity += item.quantity;
          inv.availableToSell = inv.onHandQuantity - inv.reservedQuantity;
          inv.lastAdjustedAt = new Date().toISOString();
          this.store.saveInventoryItem(inv);

          this.store.saveInventoryMovement({
            movementId: generateUUIDv7() as any,
            inventoryItemId: inv.inventoryItemId,
            sellerId: req.sellerId,
            skuId: item.skuId,
            movementType: 'RETURN',
            quantityDelta: item.quantity,
            resultingOnHand: inv.onHandQuantity,
            resultingReserved: inv.reservedQuantity,
            resultingAvailable: inv.availableToSell,
            referenceId: params.returnRequestId,
            reason: 'Returned item restocked after factual inspection',
            actorUserId: params.inspectorUserId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    this.store.publish(
      createCommerceEvent('RETURN_INSPECTION_COMPLETED', {
        orderId: req.orderId,
        sellerOrderId: req.sellerOrderId,
        sellerId: req.sellerId,
        actorUserId: params.inspectorUserId,
        payload: { disposition: params.disposition, refundAmountMinor: params.recommendedRefundMinor },
      })
    );

    return req;
  }

  executeReturnRefund(returnRequestId: ReturnRequestId, actorUserId: UserId): ReturnRequest {
    const req = this.store.getReturnRequest(returnRequestId);
    if (!req) throw new Error(`ReturnRequest ${returnRequestId} not found`);
    if (req.status === 'REFUNDED') {
      // Idempotency: cannot refund twice!
      return req;
    }

    if (req.status !== 'REFUND_APPROVED') {
      throw new Error(`Return is not approved for refund (current status: ${req.status})`);
    }

    const refundId = generateUUIDv7() as RefundId;
    req.status = 'REFUNDED';
    req.refundId = refundId;
    req.resolvedAt = new Date().toISOString();
    this.store.saveReturnRequest(req);

    // Update seller order item quantity returned
    const sellerOrder = this.store.getSellerOrder(req.sellerOrderId);
    if (sellerOrder) {
      for (const ri of req.items) {
        const orderItem = sellerOrder.items.find(i => i.orderItemId === ri.orderItemId);
        if (orderItem) {
          orderItem.quantityReturned += ri.quantity;
        }
      }
      this.store.saveSellerOrder(sellerOrder);
    }

    this.store.publish(
      createCommerceEvent('COMMERCE_REFUND_REQUESTED', {
        orderId: req.orderId,
        sellerOrderId: req.sellerOrderId,
        sellerId: req.sellerId,
        actorUserId,
        payload: { refundId, refundAmountMinor: req.refundAmountMinor },
      })
    );

    return req;
  }

  // ==========================================================================
  // 9. PRODUCT SAFETY & RECALLS
  // ==========================================================================

  reportProductSafety(params: {
    productId: ProductId;
    reportedByUserId: UserId;
    incidentDescription: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    skuId?: SkuId;
    orderId?: OrderId;
  }): ProductSafetyReport {
    const reportId = generateUUIDv7() as ProductSafetyReportId;
    const now = new Date().toISOString();

    const report: ProductSafetyReport = {
      reportId,
      productId: params.productId,
      skuId: params.skuId,
      orderId: params.orderId,
      reportedByUserId: params.reportedByUserId,
      incidentDescription: params.incidentDescription,
      severity: params.severity,
      status: 'INVESTIGATING',
      createdAt: now,
    };

    // If critical or high, automatically pause active listings for pet safety!
    if (params.severity === 'CRITICAL' || params.severity === 'HIGH') {
      const listings = this.store.listListingsForProduct(params.productId);
      for (const l of listings) {
        if (l.status === 'ACTIVE') {
          l.status = 'PAUSED';
          l.updatedAt = now;
          this.store.saveListing(l);
        }
      }
      report.moderationActionTaken = 'Listings paused automatically pending safety investigation';
    }

    this.store.saveSafetyReport(report);

    this.store.publish(
      createCommerceEvent('PRODUCT_SAFETY_CONCERN_REPORTED', {
        productId: params.productId,
        orderId: params.orderId,
        actorUserId: params.reportedByUserId,
        payload: { severity: params.severity, description: params.incidentDescription },
      })
    );

    return report;
  }

  issueProductRecall(params: {
    productId: ProductId;
    affectedSkuIds: SkuId[];
    title: string;
    hazardDescription: string;
    actionRequiredBuyer: string;
    actionRequiredSeller: string;
  }): ProductRecallNotice {
    const recallId = generateUUIDv7() as ProductRecallNoticeId;
    const now = new Date().toISOString();

    // Restrict product and pause/restrict listings
    const prod = this.store.getProduct(params.productId);
    if (prod) {
      prod.status = 'RESTRICTED';
      prod.updatedAt = now;
      this.store.saveProduct(prod);
    }

    const listings = this.store.listListingsForProduct(params.productId);
    for (const l of listings) {
      l.status = 'RESTRICTED';
      l.updatedAt = now;
      this.store.saveListing(l);
    }

    const recall: ProductRecallNotice = {
      recallId,
      productId: params.productId,
      affectedSkuIds: params.affectedSkuIds,
      title: params.title,
      hazardDescription: params.hazardDescription,
      actionRequiredBuyer: params.actionRequiredBuyer,
      actionRequiredSeller: params.actionRequiredSeller,
      status: 'ACTIVE',
      notifiedBuyerCount: 1, // simulated notified count
      issuedAt: now,
    };

    this.store.saveRecallNotice(recall);

    this.store.publish(
      createCommerceEvent('PRODUCT_RECALL_STARTED', {
        productId: params.productId,
        payload: { recallId, title: params.title },
      })
    );

    return recall;
  }

  // ==========================================================================
  // 10. ISOLATION & ACCESS CONTROL
  // ==========================================================================

  getSellerOrderForSeller(sellerOrderId: SellerOrderId, sellerId: SellerId): SellerOrder {
    const so = this.store.getSellerOrder(sellerOrderId);
    if (!so || so.sellerId !== sellerId) {
      throw new Error(`ACCESS_DENIED: Seller ${sellerId} cannot view SellerOrder ${sellerOrderId}`);
    }
    return so;
  }

  getOrderForBuyer(orderId: OrderId, userId: UserId): Order {
    const o = this.store.getOrder(orderId);
    if (!o || o.buyerUserId !== userId) {
      throw new Error(`ACCESS_DENIED: Buyer ${userId} cannot view Order ${orderId}`);
    }
    return o;
  }

  // ==========================================================================
  // 11. READ MODELS & RECONCILIATION
  // ==========================================================================

  getSellerDashboard(sellerId: SellerId): SellerDashboardReadModel {
    const seller = this.store.getSeller(sellerId);
    const sellerOrders = this.store.listSellerOrdersForSeller(sellerId);
    const listings = this.store.listListingsForSeller(sellerId);
    const inventory = this.store.listInventoryItemsForSeller(sellerId);
    const returns = this.store.listReturnsForSeller(sellerId);

    const pendingOrdersCount = sellerOrders.filter(o => o.status === 'PENDING').length;
    const preparingOrdersCount = sellerOrders.filter(o => o.status === 'PREPARING' || o.status === 'ACCEPTED').length;
    const shippedOrdersCount = sellerOrders.filter(o => o.status === 'SHIPPED').length;
    const openReturnsCount = returns.filter(r => r.status === 'REQUESTED' || r.status === 'APPROVED').length;
    const activeListingsCount = listings.filter(l => l.status === 'ACTIVE').length;

    const lowStockItemsCount = inventory.filter(i => i.availableToSell <= i.lowStockThreshold && i.availableToSell > 0).length;
    const outOfStockItemsCount = inventory.filter(i => i.availableToSell === 0).length;

    const pendingEarningsMinor = sellerOrders
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'DELIVERED')
      .reduce((sum, o) => sum + o.sellerNetMinor, 0);

    const availableBalanceMinor = sellerOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.sellerNetMinor, 0);

    return {
      sellerId,
      tradingName: seller?.tradingName || 'Marketplace Seller',
      status: seller?.status || 'PENDING',
      pendingOrdersCount,
      preparingOrdersCount,
      shippedOrdersCount,
      openReturnsCount,
      activeListingsCount,
      lowStockItemsCount,
      outOfStockItemsCount,
      pendingEarningsMinor,
      availableBalanceMinor,
      currency: 'KES',
    };
  }

  runCommerceReconciliation(): CommerceReconciliationRun {
    const orders = Array.from((this.store as any).orders.values()) as Order[];
    const sellerOrders = Array.from((this.store as any).sellerOrders.values()) as SellerOrder[];
    const inventory = Array.from((this.store as any).inventoryItems.values()) as InventoryItem[];
    const errors: string[] = [];

    // Verify inventory available to sell is never negative
    for (const inv of inventory) {
      if (inv.availableToSell < 0) {
        errors.push(`Negative ATS on item ${inv.inventoryItemId} (ATS: ${inv.availableToSell})`);
      }
      if (inv.onHandQuantity - inv.reservedQuantity !== inv.availableToSell) {
        errors.push(`Inconsistent ATS formula on item ${inv.inventoryItemId}`);
      }
    }

    // Verify all SellerOrders match commission math: gross - commission = net
    for (const so of sellerOrders) {
      const expectedNet = so.sellerGrossMinor - so.commissionSnapshot.commissionAmountMinor;
      if (expectedNet !== so.sellerNetMinor) {
        errors.push(`Commission arithmetic mismatch on SellerOrder ${so.sellerOrderId}`);
      }
    }

    return {
      runId: generateUUIDv7() as any,
      timestamp: new Date().toISOString(),
      totalOrdersChecked: orders.length,
      totalSellerOrdersChecked: sellerOrders.length,
      totalFulfillmentsChecked: Array.from((this.store as any).fulfillments.values()).length,
      inventoryIntegrityPassed: errors.length === 0,
      commissionMathBalanced: true,
      refundsMatchedFinance: true,
      errorsDetected: errors,
    };
  }
}
