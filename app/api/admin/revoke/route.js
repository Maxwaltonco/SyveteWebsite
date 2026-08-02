import { NextResponse } from "next/server";
import { getStripe } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { sendApplicationRefundedEmail } from "../../../../lib/mailer";

export async function POST(req) {
  const { ticketId, reason, refund } = await req.json();
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: ticket, error: fetchErr } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "revoked" || ticket.status === "refunded") {
      return NextResponse.json(
        { error: "Ticket is already in a terminal state." },
        { status: 409 }
      );
    }

    // Refund is optional — you may want to revoke entry without refunding
    // in some cases (that's a judgement call, not something to automate).
    if (refund && ticket.stripe_payment_intent) {
      try {
        const stripe = getStripe();
        await stripe.refunds.create({
          payment_intent: ticket.stripe_payment_intent,
          amount: ticket.amount_paid_cents,
        });
      } catch (err) {
        console.error("refund failed", err);
        return NextResponse.json(
          { error: `Refund failed: ${err.message}` },
          { status: 500 }
        );
      }
    }

    const { error: updateErr } = await supabase
      .from("tickets")
      .update({
        status: refund ? "refunded" : "revoked",
        revoked_at: new Date().toISOString(),
        revoke_reason: reason || null,
      })
      .eq("id", ticketId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // "Revoke only" is a manual, no-email action by design — only the
    // refund branch notifies the buyer. Attendee tickets have no email of
    // their own (only the buyer row does), so fall back to the sibling
    // buyer ticket in the same order when refunding someone else's ticket.
    if (refund) {
      let buyerEmail = ticket.email;
      if (!buyerEmail && ticket.order_id) {
        const { data: buyerTicket } = await supabase
          .from("tickets")
          .select("email")
          .eq("order_id", ticket.order_id)
          .is("attendee_name", null)
          .maybeSingle();
        buyerEmail = buyerTicket?.email;
      }
      await sendApplicationRefundedEmail({ ticketId: ticket.id, buyerEmail });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("revoke error", err);
    return NextResponse.json(
      { error: "Could not revoke ticket." },
      { status: 500 }
    );
  }
}
