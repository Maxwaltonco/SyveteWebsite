import nodemailer from "nodemailer";
import { getEventSettings } from "./eventConfig";

// Every exported send*Email function below is fire-and-forget safe: it
// never throws. A failed send is caught, logged with context, and
// swallowed so it can never block the database operation (ticket
// creation, approval, refund) that triggered it. Callers don't need their
// own try/catch around these calls.

// New transporter per send rather than a module-level singleton — same
// reasoning as getStripe()/getSupabaseAdmin(): reading GMAIL_USER /
// GMAIL_APP_PASSWORD fresh on every call avoids a serverless cold-start
// caching a client built before the real env vars were available.
function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function formatHandle(raw) {
  return `@${(raw || "").trim().replace(/^@/, "")}`;
}

function formatTicketSection(ticketCodes) {
  const codes = ticketCodes.filter(Boolean);
  if (codes.length <= 1) {
    return `Ticket: ${codes[0] || ""}`;
  }
  return `Tickets (${codes.length}): ${codes.join(", ")}`;
}

function formatDollars(cents) {
  return `$${Math.round((cents || 0) / 100)}`;
}

// Plain, minimal styling matching the site — black text, white background,
// no template chrome. `paragraphs` is an array of blocks; a block can
// itself contain a single "\n" to put two lines together without a full
// blank-line paragraph break (e.g. "Ticket: X" directly above "Paid: $Y").
function toHtml(paragraphs) {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;">${p
          .split("\n")
          .join("<br>")}</p>`
    )
    .join("");
  return `<div style="background:#ffffff;color:#000000;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;max-width:480px;margin:0;padding:0;">${body}</div>`;
}

function toText(paragraphs) {
  return paragraphs.join("\n\n");
}

async function sendMail({ to, subject, paragraphs, context }) {
  try {
    if (!to) {
      throw new Error("no recipient email address");
    }
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Syvete" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: toHtml(paragraphs),
      text: toText(paragraphs),
    });
  } catch (err) {
    console.error("email send failed", {
      ...context,
      to,
      error: err.message,
    });
  }
}

// Email 1 — sent from the webhook once all ticket rows for an order are
// created. One email per order, regardless of quantity.
export async function sendPaymentReceivedEmail({
  orderId,
  buyerEmail,
  ticketCodes,
  totalPaidCents,
}) {
  try {
    const EVENT = await getEventSettings();
    const paragraphs = [
      "Payment received. Applications are reviewed before confirmation.",
      "You'll hear from us within 7 days, so please keep an eye on your inbox.",
      EVENT.dateDisplay,
      `${formatTicketSection(ticketCodes)}\nPaid: ${formatDollars(totalPaidCents)}`,
      "Any questions? Just reply to this email.",
      `Follow ${formatHandle(EVENT.instagramHandle)} for updates.`,
    ];
    await sendMail({
      to: buyerEmail,
      subject: "Payment Received",
      paragraphs,
      context: { orderId, emailType: "payment_received" },
    });
  } catch (err) {
    console.error("email send failed", {
      orderId,
      emailType: "payment_received",
      error: err.message,
    });
  }
}

// Email 2 — sent from the admin approve route once every ticket sharing an
// order_id is approved (including single-ticket orders).
export async function sendSpotConfirmedEmail({
  orderId,
  buyerEmail,
  ticketCodes,
}) {
  try {
    const EVENT = await getEventSettings();
    const paragraphs = [
      "You're on the guestlist. Tickets will be sent out a few days before the event, so stay tuned.",
      `${EVENT.dateDisplay}, boarding ${EVENT.boardingTime} sharp\n${EVENT.departLocation}`,
      "A DJ and videographer will be on board. Drinks are available for purchase on the day. Bring swimwear and a towel.",
      formatTicketSection(ticketCodes),
      "Photo ID is checked before boarding. ID must match the name on your ticket. No refund will be issued if you're found to be under 18.",
      `Follow ${formatHandle(EVENT.instagramHandle)} for updates.`,
    ];
    await sendMail({
      to: buyerEmail,
      subject: "Your Spot's Confirmed",
      paragraphs,
      context: { orderId, emailType: "spot_confirmed" },
    });
  } catch (err) {
    console.error("email send failed", {
      orderId,
      emailType: "spot_confirmed",
      error: err.message,
    });
  }
}

// Email 3 — sent from the admin revoke route, "Revoke + refund" only.
// Per-ticket, not per-order: this is about the specific person refunded,
// not the rest of their group.
export async function sendApplicationRefundedEmail({ ticketId, buyerEmail }) {
  try {
    const EVENT = await getEventSettings();
    const paragraphs = [
      "Unfortunately, we're not able to confirm your spot for this one.",
      "You've been refunded in full. Please allow 5 to 10 business days for the transaction to appear.",
      `Follow ${formatHandle(EVENT.instagramHandle)} for future events.`,
    ];
    await sendMail({
      to: buyerEmail,
      subject: "Application Refunded",
      paragraphs,
      context: { ticketId, emailType: "application_refunded" },
    });
  } catch (err) {
    console.error("email send failed", {
      ticketId,
      emailType: "application_refunded",
      error: err.message,
    });
  }
}
