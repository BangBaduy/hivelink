import { NextResponse } from "next/server";
import { verifyOtpCode, getUserByEmail } from "@/lib/db";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";
import { checkAuthRateLimits, rateLimitResponse } from "@/lib/request-security";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return NextResponse.json(
        { success: false, message: "Please provide both your email address and 6-digit code." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { success: false, message: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    const rateLimit = await checkAuthRateLimits(req, cleanEmail, "otp-verify");
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    // CRITICAL SECURITY CHECK: OTP sign-in only works for registered accounts
    const existingUser = await getUserByEmail(cleanEmail);
    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code. Please request a new one." },
        { status: 400 }
      );
    }

    // Verify OTP code against DB (validates 3-minute expiry and unverified status)
    const isValid = await verifyOtpCode(cleanEmail, cleanCode, "auth");

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code. Please request a new one." },
        { status: 400 }
      );
    }

    // Issue JWT session token
    const token = signSessionToken({
      userId: existingUser.id,
      email: existingUser.email,
      sessionVersion: existingUser.session_version,
    });

    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      message: "Successfully signed in!",
      user: {
        id: existingUser.id,
        email: existingUser.email,
      },
    });

    response.headers.append("Set-Cookie", cookieHeader);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred during verification. Please try again." },
      { status: 500 }
    );
  }
}
