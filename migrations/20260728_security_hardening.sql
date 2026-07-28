BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_session_version_check;
ALTER TABLE users
    ADD CONSTRAINT users_session_version_check
    CHECK (session_version >= 0);

ALTER TABLE otps
    ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0 NOT NULL;

UPDATE otps
SET verified = TRUE
WHERE type NOT IN ('auth', 'register', 'forgot_password');

ALTER TABLE otps
    DROP CONSTRAINT IF EXISTS otps_type_check;
ALTER TABLE otps
    ADD CONSTRAINT otps_type_check
    CHECK (type IN ('auth', 'register', 'forgot_password'));

ALTER TABLE otps
    DROP CONSTRAINT IF EXISTS otps_attempts_check;
ALTER TABLE otps
    ADD CONSTRAINT otps_attempts_check
    CHECK (attempts >= 0 AND attempts <= 5);

CREATE TABLE IF NOT EXISTS rate_limits (
    rate_key VARCHAR(128) PRIMARY KEY,
    count INTEGER DEFAULT 0 NOT NULL CHECK (count >= 0),
    reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
    ON rate_limits (reset_at);

COMMIT;
