# Design brief — Sunset Sessions ticket site (v2)

Hand this to Claude Code alongside the existing `yacht-party` codebase.
The backend (Stripe checkout, Supabase, admin dashboard, webhook) stays
as-is — this is a restyle of `app/page.js` and `app/globals.css` only,
plus one new feature (the email/Instagram capture funnel below).

## The problem with v1

The current site (dark navy, coral-to-gold gradient hero, glowing
buttons, three-card feature grid, FAQ accordion) reads as a generic
AI-generated SaaS template. It's doing too much explaining and not
enough showing. Throw it out — don't iterate on it, replace it.

## Reference

[allagi.music](https://allagi.music) — a single artist logo, a handful
of small scattered graphic stickers on open space, one clear
interactive object doing the actual job (a music player), almost no
copy. That's the grammar to copy: **one page, one job, minimal chrome
around it.**

## Negative prompt — do not do this

- No purple/coral gradients, no glow, no neon, no drop shadows on buttons
- No "3-feature grid" or "why choose us" card layout
- No FAQ accordion or wall of small-print sections stacked below the fold
- No maximalist poster style either (the Kool-Aid image) — no clashing
  colors, no busy overlapping graphics, no shouty all-caps stacked type
- No stock "trustworthy SaaS" phrasing ("seamless," "elevate," "unlock")
- Nothing that requires more than one scroll to reach the buy button

## Direction: quiet, expensive, one job

**Mood:** upscale and exclusive, but young — think a boutique nightlife
brand or a members' club Instagram, not a law firm. Confidence through
restraint, not through saying "exclusive" a lot.

**Palette (pick one flat background, no gradient):**
- Near-black canvas (`#0B0D10` or similar) with off-white text
  (`#F2F1EC`), one single cool accent used sparingly — an ice/silver
  tone (`#C7D2D9` or a slightly bluer `#B9C6D6`), applied only to the
  ticket price and the buy button. Everything else stays monochrome.
  Avoid anything that reads as blue-brand/corporate — keep it closer
  to brushed metal than tech-blue.
- Flat fills only. No gradients anywhere, including on buttons.

**Type:** one confident display face for the event name (large, a lot
of whitespace around it), one plain body face for the few lines of
copy. Avoid anything that looks like a startup logotype (no rounded
geometric sans as the display face — try something with more edge:
a tight grotesk or a serif with attitude).

**Layout — single screen, minimal scroll:**
1. Small wordmark/eyebrow top-left or centered (event name only)
2. One large line stating what this is + the date — nothing else
   competing for attention
3. Price + "get tickets" as the one obvious action, flat button,
   no icon soup around it
4. A handful of small scattered graphic marks (a wave, a compass,
   a small boat icon — pick 2–3 max) placed like the reference site's
   stickers, not as a hero illustration
5. Everything else (boat details, FAQ, refund policy) collapses into
   a single "details" link/expand at the bottom, or its own quiet
   secondary page — it should not compete visually with the ticket CTA

**Copy tone:** short, declarative, present tense. "One boat. One
night. 26 Sept." Not "Join us for an unforgettable evening aboard..."
Cut every sentence that isn't load-bearing.

## New feature: the funnel for non-buyers

Anyone not ready to buy should have a low-friction second option:
enter email or Instagram handle to get on a list (for future events /
last drops / a waitlist if this one sells out). Build this as:

- A single small link or line beneath the main CTA — not a second
  competing button. Something like "not ready yet? stay in the loop"
  as quiet secondary text, opening a compact two-field form: email
  and Instagram handle, both optional but require at least one filled
  before submit. Keep it to those two fields, nothing else.
- New Supabase table `leads` (`id`, `created_at`, `email`,
  `instagram_handle`) — separate from `tickets`, since this is a
  different intent (interest, not purchase).
- New route `app/api/leads/route.js` — POST, writes to `leads`,
  returns success. No Stripe involvement.
- Show these in `/admin` as a second, smaller list/tab — not mixed
  into the ticket table.
- What happens to this list later (an email sequence, a DM blast) is
  intentionally not built yet — just capture and store it.

## What to keep unchanged

- `lib/eventConfig.js` structure (update with real values — see below)
- All of `/api/checkout`, `/api/webhook`, `/api/admin/*`, `middleware.js`
- The 18+ confirmation and Instagram handle fields at Stripe checkout
- `/success` page can stay simple, just restyle to match the new palette

## Business details to plug into `eventConfig.js` before launch

Fill these in with Claude Code once you have them:
- Real business/trading name (footer, invoices)
- ABN
- Confirmed Instagram handle
- Confirm event name (currently placeholder "Sunset Sessions")
