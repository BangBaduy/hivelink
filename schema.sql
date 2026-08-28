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
    session_version INTEGER DEFAULT 0 NOT NULL CHECK (session_version >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Create otps table for authentication and forgot password reset
-- Verification code expires strictly after 3 minutes (NOW() + INTERVAL '3 minutes')
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    type VARCHAR(32) DEFAULT 'auth' NOT NULL
        CHECK (type IN ('auth', 'register', 'forgot_password')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL CHECK (attempts >= 0 AND attempts <= 5),
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

-- 4. Shared rate limits for serverless instances
CREATE TABLE IF NOT EXISTS rate_limits (
    rate_key VARCHAR(128) PRIMARY KEY,
    count INTEGER DEFAULT 0 NOT NULL CHECK (count >= 0),
    reset_at TIMESTAMPTZ NOT NULL
);

-- 5. Privacy-preserving aggregate analytics (never stores raw IP addresses)
CREATE TABLE IF NOT EXISTS url_analytics_daily (
    url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    country_code CHAR(2) DEFAULT 'ZZ' NOT NULL,
    device_type VARCHAR(16) DEFAULT 'other' NOT NULL,
    referrer_host VARCHAR(255) DEFAULT 'direct' NOT NULL,
    clicks BIGINT DEFAULT 0 NOT NULL CHECK (clicks >= 0),
    PRIMARY KEY (url_id, day, country_code, device_type, referrer_host)
);

CREATE TABLE IF NOT EXISTS url_unique_visitors_daily (
    url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    visitor_hash CHAR(64) NOT NULL,
    PRIMARY KEY (url_id, day, visitor_hash)
);

-- 6. Create high-performance indexes
CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls (short_slug);
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);
CREATE INDEX IF NOT EXISTS idx_otps_type ON otps (type);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);
CREATE INDEX IF NOT EXISTS idx_url_analytics_daily_lookup
    ON url_analytics_daily (url_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_url_unique_visitors_daily_lookup
    ON url_unique_visitors_daily (url_id, day DESC);

-- Table comments
COMMENT ON TABLE users IS 'Registered users with passwordless OTP or password authentication';
COMMENT ON TABLE otps IS 'Stores 3-minute OTP verification codes for auth and password reset';
COMMENT ON TABLE urls IS 'Shortened links with click analytics for HSC TI UIN Jakarta';
COMMENT ON TABLE rate_limits IS 'Shared authentication and abuse-prevention counters';
COMMENT ON TABLE url_analytics_daily IS 'Aggregated link analytics without raw visitor identifiers';
COMMENT ON TABLE url_unique_visitors_daily IS 'Daily rotating keyed hashes retained for up to 90 days';
