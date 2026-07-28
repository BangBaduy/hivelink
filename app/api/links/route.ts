import { NextRequest, NextResponse } from "next/server";
import { getRecentLinks } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const links = await getRecentLinks(50, session.userId);
    return NextResponse.json({
      success: true,
      data: links.map((link) => ({
        id: link.id,
        original_url: link.original_url,
        short_slug: link.short_slug,
        clicks: link.clicks,
        created_at: link.created_at,
      })),
    });
  } catch (error: any) {
    console.error("API /api/links Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch links dashboard data." },
      { status: 500 }
    );
  }
}
