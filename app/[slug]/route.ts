import { after, NextResponse } from "next/server";
import {
  getLinkBySlug,
  incrementClickCount,
  recordPrivacySafeAnalytics,
} from "@/lib/db";
import { RESERVED_SLUGS } from "@/lib/security";
import { buildPrivacySafeAnalyticsContext } from "@/lib/analytics";

export async function GET(
  req: Request,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await props.params;
    const { slug } = params;

    if (!slug || RESERVED_SLUGS.has(slug.toLowerCase())) {
      const url = new URL("/", req.url);
      url.searchParams.set("error", "not_found");
      return NextResponse.redirect(url, 302);
    }

    // High-performance server-side lookup via @neondatabase/serverless
    const linkRecord = await getLinkBySlug(slug);

    if (!linkRecord || !linkRecord.original_url) {
      const url = new URL("/", req.url);
      url.searchParams.set("error", "not_found");
      return NextResponse.redirect(url, 302);
    }

    // Recording must never delay or break a valid redirect.
    after(async () => {
      try {
        await incrementClickCount(slug);
        if (linkRecord.user_id) {
          const context = buildPrivacySafeAnalyticsContext(req);
          await recordPrivacySafeAnalytics(linkRecord.id, context);
        }
      } catch (error) {
        console.error("Redirect analytics recording failed.", {
          linkId: linkRecord.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Issue HTTP 302 redirect to original destination URL
    return NextResponse.redirect(linkRecord.original_url, 302);
  } catch (error) {
    return new NextResponse("Server Error", { status: 500 });
  }
}
