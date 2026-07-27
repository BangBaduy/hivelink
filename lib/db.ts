import { neon } from "@neondatabase/serverless";

export interface UserRecord {
  id: string;
  email: string;
  password_hash?: string | null;
  created_at: string;
}

export interface OtpRecord {
  id: string;
  email: string;
  code: string;
  type: string; // 'auth' or 'forgot_password'
  expires_at: string;
  verified: boolean;
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

/**
 * Check if Neon Database URL is configured
 */
export function isNeonConfigured(): boolean {
  return !!process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres");
}

/**
 * Get SQL query executor using @neondatabase/serverless
 */
export function getSql() {
  if (isNeonConfigured()) {
    return neon(process.env.DATABASE_URL!);
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
    const rows = await sql`
      INSERT INTO otps (email, code, type, expires_at, verified)
      VALUES (${email.toLowerCase()}, ${code}, ${type}, NOW() + INTERVAL '3 minutes', FALSE)
      RETURNING id, email, code, type, expires_at, verified, created_at;
    `;
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      code: row.code,
      type: row.type,
      expires_at: new Date(row.expires_at).toISOString(),
      verified: row.verified,
      created_at: new Date(row.created_at).toISOString(),
    };
  } else {
    const record: OtpRecord = {
      id: "otp-" + Date.now(),
      email: email.toLowerCase(),
      code,
      type,
      expires_at: expiresAt,
      verified: false,
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
    const rows = await sql`
      SELECT id, code, expires_at, verified
      FROM otps
      WHERE LOWER(email) = ${cleanEmail}
        AND code = ${code}
        AND type = ${type}
        AND verified = FALSE
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return false;
    }

    const otpId = rows[0].id;
    await sql`
      UPDATE otps
      SET verified = TRUE
      WHERE id = ${otpId};
    `;

    return true;
  } else {
    const now = new Date().getTime();
    const found = memoryOtps
      .filter((o) => o.email === cleanEmail && o.code === code && o.type === type && !o.verified)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (!found) return false;
    if (new Date(found.expires_at).getTime() < now) return false;

    found.verified = true;
    return true;
  }
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
    const rows = await sql`
      SELECT id, email, password_hash, created_at
      FROM users
      WHERE LOWER(email) = ${cleanEmail}
      LIMIT 1;
    `;
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      password_hash: r.password_hash,
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
    const rows = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${cleanEmail}, ${passwordHash})
      RETURNING id, email, password_hash, created_at;
    `;
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      password_hash: r.password_hash,
      created_at: new Date(r.created_at).toISOString(),
    };
  } else {
    const id = "user-" + Date.now();
    const record: UserRecord = {
      id,
      email: cleanEmail,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
    };
    memoryUsers.set(id, record);
    return record;
  }
}

/**
 * Update user's password hash (Forgot Password Reset)
 */
export async function updateUserPassword(email: string, newPasswordHash: string): Promise<boolean> {
  const sql = getSql();
  const cleanEmail = email.toLowerCase().trim();

  if (sql) {
    const result = await sql`
      UPDATE users
      SET password_hash = ${newPasswordHash}
      WHERE LOWER(email) = ${cleanEmail}
      RETURNING id;
    `;
    return result.length > 0;
  } else {
    const user = Array.from(memoryUsers.values()).find((u) => u.email.toLowerCase() === cleanEmail);
    if (user) {
      user.password_hash = newPasswordHash;
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
    const created = await sql`
      INSERT INTO users (email)
      VALUES (${cleanEmail})
      RETURNING id, email, password_hash, created_at;
    `;
    return {
      id: created[0].id,
      email: created[0].email,
      password_hash: created[0].password_hash,
      created_at: new Date(created[0].created_at).toISOString(),
    };
  } else {
    const id = "user-" + Date.now();
    const record: UserRecord = {
      id,
      email: cleanEmail,
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
    const rows = await sql`
      SELECT id, email, password_hash, created_at FROM users WHERE id = ${id} LIMIT 1;
    `;
    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      email: rows[0].email,
      password_hash: rows[0].password_hash,
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
    const rows = await sql`
      SELECT id, user_id, original_url, short_slug, clicks, created_at
      FROM urls
      WHERE short_slug = ${slug}
      LIMIT 1;
    `;
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

export async function createShortUrl(
  originalUrl: string,
  shortSlug: string,
  userId: string | null = null
): Promise<UrlRecord> {
  const sql = getSql();
  const now = new Date().toISOString();

  if (sql) {
    const rows = await sql`
      INSERT INTO urls (original_url, short_slug, user_id)
      VALUES (${originalUrl}, ${shortSlug}, ${userId})
      RETURNING id, user_id, original_url, short_slug, clicks, created_at;
    `;
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
    let rows;
    if (userId) {
      rows = await sql`
        SELECT id, user_id, original_url, short_slug, clicks, created_at
        FROM urls
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
    } else {
      rows = await sql`
        SELECT id, user_id, original_url, short_slug, clicks, created_at
        FROM urls
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
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
    const result = await sql`
      DELETE FROM urls
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING id;
    `;
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
