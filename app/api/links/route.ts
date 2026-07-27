import { NextRequest, NextResponse } from "next/server";
import { getRecentLinks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    const links = await getRecentLinks(50, userId);
    return NextResponse.json({
      success: true,
      data: links,
    });
  } catch (error: any) {
    console.error("API /api/links Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch links dashboard data." },
      { status: 500 }
    );
  }
}
