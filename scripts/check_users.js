const { neon } = require("@neondatabase/serverless");
const { requireEnv } = require("./env");

const dbUrl = requireEnv("DATABASE_URL");

async function main() {
  console.log("Querying Neon DB users and otps tables...");
  const sql = neon(dbUrl);

  const users = await sql`SELECT COUNT(*)::integer AS count FROM users;`;
  const otps = await sql`SELECT COUNT(*)::integer AS count FROM otps WHERE expires_at > NOW();`;
  const urls = await sql`SELECT COUNT(*)::integer AS count FROM urls;`;
  console.log({
    users: users[0].count,
    activeOtps: otps[0].count,
    urls: urls[0].count,
  });
}

main().catch(console.error);
