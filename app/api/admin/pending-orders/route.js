import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// This handler reads no dynamic request data (no cookies/headers/params),
// so Next's App Router would otherwise statically cache it at build time
// and keep serving a stale snapshot in production — force it dynamic so
// every call is a live Supabase query.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pending_orders")
      .select("*")
      .in("status", ["pending", "ticket_creation_failed"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      pendingOrders: data.filter((o) => o.status === "pending"),
      // Payment succeeded and Stripe confirmed it, but the webhook couldn't
      // create the ticket row(s) afterward — needs a human to reconcile.
      failedOrders: data.filter((o) => o.status === "ticket_creation_failed"),
    });
  } catch (err) {
    console.error("pending-orders error", err);
    return NextResponse.json(
      { error: "Could not load abandoned applications." },
      { status: 500 }
    );
  }
}
