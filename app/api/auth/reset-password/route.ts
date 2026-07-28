import { NextResponse } from "next/server";
import { verifyOtpCode, getUserByEmail, updateUserPassword } from "@/lib/db";
import { evaluatePasswordStrength, hashPassword } from "@/lib/security";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";
import { checkAuthRateLimits, rateLimitResponse } from "@/lib/request-security";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword || typeof email !== "string" || typeof code !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { success: false, message: "Please provide your email, 6-digit verification code, and new password." },
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

    // Evaluate new password strength
    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, message: strength.error || "New password does not meet strength requirements." },
        { status: 400 }
      );
    }

    // Verify OTP code for forgot_password type
    const isValidOtp = await verifyOtpCode(cleanEmail, cleanCode, "forgot_password");
    if (!isValidOtp) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code. Please request a new code." },
        { status: 400 }
      );
    }

    // Find user
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Account not found." },
        { status: 404 }
      );
    }

    // Hash new password and update user record
    const hashedPassword = hashPassword(newPassword);
    const updated = await updateUserPassword(cleanEmail, hashedPassword, true);
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Unable to update the account password." },
        { status: 500 }
      );
    }

    // Sign session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      sessionVersion: user.session_version + 1,
    });

    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      message: "Password reset successful! You are now signed in.",
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.headers.append("Set-Cookie", cookieHeader);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to reset password. Please try again." },
      { status: 500 }
    );
  }
}
