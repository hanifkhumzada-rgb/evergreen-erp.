// Twilio integration — plain REST calls over fetch (no twilio npm SDK,
// same "don't add a dependency for this" economy the rest of the app
// follows). Credentials are environment variables ONLY, per the brief:
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (SMS),
// TWILIO_WHATSAPP_NUMBER (WhatsApp) — never read from the database, never
// sent to the client. isTwilioConfigured() is safe to call from a Server
// Component; it only returns a boolean, never the values themselves.
export function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export function twilioConfigStatus() {
  return {
    TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: Boolean(process.env.TWILIO_AUTH_TOKEN),
    TWILIO_PHONE_NUMBER: Boolean(process.env.TWILIO_PHONE_NUMBER),
    TWILIO_WHATSAPP_NUMBER: Boolean(process.env.TWILIO_WHATSAPP_NUMBER),
  };
}

// {{placeholder}} substitution — deliberately not a templating library,
// just the exact minimal thing eight fixed templates need. Any
// placeholder with no matching variable is left as an empty string
// rather than leaking "{{unknown}}" into a real customer message.
export function renderTemplate(bodyTemplate, variables = {}) {
  return bodyTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => (variables[key] != null ? String(variables[key]) : ""));
}

// Same normalizePhone rule as components/WhatsAppButton.js — Pakistani
// local numbers (03001234567) become international (923001234567) with
// no leading zero; already-international numbers pass through.
export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

// One real HTTP call to Twilio's Messages API. Returns { ok, sid, error }
// — never throws, so a caller can always write a notification_logs row
// from the result without wrapping this in its own try/catch. `ok: true`
// means Twilio's synchronous response (HTTP 201) confirmed it accepted
// the message — the definition of "sent" this whole integration uses.
// That is NOT "delivered": delivery confirmation only ever arrives later,
// asynchronously, via the status-callback webhook
// (app/api/webhooks/twilio-status/route.js) updating the same log row.
export async function sendTwilioMessage({ channel, toNumber, body, statusCallbackUrl }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return { ok: false, error: "Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)." };
  }
  const fromRaw = channel === "whatsapp" ? process.env.TWILIO_WHATSAPP_NUMBER : process.env.TWILIO_PHONE_NUMBER;
  if (!fromRaw) {
    return { ok: false, error: `${channel === "whatsapp" ? "TWILIO_WHATSAPP_NUMBER" : "TWILIO_PHONE_NUMBER"} not configured.` };
  }
  const normalized = normalizePhone(toNumber);
  if (!normalized) return { ok: false, error: "No valid destination phone number." };

  const to = channel === "whatsapp" ? `whatsapp:+${normalized}` : `+${normalized}`;
  const from = channel === "whatsapp" ? (fromRaw.startsWith("whatsapp:") ? fromRaw : `whatsapp:${fromRaw}`) : fromRaw;

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  if (statusCallbackUrl) params.set("StatusCallback", statusCallbackUrl);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: data?.message || `Twilio returned HTTP ${res.status}`, providerStatus: data?.status };
    }
    return { ok: true, sid: data?.sid, providerStatus: data?.status };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error calling Twilio." };
  }
}
