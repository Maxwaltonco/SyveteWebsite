"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getValidAttribution } from "../lib/attribution";
import { useEventSettings } from "../lib/useEventSettings";
import { isValidFullName, FULL_NAME_ERROR } from "../lib/validateName";
import {
  storeCheckoutSession,
  getStoredCheckoutSession,
  clearCheckoutSession,
  isSessionExpired,
} from "../lib/checkoutSession";

const DRAFT_KEY = "syvete-entry-draft";
const SAVE_DEBOUNCE_MS = 400;
const MIN_QTY = 1;
const MAX_QTY = 6;

// Created once at module scope (not per-render) per Stripe's own guidance.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function loadDraft() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function resizeAttendees(list, count) {
  const next = list.slice(0, count);
  while (next.length < count) next.push({ name: "", instagram: "" });
  return next;
}

async function createCheckoutSession(payload) {
  const res = await fetch("/api/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export default function ApplyModal({ open, onClose }) {
  const EVENT = useEventSettings();
  const [draft] = useState(loadDraft);

  const [quantity, setQuantity] = useState(draft.quantity || 1);
  const [buyerName, setBuyerName] = useState(draft.buyerName || "");
  const [buyerEmail, setBuyerEmail] = useState(draft.buyerEmail || "");
  const [buyerPhone, setBuyerPhone] = useState(draft.buyerPhone || "");
  const [buyerInstagram, setBuyerInstagram] = useState(draft.buyerInstagram || "");
  const [attendees, setAttendees] = useState(() =>
    resizeAttendees(draft.attendees || [], Math.max((draft.quantity || 1) - 1, 0))
  );
  const [ageConfirmed, setAgeConfirmed] = useState(draft.ageConfirmed || false);
  const [referralCode, setReferralCode] = useState(draft.referralCode || "");
  const [referralInvalid, setReferralInvalid] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [buyerNameError, setBuyerNameError] = useState("");
  const [attendeeNameErrors, setAttendeeNameErrors] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 'form' (step 1) | 'checkout' (step 2, embedded Stripe form) | 'success'
  const [view, setView] = useState("form");
  const [resolving, setResolving] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState(null);
  const [checkoutPendingOrderId, setCheckoutPendingOrderId] = useState(null);

  const saveTimeoutRef = useRef(null);

  // Pre-fill from stored attribution (a ?ref= visit within the last 48h)
  // every time the modal opens — not just once on first mount. The modal
  // component stays mounted the whole time (open/closed via the `open`
  // prop), so a []-only effect would only ever see whatever attribution
  // existed the very first time it rendered, going stale on every
  // subsequent open. Keyed on `open` so it re-reads fresh each time.
  // Unconditionally overwrites on each open when valid attribution exists —
  // this can replace a code the user manually typed in an earlier open, but
  // that's the intended behavior: a fresh ?ref= visit should always win.
  useEffect(() => {
    if (!open) return;
    const attributed = getValidAttribution();
    if (attributed) setReferralCode(attributed);
  }, [open]);

  // Decide what the modal should show each time it opens: a payment that
  // just completed (returning from Stripe's redirect), an in-progress order
  // that can resume straight into step 2, or a fresh step 1 form. Skips the
  // async work entirely (no loading flash) when there's nothing to resume.
  useEffect(() => {
    if (!open) return;

    const params = new URLSearchParams(window.location.search);
    const returnedSessionId = params.get("checkout_session_id");
    const stored = getStoredCheckoutSession();

    // Already showing the live embedded checkout for this exact session —
    // e.g. the user just closed and reopened the modal without navigating.
    // Nothing to resolve. Re-resolving would flip `resolving` briefly and
    // unmount/remount EmbeddedCheckoutProvider, which throws Stripe's
    // "cannot have multiple Embedded Checkout objects" if the previous
    // instance hasn't finished tearing down yet.
    if (
      !returnedSessionId &&
      view === "checkout" &&
      checkoutClientSecret &&
      stored?.clientSecret === checkoutClientSecret
    ) {
      return;
    }

    if (!returnedSessionId && !stored) {
      setView("form");
      return;
    }

    let cancelled = false;
    setResolving(true);

    (async () => {
      if (returnedSessionId) {
        // Strip the param immediately so a later refresh doesn't re-trigger this.
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout_session_id");
        window.history.replaceState({}, "", url.toString());

        try {
          const res = await fetch(
            `/api/checkout-status?session_id=${encodeURIComponent(returnedSessionId)}`
          );
          const data = await res.json();
          if (cancelled) return;
          if (data.status === "complete") {
            clearCheckoutSession();
            try {
              localStorage.removeItem(DRAFT_KEY);
            } catch {
              // non-fatal
            }
            setView("success");
            setResolving(false);
            return;
          }
          // status 'open' (not completed) or 'expired' — fall through to
          // the normal resume check below, which handles both cases.
        } catch {
          // fall through to normal resume-check below
        }
      }

      const currentStored = getStoredCheckoutSession();
      if (currentStored) {
        try {
          const res = await fetch(
            `/api/pending-order-status?id=${encodeURIComponent(currentStored.pendingOrderId)}`
          );
          const data = await res.json();
          if (cancelled) return;

          if (data.status === "pending") {
            if (!isSessionExpired(currentStored)) {
              setCheckoutClientSecret(currentStored.clientSecret);
              setCheckoutPendingOrderId(currentStored.pendingOrderId);
              setView("checkout");
              setResolving(false);
              return;
            }

            // Expired — transparently mint a fresh session from the saved
            // draft data. The user shouldn't need to redo anything.
            const draftNow = loadDraft();
            const { ok, data: fresh } = await createCheckoutSession({
              buyerName: draftNow.buyerName,
              buyerEmail: draftNow.buyerEmail,
              buyerPhone: draftNow.buyerPhone,
              buyerInstagram: draftNow.buyerInstagram,
              attendees: draftNow.attendees,
              quantity: draftNow.quantity,
              ageConfirmed: draftNow.ageConfirmed,
              referralCode: draftNow.referralCode || null,
              previousOrderId: currentStored.pendingOrderId,
            });
            if (cancelled) return;
            if (ok && fresh.clientSecret) {
              storeCheckoutSession({
                pendingOrderId: fresh.pendingOrderId,
                clientSecret: fresh.clientSecret,
                sessionId: fresh.sessionId,
                expiresAt: fresh.expiresAt,
              });
              setCheckoutClientSecret(fresh.clientSecret);
              setCheckoutPendingOrderId(fresh.pendingOrderId);
              setView("checkout");
              setResolving(false);
              return;
            }
            clearCheckoutSession();
          } else {
            // Already completed elsewhere, or superseded — nothing to resume.
            clearCheckoutSession();
          }
        } catch {
          // Network hiccup — fall through to the form rather than getting stuck.
        }
      }

      if (!cancelled) {
        setView("form");
        setResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Keep the attendee field-groups (and their validation errors) in sync
  // with the quantity stepper.
  useEffect(() => {
    const count = Math.max(quantity - 1, 0);
    setAttendees((prev) => resizeAttendees(prev, count));
    setAttendeeNameErrors((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
  }, [quantity]);

  // Debounce-save the draft as the user types. Cleared only once payment
  // actually succeeds, never on close or on reaching step 2, so a reopened
  // modal always has the latest details to resume or edit from.
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            quantity,
            buyerName,
            buyerEmail,
            buyerPhone,
            buyerInstagram,
            attendees,
            ageConfirmed,
            referralCode,
          })
        );
      } catch {
        // localStorage unavailable — draft persistence just won't work this session
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [quantity, buyerName, buyerEmail, buyerPhone, buyerInstagram, attendees, ageConfirmed, referralCode]);

  // Live price reveal: debounce-check the referral code as it's typed so the
  // displayed total updates the moment a valid code is recognized, without
  // waiting for submit. Purely for display — doesn't touch referralInvalid,
  // which still only fires on an actual submit attempt. seqRef guards
  // against an earlier, slower check resolving after a newer one and
  // clobbering the discount with stale data.
  const referralSeqRef = useRef(0);
  useEffect(() => {
    const code = referralCode.trim();
    if (!code) {
      setDiscountPercent(0);
      return;
    }
    const seq = ++referralSeqRef.current;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/validate-referral?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (referralSeqRef.current !== seq) return;
        setDiscountPercent(data.valid ? data.discount_percent || 0 : 0);
      } catch {
        if (referralSeqRef.current === seq) setDiscountPercent(0);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [referralCode]);

  const unitPrice = Math.round(EVENT.priceAUD * (1 - discountPercent / 100));
  const totalPrice = unitPrice * quantity;

  function updateAttendee(index, key, value) {
    setAttendees((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [key]: value } : a))
    );
    if (key === "name") {
      setAttendeeNameErrors((prev) => {
        if (!prev[index]) return prev;
        const next = [...prev];
        next[index] = "";
        return next;
      });
    }
  }

  async function submitOrder(code) {
    setSubmitting(true);
    setSubmitError("");
    try {
      // A pending order already exists for this modal session (either
      // resumed or created on an earlier submit) — resubmitting means the
      // user went back and edited something, so this replaces it rather
      // than leaving two live orders behind.
      const previousOrderId = checkoutPendingOrderId;
      const { ok, data } = await createCheckoutSession({
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerInstagram,
        attendees,
        quantity,
        ageConfirmed,
        referralCode: code,
        previousOrderId,
      });
      if (ok && data.clientSecret) {
        storeCheckoutSession({
          pendingOrderId: data.pendingOrderId,
          clientSecret: data.clientSecret,
          sessionId: data.sessionId,
          expiresAt: data.expiresAt,
        });
        setCheckoutClientSecret(data.clientSecret);
        setCheckoutPendingOrderId(data.pendingOrderId);
        setView("checkout");
        setSubmitting(false);
      } else {
        setSubmitError(data.error || "Something went wrong. Try again.");
        setSubmitting(false);
      }
    } catch {
      setSubmitError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!ageConfirmed) return;

    const buyerValid = isValidFullName(buyerName);
    setBuyerNameError(buyerValid ? "" : FULL_NAME_ERROR);

    const nextAttendeeErrors = attendees.map((a) =>
      isValidFullName(a.name) ? "" : FULL_NAME_ERROR
    );
    setAttendeeNameErrors(nextAttendeeErrors);

    if (!buyerValid || nextAttendeeErrors.some(Boolean)) return;

    const code = referralCode.trim() || null;
    if (!code) {
      await submitOrder(null);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setReferralInvalid(false);
    try {
      const res = await fetch(
        `/api/validate-referral?code=${encodeURIComponent(code)}`
      );
      const data = await res.json();
      if (!data.valid) {
        setReferralInvalid(true);
        setSubmitting(false);
        return;
      }
    } catch {
      setReferralInvalid(true);
      setSubmitting(false);
      return;
    }

    await submitOrder(code);
  }

  async function continueWithoutCode() {
    setReferralCode("");
    setReferralInvalid(false);
    await submitOrder(null);
  }

  function goBackToForm() {
    setView("form");
  }

  // Normally unmount entirely on close (matches every other view, and
  // keeps the form's draft-seeded initial state — read from localStorage,
  // so it can't match the server-rendered markup — out of the SSR/hydration
  // path entirely). The one exception is the checkout view: closing while
  // EmbeddedCheckoutProvider is mounted must NOT unmount it, since Stripe's
  // SDK throws "cannot have multiple Embedded Checkout objects" if a new
  // instance mounts before the previous one finishes its async teardown —
  // exactly what a quick close-then-reopen would trigger. Hiding it via CSS
  // instead keeps the same live iframe alive for an instant, no-op reopen.
  if (!open && view !== "checkout") return null;

  return (
    <div
      className="apply-modal-overlay"
      style={open ? undefined : { display: "none" }}
    >
      <div className={`apply-modal-card ${view === "checkout" ? "apply-modal-card--checkout" : ""}`}>
        <button
          type="button"
          className="apply-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>

        {resolving ? (
          <p className="fine-print">Loading…</p>
        ) : view === "success" ? (
          <>
            <div className="eyebrow">Application Received</div>
            <p className="panel-copy panel-copy-lg">Almost There.</p>
            <p className="fine-print">
              Confirmation comes by email within 48 hours. Approved? Bring
              photo ID checked at the gangway. Not approved? Refunded in
              full.
            </p>
            <button
              type="button"
              className="home-buy-btn btn-glossy apply-submit-btn"
              onClick={onClose}
            >
              Done
            </button>
          </>
        ) : view === "checkout" ? (
          <>
            <button
              type="button"
              className="apply-inline-link apply-back-btn"
              onClick={goBackToForm}
            >
              &larr; Back
            </button>
            <div key={checkoutClientSecret}>
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ clientSecret: checkoutClientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow">Apply for Ticket</div>
            <div className="qty-stepper apply-qty-stepper">
              <button
                type="button"
                className="qty-btn btn-glossy"
                aria-label="Decrease quantity"
                disabled={quantity <= MIN_QTY}
                onClick={() => setQuantity((q) => Math.max(MIN_QTY, q - 1))}
              >
                −
              </button>
              <span className="qty-value">
                {quantity} {quantity === 1 ? "ticket" : "tickets"}
              </span>
              <button
                type="button"
                className="qty-btn btn-glossy"
                aria-label="Increase quantity"
                disabled={quantity >= MAX_QTY}
                onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
              >
                +
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <p className="apply-group-label">Your details</p>
              <div className="apply-field-grid">
                <input
                  required
                  placeholder="Full name"
                  className="lead-input apply-input"
                  value={buyerName}
                  onChange={(e) => {
                    setBuyerName(e.target.value);
                    if (buyerNameError) setBuyerNameError("");
                  }}
                />
                {buyerNameError && (
                  <p className="apply-field-error">{buyerNameError}</p>
                )}
                <input
                  required
                  type="email"
                  placeholder="Email"
                  className="lead-input apply-input"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
                <input
                  required
                  type="tel"
                  placeholder="Phone"
                  className="lead-input apply-input"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                />
                <input
                  required
                  placeholder="Instagram handle"
                  className="lead-input apply-input"
                  value={buyerInstagram}
                  onChange={(e) => setBuyerInstagram(e.target.value)}
                />
              </div>

              {attendees.map((a, i) => (
                <div key={i} className="apply-attendee-group">
                  <p className="apply-group-label">Guest {i + 2}</p>
                  <div className="apply-field-grid">
                    <input
                      required
                      placeholder="Full name"
                      className="lead-input apply-input"
                      value={a.name}
                      onChange={(e) => updateAttendee(i, "name", e.target.value)}
                    />
                    {attendeeNameErrors[i] && (
                      <p className="apply-field-error">{attendeeNameErrors[i]}</p>
                    )}
                    <input
                      placeholder="Instagram handle (optional)"
                      className="lead-input apply-input"
                      value={a.instagram || ""}
                      onChange={(e) =>
                        updateAttendee(i, "instagram", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}

              <label className="apply-checkbox-row">
                <input
                  type="checkbox"
                  required
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                />
                <span>I confirm everyone in this group is 18 or older</span>
              </label>

              <div className="apply-referral-row">
                <input
                  placeholder="Referral code (optional)"
                  className="lead-input apply-input"
                  value={referralCode}
                  onChange={(e) => {
                    setReferralCode(e.target.value);
                    setReferralInvalid(false);
                  }}
                />
                {referralInvalid && (
                  <p className="home-error apply-referral-invalid">
                    Affiliate code not recognized.{" "}
                    <button
                      type="button"
                      className="apply-inline-link"
                      onClick={continueWithoutCode}
                    >
                      Continue without code
                    </button>
                  </p>
                )}
              </div>

              <p className="apply-price-note">
                ${unitPrice} {quantity}x = ${totalPrice}
              </p>

              <button
                type="submit"
                className="home-buy-btn btn-glossy apply-submit-btn"
                disabled={submitting || !ageConfirmed}
              >
                {submitting
                  ? "Processing…"
                  : checkoutPendingOrderId
                  ? "Update and Checkout"
                  : "Checkout"}
              </button>
              {submitError && <p className="home-error">{submitError}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
