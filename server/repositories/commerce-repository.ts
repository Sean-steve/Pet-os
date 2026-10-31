import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fp=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function httpError(message:string,statusCode:number){return Object.assign(new Error(message),{statusCode});}

async function idem(client:PoolClient,actor:string,scope:string,key:string,fingerprint:string){
  const r=await client.query(
    `SELECT request_fingerprint,response_body,response_status FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [actor,scope,key],
  );
  if(!r.rowCount)return undefined;
  if(r.rows[0].request_fingerprint!==fingerprint)throw httpError('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',409);
  return r.rows[0];
}
async function saveIdem(client:PoolClient,actor:string,scope:string,key:string,fingerprint:string,resourceId:string,status:number,body:unknown){
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [actor,scope,key,fingerprint,resourceId,status,JSON.stringify(body)],
  );
}
async function outbox(client:PoolClient,aggregateType:string,aggregateId:string,eventType:string,payload:unknown){
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,$2,$3,$4,$5::jsonb)`,
    [`evt-${generateUUIDv7()}`,aggregateType,aggregateId,eventType,JSON.stringify(payload)],
  );
}

export async function createSeller(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;sellerType:'INDIVIDUAL'|'BUSINESS';businessId?:string;tradingName:string;legalEntityName:string;
  registrationNumber?:string;supportEmail:string;supportPhone:string;
}){
  if(input.sellerType==='BUSINESS'){
    if(!input.businessId)throw httpError('BUSINESS_ID_REQUIRED',400);
    const manage=await client.query(`SELECT petos_can_manage_business($1,$2) AS allowed`,[input.businessId,input.actorUserId]);
    if(manage.rows[0]?.allowed!==true)throw httpError('BUSINESS_SELLER_MANAGEMENT_DENIED',403);
  }
  const scope='commerce:seller:create',fingerprint=fp(input);
  const prior=await idem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint);
  if(prior)return {seller:prior.response_body,replayed:true};
  const sellerId=`seller-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO commerce_sellers(
      seller_id,seller_type,business_id,primary_owner_user_id,trading_name,legal_entity_name,registration_number,
      support_email,support_phone,status,onboarding_status
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING','UNDER_REVIEW') RETURNING *`,
    [sellerId,input.sellerType,input.businessId||null,input.actorUserId,input.tradingName,input.legalEntityName,input.registrationNumber||null,input.supportEmail,input.supportPhone],
  );
  await client.query(
    `INSERT INTO commerce_seller_memberships(membership_id,seller_id,user_id,role,is_active,accepted_at)
     VALUES($1,$2,$3,'OWNER',true,now())`,
    [`seller-membership-${generateUUIDv7()}`,sellerId,input.actorUserId],
  );
  const seller=result.rows[0];
  await saveIdem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint,sellerId,201,seller);
  await outbox(client,'CommerceSeller',sellerId,'CommerceSellerSubmitted',{sellerId,ownerUserId:input.actorUserId,businessId:input.businessId});
  return {seller,replayed:false};
}

export async function reviewSeller(client:PoolClient,input:{sellerId:string;approved:boolean;reviewerUserId:string}){
  const result=await client.query(
    `UPDATE commerce_sellers SET status=$2,onboarding_status=$3,is_verified=$4,verified_at=CASE WHEN $4 THEN now() ELSE NULL END,
      updated_at=now(),version=version+1 WHERE seller_id=$1 RETURNING *`,
    [input.sellerId,input.approved?'ACTIVE':'RESTRICTED',input.approved?'ACTIVE':'REJECTED',input.approved],
  );
  if(!result.rowCount)throw httpError('COMMERCE_SELLER_NOT_FOUND',404);
  await outbox(client,'CommerceSeller',input.sellerId,input.approved?'CommerceSellerActivated':'CommerceSellerRejected',{sellerId:input.sellerId,reviewerUserId:input.reviewerUserId});
  return result.rows[0];
}

export async function createProductListing(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;sellerId:string;title:string;slug:string;description:string;shortDescription:string;
  categoryCode:string;speciesApplicability:string;lifeStageApplicability:string;safetyClassification:string;isLiveAnimal:boolean;prescriptionRestricted:boolean;
  skuCode:string;variantTitle:string;options:Record<string,string>;priceMinor:number;currency:string;fulfillmentMethods:string[];shippingProfileId:string;
  initialStock:number;locationCode:string;condition:'NEW'|'REFURBISHED';
}){
  const allowed=await client.query(`SELECT petos_can_manage_seller($1,$2) AS allowed`,[input.sellerId,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true)throw httpError('COMMERCE_SELLER_MANAGEMENT_DENIED',403);
  const seller=await client.query(`SELECT status,is_verified FROM commerce_sellers WHERE seller_id=$1 LIMIT 1`,[input.sellerId]);
  if(!seller.rowCount||seller.rows[0].status!=='ACTIVE'||seller.rows[0].is_verified!==true)throw httpError('ACTIVE_VERIFIED_SELLER_REQUIRED',409);
  if(input.isLiveAnimal)throw httpError('LIVE_ANIMAL_MARKETPLACE_PROHIBITED',400);
  if(input.prescriptionRestricted)throw httpError('PRESCRIPTION_MARKETPLACE_PROHIBITED',400);
  if(input.safetyClassification==='PROHIBITED')throw httpError('PROHIBITED_PRODUCT_CLASSIFICATION',400);
  if(!Number.isInteger(input.priceMinor)||input.priceMinor<=0||!Number.isInteger(input.initialStock)||input.initialStock<0)throw httpError('COMMERCE_PRICE_OR_STOCK_INVALID',400);
  const scope=`commerce:product:create:${input.sellerId}`,fingerprint=fp(input);
  const prior=await idem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint);
  if(prior)return {product:prior.response_body,replayed:true};

  const productId=`product-${generateUUIDv7()}`,skuId=`sku-${generateUUIDv7()}`,listingId=`listing-${generateUUIDv7()}`,inventoryItemId=`inventory-${generateUUIDv7()}`;
  const productResult=await client.query(
    `INSERT INTO commerce_products(
      product_id,seller_id,title,slug,description,short_description,category_code,species_applicability,life_stage_applicability,
      safety_classification,moderation_status,is_live_animal,prescription_restricted,status,attributes
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_REVIEW',false,false,'DRAFT','[]'::jsonb) RETURNING *`,
    [productId,input.sellerId,input.title,input.slug,input.description,input.shortDescription,input.categoryCode,input.speciesApplicability,input.lifeStageApplicability,input.safetyClassification],
  );
  await client.query(
    `INSERT INTO commerce_skus(sku_id,product_id,sku_code,variant_title,options,status)
     VALUES($1,$2,$3,$4,$5::jsonb,'ACTIVE')`,
    [skuId,productId,input.skuCode,input.variantTitle,JSON.stringify(input.options)],
  );
  await client.query(
    `INSERT INTO commerce_listings(
      listing_id,seller_id,product_id,sku_id,status,price_minor,currency,fulfillment_methods,shipping_profile_id,condition
     ) VALUES($1,$2,$3,$4,'PENDING_APPROVAL',$5,$6,$7::jsonb,$8,$9)`,
    [listingId,input.sellerId,productId,skuId,input.priceMinor,input.currency,JSON.stringify(input.fulfillmentMethods),input.shippingProfileId,input.condition],
  );
  await client.query(
    `INSERT INTO commerce_inventory_items(inventory_item_id,seller_id,sku_id,location_code,on_hand_quantity,reserved_quantity,low_stock_threshold)
     VALUES($1,$2,$3,$4,$5,0,0)`,
    [inventoryItemId,input.sellerId,skuId,input.locationCode,input.initialStock],
  );
  const product={...productResult.rows[0],skuId,listingId,inventoryItemId};
  await saveIdem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint,productId,201,product);
  await outbox(client,'CommerceProduct',productId,'CommerceProductSubmitted',{productId,sellerId:input.sellerId,skuId,listingId});
  return {product,replayed:false};
}

export async function reviewProduct(client:PoolClient,input:{productId:string;approved:boolean;reviewerUserId:string;reason?:string}){
  const current=await client.query(`SELECT * FROM commerce_products WHERE product_id=$1 FOR UPDATE`,[input.productId]);
  if(!current.rowCount)throw httpError('COMMERCE_PRODUCT_NOT_FOUND',404);
  const p=current.rows[0];
  if(p.is_live_animal||p.prescription_restricted||p.safety_classification==='PROHIBITED')throw httpError('COMMERCE_PRODUCT_POLICY_BLOCKED',409);
  const product=await client.query(
    `UPDATE commerce_products SET moderation_status=$2,status=$3,moderation_reason=$4,updated_at=now(),version=version+1
     WHERE product_id=$1 RETURNING *`,
    [input.productId,input.approved?'APPROVED':'REJECTED',input.approved?'ACTIVE':'RESTRICTED',input.reason||null],
  );
  await client.query(
    `UPDATE commerce_listings SET status=$2,updated_at=now(),version=version+1 WHERE product_id=$1`,
    [input.productId,input.approved?'ACTIVE':'RESTRICTED'],
  );
  await outbox(client,'CommerceProduct',input.productId,input.approved?'CommerceProductApproved':'CommerceProductRejected',{productId:input.productId,reviewerUserId:input.reviewerUserId,reason:input.reason});
  return product.rows[0];
}

export async function listStore(client:PoolClient,limit=50){
  const result=await client.query(
    `SELECT l.listing_id,l.seller_id,l.product_id,l.sku_id,l.price_minor,l.sale_price_minor,l.sale_price_starts_at,l.sale_price_ends_at,l.currency,
      l.fulfillment_methods,p.title,p.short_description,p.category_code,p.species_applicability,p.life_stage_applicability,
      s.variant_title,s.options,cs.trading_name,
      COALESCE((SELECT SUM(i.on_hand_quantity-i.reserved_quantity) FROM commerce_inventory_items i WHERE i.sku_id=l.sku_id AND i.seller_id=l.seller_id),0)::int AS available_quantity
     FROM commerce_listings l
     JOIN commerce_products p ON p.product_id=l.product_id
     JOIN commerce_skus s ON s.sku_id=l.sku_id
     JOIN commerce_sellers cs ON cs.seller_id=l.seller_id
     WHERE l.status='ACTIVE' AND p.status='ACTIVE' AND p.moderation_status='APPROVED' AND cs.status='ACTIVE' AND cs.is_verified
     ORDER BY l.created_at DESC LIMIT $1`,
    [Math.min(limit,100)],
  );
  return result.rows;
}

function effectivePrice(row:any,now:Date){
  if(row.sale_price_minor && row.sale_price_starts_at && row.sale_price_ends_at){
    const start=new Date(row.sale_price_starts_at),end=new Date(row.sale_price_ends_at);
    if(now>=start&&now<=end)return Number(row.sale_price_minor);
  }
  return Number(row.price_minor);
}

export async function createCheckout(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;householdId?:string;items:Array<{listingId:string;quantity:number}>;
  shippingAddressCiphertext:string;maskedAddressSummary:string;
}){
  if(!/^(enc:|vault:)/.test(input.shippingAddressCiphertext))throw httpError('COMMERCE_SHIPPING_ADDRESS_MUST_BE_ENCRYPTED_REFERENCE',400);
  if(!input.items.length||input.items.length>50)throw httpError('COMMERCE_CHECKOUT_ITEMS_INVALID',400);
  if(input.householdId){
    const allowed=await client.query(`SELECT EXISTS(SELECT 1 FROM household_members WHERE household_id=$1 AND user_id=$2 AND status='ACTIVE') AS allowed`,[input.householdId,input.actorUserId]);
    if(allowed.rows[0]?.allowed!==true)throw httpError('COMMERCE_HOUSEHOLD_ACCESS_DENIED',403);
  }
  const normalized=input.items.map(i=>({listingId:i.listingId,quantity:Number(i.quantity)}));
  if(normalized.some(i=>!Number.isInteger(i.quantity)||i.quantity<=0||i.quantity>100))throw httpError('COMMERCE_ITEM_QUANTITY_INVALID',400);
  const scope='commerce:checkout:create',fingerprint=fp({...input,shippingAddressCiphertext:'[ENCRYPTED]'});
  const prior=await idem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint);
  if(prior)return {checkout:prior.response_body,replayed:true};

  const now=new Date(),expiresAt=new Date(now.getTime()+15*60*1000);
  const checkoutId=`checkout-${generateUUIDv7()}`,orderId=`order-${generateUUIDv7()}`;
  const rows:any[]=[];let currency:string|undefined,total=0;
  for(const item of normalized){
    const listing=await client.query(
      `SELECT l.*,p.title,p.short_description,p.category_code,p.status AS product_status,p.moderation_status,p.safety_classification,p.is_live_animal,p.prescription_restricted,
        s.variant_title,s.sku_code,cs.trading_name,cs.status AS seller_status,cs.is_verified AS seller_verified
       FROM commerce_listings l JOIN commerce_products p ON p.product_id=l.product_id JOIN commerce_skus s ON s.sku_id=l.sku_id
       JOIN commerce_sellers cs ON cs.seller_id=l.seller_id
       WHERE l.listing_id=$1 FOR UPDATE OF l`,
      [item.listingId],
    );
    if(!listing.rowCount)throw httpError('COMMERCE_LISTING_NOT_FOUND',404);
    const row=listing.rows[0];
    if(row.status!=='ACTIVE'||row.product_status!=='ACTIVE'||row.moderation_status!=='APPROVED'||row.seller_status!=='ACTIVE'||row.seller_verified!==true)throw httpError('COMMERCE_LISTING_NOT_PURCHASABLE',409);
    if(row.is_live_animal||row.prescription_restricted||row.safety_classification==='PROHIBITED')throw httpError('COMMERCE_PRODUCT_POLICY_BLOCKED',409);
    if(currency&&currency!==row.currency)throw httpError('COMMERCE_MIXED_CURRENCY_CHECKOUT_UNSUPPORTED',400);
    currency=row.currency;
    const inventory=await client.query(
      `SELECT * FROM commerce_inventory_items WHERE seller_id=$1 AND sku_id=$2 ORDER BY (on_hand_quantity-reserved_quantity) DESC FOR UPDATE`,
      [row.seller_id,row.sku_id],
    );
    const target=inventory.rows.find((x:any)=>Number(x.on_hand_quantity)-Number(x.reserved_quantity)>=item.quantity);
    if(!target)throw httpError('COMMERCE_INSUFFICIENT_INVENTORY',409);
    const unitPrice=effectivePrice(row,now),subtotal=unitPrice*item.quantity;total+=subtotal;
    rows.push({row,item,target,unitPrice,subtotal});
  }
  if(!currency||total<=0)throw httpError('COMMERCE_CHECKOUT_TOTAL_INVALID',400);

  await client.query(
    `INSERT INTO commerce_checkouts(
      checkout_id,buyer_user_id,household_id,status,currency,items_subtotal_minor,shipping_total_minor,tax_total_minor,discount_total_minor,
      grand_total_minor,shipping_address_ciphertext,masked_address_summary,expires_at
     ) VALUES($1,$2,$3,'RESERVED',$4,$5,0,0,0,$5,$6,$7,$8)`,
    [checkoutId,input.actorUserId,input.householdId||null,currency,total,input.shippingAddressCiphertext,input.maskedAddressSummary,expiresAt.toISOString()],
  );
  for(const {row,item,target,unitPrice,subtotal} of rows){
    const snapshot={productId:row.product_id,skuId:row.sku_id,productTitle:row.title,variantTitle:row.variant_title,skuCode:row.sku_code,sellerTradingName:row.trading_name};
    await client.query(
      `INSERT INTO commerce_checkout_items(checkout_item_id,checkout_id,seller_id,listing_id,product_id,sku_id,quantity,unit_price_minor,subtotal_minor,currency,product_snapshot)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [`checkout-item-${generateUUIDv7()}`,checkoutId,row.seller_id,row.listing_id,row.product_id,row.sku_id,item.quantity,unitPrice,subtotal,currency,JSON.stringify(snapshot)],
    );
    const reservationId=`reservation-${generateUUIDv7()}`;
    await client.query(
      `INSERT INTO commerce_inventory_reservations(reservation_id,checkout_id,seller_id,sku_id,inventory_item_id,quantity,status,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,'ACTIVE',$7)`,
      [reservationId,checkoutId,row.seller_id,row.sku_id,target.inventory_item_id,item.quantity,expiresAt.toISOString()],
    );
    await client.query(`UPDATE commerce_inventory_items SET reserved_quantity=reserved_quantity+$2,last_adjusted_at=now(),version=version+1 WHERE inventory_item_id=$1`,[target.inventory_item_id,item.quantity]);
  }
  await client.query(
    `INSERT INTO commerce_orders(
      order_id,buyer_user_id,household_id,checkout_id,status,currency,items_subtotal_minor,shipping_total_minor,tax_total_minor,discount_total_minor,total_minor,
      shipping_address_ciphertext,masked_address_summary,payment_status
     ) VALUES($1,$2,$3,$4,'PENDING_PAYMENT',$5,$6,0,0,0,$6,$7,$8,'PENDING')`,
    [orderId,input.actorUserId,input.householdId||null,checkoutId,currency,total,input.shippingAddressCiphertext,input.maskedAddressSummary],
  );
  const checkout={checkoutId,orderId,buyerUserId:input.actorUserId,status:'RESERVED',currency,grandTotalMinor:total,maskedAddressSummary:input.maskedAddressSummary,expiresAt:expiresAt.toISOString(),items:rows.map(({row,item,unitPrice,subtotal})=>({listingId:row.listing_id,sellerId:row.seller_id,skuId:row.sku_id,quantity:item.quantity,unitPriceMinor:unitPrice,subtotalMinor:subtotal}))};
  await saveIdem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint,checkoutId,201,checkout);
  await outbox(client,'CommerceCheckout',checkoutId,'CommerceCheckoutReserved',{checkoutId,orderId,buyerUserId:input.actorUserId,totalMinor:total,currency});
  return {checkout,replayed:false};
}

async function ensureLedgerAccount(client:PoolClient,code:string,name:string,type:'ASSET'|'LIABILITY'|'REVENUE'|'EXPENSE',currency:string){
  const existing=await client.query(`SELECT account_id FROM finance_ledger_accounts WHERE code=$1 AND currency=$2 LIMIT 1`,[code,currency]);
  if(existing.rowCount)return existing.rows[0].account_id as string;
  const id=`ledger-account-${generateUUIDv7()}`;
  await client.query(`INSERT INTO finance_ledger_accounts(account_id,code,name,account_type,currency) VALUES($1,$2,$3,$4,$5)`,[id,code,name,type,currency]);
  return id;
}

export async function settleCommercePayment(client:PoolClient,input:{
  providerEventId:string;orderId:string;provider:string;providerTransactionId:string;settledAmountMinor:number;currency:string;status:'SUCCESS'|'FAILED';providerFeeMinor:number;
}){
  const prior=await client.query(`SELECT * FROM commerce_payment_transactions WHERE provider=$1 AND provider_transaction_id=$2 LIMIT 1`,[input.provider,input.providerTransactionId]);
  if(prior.rowCount)return {duplicate:true,payment:prior.rows[0]};
  const orderResult=await client.query(`SELECT * FROM commerce_orders WHERE order_id=$1 FOR UPDATE`,[input.orderId]);
  if(!orderResult.rowCount)throw httpError('COMMERCE_ORDER_NOT_FOUND',404);
  const order=orderResult.rows[0];
  if(order.payment_status==='SUCCEEDED')throw httpError('COMMERCE_ORDER_ALREADY_PAID',409);
  if(input.status==='SUCCESS'){
    if(Number(order.total_minor)!==input.settledAmountMinor||order.currency!==input.currency)throw httpError('COMMERCE_PAYMENT_AMOUNT_OR_CURRENCY_MISMATCH',409);
    const checkout=await client.query(`SELECT * FROM commerce_checkouts WHERE checkout_id=$1 FOR UPDATE`,[order.checkout_id]);
    if(!checkout.rowCount||checkout.rows[0].status!=='RESERVED'||new Date(checkout.rows[0].expires_at).getTime()<Date.now())throw httpError('COMMERCE_CHECKOUT_NOT_PAYABLE',409);
  }
  const paymentId=`commerce-payment-${generateUUIDv7()}`;
  const payment=await client.query(
    `INSERT INTO commerce_payment_transactions(
      commerce_payment_transaction_id,order_id,provider,provider_transaction_id,settled_amount_minor,currency,status,provider_fee_minor,confirmed_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $7='SUCCESS' THEN now() ELSE NULL END) RETURNING *`,
    [paymentId,input.orderId,input.provider,input.providerTransactionId,input.settledAmountMinor,input.currency,input.status,input.providerFeeMinor],
  );
  if(input.status==='FAILED'){
    await client.query(`UPDATE commerce_orders SET payment_status='FAILED',updated_at=now(),version=version+1 WHERE order_id=$1`,[input.orderId]);
    await outbox(client,'CommerceOrder',input.orderId,'CommercePaymentFailed',{orderId:input.orderId,provider:input.provider,providerTransactionId:input.providerTransactionId});
    return {duplicate:false,payment:payment.rows[0],orderStatus:'PENDING_PAYMENT'};
  }

  const checkoutItems=await client.query(`SELECT * FROM commerce_checkout_items WHERE checkout_id=$1 ORDER BY seller_id,checkout_item_id`,[order.checkout_id]);
  const reservations=await client.query(`SELECT * FROM commerce_inventory_reservations WHERE checkout_id=$1 AND status='ACTIVE' FOR UPDATE`,[order.checkout_id]);
  if(reservations.rowCount!==checkoutItems.rowCount)throw httpError('COMMERCE_RESERVATION_INTEGRITY_FAILURE',409);
  for(const reservation of reservations.rows){
    const inventory=await client.query(`SELECT * FROM commerce_inventory_items WHERE inventory_item_id=$1 FOR UPDATE`,[reservation.inventory_item_id]);
    if(!inventory.rowCount||Number(inventory.rows[0].reserved_quantity)<Number(reservation.quantity)||Number(inventory.rows[0].on_hand_quantity)<Number(reservation.quantity))throw httpError('COMMERCE_INVENTORY_COMMIT_FAILURE',409);
    await client.query(
      `UPDATE commerce_inventory_items SET on_hand_quantity=on_hand_quantity-$2,reserved_quantity=reserved_quantity-$2,last_adjusted_at=now(),version=version+1 WHERE inventory_item_id=$1`,
      [reservation.inventory_item_id,reservation.quantity],
    );
    await client.query(`UPDATE commerce_inventory_reservations SET status='COMMITTED',committed_at=now() WHERE reservation_id=$1`,[reservation.reservation_id]);
  }

  const sellerIds=[...new Set(checkoutItems.rows.map((x:any)=>String(x.seller_id)))] as string[];
  for(const sellerId of sellerIds){
    const items=checkoutItems.rows.filter((x:any)=>x.seller_id===sellerId);
    const subtotal=items.reduce((sum:number,x:any)=>sum+Number(x.subtotal_minor),0);
    const commissionRateBps=1000,commission=Math.floor(subtotal*commissionRateBps/10000),net=subtotal-commission;
    const sellerOrderId=`seller-order-${generateUUIDv7()}`;
    await client.query(
      `INSERT INTO commerce_seller_orders(
        seller_order_id,order_id,seller_id,status,items_subtotal_minor,shipping_fee_minor,tax_minor,discount_minor,seller_gross_minor,
        commission_rate_bps,commission_minor,seller_net_minor,currency,fulfillment_method
       ) VALUES($1,$2,$3,'PENDING',$4,0,0,0,$4,$5,$6,$7,$8,'PLATFORM_DELIVERY')`,
      [sellerOrderId,input.orderId,sellerId,subtotal,commissionRateBps,commission,net,order.currency],
    );
    for(const item of items){
      await client.query(
        `INSERT INTO commerce_order_items(
          order_item_id,order_id,seller_order_id,seller_id,listing_id,sku_id,product_id,product_snapshot,quantity_ordered,unit_price_minor,subtotal_minor,currency
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)`,
        [`order-item-${generateUUIDv7()}`,input.orderId,sellerOrderId,sellerId,item.listing_id,item.sku_id,item.product_id,JSON.stringify(item.product_snapshot),item.quantity,item.unit_price_minor,item.subtotal_minor,item.currency],
      );
    }
  }

  await client.query(`UPDATE commerce_orders SET status='CONFIRMED',payment_status='SUCCEEDED',updated_at=now(),version=version+1 WHERE order_id=$1`,[input.orderId]);
  await client.query(`UPDATE commerce_checkouts SET status='COMPLETED',completed_at=now(),updated_at=now(),version=version+1 WHERE checkout_id=$1`,[order.checkout_id]);

  const cash=await ensureLedgerAccount(client,'COMMERCE_CASH','Commerce Cash','ASSET',order.currency);
  const liability=await ensureLedgerAccount(client,'COMMERCE_CUSTOMER_FUNDS','Commerce Customer Funds','LIABILITY',order.currency);
  const journalId=`journal-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO finance_ledger_journals(journal_id,journal_type,source_type,source_id,currency,status,total_amount_minor,description)
     VALUES($1,'CUSTOMER_PAYMENT','COMMERCE_PAYMENT',$2,$3,'DRAFT',$4,$5)`,
    [journalId,input.orderId,order.currency,order.total_minor,`Commerce order ${input.orderId} payment`],
  );
  await client.query(
    `INSERT INTO finance_ledger_entries(entry_id,journal_id,account_id,direction,amount_minor,currency,reference) VALUES
     ($1,$2,$3,'DEBIT',$5,$6,$7),($4,$2,$8,'CREDIT',$5,$6,$7)`,
    [`entry-${generateUUIDv7()}`,journalId,cash,`entry-${generateUUIDv7()}`,order.total_minor,order.currency,input.providerTransactionId,liability],
  );
  await client.query(`SELECT petos_post_financial_journal($1)`,[journalId]);
  await outbox(client,'CommerceOrder',input.orderId,'CommerceOrderPaid',{orderId:input.orderId,paymentId,provider:input.provider,providerTransactionId:input.providerTransactionId,totalMinor:Number(order.total_minor),currency:order.currency});
  return {duplicate:false,payment:payment.rows[0],orderStatus:'CONFIRMED',journalId};
}

export async function getCommerceOrder(client:PoolClient,orderId:string,actorUserId:string){
  const access=await client.query(`SELECT petos_can_access_commerce_order($1,$2) AS allowed`,[orderId,actorUserId]);
  if(access.rows[0]?.allowed!==true)throw httpError('COMMERCE_ORDER_ACCESS_DENIED',403);
  const order=await client.query(
    `SELECT order_id,buyer_user_id,household_id,checkout_id,status,currency,items_subtotal_minor,shipping_total_minor,tax_total_minor,discount_total_minor,
      total_minor,masked_address_summary,payment_status,version,created_at,updated_at
     FROM commerce_orders WHERE order_id=$1 LIMIT 1`,
    [orderId],
  );
  if(!order.rowCount)throw httpError('COMMERCE_ORDER_NOT_FOUND',404);
  const sellerOrders=await client.query(`SELECT * FROM commerce_seller_orders WHERE order_id=$1 ORDER BY seller_id`,[orderId]);
  const items=await client.query(`SELECT * FROM commerce_order_items WHERE order_id=$1 ORDER BY order_item_id`,[orderId]);
  return {order:order.rows[0],sellerOrders:sellerOrders.rows,items:items.rows};
}

export async function transitionSellerOrder(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;sellerOrderId:string;nextStatus:string}){
  const current=await client.query(`SELECT * FROM commerce_seller_orders WHERE seller_order_id=$1 FOR UPDATE`,[input.sellerOrderId]);
  if(!current.rowCount)throw httpError('SELLER_ORDER_NOT_FOUND',404);
  const row=current.rows[0];
  const allowed=await client.query(`SELECT petos_can_manage_seller($1,$2) AS allowed`,[row.seller_id,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true)throw httpError('SELLER_ORDER_MANAGEMENT_DENIED',403);
  const transitions:Record<string,string[]>={
    PENDING:['ACCEPTED','CANCELLED'],ACCEPTED:['PREPARING','CANCELLED'],PREPARING:['READY_FOR_DISPATCH'],
    READY_FOR_DISPATCH:['SHIPPED','READY_FOR_PICKUP'],SHIPPED:['OUT_FOR_DELIVERY','DELIVERED'],OUT_FOR_DELIVERY:['DELIVERED'],
    READY_FOR_PICKUP:['PICKED_UP'],DELIVERED:['CLOSED','RETURN_IN_PROGRESS'],PICKED_UP:['CLOSED','RETURN_IN_PROGRESS'],RETURN_IN_PROGRESS:['CLOSED'],
  };
  if(!(transitions[row.status]||[]).includes(input.nextStatus))throw httpError('SELLER_ORDER_TRANSITION_INVALID',409);
  const scope=`commerce:seller-order:transition:${input.sellerOrderId}:${row.status}`,fingerprint=fp(input);
  const prior=await idem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint);
  if(prior)return {sellerOrder:prior.response_body,replayed:true};
  const result=await client.query(`UPDATE commerce_seller_orders SET status=$2,updated_at=now() WHERE seller_order_id=$1 RETURNING *`,[input.sellerOrderId,input.nextStatus]);
  await saveIdem(client,input.actorUserId,scope,input.idempotencyKey,fingerprint,input.sellerOrderId,200,result.rows[0]);
  await outbox(client,'CommerceSellerOrder',input.sellerOrderId,'CommerceSellerOrderStatusChanged',{sellerOrderId:input.sellerOrderId,from:row.status,to:input.nextStatus});
  return {sellerOrder:result.rows[0],replayed:false};
}
