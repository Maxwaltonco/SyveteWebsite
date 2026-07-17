import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const { code } = await req.json();
    const cleanCode = (code || "").trim().toUpperCase();
    if (!cleanCode) {
      return NextResponse.json({ error: "Code required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("affiliate_clicks")
      .insert({ code: cleanCode });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("affiliate-click error", err);
    return NextResponse.json({ error: "Could not log click." }, { status: 500 });
  }
}
