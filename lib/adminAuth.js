// Uses Web Crypto (available in both the Edge middleware runtime and
// Node route handlers) instead of Node's `crypto` module, which the
// Edge runtime can't load.
export async function getAdminToken(password) {
  const enc = new TextEncoder().encode(`admin-session:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
