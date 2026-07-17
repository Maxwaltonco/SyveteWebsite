import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key. Never import this
// file from client components — the service key bypasses row-level
// security, which is exactly what the admin dashboard and webhook need,
// but it must stay on the server.
//
// supabase-js makes its requests through the global `fetch`, which in a
// Next.js server runtime is patched to participate in Next's Data Cache.
// A route's `export const dynamic = "force-dynamic"` normally covers this,
// but explicitly passing cache: "no-store" here means every Supabase call
// is guaranteed live regardless of which route it's called from.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
