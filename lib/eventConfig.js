import { getSupabaseAdmin } from "./supabase";

// Used only if the event_settings row is ever missing (shouldn't happen
// once the schema's seed insert has run) — keeps the site from hard
// erroring rather than acting as a second source of truth.
const FALLBACK = {
  name: "Syvete",
  subtitle: "Spirit of Broome — Swan River",
  dateISO: "2026-09-26T17:00:00+08:00",
  dateDisplay: "Saturday 26 September 2026",
  boardingTime: "5:00 PM",
  departLocation: "Pier 1, Barrack Street Jetty, Perth",
  priceAUD: 200,
  capacity: 150,
  instagramHandle: "@syvete",
};

// Server-only: fetches the single live event_settings row from Supabase.
// Used directly by API routes (checkout session creation, capacity checks,
// etc) and by server components (layout metadata). Client components can't
// call this — they fetch the same data through GET /api/event-settings.
export async function getEventSettings() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("event_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("event_settings fetch failed, using fallback", error);
    return FALLBACK;
  }

  return {
    name: data.name,
    subtitle: data.subtitle,
    dateISO: data.date_iso,
    dateDisplay: data.date_display,
    boardingTime: data.boarding_time,
    departLocation: data.depart_location,
    priceAUD: data.price_aud,
    capacity: data.capacity,
    instagramHandle: data.instagram_handle || "@syvete",
  };
}

export { FALLBACK as EVENT_FALLBACK };
