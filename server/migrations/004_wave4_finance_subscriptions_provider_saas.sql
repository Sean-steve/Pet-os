-- Sprint 41 / Migration Wave 4: durable Finance, Consumer Subscriptions and Provider SaaS.

CREATE TABLE IF NOT EXISTS finance_payment_intents (
  payment_intent_id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  payer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  payment_method_type text NOT NULL CHECK (payment_method_type IN ('MPESA','CARD','BANK_TRANSFER')),
  provider text NOT NULL CHECK (provider IN ('MPESA_SAFARICOM','CARD_GATEWAY','MOCK_PROVIDER')),
  provider_intent_reference text,
  status text NOT NULL CHECK (status IN ('CREATED','REQUIRES_ACTION','PROCESSING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  succeeded_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_successful_booking_payment
  ON finance_payment_intents(booking_id) WHERE status='SUCCEEDED';
CREATE INDEX IF NOT EXISTS idx_finance_intents_payer ON finance_payment_intents(payer_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS finance_payment_transactions (
  payment_transaction_id text PRIMARY KEY,
  payment_intent_id text NOT NULL REFERENCES finance_payment_intents(payment_intent_id) ON DELETE RESTRICT,
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_transaction_id text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('AUTHORIZATION','CAPTURE','CHARGE','REFUND','PAYOUT','REVERSAL')),
  status text NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED')),
  requested_amount_minor bigint NOT NULL CHECK (requested_amount_minor >= 0),
  settled_amount_minor bigint CHECK (settled_amount_minor IS NULL OR settled_amount_minor >= 0),
  currency text NOT NULL,
  provider_fee_minor bigint NOT NULL DEFAULT 0 CHECK (provider_fee_minor >= 0),
  raw_provider_reference text,
  initiated_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  failure_code text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_booking ON finance_payment_transactions(booking_id,created_at DESC);

CREATE TABLE IF NOT EXISTS finance_ledger_accounts (
  account_id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  currency text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code,currency)
);

CREATE TABLE IF NOT EXISTS finance_ledger_journals (
  journal_id text PRIMARY KEY,
  journal_type text NOT NULL CHECK (journal_type IN ('CUSTOMER_PAYMENT','SERVICE_FULFILLMENT','CUSTOMER_REFUND','PROVIDER_PAYOUT','FINANCIAL_ADJUSTMENT','REVERSAL')),
  source_type text NOT NULL CHECK (source_type IN ('BOOKING_PAYMENT','SERVICE_COMPLETION','REFUND','PAYOUT','ADJUSTMENT')),
  source_id text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED')),
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor >= 0),
  description text NOT NULL,
  posted_at timestamptz,
  reversal_of_journal_id text REFERENCES finance_ledger_journals(journal_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(journal_type,source_type,source_id)
);

CREATE TABLE IF NOT EXISTS finance_ledger_entries (
  entry_id text PRIMARY KEY,
  journal_id text NOT NULL REFERENCES finance_ledger_journals(journal_id) ON DELETE RESTRICT,
  account_id text NOT NULL REFERENCES finance_ledger_accounts(account_id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  provider_id text REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  booking_id text REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_entries_journal ON finance_ledger_entries(journal_id);

CREATE OR REPLACE FUNCTION petos_post_financial_journal(target_journal_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $finance_post$
DECLARE
  debit_total bigint;
  credit_total bigint;
  journal_currency text;
  journal_total bigint;
  current_status text;
BEGIN
  SELECT currency,total_amount_minor,status INTO journal_currency,journal_total,current_status
    FROM finance_ledger_journals WHERE journal_id=target_journal_id FOR UPDATE;
  IF current_status IS NULL THEN RAISE EXCEPTION 'FINANCIAL_JOURNAL_NOT_FOUND'; END IF;
  IF current_status='POSTED' THEN RETURN; END IF;
  SELECT COALESCE(SUM(amount_minor) FILTER (WHERE direction='DEBIT'),0),
         COALESCE(SUM(amount_minor) FILTER (WHERE direction='CREDIT'),0)
    INTO debit_total,credit_total
    FROM finance_ledger_entries
    WHERE journal_id=target_journal_id AND currency=journal_currency;
  IF debit_total<=0 OR debit_total<>credit_total OR debit_total<>journal_total THEN
    RAISE EXCEPTION 'FINANCIAL_JOURNAL_UNBALANCED';
  END IF;
  UPDATE finance_ledger_journals SET status='POSTED',posted_at=now() WHERE journal_id=target_journal_id;
END
$finance_post$;

CREATE OR REPLACE FUNCTION petos_prevent_posted_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $ledger_immutable$
DECLARE journal_status text;
BEGIN
  SELECT status INTO journal_status FROM finance_ledger_journals WHERE journal_id=COALESCE(OLD.journal_id,NEW.journal_id);
  IF journal_status='POSTED' THEN RAISE EXCEPTION 'POSTED_LEDGER_IS_IMMUTABLE'; END IF;
  RETURN COALESCE(NEW,OLD);
END
$ledger_immutable$;

DROP TRIGGER IF EXISTS trg_finance_entries_immutable ON finance_ledger_entries;
CREATE TRIGGER trg_finance_entries_immutable
BEFORE INSERT OR UPDATE OR DELETE ON finance_ledger_entries
FOR EACH ROW EXECUTE FUNCTION petos_prevent_posted_ledger_mutation();

CREATE OR REPLACE FUNCTION petos_prevent_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $journal_immutable$
BEGIN
  IF OLD.status='POSTED' THEN RAISE EXCEPTION 'POSTED_JOURNAL_IS_IMMUTABLE'; END IF;
  RETURN COALESCE(NEW,OLD);
END
$journal_immutable$;

DROP TRIGGER IF EXISTS trg_finance_journal_immutable ON finance_ledger_journals;
CREATE TRIGGER trg_finance_journal_immutable
BEFORE UPDATE OR DELETE ON finance_ledger_journals
FOR EACH ROW EXECUTE FUNCTION petos_prevent_posted_journal_mutation();

CREATE TABLE IF NOT EXISTS finance_provider_earnings (
  earning_id text PRIMARY KEY,
  booking_id text NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  platform_commission_minor bigint NOT NULL CHECK (platform_commission_minor >= 0),
  provider_fees_minor bigint NOT NULL DEFAULT 0 CHECK (provider_fees_minor >= 0),
  adjustments_minor bigint NOT NULL DEFAULT 0,
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor >= 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','HELD','AVAILABLE','RESERVED_FOR_PAYOUT','PAID','REVERSED')),
  hold_reason text,
  available_at timestamptz,
  payout_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_earnings_provider ON finance_provider_earnings(provider_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS finance_payout_destinations (
  destination_id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  destination_type text NOT NULL CHECK (destination_type IN ('MPESA_B2C','BANK_ACCOUNT')),
  status text NOT NULL CHECK (status IN ('PENDING','VERIFIED','DISABLED')),
  display_title text NOT NULL,
  masked_identifier text NOT NULL,
  destination_token text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_default_destination
  ON finance_payout_destinations(provider_id) WHERE is_default AND status<>'DISABLED';

CREATE TABLE IF NOT EXISTS finance_provider_payouts (
  payout_id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  destination_id text NOT NULL REFERENCES finance_payout_destinations(destination_id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('CREATED','QUEUED','PROCESSING','PAID','FAILED','REVERSED','CANCELLED')),
  provider_reference text,
  initiated_at timestamptz NOT NULL,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE finance_provider_earnings
  DROP CONSTRAINT IF EXISTS finance_provider_earnings_payout_id_fkey;
ALTER TABLE finance_provider_earnings
  ADD CONSTRAINT finance_provider_earnings_payout_id_fkey FOREIGN KEY(payout_id) REFERENCES finance_provider_payouts(payout_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS finance_payout_allocations (
  allocation_id text PRIMARY KEY,
  payout_id text NOT NULL REFERENCES finance_provider_payouts(payout_id) ON DELETE CASCADE,
  earning_id text NOT NULL REFERENCES finance_provider_earnings(earning_id) ON DELETE RESTRICT,
  allocated_amount_minor bigint NOT NULL CHECK (allocated_amount_minor > 0),
  currency text NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payout_id,earning_id)
);

CREATE TABLE IF NOT EXISTS finance_refunds (
  refund_id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  payment_transaction_id text NOT NULL REFERENCES finance_payment_transactions(payment_transaction_id) ON DELETE RESTRICT,
  requested_by_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('OWNER_CANCELLATION','PROVIDER_CANCELLATION','SERVICE_UNSATISFACTORY','DUPLICATE_CHARGE','GOODWILL','SYSTEM_RECOVERY')),
  reason_details text,
  requested_amount_minor bigint NOT NULL CHECK (requested_amount_minor > 0),
  settled_amount_minor bigint,
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','APPROVED','PROCESSING','SUCCEEDED','FAILED','CANCELLED')),
  provider_refund_reference text,
  failure_reason text,
  requested_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_receipts (
  receipt_id text PRIMARY KEY,
  receipt_number text NOT NULL UNIQUE,
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  payment_intent_id text NOT NULL REFERENCES finance_payment_intents(payment_intent_id) ON DELETE RESTRICT,
  payment_transaction_id text NOT NULL REFERENCES finance_payment_transactions(payment_transaction_id) ON DELETE RESTRICT,
  payer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  service_title text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL,
  payment_method text NOT NULL,
  payment_reference text NOT NULL,
  tax_amount_minor bigint NOT NULL DEFAULT 0 CHECK (tax_amount_minor >= 0),
  issued_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_reconciliation_runs (
  run_id text PRIMARY KEY,
  provider text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  total_internal_transactions integer NOT NULL DEFAULT 0,
  total_provider_transactions integer NOT NULL DEFAULT 0,
  total_internal_amount_minor bigint NOT NULL DEFAULT 0,
  total_provider_amount_minor bigint NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  exception_count integer NOT NULL DEFAULT 0,
  currency text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS finance_reconciliation_items (
  item_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES finance_reconciliation_runs(run_id) ON DELETE CASCADE,
  classification text NOT NULL CHECK (classification IN ('MATCHED','MISSING_INTERNAL','MISSING_PROVIDER','AMOUNT_MISMATCH','CURRENCY_MISMATCH','STATUS_MISMATCH','DUPLICATE','NEEDS_REVIEW')),
  provider_transaction_id text,
  internal_transaction_id text REFERENCES finance_payment_transactions(payment_transaction_id) ON DELETE SET NULL,
  booking_id text REFERENCES bookings(booking_id) ON DELETE SET NULL,
  provider_amount_minor bigint,
  internal_amount_minor bigint,
  currency text NOT NULL,
  discrepancy_minor bigint,
  resolution_status text NOT NULL DEFAULT 'UNRESOLVED' CHECK (resolution_status IN ('UNRESOLVED','INVESTIGATING','ADJUSTMENT_POSTED','DISMISSED')),
  resolution_notes text
);

CREATE TABLE IF NOT EXISTS finance_webhook_events (
  event_id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL CHECK (status IN ('PENDING','PROCESSED','FAILED','IGNORED')),
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  UNIQUE(provider,provider_event_id)
);

CREATE TABLE IF NOT EXISTS consumer_plan_catalog (
  plan_id text PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code IN ('FREE','PREMIUM')),
  display_name text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  entitlements jsonb NOT NULL CHECK (jsonb_typeof(entitlements)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS consumer_plan_prices (
  price_id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES consumer_plan_catalog(plan_id) ON DELETE RESTRICT,
  currency text NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('MONTHLY','ANNUAL')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  market_country text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','GRANDFATHERED','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id,currency,billing_interval,market_country,status)
);

INSERT INTO consumer_plan_catalog(plan_id,code,display_name,description,entitlements)
VALUES
 ('consumer-plan-free','FREE','Pet OS Free','Core Pet OS household features','{"pet.capacity":1,"pet.profile.core":true,"data_export.privacy":true}'::jsonb),
 ('consumer-plan-premium','PREMIUM','Pet OS Premium','Premium household features','{"pet.capacity":10,"pet.profile.core":true,"data_export.privacy":true,"tracking.live":true,"analytics.advanced":true}'::jsonb)
ON CONFLICT(plan_id) DO NOTHING;
INSERT INTO consumer_plan_prices(price_id,plan_id,currency,billing_interval,amount_minor,market_country,status)
VALUES
 ('consumer-price-free-ke-month','consumer-plan-free','KES','MONTHLY',0,'KE','ACTIVE'),
 ('consumer-price-premium-ke-month','consumer-plan-premium','KES','MONTHLY',99900,'KE','ACTIVE'),
 ('consumer-price-premium-ke-annual','consumer-plan-premium','KES','ANNUAL',999000,'KE','ACTIVE')
ON CONFLICT(price_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS consumer_subscriptions (
  subscription_id text PRIMARY KEY,
  owner_type text NOT NULL CHECK (owner_type IN ('HOUSEHOLD','USER')),
  owner_id text NOT NULL,
  billing_owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  plan_id text NOT NULL REFERENCES consumer_plan_catalog(plan_id) ON DELETE RESTRICT,
  price_id text NOT NULL REFERENCES consumer_plan_prices(price_id) ON DELETE RESTRICT,
  billing_provider text NOT NULL CHECK (billing_provider IN ('MPESA_RECURRING','CARD_GATEWAY','MOCK_BILLING_PROVIDER')),
  external_subscription_reference text,
  status text NOT NULL CHECK (status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','PAUSED','CANCEL_AT_PERIOD_END','CANCELLED','EXPIRED','TERMINATED')),
  billing_interval text NOT NULL,
  currency text NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  cancellation_reason text,
  grace_period_end timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_consumer_subscription_owner
  ON consumer_subscriptions(owner_type,owner_id) WHERE status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','PAUSED','CANCEL_AT_PERIOD_END');

CREATE TABLE IF NOT EXISTS subscription_status_history (
  history_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES consumer_subscriptions(subscription_id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL,
  actor_user_id text REFERENCES users(user_id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  invoice_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES consumer_subscriptions(subscription_id) ON DELETE RESTRICT,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  currency text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','OPEN','PAID','FAILED','VOID','REFUNDED','PARTIALLY_REFUNDED')),
  provider_invoice_reference text,
  payment_transaction_id text REFERENCES finance_payment_transactions(payment_transaction_id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  paid_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_invoice_provider_ref
  ON subscription_invoices(provider_invoice_reference) WHERE provider_invoice_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_entitlement_grants (
  grant_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES consumer_subscriptions(subscription_id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('USER','HOUSEHOLD')),
  subject_id text NOT NULL,
  entitlement_code text NOT NULL,
  value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('FREE_BASELINE','CONSUMER_SUBSCRIPTION')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,entitlement_code)
);

CREATE TABLE IF NOT EXISTS provider_saas_plan_catalog (
  plan_id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  target_type text NOT NULL CHECK(target_type IN ('SERVICE_BUSINESS','INDIVIDUAL_PROVIDER')),
  tier text NOT NULL CHECK(tier IN ('FREE','PRO','BUSINESS','BUSINESS_PLUS')),
  display_name text NOT NULL,
  included_staff_seats integer NOT NULL CHECK(included_staff_seats>=0),
  included_locations integer NOT NULL CHECK(included_locations>=0),
  entitlements jsonb NOT NULL CHECK(jsonb_typeof(entitlements)='array'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS provider_saas_prices (
  price_id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES provider_saas_plan_catalog(plan_id) ON DELETE RESTRICT,
  market text NOT NULL,
  currency text NOT NULL,
  billing_interval text NOT NULL CHECK(billing_interval IN ('MONTHLY','ANNUAL')),
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  grace_period_days integer NOT NULL DEFAULT 7 CHECK(grace_period_days>=0),
  trial_period_days integer NOT NULL DEFAULT 0 CHECK(trial_period_days>=0),
  status text NOT NULL CHECK(status IN ('ACTIVE','GRANDFATHERED','RETIRED')),
  UNIQUE(plan_id,market,currency,billing_interval,status)
);
INSERT INTO provider_saas_plan_catalog(plan_id,code,target_type,tier,display_name,included_staff_seats,included_locations,entitlements)
VALUES
 ('psaas-plan-free','PROVIDER_FREE','INDIVIDUAL_PROVIDER','FREE','Provider Free',1,1,'["provider.workspace.basic"]'::jsonb),
 ('psaas-plan-pro','PROVIDER_PRO','INDIVIDUAL_PROVIDER','PRO','Provider Pro',1,1,'["provider.workspace.basic","provider.workspace.advanced","provider.schedule.advanced","provider.analytics.advanced"]'::jsonb),
 ('psaas-plan-business','BUSINESS_OPERATIONS','SERVICE_BUSINESS','BUSINESS','Business Operations',5,1,'["provider.workspace.basic","provider.workspace.advanced","provider.staff.management","provider.schedule.advanced","provider.analytics.advanced"]'::jsonb)
ON CONFLICT(plan_id) DO NOTHING;
INSERT INTO provider_saas_prices(price_id,plan_id,market,currency,billing_interval,amount_minor,grace_period_days,trial_period_days,status)
VALUES
 ('psaas-price-free-ke-month','psaas-plan-free','KE','KES','MONTHLY',0,0,0,'ACTIVE'),
 ('psaas-price-pro-ke-month','psaas-plan-pro','KE','KES','MONTHLY',149900,7,14,'ACTIVE'),
 ('psaas-price-business-ke-month','psaas-plan-business','KE','KES','MONTHLY',499900,7,14,'ACTIVE')
ON CONFLICT(price_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS provider_saas_subscriptions (
  subscription_id text PRIMARY KEY,
  subscriber_type text NOT NULL CHECK(subscriber_type IN ('SERVICE_BUSINESS','INDIVIDUAL_PROVIDER')),
  business_id text REFERENCES service_businesses(business_id) ON DELETE RESTRICT,
  provider_id text REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  billing_owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  plan_id text NOT NULL REFERENCES provider_saas_plan_catalog(plan_id) ON DELETE RESTRICT,
  price_id text NOT NULL REFERENCES provider_saas_prices(price_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','RESTRICTED','CANCEL_AT_PERIOD_END','CANCELLED','EXPIRED','TERMINATED')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  grace_period_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  consecutive_failed_payments integer NOT NULL DEFAULT 0 CHECK(consecutive_failed_payments>=0),
  external_billing_ref text,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((subscriber_type='SERVICE_BUSINESS' AND business_id IS NOT NULL AND provider_id IS NULL)
      OR (subscriber_type='INDIVIDUAL_PROVIDER' AND provider_id IS NOT NULL AND business_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_provider_saas_target
  ON provider_saas_subscriptions(subscriber_type,COALESCE(business_id,provider_id))
  WHERE status IN ('INCOMPLETE','TRIALING','ACTIVE','PAST_DUE','GRACE_PERIOD','RESTRICTED','CANCEL_AT_PERIOD_END');

CREATE TABLE IF NOT EXISTS provider_saas_entitlement_grants (
  grant_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES provider_saas_subscriptions(subscription_id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,entitlement_key)
);

CREATE TABLE IF NOT EXISTS provider_saas_invoices (
  invoice_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES provider_saas_subscriptions(subscription_id) ON DELETE RESTRICT,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  currency text NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','OPEN','PAID','FAILED','VOID','REFUNDED','PARTIALLY_REFUNDED')),
  provider_invoice_reference text,
  issued_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  paid_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_saas_invoice_provider_ref
  ON provider_saas_invoices(provider_invoice_reference) WHERE provider_invoice_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS provider_saas_continuity_grants (
  grant_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES provider_saas_subscriptions(subscription_id) ON DELETE CASCADE,
  business_id text REFERENCES service_businesses(business_id) ON DELETE CASCADE,
  provider_id text REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
  engagement_id text NOT NULL REFERENCES professional_care_engagements(engagement_id) ON DELETE CASCADE,
  pet_ids jsonb NOT NULL CHECK(jsonb_typeof(pet_ids)='array'),
  reason text NOT NULL,
  activated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(subscription_id,engagement_id)
);

CREATE TABLE IF NOT EXISTS billing_reconciliation_runs (
  run_id text PRIMARY KEY,
  billing_domain text NOT NULL CHECK(billing_domain IN ('CONSUMER_SUBSCRIPTION','PROVIDER_SAAS')),
  checked_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  drifted_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS billing_reconciliation_items (
  item_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES billing_reconciliation_runs(run_id) ON DELETE CASCADE,
  subscription_id text NOT NULL,
  local_status text NOT NULL,
  provider_status text NOT NULL,
  classification text NOT NULL CHECK(classification IN ('MATCHED','LOCAL_MISSING','PROVIDER_MISSING','STATUS_MISMATCH','PERIOD_MISMATCH','PRICE_MISMATCH','PAYMENT_MISMATCH','REQUIRES_REVIEW')),
  details text NOT NULL
);

CREATE OR REPLACE FUNCTION petos_finance_booking_access(target_booking_id text,actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $faccess$
 SELECT petos_can_access_booking(target_booking_id,actor_user_id)
$faccess$;

CREATE OR REPLACE FUNCTION petos_provider_finance_access(target_provider_id text,actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $pfinance$
 SELECT petos_can_manage_provider(target_provider_id,actor_user_id)
$pfinance$;

CREATE OR REPLACE FUNCTION petos_consumer_subscription_access(target_owner_type text,target_owner_id text,actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $csub$
 SELECT CASE
  WHEN target_owner_type='USER' THEN target_owner_id=actor_user_id
  WHEN target_owner_type='HOUSEHOLD' THEN EXISTS(
    SELECT 1 FROM household_members hm WHERE hm.household_id=target_owner_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
  ELSE false END
$csub$;

CREATE OR REPLACE FUNCTION petos_provider_saas_access(target_type text,target_business_id text,target_provider_id text,actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $psaas$
 SELECT CASE
  WHEN target_type='SERVICE_BUSINESS' THEN target_business_id IS NOT NULL AND petos_can_manage_business(target_business_id,actor_user_id)
  WHEN target_type='INDIVIDUAL_PROVIDER' THEN target_provider_id IS NOT NULL AND petos_can_manage_provider(target_provider_id,actor_user_id)
  ELSE false END
$psaas$;

REVOKE ALL ON finance_ledger_accounts,finance_ledger_journals,finance_ledger_entries,finance_reconciliation_runs,finance_reconciliation_items,finance_webhook_events FROM petos_app;
REVOKE EXECUTE ON FUNCTION petos_post_financial_journal(text) FROM petos_app;
GRANT EXECUTE ON FUNCTION petos_finance_booking_access(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_provider_finance_access(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_consumer_subscription_access(text,text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_provider_saas_access(text,text,text,text) TO petos_app;

GRANT SELECT,INSERT,UPDATE ON finance_payment_intents,finance_provider_earnings,finance_payout_destinations,finance_provider_payouts,finance_payout_allocations,finance_refunds TO petos_app;
GRANT SELECT ON finance_payment_transactions,finance_receipts TO petos_app;
GRANT SELECT ON consumer_plan_catalog,consumer_plan_prices,provider_saas_plan_catalog,provider_saas_prices TO petos_app;
GRANT SELECT,INSERT,UPDATE ON consumer_subscriptions,subscription_status_history,subscription_invoices,subscription_entitlement_grants,
  provider_saas_subscriptions,provider_saas_entitlement_grants,provider_saas_invoices,provider_saas_continuity_grants,
  billing_reconciliation_runs,billing_reconciliation_items TO petos_app;

ALTER TABLE finance_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_provider_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_payout_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_provider_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_saas_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_saas_entitlement_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_saas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_saas_continuity_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_intent_access ON finance_payment_intents;
CREATE POLICY finance_intent_access ON finance_payment_intents FOR ALL
 USING (payer_user_id=current_setting('app.user_id',true) OR petos_finance_booking_access(booking_id,current_setting('app.user_id',true)))
 WITH CHECK (payer_user_id=current_setting('app.user_id',true) AND petos_finance_booking_access(booking_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_transaction_access ON finance_payment_transactions;
CREATE POLICY finance_transaction_access ON finance_payment_transactions FOR SELECT
 USING (petos_finance_booking_access(booking_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_earning_access ON finance_provider_earnings;
CREATE POLICY finance_earning_access ON finance_provider_earnings FOR SELECT
 USING (petos_provider_finance_access(provider_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_destination_access ON finance_payout_destinations;
CREATE POLICY finance_destination_access ON finance_payout_destinations FOR ALL
 USING (petos_provider_finance_access(provider_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_provider_finance_access(provider_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_payout_access ON finance_provider_payouts;
CREATE POLICY finance_payout_access ON finance_provider_payouts FOR SELECT
 USING (petos_provider_finance_access(provider_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_refund_access ON finance_refunds;
CREATE POLICY finance_refund_access ON finance_refunds FOR SELECT
 USING (petos_finance_booking_access(booking_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS finance_receipt_access ON finance_receipts;
CREATE POLICY finance_receipt_access ON finance_receipts FOR SELECT
 USING (payer_user_id=current_setting('app.user_id',true) OR petos_provider_finance_access(provider_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS consumer_subscription_access ON consumer_subscriptions;
CREATE POLICY consumer_subscription_access ON consumer_subscriptions FOR ALL
 USING (petos_consumer_subscription_access(owner_type,owner_id,current_setting('app.user_id',true)))
 WITH CHECK (billing_owner_user_id=current_setting('app.user_id',true) AND petos_consumer_subscription_access(owner_type,owner_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS subscription_invoice_access ON subscription_invoices;
CREATE POLICY subscription_invoice_access ON subscription_invoices FOR SELECT
 USING (EXISTS(SELECT 1 FROM consumer_subscriptions s WHERE s.subscription_id=subscription_invoices.subscription_id
   AND petos_consumer_subscription_access(s.owner_type,s.owner_id,current_setting('app.user_id',true))));
DROP POLICY IF EXISTS subscription_entitlement_access ON subscription_entitlement_grants;
CREATE POLICY subscription_entitlement_access ON subscription_entitlement_grants FOR SELECT
 USING (EXISTS(SELECT 1 FROM consumer_subscriptions s WHERE s.subscription_id=subscription_entitlement_grants.subscription_id
   AND petos_consumer_subscription_access(s.owner_type,s.owner_id,current_setting('app.user_id',true))));

DROP POLICY IF EXISTS provider_saas_subscription_access ON provider_saas_subscriptions;
CREATE POLICY provider_saas_subscription_access ON provider_saas_subscriptions FOR ALL
 USING (petos_provider_saas_access(subscriber_type,business_id,provider_id,current_setting('app.user_id',true)))
 WITH CHECK (billing_owner_user_id=current_setting('app.user_id',true)
   AND petos_provider_saas_access(subscriber_type,business_id,provider_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS provider_saas_entitlement_access ON provider_saas_entitlement_grants;
CREATE POLICY provider_saas_entitlement_access ON provider_saas_entitlement_grants FOR SELECT
 USING (EXISTS(SELECT 1 FROM provider_saas_subscriptions s WHERE s.subscription_id=provider_saas_entitlement_grants.subscription_id
  AND petos_provider_saas_access(s.subscriber_type,s.business_id,s.provider_id,current_setting('app.user_id',true))));
DROP POLICY IF EXISTS provider_saas_invoice_access ON provider_saas_invoices;
CREATE POLICY provider_saas_invoice_access ON provider_saas_invoices FOR SELECT
 USING (EXISTS(SELECT 1 FROM provider_saas_subscriptions s WHERE s.subscription_id=provider_saas_invoices.subscription_id
  AND petos_provider_saas_access(s.subscriber_type,s.business_id,s.provider_id,current_setting('app.user_id',true))));
DROP POLICY IF EXISTS provider_saas_continuity_access ON provider_saas_continuity_grants;
CREATE POLICY provider_saas_continuity_access ON provider_saas_continuity_grants FOR SELECT
 USING (EXISTS(SELECT 1 FROM provider_saas_subscriptions s WHERE s.subscription_id=provider_saas_continuity_grants.subscription_id
  AND petos_provider_saas_access(s.subscriber_type,s.business_id,s.provider_id,current_setting('app.user_id',true))));
