-- Sprint 42 / Migration Wave 5: Tracking, Transport, Recovery & Community durable event/location authority.

-- ============================================================================
-- TRACKING & EXACT LOCATION AUTHORITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracking_devices (
  device_id text PRIMARY KEY,
  device_type text NOT NULL CHECK (device_type IN (
    'GPS_CELLULAR_TRACKER','GPS_BLUETOOTH_TRACKER','PHONE_LOCATION_SOURCE',
    'THIRD_PARTY_TRACKER','FUTURE_PET_OS_TRACKER','OTHER_APPROVED_LOCATION_DEVICE'
  )),
  provider text NOT NULL,
  external_device_reference text NOT NULL,
  serial_number_masked text NOT NULL,
  display_name text NOT NULL,
  model text NOT NULL,
  hardware_version text NOT NULL DEFAULT '1.0.0',
  firmware_version text NOT NULL DEFAULT '1.0.0',
  operational_status text NOT NULL CHECK (operational_status IN ('UNCLAIMED','CLAIMED','ACTIVE','INACTIVE','SUSPENDED','LOST_DEVICE','RETIRED')),
  connectivity_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (connectivity_status IN ('ONLINE','RECENTLY_SEEN','OFFLINE','UNKNOWN')),
  battery_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (battery_status IN ('NORMAL','LOW','CRITICAL','UNKNOWN')),
  battery_percent integer CHECK (battery_percent BETWEEN 0 AND 100),
  household_id text REFERENCES households(household_id) ON DELETE RESTRICT,
  claimed_at timestamptz,
  claimed_by text REFERENCES users(user_id) ON DELETE SET NULL,
  last_seen_at timestamptz,
  last_location_at timestamptz,
  supports_ble_recovery boolean NOT NULL DEFAULT false,
  supports_rotating_identifier boolean NOT NULL DEFAULT false,
  supports_lost_mode_broadcast boolean NOT NULL DEFAULT false,
  supports_remote_mode_change boolean NOT NULL DEFAULT false,
  ble_protocol_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE(provider, external_device_reference)
);
CREATE INDEX IF NOT EXISTS idx_tracking_devices_household ON tracking_devices(household_id, operational_status);

CREATE TABLE IF NOT EXISTS tracking_device_assignments (
  assignment_id text PRIMARY KEY,
  device_id text NOT NULL REFERENCES tracking_devices(device_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  unassigned_at timestamptz,
  unassigned_by text REFERENCES users(user_id) ON DELETE RESTRICT,
  reason text,
  status text NOT NULL CHECK (status IN ('ACTIVE','TERMINATED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_active_device_assignment
  ON tracking_device_assignments(device_id) WHERE status='ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_active_pet_assignment
  ON tracking_device_assignments(pet_id) WHERE status='ACTIVE';

CREATE TABLE IF NOT EXISTS tracking_sessions (
  tracking_session_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  source_device_id text REFERENCES tracking_devices(device_id) ON DELETE RESTRICT,
  source_type text NOT NULL CHECK (source_type IN ('TRACKER_DEVICE','PHONE_LOCATION_SOURCE','BLE_BEACON','CROWD_BLE','MANUAL_ENTRY','SYSTEM_DERIVED')),
  source_context_type text NOT NULL CHECK (source_context_type IN ('DOG_WALK','GENERAL_PET_TRACKING','FUTURE_LOST_PET','MANUAL_TEST')),
  source_context_id text,
  status text NOT NULL CHECK (status IN ('REQUESTED','ACTIVE','PAUSED','COMPLETED','FAILED','CANCELLED')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  tracking_mode text NOT NULL CHECK (tracking_mode IN ('NORMAL','ACTIVE_SESSION','FUTURE_LOST_MODE')),
  route_reference text NOT NULL UNIQUE,
  created_by text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_pet ON tracking_sessions(pet_id, started_at DESC);

CREATE TABLE IF NOT EXISTS tracking_ingestion_events (
  ingestion_id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  source_device_reference text NOT NULL,
  sequence_number bigint,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  signature_verified boolean NOT NULL,
  source_payload_version text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL CHECK(status IN ('ACCEPTED','REJECTED','DUPLICATE')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS tracking_location_observations (
  observation_id text PRIMARY KEY,
  ingestion_id text NOT NULL UNIQUE REFERENCES tracking_ingestion_events(ingestion_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  assignment_id text REFERENCES tracking_device_assignments(assignment_id) ON DELETE RESTRICT,
  tracking_session_id text REFERENCES tracking_sessions(tracking_session_id) ON DELETE SET NULL,
  device_id text NOT NULL REFERENCES tracking_devices(device_id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_provider text NOT NULL,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK(accuracy_m >= 0),
  altitude_m double precision,
  speed_mps double precision CHECK(speed_mps IS NULL OR speed_mps >= 0),
  heading_degrees double precision CHECK(heading_degrees IS NULL OR (heading_degrees >= 0 AND heading_degrees < 360)),
  quality text NOT NULL CHECK(quality IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  clock_skew_ms bigint NOT NULL,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(flags)='array'),
  sequence_number bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_observation_pet_time ON tracking_location_observations(pet_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_observation_session_time ON tracking_location_observations(tracking_session_id, observed_at);

CREATE TABLE IF NOT EXISTS tracking_live_locations (
  pet_id text PRIMARY KEY REFERENCES pets(pet_id) ON DELETE CASCADE,
  latest_observation_id text NOT NULL REFERENCES tracking_location_observations(observation_id) ON DELETE RESTRICT,
  device_id text NOT NULL REFERENCES tracking_devices(device_id) ON DELETE RESTRICT,
  tracking_session_id text REFERENCES tracking_sessions(tracking_session_id) ON DELETE SET NULL,
  observed_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK(accuracy_m >= 0),
  quality text NOT NULL CHECK(quality IN ('HIGH','MEDIUM','LOW','UNKNOWN')),
  source_type text NOT NULL,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(flags)='array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracking_routes (
  route_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  tracking_session_id text NOT NULL UNIQUE REFERENCES tracking_sessions(tracking_session_id) ON DELETE RESTRICT,
  source_context_type text NOT NULL,
  source_context_id text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL CHECK(status IN ('ACTIVE','COMPLETED','PARTIAL','FAILED','INVALIDATED')),
  point_count integer NOT NULL DEFAULT 0 CHECK(point_count>=0),
  distance_meters double precision NOT NULL DEFAULT 0 CHECK(distance_meters>=0),
  distance_reliability text NOT NULL DEFAULT 'UNAVAILABLE' CHECK(distance_reliability IN ('HIGH_CONFIDENCE','LOW_CONFIDENCE','UNAVAILABLE')),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK(duration_seconds>=0),
  route_reference text NOT NULL UNIQUE,
  quality_summary jsonb NOT NULL DEFAULT '{"highQualityPoints":0,"mediumQualityPoints":0,"lowQualityPoints":0,"anomalyCount":0}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS tracking_dead_letters (
  dead_letter_id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  source_device_reference text NOT NULL,
  error_classification text NOT NULL CHECK(error_classification IN ('SIGNATURE_INVALID','MALFORMED_COORDINATES','UNKNOWN_DEVICE','RATE_LIMITED','CLOCK_SKEW','OTHER')),
  error_message text NOT NULL,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload_summary)='object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  reprocessed boolean NOT NULL DEFAULT false,
  reprocessed_at timestamptz
);

-- ============================================================================
-- TRANSPORT: CUSTODY, STOPS, INCIDENTS; EXACT LOCATION STAYS IN TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS transport_driver_profiles (
  driver_profile_id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  business_id text NOT NULL REFERENCES service_businesses(business_id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phone_number_masked text NOT NULL,
  operational_status text NOT NULL CHECK(operational_status IN ('PENDING','ELIGIBLE','ACTIVE','RESTRICTED','SUSPENDED','INACTIVE')),
  verification_status text NOT NULL CHECK(verification_status IN ('UNVERIFIED','VERIFIED','EXPIRED','REJECTED')),
  driving_license_ref_masked text NOT NULL,
  approved_service_types jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(approved_service_types)='array'),
  emergency_contact_masked text NOT NULL,
  verified_at timestamptz,
  verified_by_user_id text REFERENCES users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transport_vehicles (
  vehicle_id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES service_businesses(business_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  registration_number_masked text NOT NULL,
  make_model text NOT NULL,
  vehicle_type text NOT NULL CHECK(vehicle_type IN ('CAR','VAN','SPECIALIZED_PET_VAN','OTHER_APPROVED')),
  operational_status text NOT NULL CHECK(operational_status IN ('AVAILABLE','IN_USE','MAINTENANCE','RESTRICTED','SUSPENDED','RETIRED')),
  verification_status text NOT NULL CHECK(verification_status IN ('UNVERIFIED','VERIFIED','EXPIRED','REJECTED')),
  capacity jsonb NOT NULL CHECK(jsonb_typeof(capacity)='object'),
  sensor_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(sensor_capabilities)='array'),
  last_inspection_date date NOT NULL,
  insurance_valid_until date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transport_trips (
  trip_id text PRIMARY KEY,
  booking_id text NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  business_id text NOT NULL REFERENCES service_businesses(business_id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES provider_profiles(provider_id) ON DELETE RESTRICT,
  assigned_driver_id text REFERENCES transport_driver_profiles(driver_profile_id) ON DELETE RESTRICT,
  assigned_vehicle_id text REFERENCES transport_vehicles(vehicle_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN (
    'SCHEDULED','READY','DRIVER_EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP','PICKUP_VERIFICATION','PET_IN_CUSTODY',
    'IN_TRANSIT','STOP_IN_PROGRESS','ARRIVED_AT_DESTINATION','HANDOVER_PENDING','COMPLETED','ABORTED','CANCELLED','INCIDENT_ACTIVE'
  )),
  trip_type text NOT NULL CHECK(trip_type IN ('ONE_WAY','RETURN','MULTI_STOP','WAIT_AND_RETURN','FACILITY_TRANSFER','RESCUE_TRANSFER','VET_TRANSFER','OTHER_APPROVED')),
  scheduled_pickup_at timestamptz NOT NULL,
  actual_pickup_at timestamptz,
  scheduled_completion_at timestamptz NOT NULL,
  actual_completion_at timestamptz,
  timezone text NOT NULL,
  tracking_session_id text REFERENCES tracking_sessions(tracking_session_id) ON DELETE SET NULL,
  route_reference text,
  current_stop_sequence integer NOT NULL DEFAULT 1 CHECK(current_stop_sequence>0),
  overall_custody_status text NOT NULL CHECK(overall_custody_status IN ('OWNER','DRIVER','INTERMEDIATE_PROVIDER','RECIPIENT','RELEASED','LOST_INCIDENT')),
  active_incident_count integer NOT NULL DEFAULT 0 CHECK(active_incident_count>=0),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transport_trip_household ON transport_trips(household_id, scheduled_pickup_at DESC);
CREATE INDEX IF NOT EXISTS idx_transport_trip_driver ON transport_trips(assigned_driver_id, scheduled_pickup_at DESC);

CREATE TABLE IF NOT EXISTS transport_trip_pets (
  trip_pet_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES transport_trips(trip_id) ON DELETE CASCADE,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  custody_status text NOT NULL CHECK(custody_status IN ('OWNER','DRIVER','INTERMEDIATE_PROVIDER','RECIPIENT','RELEASED','LOST_INCIDENT')),
  current_custodian_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  board_stop_sequence integer NOT NULL CHECK(board_stop_sequence>0),
  exit_stop_sequence integer NOT NULL CHECK(exit_stop_sequence>=board_stop_sequence),
  containment_assignment jsonb,
  notes text,
  UNIQUE(trip_id, pet_id)
);

CREATE TABLE IF NOT EXISTS transport_stops (
  stop_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES transport_trips(trip_id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK(sequence>0),
  stop_type text NOT NULL CHECK(stop_type IN ('PICKUP','DROP_OFF','VETERINARY_STOP','BOARDING_STOP','GROOMING_STOP','RESCUE_STOP','REST_STOP','TRANSFER_STOP','RETURN_ORIGIN_STOP')),
  title text NOT NULL,
  address_public_snippet text NOT NULL,
  exact_address_ciphertext text,
  address_access_window_start timestamptz,
  address_access_window_end timestamptz,
  scheduled_arrival timestamptz NOT NULL,
  actual_arrival timestamptz,
  scheduled_departure timestamptz,
  actual_departure timestamptz,
  recipient_contact_name text NOT NULL,
  recipient_contact_phone_masked text NOT NULL,
  status text NOT NULL CHECK(status IN ('PENDING','EN_ROUTE','ARRIVED','ACTION_REQUIRED','COMPLETED','SKIPPED','FAILED')),
  pet_ids_boarding jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(pet_ids_boarding)='array'),
  pet_ids_exiting jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(pet_ids_exiting)='array'),
  required_actions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(required_actions)='array'),
  notes text,
  UNIQUE(trip_id, sequence)
);

CREATE TABLE IF NOT EXISTS transport_custody_records (
  custody_record_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES transport_trips(trip_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  from_actor_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  from_actor_role text NOT NULL,
  to_actor_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  to_actor_role text NOT NULL,
  stop_id text NOT NULL REFERENCES transport_stops(stop_id) ON DELETE RESTRICT,
  transferred_at timestamptz NOT NULL,
  verification_method text NOT NULL CHECK(verification_method IN ('OWNER_PIN','ID_DOCUMENT','RESCUE_STAFF_BADGE','CLINIC_STAFF_BADGE','AUTHORIZED_CONTACT_CODE','ALTERNATE_RECIPIENT_AUTHORIZATION')),
  verification_proof_hash text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transport_incidents (
  incident_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES transport_trips(trip_id) ON DELETE RESTRICT,
  category text NOT NULL CHECK(category IN (
    'VEHICLE_BREAKDOWN','ROAD_ACCIDENT','PET_ESCAPE','PET_INJURY_OBSERVED','PET_ILLNESS_OBSERVED','PET_DISTRESS_OBSERVED',
    'CONTAINMENT_FAILURE','DRIVER_UNAVAILABLE','ROUTE_BLOCKED','ENVIRONMENTAL_ALERT','HANDOVER_FAILURE','WRONG_PET_ATTEMPT','SECURITY_INCIDENT','OTHER'
  )),
  severity text NOT NULL CHECK(severity IN ('LOW','MODERATE','HIGH','CRITICAL')),
  state text NOT NULL CHECK(state IN ('OPEN','MITIGATING','ESCALATED','OWNER_NOTIFIED','TRANSFER_IN_PROGRESS','RESOLVED','CLOSED')),
  pet_ids jsonb NOT NULL CHECK(jsonb_typeof(pet_ids)='array'),
  reported_at timestamptz NOT NULL,
  reported_by_driver_id text REFERENCES transport_driver_profiles(driver_profile_id) ON DELETE RESTRICT,
  description text NOT NULL,
  action_taken text NOT NULL,
  last_known_tracking_ref text,
  lost_pet_incident_id text,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutable custody chain.
CREATE OR REPLACE FUNCTION petos_prevent_transport_custody_mutation()
RETURNS trigger LANGUAGE plpgsql AS $transport_custody_immutable$
BEGIN
  RAISE EXCEPTION 'TRANSPORT_CUSTODY_RECORD_IS_IMMUTABLE';
END
$transport_custody_immutable$;
DROP TRIGGER IF EXISTS trg_transport_custody_immutable ON transport_custody_records;
CREATE TRIGGER trg_transport_custody_immutable
BEFORE UPDATE OR DELETE ON transport_custody_records
FOR EACH ROW EXECUTE FUNCTION petos_prevent_transport_custody_mutation();

-- ============================================================================
-- RECOVERY: PRIVATE EXACT LOCATION + PUBLIC COARSE PROJECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS recovery_safe_zones (
  safe_zone_id text PRIMARY KEY,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  name text NOT NULL,
  zone_type text NOT NULL CHECK(zone_type IN ('HOME','PARK','DAYCARE','VET_CLINIC','CUSTOM')),
  center_latitude double precision NOT NULL CHECK(center_latitude BETWEEN -90 AND 90),
  center_longitude double precision NOT NULL CHECK(center_longitude BETWEEN -180 AND 180),
  radius_meters double precision NOT NULL CHECK(radius_meters>0),
  hysteresis_buffer_meters double precision NOT NULL DEFAULT 25 CHECK(hysteresis_buffer_meters>=0),
  polygon_coordinates jsonb,
  is_active boolean NOT NULL DEFAULT true,
  alert_on_exit boolean NOT NULL DEFAULT true,
  alert_on_entry boolean NOT NULL DEFAULT false,
  created_by text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_geofence_transitions (
  transition_id text PRIMARY KEY,
  safe_zone_id text NOT NULL REFERENCES recovery_safe_zones(safe_zone_id) ON DELETE RESTRICT,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  observation_id text NOT NULL REFERENCES tracking_location_observations(observation_id) ON DELETE RESTRICT,
  transition_type text NOT NULL CHECK(transition_type IN ('ENTRY','EXIT','DWELL')),
  transition_at timestamptz NOT NULL,
  suppressed_by_hysteresis boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_incidents (
  lost_pet_incident_id text PRIMARY KEY,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  household_id text NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
  reported_by_user_id text NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('REPORTED','ACTIVE','SEARCH_IN_PROGRESS','RECOVERED','CANCELLED')),
  missing_since timestamptz NOT NULL,
  last_known_observation_id text REFERENCES tracking_location_observations(observation_id) ON DELETE RESTRICT,
  last_known_accuracy_m double precision,
  coarse_description text NOT NULL,
  coarse_neighborhood text NOT NULL,
  coarse_district text NOT NULL,
  coarse_city text NOT NULL,
  coarse_county text NOT NULL,
  coarse_center_latitude double precision NOT NULL CHECK(coarse_center_latitude BETWEEN -90 AND 90),
  coarse_center_longitude double precision NOT NULL CHECK(coarse_center_longitude BETWEEN -180 AND 180),
  coarse_radius_km double precision NOT NULL CHECK(coarse_radius_km>0),
  community_alert_requested boolean NOT NULL DEFAULT false,
  community_alert_activated_at timestamptz,
  recovered_at timestamptz,
  resolution_notes text,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_recovery_incident_pet
  ON recovery_incidents(pet_id) WHERE status IN ('REPORTED','ACTIVE','SEARCH_IN_PROGRESS');

CREATE TABLE IF NOT EXISTS recovery_public_profiles (
  profile_id text PRIMARY KEY,
  lost_pet_incident_id text NOT NULL UNIQUE REFERENCES recovery_incidents(lost_pet_incident_id) ON DELETE CASCADE,
  pet_id text NOT NULL REFERENCES pets(pet_id) ON DELETE RESTRICT,
  public_token text NOT NULL UNIQUE,
  pet_display_name text NOT NULL,
  photo_url text,
  species text NOT NULL,
  breed text NOT NULL,
  coarse_missing_area text NOT NULL,
  owner_instructions text NOT NULL,
  emergency_medical_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_sightings (
  sighting_id text PRIMARY KEY,
  lost_pet_incident_id text NOT NULL REFERENCES recovery_incidents(lost_pet_incident_id) ON DELETE CASCADE,
  reporter_user_id text REFERENCES users(user_id) ON DELETE SET NULL,
  reporter_name text,
  reporter_contact_masked text,
  sighting_at timestamptz NOT NULL,
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  coarse_description text NOT NULL,
  notes text NOT NULL,
  photo_url text,
  status text NOT NULL CHECK(status IN ('PENDING_REVIEW','VERIFIED','REJECTED','FLAGGED_ABUSIVE')),
  confidence text NOT NULL CHECK(confidence IN ('LOW','MEDIUM','HIGH')),
  reported_via text NOT NULL CHECK(reported_via IN ('COMMUNITY_ALERT','PUBLIC_RECOVERY_PAGE','QR_TAG_SCAN','DIRECT')),
  flagged_extortion_attempt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recovery_sightings_incident ON recovery_sightings(lost_pet_incident_id, sighting_at DESC);

-- ============================================================================
-- COMMUNITY: COARSE LOCATION ONLY + RECOVERY RELAY
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_profiles (
  profile_id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  handle text NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  neighborhood text NOT NULL,
  city text NOT NULL,
  county text NOT NULL,
  visibility text NOT NULL CHECK(visibility IN ('PRIVATE','COMMUNITY_VISIBLE','PUBLIC')),
  status text NOT NULL CHECK(status IN ('ACTIVE','LIMITED','SUSPENDED')),
  provider_badge text CHECK(provider_badge IS NULL OR provider_badge IN ('VETTED_PROVIDER','VETERINARIAN','TRAINER','SHELTER_PARTNER')),
  is_verified boolean NOT NULL DEFAULT false,
  allows_recovery_relay boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_posts (
  post_id text PRIMARY KEY,
  author_profile_id text NOT NULL REFERENCES community_profiles(profile_id) ON DELETE CASCADE,
  group_id text,
  post_type text NOT NULL CHECK(post_type IN ('GENERAL','QUESTION','PET_UPDATE','TIP','EVENT_UPDATE','RECOVERY_UPDATE','RESOURCE')),
  content text NOT NULL,
  coarse_location_area text,
  status text NOT NULL CHECK(status IN ('ACTIVE','PENDING_REVIEW','LIMITED','REMOVED','USER_DELETED')),
  reaction_counts jsonb NOT NULL DEFAULT '{"LIKE":0,"HELPFUL":0,"SUPPORT":0}'::jsonb,
  comment_count integer NOT NULL DEFAULT 0 CHECK(comment_count>=0),
  is_pinned boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_feed ON community_posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_recovery_alerts (
  community_alert_id text PRIMARY KEY,
  lost_pet_incident_id text NOT NULL UNIQUE REFERENCES recovery_incidents(lost_pet_incident_id) ON DELETE CASCADE,
  recovery_profile_id text NOT NULL REFERENCES recovery_public_profiles(profile_id) ON DELETE CASCADE,
  public_token text NOT NULL,
  pet_display_name text NOT NULL,
  species text NOT NULL,
  breed text NOT NULL,
  photo_url text,
  owner_instructions text,
  coarse_target_area jsonb NOT NULL CHECK(jsonb_typeof(coarse_target_area)='object'),
  status text NOT NULL CHECK(status IN ('ACTIVE','SEARCH_IN_PROGRESS','CLOSED','CANCELLED')),
  visibility_scope text NOT NULL CHECK(visibility_scope IN ('PUBLIC','LOCAL_COMMUNITY')),
  requested_at timestamptz NOT NULL,
  activated_at timestamptz NOT NULL,
  closed_at timestamptz,
  closure_reason text CHECK(closure_reason IS NULL OR closure_reason IN ('RECOVERED','CANCELLED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_recovery_volunteers (
  volunteer_id text PRIMARY KEY,
  community_alert_id text NOT NULL REFERENCES community_recovery_alerts(community_alert_id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES community_profiles(profile_id) ON DELETE CASCADE,
  volunteer_role text NOT NULL CHECK(volunteer_role IN ('SEARCH_PARTICIPANT','FLYER_DISTRIBUTION','SHELTER_CHECKER','TRANSPORT_BACKUP')),
  notes text,
  is_checked_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(community_alert_id, profile_id, volunteer_role)
);

-- ============================================================================
-- AUTHORIZATION HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION petos_can_access_tracking_pet(target_pet_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $tracking_access$
  SELECT EXISTS(
    SELECT 1 FROM pets p
    JOIN household_members hm ON hm.household_id=p.household_id
    WHERE p.pet_id=target_pet_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
$tracking_access$;

CREATE OR REPLACE FUNCTION petos_can_manage_tracking_pet(target_pet_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $tracking_manage$
  SELECT EXISTS(
    SELECT 1 FROM pets p
    JOIN household_members hm ON hm.household_id=p.household_id
    WHERE p.pet_id=target_pet_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
      AND hm.role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN','CAREGIVER')
  )
$tracking_manage$;

CREATE OR REPLACE FUNCTION petos_can_access_transport_trip(target_trip_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $transport_access$
  SELECT EXISTS(
    SELECT 1 FROM transport_trips t
    JOIN bookings b ON b.booking_id=t.booking_id
    LEFT JOIN transport_driver_profiles d ON d.driver_profile_id=t.assigned_driver_id
    LEFT JOIN provider_profiles p ON p.provider_id=t.provider_id
    LEFT JOIN business_memberships bm ON bm.business_id=t.business_id AND bm.user_id=actor_user_id AND bm.is_active
    WHERE t.trip_id=target_trip_id
      AND (b.owner_user_id=actor_user_id OR d.user_id=actor_user_id OR p.user_id=actor_user_id OR bm.user_id IS NOT NULL)
  )
$transport_access$;

CREATE OR REPLACE FUNCTION petos_can_manage_transport_trip(target_trip_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $transport_manage$
  SELECT EXISTS(
    SELECT 1 FROM transport_trips t
    LEFT JOIN transport_driver_profiles d ON d.driver_profile_id=t.assigned_driver_id
    LEFT JOIN provider_profiles p ON p.provider_id=t.provider_id
    LEFT JOIN business_memberships bm ON bm.business_id=t.business_id AND bm.user_id=actor_user_id AND bm.is_active
    WHERE t.trip_id=target_trip_id
      AND (d.user_id=actor_user_id OR p.user_id=actor_user_id OR (bm.user_id IS NOT NULL AND bm.role IN ('OWNER','ADMIN','MANAGER','PROVIDER','STAFF')))
  )
$transport_manage$;

CREATE OR REPLACE FUNCTION petos_can_access_recovery_incident(target_incident_id text, actor_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $recovery_access$
  SELECT EXISTS(
    SELECT 1 FROM recovery_incidents r
    JOIN household_members hm ON hm.household_id=r.household_id
    WHERE r.lost_pet_incident_id=target_incident_id AND hm.user_id=actor_user_id AND hm.status='ACTIVE'
  )
$recovery_access$;

CREATE OR REPLACE FUNCTION petos_recovery_accepting_sightings(target_incident_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $recovery_sighting_open$
  SELECT EXISTS(
    SELECT 1 FROM recovery_incidents r
    WHERE r.lost_pet_incident_id=target_incident_id AND r.status IN ('ACTIVE','SEARCH_IN_PROGRESS')
  )
$recovery_sighting_open$;

GRANT EXECUTE ON FUNCTION petos_can_access_tracking_pet(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_manage_tracking_pet(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_transport_trip(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_manage_transport_trip(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_can_access_recovery_incident(text,text) TO petos_app;
GRANT EXECUTE ON FUNCTION petos_recovery_accepting_sightings(text) TO petos_app;

-- ============================================================================
-- PRIVILEGES
-- ============================================================================

GRANT SELECT,UPDATE ON tracking_devices TO petos_app;
GRANT SELECT,INSERT,UPDATE ON tracking_device_assignments,tracking_sessions TO petos_app;
GRANT SELECT ON tracking_location_observations,tracking_live_locations,tracking_routes TO petos_app;

GRANT SELECT,INSERT,UPDATE ON transport_driver_profiles,transport_vehicles TO petos_app;
GRANT SELECT,INSERT,UPDATE ON transport_trips,transport_trip_pets,transport_stops,transport_incidents TO petos_app;
GRANT SELECT,INSERT ON transport_custody_records TO petos_app;

GRANT SELECT,INSERT,UPDATE ON recovery_safe_zones,recovery_incidents,recovery_sightings TO petos_app;
GRANT SELECT ON recovery_geofence_transitions,recovery_public_profiles TO petos_app;

GRANT SELECT,INSERT,UPDATE ON community_profiles,community_posts,community_recovery_alerts,community_recovery_volunteers TO petos_app;

-- Internal-only tables: telemetry ingestion/dead-letter and exact projection writes.
REVOKE ALL ON tracking_ingestion_events,tracking_dead_letters FROM petos_app;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE tracking_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_location_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_routes ENABLE ROW LEVEL SECURITY;

ALTER TABLE transport_driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_trip_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_custody_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE recovery_safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_geofence_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_sightings ENABLE ROW LEVEL SECURITY;

ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_recovery_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_recovery_volunteers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_device_access ON tracking_devices;
CREATE POLICY tracking_device_access ON tracking_devices FOR SELECT
 USING (household_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM household_members hm WHERE hm.household_id=tracking_devices.household_id
    AND hm.user_id=current_setting('app.user_id',true) AND hm.status='ACTIVE'
 ));
DROP POLICY IF EXISTS tracking_device_update ON tracking_devices;
CREATE POLICY tracking_device_update ON tracking_devices FOR UPDATE
 USING (household_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM household_members hm WHERE hm.household_id=tracking_devices.household_id
    AND hm.user_id=current_setting('app.user_id',true) AND hm.status='ACTIVE'
    AND hm.role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN')
 ))
 WITH CHECK (household_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM household_members hm WHERE hm.household_id=tracking_devices.household_id
    AND hm.user_id=current_setting('app.user_id',true) AND hm.status='ACTIVE'
    AND hm.role IN ('HOUSEHOLD_OWNER','HOUSEHOLD_ADMIN')
 ));

DROP POLICY IF EXISTS tracking_assignment_access ON tracking_device_assignments;
CREATE POLICY tracking_assignment_access ON tracking_device_assignments FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS tracking_assignment_write ON tracking_device_assignments;
CREATE POLICY tracking_assignment_write ON tracking_device_assignments FOR ALL
 USING (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS tracking_session_access ON tracking_sessions;
CREATE POLICY tracking_session_access ON tracking_sessions FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS tracking_session_write ON tracking_sessions;
CREATE POLICY tracking_session_write ON tracking_sessions FOR ALL
 USING (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS tracking_observation_access ON tracking_location_observations;
CREATE POLICY tracking_observation_access ON tracking_location_observations FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS tracking_live_access ON tracking_live_locations;
CREATE POLICY tracking_live_access ON tracking_live_locations FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS tracking_route_access ON tracking_routes;
CREATE POLICY tracking_route_access ON tracking_routes FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_driver_access ON transport_driver_profiles;
DROP POLICY IF EXISTS transport_driver_read ON transport_driver_profiles;
DROP POLICY IF EXISTS transport_driver_insert ON transport_driver_profiles;
DROP POLICY IF EXISTS transport_driver_update ON transport_driver_profiles;
CREATE POLICY transport_driver_read ON transport_driver_profiles FOR SELECT
 USING (user_id=current_setting('app.user_id',true) OR petos_can_manage_business(business_id,current_setting('app.user_id',true)));
CREATE POLICY transport_driver_insert ON transport_driver_profiles FOR INSERT
 WITH CHECK (petos_can_manage_business(business_id,current_setting('app.user_id',true)));
CREATE POLICY transport_driver_update ON transport_driver_profiles FOR UPDATE
 USING (petos_can_manage_business(business_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_business(business_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_vehicle_access ON transport_vehicles;
DROP POLICY IF EXISTS transport_vehicle_read ON transport_vehicles;
DROP POLICY IF EXISTS transport_vehicle_insert ON transport_vehicles;
DROP POLICY IF EXISTS transport_vehicle_update ON transport_vehicles;
CREATE POLICY transport_vehicle_read ON transport_vehicles FOR SELECT
 USING (petos_can_manage_business(business_id,current_setting('app.user_id',true))
   OR EXISTS(SELECT 1 FROM transport_driver_profiles d WHERE d.user_id=current_setting('app.user_id',true) AND d.business_id=transport_vehicles.business_id));
CREATE POLICY transport_vehicle_insert ON transport_vehicles FOR INSERT
 WITH CHECK (petos_can_manage_business(business_id,current_setting('app.user_id',true)));
CREATE POLICY transport_vehicle_update ON transport_vehicles FOR UPDATE
 USING (petos_can_manage_business(business_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_business(business_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_trip_access ON transport_trips;
CREATE POLICY transport_trip_access ON transport_trips FOR SELECT
 USING (petos_can_access_transport_trip(trip_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS transport_trip_write ON transport_trips;
CREATE POLICY transport_trip_write ON transport_trips FOR ALL
 USING (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_business(business_id,current_setting('app.user_id',true))
   OR petos_can_manage_provider(provider_id,current_setting('app.user_id',true))
   OR EXISTS(SELECT 1 FROM transport_driver_profiles d WHERE d.driver_profile_id=assigned_driver_id AND d.user_id=current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_trip_pet_access ON transport_trip_pets;
CREATE POLICY transport_trip_pet_access ON transport_trip_pets FOR SELECT
 USING (petos_can_access_transport_trip(trip_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS transport_trip_pet_write ON transport_trip_pets;
CREATE POLICY transport_trip_pet_write ON transport_trip_pets FOR ALL
 USING (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_stop_access ON transport_stops;
CREATE POLICY transport_stop_access ON transport_stops FOR SELECT
 USING (petos_can_access_transport_trip(trip_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS transport_stop_write ON transport_stops;
CREATE POLICY transport_stop_write ON transport_stops FOR ALL
 USING (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_custody_access ON transport_custody_records;
CREATE POLICY transport_custody_access ON transport_custody_records FOR SELECT
 USING (petos_can_access_transport_trip(trip_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS transport_custody_insert ON transport_custody_records;
CREATE POLICY transport_custody_insert ON transport_custody_records FOR INSERT
 WITH CHECK (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS transport_incident_access ON transport_incidents;
CREATE POLICY transport_incident_access ON transport_incidents FOR SELECT
 USING (petos_can_access_transport_trip(trip_id,current_setting('app.user_id',true)));
DROP POLICY IF EXISTS transport_incident_write ON transport_incidents;
CREATE POLICY transport_incident_write ON transport_incidents FOR ALL
 USING (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_transport_trip(trip_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS recovery_safe_zone_access ON recovery_safe_zones;
CREATE POLICY recovery_safe_zone_access ON recovery_safe_zones FOR ALL
 USING (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS recovery_transition_access ON recovery_geofence_transitions;
CREATE POLICY recovery_transition_access ON recovery_geofence_transitions FOR SELECT
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS recovery_incident_access ON recovery_incidents;
CREATE POLICY recovery_incident_access ON recovery_incidents FOR ALL
 USING (petos_can_access_tracking_pet(pet_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_manage_tracking_pet(pet_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS recovery_public_profile_read ON recovery_public_profiles;
CREATE POLICY recovery_public_profile_read ON recovery_public_profiles FOR SELECT
 USING (is_active OR petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS recovery_sighting_read ON recovery_sightings;
CREATE POLICY recovery_sighting_read ON recovery_sightings FOR SELECT
 USING (petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true))
   OR reporter_user_id=current_setting('app.user_id',true));
DROP POLICY IF EXISTS recovery_sighting_insert ON recovery_sightings;
CREATE POLICY recovery_sighting_insert ON recovery_sightings FOR INSERT
 WITH CHECK (reporter_user_id=current_setting('app.user_id',true)
   AND petos_recovery_accepting_sightings(lost_pet_incident_id));
DROP POLICY IF EXISTS recovery_sighting_update ON recovery_sightings;
CREATE POLICY recovery_sighting_update ON recovery_sightings FOR UPDATE
 USING (petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS community_profile_read ON community_profiles;
CREATE POLICY community_profile_read ON community_profiles FOR SELECT
 USING (user_id=current_setting('app.user_id',true) OR (status='ACTIVE' AND visibility<>'PRIVATE'));
DROP POLICY IF EXISTS community_profile_insert ON community_profiles;
CREATE POLICY community_profile_insert ON community_profiles FOR INSERT
 WITH CHECK (user_id=current_setting('app.user_id',true));
DROP POLICY IF EXISTS community_profile_update ON community_profiles;
CREATE POLICY community_profile_update ON community_profiles FOR UPDATE
 USING (user_id=current_setting('app.user_id',true))
 WITH CHECK (user_id=current_setting('app.user_id',true));

DROP POLICY IF EXISTS community_post_read ON community_posts;
CREATE POLICY community_post_read ON community_posts FOR SELECT
 USING (status IN ('ACTIVE','LIMITED') OR EXISTS(
   SELECT 1 FROM community_profiles p WHERE p.profile_id=community_posts.author_profile_id AND p.user_id=current_setting('app.user_id',true)
 ));
DROP POLICY IF EXISTS community_post_insert ON community_posts;
CREATE POLICY community_post_insert ON community_posts FOR INSERT
 WITH CHECK (EXISTS(
   SELECT 1 FROM community_profiles p WHERE p.profile_id=community_posts.author_profile_id
    AND p.user_id=current_setting('app.user_id',true) AND p.status='ACTIVE'
 ));
DROP POLICY IF EXISTS community_post_update ON community_posts;
CREATE POLICY community_post_update ON community_posts FOR UPDATE
 USING (EXISTS(SELECT 1 FROM community_profiles p WHERE p.profile_id=community_posts.author_profile_id AND p.user_id=current_setting('app.user_id',true)))
 WITH CHECK (EXISTS(SELECT 1 FROM community_profiles p WHERE p.profile_id=community_posts.author_profile_id AND p.user_id=current_setting('app.user_id',true)));

DROP POLICY IF EXISTS community_recovery_alert_read ON community_recovery_alerts;
CREATE POLICY community_recovery_alert_read ON community_recovery_alerts FOR SELECT
 USING (status IN ('ACTIVE','SEARCH_IN_PROGRESS','CLOSED','CANCELLED'));

DROP POLICY IF EXISTS community_recovery_alert_write ON community_recovery_alerts;
CREATE POLICY community_recovery_alert_write ON community_recovery_alerts FOR ALL
 USING (petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true)))
 WITH CHECK (petos_can_access_recovery_incident(lost_pet_incident_id,current_setting('app.user_id',true)));

DROP POLICY IF EXISTS community_recovery_volunteer_read ON community_recovery_volunteers;
CREATE POLICY community_recovery_volunteer_read ON community_recovery_volunteers FOR SELECT
 USING (EXISTS(
   SELECT 1 FROM community_profiles p WHERE p.profile_id=community_recovery_volunteers.profile_id
     AND p.user_id=current_setting('app.user_id',true)
 ) OR EXISTS(
   SELECT 1 FROM community_recovery_alerts a WHERE a.community_alert_id=community_recovery_volunteers.community_alert_id
     AND petos_can_access_recovery_incident(a.lost_pet_incident_id,current_setting('app.user_id',true))
 ));
DROP POLICY IF EXISTS community_recovery_volunteer_insert ON community_recovery_volunteers;
CREATE POLICY community_recovery_volunteer_insert ON community_recovery_volunteers FOR INSERT
 WITH CHECK (EXISTS(
   SELECT 1 FROM community_profiles p WHERE p.profile_id=community_recovery_volunteers.profile_id
     AND p.user_id=current_setting('app.user_id',true) AND p.status='ACTIVE'
 ));

