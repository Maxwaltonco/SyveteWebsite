import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { getEventSettings } from "../../../../lib/eventConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: codes, error: codesError } = await supabase
      .from("affiliate_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (codesError) {
      return NextResponse.json({ error: codesError.message }, { status: 500 });
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("referral_code, amount_paid_cents")
      .not("referral_code", "is", null)
      .eq("status", "approved");

    if (ticketsError) {
      return NextResponse.json({ error: ticketsError.message }, { status: 500 });
    }

    // Click counts are supplementary (conversion-rate display only) — if the
    // affiliate_clicks table is missing or errors, fall back to zero clicks
    // per code rather than failing the whole response and hiding the codes
    // list, which is the primary thing this endpoint exists to serve.
    const { data: clicks, error: clicksError } = await supabase
      .from("affiliate_clicks")
      .select("code");

    if (clicksError) {
      console.error("affiliates GET clicks error (non-fatal)", clicksError);
    }

    const EVENT = await getEventSettings();
    const fullPriceCents = EVENT.priceAUD * 100;
    const stats = {};
    for (const t of tickets) {
      if (!stats[t.referral_code]) {
        stats[t.referral_code] = { ticketCount: 0, revenueCents: 0, discountCents: 0 };
      }
      stats[t.referral_code].ticketCount += 1;
      stats[t.referral_code].revenueCents += t.amount_paid_cents || 0;
      stats[t.referral_code].discountCents += Math.max(
        fullPriceCents - (t.amount_paid_cents || 0),
        0
      );
    }

    const clickCounts = {};
    for (const c of clicks || []) {
      clickCounts[c.code] = (clickCounts[c.code] || 0) + 1;
    }

    const withStats = codes.map((c) => {
      const ticketCount = stats[c.code]?.ticketCount || 0;
      const clickCount = clickCounts[c.code] || 0;
      return {
        ...c,
        ticketCount,
        revenueCents: stats[c.code]?.revenueCents || 0,
        discountCents: stats[c.code]?.discountCents || 0,
        clickCount,
        conversionRate: clickCount > 0 ? (ticketCount / clickCount) * 100 : null,
      };
    });

    return NextResponse.json({ codes: withStats });
  } catch (err) {
    console.error("affiliates GET error", err);
    return NextResponse.json(
      { error: "Could not load affiliate codes." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { code, promoterName, discountPercent } = await req.json();
    const cleanCode = (code || "").trim().toUpperCase();
    const cleanPromoter = (promoterName || "").trim();
    const cleanDiscountPercent = Math.min(
      Math.max(Math.round(parseFloat(discountPercent) || 0), 0),
      100
    );

    if (!cleanCode || !cleanPromoter) {
      return NextResponse.json(
        { error: "Code and promoter name are required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("affiliate_codes").insert({
      code: cleanCode,
      promoter_name: cleanPromoter,
      discount_percent: cleanDiscountPercent,
      active: true,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That code already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("affiliates POST error", err);
    return NextResponse.json(
      { error: "Could not create affiliate code." },
      { status: 500 }
    );
  }
}
