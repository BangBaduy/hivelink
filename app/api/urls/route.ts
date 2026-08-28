import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserLinks } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const links = await getUserLinks(session.userId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hiveuin.tech";

    const formattedLinks = links.map((l) => ({
      id: l.id,
      originalUrl: l.original_url,
      shortSlug: l.short_slug,
      fullShortUrl: `${baseUrl.replace(/\/$/, "")}/${l.short_slug}`,
      clicks: l.clicks,
      createdAt: l.created_at,
    }));

    return NextResponse.json({
      success: true,
      links: formattedLinks,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to retrieve links." },
      { status: 500 }
    );
  }
}
