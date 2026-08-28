import { NextResponse } from "next/server";
import {
  createShortUrl,
  isUniqueViolation,
  LinkQuotaExceededError,
  UrlRecord,
} from "@/lib/db";
import { validateTargetUrl, validateSlug, generateRandomSlug } from "@/lib/security";
import { getSession } from "@/lib/auth";
import {
  checkIpRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/request-security";
import {
  getTurnstileSiteKey,
  verifyTurnstileToken,
} from "@/lib/captcha";

const ACCOUNT_LINK_QUOTA = 8;
const CAPTCHA_FREE_ATTEMPTS = 8;
const CAPTCHA_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Check
    const rateCheck = await checkIpRateLimit(req, "shorten", 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterSeconds);
    }

    // 2. Parse payload
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }
    const { url, customSlug, captchaToken } = body as {
      url?: unknown;
      customSlug?: unknown;
      captchaToken?: unknown;
    };

    const suspiciousTraffic = await checkIpRateLimit(
      req,
      "shorten-captcha",
      CAPTCHA_FREE_ATTEMPTS,
      CAPTCHA_WINDOW_MS
    );
    if (!suspiciousTraffic.allowed) {
      const siteKey = getTurnstileSiteKey();
      if (!siteKey) {
        return NextResponse.json(
          {
            success: false,
            message: "Security verification is temporarily unavailable.",
          },
          { status: 503 }
        );
      }

      const captchaValid = await verifyTurnstileToken(
        captchaToken,
        getClientIp(req),
        new URL(req.url).hostname
      );
      if (!captchaValid) {
        return NextResponse.json(
          {
            success: false,
            code: "CAPTCHA_REQUIRED",
            captchaRequired: true,
            siteKey,
            message: captchaToken
              ? "Security verification expired or failed. Please try again."
              : "Please complete the security verification.",
          },
          { status: 403 }
        );
      }
    }

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, message: "Please paste a valid web address starting with https://" },
        { status: 400 }
      );
    }

    // 3. Security & Format Validation (Human-Centric Errors, No Jargon!)
    const urlValidation = validateTargetUrl(url);
    if (!urlValidation.valid || !urlValidation.parsedUrl) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid web address starting with https://" },
        { status: 400 }
      );
    }

    const validatedUrl = urlValidation.parsedUrl.toString();

    // 4. Check if user is logged in via JWT session cookie
    const session = await getSession();
    const userId = session ? session.userId : null;

    // 5. Validate and atomically claim a custom or generated slug.
    let newRecord: UrlRecord;
    if (customSlug && typeof customSlug === "string" && customSlug.trim().length > 0) {
      if (!userId) {
        return NextResponse.json(
          {
            success: false,
            code: "AUTH_REQUIRED_FOR_CUSTOM_ALIAS",
            message: "Sign in to choose a custom alias.",
          },
          { status: 401 }
        );
      }

      const trimmedSlug = customSlug.trim();

      const slugValidation = validateSlug(trimmedSlug);
      if (!slugValidation.valid) {
        return NextResponse.json(
          { success: false, message: slugValidation.error || "Custom link alias is invalid or reserved." },
          { status: 400 }
        );
      }

      try {
        newRecord = await createShortUrl(
          validatedUrl,
          trimmedSlug,
          userId,
          ACCOUNT_LINK_QUOTA
        );
      } catch (error) {
        if (error instanceof LinkQuotaExceededError) {
          return NextResponse.json(
            {
              success: false,
              code: "LINK_QUOTA_REACHED",
              message: `Your account can have up to ${ACCOUNT_LINK_QUOTA} active links. Delete one before creating another.`,
            },
            { status: 409 }
          );
        }
        if (!isUniqueViolation(error)) throw error;
        return NextResponse.json(
          { success: false, message: "That custom link alias is already taken. Please choose another one." },
          { status: 409 }
        );
      }
    } else {
      let created: UrlRecord | null = null;
      for (let attempts = 0; attempts < 8; attempts++) {
        try {
          created = await createShortUrl(
            validatedUrl,
            generateRandomSlug(7),
            userId,
            userId ? ACCOUNT_LINK_QUOTA : null
          );
          break;
        } catch (error) {
          if (error instanceof LinkQuotaExceededError) {
            return NextResponse.json(
              {
                success: false,
                code: "LINK_QUOTA_REACHED",
                message: `Your account can have up to ${ACCOUNT_LINK_QUOTA} active links. Delete one before creating another.`,
              },
              { status: 409 }
            );
          }
          if (!isUniqueViolation(error)) throw error;
        }
      }
      if (!created) {
        return NextResponse.json(
          { success: false, message: "Unable to allocate a short link. Please try again." },
          { status: 503 }
        );
      }
      newRecord = created;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hiveuin.tech";
    const fullShortUrl = `${baseUrl.replace(/\/$/, "")}/${newRecord.short_slug}`;

    return NextResponse.json({
      success: true,
      data: {
        id: newRecord.id,
        originalUrl: newRecord.original_url,
        shortSlug: newRecord.short_slug,
        fullShortUrl,
        clicks: newRecord.clicks,
        createdAt: newRecord.created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Unable to shorten link right now. Please try again." },
      { status: 500 }
    );
  }
}
