import { NextResponse } from "next/server";
import { getUserByEmail, createUserWithPassword } from "@/lib/db";
import { evaluatePasswordStrength, hashPassword } from "@/lib/security";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, message: "Please provide both an email address and a strong password." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
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
      message: "Account created successfully!",
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
