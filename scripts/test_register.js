const { neon } = require("@neondatabase/serverless");
const { requireEnv } = require("./env");

const dbUrl = requireEnv("DATABASE_URL");

async function test() {
  console.log("Connecting to Neon DB...");
  const sql = neon(dbUrl);

  const testEmail = "real_user_" + Date.now() + "@hiveuin.tech";
  const testPasswordHash = "pbkdf2_test_hash_sample";

  console.log("Inserting user into Neon DB:", testEmail);
  const rows = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${testEmail}, ${testPasswordHash})
    RETURNING id, email, password_hash, created_at;
  `;

  console.log("Inserted Row:", rows[0]);

  const check = await sql`SELECT * FROM users WHERE email = ${testEmail};`;
  console.log("Verification Query from Neon DB:", check);

  if (check.length > 0) {
    console.log("\n✅ SUCCESS: User successfully saved to Neon DB!");
  } else {
    console.log("\n❌ FAIL: User was not saved.");
  }
}

test().catch(console.error);
