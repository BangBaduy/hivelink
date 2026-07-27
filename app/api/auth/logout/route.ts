import { NextResponse } from "next/server";
import { buildLogoutCookieHeader } from "@/lib/auth";

export async function POST() {
  const cookieHeader = buildLogoutCookieHeader();
  const response = NextResponse.json({
    success: true,
    message: "Signed out successfully.",
  });
  response.headers.append("Set-Cookie", cookieHeader);
  return response;
}
