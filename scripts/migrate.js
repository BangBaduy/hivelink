const { neon } = require("@neondatabase/serverless");
const { requireEnv } = require("./env");

const dbUrl = requireEnv("DATABASE_URL");

async function main() {
  console.log("Connecting to Neon PostgreSQL database...");
  const sql = neon(dbUrl);

  console.log("Creating tables...");

  // 1. Create users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT DEFAULT NULL,
      session_version INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  console.log("✅ 'users' table created/verified.");

  // 2. Create otps table
  await sql`
    CREATE TABLE IF NOT EXISTS otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      type VARCHAR(32) DEFAULT 'auth' NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified BOOLEAN DEFAULT FALSE NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  console.log("✅ 'otps' table created/verified.");

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 0 NOT NULL;`;
  await sql`ALTER TABLE otps ADD COLUMN IF NOT EXISTS type VARCHAR(32) DEFAULT 'auth' NOT NULL;`;
  await sql`ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0 NOT NULL;`;
  await sql`UPDATE otps SET verified = TRUE WHERE type NOT IN ('auth', 'register', 'forgot_password');`;
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_session_version_check;`;
  await sql`ALTER TABLE users ADD CONSTRAINT users_session_version_check CHECK (session_version >= 0);`;
  await sql`ALTER TABLE otps DROP CONSTRAINT IF EXISTS otps_type_check;`;
  await sql`ALTER TABLE otps ADD CONSTRAINT otps_type_check CHECK (type IN ('auth', 'register', 'forgot_password'));`;
  await sql`ALTER TABLE otps DROP CONSTRAINT IF EXISTS otps_attempts_check;`;
  await sql`ALTER TABLE otps ADD CONSTRAINT otps_attempts_check CHECK (attempts >= 0 AND attempts <= 5);`;

  // 3. Create urls table
  await sql`
    CREATE TABLE IF NOT EXISTS urls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      original_url TEXT NOT NULL,
      short_slug VARCHAR(64) UNIQUE NOT NULL,
      clicks BIGINT DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  console.log("✅ 'urls' table created/verified.");

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      rate_key VARCHAR(128) PRIMARY KEY,
      count INTEGER DEFAULT 0 NOT NULL CHECK (count >= 0),
      reset_at TIMESTAMPTZ NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS url_analytics_daily (
      url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      country_code CHAR(2) DEFAULT 'ZZ' NOT NULL,
      device_type VARCHAR(16) DEFAULT 'other' NOT NULL,
      referrer_host VARCHAR(255) DEFAULT 'direct' NOT NULL,
      clicks BIGINT DEFAULT 0 NOT NULL CHECK (clicks >= 0),
      PRIMARY KEY (url_id, day, country_code, device_type, referrer_host)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS url_unique_visitors_daily (
      url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      visitor_hash CHAR(64) NOT NULL,
      PRIMARY KEY (url_id, day, visitor_hash)
    );
  `;

  // 4. Create Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls (short_slug);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_url_analytics_daily_lookup ON url_analytics_daily (url_id, day DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_url_unique_visitors_daily_lookup ON url_unique_visitors_daily (url_id, day DESC);`;
  console.log("✅ Indexes created/verified.");

  // Verify tables list
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log("\n🎉 Database setup complete! Tables in Neon DB:", tables.map(t => t.table_name));
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
