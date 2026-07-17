import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(req) {
  const { ticketId } = await req.json();
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Only a pending ticket can be approved — guards against a stale
    // double-click approving something already revoked/refunded.
    const { data, error } = await supabase
      .from("tickets")
      .update({ status: "approved" })
      .eq("id", ticketId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Ticket is not pending — it may have already been actioned." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("approve error", err);
    return NextResponse.json(
      { error: "Could not approve ticket." },
      { status: 500 }
    );
  }
}
