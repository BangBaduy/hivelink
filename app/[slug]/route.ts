import { NextResponse } from "next/server";
import { getLinkBySlug, incrementClickCount } from "@/lib/db";
import { RESERVED_SLUGS } from "@/lib/security";

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

    // Atomically increment click count asynchronously
    await incrementClickCount(slug);

    // Issue HTTP 302 redirect to original destination URL
    return NextResponse.redirect(linkRecord.original_url, 302);
  } catch (error) {
    return new NextResponse("Server Error", { status: 500 });
  }
}
