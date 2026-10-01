/**
 * Pet OS Sprint 2 - Database Schema & DDL Migration Specifications
 * Implements Volume XXX (Database Schema & Technical Data Dictionary) & Step 30
 */

export const SPRINT_2_MIGRATION_SQL = `
-- =========================================================================
-- Pet OS Migration: 0002_identity_and_households.sql
-- Volume XXX: Canonical Relational Schema for Sprint 2
-- Standard: PostgreSQL 16+ / Cloud SQL / UUIDv7 Primary Keys
-- =========================================================================

-- Enable pgcrypto for auxiliary entropy if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(32),
    phone_verified_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    password_hash VARCHAR(255) NOT NULL,
    account_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    failed_login_attempts INT NOT NULL DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deletion_scheduled_for TIMESTAMPTZ,
    policy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    policy_version VARCHAR(32) NOT NULL,
    CONSTRAINT chk_account_status CHECK (
        account_status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETION_PENDING', 'DELETED')
    ),
    CONSTRAINT uq_users_normalized_email UNIQUE (normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number) WHERE phone_number IS NOT NULL;

-- 2. USER PROFILES TABLE (Separate from security credentials)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    locale VARCHAR(10) NOT NULL DEFAULT 'en-KE',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Nairobi',
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    sms_notifications BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    profile_visibility VARCHAR(32) NOT NULL DEFAULT 'HOUSEHOLD_ONLY',
    share_activity_with_household BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- 4. VERIFICATION TOKENS TABLE
CREATE TABLE IF NOT EXISTS verification_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    token_type VARCHAR(32) NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_hash ON verification_tokens(token_hash);

-- 5. PASSWORD RESET TOKENS TABLE
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_hash ON password_reset_tokens(token_hash);

-- 6. HOUSEHOLDS TABLE
CREATE TABLE IF NOT EXISTS households (
    household_id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    owner_user_id UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CONSTRAINT chk_household_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_households_status ON households(status);

-- 7. HOUSEHOLD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS household_members (
    membership_id UUID PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(user_id),
    expires_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_household_role CHECK (
        role IN ('HOUSEHOLD_OWNER', 'HOUSEHOLD_ADMIN', 'CAREGIVER', 'FAMILY_MEMBER', 'TEMPORARY_CAREGIVER')
    ),
    CONSTRAINT chk_membership_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REMOVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_household_member 
ON household_members(household_id, user_id) 
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON household_members(user_id);

-- 8. HOUSEHOLD INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS household_invitations (
    invitation_id UUID PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(household_id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL REFERENCES users(user_id),
    invitee_email VARCHAR(255) NOT NULL,
    intended_role VARCHAR(32) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    temporary_access_duration_days INT,
    CONSTRAINT chk_invitation_status CHECK (
        status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')
    ),
    CONSTRAINT chk_invitation_role CHECK (
        intended_role IN ('HOUSEHOLD_OWNER', 'HOUSEHOLD_ADMIN', 'CAREGIVER', 'FAMILY_MEMBER', 'TEMPORARY_CAREGIVER')
    )
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON household_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invitations_household ON household_invitations(household_id);
`;
