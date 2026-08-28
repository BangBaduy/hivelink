import crypto from "crypto";

function getOtpHashSecret(): string {
  const secret =
    process.env.OTP_HASH_SECRET ||
    process.env.RATE_LIMIT_SECRET ||
    process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "OTP_HASH_SECRET, RATE_LIMIT_SECRET, or JWT_SECRET must be configured securely."
    );
  }
  return secret;
}

export function hashOtpCode(
  email: string,
  code: string,
  type: string
): string {
  return crypto
    .createHmac("sha256", getOtpHashSecret())
    .update(`hive-otp-v1\n${type}\n${email.toLowerCase().trim()}\n${code}`)
    .digest("hex");
}
