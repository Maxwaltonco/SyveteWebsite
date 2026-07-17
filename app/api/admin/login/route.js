import { NextResponse } from "next/server";
import { getAdminToken } from "../../../../lib/adminAuth";

export async function POST(req) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // Simple signed session token: not a full auth system, but enough
  // to keep randoms out of the admin dashboard. Rotate ADMIN_PASSWORD
  // if you ever think it's leaked.
  const token = await getAdminToken(process.env.ADMIN_PASSWORD);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
  return res;
}
