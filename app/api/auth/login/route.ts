import { NextResponse } from "next/server";
import { getUserByEmail, updateUserPassword } from "@/lib/db";
import { hashPassword, passwordNeedsRehash, verifyPassword } from "@/lib/security";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";
import { checkAuthRateLimits, rateLimitResponse } from "@/lib/request-security";

const DUMMY_PASSWORD_HASH = hashPassword("invalid-account-password");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, message: "Please enter your email and password." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    const rateLimit = await checkAuthRateLimits(req, cleanEmail, "password-login");
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    // Fetch user from DB
    const user = await getUserByEmail(cleanEmail);

    // Always perform an expensive password check to reduce account-enumeration
    // timing differences.
    const passwordHash = user?.password_hash || DUMMY_PASSWORD_HASH;
    const isValid = verifyPassword(password, passwordHash);
    if (!user || !user.password_hash || !isValid) {
      return NextResponse.json(
        { success: false, message: "Incorrect email or password. Please try again." },
        { status: 401 }
      );
    }

    if (passwordNeedsRehash(user.password_hash)) {
      await updateUserPassword(cleanEmail, hashPassword(password));
    }

    // Issue JWT session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      sessionVersion: user.session_version,
    });

    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      message: "Successfully signed in!",
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.headers.append("Set-Cookie", cookieHeader);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}
