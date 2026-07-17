import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

// Public by design (no admin auth) — called client-side from the Apply
// modal's resume logic to check whether a locally-stored order is still
// live. Only ever returns the status, never buyer details, and the id is
// an unguessable uuid the client already holds from creating the order.
export async function GET(req) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pending_orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: data ? data.status : "not_found" });
  } catch (err) {
    console.error("pending-order-status error", err);
    return NextResponse.json({ error: "Could not check order status." }, { status: 500 });
  }
}
