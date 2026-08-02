import { NextResponse } from "next/server";
import { getStripe, generateTicketCode } from "../../../lib/stripe";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { sendPaymentReceivedEmail } from "../../../lib/mailer";

// Stripe needs the raw request body to verify the signature.
export async function POST(req) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("webhook signature verification failed", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const supabase = getSupabaseAdmin();

    const pendingOrderId = session.client_reference_id;
    if (!pendingOrderId) {
      console.error("webhook: checkout session has no client_reference_id", session.id);
      return NextResponse.json({ received: true });
    }

    // Atomically claim the order before doing any ticket work: only the
    // delivery that flips status 'pending' -> 'completed' gets a row back.
    // Stripe can and does redeliver this event (retries, network hiccups),
    // sometimes while a previous delivery is still mid-flight — a plain
    // fetch-then-later-update-status check has a race window there that lets
    // two overlapping deliveries both pass and both insert tickets. Claiming
    // via the conditional update itself closes that window, since Postgres
    // serializes concurrent UPDATEs on the same row.
    const { data: pendingOrder, error: claimError } = await supabase
      .from("pending_orders")
      .update({ status: "completed" })
      .eq("id", pendingOrderId)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (claimError) {
      console.error("webhook: could not claim pending_order", pendingOrderId, claimError);
      return NextResponse.json({ received: true });
    }
    if (!pendingOrder) {
      // Already completed by an earlier delivery, or superseded — nothing
      // left to do. This is what makes redelivery safe.
      return NextResponse.json({ received: true });
    }

    // The order is now marked 'completed' regardless of what happens below,
    // so a future redelivery of this same event will no-op via the claim
    // above rather than retrying this work. That makes it essential that any
    // failure from here on is actually recorded — otherwise a payment could
    // succeed, the order shows 'completed', and no ticket ever exists with
    // no trace beyond a log line.
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id);
      const quantity = pendingOrder.quantity || 1;
      const ageConfirmedText = pendingOrder.age_confirmed ? "Yes" : "No";
      const amountPerTicket = fullSession.amount_total
        ? Math.round(fullSession.amount_total / quantity)
        : 0;

      const buyerRow = {
        stripe_session_id: `${session.id}-${generateTicketCode()}`,
        stripe_payment_intent: fullSession.payment_intent,
        full_name: pendingOrder.buyer_name,
        email: pendingOrder.buyer_email,
        phone: pendingOrder.buyer_phone,
        instagram_handle: pendingOrder.buyer_instagram,
        attendee_name: null,
        attendee_instagram: null,
        age_confirmed: ageConfirmedText,
        quantity: 1,
        amount_paid_cents: amountPerTicket,
        status: "pending",
        ticket_code: generateTicketCode(),
        order_id: pendingOrder.id,
        referral_code: pendingOrder.referral_code,
      };

      const attendeeRows = (pendingOrder.attendees || []).map((a) => ({
        stripe_session_id: `${session.id}-${generateTicketCode()}`,
        stripe_payment_intent: fullSession.payment_intent,
        full_name: a.name || null,
        email: null,
        phone: null,
        instagram_handle: a.instagram || null,
        attendee_name: a.name || null,
        attendee_instagram: a.instagram || null,
        age_confirmed: ageConfirmedText,
        quantity: 1,
        amount_paid_cents: amountPerTicket,
        status: "pending",
        ticket_code: generateTicketCode(),
        order_id: pendingOrder.id,
        referral_code: pendingOrder.referral_code,
      }));

      const { error: insertError } = await supabase
        .from("tickets")
        .insert([buyerRow, ...attendeeRows]);

      if (insertError) {
        console.error("webhook: ticket insert failed after payment", insertError);
        await supabase
          .from("pending_orders")
          .update({
            status: "ticket_creation_failed",
            reconciliation_note: `Ticket insert failed: ${insertError.message}. Stripe session ${session.id}, payment_intent ${fullSession.payment_intent}.`,
          })
          .eq("id", pendingOrder.id);
      } else {
        // Never blocks: sendPaymentReceivedEmail catches and logs its own
        // failures rather than throwing, so a broken inbox can't undo the
        // ticket creation that already succeeded above.
        await sendPaymentReceivedEmail({
          orderId: pendingOrder.id,
          buyerEmail: pendingOrder.buyer_email,
          ticketCodes: [buyerRow.ticket_code, ...attendeeRows.map((r) => r.ticket_code)],
          totalPaidCents: fullSession.amount_total,
        });
      }
    } catch (err) {
      // Payment succeeded and the order is claimed, but something after that
      // (Stripe retrieve, ticket-row building, etc) blew up — flag it the
      // same way, so it surfaces in the admin dashboard instead of only a
      // log line that disappears on the next deploy.
      console.error("webhook: error finishing ticket creation", err);
      await supabase
        .from("pending_orders")
        .update({
          status: "ticket_creation_failed",
          reconciliation_note: `Error after payment: ${err.message}. Stripe session ${session.id}.`,
        })
        .eq("id", pendingOrder.id);
    }
  }

  return NextResponse.json({ received: true });
}
