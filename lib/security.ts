import { URL } from "url";
import crypto from "crypto";

/**
 * Password Strength Evaluator & Validator
 * Rules:
 * 1. Minimal 8 characters
 * 2. Combination of letters and numbers
 * 3. Both lowercase [a-z] and uppercase [A-Z] letters
 */
export interface PasswordStrengthResult {
  valid: boolean;
  score: number; // 0 to 4
  label: "Weak" | "Medium" | "Strong";
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
  };
  error?: string;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      valid: false,
      score: 0,
      label: "Weak",
      checks: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false },
      error: "Password is required.",
    };
  }

  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  let score = 0;
  if (password.length >= 8) score++;
  if (hasUppercase && hasLowercase) score++;
  if (hasNumber) score++;
  if (password.length >= 12 || (score === 3 && /[^a-zA-Z0-9]/.test(password))) score++;

  let label: "Weak" | "Medium" | "Strong" = "Weak";
  if (score >= 3 && minLength && hasUppercase && hasLowercase && hasNumber) {
    label = "Strong";
  } else if (score >= 2 && minLength) {
    label = "Medium";
  } else {
    label = "Weak";
  }

  const valid = minLength && hasUppercase && hasLowercase && hasNumber;

  let error: string | undefined = undefined;
  if (!valid) {
    const missing: string[] = [];
    if (!minLength) missing.push("at least 8 characters");
    if (!hasUppercase) missing.push("uppercase letter (A-Z)");
    if (!hasLowercase) missing.push("lowercase letter (a-z)");
    if (!hasNumber) missing.push("number (0-9)");
    error = `Password must include: ${missing.join(", ")}.`;
  }

  return {
    valid,
    score,
    label,
    checks: {
      minLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
    },
    error,
  };
}

/**
 * Secure Password Hashing using Node.js Crypto (pbkdf2)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  if (!combinedHash || !combinedHash.includes(":")) return false;
  const [salt, originalHash] = combinedHash.split(":");
  const hashToVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(hashToVerify, "hex"));
}

/**
 * List of system reserved slugs that cannot be claimed as custom shortened URLs.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "login",
  "register",
  "dashboard",
  "auth",
  "static",
  "public",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "privacy",
  "terms",
  "hsc",
  "uin",
  "hivelab",
  "health",
  "metrics",
]);

/**
 * Rate Limiter
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_DURATION_MS = 60 * 1000;

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (rateLimitStore.size > 5000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetTime <= now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetTime <= now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + WINDOW_DURATION_MS,
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetMs: WINDOW_DURATION_MS };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: Math.max(0, entry.resetTime - now),
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - entry.count,
    resetMs: Math.max(0, entry.resetTime - now),
  };
}

/**
 * SSRF & Malicious Scheme Protection
 */
export function validateTargetUrl(rawUrl: string): { valid: boolean; error?: string; parsedUrl?: URL } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Please enter a valid web address starting with https://" };
  }

  let trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return { valid: false, error: "Please paste a valid web link starting with https://" };
  }

  if (!trimmed.startsWith("https://")) {
    return { valid: false, error: "Please paste a valid web link starting with https://" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Please enter a valid web address starting with https://" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Please enter a valid web address starting with https://" };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopbackOrLocal =
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]";

  if (isLoopbackOrLocal) {
    return { valid: false, error: "Internal or local network addresses cannot be shortened." };
  }

  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return { valid: false, error: "Protected system endpoints cannot be shortened." };
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const [, p1, p2] = match.map(Number);
    if (
      p1 === 10 ||
      (p1 === 172 && p2 >= 16 && p2 <= 31) ||
      (p1 === 192 && p2 === 168) ||
      (p1 === 169 && p2 === 254)
    ) {
      return { valid: false, error: "Private IP addresses cannot be shortened." };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Custom Slug Validation & Sanitization
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: true };
  const trimmed = slug.trim();

  if (trimmed.length < 3 || trimmed.length > 64) {
    return { valid: false, error: "Custom alias must be between 3 and 64 characters long." };
  }

  const slugRegex = /^[a-zA-Z0-9_-]+$/;
  if (!slugRegex.test(trimmed)) {
    return { valid: false, error: "Alias can only contain letters, numbers, hyphens (-), and underscores (_)." };
  }

  if (RESERVED_SLUGS.has(trimmed.toLowerCase())) {
    return { valid: false, error: `The alias '${trimmed}' is reserved. Please choose another.` };
  }

  return { valid: true };
}

/**
 * Generate a random slug
 */
export function generateRandomSlug(length: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
