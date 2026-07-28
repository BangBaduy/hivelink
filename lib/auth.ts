import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/db";

const SESSION_COOKIE_NAME = "hive_session";
const JWT_ISSUER = "hiveuin.tech";
const JWT_AUDIENCE = "hiveuin-web";
const COMPROMISED_SECRET_HASHES = new Set([
  "3b4b0b929ed57dc2711359bd8453ca1ce57a706870cdb5bdff8c9b6fa450b658",
  "567fe07b91959f2d0fc594b1affc5a197f0ada5ad161274e8367ed8626026501",
]);

export interface SessionPayload {
  userId: string;
  email: string;
  sessionVersion: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  const digest = crypto.createHash("sha256").update(secret).digest("hex");
  if (COMPROMISED_SECRET_HASHES.has(digest)) {
    throw new Error("JWT_SECRET is known to be compromised and must be rotated.");
  }
  return secret;
}

/**
 * Sign a JWT session token containing userId and email
 */
export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
    expiresIn: "30d",
  });
}

/**
 * Verify a JWT session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    });
    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.sessionVersion !== "number"
    ) {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      sessionVersion: decoded.sessionVersion,
    };
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

  const session = verifySessionToken(sessionCookie.value);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (
    !user ||
    user.email.toLowerCase() !== session.email.toLowerCase() ||
    user.session_version !== session.sessionVersion
  ) {
    return null;
  }
  return session;
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
