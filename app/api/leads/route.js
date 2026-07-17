import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const { email, instagram_handle } = await req.json();
    const cleanEmail = (email || "").trim();
    const cleanInstagram = (instagram_handle || "").trim();

    if (!cleanEmail && !cleanInstagram) {
      return NextResponse.json(
        { error: "Enter an email or Instagram handle." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("leads").insert({
      email: cleanEmail || null,
      instagram_handle: cleanInstagram || null,
    });

    if (error) {
      console.error("lead insert error", error);
      return NextResponse.json(
        { error: "Could not save. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("leads error", err);
    return NextResponse.json(
      { error: "Could not save. Try again." },
      { status: 500 }
    );
  }
}
