/**
 * Pet OS Sprint 27 - Marketplace Commerce In-Memory Store
 * Authoritative in-memory repository implementing singleton pattern with indexed access.
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
  CheckoutId,
  OrderId,
  SellerOrderId,
  FulfillmentId,
  ShipmentId,
  ReturnRequestId,
  CommerceDisputeId,
  ProductSafetyReportId,
  ProductRecallNoticeId,
  CommerceSupportCaseId,
} from '../kernel/ids';
import {
  SellerProfile,
  SellerMembership,
  SellerVerificationCase,
  SellerAgreement,
  SellerPayoutDestination,
  ProductCategory,
  ProductBrand,
  Product,
  ProductVariant,
  ProductSku,
  ProductMedia,
  ProductDocument,
  ProductModerationCase,
  SellerListing,
  ListingPriceHistory,
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
  InventoryReservation,
  ShoppingCart,
  CommerceCheckout,
  Order,
  SellerOrder,
  Fulfillment,
  Shipment,
  ReturnRequest,
  CommerceDispute,
  ProductSafetyReport,
  ProductRecallNotice,
  CommerceSupportCase,
} from './types';
import { CommerceDomainEvent } from './events';

export class CommerceStore {
  private static instance: CommerceStore;

  // Sellers & Team
  private sellers = new Map<SellerId, SellerProfile>();
  private memberships = new Map<SellerMembershipId, SellerMembership>();
  private verificationCases = new Map<SellerVerificationCaseId, SellerVerificationCase>();
  private agreements = new Map<SellerAgreementId, SellerAgreement>();
  private payoutDestinations = new Map<SellerId, SellerPayoutDestination>();

  // Catalogue
  private categories = new Map<ProductCategoryId, ProductCategory>();
  private brands = new Map<ProductBrandId, ProductBrand>();
  private products = new Map<ProductId, Product>();
  private variants = new Map<ProductVariantId, ProductVariant>();
  private skus = new Map<SkuId, ProductSku>();
  private media = new Map<ProductMediaId, ProductMedia>();
  private documents = new Map<ProductDocumentId, ProductDocument>();
  private moderationCases = new Map<ProductModerationCaseId, ProductModerationCase>();

  // Listings & Pricing
  private listings = new Map<SellerListingId, SellerListing>();
  private priceHistories = new Map<ListingPriceHistoryId, ListingPriceHistory>();

  // Inventory
  private locations = new Map<InventoryLocationId, InventoryLocation>();
  private inventoryItems = new Map<InventoryItemId, InventoryItem>();
  private movements = new Map<InventoryMovementId, InventoryMovement>();
  private reservations = new Map<InventoryReservationId, InventoryReservation>();

  // Cart & Checkout
  private carts = new Map<CartId, ShoppingCart>();
  private userCartMap = new Map<UserId, CartId>();
  private checkouts = new Map<CheckoutId, CommerceCheckout>();

  // Orders & Fulfillment
  private orders = new Map<OrderId, Order>();
  private sellerOrders = new Map<SellerOrderId, SellerOrder>();
  private fulfillments = new Map<FulfillmentId, Fulfillment>();
  private shipments = new Map<ShipmentId, Shipment>();

  // Returns, Disputes & Trust
  private returnRequests = new Map<ReturnRequestId, ReturnRequest>();
  private disputes = new Map<CommerceDisputeId, CommerceDispute>();
  private safetyReports = new Map<ProductSafetyReportId, ProductSafetyReport>();
  private recallNotices = new Map<ProductRecallNoticeId, ProductRecallNotice>();
  private supportCases = new Map<CommerceSupportCaseId, CommerceSupportCase>();

  // Pub/Sub
  private listeners: Array<(event: CommerceDomainEvent) => void> = [];

  private constructor() {}

  static getInstance(): CommerceStore {
    if (!CommerceStore.instance) {
      CommerceStore.instance = new CommerceStore();
    }
    return CommerceStore.instance;
  }

  // --- SELLERS ---
  saveSeller(seller: SellerProfile): void {
    this.sellers.set(seller.sellerId, { ...seller });
  }

  getSeller(sellerId: SellerId): SellerProfile | undefined {
    const s = this.sellers.get(sellerId);
    return s ? { ...s } : undefined;
  }

  getSellerByBusinessId(businessId: BusinessId): SellerProfile | undefined {
    return Array.from(this.sellers.values()).find(s => s.businessId === businessId);
  }

  listSellers(): SellerProfile[] {
    return Array.from(this.sellers.values()).map(s => ({ ...s }));
  }

  saveMembership(m: SellerMembership): void {
    this.memberships.set(m.membershipId, { ...m });
  }

  getMembership(id: SellerMembershipId): SellerMembership | undefined {
    const m = this.memberships.get(id);
    return m ? { ...m } : undefined;
  }

  listMembershipsForSeller(sellerId: SellerId): SellerMembership[] {
    return Array.from(this.memberships.values()).filter(m => m.sellerId === sellerId && m.isActive);
  }

  listMembershipsForUser(userId: UserId): SellerMembership[] {
    return Array.from(this.memberships.values()).filter(m => m.userId === userId && m.isActive);
  }

  saveVerificationCase(c: SellerVerificationCase): void {
    this.verificationCases.set(c.caseId, { ...c });
  }

  getVerificationCase(caseId: SellerVerificationCaseId): SellerVerificationCase | undefined {
    const c = this.verificationCases.get(caseId);
    return c ? { ...c } : undefined;
  }

  listVerificationCases(sellerId?: SellerId): SellerVerificationCase[] {
    let list = Array.from(this.verificationCases.values());
    if (sellerId) list = list.filter(c => c.sellerId === sellerId);
    return list;
  }

  saveAgreement(a: SellerAgreement): void {
    this.agreements.set(a.agreementId, { ...a });
  }

  getAgreement(id: SellerAgreementId): SellerAgreement | undefined {
    const a = this.agreements.get(id);
    return a ? { ...a } : undefined;
  }

  getAgreementForSeller(sellerId: SellerId): SellerAgreement | undefined {
    return Array.from(this.agreements.values()).find(a => a.sellerId === sellerId);
  }

  savePayoutDestination(dest: SellerPayoutDestination): void {
    this.payoutDestinations.set(dest.sellerId, { ...dest });
  }

  getPayoutDestination(sellerId: SellerId): SellerPayoutDestination | undefined {
    const d = this.payoutDestinations.get(sellerId);
    return d ? { ...d } : undefined;
  }

  // --- CATALOGUE ---
  saveCategory(cat: ProductCategory): void {
    this.categories.set(cat.categoryId, { ...cat });
  }

  getCategory(id: ProductCategoryId): ProductCategory | undefined {
    const c = this.categories.get(id);
    return c ? { ...c } : undefined;
  }

  getCategoryByCode(code: string): ProductCategory | undefined {
    return Array.from(this.categories.values()).find(c => c.code === code);
  }

  listCategories(): ProductCategory[] {
    return Array.from(this.categories.values()).map(c => ({ ...c }));
  }

  saveBrand(brand: ProductBrand): void {
    this.brands.set(brand.brandId, { ...brand });
  }

  getBrand(id: ProductBrandId): ProductBrand | undefined {
    const b = this.brands.get(id);
    return b ? { ...b } : undefined;
  }

  listBrands(): ProductBrand[] {
    return Array.from(this.brands.values()).map(b => ({ ...b }));
  }

  saveProduct(prod: Product): void {
    this.products.set(prod.productId, { ...prod });
  }

  getProduct(id: ProductId): Product | undefined {
    const p = this.products.get(id);
    return p ? { ...p } : undefined;
  }

  listProducts(filter?: { categoryId?: ProductCategoryId; status?: string }): Product[] {
    let list = Array.from(this.products.values());
    if (filter?.categoryId) list = list.filter(p => p.categoryId === filter.categoryId);
    if (filter?.status) list = list.filter(p => p.status === filter.status);
    return list.map(p => ({ ...p }));
  }

  saveVariant(variant: ProductVariant): void {
    this.variants.set(variant.variantId, { ...variant });
  }

  getVariant(id: ProductVariantId): ProductVariant | undefined {
    const v = this.variants.get(id);
    return v ? { ...v } : undefined;
  }

  listVariantsForProduct(productId: ProductId): ProductVariant[] {
    return Array.from(this.variants.values()).filter(v => v.productId === productId);
  }

  saveSku(sku: ProductSku): void {
    this.skus.set(sku.skuId, { ...sku });
  }

  getSku(id: SkuId): ProductSku | undefined {
    const s = this.skus.get(id);
    return s ? { ...s } : undefined;
  }

  getSkuByCode(code: string): ProductSku | undefined {
    return Array.from(this.skus.values()).find(s => s.skuCode === code);
  }

  listSkusForProduct(productId: ProductId): ProductSku[] {
    return Array.from(this.skus.values()).filter(s => s.productId === productId);
  }

  saveMedia(m: ProductMedia): void {
    this.media.set(m.mediaId, { ...m });
  }

  listMediaForProduct(productId: ProductId): ProductMedia[] {
    return Array.from(this.media.values()).filter(m => m.productId === productId);
  }

  saveDocument(doc: ProductDocument): void {
    this.documents.set(doc.documentId, { ...doc });
  }

  listDocumentsForProduct(productId: ProductId): ProductDocument[] {
    return Array.from(this.documents.values()).filter(d => d.productId === productId);
  }

  saveModerationCase(mc: ProductModerationCase): void {
    this.moderationCases.set(mc.caseId, { ...mc });
  }

  getModerationCase(id: ProductModerationCaseId): ProductModerationCase | undefined {
    const m = this.moderationCases.get(id);
    return m ? { ...m } : undefined;
  }

  listModerationCases(): ProductModerationCase[] {
    return Array.from(this.moderationCases.values()).map(m => ({ ...m }));
  }

  // --- LISTINGS & PRICING ---
  saveListing(listing: SellerListing): void {
    this.listings.set(listing.listingId, { ...listing });
  }

  getListing(id: SellerListingId): SellerListing | undefined {
    const l = this.listings.get(id);
    return l ? { ...l } : undefined;
  }

  listListingsForSeller(sellerId: SellerId): SellerListing[] {
    return Array.from(this.listings.values()).filter(l => l.sellerId === sellerId);
  }

  listListingsForProduct(productId: ProductId): SellerListing[] {
    return Array.from(this.listings.values()).filter(l => l.productId === productId);
  }

  listListingsForSku(skuId: SkuId): SellerListing[] {
    return Array.from(this.listings.values()).filter(l => l.skuId === skuId);
  }

  listActiveListings(): SellerListing[] {
    return Array.from(this.listings.values()).filter(l => l.status === 'ACTIVE');
  }

  savePriceHistory(hist: ListingPriceHistory): void {
    this.priceHistories.set(hist.historyId, { ...hist });
  }

  listPriceHistoryForListing(listingId: SellerListingId): ListingPriceHistory[] {
    return Array.from(this.priceHistories.values()).filter(h => h.listingId === listingId);
  }

  // --- INVENTORY ---
  saveLocation(loc: InventoryLocation): void {
    this.locations.set(loc.locationId, { ...loc });
  }

  getLocation(id: InventoryLocationId): InventoryLocation | undefined {
    const l = this.locations.get(id);
    return l ? { ...l } : undefined;
  }

  listLocationsForSeller(sellerId: SellerId): InventoryLocation[] {
    return Array.from(this.locations.values()).filter(l => l.sellerId === sellerId && l.isActive);
  }

  saveInventoryItem(item: InventoryItem): void {
    // Automatically enforce availableToSell derivation
    const ats = Math.max(0, item.onHandQuantity - item.reservedQuantity);
    this.inventoryItems.set(item.inventoryItemId, {
      ...item,
      availableToSell: ats,
    });
  }

  getInventoryItem(id: InventoryItemId): InventoryItem | undefined {
    const i = this.inventoryItems.get(id);
    return i ? { ...i } : undefined;
  }

  getInventoryItemBySellerAndSku(sellerId: SellerId, skuId: SkuId): InventoryItem | undefined {
    return Array.from(this.inventoryItems.values()).find(
      i => i.sellerId === sellerId && i.skuId === skuId
    );
  }

  listInventoryItemsForSeller(sellerId: SellerId): InventoryItem[] {
    return Array.from(this.inventoryItems.values()).filter(i => i.sellerId === sellerId);
  }

  saveInventoryMovement(m: InventoryMovement): void {
    this.movements.set(m.movementId, { ...m });
  }

  listMovementsForSeller(sellerId: SellerId): InventoryMovement[] {
    return Array.from(this.movements.values())
      .filter(m => m.sellerId === sellerId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  saveReservation(res: InventoryReservation): void {
    this.reservations.set(res.reservationId, { ...res });
  }

  getReservation(id: InventoryReservationId): InventoryReservation | undefined {
    const r = this.reservations.get(id);
    return r ? { ...r } : undefined;
  }

  listReservationsForCheckout(checkoutId: CheckoutId): InventoryReservation[] {
    return Array.from(this.reservations.values()).filter(r => r.checkoutId === checkoutId);
  }

  listActiveReservations(): InventoryReservation[] {
    return Array.from(this.reservations.values()).filter(r => r.status === 'ACTIVE');
  }

  // --- CARTS & CHECKOUT ---
  saveCart(cart: ShoppingCart): void {
    this.carts.set(cart.cartId, { ...cart });
    this.userCartMap.set(cart.userId, cart.cartId);
  }

  getCart(cartId: CartId): ShoppingCart | undefined {
    const c = this.carts.get(cartId);
    return c ? { ...c } : undefined;
  }

  getCartByUserId(userId: UserId): ShoppingCart | undefined {
    const cartId = this.userCartMap.get(userId);
    if (!cartId) return undefined;
    return this.getCart(cartId);
  }

  saveCheckout(checkout: CommerceCheckout): void {
    this.checkouts.set(checkout.checkoutId, { ...checkout });
  }

  getCheckout(checkoutId: CheckoutId): CommerceCheckout | undefined {
    const c = this.checkouts.get(checkoutId);
    return c ? { ...c } : undefined;
  }

  // --- ORDERS & FULFILLMENT ---
  saveOrder(order: Order): void {
    this.orders.set(order.orderId, { ...order });
  }

  getOrder(orderId: OrderId): Order | undefined {
    const o = this.orders.get(orderId);
    return o ? { ...o } : undefined;
  }

  listOrdersForBuyer(userId: UserId): Order[] {
    return Array.from(this.orders.values())
      .filter(o => o.buyerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveSellerOrder(sellerOrder: SellerOrder): void {
    this.sellerOrders.set(sellerOrder.sellerOrderId, { ...sellerOrder });
  }

  getSellerOrder(id: SellerOrderId): SellerOrder | undefined {
    const s = this.sellerOrders.get(id);
    return s ? { ...s } : undefined;
  }

  listSellerOrdersForOrder(orderId: OrderId): SellerOrder[] {
    return Array.from(this.sellerOrders.values()).filter(s => s.orderId === orderId);
  }

  listSellerOrdersForSeller(sellerId: SellerId): SellerOrder[] {
    return Array.from(this.sellerOrders.values())
      .filter(s => s.sellerId === sellerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveFulfillment(f: Fulfillment): void {
    this.fulfillments.set(f.fulfillmentId, { ...f });
  }

  getFulfillment(id: FulfillmentId): Fulfillment | undefined {
    const f = this.fulfillments.get(id);
    return f ? { ...f } : undefined;
  }

  getFulfillmentForSellerOrder(sellerOrderId: SellerOrderId): Fulfillment | undefined {
    return Array.from(this.fulfillments.values()).find(f => f.sellerOrderId === sellerOrderId);
  }

  saveShipment(s: Shipment): void {
    this.shipments.set(s.shipmentId, { ...s });
  }

  getShipment(id: ShipmentId): Shipment | undefined {
    const s = this.shipments.get(id);
    return s ? { ...s } : undefined;
  }

  listShipmentsForSellerOrder(sellerOrderId: SellerOrderId): Shipment[] {
    return Array.from(this.shipments.values()).filter(s => s.sellerOrderId === sellerOrderId);
  }

  // --- RETURNS & DISPUTES ---
  saveReturnRequest(req: ReturnRequest): void {
    this.returnRequests.set(req.returnRequestId, { ...req });
  }

  getReturnRequest(id: ReturnRequestId): ReturnRequest | undefined {
    const r = this.returnRequests.get(id);
    return r ? { ...r } : undefined;
  }

  listReturnsForSeller(sellerId: SellerId): ReturnRequest[] {
    return Array.from(this.returnRequests.values())
      .filter(r => r.sellerId === sellerId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  listReturnsForBuyer(userId: UserId): ReturnRequest[] {
    return Array.from(this.returnRequests.values())
      .filter(r => r.buyerUserId === userId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }

  saveDispute(d: CommerceDispute): void {
    this.disputes.set(d.disputeId, { ...d });
  }

  getDispute(id: CommerceDisputeId): CommerceDispute | undefined {
    const d = this.disputes.get(id);
    return d ? { ...d } : undefined;
  }

  listDisputes(): CommerceDispute[] {
    return Array.from(this.disputes.values());
  }

  // --- SAFETY, RECALL & SUPPORT ---
  saveSafetyReport(rep: ProductSafetyReport): void {
    this.safetyReports.set(rep.reportId, { ...rep });
  }

  listSafetyReports(productId?: ProductId): ProductSafetyReport[] {
    let list = Array.from(this.safetyReports.values());
    if (productId) list = list.filter(r => r.productId === productId);
    return list;
  }

  saveRecallNotice(rec: ProductRecallNotice): void {
    this.recallNotices.set(rec.recallId, { ...rec });
  }

  getRecallNotice(id: ProductRecallNoticeId): ProductRecallNotice | undefined {
    const r = this.recallNotices.get(id);
    return r ? { ...r } : undefined;
  }

  listRecallNotices(): ProductRecallNotice[] {
    return Array.from(this.recallNotices.values());
  }

  saveSupportCase(sc: CommerceSupportCase): void {
    this.supportCases.set(sc.caseId, { ...sc });
  }

  listSupportCases(): CommerceSupportCase[] {
    return Array.from(this.supportCases.values());
  }

  // --- PUB/SUB ---
  publish(event: CommerceDomainEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Commerce event listener error:', err);
      }
    }
  }

  subscribe(listener: (event: CommerceDomainEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // --- RESET FOR TESTS ---
  reset(): void {
    this.sellers.clear();
    this.memberships.clear();
    this.verificationCases.clear();
    this.agreements.clear();
    this.payoutDestinations.clear();

    this.categories.clear();
    this.brands.clear();
    this.products.clear();
    this.variants.clear();
    this.skus.clear();
    this.media.clear();
    this.documents.clear();
    this.moderationCases.clear();

    this.listings.clear();
    this.priceHistories.clear();

    this.locations.clear();
    this.inventoryItems.clear();
    this.movements.clear();
    this.reservations.clear();

    this.carts.clear();
    this.userCartMap.clear();
    this.checkouts.clear();

    this.orders.clear();
    this.sellerOrders.clear();
    this.fulfillments.clear();
    this.shipments.clear();

    this.returnRequests.clear();
    this.disputes.clear();
    this.safetyReports.clear();
    this.recallNotices.clear();
    this.supportCases.clear();

    this.listeners = [];
  }
}
