import { NextResponse } from "next/server";
import { createOtp, getUserByEmail } from "@/lib/db";
import { Resend } from "resend";
import crypto from "crypto";
import {
  checkAuthRateLimits,
  isOtpPurpose,
  rateLimitResponse,
} from "@/lib/request-security";

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

    if (!isOtpPurpose(type)) {
      return NextResponse.json(
        { success: false, message: "Invalid verification purpose." },
        { status: 400 }
      );
    }

    const rateLimit = await checkAuthRateLimits(req, cleanEmail, "otp-send");
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const existingUser = await getUserByEmail(cleanEmail);

    // Use the same response for eligible and ineligible addresses to prevent
    // account enumeration.
    const isEligible =
      (type === "register" && !existingUser) ||
      ((type === "forgot_password" || type === "auth") && !!existingUser);
    if (!isEligible) {
      return NextResponse.json({
        success: true,
        message: "If this email is eligible, a verification code has been sent.",
      });
    }

    // Generate 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // Save OTP to database with 3-minute expiration
    try {
      await createOtp(cleanEmail, otpCode, type);
    } catch (dbErr: any) {
      console.error("[send-otp DB Error]:", dbErr);
      return NextResponse.json(
        { success: false, message: "Database error while storing verification code. Please try again." },
        { status: 500 }
      );
    }

    // Dispatch Email via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@upvance.site";
    const sender = `HiVE! <${fromEmail}>`;

    const subject =
      type === "forgot_password"
        ? "HiVE! - Password Reset Verification Code"
        : type === "register"
        ? "HiVE! - Account Registration Verification Code"
        : "HiVE! - Sign In Verification Code";

    const titleText =
      type === "forgot_password"
        ? "Reset Your Password"
        : type === "register"
        ? "Verify Your Email Address"
        : "Sign In to HiVE!";

    const bodyText =
      type === "forgot_password"
        ? "Use the 6-digit code below to reset your password."
        : type === "register"
        ? "Use the 6-digit code below to complete your account registration."
        : "Use the 6-digit code below to complete your sign in.";

    let emailDelivered = false;
    let deliveryErrorMessage = "";

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
                      <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1E293B; display: inline-block;">
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

        const resendResult = await resend.emails.send({
          from: sender,
          to: [cleanEmail],
          subject,
          html: htmlContent,
        });

        if (resendResult.data?.id) {
          emailDelivered = true;
          console.log(`[Resend Success] Email sent to ${cleanEmail}, ID: ${resendResult.data.id}`);
        } else if (resendResult.error) {
          console.error("[Resend API Error]:", resendResult.error);
          deliveryErrorMessage = resendResult.error.message;
        }
      } catch (err: any) {
        console.error("[Resend Exception]:", err);
        deliveryErrorMessage = err.message || "Failed to contact Resend API.";
      }
    } else {
      console.log(`[DEV OTP Console Output] Code for ${cleanEmail} (${type}): ${otpCode}`);
    }

    return NextResponse.json({
      success: true,
      message: emailDelivered
        ? "3-minute verification code sent! Please check your email inbox."
        : "Verification code generated! Please check your inbox or spam folder.",
      debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    });
  } catch (error: any) {
    console.error("[FATAL send-otp ROUTE ERROR]:", error);
    return NextResponse.json(
      { success: false, message: `Verification code service error: ${error?.message || "Internal server error"}` },
      { status: 500 }
    );
  }
}
