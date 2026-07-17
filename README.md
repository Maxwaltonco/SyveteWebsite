# Syvete — ticket site

What this is: a ticket-selling website for the yacht party. People buy on
Stripe, their details land in a database, and you get an admin page at
`/admin` that lists everyone who's paid, with a button to revoke (and
optionally refund) any ticket.

Before you touch any of this, edit `lib/eventConfig.js` — event name,
date, price, capacity, Instagram handle. Everything else reads from there.

---

## What you're setting up, in order

1. **Supabase** — free database that stores who bought a ticket.
2. **Stripe** — takes the actual payments.
3. **Vercel** — hosts the website, free for this scale.
4. Connect them together with environment variables.
5. Test with a fake card. Go live.

Budget about 45 minutes the first time.

---

## 1. Supabase (the database)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Pick any name/region (choose Sydney if offered — closest to Perth).
   Set a database password and save it somewhere, though you won't need
   it for this setup.
3. Once the project is ready, go to **SQL Editor** → **New query**.
4. Open `supabase/schema.sql` from this folder, paste the whole thing
   in, click **Run**. This creates the `tickets` table.
5. Go to **Project Settings → API**. You'll need two values later:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** (under "Project API keys", NOT the "anon
     public" one) → this is `SUPABASE_SERVICE_ROLE_KEY`

   The service_role key can read/write everything with no restrictions —
   never put it in front-end code or share it. It's only ever used on
   the server, which is how this project is wired.

---

## 2. Stripe (payments)

1. Go to [stripe.com](https://stripe.com) → sign up as an Australian
   business (you'll need an ABN or to register as a sole trader — this
   is the real legal/compliance step, not optional if you want to
   actually receive money).
2. While you're in test mode (default when you sign up), go to
   **Developers → API keys**. Copy the **Secret key** (starts `sk_test_`)
   → this is `STRIPE_SECRET_KEY` for now.
3. Leave the webhook step until after you've deployed to Vercel once
   (Stripe needs a live URL to send webhooks to — see step 4 below).
4. Only flip to **live mode** (top-left toggle in Stripe) once Stripe
   has finished verifying your business. Live mode has its own separate
   API keys (`sk_live_...`) — swap them in once you're ready to take
   real money.

---

## 3. Vercel (hosting)

1. Push this folder to a GitHub repo (or ask me and I'll walk you
   through that part too — you'll need a free GitHub account).
2. Go to [vercel.com](https://vercel.com) → sign up with GitHub →
   **Add New → Project** → import the repo.
3. Before clicking Deploy, open **Environment Variables** and add
   everything from `.env.example`:

   | Key | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | from Stripe, step 2 |
   | `STRIPE_WEBHOOK_SECRET` | placeholder for now, e.g. `whsec_pending` — you'll update this in step 4 |
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase, step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase, step 1 |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel URL, e.g. `https://syvete.vercel.app` (you'll know this after first deploy — redeploy once you do) |
   | `ADMIN_PASSWORD` | pick something strong, this guards `/admin` |

4. Click **Deploy**. You'll get a live URL in about a minute.
5. Go back into the project's environment variables, set
   `NEXT_PUBLIC_SITE_URL` to the real URL Vercel gave you, and
   redeploy (Deployments tab → ⋯ on latest → Redeploy).

---

## 4. Wire up the Stripe webhook

This is the step that makes a successful payment actually create a
ticket in your database. Skip it and people can pay but never show up
in your admin list.

1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-vercel-url.vercel.app/api/webhook`
3. Select event: `checkout.session.completed`.
4. Save. Stripe shows you a **Signing secret** (`whsec_...`) — copy it.
5. In Vercel, update `STRIPE_WEBHOOK_SECRET` to that value, redeploy.

---

## 5. Test it before going live

While still in Stripe **test mode**:

1. Visit your site, click buy, use Stripe's test card
   `4242 4242 4242 4242`, any future expiry, any CVC.
2. You should land on `/success`.
3. Go to `yoursite.com/admin`, log in with `ADMIN_PASSWORD`, and
   confirm the test purchase shows up.
4. Try **Revoke + refund** on it — check the payment gets refunded in
   Stripe's dashboard too.
5. Only once this all works: switch Stripe to **live mode**, swap
   `STRIPE_SECRET_KEY` for the `sk_live_...` version, and repeat the
   webhook step (live mode has its own separate webhook signing
   secret) with a real $1 test purchase to yourself if you want extra
   confidence.

---

## Using it day-to-day

- **`yoursite.com`** — the public ticket page.
- **`yoursite.com/admin`** — password-gated guest list. Search by
  name, email, Instagram, or ticket code. Revoke with or without
  refund; you're asked for a reason each time, which is saved against
  that ticket for your own records.
- The homepage shows a live "spots left" counter based on
  `EVENT.capacity` in `lib/eventConfig.js` minus valid tickets sold —
  drop capacity below the boat's real max if you want a buffer.
- At the door: check ID against name on the ticket confirmation email,
  or search their name/ticket code in `/admin` on your phone if you
  want to confirm they haven't been revoked.

## Things this doesn't do (be aware)

- It does **not** verify age beyond a self-reported dropdown at
  checkout — real age verification only happens at the gangway with ID.
  The "Flagged under 18" counter in `/admin` just tells you who
  self-reported "No," so you can review before boarding day.
- It does **not** stop someone forwarding their confirmation email to
  a friend — ticket codes are per-purchase, not biometric. Door staff
  matching name-to-ID is still the real control.
- Refunds through "Revoke + refund" go back to the original card and
  can take 5–10 business days to appear for the buyer.
