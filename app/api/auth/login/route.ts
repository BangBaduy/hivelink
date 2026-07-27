import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/security";
import { signSessionToken, buildSessionCookieHeader } from "@/lib/auth";

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

    // Fetch user from DB
    const user = await getUserByEmail(cleanEmail);
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { success: false, message: "Incorrect email or password. Please try again." },
        { status: 401 }
      );
    }

    // Verify password hash
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Incorrect email or password. Please try again." },
        { status: 401 }
      );
    }

    // Issue JWT session token
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
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
