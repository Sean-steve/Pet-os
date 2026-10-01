/**
 * Pet OS Sprint 27 - Marketplace Commerce Seed Data
 * Sets up canonical sellers (First-party Pet OS Store + vetted 3P sellers),
 * product categories, brands, variants, SKUs, inventory locations, stock items,
 * active listings, realistic orders, fulfillments, shipments, and returns.
 */

import {
  SellerId,
  ProductCategoryId,
  ProductBrandId,
  ProductId,
  SkuId,
  SellerListingId,
  InventoryLocationId,
  OrderId,
  SellerOrderId,
  ShipmentId,
  ReturnRequestId,
  generateUUIDv7,
} from '../kernel/ids';
import { CommerceStore } from './store';
import { SEED_USERS, SEED_BUSINESSES } from '../provider/seed';
import { CANONICAL_IDS } from '../seed/unified-seed';
import { CommerceService } from './service';

export const COMMERCE_SEED_IDS = {
  // Sellers
  SELLER_PETOS_1P: 'sel-petos-store-1p' as SellerId,
  SELLER_NAIROBI_VET: 'sel-nairobi-west-vet' as SellerId,
  SELLER_HAPPY_PAWS: 'sel-happy-paws-walkers' as SellerId,
  SELLER_APEX_K9: 'sel-apex-k9-academy' as SellerId,

  // Categories
  CAT_FOOD: 'cat-dog-cat-food' as ProductCategoryId,
  CAT_TREATS: 'cat-natural-treats' as ProductCategoryId,
  CAT_FEEDERS: 'cat-bowls-feeders' as ProductCategoryId,
  CAT_BEDS: 'cat-orthopedic-beds' as ProductCategoryId,
  CAT_COLLARS_LEADS: 'cat-collars-leads' as ProductCategoryId,
  CAT_TOYS: 'cat-enrichment-toys' as ProductCategoryId,
  CAT_GROOMING: 'cat-hygiene-grooming' as ProductCategoryId,
  CAT_TRACKING_ACC: 'cat-tracking-accessories' as ProductCategoryId,

  // Brands
  BRAND_PETOS: 'brd-petos-official' as ProductBrandId,
  BRAND_K9_ESSENTIALS: 'brd-k9-essentials' as ProductBrandId,
  BRAND_SAFARI_PAWS: 'brd-safari-paws' as ProductBrandId,
  BRAND_VETCARE_PRO: 'brd-vetcare-pro' as ProductBrandId,

  // Products
  PROD_GPS_CLIP: 'prd-gps-collar-clip' as ProductId,
  PROD_PREMIUM_KIBBLE: 'prd-safari-lamb-kibble' as ProductId,
  PROD_ORTHO_BED: 'prd-ortho-comfort-bed' as ProductId,
  PROD_TACTICAL_HARNESS: 'prd-apex-tactical-harness' as ProductId,
  PROD_CALMING_CHEWS: 'prd-vetcare-calming-chews' as ProductId,
  PROD_ROPE_TOY: 'prd-k9-braided-rope-toy' as ProductId,

  // SKUs
  SKU_GPS_CLIP_STD: 'sku-gps-clip-std' as SkuId,
  SKU_KIBBLE_15KG: 'sku-safari-lamb-15kg' as SkuId,
  SKU_BED_LARGE: 'sku-ortho-bed-large' as SkuId,
  SKU_HARNESS_MED: 'sku-apex-harness-med' as SkuId,
  SKU_CHEWS_60CT: 'sku-vetcare-chews-60ct' as SkuId,
  SKU_ROPE_LARGE: 'sku-braided-rope-large' as SkuId,

  // Listings
  LISTING_GPS_CLIP_1P: 'lst-gps-clip-1p' as SellerListingId,
  LISTING_KIBBLE_VET: 'lst-kibble-vet' as SellerListingId,
  LISTING_BED_HAPPY_PAWS: 'lst-bed-happy-paws' as SellerListingId,
  LISTING_HARNESS_APEX: 'lst-harness-apex' as SellerListingId,
  LISTING_CHEWS_VET: 'lst-chews-vet' as SellerListingId,
  LISTING_ROPE_HAPPY_PAWS: 'lst-rope-happy-paws' as SellerListingId,

  // Locations
  LOC_PETOS_HQ: 'loc-petos-hq-wh' as InventoryLocationId,
  LOC_VET_DISPENSARY: 'loc-vet-dispensary' as InventoryLocationId,
  LOC_HAPPY_PAWS_STORE: 'loc-happy-paws-store' as InventoryLocationId,
  LOC_APEX_ARMORY: 'loc-apex-armory' as InventoryLocationId,
};

export function seedCommerceData(store: CommerceStore = CommerceStore.getInstance()): void {
  const service = new CommerceService(store);
  const now = new Date().toISOString();

  // 1. PRODUCT CATEGORIES (All strictly enforce isLiveAnimalProhibited = true)
  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_TRACKING_ACC,
    code: 'TRACKING_ACCESSORIES',
    displayName: 'Tracking Accessories & Mounts',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: true,
    standardReturnWindowDays: 30,
    requiresLotNumber: false,
    requiresExpiryDate: false,
    allowedSpecies: ['DOG', 'CAT', 'MULTI_SPECIES'],
  });

  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_FOOD,
    code: 'PET_FOOD',
    displayName: 'Dry & Wet Pet Food',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: false, // Opened food non-returnable
    standardReturnWindowDays: 14,
    requiresLotNumber: true,
    requiresExpiryDate: true,
    allowedSpecies: ['DOG', 'CAT'],
  });

  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_BEDS,
    code: 'BEDS_CRATES',
    displayName: 'Beds, Mats & Crates',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: true,
    standardReturnWindowDays: 14,
    requiresLotNumber: false,
    requiresExpiryDate: false,
    allowedSpecies: ['DOG', 'CAT'],
  });

  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_COLLARS_LEADS,
    code: 'COLLARS_HARNESSES_LEADS',
    displayName: 'Collars, Harnesses & Leashes',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: true,
    standardReturnWindowDays: 14,
    requiresLotNumber: false,
    requiresExpiryDate: false,
    allowedSpecies: ['DOG', 'CAT'],
  });

  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_TREATS,
    code: 'NATURAL_TREATS',
    displayName: 'Natural Treats & Dental Chews',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: false,
    standardReturnWindowDays: 14,
    requiresLotNumber: true,
    requiresExpiryDate: true,
    allowedSpecies: ['DOG', 'CAT'],
  });

  store.saveCategory({
    categoryId: COMMERCE_SEED_IDS.CAT_TOYS,
    code: 'TOYS_ENRICHMENT',
    displayName: 'Toys & Brain Enrichment',
    isLeaf: true,
    isLiveAnimalProhibited: true,
    isPrescriptionRestricted: false,
    isReturnableByDefault: true,
    standardReturnWindowDays: 14,
    requiresLotNumber: false,
    requiresExpiryDate: false,
    allowedSpecies: ['DOG', 'CAT', 'SMALL_PET'],
  });

  // 2. BRANDS
  store.saveBrand({
    brandId: COMMERCE_SEED_IDS.BRAND_PETOS,
    name: 'Pet OS Official Gear',
    slug: 'petos-official',
    verifiedBrandOwner: true,
  });

  store.saveBrand({
    brandId: COMMERCE_SEED_IDS.BRAND_SAFARI_PAWS,
    name: 'Safari Paws Organics',
    slug: 'safari-paws',
    verifiedBrandOwner: true,
  });

  store.saveBrand({
    brandId: COMMERCE_SEED_IDS.BRAND_K9_ESSENTIALS,
    name: 'K9 Essentials East Africa',
    slug: 'k9-essentials',
    verifiedBrandOwner: true,
  });

  store.saveBrand({
    brandId: COMMERCE_SEED_IDS.BRAND_VETCARE_PRO,
    name: 'VetCare Pro Health',
    slug: 'vetcare-pro',
    verifiedBrandOwner: true,
  });

  // 3. SELLERS (First-party + Verified 3P Sellers)
  service.createSellerProfile({
    sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
    sellerType: 'FIRST_PARTY_STORE',
    primaryOwnerUserId: CANONICAL_IDS.ADMIN_CHARLES,
    tradingName: 'Pet OS Official Store',
    legalEntityName: 'Pet OS Global Technologies Limited',
    registrationNumber: 'CPR/2024/99120',
    supportEmail: 'store@petos.internal',
    supportPhone: '+254 700 000001',
    isFirstParty: true,
  });

  service.createSellerProfile({
    sellerId: COMMERCE_SEED_IDS.SELLER_NAIROBI_VET,
    sellerType: 'BUSINESS',
    businessId: SEED_BUSINESSES.NAIROBI_WEST_VET,
    primaryOwnerUserId: SEED_USERS.VET_DR_KIMANI,
    tradingName: 'Nairobi West Vet Animal Pharmacy & Supplies',
    legalEntityName: 'Nairobi West Veterinary Services Limited',
    registrationNumber: 'CPR/2018/98214',
    supportEmail: 'pharmacy@nairobiwestvet.co.ke',
    supportPhone: '+254 20 6005500',
    isFirstParty: false,
  });
  service.acceptSellerAgreement(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET, SEED_USERS.VET_DR_KIMANI, 'v1.0', '197.232.0.1');
  service.configureSellerPayoutDestination(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET, {
    destinationType: 'MPESA_PAYBILL',
    accountName: 'Nairobi West Vet Clinic',
    accountNumberMasked: '522***1',
    bankCodeOrPaybill: '522522',
  });
  const vetSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_NAIROBI_VET)!;
  vetSeller.isVerified = true;
  vetSeller.status = 'ACTIVE';
  vetSeller.onboardingStatus = 'ACTIVE';
  store.saveSeller(vetSeller);

  service.createSellerProfile({
    sellerId: COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
    sellerType: 'BUSINESS',
    businessId: SEED_BUSINESSES.HAPPY_PAWS_WALKERS,
    primaryOwnerUserId: SEED_USERS.WALKER_SARAH,
    tradingName: 'Happy Paws Canine Outfitting & Gear',
    legalEntityName: 'Happy Paws Canine Care Limited',
    registrationNumber: 'BN-882941',
    supportEmail: 'gear@happypawswalkers.ke',
    supportPhone: '+254 722 334455',
    isFirstParty: false,
  });
  service.acceptSellerAgreement(COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS, SEED_USERS.WALKER_SARAH, 'v1.0', '197.232.0.2');
  service.configureSellerPayoutDestination(COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS, {
    destinationType: 'MPESA_TILL',
    accountName: 'Happy Paws Walkers',
    accountNumberMasked: '992***4',
    bankCodeOrPaybill: '992110',
  });
  const hpSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS)!;
  hpSeller.isVerified = true;
  hpSeller.status = 'ACTIVE';
  hpSeller.onboardingStatus = 'ACTIVE';
  store.saveSeller(hpSeller);

  service.createSellerProfile({
    sellerId: COMMERCE_SEED_IDS.SELLER_APEX_K9,
    sellerType: 'BUSINESS',
    businessId: SEED_BUSINESSES.APEX_K9_ACADEMY,
    primaryOwnerUserId: SEED_USERS.TRAINER_JUMA,
    tradingName: 'Apex K9 Tactical & Training Supplies',
    legalEntityName: 'Apex Canine Performance Limited',
    registrationNumber: 'CPR/2021/44812',
    supportEmail: 'supplies@apexcanine.ke',
    supportPhone: '+254 733 998877',
    isFirstParty: false,
  });
  const apexSeller = store.getSeller(COMMERCE_SEED_IDS.SELLER_APEX_K9)!;
  apexSeller.isVerified = true;
  apexSeller.status = 'ACTIVE';
  apexSeller.onboardingStatus = 'ACTIVE';
  store.saveSeller(apexSeller);

  // 4. INVENTORY LOCATIONS
  store.saveLocation({
    locationId: COMMERCE_SEED_IDS.LOC_PETOS_HQ,
    sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
    name: 'Pet OS Central Fulfillment Hub',
    locationType: 'FULFILLMENT_CENTER',
    addressSummary: 'Sameer Industrial Park, Enterprise Rd, Nairobi',
    isActive: true,
  });

  store.saveLocation({
    locationId: COMMERCE_SEED_IDS.LOC_VET_DISPENSARY,
    sellerId: COMMERCE_SEED_IDS.SELLER_NAIROBI_VET,
    name: 'Nairobi West Animal Hospital Dispensary',
    locationType: 'STORE',
    addressSummary: 'Gandhi Ave, Nairobi West, Nairobi',
    isActive: true,
  });

  store.saveLocation({
    locationId: COMMERCE_SEED_IDS.LOC_HAPPY_PAWS_STORE,
    sellerId: COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
    name: 'Happy Paws Karen Warehouse',
    locationType: 'WAREHOUSE',
    addressSummary: 'Ngong Rd, Karen, Nairobi',
    isActive: true,
  });

  store.saveLocation({
    locationId: COMMERCE_SEED_IDS.LOC_APEX_ARMORY,
    sellerId: COMMERCE_SEED_IDS.SELLER_APEX_K9,
    name: 'Apex K9 Training Depot',
    locationType: 'STORE',
    addressSummary: 'Kiambu Rd, Ridgeways, Nairobi',
    isActive: true,
  });

  // 5. PRODUCTS & VARIANTS
  // 5a. GPS Collar Clip (First-Party Tracker Accessory)
  service.createProduct({
    productId: COMMERCE_SEED_IDS.PROD_GPS_CLIP,
    categoryId: COMMERCE_SEED_IDS.CAT_TRACKING_ACC,
    brandId: COMMERCE_SEED_IDS.BRAND_PETOS,
    title: 'Pet OS Rugged GPS Tracker Collar Attachment Clip',
    description: 'High-durability silicone and ballistic polymer locking mount. Compatible with standard Pet OS and third-party collar trackers.',
    shortDescription: 'Reinforced ballistic locking collar clip for GPS units.',
    speciesApplicability: 'MULTI_SPECIES',
    lifeStageApplicability: 'ALL_STAGES',
    attributes: [
      { name: 'Material', value: 'Ballistic Silicone' },
      { name: 'Water Resistance', value: 'IP68' },
    ],
    isFirstParty: true,
    actorUserId: CANONICAL_IDS.ADMIN_CHARLES,
  });
  service.createProductVariant({
    productId: COMMERCE_SEED_IDS.PROD_GPS_CLIP,
    skuId: COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD,
    skuCode: 'PETOS-CLIP-01',
    variantTitle: 'Standard Fit (15mm-25mm Collars)',
    options: { size: 'Standard', color: 'Stealth Black' },
    weightGrams: 45,
  });

  // 5b. Safari Lamb & Rice Kibble (Sold by Nairobi West Vet)
  service.createProduct({
    productId: COMMERCE_SEED_IDS.PROD_PREMIUM_KIBBLE,
    categoryId: COMMERCE_SEED_IDS.CAT_FOOD,
    brandId: COMMERCE_SEED_IDS.BRAND_SAFARI_PAWS,
    title: 'Safari Paws Holistic Free-Range Lamb & Brown Rice Dry Kibble',
    description: 'Hypoallergenic complete nutrition for active adult canines. Formulated with free-range Kenyan highland lamb, glucosamine and cold-pressed flaxseed.',
    shortDescription: '15kg Hypoallergenic highland lamb complete canine food.',
    speciesApplicability: 'DOG',
    lifeStageApplicability: 'ADULT',
    attributes: [
      { name: 'Protein', value: '26', unit: '%' },
      { name: 'Primary Ingredient', value: 'Highland Lamb' },
    ],
    isFirstParty: false,
    actorUserId: SEED_USERS.VET_DR_KIMANI,
  });
  service.moderateProduct(COMMERCE_SEED_IDS.PROD_PREMIUM_KIBBLE, CANONICAL_IDS.ADMIN_CHARLES, 'APPROVED', 'Complies with nutritional standards');
  service.createProductVariant({
    productId: COMMERCE_SEED_IDS.PROD_PREMIUM_KIBBLE,
    skuId: COMMERCE_SEED_IDS.SKU_KIBBLE_15KG,
    skuCode: 'SAFARI-LAMB-15KG',
    variantTitle: '15 kg Eco-Sack',
    options: { weight: '15kg' },
    weightGrams: 15000,
  });

  // 5c. Orthopedic Bed (Sold by Happy Paws)
  service.createProduct({
    productId: COMMERCE_SEED_IDS.PROD_ORTHO_BED,
    categoryId: COMMERCE_SEED_IDS.CAT_BEDS,
    brandId: COMMERCE_SEED_IDS.BRAND_K9_ESSENTIALS,
    title: 'K9 Essentials Memory Foam Orthopedic Joint Support Pet Bed',
    description: 'Dual-layer therapeutic memory foam mattress with machine-washable waterproof microsuede cover. Alleviates pressure on hips and elbows.',
    shortDescription: 'Therapeutic orthopedic memory foam bed with washable cover.',
    speciesApplicability: 'DOG',
    lifeStageApplicability: 'ALL_STAGES',
    attributes: [
      { name: 'Foam Thickness', value: '12', unit: 'cm' },
      { name: 'Cover', value: 'Removable Microsuede' },
    ],
    isFirstParty: false,
    actorUserId: SEED_USERS.WALKER_SARAH,
  });
  service.moderateProduct(COMMERCE_SEED_IDS.PROD_ORTHO_BED, CANONICAL_IDS.ADMIN_CHARLES, 'APPROVED', 'Standard pet bedding product');
  service.createProductVariant({
    productId: COMMERCE_SEED_IDS.PROD_ORTHO_BED,
    skuId: COMMERCE_SEED_IDS.SKU_BED_LARGE,
    skuCode: 'K9-BED-LG-SLATE',
    variantTitle: 'Large (100cm x 75cm) - Slate Grey',
    options: { size: 'Large', color: 'Slate Grey' },
    weightGrams: 4200,
  });

  // 5d. Tactical Harness (Sold by Apex K9)
  service.createProduct({
    productId: COMMERCE_SEED_IDS.PROD_TACTICAL_HARNESS,
    categoryId: COMMERCE_SEED_IDS.CAT_COLLARS_LEADS,
    brandId: COMMERCE_SEED_IDS.BRAND_K9_ESSENTIALS,
    title: 'Apex Heavy-Duty No-Pull Tactical Working Harness',
    description: '1050D military-grade nylon with dual metal leash attachment rings, padded chest distributor, and heavy-duty top grab handle.',
    shortDescription: 'Reinforced 1050D nylon no-pull harness with dual clip points.',
    speciesApplicability: 'DOG',
    lifeStageApplicability: 'ALL_STAGES',
    attributes: [
      { name: 'Tensile Strength', value: '450', unit: 'kg' },
      { name: 'Hardware', value: 'Aircraft Zinc Alloy' },
    ],
    isFirstParty: false,
    actorUserId: SEED_USERS.TRAINER_JUMA,
  });
  service.moderateProduct(COMMERCE_SEED_IDS.PROD_TACTICAL_HARNESS, CANONICAL_IDS.ADMIN_CHARLES, 'APPROVED', 'Complies with working dog equipment criteria');
  service.createProductVariant({
    productId: COMMERCE_SEED_IDS.PROD_TACTICAL_HARNESS,
    skuId: COMMERCE_SEED_IDS.SKU_HARNESS_MED,
    skuCode: 'APEX-HARNESS-MED',
    variantTitle: 'Medium (Chest 60-78cm) - Coyote Tan',
    options: { size: 'Medium', color: 'Coyote Tan' },
    weightGrams: 650,
  });

  // 6. INVENTORY STOCKS (Exact On-Hand Units)
  service.receiveInventory({
    sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
    skuId: COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD,
    locationId: COMMERCE_SEED_IDS.LOC_PETOS_HQ,
    quantity: 120,
    actorUserId: CANONICAL_IDS.ADMIN_CHARLES,
    reason: 'Initial 1P factory production batch',
  });

  service.receiveInventory({
    sellerId: COMMERCE_SEED_IDS.SELLER_NAIROBI_VET,
    skuId: COMMERCE_SEED_IDS.SKU_KIBBLE_15KG,
    locationId: COMMERCE_SEED_IDS.LOC_VET_DISPENSARY,
    quantity: 25,
    actorUserId: SEED_USERS.VET_DR_KIMANI,
    reason: 'Weekly pallet shipment from Safari Paws mill',
    lotNumber: 'LOT-2026-SP-09A',
    expirationDate: '2027-04-15',
  });

  service.receiveInventory({
    sellerId: COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
    skuId: COMMERCE_SEED_IDS.SKU_BED_LARGE,
    locationId: COMMERCE_SEED_IDS.LOC_HAPPY_PAWS_STORE,
    quantity: 14,
    actorUserId: SEED_USERS.WALKER_SARAH,
    reason: 'Stock shipment from manufacturing facility',
  });

  service.receiveInventory({
    sellerId: COMMERCE_SEED_IDS.SELLER_APEX_K9,
    skuId: COMMERCE_SEED_IDS.SKU_HARNESS_MED,
    locationId: COMMERCE_SEED_IDS.LOC_APEX_ARMORY,
    quantity: 18,
    actorUserId: SEED_USERS.TRAINER_JUMA,
    reason: 'Tactical gear stock import',
  });

  // 7. SELLER LISTINGS (Exact Minor Unit Pricing in KES)
  service.createSellerListing({
    listingId: COMMERCE_SEED_IDS.LISTING_GPS_CLIP_1P,
    sellerId: COMMERCE_SEED_IDS.SELLER_PETOS_1P,
    productId: COMMERCE_SEED_IDS.PROD_GPS_CLIP,
    skuId: COMMERCE_SEED_IDS.SKU_GPS_CLIP_STD,
    priceMinor: 150000, // KES 1,500.00
    currency: 'KES',
    fulfillmentMethods: ['PLATFORM_DELIVERY', 'THIRD_PARTY_COURIER'],
    shippingProfileId: 'shp-standard-ke',
  });

  service.createSellerListing({
    listingId: COMMERCE_SEED_IDS.LISTING_KIBBLE_VET,
    sellerId: COMMERCE_SEED_IDS.SELLER_NAIROBI_VET,
    productId: COMMERCE_SEED_IDS.PROD_PREMIUM_KIBBLE,
    skuId: COMMERCE_SEED_IDS.SKU_KIBBLE_15KG,
    priceMinor: 780000, // KES 7,800.00
    currency: 'KES',
    fulfillmentMethods: ['SELLER_DELIVERY', 'PICKUP'],
    shippingProfileId: 'shp-nairobi-metro',
  });

  service.createSellerListing({
    listingId: COMMERCE_SEED_IDS.LISTING_BED_HAPPY_PAWS,
    sellerId: COMMERCE_SEED_IDS.SELLER_HAPPY_PAWS,
    productId: COMMERCE_SEED_IDS.PROD_ORTHO_BED,
    skuId: COMMERCE_SEED_IDS.SKU_BED_LARGE,
    priceMinor: 620000, // KES 6,200.00
    currency: 'KES',
    fulfillmentMethods: ['THIRD_PARTY_COURIER'],
    shippingProfileId: 'shp-standard-ke',
  });

  service.createSellerListing({
    listingId: COMMERCE_SEED_IDS.LISTING_HARNESS_APEX,
    sellerId: COMMERCE_SEED_IDS.SELLER_APEX_K9,
    productId: COMMERCE_SEED_IDS.PROD_TACTICAL_HARNESS,
    skuId: COMMERCE_SEED_IDS.SKU_HARNESS_MED,
    priceMinor: 380000, // KES 3,800.00
    currency: 'KES',
    fulfillmentMethods: ['THIRD_PARTY_COURIER', 'PICKUP'],
    shippingProfileId: 'shp-standard-ke',
  });

  // 8. SAMPLE HISTORICAL ORDER FOR ELENA VANCE
  // Multi-seller checkout: 1 GPS Clip (Pet OS 1P) + 1 Kibble Sack (Nairobi West Vet)
  const elenaCart = service.getOrCreateCart(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.MAIN_HOUSEHOLD);
  service.addItemToCart(elenaCart.cartId, COMMERCE_SEED_IDS.LISTING_GPS_CLIP_1P, 1);
  service.addItemToCart(elenaCart.cartId, COMMERCE_SEED_IDS.LISTING_KIBBLE_VET, 1);

  const checkout = service.createCheckout({
    cartId: elenaCart.cartId,
    buyerUserId: CANONICAL_IDS.OWNER_ELENA,
    householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
    deliveryAddress: {
      recipientName: 'Elena Vance',
      recipientPhone: '+254 711 000101',
      streetLine1: '45 Muringa Road, Kilimani',
      city: 'Nairobi',
      countyOrState: 'Nairobi County',
      postalCode: '00100',
      country: 'KE',
      deliveryInstructions: 'Ring bell at gate A',
      maskedAddressSummary: 'Kilimani, Nairobi (45 Muringa Rd)',
    },
    deliveryMethod: 'THIRD_PARTY_COURIER',
  });

  // Confirm payment and create order
  const confirmedOrder = service.confirmOrderPayment(checkout.checkoutId);

  // Fulfill Pet OS 1P portion: ship via Fargo Courier
  const petosSellerOrder = store.listSellerOrdersForOrder(confirmedOrder.orderId).find(
    so => so.sellerId === COMMERCE_SEED_IDS.SELLER_PETOS_1P
  );
  if (petosSellerOrder) {
    service.acceptSellerOrder(petosSellerOrder.sellerOrderId, CANONICAL_IDS.ADMIN_CHARLES);
    service.packSellerOrder(petosSellerOrder.sellerOrderId, CANONICAL_IDS.ADMIN_CHARLES);
    const shipment = service.shipSellerOrder({
      sellerOrderId: petosSellerOrder.sellerOrderId,
      carrierName: 'Fargo Courier',
      sellerUserId: CANONICAL_IDS.ADMIN_CHARLES,
    });
    // Mark delivered with signature
    service.deliverShipment({
      shipmentId: shipment.shipmentId,
      evidenceType: 'RECIPIENT_SIGNATURE',
      evidenceData: 'Signed by Elena Vance',
      actorUserId: CANONICAL_IDS.ADMIN_CHARLES,
    });
  }

  // Fulfill Vet portion: pack and set ready for dispatch
  const vetSellerOrder = store.listSellerOrdersForOrder(confirmedOrder.orderId).find(
    so => so.sellerId === COMMERCE_SEED_IDS.SELLER_NAIROBI_VET
  );
  if (vetSellerOrder) {
    service.acceptSellerOrder(vetSellerOrder.sellerOrderId, SEED_USERS.VET_DR_KIMANI);
    service.packSellerOrder(vetSellerOrder.sellerOrderId, SEED_USERS.VET_DR_KIMANI);
  }
}
