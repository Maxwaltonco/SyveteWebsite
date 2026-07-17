import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

function dateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function normalizeInstagram(handle) {
  return (handle || "").trim().toLowerCase().replace(/^@/, "");
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select(
        "created_at, status, amount_paid_cents, order_id, email, instagram_handle, attendee_instagram"
      );

    if (ticketsError) {
      return NextResponse.json({ error: ticketsError.message }, { status: 500 });
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("email, instagram_handle");

    if (leadsError) {
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // --- Sales velocity: last 24h vs the prior 24h ---
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    let last24h = 0;
    let prior24h = 0;
    for (const t of tickets) {
      const age = now - new Date(t.created_at).getTime();
      if (age <= DAY_MS) last24h++;
      else if (age <= DAY_MS * 2) prior24h++;
    }
    const deltaPct =
      prior24h > 0
        ? Math.round(((last24h - prior24h) / prior24h) * 100)
        : last24h > 0
        ? 100
        : 0;

    // --- Day-by-day count since the first sale ---
    const dailyCounts = {};
    for (const t of tickets) {
      const key = dateKey(t.created_at);
      dailyCounts[key] = (dailyCounts[key] || 0) + 1;
    }
    const daily = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    // --- Group size distribution (by shared order_id) ---
    const orderSizes = {};
    for (const t of tickets) {
      const key = t.order_id || t.created_at; // fallback groups singletons
      orderSizes[key] = (orderSizes[key] || 0) + 1;
    }
    const groupSizes = { "1": 0, "2": 0, "3": 0, "4+": 0 };
    for (const size of Object.values(orderSizes)) {
      if (size >= 4) groupSizes["4+"]++;
      else groupSizes[String(size)]++;
    }

    // --- Net revenue: (approved + revoked) minus refunded ---
    let grossCents = 0;
    let refundedCents = 0;
    for (const t of tickets) {
      if (t.status === "approved" || t.status === "revoked") {
        grossCents += t.amount_paid_cents || 0;
      } else if (t.status === "refunded") {
        refundedCents += t.amount_paid_cents || 0;
      }
    }
    const netCents = grossCents - refundedCents;

    // --- Lead-to-purchase conversion (email or Instagram match) ---
    const ticketEmails = new Set();
    const ticketHandles = new Set();
    for (const t of tickets) {
      if (t.email) ticketEmails.add(normalizeEmail(t.email));
      if (t.instagram_handle) ticketHandles.add(normalizeInstagram(t.instagram_handle));
      if (t.attendee_instagram) ticketHandles.add(normalizeInstagram(t.attendee_instagram));
    }
    let converted = 0;
    for (const lead of leads) {
      const email = normalizeEmail(lead.email);
      const handle = normalizeInstagram(lead.instagram_handle);
      if ((email && ticketEmails.has(email)) || (handle && ticketHandles.has(handle))) {
        converted++;
      }
    }

    return NextResponse.json({
      velocity: { last24h, prior24h, deltaPct },
      daily,
      groupSizes,
      revenue: { grossCents, refundedCents, netCents },
      conversion: { totalLeads: leads.length, converted },
    });
  } catch (err) {
    console.error("stats error", err);
    return NextResponse.json({ error: "Could not load stats." }, { status: 500 });
  }
}
