import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRandomSlug,
  hashPassword,
  passwordNeedsRehash,
  validateSlug,
  validateTargetUrl,
  verifyPassword,
} from "../lib/security.ts";
import {
  consumeRateLimit,
  createShortUrl,
  createOtp,
  getUserLinkAnalytics,
  recordPrivacySafeAnalytics,
  verifyOtpCode,
} from "../lib/db.ts";
import { buildPrivacySafeAnalyticsContext } from "../lib/analytics.ts";

test("password hashes use scrypt and reject incorrect or malformed input", () => {
  const hash = hashPassword("SecurePass123");
  assert.match(hash, /^scrypt\$32768\$8\$1\$/);
  assert.equal(passwordNeedsRehash(hash), false);
  assert.equal(verifyPassword("SecurePass123", hash), true);
  assert.equal(verifyPassword("wrong-password", hash), false);
  assert.equal(verifyPassword("anything", "malformed"), false);
});

test("legacy PBKDF2 hashes remain valid but are marked for migration", async () => {
  const crypto = await import("node:crypto");
  const salt = "00112233445566778899aabbccddeeff";
  const hash = crypto.pbkdf2Sync("LegacyPass1", salt, 10000, 64, "sha512").toString("hex");
  const legacy = `${salt}:${hash}`;
  assert.equal(verifyPassword("LegacyPass1", legacy), true);
  assert.equal(passwordNeedsRehash(legacy), true);
});

test("target URLs and custom aliases enforce security rules", () => {
  assert.equal(validateTargetUrl("https://example.com/path").valid, true);
  assert.equal(validateTargetUrl("http://example.com").valid, false);
  assert.equal(validateTargetUrl("https://127.0.0.1/admin").valid, false);
  assert.equal(validateSlug("api").valid, false);
  assert.equal(validateSlug("safe-alias_123").valid, true);
});

test("random slugs use the configured alphabet and length", () => {
  for (let index = 0; index < 100; index++) {
    assert.match(generateRandomSlug(12), /^[A-Za-z0-9]{12}$/);
  }
});

test("OTP verification is single-use and capped at five attempts", async () => {
  const email = `attempt-cap-${Date.now()}@example.test`;
  await createOtp(email, "123456", "auth");
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(await verifyOtpCode(email, "000000", "auth"), false);
  }
  assert.equal(await verifyOtpCode(email, "123456", "auth"), false);

  await createOtp(email, "654321", "auth");
  assert.equal(await verifyOtpCode(email, "654321", "auth"), true);
  assert.equal(await verifyOtpCode(email, "654321", "auth"), false);
});

test("rate limiting blocks requests over the configured limit", async () => {
  const key = `test:${Date.now()}`;
  assert.equal((await consumeRateLimit(key, 2, 60_000)).allowed, true);
  assert.equal((await consumeRateLimit(key, 2, 60_000)).allowed, true);
  assert.equal((await consumeRateLimit(key, 2, 60_000)).allowed, false);
});

test("analytics never expose raw IPs and rotate visitor hashes daily", async () => {
  process.env.ANALYTICS_HASH_SECRET = "test-only-analytics-secret-at-least-32-characters";
  const request = new Request("https://hiveuin.tech/example", {
    headers: {
      "x-forwarded-for": "203.0.113.42",
      "user-agent": "Mozilla/5.0 (iPhone; Mobile)",
      "cf-ipcountry": "id",
      referer: "https://example.edu/article?private=value",
    },
  });
  const firstDay = buildPrivacySafeAnalyticsContext(
    request,
    new Date("2026-07-28T12:00:00Z")
  );
  const secondDay = buildPrivacySafeAnalyticsContext(
    request,
    new Date("2026-07-29T12:00:00Z")
  );
  assert.equal(firstDay.countryCode, "ID");
  assert.equal(firstDay.device, "mobile");
  assert.equal(firstDay.referrerHost, "example.edu");
  assert.notEqual(firstDay.visitorHash, secondDay.visitorHash);
  assert.equal(JSON.stringify(firstDay).includes("203.0.113.42"), false);

  const userId = `analytics-user-${Date.now()}`;
  const link = await createShortUrl(
    "https://example.com",
    `analytics${Date.now()}`,
    userId
  );
  await recordPrivacySafeAnalytics(link.id, firstDay);
  await recordPrivacySafeAnalytics(link.id, firstDay);
  const analytics = await getUserLinkAnalytics(link.id, userId, 30);
  assert.ok(analytics);
  assert.equal(analytics.summary.clicks, 2);
  assert.equal(analytics.summary.uniqueVisitors, 1);
  assert.equal(analytics.privacy.rawIpStored, false);
});
