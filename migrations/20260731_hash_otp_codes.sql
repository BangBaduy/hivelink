BEGIN;

ALTER TABLE otps
    ADD COLUMN IF NOT EXISTS code_hash CHAR(64);

-- Existing plaintext OTPs cannot be converted securely without their secret.
-- Invalidate them and replace their stored value with a non-sensitive marker.
UPDATE otps
SET code_hash = repeat('0', 64),
    verified = TRUE
WHERE code_hash IS NULL;

ALTER TABLE otps
    ALTER COLUMN code_hash SET NOT NULL;

ALTER TABLE otps
    DROP COLUMN IF EXISTS code;

ALTER TABLE otps
    DROP CONSTRAINT IF EXISTS otps_code_hash_check;
ALTER TABLE otps
    ADD CONSTRAINT otps_code_hash_check
    CHECK (code_hash ~ '^[0-9a-f]{64}$');

COMMIT;
