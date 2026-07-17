// Shared between the homepage (writes on a valid ?ref= visit) and the Apply
// modal (reads to pre-fill), so the storage key and 48h window can't drift
// out of sync between the two call sites.
export const ATTRIBUTION_KEY = "syvete-attribution";
export const ATTRIBUTION_WINDOW_MS = 48 * 60 * 60 * 1000;

export function storeAttribution(code) {
  try {
    localStorage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify({ code, timestamp: Date.now() })
    );
  } catch {
    // localStorage unavailable — attribution just won't persist this session
  }
}

export function getValidAttribution() {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.code || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > ATTRIBUTION_WINDOW_MS) return null;
    return parsed.code;
  } catch {
    return null;
  }
}
