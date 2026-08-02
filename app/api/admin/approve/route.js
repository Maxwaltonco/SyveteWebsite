import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendSpotConfirmedEmail } from "../../../../lib/mailer";

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

    // Only email once the whole order is confirmed, not per-ticket — check
    // every other ticket sharing this order_id (a lone ticket with no
    // order_id counts as a group of one, i.e. always ready).
    let siblings = [data];
    if (data.order_id) {
      const { data: orderTickets, error: siblingsError } = await supabase
        .from("tickets")
        .select("*")
        .eq("order_id", data.order_id)
        .order("created_at", { ascending: true });
      if (!siblingsError && orderTickets) {
        siblings = orderTickets;
      }
    }

    const allApproved = siblings.every((t) => t.status === "approved");
    if (allApproved) {
      const buyerTicket = siblings.find((t) => !t.attendee_name) || siblings[0];
      await sendSpotConfirmedEmail({
        orderId: data.order_id || data.id,
        buyerEmail: buyerTicket.email,
        ticketCodes: siblings.map((t) => t.ticket_code),
      });
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
