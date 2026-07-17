import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export async function GET(req) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ valid: false });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("affiliate_codes")
      .select("discount_percent")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      discount_percent: data.discount_percent,
    });
  } catch (err) {
    console.error("validate-referral error", err);
    return NextResponse.json({ valid: false });
  }
}
