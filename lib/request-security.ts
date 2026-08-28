import crypto from "crypto";
import { consumeRateLimit } from "@/lib/db";
import { getTrustedClientIp } from "@/lib/client-ip";

export const OTP_PURPOSES = ["auth", "register", "forgot_password"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return typeof value === "string" && OTP_PURPOSES.includes(value as OtpPurpose);
}

export function getClientIp(req: Request): string {
  return getTrustedClientIp(req);
}

function rateLimitKey(scope: string, value: string): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("RATE_LIMIT_SECRET or JWT_SECRET must be configured securely.");
  }
  const digest = crypto.createHmac("sha256", secret).update(value.toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkIpRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number
): Promise<AuthRateLimitResult> {
  return consumeRateLimit(rateLimitKey(`${scope}:ip`, getClientIp(req)), limit, windowMs);
}

export async function checkAuthRateLimits(
  req: Request,
  email: string,
  action: "otp-send" | "otp-verify" | "password-login"
): Promise<AuthRateLimitResult> {
  const policies = {
    "otp-send": { emailLimit: 3, ipLimit: 10, windowMs: 15 * 60 * 1000 },
    "otp-verify": { emailLimit: 10, ipLimit: 30, windowMs: 15 * 60 * 1000 },
    "password-login": { emailLimit: 10, ipLimit: 30, windowMs: 15 * 60 * 1000 },
  } as const;
  const policy = policies[action];
  const ip = getClientIp(req);
  const [emailResult, ipResult] = await Promise.all([
    consumeRateLimit(rateLimitKey(`${action}:email`, email), policy.emailLimit, policy.windowMs),
    consumeRateLimit(rateLimitKey(`${action}:ip`, ip), policy.ipLimit, policy.windowMs),
  ]);

  return {
    allowed: emailResult.allowed && ipResult.allowed,
    retryAfterSeconds: Math.max(emailResult.retryAfterSeconds, ipResult.retryAfterSeconds),
  };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { success: false, message: "Too many attempts. Please wait before trying again." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    }
  );
}
