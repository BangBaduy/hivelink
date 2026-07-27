const { neon } = require("@neondatabase/serverless");

const correctUrl = "postgresql://neondb_owner:npg_Fr2EfBObG4Zn@ep-soft-bread-azesbcoo-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const typoUrl = "postgresql://neondatabase_owner:npg_Fr2EfBObG4Zn@ep-soft-bread-azesbcoo-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function check() {
  console.log("1. Testing Typo URL (neondatabase_owner)...");
  try {
    const sql1 = neon(typoUrl);
    await sql1`SELECT 1;`;
    console.log("Typo URL succeeded!");
  } catch (err) {
    console.error("Typo URL failed as expected:", err.message);
  }

  console.log("\n2. Testing Correct URL (neondb_owner)...");
  try {
    const sql2 = neon(correctUrl);
    const res = await sql2`SELECT 1;`;
    console.log("✅ Correct URL succeeded:", res);
  } catch (err) {
    console.error("Correct URL failed:", err.message);
  }
}

check();
