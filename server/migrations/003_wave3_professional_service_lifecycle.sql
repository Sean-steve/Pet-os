CREATE TABLE IF NOT EXISTS provider_profiles (
  provider_id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  professional_title text,
  category text NOT NULL,
  bio text NOT NULL DEFAULT '',
  years_of_experience integer NOT NULL DEFAULT 0 CHECK (years_of_experience >= 0),
  languages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(languages) = 'array'),
  verification_status text NOT NULL CHECK (verification_status IN ('DRAFT','PENDING_VERIFICATION','UNDER_REVIEW','VERIFIED','NEEDS_INFORMATION','REJECTED','SUSPENDED')),
  operational_status text NOT NULL CHECK (operational_status IN ('ACTIVE','TEMPORARILY_INACTIVE','RESTRICTED','SUSPENDED','ARCHIVED')),
  visibility_status text NOT NULL CHECK (visibility_status IN ('PUBLIC','PRIVATE','UNLISTED')),
  primary_business_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_discovery
  ON provider_profiles(category, verification_status, operational_status, visibility_status);

CREATE TABLE IF NOT EXISTS service_businesses (
  business_id text PRIMARY KEY,
  legal_name text NOT NULL,
  trading_name text NOT NULL,
  business_type text NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  verification_status text NOT NULL CHECK (verification_status IN ('UNVERIFIED','PENDING','VERIFIED','SUSPENDED')),
  is_active boolean NOT NULL DEFAULT true,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  website_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_profiles
  DROP CONSTRAINT IF EXISTS provider_profiles_primary_business_id_fkey;
ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_primary_business_id_fkey
  FOREIGN KEY (primary_business_id) REFERENCES service_businesses(business_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS business_memberships (
  membership_id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES service_businesses(business_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_id text REFERENCES provider_profiles(provider_id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('OWNER','ADMIN','MANAGER','PROVIDER','STAFF')),
  is_active boolean NOT NULL DEFAULT true,
  can_manage_services boolean NOT NULL DEFAULT false,
  can_manage_schedule boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_business_membership_user ON business_memberships(user_id, is_active);

CREATE TABLE IF NOT EXISTS provider_service_offerings (
  offering_id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  service_type_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','PAUSED','RETIRED','SUSPENDED')),
  pricing_model text NOT NULL CHECK (pricing_model IN ('FIXED','STARTING_FROM','PER_HOUR','PER_NIGHT','PER_PET')),
  base_price_minor_units bigint NOT NULL CHECK (base_price_minor_units >= 0),
  currency text NOT NULL,
  default_duration_minutes integer NOT NULL CHECK (default_duration_minutes > 0),
  location_types jsonb NOT NULL CHECK (jsonb_typeof(location_types) = 'array'),
  target_species jsonb NOT NULL CHECK (jsonb_typeof(target_species) = 'array'),
  variants jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(variants) = 'array'),
  prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(prerequisites) = 'array'),
  max_pets_per_booking integer CHECK (max_pets_per_booking IS NULL OR max_pets_per_booking > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_offerings_discovery
  ON provider_service_offerings(status, category, provider_id);

CREATE TABLE IF NOT EXISTS bookings (
  booking_id text PRIMARY KEY,
  owner_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  offering_id text NOT NULL REFERENCES provider_service_offerings(offering_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN (
    'DRAFT','PENDING_PROVIDER','CONFIRMED','DECLINED','EXPIRED',
    'CANCELLED_BY_OWNER','CANCELLED_BY_PROVIDER','RESCHEDULE_PENDING',
    'IN_PROGRESS','COMPLETED','NO_SHOW','DISPUTED'
  )),
  confirmation_mode text NOT NULL CHECK (confirmation_mode IN ('INSTANT_CONFIRM','PROVIDER_APPROVAL_REQUIRED')),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL CHECK (end_at > start_at),
  service_duration_minutes integer NOT NULL CHECK (service_duration_minutes > 0),
  timezone text NOT NULL,
  pet_count integer NOT NULL CHECK (pet_count > 0),
  pet_ids jsonb NOT NULL CHECK (jsonb_typeof(pet_ids) = 'array'),
  service_snapshot jsonb NOT NULL CHECK (jsonb_typeof(service_snapshot) = 'object'),
  price_snapshot jsonb NOT NULL CHECK (jsonb_typeof(price_snapshot) = 'object'),
  cancellation_policy_snapshot jsonb NOT NULL CHECK (jsonb_typeof(cancellation_policy_snapshot) = 'object'),
  instructions jsonb NOT NULL CHECK (jsonb_typeof(instructions) = 'object'),
  concurrency_version integer NOT NULL DEFAULT 1 CHECK (concurrency_version > 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_household_time ON bookings(household_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_time ON bookings(provider_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status, start_at);

CREATE TABLE IF NOT EXISTS booking_pet_links (
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  PRIMARY KEY (booking_id, pet_id)
);

CREATE TABLE IF NOT EXISTS booking_revisions (
  revision_id text PRIMARY KEY,
  booking_id text NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  prior_version integer NOT NULL,
  new_version integer NOT NULL CHECK (new_version > prior_version),
  previous_status text NOT NULL,
  new_status text NOT NULL,
  previous_snapshot jsonb NOT NULL CHECK (jsonb_typeof(previous_snapshot) = 'object'),
  new_snapshot jsonb NOT NULL CHECK (jsonb_typeof(new_snapshot) = 'object'),
  reason text NOT NULL,
  changed_by text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_revisions ON booking_revisions(booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS professional_care_engagements (
  engagement_id text PRIMARY KEY,
  booking_id text NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  service_type text NOT NULL CHECK (service_type IN ('GROOMING','PET_SITTING_VISIT','PET_SITTING_MULTI_VISIT','OVERNIGHT_SITTING','BOARDING','DAYCARE')),
  offering_id text NOT NULL REFERENCES provider_service_offerings(offering_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  pet_ids jsonb NOT NULL CHECK (jsonb_typeof(pet_ids) = 'array'),
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  assigned_staff_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('SCHEDULED','READY_FOR_HANDOVER','IN_CARE','RETURN_PENDING','COMPLETION_PENDING','COMPLETED','ABORTED','CANCELLED','INCIDENT_ACTIVE')),
  custody_status text NOT NULL CHECK (custody_status IN ('OWNER_CUSTODY','PROVIDER_CUSTODY','FACILITY_CUSTODY','STAFF_CUSTODY','RETURN_PENDING','RETURNED')),
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  timezone text NOT NULL,
  active_incident_count integer NOT NULL DEFAULT 0 CHECK (active_incident_count >= 0),
  concurrency_version integer NOT NULL DEFAULT 1 CHECK (concurrency_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_engagement_provider ON professional_care_engagements(provider_id, scheduled_start_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_engagement_household ON professional_care_engagements(household_id, scheduled_start_at DESC);

CREATE TABLE IF NOT EXISTS professional_care_records (
  record_id text PRIMARY KEY,
  engagement_id text NOT NULL REFERENCES professional_care_engagements(engagement_id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN (
    'INSTRUCTION_SNAPSHOT','ACCESS_GRANT','HANDOVER','OBSERVATION','INCIDENT',
    'GROOMING_SESSION','SITTER_VISIT','BOARDING_STAY','SHIFT_HANDOVER','COMPLETION_EVIDENCE'
  )),
  pet_id text REFERENCES pets(pet_id) ON DELETE RESTRICT,
  status text,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_professional_care_records
  ON professional_care_records(engagement_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS review_eligibilities (
  eligibility_id text PRIMARY KEY,
  booking_id text NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  reviewer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  reviewer_household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  offering_id text NOT NULL REFERENCES provider_service_offerings(offering_id) ON DELETE RESTRICT,
  service_type text NOT NULL,
  service_execution_reference text NOT NULL,
  service_snapshot jsonb NOT NULL CHECK (jsonb_typeof(service_snapshot) = 'object'),
  eligible_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING','ELIGIBLE','CONSUMED','EXPIRED','REVOKED','INELIGIBLE')),
  consumed_by_review_id text,
  eligibility_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id text PRIMARY KEY,
  eligibility_id text NOT NULL UNIQUE REFERENCES review_eligibilities(eligibility_id) ON DELETE RESTRICT,
  reviewer_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  reviewer_household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  offering_id text NOT NULL REFERENCES provider_service_offerings(offering_id) ON DELETE RESTRICT,
  service_type text NOT NULL,
  overall_rating integer NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  dimensions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dimensions) = 'array'),
  structured_tags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(structured_tags) = 'array'),
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','PENDING_MODERATION','PUBLISHED','LIMITED','HIDDEN','WITHDRAWN','REMOVED','DISPUTED')),
  moderation_status text NOT NULL CHECK (moderation_status IN ('APPROVED','PENDING','FLAGGED','ACTION_TAKEN')),
  public_identity_mode text NOT NULL CHECK (public_identity_mode IN ('FIRST_NAME_INITIAL','COMMUNITY_HANDLE','ANONYMOUS_TO_PUBLIC')),
  public_author_display_name text NOT NULL,
  verified_service boolean NOT NULL DEFAULT true,
  service_snapshot jsonb NOT NULL CHECK (jsonb_typeof(service_snapshot) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE review_eligibilities
  DROP CONSTRAINT IF EXISTS review_eligibilities_consumed_by_review_id_fkey;
ALTER TABLE review_eligibilities
  ADD CONSTRAINT review_eligibilities_consumed_by_review_id_fkey
  FOREIGN KEY (consumed_by_review_id) REFERENCES reviews(review_id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS review_revisions (
  revision_id text PRIMARY KEY,
  review_id text NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  edit_reason text,
  author_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, version)
);

CREATE TABLE IF NOT EXISTS review_responses (
  response_id text PRIMARY KEY,
  review_id text NOT NULL UNIQUE REFERENCES reviews(review_id) ON DELETE CASCADE,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text REFERENCES service_businesses(business_id) ON DELETE SET NULL,
  responder_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  responder_role text NOT NULL CHECK (responder_role IN ('REVIEWED_PROVIDER','BUSINESS_MANAGER','SUPPORT_REPRESENTATIVE')),
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('PUBLISHED','HIDDEN_WITH_REVIEW','MODERATED')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION petos_can_manage_business(target_business_id text, actor_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $petos_business$
  SELECT EXISTS (
    SELECT 1 FROM service_businesses b
    WHERE b.business_id = target_business_id AND b.owner_user_id = actor_user_id
  )
  OR EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.business_id = target_business_id
      AND bm.user_id = actor_user_id
      AND bm.is_active
      AND bm.role IN ('OWNER','ADMIN','MANAGER')
  )
$petos_business$;

CREATE OR REPLACE FUNCTION petos_can_manage_provider(target_provider_id text, actor_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $petos_provider$
  SELECT EXISTS (
    SELECT 1 FROM provider_profiles p
    WHERE p.provider_id = target_provider_id AND p.user_id = actor_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM provider_profiles p
    WHERE p.provider_id = target_provider_id
      AND p.primary_business_id IS NOT NULL
      AND petos_can_manage_business(p.primary_business_id, actor_user_id)
  )
$petos_provider$;

CREATE OR REPLACE FUNCTION petos_can_access_booking(target_booking_id text, actor_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $petos_booking$
  SELECT EXISTS (
    SELECT 1
    FROM bookings b
    LEFT JOIN provider_profiles p ON p.provider_id = b.provider_id
    LEFT JOIN business_memberships bm ON bm.business_id = b.business_id
      AND bm.user_id = actor_user_id AND bm.is_active
    WHERE b.booking_id = target_booking_id
      AND (
        b.owner_user_id = actor_user_id
        OR p.user_id = actor_user_id
        OR bm.user_id IS NOT NULL
      )
  )
$petos_booking$;

CREATE OR REPLACE FUNCTION petos_can_access_engagement(target_engagement_id text, actor_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $petos_engagement_read$
  SELECT EXISTS (
    SELECT 1
    FROM professional_care_engagements e
    JOIN bookings b ON b.booking_id = e.booking_id
    LEFT JOIN provider_profiles p ON p.provider_id = e.provider_id
    LEFT JOIN business_memberships bm ON bm.business_id = e.business_id
      AND bm.user_id = actor_user_id AND bm.is_active
    WHERE e.engagement_id = target_engagement_id
      AND (
        b.owner_user_id = actor_user_id
        OR e.assigned_staff_id = actor_user_id
        OR p.user_id = actor_user_id
        OR bm.user_id IS NOT NULL
      )
  )
$petos_engagement_read$;

CREATE OR REPLACE FUNCTION petos_can_manage_engagement(target_engagement_id text, actor_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $petos_engagement_write$
  SELECT EXISTS (
    SELECT 1
    FROM professional_care_engagements e
    LEFT JOIN provider_profiles p ON p.provider_id = e.provider_id
    LEFT JOIN business_memberships bm ON bm.business_id = e.business_id
      AND bm.user_id = actor_user_id AND bm.is_active
    WHERE e.engagement_id = target_engagement_id
      AND (
        e.assigned_staff_id = actor_user_id
        OR p.user_id = actor_user_id
        OR (bm.user_id IS NOT NULL AND bm.role IN ('OWNER','ADMIN','MANAGER','PROVIDER','STAFF'))
      )
  )
$petos_engagement_write$;

GRANT EXECUTE ON FUNCTION petos_can_manage_business(text, text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_manage_provider(text, text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_booking(text, text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_engagement(text, text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_manage_engagement(text, text) TO petos_app;

GRANT SELECT, INSERT, UPDATE ON provider_profiles, service_businesses, business_memberships, provider_service_offerings TO petos_app;
GRANT SELECT, INSERT, UPDATE ON bookings, booking_pet_links, booking_revisions TO petos_app;
GRANT SELECT, INSERT, UPDATE ON professional_care_engagements, professional_care_records TO petos_app;
GRANT SELECT, INSERT, UPDATE ON review_eligibilities, reviews, review_revisions, review_responses TO petos_app;

ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_service_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_care_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_care_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_eligibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_read ON provider_profiles;
CREATE POLICY provider_read ON provider_profiles FOR SELECT USING (
  (verification_status = 'VERIFIED' AND operational_status = 'ACTIVE' AND visibility_status = 'PUBLIC')
  OR user_id = current_setting('app.user_id', true)
  OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS provider_insert ON provider_profiles;
CREATE POLICY provider_insert ON provider_profiles FOR INSERT WITH CHECK (
  user_id = current_setting('app.user_id', true)
);
DROP POLICY IF EXISTS provider_update ON provider_profiles;
CREATE POLICY provider_update ON provider_profiles FOR UPDATE
  USING (petos_can_manage_provider(provider_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_manage_provider(provider_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS business_read ON service_businesses;
CREATE POLICY business_read ON service_businesses FOR SELECT USING (
  (verification_status = 'VERIFIED' AND is_active)
  OR owner_user_id = current_setting('app.user_id', true)
  OR petos_can_manage_business(business_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS business_insert ON service_businesses;
CREATE POLICY business_insert ON service_businesses FOR INSERT WITH CHECK (
  owner_user_id = current_setting('app.user_id', true)
);
DROP POLICY IF EXISTS business_update ON service_businesses;
CREATE POLICY business_update ON service_businesses FOR UPDATE
  USING (
    owner_user_id = current_setting('app.user_id', true)
    OR petos_can_manage_business(business_id, current_setting('app.user_id', true))
  )
  WITH CHECK (
    owner_user_id = current_setting('app.user_id', true)
    OR petos_can_manage_business(business_id, current_setting('app.user_id', true))
  );

DROP POLICY IF EXISTS business_membership_read ON business_memberships;
CREATE POLICY business_membership_read ON business_memberships FOR SELECT USING (
  user_id = current_setting('app.user_id', true)
  OR petos_can_manage_business(business_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS business_membership_insert ON business_memberships;
CREATE POLICY business_membership_insert ON business_memberships FOR INSERT WITH CHECK (
  petos_can_manage_business(business_id, current_setting('app.user_id', true))
);

DROP POLICY IF EXISTS offering_read ON provider_service_offerings;
CREATE POLICY offering_read ON provider_service_offerings FOR SELECT USING (
  status = 'ACTIVE'
  OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS offering_insert ON provider_service_offerings;
CREATE POLICY offering_insert ON provider_service_offerings FOR INSERT WITH CHECK (
  petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS offering_update ON provider_service_offerings;
CREATE POLICY offering_update ON provider_service_offerings FOR UPDATE
  USING (petos_can_manage_provider(provider_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_manage_provider(provider_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS booking_read ON bookings;
CREATE POLICY booking_read ON bookings FOR SELECT USING (
  owner_user_id = current_setting('app.user_id', true)
  OR petos_can_access_booking(booking_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS booking_insert ON bookings;
CREATE POLICY booking_insert ON bookings FOR INSERT WITH CHECK (
  owner_user_id = current_setting('app.user_id', true)
  AND EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = bookings.household_id
      AND hm.user_id = current_setting('app.user_id', true)
      AND hm.status = 'ACTIVE'
  )
);
DROP POLICY IF EXISTS booking_update ON bookings;
CREATE POLICY booking_update ON bookings FOR UPDATE
  USING (petos_can_access_booking(booking_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_access_booking(booking_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS booking_pet_link_access ON booking_pet_links;
CREATE POLICY booking_pet_link_access ON booking_pet_links FOR ALL
  USING (petos_can_access_booking(booking_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_access_booking(booking_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS booking_revision_access ON booking_revisions;
CREATE POLICY booking_revision_access ON booking_revisions FOR ALL
  USING (petos_can_access_booking(booking_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_access_booking(booking_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS engagement_read ON professional_care_engagements;
CREATE POLICY engagement_read ON professional_care_engagements FOR SELECT USING (
  assigned_staff_id = current_setting('app.user_id', true)
  OR EXISTS (
    SELECT 1 FROM provider_profiles p
    WHERE p.provider_id = professional_care_engagements.provider_id
      AND p.user_id = current_setting('app.user_id', true)
  )
  OR (
    business_id IS NOT NULL
    AND petos_can_manage_business(business_id, current_setting('app.user_id', true))
  )
  OR petos_can_access_engagement(engagement_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS engagement_insert ON professional_care_engagements;
CREATE POLICY engagement_insert ON professional_care_engagements FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings b
    JOIN provider_profiles p ON p.provider_id = b.provider_id
    WHERE b.booking_id = professional_care_engagements.booking_id
      AND b.provider_id = professional_care_engagements.provider_id
      AND (p.user_id = current_setting('app.user_id', true)
        OR professional_care_engagements.assigned_staff_id = current_setting('app.user_id', true))
      AND b.status IN ('CONFIRMED','IN_PROGRESS')
  )
);
DROP POLICY IF EXISTS engagement_update ON professional_care_engagements;
CREATE POLICY engagement_update ON professional_care_engagements FOR UPDATE
  USING (petos_can_manage_engagement(engagement_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_manage_engagement(engagement_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS care_record_access ON professional_care_records;
DROP POLICY IF EXISTS care_record_read ON professional_care_records;
CREATE POLICY care_record_read ON professional_care_records FOR SELECT
  USING (petos_can_access_engagement(engagement_id, current_setting('app.user_id', true)));
DROP POLICY IF EXISTS care_record_insert ON professional_care_records;
CREATE POLICY care_record_insert ON professional_care_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_manage_engagement(engagement_id, current_setting('app.user_id', true))
  );
DROP POLICY IF EXISTS care_record_update ON professional_care_records;
CREATE POLICY care_record_update ON professional_care_records FOR UPDATE
  USING (petos_can_manage_engagement(engagement_id, current_setting('app.user_id', true)))
  WITH CHECK (petos_can_manage_engagement(engagement_id, current_setting('app.user_id', true)));

DROP POLICY IF EXISTS review_eligibility_read ON review_eligibilities;
CREATE POLICY review_eligibility_read ON review_eligibilities FOR SELECT USING (
  reviewer_user_id = current_setting('app.user_id', true)
  OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS review_eligibility_insert ON review_eligibilities;
CREATE POLICY review_eligibility_insert ON review_eligibilities FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM bookings b
    WHERE b.booking_id = review_eligibilities.booking_id
      AND b.status = 'COMPLETED'
      AND b.owner_user_id = review_eligibilities.reviewer_user_id
      AND b.household_id = review_eligibilities.reviewer_household_id
      AND b.provider_id = review_eligibilities.provider_id
      AND b.offering_id = review_eligibilities.offering_id
      AND petos_can_access_booking(b.booking_id, current_setting('app.user_id', true))
  )
);

DROP POLICY IF EXISTS review_eligibility_update ON review_eligibilities;
CREATE POLICY review_eligibility_update ON review_eligibilities FOR UPDATE
  USING (
    reviewer_user_id = current_setting('app.user_id', true)
    OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
  )
  WITH CHECK (
    reviewer_user_id = current_setting('app.user_id', true)
    OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
  );

DROP POLICY IF EXISTS review_read ON reviews;
CREATE POLICY review_read ON reviews FOR SELECT USING (
  status IN ('PUBLISHED','LIMITED')
  OR reviewer_user_id = current_setting('app.user_id', true)
  OR petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS review_insert ON reviews;
CREATE POLICY review_insert ON reviews FOR INSERT WITH CHECK (
  reviewer_user_id = current_setting('app.user_id', true)
);
DROP POLICY IF EXISTS review_update ON reviews;
CREATE POLICY review_update ON reviews FOR UPDATE
  USING (reviewer_user_id = current_setting('app.user_id', true))
  WITH CHECK (reviewer_user_id = current_setting('app.user_id', true));

DROP POLICY IF EXISTS review_revision_access ON review_revisions;
CREATE POLICY review_revision_access ON review_revisions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = review_revisions.review_id
      AND (
        r.reviewer_user_id = current_setting('app.user_id', true)
        OR petos_can_manage_provider(r.provider_id, current_setting('app.user_id', true))
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = review_revisions.review_id
      AND r.reviewer_user_id = current_setting('app.user_id', true)
  )
);

DROP POLICY IF EXISTS review_response_access ON review_responses;
CREATE POLICY review_response_access ON review_responses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM reviews r
    WHERE r.review_id = review_responses.review_id
      AND (
        r.status IN ('PUBLISHED','LIMITED')
        OR r.reviewer_user_id = current_setting('app.user_id', true)
        OR petos_can_manage_provider(r.provider_id, current_setting('app.user_id', true))
      )
  )
);
DROP POLICY IF EXISTS review_response_insert ON review_responses;
CREATE POLICY review_response_insert ON review_responses FOR INSERT WITH CHECK (
  responder_user_id = current_setting('app.user_id', true)
  AND petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
);
DROP POLICY IF EXISTS review_response_update ON review_responses;
CREATE POLICY review_response_update ON review_responses FOR UPDATE
  USING (
    responder_user_id = current_setting('app.user_id', true)
    AND petos_can_manage_provider(provider_id, current_setting('app.user_id', true))
  );
