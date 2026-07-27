const { neon } = require("@neondatabase/serverless");

const dbUrl = "postgresql://neondb_owner:npg_Fr2EfBObG4Zn@ep-soft-bread-azesbcoo-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon PostgreSQL database...");
  const sql = neon(dbUrl);

  console.log("Dropping existing tables...");
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
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  console.log("✅ 'users' table created.");

  // 2. Create otps table with type column (auth vs forgot_password)
  await sql`
    CREATE TABLE IF NOT EXISTS otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      code VARCHAR(6) NOT NULL,
      type VARCHAR(32) DEFAULT 'auth' NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified BOOLEAN DEFAULT FALSE NOT NULL,
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

  // 4. Create Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_urls_short_slug ON urls (short_slug);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps (email);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_type ON otps (type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps (created_at DESC);`;
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
