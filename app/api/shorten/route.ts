import { NextResponse } from "next/server";
import { createShortUrl, isUniqueViolation, UrlRecord } from "@/lib/db";
import { validateTargetUrl, validateSlug, generateRandomSlug } from "@/lib/security";
import { getSession } from "@/lib/auth";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/request-security";

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Check
    const rateCheck = await checkIpRateLimit(req, "shorten", 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterSeconds);
    }

    // 2. Parse payload
    const body = await req.json();
    const { url, customSlug } = body;

    if (!url) {
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
      const trimmedSlug = customSlug.trim();

      const slugValidation = validateSlug(trimmedSlug);
      if (!slugValidation.valid) {
        return NextResponse.json(
          { success: false, message: slugValidation.error || "Custom link alias is invalid or reserved." },
          { status: 400 }
        );
      }

      try {
        newRecord = await createShortUrl(validatedUrl, trimmedSlug, userId);
      } catch (error) {
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
          created = await createShortUrl(validatedUrl, generateRandomSlug(7), userId);
          break;
        } catch (error) {
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
