CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  normalized_email text NOT NULL UNIQUE,
  account_status text NOT NULL CHECK (account_status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
  household_id text PRIMARY KEY,
  name text NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(user_id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVED')),
  timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  membership_id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN','CAREGIVER','VIEW_ONLY')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','REMOVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_household_members_user_active ON household_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_household_members_household_active ON household_members(household_id, status);

CREATE TABLE IF NOT EXISTS pets (
  pet_id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  name text NOT NULL,
  species_code text NOT NULL,
  breed_code text NOT NULL,
  mixed_breed boolean NOT NULL DEFAULT false,
  unknown_breed boolean NOT NULL DEFAULT false,
  sex text NOT NULL,
  reproductive_status text NOT NULL,
  birthdate_precision text NOT NULL,
  estimated_birthdate boolean NOT NULL DEFAULT true,
  primary_color text NOT NULL,
  size_classification text NOT NULL,
  lifecycle_stage text NOT NULL DEFAULT 'ADULT',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by text NOT NULL REFERENCES users(user_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pets_household_created ON pets(household_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
  event_id text PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(occurred_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS idempotency_records (
  actor_user_id text NOT NULL REFERENCES users(user_id),
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  resource_id text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_user_id, scope, idempotency_key)
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_member_read ON households;
CREATE POLICY household_member_read ON households
  FOR SELECT USING (
    owner_user_id = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = households.household_id
        AND hm.user_id = current_setting('app.user_id', true)
        AND hm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS membership_read ON household_members;
CREATE POLICY membership_read ON household_members
  FOR SELECT USING (
    user_id = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM households h
      WHERE h.household_id = household_members.household_id
        AND h.owner_user_id = current_setting('app.user_id', true)
    )
  );

DROP POLICY IF EXISTS pet_member_read ON pets;
CREATE POLICY pet_member_read ON pets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = pets.household_id
        AND hm.user_id = current_setting('app.user_id', true)
        AND hm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS pet_member_insert ON pets;
CREATE POLICY pet_member_insert ON pets
  FOR INSERT WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = pets.household_id
        AND hm.user_id = current_setting('app.user_id', true)
        AND hm.status = 'ACTIVE'
        AND hm.role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN','CAREGIVER')
    )
  );
