BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_url_analytics_daily_lookup
    ON url_analytics_daily (url_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_url_unique_visitors_daily_lookup
    ON url_unique_visitors_daily (url_id, day DESC);

COMMENT ON TABLE url_analytics_daily IS
    'Aggregated link analytics without raw visitor identifiers';
COMMENT ON TABLE url_unique_visitors_daily IS
    'Daily rotating keyed visitor hashes retained for up to 90 days';

COMMIT;
