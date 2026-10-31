import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { generateUUIDv7 } from '../../src/pet-os/kernel/ids';

const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const COMMISSION_BPS=1500;

function paymentAccountCode(provider:string){
  return provider==='MPESA_SAFARICOM'?'ASSET_CASH_CLEARING_MPESA':'ASSET_CASH_CLEARING_CARD';
}

async function ensureAccount(client:PoolClient,code:string,type:string,currency:string,name:string){
  const accountId=`ledger-${currency}-${code}`;
  await client.query(
    `INSERT INTO finance_ledger_accounts(account_id,code,name,account_type,currency)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(code,currency) DO NOTHING`,
    [accountId,code,name,type,currency],
  );
  const result=await client.query(`SELECT account_id FROM finance_ledger_accounts WHERE code=$1 AND currency=$2`,[code,currency]);
  return String(result.rows[0].account_id);
}

async function postJournal(client:PoolClient,input:{
  journalType:string;sourceType:string;sourceId:string;currency:string;totalAmountMinor:number;description:string;
  entries:Array<{code:string;type:string;name:string;direction:'DEBIT'|'CREDIT';amountMinor:number;providerId?:string;businessId?:string;bookingId?:string;reference?:string}>;
}){
  const journalId=`journal-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO finance_ledger_journals(journal_id,journal_type,source_type,source_id,currency,total_amount_minor,description)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [journalId,input.journalType,input.sourceType,input.sourceId,input.currency,input.totalAmountMinor,input.description],
  );
  for(const entry of input.entries){
    const accountId=await ensureAccount(client,entry.code,entry.type,input.currency,entry.name);
    await client.query(
      `INSERT INTO finance_ledger_entries(entry_id,journal_id,account_id,direction,amount_minor,currency,provider_id,business_id,booking_id,reference)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [`entry-${generateUUIDv7()}`,journalId,accountId,entry.direction,entry.amountMinor,input.currency,entry.providerId||null,entry.businessId||null,entry.bookingId||null,entry.reference||null],
    );
  }
  await client.query(`SELECT petos_post_financial_journal($1)`,[journalId]);
  return journalId;
}

export async function createBookingPaymentIntent(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;bookingId:string;paymentMethodType:'MPESA'|'CARD'|'BANK_TRANSFER';provider:'MPESA_SAFARICOM'|'CARD_GATEWAY'|'MOCK_PROVIDER';
}){
  const bookingResult=await client.query(
    `SELECT b.*,p.display_name AS provider_name,o.title AS service_title
       FROM bookings b JOIN provider_profiles p ON p.provider_id=b.provider_id
       JOIN provider_service_offerings o ON o.offering_id=b.offering_id
      WHERE b.booking_id=$1 LIMIT 1`,
    [input.bookingId],
  );
  if(!bookingResult.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  const b=bookingResult.rows[0];
  if(b.owner_user_id!==input.actorUserId) throw Object.assign(new Error('PAYMENT_BOOKING_OWNER_REQUIRED'),{statusCode:403});
  if(!['CONFIRMED','IN_PROGRESS','COMPLETED'].includes(String(b.status))) throw Object.assign(new Error('PAYMENT_BOOKING_STATUS_INVALID'),{statusCode:409});
  const amountMinor=Number(b.price_snapshot?.amountMinorUnits);
  const currency=String(b.price_snapshot?.currency||'');
  if(!Number.isSafeInteger(amountMinor)||amountMinor<=0||!currency) throw Object.assign(new Error('BOOKING_PRICE_SNAPSHOT_INVALID'),{statusCode:500});
  const scope=`finance:payment-intent:${input.bookingId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(
    `SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,
    [input.actorUserId,scope,input.idempotencyKey],
  );
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {paymentIntent:prior.rows[0].response_body,replayed:true};
  }
  const existing=await client.query(
    `SELECT * FROM finance_payment_intents WHERE booking_id=$1 AND status IN ('CREATED','REQUIRES_ACTION','PROCESSING','SUCCEEDED') ORDER BY created_at DESC LIMIT 1`,
    [input.bookingId],
  );
  if(existing.rowCount) throw Object.assign(new Error('BOOKING_PAYMENT_INTENT_ALREADY_ACTIVE'),{statusCode:409});
  const paymentIntentId=`payment-intent-${generateUUIDv7()}`;
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  const metadata={serviceTitle:b.service_title,providerName:b.provider_name,petCount:Number(b.pet_count)};
  const result=await client.query(
    `INSERT INTO finance_payment_intents(payment_intent_id,booking_id,payer_user_id,household_id,amount_minor,currency,payment_method_type,provider,status,expires_at,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'CREATED',$9,$10::jsonb) RETURNING *`,
    [paymentIntentId,input.bookingId,input.actorUserId,b.household_id,amountMinor,currency,input.paymentMethodType,input.provider,expiresAt,JSON.stringify(metadata)],
  );
  const intent={
    paymentIntentId,bookingId:input.bookingId,payerUserId:input.actorUserId,householdId:b.household_id,amountMinor,currency,
    paymentMethodType:input.paymentMethodType,provider:input.provider,status:'CREATED',expiresAt,metadata,
    createdAt:new Date(result.rows[0].created_at).toISOString(),updatedAt:new Date(result.rows[0].updated_at).toISOString(),
  };
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload)
     VALUES($1,'PaymentIntent',$2,'PaymentIntentCreated',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,paymentIntentId,JSON.stringify({paymentIntentId,bookingId:input.bookingId,amountMinor,currency,provider:input.provider})],
  );
  await client.query(
    `INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body)
     VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,paymentIntentId,JSON.stringify(intent)],
  );
  return {paymentIntent:intent,replayed:false};
}

export async function settlePaymentIntent(client:PoolClient,input:{
  providerEventId:string;paymentIntentId:string;providerTransactionId:string;settledAmountMinor:number;currency:string;status:'SUCCESS'|'FAILED';providerFeeMinor?:number;
}){
  const duplicate=await client.query(`SELECT event_id,status FROM finance_webhook_events WHERE provider_event_id=$1 LIMIT 1`,[input.providerEventId]);
  if(duplicate.rowCount) return {duplicate:true,status:duplicate.rows[0].status};
  const intentResult=await client.query(`SELECT * FROM finance_payment_intents WHERE payment_intent_id=$1 FOR UPDATE`,[input.paymentIntentId]);
  if(!intentResult.rowCount) throw Object.assign(new Error('PAYMENT_INTENT_NOT_FOUND'),{statusCode:404});
  const intent=intentResult.rows[0];
  await client.query(
    `INSERT INTO finance_webhook_events(event_id,provider,provider_event_id,event_type,status,payload_summary)
     VALUES($1,$2,$3,'PAYMENT_SETTLEMENT','PENDING',$4::jsonb)`,
    [`webhook-${generateUUIDv7()}`,intent.provider,input.providerEventId,JSON.stringify({paymentIntentId:input.paymentIntentId,providerTransactionId:input.providerTransactionId,status:input.status})],
  );
  if(intent.status==='SUCCEEDED'){
    await client.query(`UPDATE finance_webhook_events SET status='IGNORED',processed_at=now() WHERE provider_event_id=$1`,[input.providerEventId]);
    return {duplicate:true,status:'PROCESSED'};
  }
  if(!['CREATED','REQUIRES_ACTION','PROCESSING'].includes(String(intent.status))) throw Object.assign(new Error('PAYMENT_INTENT_NOT_SETTLEABLE'),{statusCode:409});
  if(input.currency!==intent.currency || input.settledAmountMinor!==Number(intent.amount_minor)) throw Object.assign(new Error('PAYMENT_SETTLEMENT_AMOUNT_MISMATCH'),{statusCode:409});
  const txId=`payment-tx-${generateUUIDv7()}`;
  await client.query(
    `INSERT INTO finance_payment_transactions(payment_transaction_id,payment_intent_id,booking_id,provider,provider_transaction_id,transaction_type,status,requested_amount_minor,settled_amount_minor,currency,provider_fee_minor,initiated_at,confirmed_at)
     VALUES($1,$2,$3,$4,$5,'CHARGE',$6,$7,$8,$9,$10,now(),CASE WHEN $6='SUCCESS' THEN now() ELSE NULL END)`,
    [txId,input.paymentIntentId,intent.booking_id,intent.provider,input.providerTransactionId,input.status,Number(intent.amount_minor),input.settledAmountMinor,input.currency,input.providerFeeMinor||0],
  );
  if(input.status==='FAILED'){
    await client.query(`UPDATE finance_payment_intents SET status='FAILED',failed_at=now(),updated_at=now(),failure_reason='Provider settlement failed' WHERE payment_intent_id=$1`,[input.paymentIntentId]);
    await client.query(`UPDATE finance_webhook_events SET status='PROCESSED',processed_at=now() WHERE provider_event_id=$1`,[input.providerEventId]);
    return {duplicate:false,paymentTransactionId:txId,status:'FAILED'};
  }
  const providerFeeMinor=input.providerFeeMinor||0;
  if(providerFeeMinor<0 || providerFeeMinor>input.settledAmountMinor) throw Object.assign(new Error('PAYMENT_PROVIDER_FEE_INVALID'),{statusCode:409});
  const netClearingMinor=input.settledAmountMinor-providerFeeMinor;
  const paymentEntries:Array<{code:string;type:string;name:string;direction:'DEBIT'|'CREDIT';amountMinor:number;bookingId:string}>=[];
  if(netClearingMinor>0){
    paymentEntries.push({code:paymentAccountCode(intent.provider),type:'ASSET',name:'Payment clearing cash',direction:'DEBIT',amountMinor:netClearingMinor,bookingId:intent.booking_id});
  }
  if(providerFeeMinor>0){
    paymentEntries.push({code:'EXPENSE_PAYMENT_PROCESSOR_FEES',type:'EXPENSE',name:'Payment processor fees',direction:'DEBIT',amountMinor:providerFeeMinor,bookingId:intent.booking_id});
  }
  paymentEntries.push({code:'LIABILITY_CUSTOMER_PREPAYMENTS',type:'LIABILITY',name:'Customer prepayments',direction:'CREDIT',amountMinor:input.settledAmountMinor,bookingId:intent.booking_id});
  await postJournal(client,{
    journalType:'CUSTOMER_PAYMENT',sourceType:'BOOKING_PAYMENT',sourceId:txId,currency:input.currency,totalAmountMinor:input.settledAmountMinor,
    description:`Customer payment for booking ${intent.booking_id}`,
    entries:paymentEntries,
  });
  await client.query(`UPDATE finance_payment_intents SET status='SUCCEEDED',succeeded_at=now(),updated_at=now(),version=version+1 WHERE payment_intent_id=$1`,[input.paymentIntentId]);
  const booking=await client.query(`SELECT b.*,p.display_name,o.title FROM bookings b JOIN provider_profiles p ON p.provider_id=b.provider_id JOIN provider_service_offerings o ON o.offering_id=b.offering_id WHERE b.booking_id=$1`,[intent.booking_id]);
  const br=booking.rows[0];
  const receiptId=`receipt-${generateUUIDv7()}`;
  const receiptNumber=`REC-${new Date().toISOString().slice(0,7).replace('-','')}-${receiptId.slice(-8).toUpperCase()}`;
  await client.query(
    `INSERT INTO finance_receipts(receipt_id,receipt_number,booking_id,payment_intent_id,payment_transaction_id,payer_user_id,provider_id,service_title,amount_minor,currency,payment_method,payment_reference,issued_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
    [receiptId,receiptNumber,intent.booking_id,input.paymentIntentId,txId,intent.payer_user_id,br.provider_id,br.title,input.settledAmountMinor,input.currency,intent.payment_method_type,input.providerTransactionId],
  );
  await client.query(`UPDATE finance_webhook_events SET status='PROCESSED',processed_at=now() WHERE provider_event_id=$1`,[input.providerEventId]);
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'PaymentTransaction',$2,'BookingPaymentSucceeded',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,txId,JSON.stringify({paymentTransactionId:txId,paymentIntentId:input.paymentIntentId,bookingId:intent.booking_id,amountMinor:input.settledAmountMinor,currency:input.currency,receiptId})],
  );
  return {duplicate:false,paymentTransactionId:txId,receiptId,status:'SUCCESS'};
}

export async function finalizeCompletedBookingEarning(client:PoolClient,bookingId:string){
  const existing=await client.query(`SELECT * FROM finance_provider_earnings WHERE booking_id=$1 LIMIT 1`,[bookingId]);
  if(existing.rowCount) return {earning:existing.rows[0],replayed:true};
  const booking=await client.query(`SELECT * FROM bookings WHERE booking_id=$1 FOR UPDATE`,[bookingId]);
  if(!booking.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  const b=booking.rows[0];
  if(b.status!=='COMPLETED') throw Object.assign(new Error('EARNING_REQUIRES_COMPLETED_BOOKING'),{statusCode:409});
  const intent=await client.query(`SELECT * FROM finance_payment_intents WHERE booking_id=$1 AND status='SUCCEEDED' LIMIT 1`,[bookingId]);
  if(!intent.rowCount) throw Object.assign(new Error('EARNING_REQUIRES_SUCCESSFUL_PAYMENT'),{statusCode:409});
  const gross=Number(intent.rows[0].amount_minor);
  const currency=String(intent.rows[0].currency);
  const commission=Math.floor(gross*COMMISSION_BPS/10000);
  const net=gross-commission;
  const earningId=`earning-${generateUUIDv7()}`;
  await postJournal(client,{
    journalType:'SERVICE_FULFILLMENT',sourceType:'SERVICE_COMPLETION',sourceId:bookingId,currency,totalAmountMinor:gross,
    description:`Service fulfillment for booking ${bookingId}`,
    entries:[
      {code:'LIABILITY_CUSTOMER_PREPAYMENTS',type:'LIABILITY',name:'Customer prepayments',direction:'DEBIT',amountMinor:gross,bookingId,providerId:b.provider_id,businessId:b.business_id||undefined},
      {code:'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',type:'LIABILITY',name:'Provider payable available',direction:'CREDIT',amountMinor:net,bookingId,providerId:b.provider_id,businessId:b.business_id||undefined},
      ...(commission>0?[{code:'REVENUE_PLATFORM_COMMISSION',type:'REVENUE',name:'Platform commission',direction:'CREDIT' as const,amountMinor:commission,bookingId,providerId:b.provider_id,businessId:b.business_id||undefined}]:[]),
    ],
  });
  await client.query(
    `INSERT INTO finance_provider_earnings(earning_id,booking_id,provider_id,business_id,gross_amount_minor,platform_commission_minor,net_amount_minor,currency,status,available_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'AVAILABLE',now())`,
    [earningId,bookingId,b.provider_id,b.business_id||null,gross,commission,net,currency],
  );
  await client.query(
    `INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ProviderEarning',$2,'ProviderEarningAvailable',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,earningId,JSON.stringify({earningId,bookingId,providerId:b.provider_id,grossAmountMinor:gross,platformCommissionMinor:commission,netAmountMinor:net,currency})],
  );
  return {earning:{earningId,bookingId,providerId:b.provider_id,businessId:b.business_id||undefined,grossAmountMinor:gross,platformCommissionMinor:commission,netAmountMinor:net,currency,status:'AVAILABLE'},replayed:false};
}

export async function getBookingFinance(client:PoolClient,bookingId:string,actorUserId:string){
  const allowed=await client.query(`SELECT petos_finance_booking_access($1,$2) AS allowed`,[bookingId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('FINANCE_BOOKING_ACCESS_DENIED'),{statusCode:403});
  const [intents,transactions,receipts,refunds]=await Promise.all([
    client.query(`SELECT payment_intent_id,amount_minor,currency,payment_method_type,provider,status,expires_at,created_at FROM finance_payment_intents WHERE booking_id=$1 ORDER BY created_at DESC`,[bookingId]),
    client.query(`SELECT payment_transaction_id,provider,provider_transaction_id,transaction_type,status,settled_amount_minor,currency,confirmed_at FROM finance_payment_transactions WHERE booking_id=$1 ORDER BY created_at DESC`,[bookingId]),
    client.query(`SELECT receipt_id,receipt_number,amount_minor,currency,payment_method,payment_reference,issued_at FROM finance_receipts WHERE booking_id=$1 ORDER BY issued_at DESC`,[bookingId]),
    client.query(`SELECT refund_id,reason,requested_amount_minor,settled_amount_minor,currency,status,requested_at,completed_at FROM finance_refunds WHERE booking_id=$1 ORDER BY created_at DESC`,[bookingId]),
  ]);
  return {intents:intents.rows,transactions:transactions.rows,receipts:receipts.rows,refunds:refunds.rows};
}

export async function getProviderFinanceSummary(client:PoolClient,providerId:string,actorUserId:string,currency='KES'){
  const allowed=await client.query(`SELECT petos_provider_finance_access($1,$2) AS allowed`,[providerId,actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('PROVIDER_FINANCE_ACCESS_DENIED'),{statusCode:403});
  const earnings=await client.query(
    `SELECT status,COALESCE(SUM(net_amount_minor),0)::bigint AS amount,COUNT(*)::int AS count
       FROM finance_provider_earnings WHERE provider_id=$1 AND currency=$2 GROUP BY status`,
    [providerId,currency],
  );
  const payouts=await client.query(`SELECT * FROM finance_provider_payouts WHERE provider_id=$1 AND currency=$2 ORDER BY created_at DESC`,[providerId,currency]);
  const destinations=await client.query(`SELECT destination_id,destination_type,status,display_title,masked_identifier,is_default,verified_at FROM finance_payout_destinations WHERE provider_id=$1 ORDER BY created_at DESC`,[providerId]);
  const byStatus=Object.fromEntries(earnings.rows.map((r:any)=>[r.status,Number(r.amount)]));
  return {
    providerId,currency,pendingBalanceMinor:(byStatus.PENDING||0)+(byStatus.HELD||0),availableBalanceMinor:byStatus.AVAILABLE||0,
    reservedBalanceMinor:byStatus.RESERVED_FOR_PAYOUT||0,lifetimePaidMinor:byStatus.PAID||0,
    payouts:payouts.rows,destinations:destinations.rows,
  };
}

export async function createPayoutDestination(client:PoolClient,input:{
  actorUserId:string;idempotencyKey:string;providerId:string;destinationType:'MPESA_B2C'|'BANK_ACCOUNT';displayTitle:string;maskedIdentifier:string;destinationToken:string;isDefault:boolean;
}){
  const allowed=await client.query(`SELECT petos_provider_finance_access($1,$2) AS allowed`,[input.providerId,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('PAYOUT_DESTINATION_ACCESS_DENIED'),{statusCode:403});
  if(/\d{8,}/.test(input.destinationToken)||input.destinationToken.length<8) throw Object.assign(new Error('PAYOUT_DESTINATION_REQUIRES_TOKENIZED_REFERENCE'),{statusCode:400});
  const scope=`finance:payout-destination:${input.providerId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {destination:prior.rows[0].response_body,replayed:true};
  }
  if(input.isDefault) await client.query(`UPDATE finance_payout_destinations SET is_default=false,updated_at=now() WHERE provider_id=$1`,[input.providerId]);
  const destinationId=`payout-destination-${generateUUIDv7()}`;
  const result=await client.query(
    `INSERT INTO finance_payout_destinations(destination_id,provider_id,destination_type,status,display_title,masked_identifier,destination_token,is_default)
     VALUES($1,$2,$3,'PENDING',$4,$5,$6,$7) RETURNING *`,
    [destinationId,input.providerId,input.destinationType,input.displayTitle,input.maskedIdentifier,input.destinationToken,input.isDefault],
  );
  const destination=result.rows[0];
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,destinationId,JSON.stringify(destination)]);
  return {destination,replayed:false};
}

export async function verifyPayoutDestination(client:PoolClient,destinationId:string){
  const result=await client.query(`UPDATE finance_payout_destinations SET status='VERIFIED',verified_at=now(),updated_at=now() WHERE destination_id=$1 AND status='PENDING' RETURNING *`,[destinationId]);
  if(!result.rowCount) throw Object.assign(new Error('PAYOUT_DESTINATION_NOT_PENDING'),{statusCode:409});
  return result.rows[0];
}

export async function requestProviderPayout(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;providerId:string;destinationId:string;currency:string}){
  const allowed=await client.query(`SELECT petos_provider_finance_access($1,$2) AS allowed`,[input.providerId,input.actorUserId]);
  if(allowed.rows[0]?.allowed!==true) throw Object.assign(new Error('PAYOUT_ACCESS_DENIED'),{statusCode:403});
  const destination=await client.query(`SELECT * FROM finance_payout_destinations WHERE destination_id=$1 AND provider_id=$2 AND status='VERIFIED' FOR UPDATE`,[input.destinationId,input.providerId]);
  if(!destination.rowCount) throw Object.assign(new Error('VERIFIED_PAYOUT_DESTINATION_REQUIRED'),{statusCode:409});
  const scope=`finance:payout:${input.providerId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {payout:prior.rows[0].response_body,replayed:true};
  }
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`payout:${input.providerId}:${input.currency}`]);
  const earnings=await client.query(`SELECT * FROM finance_provider_earnings WHERE provider_id=$1 AND currency=$2 AND status='AVAILABLE' ORDER BY available_at,created_at FOR UPDATE`,[input.providerId,input.currency]);
  if(!earnings.rowCount) throw Object.assign(new Error('NO_AVAILABLE_EARNINGS'),{statusCode:409});
  const amount=earnings.rows.reduce((sum:number,row:any)=>sum+Number(row.net_amount_minor),0);
  const payoutId=`payout-${generateUUIDv7()}`;
  const businessId=earnings.rows.find((r:any)=>r.business_id)?.business_id||null;
  await client.query(`INSERT INTO finance_provider_payouts(payout_id,provider_id,business_id,destination_id,amount_minor,currency,status,initiated_at) VALUES($1,$2,$3,$4,$5,$6,'CREATED',now())`,
    [payoutId,input.providerId,businessId,input.destinationId,amount,input.currency]);
  for(const earning of earnings.rows){
    await client.query(`INSERT INTO finance_payout_allocations(allocation_id,payout_id,earning_id,allocated_amount_minor,currency) VALUES($1,$2,$3,$4,$5)`,
      [`allocation-${generateUUIDv7()}`,payoutId,earning.earning_id,Number(earning.net_amount_minor),input.currency]);
  }
  await client.query(`UPDATE finance_provider_earnings SET status='RESERVED_FOR_PAYOUT',payout_id=$1,updated_at=now() WHERE earning_id=ANY($2::text[])`,[payoutId,earnings.rows.map((r:any)=>r.earning_id)]);
  const payout={payoutId,providerId:input.providerId,businessId:businessId||undefined,destinationId:input.destinationId,amountMinor:amount,currency:input.currency,status:'CREATED',allocatedEarningIds:earnings.rows.map((r:any)=>r.earning_id)};
  await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ProviderPayout',$2,'ProviderPayoutRequested',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,payoutId,JSON.stringify(payout)]);
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,payoutId,JSON.stringify(payout)]);
  return {payout,replayed:false};
}

export async function settleProviderPayout(client:PoolClient,input:{payoutId:string;providerReference:string;status:'PAID'|'FAILED';failureReason?:string}){
  const result=await client.query(`SELECT p.*,d.destination_type FROM finance_provider_payouts p JOIN finance_payout_destinations d ON d.destination_id=p.destination_id WHERE p.payout_id=$1 FOR UPDATE`,[input.payoutId]);
  if(!result.rowCount) throw Object.assign(new Error('PAYOUT_NOT_FOUND'),{statusCode:404});
  const p=result.rows[0];
  if(['PAID','FAILED','CANCELLED'].includes(String(p.status))) return {payoutId:input.payoutId,status:p.status,replayed:true};
  if(input.status==='FAILED'){
    await client.query(`UPDATE finance_provider_payouts SET status='FAILED',failed_at=now(),failure_reason=$2,updated_at=now() WHERE payout_id=$1`,[input.payoutId,input.failureReason||'Provider payout failed']);
    await client.query(`UPDATE finance_provider_earnings SET status='AVAILABLE',payout_id=NULL,updated_at=now() WHERE payout_id=$1`,[input.payoutId]);
    return {payoutId:input.payoutId,status:'FAILED',replayed:false};
  }
  await postJournal(client,{
    journalType:'PROVIDER_PAYOUT',sourceType:'PAYOUT',sourceId:input.payoutId,currency:p.currency,totalAmountMinor:Number(p.amount_minor),
    description:`Provider payout ${input.payoutId}`,
    entries:[
      {code:'LIABILITY_PROVIDER_PAYABLE_AVAILABLE',type:'LIABILITY',name:'Provider payable available',direction:'DEBIT',amountMinor:Number(p.amount_minor),providerId:p.provider_id,businessId:p.business_id||undefined},
      {code:'ASSET_CASH_CLEARING_MPESA',type:'ASSET',name:'Payout cash clearing',direction:'CREDIT',amountMinor:Number(p.amount_minor),providerId:p.provider_id,businessId:p.business_id||undefined},
    ],
  });
  await client.query(`UPDATE finance_provider_payouts SET status='PAID',provider_reference=$2,completed_at=now(),updated_at=now() WHERE payout_id=$1`,[input.payoutId,input.providerReference]);
  await client.query(`UPDATE finance_provider_earnings SET status='PAID',updated_at=now() WHERE payout_id=$1`,[input.payoutId]);
  await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'ProviderPayout',$2,'ProviderPayoutPaid',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.payoutId,JSON.stringify({payoutId:input.payoutId,providerId:p.provider_id,amountMinor:Number(p.amount_minor),currency:p.currency,providerReference:input.providerReference})]);
  return {payoutId:input.payoutId,status:'PAID',replayed:false};
}

export async function requestBookingRefund(client:PoolClient,input:{actorUserId:string;idempotencyKey:string;bookingId:string;reason:string;reasonDetails?:string}){
  const booking=await client.query(`SELECT * FROM bookings WHERE booking_id=$1 LIMIT 1`,[input.bookingId]);
  if(!booking.rowCount) throw Object.assign(new Error('BOOKING_NOT_FOUND'),{statusCode:404});
  if(booking.rows[0].owner_user_id!==input.actorUserId) throw Object.assign(new Error('REFUND_BOOKING_OWNER_REQUIRED'),{statusCode:403});
  const earning=await client.query(`SELECT 1 FROM finance_provider_earnings WHERE booking_id=$1 AND status NOT IN ('REVERSED')`,[input.bookingId]);
  if(earning.rowCount) throw Object.assign(new Error('REFUND_AFTER_EARNING_REQUIRES_ADJUSTMENT_WORKFLOW'),{statusCode:409});
  const tx=await client.query(`SELECT * FROM finance_payment_transactions WHERE booking_id=$1 AND status='SUCCESS' AND transaction_type='CHARGE' ORDER BY confirmed_at DESC LIMIT 1`,[input.bookingId]);
  if(!tx.rowCount) throw Object.assign(new Error('REFUND_REQUIRES_SUCCESSFUL_PAYMENT'),{statusCode:409});
  const scope=`finance:refund:${input.bookingId}`;
  const requestFingerprint=fingerprint(input);
  const prior=await client.query(`SELECT request_fingerprint,response_body FROM idempotency_records WHERE actor_user_id=$1 AND scope=$2 AND idempotency_key=$3`,[input.actorUserId,scope,input.idempotencyKey]);
  if(prior.rowCount){
    if(prior.rows[0].request_fingerprint!==requestFingerprint) throw Object.assign(new Error('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'),{statusCode:409});
    return {refund:prior.rows[0].response_body,replayed:true};
  }
  const refundId=`refund-${generateUUIDv7()}`;
  const amount=Number(tx.rows[0].settled_amount_minor);
  const refund={refundId,bookingId:input.bookingId,paymentTransactionId:tx.rows[0].payment_transaction_id,reason:input.reason,requestedAmountMinor:amount,currency:tx.rows[0].currency,status:'REQUESTED'};
  await client.query(`INSERT INTO finance_refunds(refund_id,booking_id,payment_transaction_id,requested_by_user_id,reason,reason_details,requested_amount_minor,currency,status,requested_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'REQUESTED',now())`,
    [refundId,input.bookingId,tx.rows[0].payment_transaction_id,input.actorUserId,input.reason,input.reasonDetails||null,amount,tx.rows[0].currency]);
  await client.query(`INSERT INTO idempotency_records(actor_user_id,scope,idempotency_key,request_fingerprint,resource_id,response_status,response_body) VALUES($1,$2,$3,$4,$5,201,$6::jsonb)`,
    [input.actorUserId,scope,input.idempotencyKey,requestFingerprint,refundId,JSON.stringify(refund)]);
  return {refund,replayed:false};
}

export async function settleRefund(client:PoolClient,input:{refundId:string;providerRefundReference:string;status:'SUCCEEDED'|'FAILED'}){
  const result=await client.query(`SELECT r.*,t.provider FROM finance_refunds r JOIN finance_payment_transactions t ON t.payment_transaction_id=r.payment_transaction_id WHERE r.refund_id=$1 FOR UPDATE`,[input.refundId]);
  if(!result.rowCount) throw Object.assign(new Error('REFUND_NOT_FOUND'),{statusCode:404});
  const r=result.rows[0];
  if(['SUCCEEDED','FAILED','CANCELLED'].includes(String(r.status))) return {refundId:input.refundId,status:r.status,replayed:true};
  if(input.status==='FAILED'){
    await client.query(`UPDATE finance_refunds SET status='FAILED',failure_reason='Provider refund failed' WHERE refund_id=$1`,[input.refundId]);
    return {refundId:input.refundId,status:'FAILED',replayed:false};
  }
  await postJournal(client,{
    journalType:'CUSTOMER_REFUND',sourceType:'REFUND',sourceId:input.refundId,currency:r.currency,totalAmountMinor:Number(r.requested_amount_minor),
    description:`Customer refund ${input.refundId}`,
    entries:[
      {code:'LIABILITY_CUSTOMER_PREPAYMENTS',type:'LIABILITY',name:'Customer prepayments',direction:'DEBIT',amountMinor:Number(r.requested_amount_minor),bookingId:r.booking_id},
      {code:paymentAccountCode(r.provider),type:'ASSET',name:'Payment clearing cash',direction:'CREDIT',amountMinor:Number(r.requested_amount_minor),bookingId:r.booking_id},
    ],
  });
  await client.query(`UPDATE finance_refunds SET status='SUCCEEDED',settled_amount_minor=requested_amount_minor,provider_refund_reference=$2,completed_at=now() WHERE refund_id=$1`,[input.refundId,input.providerRefundReference]);
  await client.query(`INSERT INTO outbox_events(event_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'Refund',$2,'CustomerRefundSucceeded',$3::jsonb)`,
    [`evt-${generateUUIDv7()}`,input.refundId,JSON.stringify({refundId:input.refundId,bookingId:r.booking_id,amountMinor:Number(r.requested_amount_minor),currency:r.currency})]);
  return {refundId:input.refundId,status:'SUCCEEDED',replayed:false};
}

export async function runPaymentReconciliation(client:PoolClient,input:{
  provider:string;periodStart:string;periodEnd:string;currency:string;records:Array<{providerTransactionId:string;amountMinor:number;currency:string;status:string;bookingId?:string}>;
}){
  const runId=`reconciliation-${generateUUIDv7()}`;
  const internal=await client.query(
    `SELECT payment_transaction_id,provider_transaction_id,booking_id,settled_amount_minor,currency,status
       FROM finance_payment_transactions WHERE provider=$1 AND confirmed_at >= $2 AND confirmed_at < $3 AND transaction_type='CHARGE'`,
    [input.provider,input.periodStart,input.periodEnd],
  );
  const internalByProvider=new Map(internal.rows.map((r:any)=>[r.provider_transaction_id,r]));
  const seen=new Set<string>();
  const items:any[]=[];
  for(const record of input.records){
    let classification='MATCHED';
    const local:any=internalByProvider.get(record.providerTransactionId);
    if(seen.has(record.providerTransactionId)) classification='DUPLICATE';
    else if(!local) classification='MISSING_INTERNAL';
    else if(local.currency!==record.currency) classification='CURRENCY_MISMATCH';
    else if(Number(local.settled_amount_minor)!==record.amountMinor) classification='AMOUNT_MISMATCH';
    else if(local.status!==record.status) classification='STATUS_MISMATCH';
    seen.add(record.providerTransactionId);
    items.push({classification,record,local});
  }
  for(const local of internal.rows){
    if(!seen.has(local.provider_transaction_id)) items.push({classification:'MISSING_PROVIDER',record:null,local});
  }
  const matched=items.filter(i=>i.classification==='MATCHED').length;
  const exceptions=items.length-matched;
  const internalTotal=internal.rows.reduce((s:number,r:any)=>s+Number(r.settled_amount_minor||0),0);
  const providerTotal=input.records.reduce((s,r)=>s+r.amountMinor,0);
  await client.query(
    `INSERT INTO finance_reconciliation_runs(run_id,provider,period_start,period_end,status,total_internal_transactions,total_provider_transactions,total_internal_amount_minor,total_provider_amount_minor,matched_count,exception_count,currency,completed_at)
     VALUES($1,$2,$3,$4,'COMPLETED',$5,$6,$7,$8,$9,$10,$11,now())`,
    [runId,input.provider,input.periodStart,input.periodEnd,internal.rows.length,input.records.length,internalTotal,providerTotal,matched,exceptions,input.currency],
  );
  for(const item of items){
    await client.query(
      `INSERT INTO finance_reconciliation_items(item_id,run_id,classification,provider_transaction_id,internal_transaction_id,booking_id,provider_amount_minor,internal_amount_minor,currency,discrepancy_minor,resolution_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [`recon-item-${generateUUIDv7()}`,runId,item.classification,item.record?.providerTransactionId||item.local?.provider_transaction_id||null,
       item.local?.payment_transaction_id||null,item.record?.bookingId||item.local?.booking_id||null,item.record?.amountMinor??null,
       item.local?Number(item.local.settled_amount_minor):null,item.record?.currency||item.local?.currency||input.currency,
       item.record&&item.local?item.record.amountMinor-Number(item.local.settled_amount_minor):null,item.classification==='MATCHED'?'DISMISSED':'UNRESOLVED'],
    );
  }
  return {runId,checkedCount:items.length,matchedCount:matched,exceptionCount:exceptions,totalInternalAmountMinor:internalTotal,totalProviderAmountMinor:providerTotal,items:items.map(i=>i.classification)};
}
