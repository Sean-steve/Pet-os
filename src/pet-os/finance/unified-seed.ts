import {
  asFinancialReceiptId,
  asPaymentIntentId,
  asPaymentTransactionId,
  asProviderEarningId,
  asProviderPayoutDestinationId,
  type HouseholdId,
  type UserId,
} from '../kernel/ids';
import { BookingStore } from '../booking/store';
import { ProviderStore } from '../provider/store';
import { FinanceStore } from './store';

export function seedUnifiedFinanceData(ownerUserId:UserId,householdId:HouseholdId):void{
  const finance=FinanceStore.getInstance();
  finance.reset();
  const booking=BookingStore.getInstance().listBookingsByHousehold(householdId)
    .find(b=>b.ownerUserId===ownerUserId&&['CONFIRMED','IN_PROGRESS','COMPLETED'].includes(b.status));
  if(!booking)return;

  const now=new Date().toISOString();
  const provider=ProviderStore.getInstance().getProvider(booking.providerId);
  const amount=Math.max(1,Number((booking.priceSnapshot as any)?.amountMinorUnits??0));
  const commission=Math.floor(amount*0.15);
  const paymentIntentId=asPaymentIntentId('pay-canonical-'+String(booking.bookingId));
  const transactionId=asPaymentTransactionId('txn-canonical-'+String(booking.bookingId));
  const earningId=asProviderEarningId('earn-canonical-'+String(booking.bookingId));

  finance.savePaymentIntent({
    paymentIntentId,
    bookingId:booking.bookingId,
    payerUserId:ownerUserId,
    householdId,
    amountMinor:amount,
    currency:'KES',
    paymentMethodType:'MPESA',
    provider:'MOCK_PROVIDER',
    providerIntentReference:'CANONICAL-PROTOTYPE-'+String(booking.bookingId),
    status:'SUCCEEDED',
    expiresAt:new Date(Date.now()+86400000).toISOString(),
    idempotencyKey:'canonical-finance-'+String(booking.bookingId),
    metadata:{
      serviceTitle:String((booking.serviceSnapshot as any)?.title||'Pet care service'),
      providerName:String((provider as any)?.displayName||(provider as any)?.legalName||'Verified provider'),
      petCount:booking.petIds.length,
    },
    createdAt:now,
    updatedAt:now,
    succeededAt:now,
  });

  finance.savePaymentTransaction({
    paymentTransactionId:transactionId,
    paymentIntentId,
    bookingId:booking.bookingId,
    provider:'MOCK_PROVIDER',
    providerTransactionId:'CANONICAL-TXN-'+String(booking.bookingId),
    transactionType:'CHARGE',
    status:'SUCCESS',
    requestedAmountMinor:amount,
    settledAmountMinor:amount,
    currency:'KES',
    providerFeeMinor:0,
    initiatedAt:now,
    confirmedAt:now,
    rawProviderReference:'prototype-seed',
    createdAt:now,
  });

  finance.saveProviderEarning({
    earningId,
    bookingId:booking.bookingId,
    providerId:booking.providerId,
    businessId:booking.businessId,
    grossAmountMinor:amount,
    platformCommissionMinor:commission,
    providerFeesMinor:0,
    adjustmentsMinor:0,
    netAmountMinor:amount-commission,
    currency:'KES',
    status:'AVAILABLE',
    availableAt:now,
    createdAt:now,
    updatedAt:now,
  });

  finance.savePayoutDestination({
    destinationId:asProviderPayoutDestinationId('dest-canonical-'+String(booking.providerId)),
    providerId:booking.providerId,
    type:'MPESA_B2C',
    status:'VERIFIED',
    displayTitle:'M-PESA (2547****001)',
    maskedIdentifier:'2547****001',
    destinationToken:'tok_prototype_canonical_destination',
    isDefault:true,
    verifiedAt:now,
    createdAt:now,
    updatedAt:now,
  });

  finance.saveReceipt({
    receiptId:asFinancialReceiptId('rec-canonical-'+String(booking.bookingId)),
    receiptNumber:'REC-PROTOTYPE-'+String(booking.bookingId).slice(-8).toUpperCase(),
    bookingId:booking.bookingId,
    paymentIntentId,
    paymentTransactionId:transactionId,
    payerUserId:ownerUserId,
    payerName:'Elena Vance',
    providerId:booking.providerId,
    providerName:String((provider as any)?.displayName||(provider as any)?.legalName||'Verified provider'),
    serviceTitle:String((booking.serviceSnapshot as any)?.title||'Pet care service'),
    serviceScheduledAt:booking.startAt,
    amountMinor:amount,
    currency:'KES',
    paymentMethod:'M-PESA',
    paymentReference:'CANONICAL-TXN-'+String(booking.bookingId),
    taxAmountMinor:0,
    issuedAt:now,
  });
}
