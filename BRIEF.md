# Project brief — hand this to Claude Code first

Paste this whole file into your first message to Claude Code when you open
the `yacht-party` folder, so it has full context before making any changes.

## The business

- **Trading name:** [fill in — your sole trader trading name for the footer/invoices]
- **ABN:** [fill in — not shown on the public site, needed for Stripe/invoicing]
- **Instagram handle:** [fill in — the account you're converting from memes to event promo]
- **Event name:** currently placeholder "Sunset Sessions" in `lib/eventConfig.js` —
  replace with whatever you land on, or keep it and just say so.

## The event (already correct in `lib/eventConfig.js`, confirm/edit there)

- Yacht party, Spirit of Broome, Swan River, Perth
- 26 September 2026, boarding 5:00 PM, Pier 1 Barrack Street Jetty
- $200/ticket, capacity capped at 150 (boat holds 200)
- Audience: 18–23 year olds

## Design direction

**Mood:** upscale / exclusive — moody and restrained, premium. Explicitly
*not* stuffy-old-money exclusive — this needs to read as the hot, trendy
thing young people want to be at, communicated through confidence and
restraint rather than loud party-flyer energy (gradients, "vibe" copy,
exclamation-point marketing).

**Job of the page:** one purpose only — buy a ticket, or quickly confirm
the essential facts (date, price, what to bring, ID policy). Not a full
marketing site with multiple persuasion sections. Cut anything that isn't
in service of that.

**What to change from the current build:**
- The coral-to-gold sunset gradient and "vibe" language (dance floors,
  "let's go" energy) currently in the hero and card copy reads more
  festival-fun than exclusive. Pull this back — consider a more
  monochrome ink/foam palette with a single precise accent used sparingly,
  not as a hero gradient.
- Simplify structure: hero (event name, date, price, buy button) →
  essential facts → FAQ. Consider cutting or shrinking the three-card
  "the boat" section — it's decorative marketing copy, not information
  someone needs to decide.
- Typography should carry the exclusivity — confident, spacious, editorial
  — rather than illustration or imagery doing the work.

**Imagery:** none yet. No stock photos, no AI-generated party photos —
use typography, spacing, and graphic/illustrative elements instead.
Revisit once real event photos exist.

**Promoters:** the friends posting as promoters stay Instagram-only —
don't build a "featured promoters" section on the site itself.

## Everything else (functionality) is already correct

Stripe checkout, Supabase ticket storage, admin revoke/refund dashboard,
age-confirmation capture, ticket codes — all built and tested. This brief
is about visual direction and page structure only, not the underlying
system. See `README.md` for the Stripe/Supabase/Vercel deployment steps.
