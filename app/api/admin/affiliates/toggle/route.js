import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabase";

export async function POST(req) {
  try {
    const { id, active } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("affiliate_codes")
      .update({ active: !!active })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("affiliates toggle error", err);
    return NextResponse.json(
      { error: "Could not update affiliate code." },
      { status: 500 }
    );
  }
}
