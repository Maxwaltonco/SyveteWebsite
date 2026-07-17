import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export async function POST(req) {
  const { ticketId } = await req.json();
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Only a revoked ticket can be brought back to pending — deliberately
    // excludes refunded, since that involved real money moving and isn't
    // something to silently reverse from here.
    const { data, error } = await supabase
      .from("tickets")
      .update({ status: "pending", revoked_at: null, revoke_reason: null })
      .eq("id", ticketId)
      .eq("status", "revoked")
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Ticket is not revoked — it may have already been actioned." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reinstate error", err);
    return NextResponse.json(
      { error: "Could not reinstate ticket." },
      { status: 500 }
    );
  }
}
