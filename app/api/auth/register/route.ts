import { NextResponse } from "next/server";
import { getUserByEmail, createUserWithPassword, verifyOtpCode } from "@/lib/db";
import { evaluatePasswordStrength, hashPassword } from "@/lib/security";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, code } = body;

    if (!email || !password || !code || typeof email !== "string" || typeof password !== "string" || typeof code !== "string") {
      return NextResponse.json(
        { success: false, message: "Please enter your email, strong password, and 6-digit verification code." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (cleanCode.length !== 6) {
      return NextResponse.json(
        { success: false, message: "Verification code must be exactly 6 digits." },
        { status: 400 }
      );
    }

    // Evaluate password strength requirements
    const strength = evaluatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, message: strength.error || "Password does not meet security requirements." },
        { status: 400 }
      );
    }

    // Check if account already exists
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, message: "An account with this email address already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    // CRITICAL ANTI-SPAM REQUIREMENT: Verify OTP code (type: 'register')
    const isValidOtp = await verifyOtpCode(cleanEmail, cleanCode, "register");
    if (!isValidOtp) {
      return NextResponse.json(
        { success: false, message: "Invalid or expired verification code. Please request a new code." },
        { status: 400 }
      );
    }

    // Hash password and create user
    const hashedPassword = hashPassword(password);
    const user = await createUserWithPassword(cleanEmail, hashedPassword);

    // Issue JWT session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
    });

    const cookieHeader = buildSessionCookieHeader(token);

    const response = NextResponse.json({
      success: true,
      message: "Account created and verified successfully!",
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.headers.append("Set-Cookie", cookieHeader);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
