CREATE OR REPLACE FUNCTION petos_can_access_pet(
  target_pet_id text,
  target_household_id text,
  actor_user_id text,
  require_write boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pets p
    JOIN household_members hm ON hm.household_id = p.household_id
    WHERE p.pet_id = target_pet_id
      AND p.household_id = target_household_id
      AND hm.user_id = actor_user_id
      AND hm.status = 'ACTIVE'
      AND (NOT require_write OR hm.role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN','CAREGIVER'))
      AND p.status NOT IN ('ARCHIVED','DECEASED')
  )
$$;

CREATE TABLE IF NOT EXISTS health_records (
  record_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN (
    'CONDITION','ALLERGY','ENCOUNTER','VACCINATION','MEDICATION',
    'PROCEDURE','DIAGNOSTIC_RESULT','CLINICAL_NOTE','AMENDMENT','DOCUMENT_LINK'
  )),
  occurred_at timestamptz NOT NULL,
  status text,
  provenance text,
  verification_status text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_records_pet_time ON health_records(pet_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_records_pet_type ON health_records(pet_id, record_type);

CREATE TABLE IF NOT EXISTS care_records (
  record_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN ('OBLIGATION','OCCURRENCE','COMPLETION','REMINDER_POLICY')),
  occurred_at timestamptz NOT NULL,
  status text,
  provenance text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_care_records_pet_time ON care_records(pet_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_records_pet_type ON care_records(pet_id, record_type);

CREATE TABLE IF NOT EXISTS nutrition_records (
  record_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN (
    'FEEDING_PLAN','MEAL_SCHEDULE','MEAL_OCCURRENCE','TREAT_LOG',
    'HYDRATION_LOG','APPETITE_OBSERVATION','DIETARY_RESTRICTION','FOOD_TRANSITION_PLAN'
  )),
  occurred_at timestamptz NOT NULL,
  status text,
  provenance text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_records_pet_time ON nutrition_records(pet_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_records_pet_type ON nutrition_records(pet_id, record_type);

CREATE TABLE IF NOT EXISTS training_records (
  record_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN (
    'GOAL','PLAN','SESSION','EXERCISE_ATTEMPT','SKILL_PROGRESS',
    'MILESTONE','EVIDENCE','BEHAVIOR_OBSERVATION'
  )),
  occurred_at timestamptz NOT NULL,
  status text,
  provenance text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_records_pet_time ON training_records(pet_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_records_pet_type ON training_records(pet_id, record_type);

CREATE TABLE IF NOT EXISTS activity_records (
  record_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  record_type text NOT NULL CHECK (record_type IN (
    'ACTIVITY_RECORD','ACTIVITY_SESSION','ROUTINE','OCCURRENCE','GOAL','AMENDMENT'
  )),
  occurred_at timestamptz NOT NULL,
  status text,
  provenance text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_by text NOT NULL REFERENCES users(user_id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_records_pet_time ON activity_records(pet_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_records_pet_type ON activity_records(pet_id, record_type);

CREATE TABLE IF NOT EXISTS pet_domain_record_revisions (
  revision_id text PRIMARY KEY,
  domain text NOT NULL CHECK (domain IN ('health','care','nutrition','training','activity')),
  record_id text NOT NULL,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  prior_version integer NOT NULL CHECK (prior_version > 0),
  new_version integer NOT NULL CHECK (new_version > prior_version),
  previous_status text,
  new_status text,
  previous_payload jsonb NOT NULL CHECK (jsonb_typeof(previous_payload) = 'object'),
  new_payload jsonb NOT NULL CHECK (jsonb_typeof(new_payload) = 'object'),
  reason text NOT NULL,
  amended_by text NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_domain_revisions_record ON pet_domain_record_revisions(domain, record_id, created_at DESC);

GRANT EXECUTE ON FUNCTION petos_can_access_pet(text, text, text, boolean) TO petos_app;
GRANT SELECT, INSERT ON health_records TO petos_app;
GRANT SELECT, INSERT, UPDATE ON care_records, nutrition_records, training_records, activity_records TO petos_app;
GRANT SELECT, INSERT ON pet_domain_record_revisions TO petos_app;

ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_domain_record_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_record_read ON health_records;
CREATE POLICY health_record_read ON health_records FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS health_record_insert ON health_records;
CREATE POLICY health_record_insert ON health_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
DROP POLICY IF EXISTS health_record_update ON health_records;

DROP POLICY IF EXISTS care_record_read ON care_records;
CREATE POLICY care_record_read ON care_records FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS care_record_insert ON care_records;
CREATE POLICY care_record_insert ON care_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
DROP POLICY IF EXISTS care_record_update ON care_records;
CREATE POLICY care_record_update ON care_records FOR UPDATE
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true))
  WITH CHECK (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true));

DROP POLICY IF EXISTS nutrition_record_read ON nutrition_records;
CREATE POLICY nutrition_record_read ON nutrition_records FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS nutrition_record_insert ON nutrition_records;
CREATE POLICY nutrition_record_insert ON nutrition_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
DROP POLICY IF EXISTS nutrition_record_update ON nutrition_records;
CREATE POLICY nutrition_record_update ON nutrition_records FOR UPDATE
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true))
  WITH CHECK (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true));

DROP POLICY IF EXISTS training_record_read ON training_records;
CREATE POLICY training_record_read ON training_records FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS training_record_insert ON training_records;
CREATE POLICY training_record_insert ON training_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
DROP POLICY IF EXISTS training_record_update ON training_records;
CREATE POLICY training_record_update ON training_records FOR UPDATE
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true))
  WITH CHECK (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true));

DROP POLICY IF EXISTS activity_record_read ON activity_records;
CREATE POLICY activity_record_read ON activity_records FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS activity_record_insert ON activity_records;
CREATE POLICY activity_record_insert ON activity_records FOR INSERT
  WITH CHECK (
    created_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
DROP POLICY IF EXISTS activity_record_update ON activity_records;
CREATE POLICY activity_record_update ON activity_records FOR UPDATE
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true))
  WITH CHECK (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true));

DROP POLICY IF EXISTS domain_revision_read ON pet_domain_record_revisions;
CREATE POLICY domain_revision_read ON pet_domain_record_revisions FOR SELECT
  USING (petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), false));
DROP POLICY IF EXISTS domain_revision_insert ON pet_domain_record_revisions;
CREATE POLICY domain_revision_insert ON pet_domain_record_revisions FOR INSERT
  WITH CHECK (
    amended_by = current_setting('app.user_id', true)
    AND petos_can_access_pet(pet_id, household_id, current_setting('app.user_id', true), true)
  );
