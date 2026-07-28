import crypto from "crypto";

export type AnalyticsDevice = "desktop" | "mobile" | "tablet" | "bot" | "other";

export interface PrivacySafeAnalyticsContext {
  day: string;
  countryCode: string;
  device: AnalyticsDevice;
  referrerHost: string;
  visitorHash: string;
}

function getAnalyticsSecret(): string {
  const secret = process.env.ANALYTICS_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ANALYTICS_HASH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function classifyDevice(userAgent: string): AnalyticsDevice {
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|slurp|headless/.test(ua)) return "bot";
  if (/ipad|tablet|kindle|silk/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android/.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "other";
}

function sanitizeCountryCode(req: Request): string {
  const value =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    "ZZ";
  return /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : "ZZ";
}

function sanitizeReferrerHost(req: Request): string {
  const referrer = req.headers.get("referer");
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    const currentHost = new URL(req.url).hostname.toLowerCase();
    if (!host || host === currentHost) return "direct";
    return host.slice(0, 255);
  } catch {
    return "direct";
  }
}

function getClientIpForHash(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 64);
}

/**
 * Produces only privacy-safe analytics dimensions. The raw IP address is used
 * transiently for a daily rotating HMAC and is never returned or persisted.
 */
export function buildPrivacySafeAnalyticsContext(
  req: Request,
  now: Date = new Date()
): PrivacySafeAnalyticsContext {
  const day = now.toISOString().slice(0, 10);
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
  const visitorHash = crypto
    .createHmac("sha256", getAnalyticsSecret())
    .update(`${day}\n${getClientIpForHash(req)}\n${userAgent}`)
    .digest("hex");

  return {
    day,
    countryCode: sanitizeCountryCode(req),
    device: classifyDevice(userAgent),
    referrerHost: sanitizeReferrerHost(req),
    visitorHash,
  };
}
