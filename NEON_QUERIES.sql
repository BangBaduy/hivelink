-- ==============================================================================
-- HiVE! URL SHORTENER - COMPREHENSIVE NEON POSTGRESQL QUERY SUITE
-- Brand: HiVE! (hiveuin.tech) - HSC TI UIN Jakarta
-- Includes: Password Auth, Password Strength Validation, & Forgot Password Flow
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: DATABASE DDL (TABLE CREATION & INDEXES)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1.1 Create users table (supports passwordless & password auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 1.2 Create otps table (Auth OTP & Forgot Password Reset OTP)
CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(32) DEFAULT 'auth' NOT NULL, -- 'auth' or 'forgot_password'
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 1.3 Create urls table (Short Links & Click Counters)
CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    short_slug VARCHAR(64) UNIQUE NOT NULL,
    clicks BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 1.4 High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls (short_slug);
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);
CREATE INDEX IF NOT EXISTS idx_otps_type ON otps (type);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);

-- ==============================================================================
-- SECTION 2: AUTHENTICATION & PASSWORD OPERATIONS (DML)
-- ==============================================================================

-- 2.1 Register User with Email & Password Hash
INSERT INTO users (email, password_hash)
VALUES (LOWER('user@uinjkt.ac.id'), '$scrypt$N=16384,r=8,p=1$salt$hash...')
RETURNING id, email, created_at;

-- 2.2 Login Validation (Find user by email to verify password hash)
SELECT id, email, password_hash, created_at 
FROM users 
WHERE LOWER(email) = LOWER('user@uinjkt.ac.id') 
LIMIT 1;

-- 2.3 Insert Forgot Password OTP (3-minute expiry, type='forgot_password')
INSERT INTO otps (email, code, type, expires_at, verified)
VALUES ('user@uinjkt.ac.id', '918234', 'forgot_password', NOW() + INTERVAL '3 minutes', FALSE)
RETURNING id, email, code, expires_at, created_at;

-- 2.4 Verify Forgot Password OTP
SELECT id, code, expires_at, verified
FROM otps
WHERE LOWER(email) = LOWER('user@uinjkt.ac.id')
  AND code = '918234'
  AND type = 'forgot_password'
  AND verified = FALSE
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;

-- 2.5 Update User Password (Forgot Password Reset)
UPDATE users
SET password_hash = '$scrypt$N=16384,r=8,p=1$new_salt$new_hash...'
WHERE LOWER(email) = LOWER('user@uinjkt.ac.id')
RETURNING id, email;

-- Mark Forgot Password OTP as verified
UPDATE otps SET verified = TRUE WHERE id = 'otp-id-here';

-- ==============================================================================
-- SECTION 3: URL SHORTENER & REDIRECT OPERATIONS (DML)
-- ==============================================================================

-- 3.1 Create Shortened URL
INSERT INTO urls (original_url, short_slug, user_id)
VALUES ('https://uinjkt.ac.id/agenda', 'AcaraKita', 'user-uuid-or-null')
RETURNING id, user_id, original_url, short_slug, clicks, created_at;

-- 3.2 Server-Side Lookup for Redirect Route (GET /[slug])
SELECT id, user_id, original_url, short_slug, clicks, created_at
FROM urls
WHERE short_slug = 'AcaraKita'
LIMIT 1;

-- 3.3 Atomic Click Count Increment
UPDATE urls SET clicks = clicks + 1 WHERE short_slug = 'AcaraKita';

-- 3.4 Fetch User Links
SELECT id, user_id, original_url, short_slug, clicks, created_at
FROM urls
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC;

-- 3.5 Delete User Link
DELETE FROM urls WHERE id = 'url-id' AND user_id = 'user-id';

-- ==============================================================================
-- SECTION 4: DIAGNOSTIC & MAINTENANCE QUERIES
-- ==============================================================================

-- Overview Stats
SELECT 
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM urls) AS total_links,
    (SELECT COALESCE(SUM(clicks), 0) FROM urls) AS total_clicks;

-- Truncate / Reset Database
-- TRUNCATE TABLE otps, urls, users RESTART IDENTITY CASCADE;

-- Drop All Tables
-- DROP TABLE IF EXISTS urls CASCADE;
-- DROP TABLE IF EXISTS otps CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
