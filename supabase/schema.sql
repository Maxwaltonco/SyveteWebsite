-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  stripe_session_id text unique not null,
  stripe_payment_intent text,
  full_name text,
  email text,
  phone text,
  instagram_handle text,
  age_confirmed text, -- "Yes" / "No" as answered at checkout
  quantity int not null default 1,
  amount_paid_cents int not null,
  status text not null default 'pending', -- 'pending' | 'approved' | 'revoked' | 'refunded'
  revoked_at timestamptz,
  revoke_reason text,
  ticket_code text unique, -- short code shown at the door
  order_id uuid, -- shared across every ticket in the same group purchase
  attendee_name text, -- for tickets 2+, distinct from the buyer's full_name
  attendee_instagram text,
  referral_code text
);

-- Safe to re-run: adds the group-order columns if this schema was applied
-- before they existed (create table if not exists above is a no-op once
-- the table already exists, so it won't backfill new columns on its own).
alter table tickets add column if not exists order_id uuid;
alter table tickets add column if not exists attendee_name text;
alter table tickets add column if not exists attendee_instagram text;
alter table tickets add column if not exists referral_code text;

create index if not exists tickets_status_idx on tickets(status);
create index if not exists tickets_code_idx on tickets(ticket_code);
create index if not exists tickets_order_id_idx on tickets(order_id);
create index if not exists tickets_referral_code_idx on tickets(referral_code);

-- People who aren't ready to buy yet but want updates.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text,
  instagram_handle text
);

-- Created the moment someone submits the "Apply for Entry" modal, before
-- payment. Lets us capture group/attendee details up front, recover
-- abandoned applications, and tie a completed Stripe session back to the
-- full group via client_reference_id.
create table if not exists pending_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  buyer_instagram text,
  attendees jsonb, -- array of { name, instagram } for tickets 2+, instagram may be null
  quantity int not null,
  age_confirmed boolean not null default false,
  referral_code text,
  -- 'pending' | 'completed' | 'superseded' | 'ticket_creation_failed' (payment
  -- succeeded and Stripe confirmed it, but the webhook couldn't insert the
  -- ticket row(s) afterward — see reconciliation_note, needs manual fixup)
  status text not null default 'pending',
  reconciliation_note text
);

-- Safe to re-run: adds the reconciliation column if this schema was applied
-- before it existed.
alter table pending_orders add column if not exists reconciliation_note text;

create index if not exists pending_orders_status_idx on pending_orders(status);

create table if not exists affiliate_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text unique not null,
  promoter_name text not null,
  discount_percent int not null default 0, -- e.g. 10 means 10% off
  active boolean not null default true
);

create index if not exists affiliate_codes_code_idx on affiliate_codes(code);

create table if not exists affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null
);

create index if not exists affiliate_clicks_code_idx on affiliate_clicks(code);

-- Admin-editable event details (name, date, price, capacity, etc). Replaces
-- the old hardcoded lib/eventConfig.js — this table holds exactly one row,
-- the current live settings, edited from /admin/settings. Every place that
-- used to import a static EVENT object now reads this row instead.
create table if not exists event_settings (
  id uuid primary key default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  name text not null,
  subtitle text not null,
  date_iso timestamptz not null,
  date_display text not null,
  boarding_time text not null,
  depart_location text not null,
  price_aud int not null,
  capacity int not null,
  instagram_handle text
);

-- Seed the single live row with the site's current values, but only if the
-- table is empty — safe to re-run without duplicating or resetting an
-- already-configured row.
insert into event_settings (
  name, subtitle, date_iso, date_display, boarding_time,
  depart_location, price_aud, capacity, instagram_handle
)
select
  'Syvete', 'Spirit of Broome — Swan River', '2026-09-26T17:00:00+08:00',
  'Saturday 26 September 2026', '5:00 PM',
  'Pier 1, Barrack Street Jetty, Perth', 200, 150, '@syvete'
where not exists (select 1 from event_settings);
