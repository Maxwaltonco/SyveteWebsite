import { NextResponse } from "next/server";
import { getStripe } from "../../../lib/stripe";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { getEventSettings } from "../../../lib/eventConfig";
import { isValidFullName, FULL_NAME_ERROR } from "../../../lib/validateName";

const MIN_QTY = 1;
const MAX_QTY = 6;

export async function POST(req) {
  try {
    const body = await req.json();
    const buyerName = (body.buyerName || "").trim();
    const buyerEmail = (body.buyerEmail || "").trim();
    const buyerPhone = (body.buyerPhone || "").trim();
    const buyerInstagram = (body.buyerInstagram || "").trim();
    const ageConfirmed = !!body.ageConfirmed;
    const quantity = Math.min(
      Math.max(parseInt(body.quantity, 10) || 1, MIN_QTY),
      MAX_QTY
    );
    const rawReferralCode = (body.referralCode || "").trim().toUpperCase();

    if (!buyerName || !buyerEmail || !buyerPhone || !buyerInstagram) {
      return NextResponse.json(
        { error: "Buyer name, email, phone, and Instagram are all required." },
        { status: 400 }
      );
    }
    if (!isValidFullName(buyerName)) {
      return NextResponse.json({ error: FULL_NAME_ERROR }, { status: 400 });
    }
    if (!ageConfirmed) {
      return NextResponse.json(
        { error: "Please confirm everyone in the group is 18 or older." },
        { status: 400 }
      );
    }

    const attendeeCount = Math.max(quantity - 1, 0);
    const attendees = Array.from({ length: attendeeCount }).map((_, i) => {
      const a = (body.attendees || [])[i] || {};
      return {
        name: (a.name || "").trim(),
        instagram: (a.instagram || "").trim() || null,
      };
    });
    if (attendees.some((a) => !a.name)) {
      return NextResponse.json(
        { error: "Every guest needs a full name." },
        { status: 400 }
      );
    }
    if (attendees.some((a) => !isValidFullName(a.name))) {
      return NextResponse.json({ error: FULL_NAME_ERROR }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // If this submission is replacing an earlier one (the user went back to
    // step 1, edited something, and resubmitted), retire the old pending
    // order rather than leaving two live rows pointing at the same person.
    // Only supersede a row that's still pending — if it was already paid or
    // already superseded, leave it alone.
    const previousOrderId = (body.previousOrderId || "").trim();
    if (previousOrderId) {
      await supabase
        .from("pending_orders")
        .update({ status: "superseded" })
        .eq("id", previousOrderId)
        .eq("status", "pending");
    }

    // Re-validate the referral code server-side rather than trusting the
    // client — never blocks submission, just drops the discount silently
    // if the code turns out invalid (e.g. deactivated after the client
    // checked it).
    let discountPercent = 0;
    let appliedReferralCode = null;
    if (rawReferralCode) {
      const { data: codeRow } = await supabase
        .from("affiliate_codes")
        .select("discount_percent")
        .eq("code", rawReferralCode)
        .eq("active", true)
        .maybeSingle();
      if (codeRow) {
        discountPercent = codeRow.discount_percent || 0;
        appliedReferralCode = rawReferralCode;
      }
    }

    const { data: pendingOrder, error: insertError } = await supabase
      .from("pending_orders")
      .insert({
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
        buyer_instagram: buyerInstagram,
        attendees,
        quantity,
        age_confirmed: ageConfirmed,
        referral_code: appliedReferralCode,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !pendingOrder) {
      console.error("pending_orders insert error", insertError);
      return NextResponse.json(
        { error: "Could not start your application. Try again." },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const EVENT = await getEventSettings();

    // A percent-off discount is applied as a real Stripe Coupon so it shows
    // as a proper discount line on the checkout page and receipt, rather
    // than being baked silently into the unit price.
    let discounts;
    if (discountPercent > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent,
        duration: "once",
        name: appliedReferralCode,
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      client_reference_id: pendingOrder.id,
      customer_email: buyerEmail,
      line_items: [
        {
          price_data: {
            currency: "aud",
            unit_amount: EVENT.priceAUD * 100,
            product_data: {
              name: `${EVENT.name} — ${EVENT.dateDisplay}`,
              description: `${EVENT.subtitle}, boarding ${EVENT.boardingTime}`,
            },
          },
          quantity,
        },
      ],
      ...(discounts ? { discounts } : {}),
      // Embedded Checkout always redirects the top-level page on completion
      // (there's no in-page onComplete callback) — this points back at the
      // homepage itself rather than a separate /success page, so the app
      // can detect it client-side and reopen the modal to an inline success
      // view instead of navigating to a different route.
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?checkout_session_id={CHECKOUT_SESSION_ID}`,
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
      pendingOrderId: pendingOrder.id,
      expiresAt: session.expires_at,
    });
  } catch (err) {
    console.error("apply error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again." },
      { status: 500 }
    );
  }
}
