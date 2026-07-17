// Persists the embedded Checkout session tied to the in-progress order, so
// closing and reopening the Apply modal (or a full page reload) can resume
// straight into step 2 instead of losing the payment-in-progress state.
const SESSION_KEY = "syvete-checkout-session";

export function storeCheckoutSession({ pendingOrderId, clientSecret, sessionId, expiresAt }) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ pendingOrderId, clientSecret, sessionId, expiresAt })
    );
  } catch {
    // localStorage unavailable — resume just won't work this session
  }
}

export function getStoredCheckoutSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.pendingOrderId || !parsed.clientSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // non-fatal
  }
}

// expiresAt is a Stripe epoch-seconds timestamp (session.expires_at).
export function isSessionExpired(stored) {
  if (!stored || !stored.expiresAt) return true;
  return Date.now() / 1000 >= stored.expiresAt;
}
