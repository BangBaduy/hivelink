const { neon } = require("@neondatabase/serverless");
const { Resend } = require("resend");
const crypto = require("crypto");
const { requireEnv } = require("./env");

const dbUrl = requireEnv("DATABASE_URL");
const resendApiKey = requireEnv("RESEND_API_KEY");
const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@upvance.site";

async function debug() {
  console.log("=== DEBUGGING SEND-OTP ROUTE EXECUTION ===");
  const sql = neon(dbUrl);
  const testEmail = "test_debug_" + Date.now() + "@gmail.com";
  const type = "register";

  try {
    console.log("Step 1: Checking existing user...");
    const existing = await sql`SELECT * FROM users WHERE LOWER(email) = ${testEmail};`;
    console.log("Step 1 Result:", existing);

    console.log("Step 2: Generating OTP code...");
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    console.log("Step 3: Inserting OTP into Neon DB...");
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();

    const insertedOtp = await sql`
      INSERT INTO otps (email, code, type, expires_at, verified, created_at)
      VALUES (${testEmail}, ${otpCode}, ${type}, ${expiresAt}, FALSE, ${createdAt})
      RETURNING id, email, code, type, expires_at, created_at;
    `;
    console.log("Step 3 Result (Inserted OTP):", insertedOtp[0]);

    console.log("Step 4: Dispatching email via Resend...");
    const resend = new Resend(resendApiKey);
    const resendResult = await resend.emails.send({
      from: `HiVE! <${fromEmail}>`,
      to: [testEmail],
      subject: "HiVE! - Test Code",
      html: `<p>Your code is <strong>${otpCode}</strong></p>`,
    });

    console.log("Step 4 Result (Resend Response):", resendResult);
  } catch (err) {
    console.error("❌ EXCEPTION CAUGHT:", err);
  }
}

debug();
