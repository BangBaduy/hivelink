import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "hive_session";
const JWT_SECRET = process.env.JWT_SECRET || "hive_default_secret_key_2026_change_in_prod";

export interface SessionPayload {
  userId: string;
  email: string;
}

/**
 * Sign a JWT session token containing userId and email
 */
export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Verify a JWT session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user session from request cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  return verifySessionToken(sessionCookie.value);
}

/**
 * Set session HTTP-Only cookie on response
 */
export function buildSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; ${isProd ? "Secure;" : ""} SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Build clear session cookie header for logout
 */
export function buildLogoutCookieHeader(): string {
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; ${isProd ? "Secure;" : ""} SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
