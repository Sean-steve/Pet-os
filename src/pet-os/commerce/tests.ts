/**
 * Pet OS Sprint 27 - Marketplace Seller & Commerce Test Suite
 * Comprehensive automated verification covering all 28+ core domain requirements,
 * live-animal protection, prescription boundaries, inventory oversell prevention,
 * multi-seller splitting, immutable commission snapshots, returns, and privacy.
 */

import { CommerceStore } from './store';
import { CommerceService } from './service';
import { seedCommerceData, COMMERCE_SEED_IDS } from './seed';
import { Shipment } from './types';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { SEED_USERS, SEED_BUSINESSES } from '../provider/seed';
import {
  asSellerId,
  asProductCategoryId,
  asProductBrandId,
  asProductId,
  asSkuId,
  asSellerListingId,
  asInventoryLocationId,
  asOrderId,
  asSellerOrderId,
  asUserId,
  generateUUIDv7,
} from '../kernel/ids';

export interface TestResult {
  readonly id: string;
  readonly name: string;
  readonly category: 'SELLER' | 'CATALOGUE' | 'INVENTORY' | 'CHECKOUT' | 'ORDERS' | 'FULFILLMENT' | 'RETURNS' | 'SAFETY' | 'SECURITY';
  readonly passed: boolean;
  readonly message: string;
  readonly durationMs: number;
}

export class CommerceTestSuite {
  public static async runAllTests(): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  }> {
    const results: TestResult[] = [];

    const testCases: Array<{
      id: string;
      name: string;
      category: TestResult['category'];
      fn: () => Promise<void> | void;
    }> = [
      // 1. Seller Foundation & Provider Separation
      {
        id: 'COM-01',
        name: 'Seller Foundation: Identity & Distinct Separation from Service Provider',
        category: 'SELLER',
        fn: () => {
          const store = CommerceStore.getInstance();
          store.reset();
          seedCommerceData(store);

          const vetSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET);
          if (!vetSeller) throw new Error('Vet seller not found');

          // INVARIANT: Links to BusinessId but is a distinct SellerProfile
          if (vetSeller.businessId !== SEED_BUSINESSES.NAIROBI_WEST_VET) {
            throw new Error('Seller does not reference correct business ID');
          }
          if ((vetSeller as any).providerId) {
            throw new Error('SellerProfile must not contain ProviderId (Strict decoupling)!');
          }
        },
      },

      // 2. Seller Verification Guards
      {
        id: 'COM-02',
        name: 'Seller Verification: Client Cannot Self-Verify Without Review',
        category: 'SELLER',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          const newSellerId = asSellerId('sel-unverified-test');
          const seller = service.createSellerProfile({
            sellerId: newSellerId,
            sellerType: 'BUSINESS',
            primaryOwnerUserId: asUserId('usr-test-seller-1'),
            tradingName: 'Test Unverified Supplies',
            legalEntityName: 'Test Supplies Ltd',
            supportEmail: 'test@supplies.ke',
            supportPhone: '+254 700 123456',
          });

          if (seller.isVerified || seller.status === 'ACTIVE') {
            throw new Error('Newly created seller must be unverified and PENDING');
          }

          // Submit verification
          service.submitSellerVerification(newSellerId, asUserId('usr-test-seller-1'), ['doc-business-permit.pdf']);
          const updated = store.getSeller(newSellerId)!;
          if (updated.onboardingStatus !== 'UNDER_REVIEW' || updated.isVerified) {
            throw new Error('Seller must be UNDER_REVIEW and not yet verified');
          }

          // Admin reviews
          const caseRecord = store.listVerificationCases(newSellerId)[0];
          service.reviewSellerVerification(caseRecord.caseId, CANONICAL_IDS.ADMIN_CHARLES, true, 'Approved permit');
          const activeSeller = store.getSeller(newSellerId)!;
          if (!activeSeller.isVerified || activeSeller.status !== 'ACTIVE') {
            throw new Error('Seller was not activated after admin approval');
          }
        },
      },

      // 3. Seller Team RBAC & Payout Isolation
      {
        id: 'COM-03',
        name: 'Seller Team: RBAC Role Guards on Team Management',
        category: 'SELLER',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const sellerId = COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS;

          // Non-owner/non-admin attempts to invite team member
          let caught = false;
          try {
            service.addSellerTeamMember(
              sellerId,
              asUserId('usr-random-intruder'),
              asUserId('usr-new-staff'),
              'ORDER_MANAGER'
            );
          } catch (e: any) {
            caught = true;
          }
          if (!caught) throw new Error('Unauthorized user was allowed to add seller team member');

          // Owner succeeds
          service.addSellerTeamMember(
            sellerId,
            SEED_USERS.WALKER_SARAH,
            asUserId('usr-new-staff'),
            'ORDER_MANAGER'
          );
          const members = store.listMembershipsForSeller(sellerId);
          if (!members.some(m => m.userId === asUserId('usr-new-staff'))) {
            throw new Error('Team member was not added by owner');
          }
        },
      },

      // 4. Product Catalogue & Variants
      {
        id: 'COM-04',
        name: 'Product Catalogue: Product, Variants & SKU Structure',
        category: 'CATALOGUE',
        fn: () => {
          const store = CommerceStore.getInstance();
          const prod = store.getProduct(COMMERCE_SEED_IDS.PROD_GPS_CLIP);
          if (!prod) throw new Error('GPS Clip product not found');

          const variants = store.listVariantsForProduct(COMMERCE_SEED_IDS.PROD_GPS_CLIP);
          if (variants.length === 0) throw new Error('Product variants missing');

          const sku = store.getSku(variants[0].skuId);
          if (!sku || sku.skuCode !== 'PETOS-CLIP-01') {
            throw new Error('SKU code mismatch');
          }
        },
      },

      // 5. LIVE ANIMAL COMMERCE PROHIBITION (MANDATORY INVARIANT)
      {
        id: 'COM-05',
        name: 'Live Animal Commerce: Block Puppy/Kitten/Dog/Cat Sales as Ordinary SKUs',
        category: 'SAFETY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          let puppyBlocked = false;
          try {
            service.createProduct({
              productId: asProductId('prd-illegal-puppy'),
              categoryId: COMMERCE_SEED_IDS.CAT_TOYS,
              brandId: COMMERCE_SEED_IDS.BRAND_SAFARI_PAWS,
              title: 'Purebred Golden Retriever Puppy for Sale',
              description: 'Healthy 8-week-old puppy with initial shots.',
              shortDescription: 'Golden retriever puppy.',
              speciesApplicability: 'DOG',
              lifeStageApplicability: 'PUPPY_KITTEN',
              attributes: [],
              actorUserId: SEED_USERS.TRAINER_JUMA,
            });
          } catch (err: any) {
            if (err.message.includes('LIVE ANIMAL COMMERCE PROHIBITED')) {
              puppyBlocked = true;
            }
          }
          if (!puppyBlocked) {
            throw new Error('Live animal puppy product was not blocked! Welfare boundary violated.');
          }

          let kittenBlocked = false;
          try {
            service.createProduct({
              productId: asProductId('prd-illegal-kitten'),
              categoryId: COMMERCE_SEED_IDS.CAT_TOYS,
              brandId: COMMERCE_SEED_IDS.BRAND_SAFARI_PAWS,
              title: 'Siamese Kitten for Adoption with Fee',
              description: 'Cute playful kittens ready for home delivery.',
              shortDescription: 'Playful kittens.',
              speciesApplicability: 'CAT',
              lifeStageApplicability: 'PUPPY_KITTEN',
              attributes: [],
              actorUserId: SEED_USERS.TRAINER_JUMA,
            });
          } catch (err: any) {
            if (err.message.includes('LIVE ANIMAL COMMERCE PROHIBITED')) {
              kittenBlocked = true;
            }
          }
          if (!kittenBlocked) {
            throw new Error('Live animal kitten product was not blocked! Welfare boundary violated.');
          }
        },
      },

      // 6. Prescription Medicine Boundary
      {
        id: 'COM-06',
        name: 'Prescription Boundary: Open Marketplace Sale of Prescription Drugs Blocked',
        category: 'SAFETY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          let blocked = false;
          try {
            service.createProduct({
              productId: asProductId('prd-unauthorized-rx'),
              categoryId: COMMERCE_SEED_IDS.CAT_TREATS,
              brandId: COMMERCE_SEED_IDS.BRAND_VETCARE_PRO,
              title: 'Apoquel 16mg Allergy Tablets - 100 Pack (Veterinary Prescription)',
              description: 'Fast acting treatment for allergic dermatitis in dogs. Prescription medication.',
              shortDescription: 'Apoquel 16mg prescription.',
              speciesApplicability: 'DOG',
              lifeStageApplicability: 'ADULT',
              attributes: [],
              actorUserId: SEED_USERS.TRAINER_JUMA,
            });
          } catch (err: any) {
            if (err.message.includes('RESTRICTED PRESCRIPTION PRODUCT')) {
              blocked = true;
            }
          }
          if (!blocked) {
            throw new Error('Restricted prescription medication was not blocked from open marketplace listing');
          }
        },
      },

      // 7. First-Party vs Third-Party Commerce
      {
        id: 'COM-07',
        name: 'First-Party vs Third-Party: Distinct Ownership & Commission Rates',
        category: 'CATALOGUE',
        fn: () => {
          const store = CommerceStore.getInstance();
          const fpSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_PETOS_1P);
          const tpSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET);

          if (!fpSeller?.isFirstParty) throw new Error('Pet OS store must be isFirstParty=true');
          if (tpSeller?.isFirstParty) throw new Error('Nairobi West Vet must be isFirstParty=false');
        },
      },

      // 8. Seller Listing & Exact-Money Pricing
      {
        id: 'COM-08',
        name: 'Seller Listings: Exact-Money Minor Units & Price History Audit',
        category: 'CATALOGUE',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const listing = store.getListing(COMMERCE_SEED_IDS.LISTING_GPS_CLIP_1P);
          if (!listing) throw new Error('Listing not found');

          if (listing.priceMinor !== 150000 || listing.currency !== 'KES') {
            throw new Error('Listing price minor units mismatch');
          }

          // Update price and verify auditable history
          service.updateListingPrice(
            listing.listingId,
            165000,
            CANONICAL_IDS.ADMIN_CHARLES,
            'Annual supply chain inflation adjustment'
          );

          const updated = store.getListing(listing.listingId)!;
          if (updated.priceMinor !== 165000) throw new Error('Price was not updated');

          const history = store.listPriceHistoryForListing(listing.listingId);
          if (history.length === 0 || history[0].previousPriceMinor !== 150000) {
            throw new Error('Price history audit record missing or incorrect');
          }
        },
      },

      // 9. Inventory Locations & Movement Ledger
      {
        id: 'COM-09',
        name: 'Inventory: Locations, Stock On-Hand & Movement History',
        category: 'INVENTORY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const item = store.getInventoryItemBySellerAndSku(
            COMMERCE_SEED_IDS.SELLER_PETOS_1P,
            COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD
          );
          if (!item) throw new Error('Inventory item not found');

          const movements = store.listMovementsForSeller(COMMERCE_SEED_IDS.SELLER_PETOS_1P);
          if (movements.length === 0) throw new Error('Inventory movement audit history empty');
        },
      },

      // 10. Concurrency-Safe Inventory Reservation & Oversell Prevention
      {
        id: 'COM-10',
        name: 'Oversell Prevention: Atomic Reservation & Last-Unit Concurrency',
        category: 'INVENTORY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          // Create an isolated SKU with exactly 1 unit
          const prodId = asProductId('prd-last-unit-test');
          const skuId = asSkuId('sku-last-unit-test');
          const listingId = asSellerListingId('lst-last-unit-test');

          service.createProduct({
            productId: prodId,
            categoryId: COMMERCE_SEED_IDS.CAT_TOYS,
            brandId: COMMERCE_SEED_IDS.BRAND_K9_ESSENTIALS,
            title: 'Limited Edition Agility Whistle',
            description: 'Collector edition titanium agility whistle.',
            shortDescription: 'Titanium whistle.',
            speciesApplicability: 'DOG',
            lifeStageApplicability: 'ALL_STAGES',
            attributes: [],
            isFirstParty: true,
            actorUserId: CANONICAL_IDS.ADMIN_CHARLES,
          });
          service.createProductVariant({
            productId: prodId,
            skuId,
            skuCode: 'WHISTLE-01',
            variantTitle: 'Titanium',
            options: { material: 'Titanium' },
          });
          service.createSellerListing({
            listingId,
            sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
            productId: prodId,
            skuId,
            priceMinor: 200000,
            currency: 'KES',
            fulfillmentMethods: ['THIRD_PARTY_COURIER'],
            shippingProfileId: 'shp-standard',
          });

          // Stock exactly 1 unit
          service.receiveInventory({
            sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
            skuId,
            locationId: COMMERCE_SEED_IDS.LOC_PETOS_HQ,
            quantity: 1,
            actorUserId: CANONICAL_IDS.ADMIN_CHARLES,
            reason: 'Rare batch of 1',
          });

          // Buyer A adds to cart and starts checkout
          const cartA = service.getOrCreateCart(CANONICAL_IDS.CAREGIVER_SEAN);
          service.addItemToCart(cartA.cartId, listingId, 1);
          const checkoutA = service.createCheckout({
            cartId: cartA.cartId,
            buyerUserId: CANONICAL_IDS.CAREGIVER_SEAN,
            deliveryAddress: {
              recipientName: 'Sean Caregiver',
              recipientPhone: '+254 722 000102',
              streetLine1: 'Lavington Green',
              city: 'Nairobi',
              countyOrState: 'Nairobi County',
              country: 'KE',
              maskedAddressSummary: 'Lavington, Nairobi',
            },
            deliveryMethod: 'THIRD_PARTY_COURIER',
          });

          if (!checkoutA || checkoutA.reservationIds.length === 0) {
            throw new Error('Buyer A checkout reservation failed');
          }

          // Buyer B attempts to checkout the same last unit concurrently
          const cartB = service.getOrCreateCart(CANONICAL_IDS.MEMBER_AMINA);
          service.addItemToCart(cartB.cartId, listingId, 1);

          let oversellPrevented = false;
          try {
            service.createCheckout({
              cartId: cartB.cartId,
              buyerUserId: CANONICAL_IDS.MEMBER_AMINA,
              deliveryAddress: {
                recipientName: 'Amina Member',
                recipientPhone: '+254 733 000103',
                streetLine1: 'Westlands',
                city: 'Nairobi',
                countyOrState: 'Nairobi County',
                country: 'KE',
                maskedAddressSummary: 'Westlands, Nairobi',
              },
              deliveryMethod: 'THIRD_PARTY_COURIER',
            });
          } catch (err: any) {
            if (err.message.includes('INSUFFICIENT_STOCK')) {
              oversellPrevented = true;
            }
          }

          if (!oversellPrevented) {
            throw new Error('OVERSELL BUG: Buyer B was permitted to reserve stock when 0 units were available!');
          }

          // Verify inventory Available-To-Sell is exactly 0 and never negative
          const invItem = store.getInventoryItemBySellerAndSku(COMMERCE_SEED_IDS.SELLER_PETOS_1P, skuId)!;
          if (invItem.availableToSell !== 0 || invItem.reservedQuantity !== 1) {
            throw new Error(`Inventory state corrupted: ATS=${invItem.availableToSell}, reserved=${invItem.reservedQuantity}`);
          }
        },
      },

      // 11. Reservation Expiry & Auto-Release
      {
        id: 'COM-11',
        name: 'Reservation Expiry: Expired Checkouts Auto-Release Reserved Quantity',
        category: 'INVENTORY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const skuId = asSkuId('sku-last-unit-test');
          const invItem = store.getInventoryItemBySellerAndSku(COMMERCE_SEED_IDS.SELLER_PETOS_1P, skuId)!;

          // Find the active reservation on this item
          const res = store.listActiveReservations().find(r => r.skuId === skuId);
          if (!res) throw new Error('Active reservation not found');

          // Force expiration timestamp into the past
          res.expiresAt = new Date(Date.now() - 60000).toISOString();
          store.saveReservation(res);

          // Trigger release
          const releasedCount = service.releaseExpiredReservations();
          if (releasedCount === 0) throw new Error('No expired reservations were released');

          const updatedInv = store.getInventoryItem(invItem.inventoryItemId)!;
          if (updatedInv.availableToSell !== 1 || updatedInv.reservedQuantity !== 0) {
            throw new Error(`Stock not restored after reservation expiry: ATS=${updatedInv.availableToSell}`);
          }
        },
      },

      // 12. Multi-Seller Shopping Cart
      {
        id: 'COM-12',
        name: 'Shopping Cart: Multi-Seller Cart Composition & Quantity Updates',
        category: 'CHECKOUT',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          const cart = service.getOrCreateCart(asUserId('usr-cart-tester'));
          service.addItemToCart(cart.cartId, COMMERCE_SEED_IDS.LISTING_GPS_CLIP_1P, 2);
          service.addItemToCart(cart.cartId, COMMERCE_SEED_IDS.LISTING_KIBBLE_VET, 1);

          const updatedCart = store.getCart(cart.cartId)!;
          if (updatedCart.items.length !== 2) throw new Error('Cart does not contain 2 items');

          // Update quantity
          const item1 = updatedCart.items[0];
          service.updateCartItemQuantity(cart.cartId, item1.cartItemId, 3);
          const cartAfterUpdate = store.getCart(cart.cartId)!;
          if (cartAfterUpdate.items[0].quantity !== 3) {
            throw new Error('Quantity was not updated in cart');
          }
        },
      },

      // 13. Server-Authoritative Checkout Totals
      {
        id: 'COM-13',
        name: 'Checkout Integrity: Server-Authoritative Recalculation (Client Totals Ignored)',
        category: 'CHECKOUT',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          const cart = service.getOrCreateCart(asUserId('usr-cart-tester'));
          const checkout = service.createCheckout({
            cartId: cart.cartId,
            buyerUserId: asUserId('usr-cart-tester'),
            deliveryAddress: {
              recipientName: 'Tester User',
              recipientPhone: '+254 700 999888',
              streetLine1: 'Riverside Drive',
              city: 'Nairobi',
              countyOrState: 'Nairobi County',
              country: 'KE',
              maskedAddressSummary: 'Riverside, Nairobi',
            },
            deliveryMethod: 'THIRD_PARTY_COURIER',
          });

          // Verify exact server-calculated total
          // Listing 1: KES 1,650 x 3 = 495000 + 35000 shipping = 530000
          // Listing 2: KES 7,800 x 1 = 780000 + 35000 shipping = 815000
          // Grand total = 1,345,000 minor
          if (checkout.snapshot.itemsSubtotalMinor !== 495000 + 780000) {
            throw new Error(`Subtotal mismatch: got ${checkout.snapshot.itemsSubtotalMinor}`);
          }
          if (checkout.snapshot.shippingTotalMinor !== 70000) {
            throw new Error(`Shipping total mismatch: got ${checkout.snapshot.shippingTotalMinor}`);
          }
          if (checkout.snapshot.grandTotalMinor !== 1345000) {
            throw new Error(`Grand total mismatch: got ${checkout.snapshot.grandTotalMinor}`);
          }
        },
      },

      // 14. Delivery Address Privacy
      {
        id: 'COM-14',
        name: 'Address Privacy: Sanitized Masked Summary for Public/General Projections',
        category: 'SECURITY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          if (orders.length === 0) throw new Error('Elena seed order not found');

          const order = orders[0];
          if (!order.deliveryAddress.maskedAddressSummary) {
            throw new Error('Masked address summary must be present for privacy');
          }
          if (order.deliveryAddress.maskedAddressSummary.includes('+254')) {
            throw new Error('Masked address summary must not leak raw phone numbers');
          }
        },
      },

      // 15. Multi-Seller Order Splitting & Isolation
      {
        id: 'COM-15',
        name: 'Order Splitting: 1 Buyer Order Splits into N Isolated SellerOrders',
        category: 'ORDERS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const order = orders[0];

          const sellerOrders = store.listSellerOrdersForOrder(order.orderId);
          if (sellerOrders.length !== 2) {
            throw new Error(`Elena multi-seller order must have 2 SellerOrders, found ${sellerOrders.length}`);
          }

          // Verify each SellerOrder belongs to distinct seller
          const s1 = sellerOrders[0].sellerId;
          const s2 = sellerOrders[1].sellerId;
          if (s1 === s2) throw new Error('SellerOrders must belong to different sellers');
        },
      },

      // 16. Immutable Commission Snapshot
      {
        id: 'COM-16',
        name: 'Marketplace Commission: Immutable Snapshot Captured at Purchase',
        category: 'ORDERS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const sellerOrders = store.listSellerOrdersForOrder(orders[0].orderId);

          const tpOrder = sellerOrders.find(so => so.sellerId === COMMERCE_SEED_IDS.SELLER_NAIROBI_VET);
          if (!tpOrder) throw new Error('Nairobi vet seller order not found');

          const snap = tpOrder.commissionSnapshot;
          if (!snap || snap.ratePercentage !== 10) {
            throw new Error('3P SellerOrder must have 10% marketplace commission snapshot');
          }

          const expectedCommission = Math.round(tpOrder.sellerGrossMinor * 0.10);
          if (snap.commissionAmountMinor !== expectedCommission) {
            throw new Error(`Commission calculation mismatch: got ${snap.commissionAmountMinor}, expected ${expectedCommission}`);
          }

          // Net must equal gross minus commission
          if (snap.sellerNetAmountMinor !== tpOrder.sellerGrossMinor - snap.commissionAmountMinor) {
            throw new Error('Seller net amount does not balance with gross and commission');
          }
        },
      },

      // 17. Fulfillment & Delivery Execution
      {
        id: 'COM-17',
        name: 'Fulfillment Execution: Packing, Carrier Dispatch & Delivery Evidence',
        category: 'FULFILLMENT',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const sellerOrders = store.listSellerOrdersForOrder(orders[0].orderId);

          const vetOrder = sellerOrders.find(so => so.sellerId === COMMERCE_SEED_IDS.SELLER_NAIROBI_VET)!;

          // Dispatch shipment
          const shipment = service.shipSellerOrder({
            sellerOrderId: vetOrder.sellerOrderId,
            carrierName: 'G4S Logistics',
            sellerUserId: SEED_USERS.VET_DR_KIMANI,
          });

          if (!shipment.trackingNumber || shipment.status !== 'IN_TRANSIT') {
            throw new Error('Shipment tracking number missing or invalid status');
          }

          // Deliver with proof
          service.deliverShipment({
            shipmentId: shipment.shipmentId,
            evidenceType: 'CARRIER_CONFIRMATION',
            evidenceData: 'Delivered to recipient gate',
            actorUserId: SEED_USERS.VET_DR_KIMANI,
          });

          const updatedShipment = store.getShipment(shipment.shipmentId)!;
          if (updatedShipment.status !== 'DELIVERED' || !updatedShipment.deliveryEvidence) {
            throw new Error('Shipment was not marked delivered with delivery evidence');
          }

          const updatedVetOrder = store.getSellerOrder(vetOrder.sellerOrderId)!;
          if (updatedVetOrder.status !== 'DELIVERED') {
            throw new Error('SellerOrder status not updated to DELIVERED');
          }
        },
      },

      // 18. Logistics Separation from Pet Tracking
      {
        id: 'COM-18',
        name: 'Pet Tracking Boundary: Parcel Logistics Strictly Decoupled from GPS Collar Tracking',
        category: 'FULFILLMENT',
        fn: () => {
          const store = CommerceStore.getInstance();
          const shipments = Array.from((store as any).shipments.values()) as Shipment[];
          for (const s of shipments) {
            // INVARIANT: Shipment records must contain carrier tracking number, NOT DeviceId or GPS session
            if ((s as any).deviceId || (s as any).trackingSessionId) {
              throw new Error('Shipment record illegally references Pet Tracking DeviceId/SessionId!');
            }
          }
        },
      },

      // 19. In-Person Pickup & Verification Code
      {
        id: 'COM-19',
        name: 'In-Person Pickup: Secure Verification Token Required for Handover',
        category: 'FULFILLMENT',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          // Create a pickup checkout
          const cart = service.getOrCreateCart(asUserId('usr-pickup-buyer'));
          service.addItemToCart(cart.cartId, COMMERCE_SEED_IDS.LISTING_HARNESS_APEX, 1);
          const checkout = service.createCheckout({
            cartId: cart.cartId,
            buyerUserId: asUserId('usr-pickup-buyer'),
            deliveryAddress: {
              recipientName: 'Pickup Buyer',
              recipientPhone: '+254 700 112233',
              streetLine1: 'Store Pickup Location',
              city: 'Nairobi',
              countyOrState: 'Nairobi',
              country: 'KE',
              maskedAddressSummary: 'Store Pickup',
            },
            deliveryMethod: 'PICKUP',
          });

          const order = service.confirmOrderPayment(checkout.checkoutId);
          const sellerOrder = store.listSellerOrdersForOrder(order.orderId)[0];

          service.acceptSellerOrder(sellerOrder.sellerOrderId, SEED_USERS.TRAINER_JUMA);
          service.packSellerOrder(sellerOrder.sellerOrderId, SEED_USERS.TRAINER_JUMA);
          const shipment = service.shipSellerOrder({
            sellerOrderId: sellerOrder.sellerOrderId,
            carrierName: 'Store Pickup Desk',
            sellerUserId: SEED_USERS.TRAINER_JUMA,
            isPickup: true,
          });

          if (!shipment.pickupVerificationCode || !shipment.pickupVerificationCode.startsWith('PU-')) {
            throw new Error('Pickup verification code was not generated');
          }

          // Wrong code fails
          let failed = false;
          try {
            service.verifyPickupAndRelease(shipment.shipmentId, 'PU-000000', SEED_USERS.TRAINER_JUMA);
          } catch (e: any) {
            failed = true;
          }
          if (!failed) throw new Error('Invalid pickup code was accepted');

          // Correct code succeeds
          service.verifyPickupAndRelease(shipment.shipmentId, shipment.pickupVerificationCode, SEED_USERS.TRAINER_JUMA);
          const deliveredShipment = store.getShipment(shipment.shipmentId)!;
          if (deliveredShipment.status !== 'DELIVERED') {
            throw new Error('Shipment not marked delivered after pickup verification');
          }
        },
      },

      // 20. Order Cancellation & Inventory Restock
      {
        id: 'COM-20',
        name: 'Cancellation: Pre-Shipment Cancellation Restores Inventory',
        category: 'ORDERS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          const cart = service.getOrCreateCart(asUserId('usr-cancel-buyer'));
          service.addItemToCart(cart.cartId, COMMERCE_SEED_IDS.LISTING_BED_HAPPY_PAWS, 1);
          const checkout = service.createCheckout({
            cartId: cart.cartId,
            buyerUserId: asUserId('usr-cancel-buyer'),
            deliveryAddress: {
              recipientName: 'Cancel Buyer',
              recipientPhone: '+254 700 445566',
              streetLine1: 'Kileleshwa',
              city: 'Nairobi',
              countyOrState: 'Nairobi',
              country: 'KE',
              maskedAddressSummary: 'Kileleshwa, Nairobi',
            },
            deliveryMethod: 'THIRD_PARTY_COURIER',
          });

          const order = service.confirmOrderPayment(checkout.checkoutId);
          const invBefore = store.getInventoryItemBySellerAndSku(
            COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
            COMMERCE_SEED_IDS.SKU_BED_LARGE
          )!;
          const onHandBefore = invBefore.onHandQuantity;

          // Buyer cancels order
          service.cancelOrder(order.orderId, asUserId('usr-cancel-buyer'), 'Changed my mind');

          const updatedOrder = store.getOrder(order.orderId)!;
          if (updatedOrder.status !== 'CANCELLED') throw new Error('Order not cancelled');

          const invAfter = store.getInventoryItemBySellerAndSku(
            COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
            COMMERCE_SEED_IDS.SKU_BED_LARGE
          )!;
          if (invAfter.onHandQuantity !== onHandBefore + 1) {
            throw new Error(`Inventory not restored after cancellation (expected ${onHandBefore + 1}, got ${invAfter.onHandQuantity})`);
          }
        },
      },

      // 21. Returns & Factual Inspection with Inventory Disposition
      {
        id: 'COM-21',
        name: 'Returns: Factual Inspection & Disposition Controls',
        category: 'RETURNS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const petosOrder = store.listSellerOrdersForOrder(orders[0].orderId).find(
            so => so.sellerId === COMMERCE_SEED_IDS.SELLER_PETOS_1P
          )!;

          // Elena requests return for GPS clip
          const returnReq = service.requestReturn({
            orderId: orders[0].orderId,
            sellerOrderId: petosOrder.sellerOrderId,
            buyerUserId: CANONICAL_IDS.OWNER_ELENA,
            items: [
              {
                orderItemId: petosOrder.items[0].orderItemId,
                skuId: petosOrder.items[0].skuId,
                quantity: 1,
                reason: 'DEFECTIVE',
                notes: 'Clip latch is stiff',
              },
            ],
            evidenceUrls: ['https://petos.internal/evidence/clip.jpg'],
          });

          if (!returnReq || returnReq.status !== 'REQUESTED') {
            throw new Error('Return request not created');
          }

          // Seller reviews and approves return
          service.reviewReturnRequest(returnReq.returnRequestId, CANONICAL_IDS.ADMIN_CHARLES, true);
          const approvedReq = store.getReturnRequest(returnReq.returnRequestId)!;
          if (approvedReq.status !== 'APPROVED') throw new Error('Return not approved');

          // Warehouse inspects: item is defective/damaged, disposition = QUARANTINED (MUST NOT restock to sellable!)
          const invBefore = store.getInventoryItemBySellerAndSku(
            COMMERCE_SEED_IDS.SELLER_PETOS_1P,
            COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD
          )!;
          const onHandBefore = invBefore.onHandQuantity;

          service.recordReturnInspection({
            returnRequestId: returnReq.returnRequestId,
            inspectorUserId: CANONICAL_IDS.ADMIN_CHARLES,
            conditionRating: 'DAMAGED',
            findings: 'Latch spring misaligned. Unsellable.',
            disposition: 'QUARANTINED',
            recommendedRefundMinor: 150000,
          });

          const inspectedReq = store.getReturnRequest(returnReq.returnRequestId)!;
          if (inspectedReq.status !== 'REFUND_APPROVED') {
            throw new Error('Return request not in REFUND_APPROVED status');
          }

          // Verify damaged return was NOT added back to sellable stock
          const invAfter = store.getInventoryItemBySellerAndSku(
            COMMERCE_SEED_IDS.SELLER_PETOS_1P,
            COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD
          )!;
          if (invAfter.onHandQuantity !== onHandBefore) {
            throw new Error('Damaged returned item was erroneously added to sellable stock!');
          }
        },
      },

      // 22. Refund Idempotency
      {
        id: 'COM-22',
        name: 'Refund Idempotency: Duplicate Refund Execution Prevented',
        category: 'RETURNS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const returnReq = store.listReturnsForBuyer(CANONICAL_IDS.OWNER_ELENA)[0];

          // First refund execution
          service.executeReturnRefund(returnReq.returnRequestId, CANONICAL_IDS.ADMIN_CHARLES);
          const refunded = store.getReturnRequest(returnReq.returnRequestId)!;
          if (refunded.status !== 'REFUNDED' || !refunded.refundId) {
            throw new Error('Return was not marked REFUNDED with refundId');
          }

          const originalRefundId = refunded.refundId;

          // Second attempt (idempotency check)
          service.executeReturnRefund(returnReq.returnRequestId, CANONICAL_IDS.ADMIN_CHARLES);
          const refundedAgain = store.getReturnRequest(returnReq.returnRequestId)!;
          if (refundedAgain.refundId !== originalRefundId) {
            throw new Error('IDEMPOTENCY FAILURE: Duplicate refund ID created on repeated execution');
          }
        },
      },

      // 23. Non-Returnable Category Enforcement
      {
        id: 'COM-23',
        name: 'Return Policy: Non-Returnable Category Enforced (Safety Exception Bypasses)',
        category: 'RETURNS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const vetOrder = store.listSellerOrdersForOrder(orders[0].orderId).find(
            so => so.sellerId === COMMERCE_SEED_IDS.SELLER_NAIROBI_VET
          )!;

          // Attempt normal "buyer changed mind" on pet food (which is non-returnable by default)
          let foodBlocked = false;
          try {
            service.requestReturn({
              orderId: orders[0].orderId,
              sellerOrderId: vetOrder.sellerOrderId,
              buyerUserId: CANONICAL_IDS.OWNER_ELENA,
              items: [
                {
                  orderItemId: vetOrder.items[0].orderItemId,
                  skuId: vetOrder.items[0].skuId,
                  quantity: 1,
                  reason: 'BUYER_CHANGED_MIND',
                  notes: 'No longer need kibble',
                },
              ],
            });
          } catch (e: any) {
            if (e.message.includes('INELIGIBLE_FOR_RETURN')) {
              foodBlocked = true;
            }
          }
          if (!foodBlocked) {
            throw new Error('Pet food category should not be eligible for standard buyer-remorse returns');
          }

          // Safety concern reason MUST bypass and be accepted for inspection
          const safetyReq = service.requestReturn({
            orderId: orders[0].orderId,
            sellerOrderId: vetOrder.sellerOrderId,
            buyerUserId: CANONICAL_IDS.OWNER_ELENA,
            items: [
              {
                orderItemId: vetOrder.items[0].orderItemId,
                skuId: vetOrder.items[0].skuId,
                quantity: 1,
                reason: 'SAFETY_CONCERN',
                notes: 'Foreign object found in kibble sack',
              },
            ],
            evidenceUrls: ['https://petos.internal/evidence/kibble-issue.jpg'],
          });

          if (!safetyReq.isSafetyException || safetyReq.status !== 'REQUESTED') {
            throw new Error('Safety concern return was not accepted as a safety exception');
          }
        },
      },

      // 24. Product Safety Reporting & Auto-Pause
      {
        id: 'COM-24',
        name: 'Product Safety: Critical Safety Reports Auto-Pause Active Listings',
        category: 'SAFETY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          // Report critical safety report on harness
          const listingBefore = store.getListing(COMMERCE_SEED_IDS.LISTING_HARNESS_APEX)!;
          if (listingBefore.status !== 'ACTIVE') throw new Error('Listing must be active before test');

          service.reportProductSafety({
            productId: COMMERCE_SEED_IDS.PROD_TACTICAL_HARNESS,
            reportedByUserId: CANONICAL_IDS.OWNER_ELENA,
            incidentDescription: 'Chest ring snapped under sudden pull during walk',
            severity: 'CRITICAL',
          });

          const listingAfter = store.getListing(COMMERCE_SEED_IDS.LISTING_HARNESS_APEX)!;
          if (listingAfter.status !== 'PAUSED') {
            throw new Error('Active listing was not automatically paused after critical safety report!');
          }
        },
      },

      // 25. Pet Health & Nutrition Privacy
      {
        id: 'COM-25',
        name: 'Pet Privacy: Sellers Never Receive Medical/Allergy or GPS Tracking Data',
        category: 'SECURITY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const sellerOrders = store.listSellerOrdersForSeller(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET);
          for (const so of sellerOrders) {
            // INVARIANT: SellerOrder must never contain Pet health records, allergy notes, or tracking coordinates!
            if ((so as any).petAllergies || (so as any).medicalHistory || (so as any).gpsCoordinates) {
              throw new Error('PRIVACY VIOLATION: Private pet health/GPS data leaked to SellerOrder!');
            }
          }
        },
      },

      // 26. Cross-Seller Isolation (IDOR Defense)
      {
        id: 'COM-26',
        name: 'Cross-Seller Isolation: Seller A Cannot Inspect Seller B SellerOrder (IDOR Guard)',
        category: 'SECURITY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
          const sellerOrders = store.listSellerOrdersForOrder(orders[0].orderId);

          const petosOrder = sellerOrders.find(so => so.sellerId === COMMERCE_SEED_IDS.SELLER_PETOS_1P)!;
          const vetSellerId = COMMERCE_SEED_IDS.SELLER_NAIROBI_VET;

          let idorBlocked = false;
          try {
            service.getSellerOrderForSeller(petosOrder.sellerOrderId, vetSellerId);
          } catch (e: any) {
            if (e.message.includes('ACCESS_DENIED')) {
              idorBlocked = true;
            }
          }

          if (!idorBlocked) {
            throw new Error('IDOR VULNERABILITY: Seller B was able to view Seller A order!');
          }
        },
      },

      // 27. Cross-Buyer Isolation (IDOR Defense)
      {
        id: 'COM-27',
        name: 'Cross-Buyer Isolation: Buyer A Cannot Inspect Buyer B Order (IDOR Guard)',
        category: 'SECURITY',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);
          const elenaOrder = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA)[0];

          let idorBlocked = false;
          try {
            service.getOrderForBuyer(elenaOrder.orderId, asUserId('usr-intruder-buyer'));
          } catch (e: any) {
            if (e.message.includes('ACCESS_DENIED')) {
              idorBlocked = true;
            }
          }

          if (!idorBlocked) {
            throw new Error('IDOR VULNERABILITY: Buyer B was able to access Buyer A order details!');
          }
        },
      },

      // 28. Financial & Inventory Reconciliation Audit
      {
        id: 'COM-28',
        name: 'Commerce Reconciliation: Audit Verifies Non-Negative Stock & Commission Balance',
        category: 'ORDERS',
        fn: () => {
          const store = CommerceStore.getInstance();
          const service = new CommerceService(store);

          const recon = service.runCommerceReconciliation();
          if (!recon.inventoryIntegrityPassed) {
            throw new Error(`Inventory integrity audit failed: ${recon.errorsDetected.join(', ')}`);
          }
          if (!recon.commissionMathBalanced) {
            throw new Error('Commission math reconciliation failed');
          }
        },
      },
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const tc of testCases) {
      const start = performance.now();
      try {
        await tc.fn();
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: true,
          message: 'Passed',
          durationMs,
        });
        passedCount++;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - start);
        results.push({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          passed: false,
          message: err?.message || 'Failed with unknown error',
          durationMs,
        });
        failedCount++;
      }
    }

    return {
      passed: passedCount,
      failed: failedCount,
      total: testCases.length,
      results,
    };
  }
}
