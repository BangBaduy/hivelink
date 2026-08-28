const { neon } = require("@neondatabase/serverless");
const { requireEnv } = require("./env");

const dbUrl = requireEnv("DATABASE_URL");

async function main() {
  console.log("Connecting to Neon PostgreSQL database...");
  const sql = neon(dbUrl);

  console.log("Dropping existing tables...");
  await sql`DROP TABLE IF EXISTS url_unique_visitors_daily CASCADE;`;
  await sql`DROP TABLE IF EXISTS url_analytics_daily CASCADE;`;
  await sql`DROP TABLE IF EXISTS rate_limits CASCADE;`;
  await sql`DROP TABLE IF EXISTS urls CASCADE;`;
  await sql`DROP TABLE IF EXISTS otps CASCADE;`;
  await sql`DROP TABLE IF EXISTS users CASCADE;`;
  console.log("✅ All existing tables dropped.");

  console.log("Creating updated tables with Password & Forgot Password support...");

  // 1. Create users table with password_hash column
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT DEFAULT NULL,
      session_version INTEGER DEFAULT 0 NOT NULL CHECK (session_version >= 0),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  console.log("✅ 'users' table created.");

  // 2. Create otps table with type column (auth vs forgot_password)
  await sql`
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
  `;
  console.log("✅ 'otps' table created.");

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
  console.log("✅ 'urls' table created.");

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
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_type ON otps (type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_url_analytics_daily_lookup ON url_analytics_daily (url_id, day DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_url_unique_visitors_daily_lookup ON url_unique_visitors_daily (url_id, day DESC);`;
  console.log("✅ Indexes created.");

  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log("\n🎉 Database migration complete! Live tables in Neon DB:", tables.map(t => t.table_name));
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
