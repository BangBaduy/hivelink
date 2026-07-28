"use strict";

const { neon } = require("@neondatabase/serverless");
const { requireEnv } = require("./env");

async function check() {
  const sql = neon(requireEnv("DATABASE_URL"));
  const result = await sql`SELECT current_database() AS database, NOW() AS checked_at;`;
  console.log("Database connection succeeded:", result[0]);
}

check().catch((error) => {
  console.error("Database connection failed:", error.message);
  process.exitCode = 1;
});
