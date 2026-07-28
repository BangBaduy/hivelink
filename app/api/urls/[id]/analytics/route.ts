import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserLinkAnalytics } from "@/lib/db";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await props.params;
    const requestedDays = Number(new URL(req.url).searchParams.get("days") || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const analytics = await getUserLinkAnalytics(id, session.userId, days);
    if (!analytics) {
      return NextResponse.json(
        { success: false, message: "Link not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, analytics },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to retrieve analytics." },
      { status: 500 }
    );
  }
}
