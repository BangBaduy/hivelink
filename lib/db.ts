import { neon } from "@neondatabase/serverless";
import type { PrivacySafeAnalyticsContext } from "@/lib/analytics";

export interface UserRecord {
  id: string;
  email: string;
  password_hash?: string | null;
  session_version: number;
  created_at: string;
}

export interface OtpRecord {
  id: string;
  email: string;
  code: string;
  type: string; // 'auth' or 'forgot_password'
  expires_at: string;
  verified: boolean;
  attempts: number;
  created_at: string;
}

export interface UrlRecord {
  id: string;
  user_id?: string | null;
  original_url: string;
  short_slug: string;
  title?: string;
  clicks: number;
  created_at: string;
}

// Memory fallback store
const memoryUsers = new Map<string, UserRecord>();
const memoryOtps: OtpRecord[] = [];
const memoryUrls = new Map<string, UrlRecord>();
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const memoryAnalytics = new Map<
  string,
  {
    dimensions: Map<string, number>;
    visitors: Set<string>;
  }
>();

export interface LinkAnalyticsResult {
  link: {
    id: string;
    shortSlug: string;
    originalUrl: string;
    totalClicks: number;
  };
  periodDays: number;
  summary: {
    clicks: number;
    uniqueVisitors: number;
  };
  daily: Array<{ date: string; clicks: number; uniqueVisitors: number }>;
  devices: Array<{ label: string; clicks: number }>;
  countries: Array<{ label: string; clicks: number }>;
  referrers: Array<{ label: string; clicks: number }>;
  privacy: {
    rawIpStored: false;
    uniqueVisitorMethod: string;
    uniqueVisitorRetentionDays: number;
  };
}

/**
 * Check if Neon Database URL is configured
 */
export function isNeonConfigured(): boolean {
  return !!process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres");
}

let cachedSql: ReturnType<typeof neon> | null = null;

/**
 * Get SQL query executor using @neondatabase/serverless
 */
export function getSql() {
  if (isNeonConfigured()) {
    if (!cachedSql) {
      cachedSql = neon(process.env.DATABASE_URL!);
    }
    return cachedSql;
  }
  return null;
}

// ----------------------------------------------------
// OTP Database Helpers
// ----------------------------------------------------

/**
 * Insert a new 3-minute OTP verification record (type: 'auth' | 'forgot_password')
 */
export async function createOtp(email: string, code: string, type: string = "auth"): Promise<OtpRecord> {
  const sql = getSql();
  const expiresAtDate = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
  const expiresAt = expiresAtDate.toISOString();
  const createdAt = new Date().toISOString();

  if (sql) {
    await sql`
      UPDATE otps
      SET verified = TRUE
      WHERE LOWER(email) = ${email.toLowerCase()}
        AND type = ${type}
        AND verified = FALSE;
    `;
    const rows = (await sql`
      INSERT INTO otps (email, code, type, expires_at, verified, attempts)
      VALUES (${email.toLowerCase()}, ${code}, ${type}, NOW() + INTERVAL '3 minutes', FALSE, 0)
      RETURNING id, email, code, type, expires_at, verified, attempts, created_at;
    `) as Record<string, any>[];
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      code: row.code,
      type: row.type,
      expires_at: new Date(row.expires_at).toISOString(),
      verified: row.verified,
      attempts: Number(row.attempts),
      created_at: new Date(row.created_at).toISOString(),
    };
  } else {
    for (const otp of memoryOtps) {
      if (otp.email === email.toLowerCase() && otp.type === type && !otp.verified) {
        otp.verified = true;
      }
    }
    const record: OtpRecord = {
      id: "otp-" + Date.now(),
      email: email.toLowerCase(),
      code,
      type,
      expires_at: expiresAt,
      verified: false,
      attempts: 0,
      created_at: createdAt,
    };
    memoryOtps.push(record);
    return record;
  }
}

/**
 * Verify OTP code for a given email and type
 */
export async function verifyOtpCode(email: string, code: string, type: string = "auth"): Promise<boolean> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const rows = (await sql`
      WITH candidate AS (
        SELECT id
        FROM otps
        WHERE LOWER(email) = ${cleanEmail}
          AND type = ${type}
          AND verified = FALSE
          AND expires_at > NOW()
          AND attempts < 5
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      )
      UPDATE otps AS otp
      SET
        attempts = otp.attempts + 1,
        verified = CASE WHEN otp.code = ${code} THEN TRUE ELSE otp.verified END
      FROM candidate
      WHERE otp.id = candidate.id
      RETURNING (otp.code = ${code}) AS matched;
    `) as any[];

    return rows.length > 0 && rows[0].matched === true;
  } else {
    const now = new Date().getTime();
    const found = memoryOtps
      .filter((o) => o.email === cleanEmail && o.type === type && !o.verified)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (!found) return false;
    if (new Date(found.expires_at).getTime() < now) return false;
    if (found.attempts >= 5) return false;

    found.attempts += 1;
    const matched = found.code === code;
    if (matched) found.verified = true;
    return matched;
  }
}

// ----------------------------------------------------
// Distributed Rate Limiting
// ----------------------------------------------------

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const sql = getSql();
  const now = Date.now();

  if (sql) {
    const rows = (await sql`
      INSERT INTO rate_limits (rate_key, count, reset_at)
      VALUES (${key}, 1, NOW() + (${windowMs} * INTERVAL '1 millisecond'))
      ON CONFLICT (rate_key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limits.reset_at <= NOW() THEN 1
          ELSE LEAST(rate_limits.count + 1, ${limit + 1})
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at <= NOW()
          THEN NOW() + (${windowMs} * INTERVAL '1 millisecond')
          ELSE rate_limits.reset_at
        END
      RETURNING count, reset_at;
    `) as any[];
    const count = Number(rows[0].count);
    const resetAt = new Date(rows[0].reset_at).getTime();
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  const existing = memoryRateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  existing.count = Math.min(existing.count + 1, limit + 1);
  return {
    allowed: existing.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

// ----------------------------------------------------
// User Database Helpers
// ----------------------------------------------------

/**
 * Find user by email
 */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const rows = (await sql`
      SELECT id, email, password_hash, session_version, created_at
      FROM users
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1;
    `) as any[];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      password_hash: r.password_hash,
      session_version: Number(r.session_version),
      created_at: new Date(r.created_at).toISOString(),
    };
  } else {
    return Array.from(memoryUsers.values()).find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }
}

/**
 * Register user with password hash
 */
export async function createUserWithPassword(email: string, passwordHash: string): Promise<UserRecord> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const rows = (await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${cleanEmail}, ${passwordHash})
      RETURNING id, email, password_hash, session_version, created_at;
    `) as any[];
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      password_hash: r.password_hash,
      session_version: Number(r.session_version ?? 0),
      created_at: new Date(r.created_at).toISOString(),
    };
  } else {
    const id = "user-" + Date.now();
    const record: UserRecord = {
      id,
      email: cleanEmail,
      password_hash: passwordHash,
      session_version: 0,
      created_at: new Date().toISOString(),
    };
    memoryUsers.set(id, record);
    return record;
  }
}

/**
 * Update user's password hash (Forgot Password Reset)
 */
export async function updateUserPassword(
  email: string,
  newPasswordHash: string,
  revokeSessions: boolean = false
): Promise<boolean> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const result = (await sql`
      UPDATE users
      SET
        password_hash = ${newPasswordHash},
        session_version = session_version + CASE WHEN ${revokeSessions} THEN 1 ELSE 0 END
      WHERE LOWER(email) = ${cleanEmail}
      RETURNING id;
    `) as any[];
    return result.length > 0;
  } else {
    const user = Array.from(memoryUsers.values()).find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password_hash = newPasswordHash;
      if (revokeSessions) user.session_version += 1;
      return true;
    }
    return false;
  }
}

/**
 * Find user by email or create new passwordless user account
 */
export async function findOrCreateUserByEmail(email: string): Promise<UserRecord> {
  const existing = await getUserByEmail(email);
  if (existing) return existing;

  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const created = (await sql`
      INSERT INTO users (email)
      VALUES (${cleanEmail})
      RETURNING id, email, password_hash, session_version, created_at;
    `) as any[];
    return {
      id: created[0].id,
      email: created[0].email,
      password_hash: created[0].password_hash,
      session_version: Number(created[0].session_version ?? 0),
      created_at: new Date(created[0].created_at).toISOString(),
    };
  } else {
    const id = "user-" + Date.now();
    const record: UserRecord = {
      id,
      email: cleanEmail,
      session_version: 0,
      created_at: new Date().toISOString(),
    };
    memoryUsers.set(id, record);
    return record;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<UserRecord | null> {
  const sql = getSql();

  if (sql) {
    const rows = (await sql`
      SELECT id, email, password_hash, session_version, created_at FROM users WHERE id = ${id} LIMIT 1;
    `) as any[];
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      email: rows[0].email,
      password_hash: rows[0].password_hash,
      session_version: Number(rows[0].session_version),
      created_at: new Date(rows[0].created_at).toISOString(),
    };
  } else {
    return memoryUsers.get(id) || null;
  }
}

// ----------------------------------------------------
// URL Database Helpers
// ----------------------------------------------------

export async function getLinkBySlug(slug: string): Promise<UrlRecord | null> {
  const sql = getSql();

  if (sql) {
    const rows = (await sql`
      SELECT id, user_id, original_url, short_slug, clicks, created_at
      FROM urls
      WHERE short_slug = ${slug}
      LIMIT 1;
    `) as any[];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      user_id: r.user_id,
      original_url: r.original_url,
      short_slug: r.short_slug,
      clicks: Number(r.clicks),
      created_at: new Date(r.created_at).toISOString(),
    };
  } else {
    return memoryUrls.get(slug) || null;
  }
}

export async function incrementClickCount(slug: string): Promise<void> {
  const sql = getSql();

  if (sql) {
    await sql`
      UPDATE urls
      SET clicks = clicks + 1
      WHERE short_slug = ${slug};
    `;
  } else {
    const record = memoryUrls.get(slug);
    if (record) {
      record.clicks += 1;
    }
  }
}

export async function recordPrivacySafeAnalytics(
  urlId: string,
  context: PrivacySafeAnalyticsContext
): Promise<void> {
  const sql = getSql();
  if (sql) {
    await sql`
      INSERT INTO url_analytics_daily (
        url_id, day, country_code, device_type, referrer_host, clicks
      )
      VALUES (
        ${urlId}, ${context.day}, ${context.countryCode},
        ${context.device}, ${context.referrerHost}, 1
      )
      ON CONFLICT (url_id, day, country_code, device_type, referrer_host)
      DO UPDATE SET clicks = url_analytics_daily.clicks + 1;
    `;
    await sql`
      INSERT INTO url_unique_visitors_daily (url_id, day, visitor_hash)
      VALUES (${urlId}, ${context.day}, ${context.visitorHash})
      ON CONFLICT DO NOTHING;
    `;
    await sql`
      DELETE FROM url_unique_visitors_daily
      WHERE day < (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '90 days';
    `;
    return;
  }

  let analytics = memoryAnalytics.get(urlId);
  if (!analytics) {
    analytics = { dimensions: new Map(), visitors: new Set() };
    memoryAnalytics.set(urlId, analytics);
  }
  const dimensionKey = [
    context.day,
    context.countryCode,
    context.device,
    context.referrerHost,
  ].join("|");
  analytics.dimensions.set(
    dimensionKey,
    (analytics.dimensions.get(dimensionKey) || 0) + 1
  );
  analytics.visitors.add(`${context.day}|${context.visitorHash}`);
}

export async function getUserLinkAnalytics(
  id: string,
  userId: string,
  days: number
): Promise<LinkAnalyticsResult | null> {
  const sql = getSql();
  const safeDays = [7, 30, 90].includes(days) ? days : 30;

  if (sql) {
    const links = (await sql`
      SELECT id, short_slug, original_url, clicks
      FROM urls
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1;
    `) as any[];
    if (links.length === 0) return null;

    const [dailyClicks, dailyVisitors, devices, countries, referrers] =
      await Promise.all([
        sql`
          SELECT day::text AS date, SUM(clicks)::bigint AS clicks
          FROM url_analytics_daily
          WHERE url_id = ${id}
            AND day >= (NOW() AT TIME ZONE 'UTC')::date - (${safeDays - 1} * INTERVAL '1 day')
          GROUP BY day
          ORDER BY day;
        `,
        sql`
          SELECT day::text AS date, COUNT(*)::bigint AS unique_visitors
          FROM url_unique_visitors_daily
          WHERE url_id = ${id}
            AND day >= (NOW() AT TIME ZONE 'UTC')::date - (${safeDays - 1} * INTERVAL '1 day')
          GROUP BY day
          ORDER BY day;
        `,
        sql`
          SELECT device_type AS label, SUM(clicks)::bigint AS clicks
          FROM url_analytics_daily
          WHERE url_id = ${id}
            AND day >= (NOW() AT TIME ZONE 'UTC')::date - (${safeDays - 1} * INTERVAL '1 day')
          GROUP BY device_type
          ORDER BY clicks DESC;
        `,
        sql`
          SELECT country_code AS label, SUM(clicks)::bigint AS clicks
          FROM url_analytics_daily
          WHERE url_id = ${id}
            AND day >= (NOW() AT TIME ZONE 'UTC')::date - (${safeDays - 1} * INTERVAL '1 day')
          GROUP BY country_code
          ORDER BY clicks DESC
          LIMIT 10;
        `,
        sql`
          SELECT referrer_host AS label, SUM(clicks)::bigint AS clicks
          FROM url_analytics_daily
          WHERE url_id = ${id}
            AND day >= (NOW() AT TIME ZONE 'UTC')::date - (${safeDays - 1} * INTERVAL '1 day')
          GROUP BY referrer_host
          ORDER BY clicks DESC
          LIMIT 10;
        `,
      ]);

    const clicksByDay = new Map(
      (dailyClicks as any[]).map((row) => [row.date, Number(row.clicks)])
    );
    const visitorsByDay = new Map(
      (dailyVisitors as any[]).map((row) => [
        row.date,
        Number(row.unique_visitors),
      ])
    );
    const daily: LinkAnalyticsResult["daily"] = [];
    for (let offset = safeDays - 1; offset >= 0; offset--) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - offset);
      const key = date.toISOString().slice(0, 10);
      daily.push({
        date: key,
        clicks: clicksByDay.get(key) || 0,
        uniqueVisitors: visitorsByDay.get(key) || 0,
      });
    }

    const mapBreakdown = (rows: unknown) =>
      (rows as any[]).map((row) => ({
        label: String(row.label),
        clicks: Number(row.clicks),
      }));
    const periodClicks = daily.reduce((sum, row) => sum + row.clicks, 0);
    const periodVisitors = daily.reduce(
      (sum, row) => sum + row.uniqueVisitors,
      0
    );
    const link = links[0];
    return {
      link: {
        id: link.id,
        shortSlug: link.short_slug,
        originalUrl: link.original_url,
        totalClicks: Number(link.clicks),
      },
      periodDays: safeDays,
      summary: {
        clicks: periodClicks,
        uniqueVisitors: periodVisitors,
      },
      daily,
      devices: mapBreakdown(devices),
      countries: mapBreakdown(countries),
      referrers: mapBreakdown(referrers),
      privacy: {
        rawIpStored: false,
        uniqueVisitorMethod: "Daily rotating keyed hash; values are approximate.",
        uniqueVisitorRetentionDays: 90,
      },
    };
  }

  const link = Array.from(memoryUrls.values()).find(
    (record) => record.id === id && record.user_id === userId
  );
  if (!link) return null;
  const analytics = memoryAnalytics.get(id);
  const dailyMap = new Map<
    string,
    { clicks: number; uniqueVisitors: number }
  >();
  const breakdown = {
    devices: new Map<string, number>(),
    countries: new Map<string, number>(),
    referrers: new Map<string, number>(),
  };
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - (safeDays - 1));
  if (analytics) {
    for (const [key, clicks] of analytics.dimensions) {
      const [day, country, device, referrer] = key.split("|");
      if (new Date(`${day}T00:00:00Z`) < cutoff) continue;
      const existing = dailyMap.get(day) || { clicks: 0, uniqueVisitors: 0 };
      existing.clicks += clicks;
      dailyMap.set(day, existing);
      breakdown.devices.set(device, (breakdown.devices.get(device) || 0) + clicks);
      breakdown.countries.set(country, (breakdown.countries.get(country) || 0) + clicks);
      breakdown.referrers.set(referrer, (breakdown.referrers.get(referrer) || 0) + clicks);
    }
    for (const visitor of analytics.visitors) {
      const [day] = visitor.split("|");
      if (new Date(`${day}T00:00:00Z`) < cutoff) continue;
      const existing = dailyMap.get(day) || { clicks: 0, uniqueVisitors: 0 };
      existing.uniqueVisitors += 1;
      dailyMap.set(day, existing);
    }
  }
  const daily: LinkAnalyticsResult["daily"] = [];
  for (let offset = safeDays - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const values = dailyMap.get(key) || { clicks: 0, uniqueVisitors: 0 };
    daily.push({ date: key, ...values });
  }
  const toRows = (values: Map<string, number>) =>
    [...values.entries()]
      .map(([label, clicks]) => ({ label, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  return {
    link: {
      id: link.id,
      shortSlug: link.short_slug,
      originalUrl: link.original_url,
      totalClicks: link.clicks,
    },
    periodDays: safeDays,
    summary: {
      clicks: daily.reduce((sum, row) => sum + row.clicks, 0),
      uniqueVisitors: daily.reduce(
        (sum, row) => sum + row.uniqueVisitors,
        0
      ),
    },
    daily,
    devices: toRows(breakdown.devices),
    countries: toRows(breakdown.countries),
    referrers: toRows(breakdown.referrers),
    privacy: {
      rawIpStored: false,
      uniqueVisitorMethod: "Daily rotating keyed hash; values are approximate.",
      uniqueVisitorRetentionDays: 90,
    },
  };
}

export async function createShortUrl(
  originalUrl: string,
  shortSlug: string,
  userId: string | null = null
): Promise<UrlRecord> {
  const sql = getSql();
  const now = new Date().toISOString();

  if (sql) {
    const rows = (await sql`
      INSERT INTO urls (original_url, short_slug, user_id)
      VALUES (${originalUrl}, ${shortSlug}, ${userId})
      RETURNING id, user_id, original_url, short_slug, clicks, created_at;
    `) as any[];
    const r = rows[0];
    return {
      id: r.id,
      user_id: r.user_id,
      original_url: r.original_url,
      short_slug: r.short_slug,
      clicks: Number(r.clicks),
      created_at: new Date(r.created_at).toISOString(),
    };
  } else {
    const record: UrlRecord = {
      id: "url-" + Date.now(),
      user_id: userId,
      original_url: originalUrl,
      short_slug: shortSlug,
      clicks: 0,
      created_at: now,
    };
    memoryUrls.set(shortSlug, record);
    return record;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function getUserLinks(limitOrUserId?: number | string | null, userIdParam?: string | null): Promise<UrlRecord[]> {
  let userId: string | null = null;
  let limit = 50;

  if (typeof limitOrUserId === "string") {
    userId = limitOrUserId;
  } else if (typeof limitOrUserId === "number") {
    limit = limitOrUserId;
    if (userIdParam) userId = userIdParam;
  } else if (userIdParam) {
    userId = userIdParam;
  }

  const sql = getSql();

  if (sql) {
    let rows: any[];
    if (userId) {
      rows = (await sql`
        SELECT id, user_id, original_url, short_slug, clicks, created_at
        FROM urls
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit};
      `) as any[];
    } else {
      rows = (await sql`
        SELECT id, user_id, original_url, short_slug, clicks, created_at
        FROM urls
        ORDER BY created_at DESC
        LIMIT ${limit};
      `) as any[];
    }

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      original_url: r.original_url,
      short_slug: r.short_slug,
      clicks: Number(r.clicks),
      created_at: new Date(r.created_at).toISOString(),
    }));
  } else {
    let list = Array.from(memoryUrls.values());
    if (userId) {
      list = list.filter((u) => u.user_id === userId);
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
  }
}

export const getRecentLinks = getUserLinks;

export async function deleteUserLink(id: string, userId: string): Promise<boolean> {
  const sql = getSql();

  if (sql) {
    const result = (await sql`
      DELETE FROM urls
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id;
    `) as any[];
    return result.length > 0;
  } else {
    for (const [slug, record] of memoryUrls.entries()) {
      if (record.id === id && record.user_id === userId) {
        memoryUrls.delete(slug);
        return true;
      }
    }
    return false;
  }
}
