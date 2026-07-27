import { NextResponse } from "next/server";
import { createOtp, getUserByEmail } from "@/lib/db";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, type = "auth" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address format." },
        { status: 400 }
      );
    }

    // If type is forgot_password, check if user exists first
    if (type === "forgot_password") {
      const existingUser = await getUserByEmail(cleanEmail);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, message: "No account found with this email address." },
          { status: 404 }
        );
      }
    }

    // If type is auth (OTP sign-in), also require an existing account
    if (type === "auth") {
      const existingUser = await getUserByEmail(cleanEmail);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, message: "No account found with this email. Please create an account first using the Register tab." },
          { status: 404 }
        );
      }
    }

    // Generate cryptographically random 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database with 3-minute expiration
    await createOtp(cleanEmail, otpCode, type);

    // Send Email via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@upvance.site";
    const sender = `HiVE! <${fromEmail}>`;

    const subject =
      type === "forgot_password"
        ? "HiVE! - Password Reset Verification Code"
        : "Welcome, HiVE! - Your 3-Minute Verification Code";

    const titleText = type === "forgot_password" ? "Reset Your Password" : "Welcome to HiVE!";
    const bodyText =
      type === "forgot_password"
        ? "Use the 6-digit verification code below to reset your HiVE! account password."
        : "Use the 6-digit verification code below to complete your authentication.";

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);

        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>HiVE! Verification Code</title>
            </head>
            <body style="background-color: #FDFBF7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; color: #1E293B;">
              <table role="presentation" style="max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
                <tr>
                  <td style="background-color: #1E293B; padding: 32px; text-align: center;">
                    <h1 style="color: #10B981; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">HiVE!</h1>
                    <p style="color: #94A3B8; margin: 6px 0 0 0; font-size: 14px;">Instant URL Shortener</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px; text-align: center;">
                    <h2 style="margin: 0 0 12px 0; color: #1E293B; font-size: 20px; font-weight: 700;">${titleText}</h2>
                    <p style="margin: 0 0 28px 0; color: #64748B; font-size: 15px; line-height: 1.5;">${bodyText}</p>

                    <div style="background-color: #FDFBF7; border: 2px dashed #10B981; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                      <span style="font-family: monospace, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1E293B; display: inline-block;">
                        ${otpCode}
                      </span>
                    </div>

                    <div style="background-color: #ECFDF5; border-radius: 8px; padding: 12px 16px; display: inline-block;">
                      <p style="margin: 0; color: #047857; font-size: 14px; font-weight: 600;">
                        ⏱️ This code will expire in 3 minutes.
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #F1F5F9; padding: 20px 32px; background-color: #FAFAFA; text-align: center;">
                    <p style="margin: 0; color: #94A3B8; font-size: 12px;">HiVE! Platform &bull; hiveuin.tech</p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `;

        await resend.emails.send({
          from: sender,
          to: [cleanEmail],
          subject,
          html: htmlContent,
        });
      } catch (err: any) {
        console.error("Resend send error:", err);
      }
    } else {
      console.log(`[DEV OTP] Code for ${cleanEmail} (${type}): ${otpCode}`);
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent! Please check your inbox.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "We encountered an issue sending your verification code. Please try again." },
      { status: 500 }
    );
  }
}
