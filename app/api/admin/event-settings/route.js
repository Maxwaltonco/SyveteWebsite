import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("event_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "No event settings row found." },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("admin event-settings GET error", err);
    return NextResponse.json(
      { error: "Could not load event settings." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const subtitle = (body.subtitle || "").trim();
    const dateISO = (body.dateISO || "").trim();
    const dateDisplay = (body.dateDisplay || "").trim();
    const boardingTime = (body.boardingTime || "").trim();
    const departLocation = (body.departLocation || "").trim();
    const priceAUD = parseInt(body.priceAUD, 10);
    const capacity = parseInt(body.capacity, 10);
    const instagramHandle = (body.instagramHandle || "").trim() || null;

    if (!name || !subtitle || !dateDisplay || !boardingTime || !departLocation) {
      return NextResponse.json(
        { error: "Name, subtitle, date, boarding time, and location are all required." },
        { status: 400 }
      );
    }
    if (!dateISO || Number.isNaN(new Date(dateISO).getTime())) {
      return NextResponse.json(
        { error: "Invalid event date/time." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(priceAUD) || priceAUD <= 0) {
      return NextResponse.json(
        { error: "Price must be a positive whole number of dollars." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return NextResponse.json(
        { error: "Capacity must be a positive whole number." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Single-row table — find its id and update in place rather than
    // inserting a new row, so there's never more than one live settings row.
    const { data: existing, error: findError } = await supabase
      .from("event_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json(
        { error: "No event settings row to update." },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("event_settings")
      .update({
        name,
        subtitle,
        date_iso: dateISO,
        date_display: dateDisplay,
        boarding_time: boardingTime,
        depart_location: departLocation,
        price_aud: priceAUD,
        capacity,
        instagram_handle: instagramHandle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("admin event-settings POST error", err);
    return NextResponse.json(
      { error: "Could not save event settings." },
      { status: 500 }
    );
  }
}
