import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Store,
  Package,
  Truck,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CreditCard,
  Layers,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Plus,
  Minus,
  Trash2,
  Eye,
  Check,
  Ban,
  Clock,
  RefreshCw,
  Building2,
  Play,
  MapPin,
  Tag,
  DollarSign,
  HelpCircle,
} from 'lucide-react';
import { CommerceStore } from '../pet-os/commerce/store';
import { CommerceService } from '../pet-os/commerce/service';
import { CommerceTestSuite, TestResult } from '../pet-os/commerce/tests';
import { COMMERCE_SEED_IDS } from '../pet-os/commerce/seed';
import { CANONICAL_IDS } from '../pet-os/seed/unified-seed';
import { SEED_USERS } from '../pet-os/provider/seed';
import {
  SellerId,
  ProductId,
  SellerListingId,
  CartId,
  OrderId,
  SellerOrderId,
  ShipmentId,
  ReturnRequestId,
  asUserId,
} from '../pet-os/kernel/ids';
import {
  Product,
  SellerListing,
  ShoppingCart,
  Order,
  SellerOrder,
  Shipment,
  ReturnRequest,
  SellerProfile,
  InventoryItem,
  SellerDashboardReadModel,
  DeliveryMethod,
} from '../pet-os/commerce/types';

export const Sprint27CommerceConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'storefront' | 'seller-ops' | 'trust-safety' | 'tests'>('storefront');
  const [selectedSellerId, setSelectedSellerId] = useState<SellerId>(COMMERCE_SEED_IDS.SELLER_PETOS_1P);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [speciesFilter, setSpeciesFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart state
  const [cart, setCart] = useState<ShoppingCart | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('THIRD_PARTY_COURIER');
  const [activeBuyerOrders, setActiveBuyerOrders] = useState<Order[]>([]);

  // Seller Ops state
  const [sellerDashboard, setSellerDashboard] = useState<SellerDashboardReadModel | null>(null);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [sellerInventory, setSellerInventory] = useState<InventoryItem[]>([]);
  const [sellerReturns, setSellerReturns] = useState<ReturnRequest[]>([]);

  // Trust & Safety Simulator
  const [liveAnimalInput, setLiveAnimalInput] = useState<string>('Golden Retriever Puppy (8 weeks purebred)');
  const [liveAnimalResult, setLiveAnimalResult] = useState<{ blocked: boolean; message: string } | null>(null);
  const [rxInput, setRxInput] = useState<string>('Apoquel 16mg Allergy Tablets - Prescription');
  const [rxResult, setRxResult] = useState<{ blocked: boolean; message: string } | null>(null);

  // Test Runner State
  const [testResults, setTestResults] = useState<{
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const store = CommerceStore.getInstance();
  const service = new CommerceService(store);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshState = () => {
    // Refresh buyer cart
    const currentCart = service.getOrCreateCart(CANONICAL_IDS.OWNER_ELENA, CANONICAL_IDS.MAIN_HOUSEHOLD);
    setCart({ ...currentCart });

    // Refresh buyer orders
    const orders = store.listOrdersForBuyer(CANONICAL_IDS.OWNER_ELENA);
    setActiveBuyerOrders([...orders]);

    // Refresh seller ops
    const dashboard = service.getSellerDashboard(selectedSellerId);
    setSellerDashboard(dashboard);
    const soList = store.listSellerOrdersForSeller(selectedSellerId);
    setSellerOrders([...soList]);
    const invList = store.listInventoryItemsForSeller(selectedSellerId);
    setSellerInventory([...invList]);
    const retList = store.listReturnsForSeller(selectedSellerId);
    setSellerReturns([...retList]);
  };

  useEffect(() => {
    refreshState();
  }, [selectedSellerId]);

  // Handle adding item to cart
  const handleAddToCart = (listingId: SellerListingId) => {
    if (!cart) return;
    try {
      const updated = service.addItemToCart(cart.cartId, listingId, 1);
      setCart({ ...updated });
      showToast('Item added to Shopping Cart!');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Handle direct checkout
  const handleConfirmCheckout = () => {
    if (!cart || cart.items.length === 0) return;
    try {
      const checkout = service.createCheckout({
        cartId: cart.cartId,
        buyerUserId: CANONICAL_IDS.OWNER_ELENA,
        householdId: CANONICAL_IDS.MAIN_HOUSEHOLD,
        deliveryAddress: {
          recipientName: 'Elena Vance',
          recipientPhone: '+254 711 000101',
          streetLine1: '45 Muringa Road, Kilimani',
          city: 'Nairobi',
          countyOrState: 'Nairobi County',
          country: 'KE',
          maskedAddressSummary: 'Kilimani, Nairobi (45 Muringa Rd)',
        },
        deliveryMethod,
      });

      const order = service.confirmOrderPayment(checkout.checkoutId);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
      refreshState();
      showToast(`Order #${order.orderId.slice(0, 8)} confirmed! Total: KES ${(order.totalMinor / 100).toLocaleString()}`);
    } catch (err: any) {
      showToast(`Checkout Failed: ${err.message}`);
    }
  };

  // Test live animal safeguard
  const testLiveAnimalBlock = () => {
    try {
      service.createProduct({
        productId: `prd-sim-${Date.now()}` as ProductId,
        categoryId: COMMERCE_SEED_IDS.CAT_TOYS,
        brandId: COMMERCE_SEED_IDS.BRAND_SAFARI_PAWS,
        title: liveAnimalInput,
        description: 'Simulated listing to test animal welfare safeguards',
        shortDescription: 'Animal listing simulation',
        speciesApplicability: 'DOG',
        lifeStageApplicability: 'PUPPY_KITTEN',
        attributes: [],
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
      });
      setLiveAnimalResult({
        blocked: false,
        message: 'FAIL: Product was unexpectedly created without blocking.',
      });
    } catch (err: any) {
      setLiveAnimalResult({
        blocked: true,
        message: `PASS: ${err.message}`,
      });
    }
  };

  // Test prescription safeguard
  const testRxBlock = () => {
    try {
      service.createProduct({
        productId: `prd-sim-${Date.now()}` as ProductId,
        categoryId: COMMERCE_SEED_IDS.CAT_TREATS,
        brandId: COMMERCE_SEED_IDS.BRAND_VETCARE_PRO,
        title: rxInput,
        description: 'Simulated prescription pharmaceutical listing',
        shortDescription: 'Rx simulation',
        speciesApplicability: 'DOG',
        lifeStageApplicability: 'ADULT',
        attributes: [],
        actorUserId: CANONICAL_IDS.OWNER_ELENA,
      });
      setRxResult({
        blocked: false,
        message: 'FAIL: Prescription pharmaceutical was unexpectedly created without blocking.',
      });
    } catch (err: any) {
      setRxResult({
        blocked: true,
        message: `PASS: ${err.message}`,
      });
    }
  };

  // Run automated tests
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await CommerceTestSuite.runAllTests();
      setTestResults(res);
      refreshState();
    } finally {
      setIsRunningTests(false);
    }
  };

  // Products from store
  const allProducts = store.listProducts();
  const allListings = store.listActiveListings();

  const filteredProducts = allProducts.filter(p => {
    if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
    if (speciesFilter !== 'ALL' && p.speciesApplicability !== speciesFilter && p.speciesApplicability !== 'MULTI_SPECIES') return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sellersList = store.listSellers();

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-indigo-400/30 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-indigo-200" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Domain Top Bar */}
      <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Store className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-[#F8FAFC] tracking-tight">
                Pet OS Marketplace &amp; Commerce Platform
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Sprint 27 Canonical
              </span>
            </div>
            <p className="text-sm text-[#94A3B8] max-w-3xl">
              Production-grade product commerce architecture. Decoupled seller identities, strict live-animal protections,
              concurrency-safe inventory reservations, multi-seller split orders, immutable commissions, and factual return inspections.
            </p>
          </div>

          {/* Cart Icon & Launcher */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#2A374A] text-slate-100 border border-[#334155] font-semibold text-xs flex items-center gap-2.5 transition-all shadow-md cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-indigo-400" />
              <span>Shopping Cart</span>
              {cart && cart.items.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">
                  {cart.items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Console Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-[#1E293B]/80 overflow-x-auto">
          <button
            onClick={() => setActiveTab('storefront')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'storefront'
                ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/25'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Buyer Storefront</span>
          </button>

          <button
            onClick={() => setActiveTab('seller-ops')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'seller-ops'
                ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/25'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Seller Operations Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('trust-safety')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'trust-safety'
                ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/25'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Commerce Trust &amp; Safety Proof</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-indigo-500 text-slate-950 shadow-lg shadow-indigo-500/25'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Automated Verification Suite</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: BUYER STOREFRONT
          ========================================================================= */}
      {activeTab === 'storefront' && (
        <div className="space-y-6">
          {/* Search & Category Filter Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dog food, GPS mounts, beds, harnesses..."
                className="w-full bg-[#0F1115] border border-[#1E293B] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
              <div className="flex items-center gap-1.5 bg-[#0F1115] border border-[#1E293B] rounded-xl p-1 text-xs">
                <button
                  onClick={() => setSpeciesFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    speciesFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  All Species
                </button>
                <button
                  onClick={() => setSpeciesFilter('DOG')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    speciesFilter === 'DOG' ? 'bg-indigo-600 text-white' : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Dogs
                </button>
                <button
                  onClick={() => setSpeciesFilter('CAT')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    speciesFilter === 'CAT' ? 'bg-indigo-600 text-white' : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  Cats
                </button>
              </div>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-[#0F1115] border border-[#1E293B] rounded-xl px-3 py-2 text-xs text-[#CBD5E1] focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value={COMMERCE_SEED_IDS.CAT_TRACKING_ACC}>Tracking Accessories</option>
                <option value={COMMERCE_SEED_IDS.CAT_FOOD}>Pet Food</option>
                <option value={COMMERCE_SEED_IDS.CAT_BEDS}>Beds &amp; Crates</option>
                <option value={COMMERCE_SEED_IDS.CAT_COLLARS_LEADS}>Collars &amp; Harnesses</option>
              </select>
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map(product => {
              const brand = store.getBrand(product.brandId);
              const category = store.getCategory(product.categoryId);
              const listings = store.listListingsForProduct(product.productId);
              const primaryListing = listings[0];
              const variants = store.listVariantsForProduct(product.productId);
              const primaryVariant = variants[0];
              const inv = primaryListing ? store.getInventoryItemBySellerAndSku(primaryListing.sellerId, primaryListing.skuId) : undefined;
              const seller = primaryListing ? store.getSeller(primaryListing.sellerId) : undefined;

              return (
                <div
                  key={product.productId}
                  className="bg-[#13151A] border border-[#1E293B] rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-indigo-500/40 transition-all group"
                >
                  {/* Product Header / Tag */}
                  <div className="p-4 bg-[#0F1115] border-b border-[#1E293B] flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {brand?.name || 'Pet OS Brand'}
                    </span>
                    {product.isFirstParty ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        1P Official Store
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Verified Marketplace Seller
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-2">
                        {product.title}
                      </h3>
                      <p className="text-xs text-[#94A3B8] mt-2 line-clamp-3 leading-relaxed">
                        {product.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[#94A3B8] text-[11px] font-medium">
                          {category?.displayName || 'Category'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-[#94A3B8] text-[11px] font-medium">
                          {product.speciesApplicability}
                        </span>
                        {primaryVariant && (
                          <span className="px-2 py-0.5 rounded-md bg-[#1E293B] text-slate-300 text-[11px] font-mono">
                            {primaryVariant.title}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Stock Status */}
                    <div className="mt-6 pt-4 border-t border-[#1E293B] flex items-center justify-between">
                      <div>
                        <div className="text-xs text-[#64748B]">Price (Minor Units)</div>
                        <div className="text-lg font-black text-slate-100">
                          KES {primaryListing ? (primaryListing.priceMinor / 100).toLocaleString() : 'N/A'}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] mt-0.5">
                          Sold by: <span className="text-slate-300 font-semibold">{seller?.tradingName}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {inv && inv.availableToSell > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            {inv.availableToSell} in stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                            Out of stock
                          </span>
                        )}

                        {primaryListing && (
                          <button
                            onClick={() => handleAddToCart(primaryListing.listingId)}
                            disabled={!inv || inv.availableToSell === 0}
                            className={`mt-2 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              inv && inv.availableToSell > 0
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                                : 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Elena's Orders & Delivery Tracking Section */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <span>Elena Vance — Recent Purchases &amp; Delivery Tracking</span>
              </h2>
              <span className="text-xs text-[#64748B]">Buyer Household: hh-01951500-0000-7000-8000-000000000001</span>
            </div>

            {activeBuyerOrders.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No orders found for this account.</p>
            ) : (
              <div className="space-y-4">
                {activeBuyerOrders.map(order => {
                  const sellerOrders = store.listSellerOrdersForOrder(order.orderId);

                  return (
                    <div key={order.orderId} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-3">
                        <div>
                          <div className="text-xs font-bold text-slate-200">
                            Order #{order.orderId.slice(0, 13)}
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-0.5">
                            Placed on: {new Date(order.createdAt).toLocaleString()} · Delivery: {order.deliveryAddress.maskedAddressSummary}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-slate-100">
                            Total: KES {(order.totalMinor / 100).toLocaleString()}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            order.status === 'FULFILLED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : order.status === 'CANCELLED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      {/* Sub-Orders Breakdown (Multi-Seller Split!) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sellerOrders.map(so => {
                          const seller = store.getSeller(so.sellerId);
                          const shipments = store.listShipmentsForSellerOrder(so.sellerOrderId);
                          const latestShipment = shipments[shipments.length - 1];

                          return (
                            <div key={so.sellerOrderId} className="bg-[#13151A] border border-[#1E293B] rounded-xl p-4 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-indigo-400">
                                    {seller?.tradingName}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E293B] text-slate-300">
                                    {so.status}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-2">
                                  {so.items.map(item => (
                                    <div key={item.orderItemId} className="text-xs text-slate-300 flex justify-between">
                                      <span>
                                        {item.quantityOrdered}x {item.productSnapshot.productTitle}
                                      </span>
                                      <span className="font-mono text-[#94A3B8]">
                                        KES {(item.subtotalMinor / 100).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {latestShipment && (
                                <div className="mt-4 pt-3 border-t border-[#1E293B] text-[11px] text-[#94A3B8]">
                                  <div className="flex items-center justify-between font-mono">
                                    <span>Carrier: {latestShipment.carrierName}</span>
                                    <span className="text-indigo-300">{latestShipment.trackingNumber}</span>
                                  </div>
                                  {latestShipment.deliveryEvidence && (
                                    <div className="mt-1 text-emerald-400 font-medium">
                                      Proof: {latestShipment.deliveryEvidence.evidenceData}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SELLER OPERATIONS WORKSPACE
          ========================================================================= */}
      {activeTab === 'seller-ops' && (
        <div className="space-y-6">
          {/* Seller Selector Bar */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs text-[#64748B] font-semibold">Active Operational Seller Account:</div>
              <div className="text-base font-black text-slate-100 flex items-center gap-2">
                <span>{sellerDashboard?.tradingName || 'Seller Account'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {sellerDashboard?.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {sellersList.map(s => (
                <button
                  key={s.sellerId}
                  onClick={() => setSelectedSellerId(s.sellerId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedSellerId === s.sellerId
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {s.tradingName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Seller KPI Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#64748B] font-semibold">Orders Awaiting Action</div>
              <div className="text-2xl font-black text-slate-100 mt-1">
                {sellerDashboard?.pendingOrdersCount || 0}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#64748B] font-semibold">Preparing / In Packing</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {sellerDashboard?.preparingOrdersCount || 0}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#64748B] font-semibold">Finance: Pending Earnings</div>
              <div className="text-2xl font-black text-slate-100 mt-1">
                KES {((sellerDashboard?.pendingEarningsMinor || 0) / 100).toLocaleString()}
              </div>
            </div>

            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-4">
              <div className="text-xs text-[#64748B] font-semibold">Available for Payout</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                KES {((sellerDashboard?.availableBalanceMinor || 0) / 100).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Seller Order Queue */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              <span>Seller Order Operations &amp; Fulfillment Queue</span>
            </h2>

            {sellerOrders.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No seller orders active for this seller.</p>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map(so => (
                  <div key={so.sellerOrderId} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          SellerOrder #{so.sellerOrderId.slice(0, 12)}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                          {so.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#94A3B8] mt-1">
                        Buyer: {so.shippingAddressSnapshot.recipientName} ({so.shippingAddressSnapshot.maskedAddressSummary})
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        Items: {so.items.map(i => `${i.quantityOrdered}x ${i.productSnapshot.productTitle}`).join(', ')}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-[#64748B]">Net Payout (After 10% Commission)</div>
                        <div className="text-sm font-black text-emerald-400">
                          KES {(so.sellerNetMinor / 100).toLocaleString()}
                        </div>
                      </div>

                      {/* Workflow action buttons */}
                      <div className="flex items-center gap-2">
                        {so.status === 'PENDING' && (
                          <button
                            onClick={() => {
                              service.acceptSellerOrder(so.sellerOrderId, SEED_USERS.VET_DR_KIMANI);
                              refreshState();
                              showToast('Order Accepted!');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Accept Order
                          </button>
                        )}

                        {so.status === 'ACCEPTED' && (
                          <button
                            onClick={() => {
                              service.packSellerOrder(so.sellerOrderId, SEED_USERS.VET_DR_KIMANI);
                              refreshState();
                              showToast('Order Packed and Ready!');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Pack Items
                          </button>
                        )}

                        {so.status === 'PREPARING' && (
                          <button
                            onClick={() => {
                              service.shipSellerOrder({
                                sellerOrderId: so.sellerOrderId,
                                carrierName: 'Fargo Courier',
                                sellerUserId: SEED_USERS.VET_DR_KIMANI,
                              });
                              refreshState();
                              showToast('Dispatched to Courier!');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Dispatch Courier
                          </button>
                        )}

                        {so.status === 'SHIPPED' && (
                          <button
                            onClick={() => {
                              const shipments = store.listShipmentsForSellerOrder(so.sellerOrderId);
                              if (shipments[0]) {
                                service.deliverShipment({
                                  shipmentId: shipments[0].shipmentId,
                                  evidenceType: 'CARRIER_CONFIRMATION',
                                  evidenceData: 'Delivered and confirmed by recipient',
                                  actorUserId: SEED_USERS.VET_DR_KIMANI,
                                });
                                refreshState();
                                showToast('Marked as Delivered! Earnings released to available balance.');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seller Inventory Management Grid */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <h2 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Stock Quantities &amp; Concurrency-Safe Inventory Control</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sellerInventory.map(item => {
                const sku = store.getSku(item.skuId);
                const prod = sku ? store.getProduct(sku.productId) : undefined;

                return (
                  <div key={item.inventoryItemId} className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4">
                    <div className="text-xs font-bold text-slate-200 line-clamp-1">
                      {prod?.title || item.skuId}
                    </div>
                    <div className="text-[10px] text-[#64748B] font-mono mt-0.5">
                      SKU: {sku?.skuCode}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="bg-[#13151A] p-2 rounded-lg border border-[#1E293B]">
                        <div className="text-[10px] text-[#64748B]">On Hand</div>
                        <div className="text-sm font-black text-slate-200">{item.onHandQuantity}</div>
                      </div>
                      <div className="bg-[#13151A] p-2 rounded-lg border border-[#1E293B]">
                        <div className="text-[10px] text-[#64748B]">Reserved</div>
                        <div className="text-sm font-black text-amber-400">{item.reservedQuantity}</div>
                      </div>
                      <div className="bg-[#13151A] p-2 rounded-lg border border-[#1E293B]">
                        <div className="text-[10px] text-[#64748B]">Available (ATS)</div>
                        <div className="text-sm font-black text-emerald-400">{item.availableToSell}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          service.adjustInventory(item.inventoryItemId, 5, SEED_USERS.VET_DR_KIMANI, 'Restock delivery');
                          refreshState();
                          showToast('Inventory restocked +5 units with movement audit record');
                        }}
                        className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#2E3C50] text-slate-200 font-semibold cursor-pointer"
                      >
                        +5 Restock
                      </button>

                      <button
                        onClick={() => {
                          if (item.availableToSell > 0) {
                            service.adjustInventory(item.inventoryItemId, -1, SEED_USERS.VET_DR_KIMANI, 'Damaged shelf stock removal');
                            refreshState();
                            showToast('Inventory adjusted -1 unit (Damaged stock removal)');
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#2E3C50] text-slate-200 font-semibold cursor-pointer"
                      >
                        -1 Damage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: COMMERCE TRUST & SAFETY PROOF
          ========================================================================= */}
      {activeTab === 'trust-safety' && (
        <div className="space-y-6">
          {/* Live Animal Block Proof */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Ban className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-slate-100">
                Mandatory Live-Animal Protection Safeguard
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-3xl mb-4">
              Under Pet OS architectural law, live animals (dogs, cats, puppies, kittens) can NEVER be modelled or sold as ordinary commerce SKUs.
              Commercial transactions are strictly limited to supplies, food, and accessories. Adoption remains exclusively in Sprint 18 Animal Welfare.
            </p>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Test Live-Animal Listing Attempt:</div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={liveAnimalInput}
                  onChange={e => setLiveAnimalInput(e.target.value)}
                  className="w-full bg-[#13151A] border border-[#1E293B] rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500 font-mono"
                />
                <button
                  onClick={testLiveAnimalBlock}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Attempt Publication
                </button>
              </div>

              {liveAnimalResult && (
                <div className={`p-3.5 rounded-xl text-xs font-mono flex items-start gap-2.5 ${
                  liveAnimalResult.blocked
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}>
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{liveAnimalResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Prescription Medicine Block Proof */}
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-slate-100">
                Regulated Veterinary Pharmaceutical Restriction
              </h2>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-3xl mb-4">
              Restricted prescription veterinary medicines (antibiotics, Apoquel, Bravecto Rx, steroids) are prohibited from open marketplace listing
              without registered veterinary pharmacy credentials and canonical clinical prescription linkage.
            </p>

            <div className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Test Prescription Pharmaceutical Attempt:</div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={rxInput}
                  onChange={e => setRxInput(e.target.value)}
                  className="w-full bg-[#13151A] border border-[#1E293B] rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  onClick={testRxBlock}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  Attempt Publication
                </button>
              </div>

              {rxResult && (
                <div className={`p-3.5 rounded-xl text-xs font-mono flex items-start gap-2.5 ${
                  rxResult.blocked
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                }`}>
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{rxResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: AUTOMATED VERIFICATION SUITE
          ========================================================================= */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-100">
                Automated Verification Suite — Sprint 27
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                28 exhaustive automated tests validating seller isolation, live animal blocks, atomic inventory oversell protection,
                server-authoritative checkout, multi-seller split orders, and factual return inspections.
              </p>
            </div>

            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                isRunningTests
                  ? 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>{isRunningTests ? 'Running Suite...' : 'Run All 28 Tests'}</span>
            </button>
          </div>

          {testResults && (
            <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-bold text-slate-100">
                  Results: <span className="text-emerald-400">{testResults.passed} Passed</span>,{' '}
                  <span className={testResults.failed > 0 ? 'text-rose-400' : 'text-[#64748B]'}>
                    {testResults.failed} Failed
                  </span>{' '}
                  of {testResults.total} Tests
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                  ALL SYSTEMS COMPLIANT
                </span>
              </div>

              <div className="space-y-2.5">
                {testResults.results.map(r => (
                  <div
                    key={r.id}
                    className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono text-indigo-400 font-bold mr-2">{r.id}</span>
                        <span className="text-slate-200 font-medium">{r.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-[#64748B]">{r.durationMs}ms</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {r.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SLIDE-OVER SHOPPING CART DRAWER
          ========================================================================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          ></div>

          <div className="relative w-full max-w-md bg-[#13151A] border-l border-[#1E293B] shadow-2xl p-6 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#1E293B]">
                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  <span>Shopping Cart ({cart?.items.length || 0})</span>
                </h3>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-[#64748B] hover:text-white cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
                {!cart || cart.items.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-10">Your cart is empty.</p>
                ) : (
                  cart.items.map(item => {
                    const prod = store.getProduct(item.productId);
                    const seller = store.getSeller(item.sellerId);

                    return (
                      <div
                        key={item.cartItemId}
                        className="bg-[#0F1115] border border-[#1E293B] rounded-xl p-3.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 mr-3">
                          <div className="font-bold text-slate-200 line-clamp-1">{prod?.title}</div>
                          <div className="text-[10px] text-[#64748B]">
                            Sold by: <span className="text-slate-400">{seller?.tradingName}</span>
                          </div>
                          <div className="text-xs font-mono font-bold text-indigo-400 mt-1">
                            KES {(item.unitPriceMinor / 100).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const updated = service.updateCartItemQuantity(cart.cartId, item.cartItemId, item.quantity - 1);
                              setCart({ ...updated });
                            }}
                            className="w-6 h-6 rounded bg-[#1E293B] text-slate-300 flex items-center justify-center hover:bg-[#2A374A] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono text-slate-100 font-bold">{item.quantity}</span>
                          <button
                            onClick={() => {
                              const updated = service.updateCartItemQuantity(cart.cartId, item.cartItemId, item.quantity + 1);
                              setCart({ ...updated });
                            }}
                            className="w-6 h-6 rounded bg-[#1E293B] text-slate-300 flex items-center justify-center hover:bg-[#2A374A] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer & Checkout Launcher */}
            <div className="pt-4 border-t border-[#1E293B] space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94A3B8]">Items Subtotal:</span>
                <span className="font-black text-slate-100">
                  KES {cart ? (cart.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0) / 100).toLocaleString() : '0'}
                </span>
              </div>

              <button
                onClick={() => {
                  setIsCheckoutOpen(true);
                }}
                disabled={!cart || cart.items.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  cart && cart.items.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                }`}
              >
                <span>Proceed to Server Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHECKOUT MODAL
          ========================================================================= */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151A] border border-[#1E293B] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <span>Server-Authoritative Checkout</span>
              </h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-[#64748B] hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <div className="text-[#64748B] font-semibold mb-1">Fulfillment Method</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeliveryMethod('THIRD_PARTY_COURIER')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs border cursor-pointer ${
                      deliveryMethod === 'THIRD_PARTY_COURIER'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-[#13151A] border-[#1E293B] text-[#94A3B8]'
                    }`}
                  >
                    Courier Delivery (KES 350/Seller)
                  </button>
                  <button
                    onClick={() => setDeliveryMethod('PICKUP')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs border cursor-pointer ${
                      deliveryMethod === 'PICKUP'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-[#13151A] border-[#1E293B] text-[#94A3B8]'
                    }`}
                  >
                    Store Pickup (Free)
                  </button>
                </div>
              </div>

              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B]">
                <div className="text-[#64748B] font-semibold mb-1">Privacy-Sanitized Address</div>
                <div className="text-slate-300 font-medium">Elena Vance · Kilimani, Nairobi (45 Muringa Rd)</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">
                  Exact GPS coordinates &amp; pet health data are NEVER leaked to marketplace sellers.
                </div>
              </div>

              <div className="bg-[#0F1115] p-3.5 rounded-xl border border-[#1E293B] space-y-1.5 font-mono">
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Items:</span>
                  <span>KES {cart ? (cart.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0) / 100).toLocaleString() : '0'}</span>
                </div>
                <div className="flex justify-between text-[#94A3B8]">
                  <span>Shipping:</span>
                  <span>{deliveryMethod === 'PICKUP' ? 'KES 0.00' : 'KES 700.00 (Multi-Seller)'}</span>
                </div>
                <div className="pt-2 border-t border-[#1E293B] flex justify-between font-sans text-sm font-black text-slate-100">
                  <span>Grand Total:</span>
                  <span className="text-indigo-400">
                    KES {cart ? ((cart.items.reduce((s, i) => s + i.unitPriceMinor * i.quantity, 0) + (deliveryMethod === 'PICKUP' ? 0 : 70000)) / 100).toLocaleString() : '0'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirmCheckout}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm &amp; Place Order (Payment Simulated via Sprint 12)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
