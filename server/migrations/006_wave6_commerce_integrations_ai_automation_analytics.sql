-- Sprint 43 / Migration Wave 6: Commerce, Integrations, AI, Automation & Analytics durable authority.

-- ============================================================================
-- FINANCE EXTENSION FOR COMMERCE LEDGER SOURCES
-- ============================================================================

ALTER TABLE finance_ledger_journals
  DROP CONSTRAINT IF EXISTS finance_ledger_journals_source_type_check;
ALTER TABLE finance_ledger_journals
  ADD CONSTRAINT finance_ledger_journals_source_type_check
  CHECK (source_type IN (
    'BOOKING_PAYMENT','SERVICE_COMPLETION','REFUND','PAYOUT','ADJUSTMENT',
    'COMMERCE_PAYMENT','COMMERCE_REFUND'
  ));

-- ============================================================================
-- COMMERCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS commerce_sellers (
  seller_id text PRIMARY KEY,
  seller_type text NOT NULL CHECK(seller_type IN ('INDIVIDUAL','BUSINESS','FIRST_PARTY_STORE')),
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  primary_owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  trading_name text NOT NULL,
  legal_entity_name text NOT NULL,
  registration_number text,
  tax_identifier_masked text,
  support_email text NOT NULL,
  support_phone text NOT NULL,
  status text NOT NULL CHECK(status IN ('PENDING','ACTIVE','RESTRICTED','SUSPENDED','CLOSED')),
  onboarding_status text NOT NULL CHECK(onboarding_status IN (
    'ACCOUNT_CREATED','BUSINESS_DETAILS_PENDING','VERIFICATION_PENDING','PAYOUT_SETUP_PENDING','AGREEMENT_PENDING',
    'UNDER_REVIEW','ACTIVE','RESTRICTED','SUSPENDED','REJECTED'
  )),
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  payout_destination_configured boolean NOT NULL DEFAULT false,
  agreement_accepted_version text,
  agreement_accepted_at timestamptz,
  standard_lead_time_hours integer NOT NULL DEFAULT 24 CHECK(standard_lead_time_hours>=0),
  is_first_party boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_sellers_owner ON commerce_sellers(primary_owner_user_id,status);

CREATE TABLE IF NOT EXISTS commerce_seller_memberships (
  membership_id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('OWNER','ADMIN','CATALOG_MANAGER','ORDER_MANAGER','FULFILLMENT','FINANCE_VIEWER','SUPPORT')),
  is_active boolean NOT NULL DEFAULT true,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(seller_id,user_id)
);

CREATE TABLE IF NOT EXISTS commerce_products (
  product_id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  short_description text NOT NULL DEFAULT '',
  category_code text NOT NULL,
  species_applicability text NOT NULL CHECK(species_applicability IN ('DOG','CAT','MULTI_SPECIES','SMALL_PET','BIRD')),
  life_stage_applicability text NOT NULL CHECK(life_stage_applicability IN ('PUPPY_KITTEN','ADULT','SENIOR','ALL_STAGES')),
  safety_classification text NOT NULL CHECK(safety_classification IN ('STANDARD','REGULATED','HAZARDOUS','PROHIBITED')),
  moderation_status text NOT NULL CHECK(moderation_status IN ('DRAFT','PENDING_REVIEW','APPROVED','REJECTED','RESTRICTED')),
  moderation_reason text,
  is_live_animal boolean NOT NULL DEFAULT false,
  prescription_restricted boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RESTRICTED','SUSPENDED','ARCHIVED')),
  attributes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(attributes)='array'),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(is_live_animal=false),
  CHECK(NOT (prescription_restricted AND status='ACTIVE')),
  CHECK(NOT (safety_classification='PROHIBITED' AND status='ACTIVE'))
);
CREATE INDEX IF NOT EXISTS idx_commerce_products_seller ON commerce_products(seller_id,status);
CREATE INDEX IF NOT EXISTS idx_commerce_products_public ON commerce_products(status,moderation_status);

CREATE TABLE IF NOT EXISTS commerce_skus (
  sku_id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES commerce_products(product_id) ON DELETE CASCADE,
  sku_code text NOT NULL UNIQUE,
  variant_title text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(options)='object'),
  weight_grams integer CHECK(weight_grams IS NULL OR weight_grams>0),
  status text NOT NULL CHECK(status IN ('ACTIVE','DISCONTINUED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_listings (
  listing_id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES commerce_products(product_id) ON DELETE RESTRICT,
  sku_id text NOT NULL REFERENCES commerce_skus(sku_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','PAUSED','OUT_OF_STOCK','RESTRICTED','SUSPENDED','ARCHIVED')),
  price_minor bigint NOT NULL CHECK(price_minor>0),
  sale_price_minor bigint CHECK(sale_price_minor IS NULL OR sale_price_minor>0),
  sale_price_starts_at timestamptz,
  sale_price_ends_at timestamptz,
  currency text NOT NULL,
  fulfillment_methods jsonb NOT NULL CHECK(jsonb_typeof(fulfillment_methods)='array'),
  shipping_profile_id text NOT NULL,
  condition text NOT NULL CHECK(condition IN ('NEW','REFURBISHED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id,sku_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_listings_public ON commerce_listings(status,created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_inventory_items (
  inventory_item_id text PRIMARY KEY,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  sku_id text NOT NULL REFERENCES commerce_skus(sku_id) ON DELETE RESTRICT,
  location_code text NOT NULL,
  on_hand_quantity integer NOT NULL DEFAULT 0 CHECK(on_hand_quantity>=0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK(reserved_quantity>=0),
  low_stock_threshold integer NOT NULL DEFAULT 0 CHECK(low_stock_threshold>=0),
  lot_number text,
  expiration_date date,
  last_adjusted_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  CHECK(reserved_quantity<=on_hand_quantity),
  UNIQUE(seller_id,sku_id,location_code)
);
CREATE INDEX IF NOT EXISTS idx_commerce_inventory_sku ON commerce_inventory_items(sku_id,seller_id);

CREATE TABLE IF NOT EXISTS commerce_checkouts (
  checkout_id text PRIMARY KEY,
  buyer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text REFERENCES households(household_id) ON DELETE SET NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','RESERVED','COMPLETED','EXPIRED','CANCELLED')),
  currency text NOT NULL,
  items_subtotal_minor bigint NOT NULL CHECK(items_subtotal_minor>=0),
  shipping_total_minor bigint NOT NULL DEFAULT 0 CHECK(shipping_total_minor>=0),
  tax_total_minor bigint NOT NULL DEFAULT 0 CHECK(tax_total_minor>=0),
  discount_total_minor bigint NOT NULL DEFAULT 0 CHECK(discount_total_minor>=0),
  grand_total_minor bigint NOT NULL CHECK(grand_total_minor>0),
  shipping_address_ciphertext text NOT NULL,
  masked_address_summary text NOT NULL,
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_checkout_buyer ON commerce_checkouts(buyer_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_checkout_items (
  checkout_item_id text PRIMARY KEY,
  checkout_id text NOT NULL REFERENCES commerce_checkouts(checkout_id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  listing_id text NOT NULL REFERENCES commerce_listings(listing_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES commerce_products(product_id) ON DELETE RESTRICT,
  sku_id text NOT NULL REFERENCES commerce_skus(sku_id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK(quantity>0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor>0),
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor>0),
  currency text NOT NULL,
  product_snapshot jsonb NOT NULL CHECK(jsonb_typeof(product_snapshot)='object')
);

CREATE TABLE IF NOT EXISTS commerce_inventory_reservations (
  reservation_id text PRIMARY KEY,
  checkout_id text NOT NULL REFERENCES commerce_checkouts(checkout_id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  sku_id text NOT NULL REFERENCES commerce_skus(sku_id) ON DELETE RESTRICT,
  inventory_item_id text NOT NULL REFERENCES commerce_inventory_items(inventory_item_id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK(quantity>0),
  status text NOT NULL CHECK(status IN ('ACTIVE','COMMITTED','RELEASED','EXPIRED')),
  expires_at timestamptz NOT NULL,
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_reservation_checkout ON commerce_inventory_reservations(checkout_id,status);

CREATE TABLE IF NOT EXISTS commerce_orders (
  order_id text PRIMARY KEY,
  buyer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text REFERENCES households(household_id) ON DELETE SET NULL,
  checkout_id text NOT NULL UNIQUE REFERENCES commerce_checkouts(checkout_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('PENDING_PAYMENT','CONFIRMED','PARTIALLY_FULFILLED','FULFILLED','PARTIALLY_CANCELLED','CANCELLED','COMPLETED','CLOSED')),
  currency text NOT NULL,
  items_subtotal_minor bigint NOT NULL CHECK(items_subtotal_minor>=0),
  shipping_total_minor bigint NOT NULL DEFAULT 0 CHECK(shipping_total_minor>=0),
  tax_total_minor bigint NOT NULL DEFAULT 0 CHECK(tax_total_minor>=0),
  discount_total_minor bigint NOT NULL DEFAULT 0 CHECK(discount_total_minor>=0),
  total_minor bigint NOT NULL CHECK(total_minor>0),
  shipping_address_ciphertext text NOT NULL,
  masked_address_summary text NOT NULL,
  payment_status text NOT NULL CHECK(payment_status IN ('PENDING','SUCCEEDED','FAILED','REFUNDED')),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commerce_order_buyer ON commerce_orders(buyer_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_seller_orders (
  seller_order_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('PENDING','ACCEPTED','PREPARING','READY_FOR_DISPATCH','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','READY_FOR_PICKUP','PICKED_UP','PARTIALLY_FULFILLED','CANCELLED','RETURN_IN_PROGRESS','CLOSED')),
  items_subtotal_minor bigint NOT NULL CHECK(items_subtotal_minor>=0),
  shipping_fee_minor bigint NOT NULL DEFAULT 0 CHECK(shipping_fee_minor>=0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor>=0),
  seller_gross_minor bigint NOT NULL CHECK(seller_gross_minor>=0),
  commission_rate_bps integer NOT NULL CHECK(commission_rate_bps BETWEEN 0 AND 10000),
  commission_minor bigint NOT NULL CHECK(commission_minor>=0),
  seller_net_minor bigint NOT NULL CHECK(seller_net_minor>=0),
  currency text NOT NULL,
  fulfillment_method text NOT NULL CHECK(fulfillment_method IN ('SELLER_DELIVERY','PLATFORM_DELIVERY','THIRD_PARTY_COURIER','PICKUP')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,seller_id)
);

CREATE TABLE IF NOT EXISTS commerce_order_items (
  order_item_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE CASCADE,
  seller_order_id text NOT NULL REFERENCES commerce_seller_orders(seller_order_id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  listing_id text NOT NULL REFERENCES commerce_listings(listing_id) ON DELETE RESTRICT,
  sku_id text NOT NULL REFERENCES commerce_skus(sku_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES commerce_products(product_id) ON DELETE RESTRICT,
  product_snapshot jsonb NOT NULL CHECK(jsonb_typeof(product_snapshot)='object'),
  quantity_ordered integer NOT NULL CHECK(quantity_ordered>0),
  quantity_fulfilled integer NOT NULL DEFAULT 0 CHECK(quantity_fulfilled>=0),
  quantity_cancelled integer NOT NULL DEFAULT 0 CHECK(quantity_cancelled>=0),
  quantity_returned integer NOT NULL DEFAULT 0 CHECK(quantity_returned>=0),
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor>0),
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor>0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK(tax_minor>=0),
  currency text NOT NULL
);

CREATE TABLE IF NOT EXISTS commerce_payment_transactions (
  commerce_payment_transaction_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_transaction_id text NOT NULL,
  settled_amount_minor bigint NOT NULL CHECK(settled_amount_minor>0),
  currency text NOT NULL,
  status text NOT NULL CHECK(status IN ('SUCCESS','FAILED')),
  provider_fee_minor bigint NOT NULL DEFAULT 0 CHECK(provider_fee_minor>=0),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS commerce_shipments (
  shipment_id text PRIMARY KEY,
  seller_order_id text NOT NULL REFERENCES commerce_seller_orders(seller_order_id) ON DELETE CASCADE,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  carrier_name text NOT NULL,
  tracking_number text NOT NULL,
  tracking_url text,
  status text NOT NULL CHECK(status IN ('CREATED','LABEL_CREATED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','DELIVERY_FAILED','RETURN_TO_SENDER','CANCELLED')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_return_requests (
  return_request_id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(order_id) ON DELETE RESTRICT,
  seller_order_id text NOT NULL REFERENCES commerce_seller_orders(seller_order_id) ON DELETE RESTRICT,
  seller_id text NOT NULL REFERENCES commerce_sellers(seller_id) ON DELETE RESTRICT,
  buyer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  items jsonb NOT NULL CHECK(jsonb_typeof(items)='array'),
  status text NOT NULL CHECK(status IN ('REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','RETURN_IN_TRANSIT','RECEIVED','INSPECTING','REFUND_APPROVED','REFUNDED','CLOSED')),
  is_safety_exception boolean NOT NULL DEFAULT false,
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ============================================================================
-- INTEGRATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_developer_apps (
  developer_app_id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL CHECK(status IN ('DRAFT','UNDER_REVIEW','ACTIVE','SUSPENDED','REVOKED')),
  requested_scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(requested_scopes)='array'),
  approved_scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(approved_scopes)='array'),
  privacy_policy_url text,
  terms_url text,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_installations (
  installation_id text PRIMARY KEY,
  developer_app_id text NOT NULL REFERENCES integration_developer_apps(developer_app_id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  installed_by_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  granted_scopes jsonb NOT NULL CHECK(jsonb_typeof(granted_scopes)='array'),
  status text NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED','REVOKED')),
  installed_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(developer_app_id,household_id)
);

CREATE TABLE IF NOT EXISTS integration_api_credentials (
  credential_id text PRIMARY KEY,
  developer_app_id text NOT NULL REFERENCES integration_developer_apps(developer_app_id) ON DELETE CASCADE,
  installation_id text NOT NULL REFERENCES integration_installations(installation_id) ON DELETE CASCADE,
  secret_prefix text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('ACTIVE','ROTATED','REVOKED','EXPIRED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS integration_webhook_subscriptions (
  webhook_subscription_id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES integration_installations(installation_id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  event_types jsonb NOT NULL CHECK(jsonb_typeof(event_types)='array'),
  signing_secret_hash text NOT NULL,
  signing_secret_prefix text NOT NULL,
  status text NOT NULL CHECK(status IN ('ACTIVE','PAUSED','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
  webhook_delivery_id text PRIMARY KEY,
  webhook_subscription_id text NOT NULL REFERENCES integration_webhook_subscriptions(webhook_subscription_id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  status text NOT NULL CHECK(status IN ('PENDING','DELIVERED','RETRY_SCHEDULED','PERMANENT_FAILURE','DEAD_LETTER')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  next_attempt_at timestamptz,
  last_status_code integer,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(webhook_subscription_id,event_id)
);

CREATE TABLE IF NOT EXISTS integration_audit_events (
  audit_event_id text PRIMARY KEY,
  developer_app_id text REFERENCES integration_developer_apps(developer_app_id) ON DELETE SET NULL,
  installation_id text REFERENCES integration_installations(installation_id) ON DELETE SET NULL,
  resource_type text NOT NULL,
  resource_id text,
  outcome text NOT NULL CHECK(outcome IN ('ALLOWED','DENIED','SUCCESS','FAILURE')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AI GOVERNANCE & REQUEST AUTHORITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_deployments (
  model_deployment_id text PRIMARY KEY,
  provider text NOT NULL,
  provider_model_name text NOT NULL,
  internal_alias text NOT NULL UNIQUE,
  allowed_sensitivities jsonb NOT NULL CHECK(jsonb_typeof(allowed_sensitivities)='array'),
  allowed_risk_classes jsonb NOT NULL CHECK(jsonb_typeof(allowed_risk_classes)='array'),
  status text NOT NULL CHECK(status IN ('CANDIDATE','APPROVED','LIMITED','ACTIVE','DEPRECATED','SUSPENDED','RETIRED')),
  enabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  prompt_version_id text PRIMARY KEY,
  use_case text NOT NULL,
  version integer NOT NULL CHECK(version>0),
  risk_class text NOT NULL CHECK(risk_class IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  policy_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('DRAFT','APPROVED','ACTIVE','RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(use_case,version)
);

CREATE TABLE IF NOT EXISTS ai_consents (
  consent_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  scopes jsonb NOT NULL CHECK(jsonb_typeof(scopes)='array'),
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_scopes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(withdrawn_scopes)='array'),
  withdrawn_at timestamptz,
  UNIQUE(user_id,household_id)
);

CREATE TABLE IF NOT EXISTS ai_requests (
  request_id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  use_case text NOT NULL CHECK(use_case IN (
    'PET_ASSISTANT','PET_SUMMARY','DAILY_INSIGHT','HEALTH_SUMMARY','MEDICATION_EXPLANATION','TRAINING_GUIDANCE',
    'NUTRITION_INFORMATION','ACTIVITY_INSIGHT','LOST_PET_ASSISTANT','TRACKER_TROUBLESHOOTING','PROFESSIONAL_DRAFT','PRODUCT_INFORMATION'
  )),
  risk_class text NOT NULL CHECK(risk_class IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  prompt_version_id text NOT NULL REFERENCES ai_prompt_versions(prompt_version_id) ON DELETE RESTRICT,
  model_deployment_id text REFERENCES ai_model_deployments(model_deployment_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('CREATED','CONTEXT_ASSEMBLING','SAFETY_CHECK','READY','INFERENCE','POST_PROCESSING','COMPLETED','BLOCKED','FAILED','CANCELLED')),
  user_text text NOT NULL,
  context_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(context_refs)='array'),
  sensitivity_classes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(sensitivity_classes)='array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_safety_decisions (
  safety_decision_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE REFERENCES ai_requests(request_id) ON DELETE CASCADE,
  risk_class text NOT NULL CHECK(risk_class IN ('LOW','MEDIUM','HIGH','EMERGENCY')),
  policy_version text NOT NULL,
  detected_categories jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(detected_categories)='array'),
  action text NOT NULL CHECK(action IN ('ALLOW','ALLOW_WITH_WARNING','LIMIT_RESPONSE','REFUSE_UNSAFE_INSTRUCTION','ESCALATE_VET','EMERGENCY_ESCALATION')),
  warning text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_responses (
  response_id text PRIMARY KEY,
  request_id text NOT NULL UNIQUE REFERENCES ai_requests(request_id) ON DELETE CASCADE,
  model_deployment_id text REFERENCES ai_model_deployments(model_deployment_id) ON DELETE RESTRICT,
  content text NOT NULL,
  safety_decision_id text NOT NULL REFERENCES ai_safety_decisions(safety_decision_id) ON DELETE RESTRICT,
  provenance_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(provenance_refs)='array'),
  support_level text NOT NULL CHECK(support_level IN ('HIGH_SUPPORT','MODERATE_SUPPORT','LIMITED_INFORMATION')),
  completion_status text NOT NULL CHECK(completion_status IN ('COMPLETED','SAFETY_RESPONSE','BLOCKED','FAILED')),
  token_usage jsonb,
  latency_ms integer NOT NULL CHECK(latency_ms>=0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  recommendation_id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  explanation text NOT NULL,
  priority text NOT NULL CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(evidence_refs)='array'),
  generated_by text NOT NULL CHECK(generated_by IN ('DETERMINISTIC_RULE','CANONICAL_DUE_STATE','AI_DERIVED','PROFESSIONAL_PLAN','OWNER_GOAL')),
  model_deployment_id text REFERENCES ai_model_deployments(model_deployment_id) ON DELETE SET NULL,
  policy_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('ACTIVE','ACCEPTED','DISMISSED','SNOOZED','EXPIRED','SUPERSEDED','WITHDRAWN')),
  valid_from timestamptz NOT NULL,
  expires_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_model_deployments(
  model_deployment_id,provider,provider_model_name,internal_alias,allowed_sensitivities,allowed_risk_classes,status,enabled_at
) VALUES(
  'ai-deployment-runtime-default','RUNTIME_PROVIDER','configured-at-runtime','petos-runtime-default',
  '["GENERAL","PET_PROFILE","HEALTH","LOCATION","PROFESSIONAL"]'::jsonb,
  '["LOW","MEDIUM","HIGH","EMERGENCY"]'::jsonb,'ACTIVE',now()
) ON CONFLICT(model_deployment_id) DO NOTHING;

INSERT INTO ai_prompt_versions(prompt_version_id,use_case,version,risk_class,policy_version,status)
VALUES
('ai-prompt-pet-assistant-v1','PET_ASSISTANT',1,'LOW','ai-policy-v1','ACTIVE'),
('ai-prompt-pet-summary-v1','PET_SUMMARY',1,'LOW','ai-policy-v1','ACTIVE'),
('ai-prompt-daily-insight-v1','DAILY_INSIGHT',1,'LOW','ai-policy-v1','ACTIVE'),
('ai-prompt-health-summary-v1','HEALTH_SUMMARY',1,'HIGH','ai-policy-v1','ACTIVE'),
('ai-prompt-medication-v1','MEDICATION_EXPLANATION',1,'HIGH','ai-policy-v1','ACTIVE'),
('ai-prompt-training-v1','TRAINING_GUIDANCE',1,'MEDIUM','ai-policy-v1','ACTIVE'),
('ai-prompt-nutrition-v1','NUTRITION_INFORMATION',1,'MEDIUM','ai-policy-v1','ACTIVE'),
('ai-prompt-activity-v1','ACTIVITY_INSIGHT',1,'LOW','ai-policy-v1','ACTIVE'),
('ai-prompt-lost-pet-v1','LOST_PET_ASSISTANT',1,'HIGH','ai-policy-v1','ACTIVE'),
('ai-prompt-tracker-v1','TRACKER_TROUBLESHOOTING',1,'LOW','ai-policy-v1','ACTIVE'),
('ai-prompt-professional-v1','PROFESSIONAL_DRAFT',1,'HIGH','ai-policy-v1','ACTIVE'),
('ai-prompt-product-v1','PRODUCT_INFORMATION',1,'LOW','ai-policy-v1','ACTIVE')
ON CONFLICT(prompt_version_id) DO NOTHING;

-- ============================================================================
-- AUTOMATION / ORCHESTRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_action_definitions (
  action_type text PRIMARY KEY,
  owning_domain text NOT NULL,
  risk text NOT NULL CHECK(risk IN ('READ_ONLY','REVERSIBLE_LOW_RISK','SENSITIVE','FINANCIAL','CLINICAL','SAFETY_CRITICAL','IRREVERSIBLE')),
  confirmation_level text NOT NULL CHECK(confirmation_level IN ('NONE','STANDARD','STRONG_REAUTH','MULTI_PARTY')),
  may_run_from_rule boolean NOT NULL DEFAULT false,
  money_movement boolean NOT NULL DEFAULT false,
  clinical_mutation boolean NOT NULL DEFAULT false,
  exact_location_disclosure boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true
);

INSERT INTO automation_action_definitions(action_type,owning_domain,risk,confirmation_level,may_run_from_rule,money_movement,clinical_mutation,exact_location_disclosure)
VALUES
('CARE_CREATE_OWNER_TASK','CARE','REVERSIBLE_LOW_RISK','STANDARD',true,false,false,false),
('CARE_SNOOZE_OCCURRENCE','CARE','REVERSIBLE_LOW_RISK','STANDARD',true,false,false,false),
('CARE_COMPLETE_OCCURRENCE','CARE','SENSITIVE','STANDARD',false,false,false,false),
('NOTIFICATION_SCHEDULE_SELF','NOTIFICATIONS','REVERSIBLE_LOW_RISK','NONE',true,false,false,false),
('BOOKING_CREATE_SERVICE_REQUEST','BOOKING','SENSITIVE','STANDARD',false,false,false,false),
('LOST_PET_ACTIVATE_COMMUNITY_ALERT','LOST_PET','SAFETY_CRITICAL','STRONG_REAUTH',false,false,false,true),
('TRACKING_REQUEST_LOST_MODE','TRACKING','SAFETY_CRITICAL','STRONG_REAUTH',false,false,false,true),
('OPEN_DOMAIN_WORKSPACE','PLATFORM','READ_ONLY','NONE',true,false,false,false)
ON CONFLICT(action_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS automation_rules (
  automation_rule_id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL CHECK(status IN ('DRAFT','ACTIVE','PAUSED','ERROR','DISABLED','ARCHIVED')),
  active_version integer NOT NULL DEFAULT 1 CHECK(active_version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rule_versions (
  automation_rule_version_id text PRIMARY KEY,
  automation_rule_id text NOT NULL REFERENCES automation_rules(automation_rule_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version>0),
  trigger_type text NOT NULL CHECK(trigger_type IN ('DOMAIN_EVENT','SCHEDULE','CONDITION','MANUAL','AI_RECOMMENDATION')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(trigger_config)='object'),
  condition_expression text NOT NULL DEFAULT 'true',
  action_type text NOT NULL REFERENCES automation_action_definitions(action_type) ON DELETE RESTRICT,
  action_payload_template jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(action_payload_template)='object'),
  requires_confirmation_every_run boolean NOT NULL DEFAULT true,
  max_executions_per_day integer NOT NULL DEFAULT 1 CHECK(max_executions_per_day BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(automation_rule_id,version)
);

CREATE TABLE IF NOT EXISTS automation_action_proposals (
  action_proposal_id text PRIMARY KEY,
  action_type text NOT NULL REFERENCES automation_action_definitions(action_type) ON DELETE RESTRICT,
  actor_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  pet_id text REFERENCES pets(pet_id) ON DELETE CASCADE,
  origin text NOT NULL CHECK(origin IN ('USER_UI','AI_PROPOSAL','AUTOMATION_RULE','DOMAIN_EVENT','SYSTEM')),
  origin_reference_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'),
  status text NOT NULL CHECK(status IN ('DRAFT','READY_FOR_PREVIEW','AWAITING_CONFIRMATION','AWAITING_APPROVAL','CONFIRMED','EXECUTING','COMPLETED','PARTIALLY_COMPLETED','FAILED','CANCELLED','EXPIRED','STALE')),
  risk text NOT NULL,
  confirmation_level text NOT NULL,
  preview_hash text NOT NULL,
  target_state_fingerprint text NOT NULL,
  idempotency_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_user_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS automation_confirmations (
  action_confirmation_id text PRIMARY KEY,
  action_proposal_id text NOT NULL UNIQUE REFERENCES automation_action_proposals(action_proposal_id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  preview_hash text NOT NULL,
  confirmation_level text NOT NULL CHECK(confirmation_level IN ('NONE','STANDARD','STRONG_REAUTH','MULTI_PARTY')),
  confirmation_binding_hash text NOT NULL,
  one_time_use boolean NOT NULL DEFAULT true,
  used_at timestamptz,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_execution_attempts (
  execution_attempt_id text PRIMARY KEY,
  action_proposal_id text NOT NULL REFERENCES automation_action_proposals(action_proposal_id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK(attempt_number>0),
  classification text NOT NULL CHECK(classification IN ('SUCCESS','VALIDATION_FAILURE','AUTHORIZATION_FAILURE','STALE_PREVIEW','CONFIRMATION_EXPIRED','TARGET_CONFLICT','DEPENDENCY_RETRYABLE','PERMANENT_FAILURE','PARTIAL_FAILURE','POLICY_BLOCKED')),
  result_reference text,
  result_summary text,
  error_message text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  UNIQUE(action_proposal_id,attempt_number)
);

-- ============================================================================
-- ANALYTICS SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  analytics_snapshot_id text PRIMARY KEY,
  actor_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  audience text NOT NULL CHECK(audience IN ('HOUSEHOLD','PROVIDER','PLATFORM_OPS')),
  household_id text REFERENCES households(household_id) ON DELETE CASCADE,
  provider_id text REFERENCES provider_profiles(provider_id) ON DELETE CASCADE,
  scope_id text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  timezone text NOT NULL,
  metrics jsonb NOT NULL CHECK(jsonb_typeof(metrics)='array'),
  outcomes jsonb NOT NULL CHECK(jsonb_typeof(outcomes)='array'),
  operations jsonb NOT NULL CHECK(jsonb_typeof(operations)='array'),
  provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='array'),
  disclaimers jsonb NOT NULL CHECK(jsonb_typeof(disclaimers)='array'),
  privacy_version text NOT NULL DEFAULT 'analytics-privacy-v1',
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(window_end>window_start),
  CHECK(
    (audience='HOUSEHOLD' AND household_id IS NOT NULL AND provider_id IS NULL)
    OR (audience='PROVIDER' AND provider_id IS NOT NULL)
    OR (audience='PLATFORM_OPS')
  )
);
CREATE INDEX IF NOT EXISTS idx_analytics_household ON analytics_snapshots(household_id,generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_provider ON analytics_snapshots(provider_id,generated_at DESC);

-- ============================================================================
-- SECURITY DEFINER AUTHORIZATION HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION petos_can_manage_seller(target_seller_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $seller_manage$
  SELECT EXISTS(
    SELECT 1 FROM commerce_sellers s
    WHERE s.seller_id=target_seller_id AND s.primary_owner_user_id=actor_user_id
  ) OR EXISTS(
    SELECT 1 FROM commerce_seller_memberships sm
    WHERE sm.seller_id=target_seller_id AND sm.user_id=actor_user_id AND sm.is_active
      AND sm.role IN ('OWNER','ADMIN','CATALOG_MANAGER','ORDER_MANAGER','FULFILLMENT')
  )
$seller_manage$;

CREATE OR REPLACE FUNCTION petos_can_access_commerce_order(target_order_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $commerce_order_access$
  SELECT EXISTS(SELECT 1 FROM commerce_orders o WHERE o.order_id=target_order_id AND o.buyer_user_id=actor_user_id)
  OR EXISTS(
    SELECT 1 FROM commerce_seller_orders so
    WHERE so.order_id=target_order_id AND petos_can_manage_seller(so.seller_id,actor_user_id)
  )
$commerce_order_access$;

CREATE OR REPLACE FUNCTION petos_can_manage_integration_app(target_app_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $integration_app_manage$
  SELECT EXISTS(
    SELECT 1 FROM integration_developer_apps a
    WHERE a.developer_app_id=target_app_id AND a.owner_user_id=actor_user_id
  )
$integration_app_manage$;

CREATE OR REPLACE FUNCTION petos_can_access_installation(target_installation_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $integration_install_access$
  SELECT EXISTS(
    SELECT 1 FROM integration_installations i
    JOIN household_members hm ON hm.household_id=i.household_id
    WHERE i.installation_id=target_installation_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
  OR EXISTS(
    SELECT 1 FROM integration_installations i
    JOIN integration_developer_apps a ON a.developer_app_id=i.developer_app_id
    WHERE i.installation_id=target_installation_id AND a.owner_user_id=actor_user_id
  )
$integration_install_access$;

CREATE OR REPLACE FUNCTION petos_can_access_ai_household(target_household_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $ai_household_access$
  SELECT EXISTS(
    SELECT 1 FROM household_members hm
    WHERE hm.household_id=target_household_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
$ai_household_access$;

CREATE OR REPLACE FUNCTION petos_can_access_automation_household(target_household_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $automation_household_access$
  SELECT EXISTS(
    SELECT 1 FROM household_members hm
    WHERE hm.household_id=target_household_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
$automation_household_access$;

GRANT EXECUTE ON FUNCTION petos_can_manage_seller(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_commerce_order(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_manage_integration_app(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_installation(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_ai_household(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_automation_household(text,text) TO petos_app;

-- ============================================================================
-- PRIVILEGES
-- ============================================================================

GRANT SELECT,INSERT,UPDATE ON commerce_sellers,commerce_seller_memberships,commerce_products,commerce_skus,commerce_listings,commerce_inventory_items TO petos_app;
GRANT SELECT ON commerce_checkouts,commerce_checkout_items,commerce_inventory_reservations,commerce_orders,commerce_seller_orders,commerce_order_items,commerce_payment_transactions,commerce_shipments,commerce_return_requests TO petos_app;
GRANT UPDATE ON commerce_seller_orders,commerce_shipments,commerce_return_requests TO petos_app;

GRANT SELECT,INSERT,UPDATE ON integration_developer_apps, integration_installations, integration_webhook_subscriptions TO petos_app;
GRANT SELECT ON integration_webhook_deliveries, integration_audit_events TO petos_app;
REVOKE ALL ON integration_api_credentials FROM petos_app;

GRANT SELECT,INSERT,UPDATE ON ai_consents,ai_requests,ai_recommendations TO petos_app;
GRANT SELECT ON ai_safety_decisions,ai_responses,ai_model_deployments,ai_prompt_versions TO petos_app;

GRANT SELECT,INSERT,UPDATE ON automation_rules,automation_rule_versions,automation_action_proposals,automation_confirmations TO petos_app;
GRANT SELECT ON automation_action_definitions,automation_execution_attempts TO petos_app;

GRANT SELECT,INSERT ON analytics_snapshots TO petos_app;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE commerce_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_seller_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_checkout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY commerce_seller_read ON commerce_sellers FOR SELECT
 USING (primary_owner_user_id=current_setting('app.user_id',true)
   OR EXISTS(SELECT 1 FROM commerce_seller_memberships sm WHERE sm.seller_id=commerce_sellers.seller_id AND sm.user_id=current_setting('app.user_id',true) AND sm.is_active));
CREATE POLICY commerce_seller_insert ON commerce_sellers FOR INSERT
 WITH CHECK(primary_owner_user_id=current_setting('app.user_id',true));
CREATE POLICY commerce_seller_update ON commerce_sellers FOR UPDATE
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_seller_membership_access ON commerce_seller_memberships FOR ALL
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)) OR user_id=current_setting('app.user_id',true))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_product_read ON commerce_products FOR SELECT
 USING((status='ACTIVE' AND moderation_status='APPROVED') OR petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_product_write ON commerce_products FOR ALL
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_sku_read ON commerce_skus FOR SELECT
 USING(EXISTS(SELECT 1 FROM commerce_products p WHERE p.product_id=commerce_skus.product_id AND ((p.status='ACTIVE' AND p.moderation_status='APPROVED') OR petos_can_manage_seller(p.seller_id,current_setting('app.user_id',true)))));
CREATE POLICY commerce_sku_write ON commerce_skus FOR ALL
 USING(EXISTS(SELECT 1 FROM commerce_products p WHERE p.product_id=commerce_skus.product_id AND petos_can_manage_seller(p.seller_id,current_setting('app.user_id',true))))
 WITH CHECK(EXISTS(SELECT 1 FROM commerce_products p WHERE p.product_id=commerce_skus.product_id AND petos_can_manage_seller(p.seller_id,current_setting('app.user_id',true))));

CREATE POLICY commerce_listing_read ON commerce_listings FOR SELECT
 USING(status='ACTIVE' OR petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_listing_write ON commerce_listings FOR ALL
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_inventory_access ON commerce_inventory_items FOR ALL
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_checkout_read ON commerce_checkouts FOR SELECT
 USING(buyer_user_id=current_setting('app.user_id',true));
CREATE POLICY commerce_checkout_item_read ON commerce_checkout_items FOR SELECT
 USING(EXISTS(SELECT 1 FROM commerce_checkouts c WHERE c.checkout_id=commerce_checkout_items.checkout_id AND c.buyer_user_id=current_setting('app.user_id',true))
   OR petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_reservation_read ON commerce_inventory_reservations FOR SELECT
 USING(EXISTS(SELECT 1 FROM commerce_checkouts c WHERE c.checkout_id=commerce_inventory_reservations.checkout_id AND c.buyer_user_id=current_setting('app.user_id',true))
   OR petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

CREATE POLICY commerce_order_read ON commerce_orders FOR SELECT
 USING(petos_can_access_commerce_order(order_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_seller_order_read ON commerce_seller_orders FOR SELECT
 USING(petos_can_access_commerce_order(order_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_seller_order_update ON commerce_seller_orders FOR UPDATE
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_order_item_read ON commerce_order_items FOR SELECT
 USING(petos_can_access_commerce_order(order_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_payment_read ON commerce_payment_transactions FOR SELECT
 USING(EXISTS(SELECT 1 FROM commerce_orders o WHERE o.order_id=commerce_payment_transactions.order_id AND petos_can_access_commerce_order(o.order_id,current_setting('app.user_id',true))));
CREATE POLICY commerce_shipment_read ON commerce_shipments FOR SELECT
 USING(EXISTS(SELECT 1 FROM commerce_seller_orders so WHERE so.seller_order_id=commerce_shipments.seller_order_id AND petos_can_access_commerce_order(so.order_id,current_setting('app.user_id',true))));
CREATE POLICY commerce_shipment_update ON commerce_shipments FOR UPDATE
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_return_read ON commerce_return_requests FOR SELECT
 USING(buyer_user_id=current_setting('app.user_id',true) OR petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));
CREATE POLICY commerce_return_update ON commerce_return_requests FOR UPDATE
 USING(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_manage_seller(seller_id,current_setting('app.user_id',true)));

ALTER TABLE integration_developer_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_app_access ON integration_developer_apps FOR ALL
 USING(owner_user_id=current_setting('app.user_id',true))
 WITH CHECK(owner_user_id=current_setting('app.user_id',true));
CREATE POLICY integration_install_access ON integration_installations FOR ALL
 USING(petos_can_access_installation(installation_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_access_ai_household(household_id,current_setting('app.user_id',true))
   AND EXISTS(SELECT 1 FROM integration_developer_apps a WHERE a.developer_app_id=integration_installations.developer_app_id AND a.status='ACTIVE'));
CREATE POLICY integration_webhook_access ON integration_webhook_subscriptions FOR ALL
 USING(petos_can_access_installation(installation_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_access_installation(installation_id,current_setting('app.user_id',true)));
CREATE POLICY integration_delivery_read ON integration_webhook_deliveries FOR SELECT
 USING(EXISTS(SELECT 1 FROM integration_webhook_subscriptions w WHERE w.webhook_subscription_id=integration_webhook_deliveries.webhook_subscription_id
   AND petos_can_access_installation(w.installation_id,current_setting('app.user_id',true))));
CREATE POLICY integration_audit_read ON integration_audit_events FOR SELECT
 USING((developer_app_id IS NOT NULL AND petos_can_manage_integration_app(developer_app_id,current_setting('app.user_id',true)))
   OR (installation_id IS NOT NULL AND petos_can_access_installation(installation_id,current_setting('app.user_id',true))));

ALTER TABLE ai_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_safety_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_consent_access ON ai_consents FOR ALL
 USING(user_id=current_setting('app.user_id',true))
 WITH CHECK(user_id=current_setting('app.user_id',true) AND petos_can_access_ai_household(household_id,current_setting('app.user_id',true)));
CREATE POLICY ai_request_access ON ai_requests FOR SELECT
 USING(user_id=current_setting('app.user_id',true) AND petos_can_access_ai_household(household_id,current_setting('app.user_id',true)));
CREATE POLICY ai_request_insert ON ai_requests FOR INSERT
 WITH CHECK(user_id=current_setting('app.user_id',true) AND petos_can_access_ai_household(household_id,current_setting('app.user_id',true)));
CREATE POLICY ai_safety_read ON ai_safety_decisions FOR SELECT
 USING(EXISTS(SELECT 1 FROM ai_requests r WHERE r.request_id=ai_safety_decisions.request_id AND r.user_id=current_setting('app.user_id',true)));
CREATE POLICY ai_response_read ON ai_responses FOR SELECT
 USING(EXISTS(SELECT 1 FROM ai_requests r WHERE r.request_id=ai_responses.request_id AND r.user_id=current_setting('app.user_id',true)));
CREATE POLICY ai_recommendation_access ON ai_recommendations FOR ALL
 USING(petos_can_access_ai_household(household_id,current_setting('app.user_id',true)))
 WITH CHECK(petos_can_access_ai_household(household_id,current_setting('app.user_id',true)));

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_execution_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_rule_access ON automation_rules FOR ALL
 USING(owner_user_id=current_setting('app.user_id',true) AND petos_can_access_automation_household(household_id,current_setting('app.user_id',true)))
 WITH CHECK(owner_user_id=current_setting('app.user_id',true) AND petos_can_access_automation_household(household_id,current_setting('app.user_id',true)));
CREATE POLICY automation_rule_version_access ON automation_rule_versions FOR ALL
 USING(EXISTS(SELECT 1 FROM automation_rules r WHERE r.automation_rule_id=automation_rule_versions.automation_rule_id AND r.owner_user_id=current_setting('app.user_id',true)))
 WITH CHECK(EXISTS(SELECT 1 FROM automation_rules r WHERE r.automation_rule_id=automation_rule_versions.automation_rule_id AND r.owner_user_id=current_setting('app.user_id',true)));
CREATE POLICY automation_proposal_access ON automation_action_proposals FOR ALL
 USING(actor_user_id=current_setting('app.user_id',true) AND petos_can_access_automation_household(household_id,current_setting('app.user_id',true)))
 WITH CHECK(actor_user_id=current_setting('app.user_id',true) AND petos_can_access_automation_household(household_id,current_setting('app.user_id',true)));
CREATE POLICY automation_confirmation_access ON automation_confirmations FOR ALL
 USING(actor_user_id=current_setting('app.user_id',true))
 WITH CHECK(actor_user_id=current_setting('app.user_id',true));
CREATE POLICY automation_attempt_read ON automation_execution_attempts FOR SELECT
 USING(EXISTS(SELECT 1 FROM automation_action_proposals p WHERE p.action_proposal_id=automation_execution_attempts.action_proposal_id AND p.actor_user_id=current_setting('app.user_id',true)));

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_snapshot_read ON analytics_snapshots FOR SELECT
 USING(
   (audience='HOUSEHOLD' AND household_id IS NOT NULL AND petos_can_access_ai_household(household_id,current_setting('app.user_id',true)))
   OR (audience='PROVIDER' AND provider_id IS NOT NULL AND petos_can_manage_provider(provider_id,current_setting('app.user_id',true)))
 );
CREATE POLICY analytics_snapshot_insert ON analytics_snapshots FOR INSERT
 WITH CHECK(
   actor_user_id=current_setting('app.user_id',true)
   AND (
     (audience='HOUSEHOLD' AND household_id IS NOT NULL AND petos_can_access_ai_household(household_id,current_setting('app.user_id',true)))
     OR (audience='PROVIDER' AND provider_id IS NOT NULL AND petos_can_manage_provider(provider_id,current_setting('app.user_id',true)))
   )
 );

