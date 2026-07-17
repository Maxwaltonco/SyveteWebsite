import { NextResponse } from "next/server";
import { getEventSettings } from "../../../lib/eventConfig";

// Public — no auth. Just the event name/date/price/etc shown on the
// homepage, same info anyone can already see without logging in.
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getEventSettings();
  return NextResponse.json(settings);
}
