// Plain REST call, no SDK needed — see
// https://core.telegram.org/bots/api#sendmessage
const TELEGRAM_API_BASE = "https://api.telegram.org";

function formatPerthDateTime(date) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Australia/Perth",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

// TELEGRAM_CHAT_ID is a comma-separated list (e.g. "123,456") so the alert
// can go to more than one person — sent to each individually, one fetch
// call per recipient, so one bad/blocked chat id can't stop the rest.
function getChatIds() {
  return (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function sendToChatId(token, chatId, text) {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
}

// Fire-and-forget safe, same contract as lib/mailer.js — never throws. A
// broken bot token/chat id or a Telegram outage is caught and logged, never
// allowed to block the ticket creation that triggered it. Each recipient is
// sent to independently — one failing doesn't stop the others.
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = getChatIds();

  if (!token || chatIds.length === 0) {
    console.error("telegram notify failed", {
      error: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured",
    });
    return;
  }

  for (const chatId of chatIds) {
    try {
      await sendToChatId(token, chatId, text);
    } catch (err) {
      console.error("telegram notify failed", { chatId, error: err.message });
    }
  }
}

// Sent from the webhook the instant a new order's tickets are created —
// same trigger point as the buyer's "Payment Received" email, in addition
// to it, not instead of it.
export async function sendNewOrderTelegramAlert({
  buyerName,
  quantity,
  totalPaidCents,
  referralCode,
}) {
  try {
    const dollars = Math.round((totalPaidCents || 0) / 100);
    const ticketWord = quantity === 1 ? "ticket" : "tickets";
    const when = formatPerthDateTime(new Date());
    const text = [
      `NEW ORDER: ${when}`,
      `NAME: ${buyerName}`,
      `AMOUNT: ${quantity} ${ticketWord}`,
      `PAID: $${dollars}`,
      // Always present, even blank — never "None"/"N/A", so a quick glance
      // at the chat can tell "no code" apart from "field omitted".
      `CODE: ${referralCode || ""}`,
    ].join("\n");
    await sendTelegramMessage(text);
  } catch (err) {
    console.error("telegram notify failed", { error: err.message });
  }
}
