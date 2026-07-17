import { NextResponse } from "next/server";
import { getAdminToken } from "./lib/adminAuth";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const isProtectedApi =
    pathname.startsWith("/api/admin/tickets") ||
    pathname.startsWith("/api/admin/revoke") ||
    pathname.startsWith("/api/admin/approve") ||
    pathname.startsWith("/api/admin/reinstate") ||
    pathname.startsWith("/api/admin/leads") ||
    pathname.startsWith("/api/admin/affiliates") ||
    pathname.startsWith("/api/admin/pending-orders") ||
    pathname.startsWith("/api/admin/stats") ||
    pathname.startsWith("/api/admin/event-settings");

  if (!isProtectedApi) return NextResponse.next();

  const cookie = req.cookies.get("admin_session")?.value;
  const expected = await getAdminToken(process.env.ADMIN_PASSWORD || "");

  if (!cookie || cookie !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/tickets/:path*",
    "/api/admin/revoke/:path*",
    "/api/admin/approve/:path*",
    "/api/admin/reinstate/:path*",
    "/api/admin/leads/:path*",
    "/api/admin/affiliates/:path*",
    "/api/admin/pending-orders/:path*",
    "/api/admin/stats/:path*",
    "/api/admin/event-settings/:path*",
  ],
};
