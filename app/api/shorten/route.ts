import { NextResponse } from "next/server";
import { createShortUrl, getLinkBySlug } from "@/lib/db";
import { validateTargetUrl, validateSlug, generateRandomSlug, checkRateLimit } from "@/lib/security";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Check
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please slow down and try again in a minute." },
        { status: 429 }
      );
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

    // 4. Custom Slug Handling
    let slug = "";
    if (customSlug && typeof customSlug === "string" && customSlug.trim().length > 0) {
      const trimmedSlug = customSlug.trim();

      const slugValidation = validateSlug(trimmedSlug);
      if (!slugValidation.valid) {
        return NextResponse.json(
          { success: false, message: slugValidation.error || "Custom link alias is invalid or reserved." },
          { status: 400 }
        );
      }

      // Check availability
      const existing = await getLinkBySlug(trimmedSlug);
      if (existing) {
        return NextResponse.json(
          { success: false, message: "That custom link alias is already taken. Please choose another one." },
          { status: 409 }
        );
      }

      slug = trimmedSlug;
    } else {
      // Generate a unique 6-character slug
      let attempts = 0;
      let generated = "";
      while (attempts < 5) {
        generated = generateRandomSlug(6);
        const existing = await getLinkBySlug(generated);
        if (!existing) {
          slug = generated;
          break;
        }
        attempts++;
      }
      if (!slug) {
        slug = generateRandomSlug(7);
      }
    }

    // 5. Check if user is logged in via JWT session cookie
    const session = await getSession();
    const userId = session ? session.userId : null;

    // 6. Save link in DB
    const newRecord = await createShortUrl(validatedUrl, slug, userId);

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
