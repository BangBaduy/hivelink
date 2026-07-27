const { neon } = require("@neondatabase/serverless");

const dbUrl = "postgresql://neondb_owner:npg_Fr2EfBObG4Zn@ep-soft-bread-azesbcoo-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Querying Neon DB users and otps tables...");
  const sql = neon(dbUrl);

  const users = await sql`SELECT * FROM users;`;
  console.log("Users in Neon DB:", users);

  const otps = await sql`SELECT * FROM otps ORDER BY created_at DESC LIMIT 10;`;
  console.log("OTPs in Neon DB:", otps);

  const urls = await sql`SELECT * FROM urls ORDER BY created_at DESC LIMIT 10;`;
  console.log("URLs in Neon DB:", urls);
}

main().catch(console.error);
