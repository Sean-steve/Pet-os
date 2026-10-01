-- ============================================================================
-- PET OS MIGRATION: 0003_pet_core.sql
-- Domain: Pet Core, Digital Twin, Ownership & Microchip Identity
-- Standards: PostgreSQL 16+, UUIDv7, RFC 9562, Volume V, Volume XXI, Volume XXX
-- ============================================================================

-- Reference Data: Species Catalog
CREATE TABLE IF NOT EXISTS species_reference (
    code VARCHAR(50) PRIMARY KEY,
    common_name VARCHAR(100) NOT NULL,
    scientific_name VARCHAR(150) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Reference Data: Breed Catalog
CREATE TABLE IF NOT EXISTS breed_reference (
    code VARCHAR(100) PRIMARY KEY,
    species_code VARCHAR(50) NOT NULL REFERENCES species_reference(code) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    size_category VARCHAR(30) NOT NULL,
    coat_type VARCHAR(100),
    origin VARCHAR(100),
    aliases TEXT[] DEFAULT ARRAY[]::TEXT[],
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Core Aggregate: Pets
CREATE TABLE IF NOT EXISTS pets (
    pet_id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    species_code VARCHAR(50) NOT NULL REFERENCES species_reference(code) ON DELETE RESTRICT,
    breed_code VARCHAR(100) NOT NULL REFERENCES breed_reference(code) ON DELETE RESTRICT,
    secondary_breed_code VARCHAR(100) REFERENCES breed_reference(code) ON DELETE SET NULL,
    mixed_breed BOOLEAN NOT NULL DEFAULT FALSE,
    unknown_breed BOOLEAN NOT NULL DEFAULT FALSE,
    custom_breed_name VARCHAR(100),
    sex VARCHAR(20) NOT NULL CHECK (sex IN ('MALE', 'FEMALE', 'UNKNOWN')),
    reproductive_status VARCHAR(20) NOT NULL CHECK (reproductive_status IN ('INTACT', 'STERILIZED', 'UNKNOWN')),
    date_of_birth DATE,
    birthdate_precision VARCHAR(30) NOT NULL CHECK (birthdate_precision IN ('EXACT', 'ESTIMATED_MONTH_YEAR', 'ESTIMATED_YEAR', 'UNKNOWN')),
    estimated_birthdate BOOLEAN NOT NULL DEFAULT FALSE,
    primary_color VARCHAR(50) NOT NULL,
    secondary_color VARCHAR(50),
    markings TEXT,
    coat_type VARCHAR(50),
    size_classification VARCHAR(30) NOT NULL CHECK (size_classification IN ('TOY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT', 'NOT_APPLICABLE', 'UNKNOWN')),
    profile_photo_id UUID,
    lifecycle_stage VARCHAR(30) NOT NULL CHECK (lifecycle_stage IN ('PUPPY', 'KITTEN', 'JUVENILE', 'ADOLESCENT', 'ADULT', 'SENIOR', 'UNKNOWN')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'MISSING', 'ARCHIVED', 'DECEASED')),
    deceased_at TIMESTAMPTZ,
    deceased_note TEXT,
    archived_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INT NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Business Invariants
    CONSTRAINT chk_pets_dob_not_future CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
    CONSTRAINT chk_pets_deceased_status CHECK (
        (status = 'DECEASED' AND deceased_at IS NOT NULL) OR
        (status != 'DECEASED' AND deceased_at IS NULL)
    ),
    CONSTRAINT chk_pets_archived_status CHECK (
        (status = 'ARCHIVED' AND archived_at IS NOT NULL) OR
        (status != 'ARCHIVED' AND archived_at IS NULL)
    )
);

-- Passive RFID Microchip Identity (NOT GPS)
CREATE TABLE IF NOT EXISTS pet_microchips (
    microchip_id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    microchip_number VARCHAR(50) NOT NULL,
    issuer VARCHAR(100),
    implantation_date DATE,
    registry_name VARCHAR(100),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('UNVERIFIED', 'VERIFIED', 'PENDING')),
    verified_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_pet_microchip_pet UNIQUE (pet_id),
    CONSTRAINT chk_microchip_number_format CHECK (microchip_number ~ '^[A-Z0-9]{9,15}$')
);

-- Pet Media / Photo Attachments
CREATE TABLE IF NOT EXISTS pet_photos (
    photo_id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760), -- 10MB limit
    width INT,
    height INT,
    purpose VARCHAR(30) NOT NULL DEFAULT 'GALLERY' CHECK (purpose IN ('PROFILE', 'IDENTIFICATION', 'GALLERY')),
    uploaded_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Pet Specific Ownership & Caregiver Relationships
CREATE TABLE IF NOT EXISTS pet_relationships (
    relationship_id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
    pet_id UUID NOT NULL REFERENCES pets(pet_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    relationship_type VARCHAR(30) NOT NULL CHECK (relationship_type IN ('PRIMARY_OWNER', 'CO_OWNER', 'CAREGIVER', 'TEMPORARY_CAREGIVER', 'VIEW_ONLY')),
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_pet_relationship UNIQUE (pet_id, user_id)
);

-- Partial Foreign Key for profile photo on pets
ALTER TABLE pets 
    ADD CONSTRAINT fk_pets_profile_photo 
    FOREIGN KEY (profile_photo_id) 
    REFERENCES pet_photos(photo_id) 
    ON DELETE SET NULL;

-- Strategic Indexes
CREATE INDEX IF NOT EXISTS idx_pets_household_id ON pets(household_id);
CREATE INDEX IF NOT EXISTS idx_pets_species_breed ON pets(species_code, breed_code);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_created_at ON pets(created_at);
CREATE INDEX IF NOT EXISTS idx_pet_microchips_number ON pet_microchips(microchip_number);
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_active ON pet_photos(pet_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pet_relationships_user ON pet_relationships(user_id);
