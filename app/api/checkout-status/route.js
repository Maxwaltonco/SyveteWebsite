import { NextResponse } from "next/server";
import { getStripe } from "../../../lib/stripe";

export const dynamic = "force-dynamic";

// Embedded Checkout has no in-page completion callback — the client lands
// back here (via return_url) or polls this directly, and we ask Stripe for
// the authoritative session status rather than waiting on the webhook,
// which may not have processed yet.
export async function GET(req) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
    });
  } catch (err) {
    console.error("checkout-status error", err);
    return NextResponse.json({ error: "Could not check session status." }, { status: 500 });
  }
}
