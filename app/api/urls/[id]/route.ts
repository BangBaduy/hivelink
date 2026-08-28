import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteUserLink, updateUserLinkDestination } from "@/lib/db";
import { validateTargetUrl } from "@/lib/security";
import {
  checkIpRateLimit,
  rateLimitResponse,
} from "@/lib/request-security";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await props.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid link identifier." },
        { status: 400 }
      );
    }

    const rateLimit = await checkIpRateLimit(
      req,
      "destination-update",
      20,
      60 * 1000
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const { destinationUrl } = body as { destinationUrl?: unknown };
    if (typeof destinationUrl !== "string") {
      return NextResponse.json(
        { success: false, message: "A destination URL is required." },
        { status: 400 }
      );
    }

    const validation = validateTargetUrl(destinationUrl);
    if (!validation.valid || !validation.parsedUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            validation.error ||
            "Please enter a valid destination beginning with https://.",
        },
        { status: 400 }
      );
    }

    const updated = await updateUserLinkDestination(
      id,
      session.userId,
      validation.parsedUrl.toString()
    );
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Link not found or permission denied." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Destination updated successfully.",
        link: {
          id: updated.id,
          originalUrl: updated.original_url,
          shortSlug: updated.short_slug,
          clicks: updated.clicks,
          createdAt: updated.created_at,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Failed to update destination." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id || !isUuid(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid link identifier." },
        { status: 400 }
      );
    }

    const deleted = await deleteUserLink(id, session.userId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Link not found or permission denied." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Link successfully deleted.",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to delete link." },
      { status: 500 }
    );
  }
}
