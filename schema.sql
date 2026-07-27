-- ==============================================================================
-- HiVE! URL SHORTENER - UPDATED NEON POSTGRESQL SCHEMA
-- Brand: HiVE! (hiveuin.tech) - HSC TI UIN Jakarta
-- Includes: Password Auth, Passwordless OTP, & Forgot Password Flow
-- ==============================================================================

-- 1. Create users table with password_hash support
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Create otps table for authentication and forgot password reset
-- Verification code expires strictly after 3 minutes (NOW() + INTERVAL '3 minutes')
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(32) DEFAULT 'auth' NOT NULL, -- 'auth' or 'forgot_password'
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Create urls table
CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    short_slug VARCHAR(64) UNIQUE NOT NULL,
    clicks BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Create high-performance indexes
CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls (short_slug);
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);
CREATE INDEX IF NOT EXISTS idx_otps_type ON otps (type);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);

-- Table comments
COMMENT ON TABLE users IS 'Registered users with passwordless OTP or password authentication';
COMMENT ON TABLE otps IS 'Stores 3-minute OTP verification codes for auth and password reset';
COMMENT ON TABLE urls IS 'Shortened links with click analytics for HSC TI UIN Jakarta';
