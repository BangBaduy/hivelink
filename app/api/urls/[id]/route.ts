import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteUserLink } from "@/lib/db";

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
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Link identifier is required." },
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
