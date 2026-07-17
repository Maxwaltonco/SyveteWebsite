import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { getEventSettings } from "../../../../lib/eventConfig";

// No dynamic request data is read here, so force this off the Full Route
// Cache — otherwise a production build would keep serving whatever
// snapshot was captured at build/first-request time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const EVENT = await getEventSettings();
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // head: true skips fetching rows, just the count — cheaper than pulling
    // the full leads list here when all the dashboard needs is a number.
    const { count: leadsCount, error: leadsError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const pendingCount = data.filter((t) => t.status === "pending").length;
    const approvedCount = data.filter((t) => t.status === "approved").length;
    const revokedCount = data.filter((t) => t.status === "revoked").length;
    const refundedCount = data.filter((t) => t.status === "refunded").length;

    return NextResponse.json({
      tickets: data,
      pendingCount,
      approvedCount,
      revokedCount,
      refundedCount,
      capacity: EVENT.capacity,
      // Only approved tickets occupy a spot — pending hasn't been vetted yet,
      // revoked/refunded no longer hold one.
      spotsLeft: Math.max(EVENT.capacity - approvedCount, 0),
      leadsCount: leadsCount || 0,
    });
  } catch (err) {
    console.error("tickets error", err);
    return NextResponse.json(
      { error: "Could not load tickets." },
      { status: 500 }
    );
  }
}
