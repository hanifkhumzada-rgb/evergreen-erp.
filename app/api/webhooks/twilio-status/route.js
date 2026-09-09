import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Twilio's status-callback — the ONLY place a notification_logs row is
// ever allowed to move to 'delivered' (or to 'failed' after having been
// 'sent'), because it's the only place an actual delivery confirmation
// from Twilio arrives. App code sending a message only ever sets 'sent'
// (Twilio's synchronous accept) or 'failed' (Twilio rejected it, or isn't
// configured) — never 'delivered' on its own.
//
// Configure this URL as the StatusCallback on the Twilio number, or point
// NEXT_PUBLIC_APP_URL at the deployed origin so lib/notifications.js
// passes it automatically on every send. NOT protected by CRON_SECRET —
// Twilio signs its own webhook requests (X-Twilio-Signature) instead;
// this route does not currently verify that signature (would need
// TWILIO_AUTH_TOKEN to compute it), so treat this as UNTESTED against a
// real Twilio callback until that's added and verified against a live
// account.
const TWILIO_STATUS_MAP = { delivered: "delivered", read: "delivered", undelivered: "failed", failed: "failed" };

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  if (!form) return new NextResponse("Bad request", { status: 400 });

  const messageSid = form.get("MessageSid") || form.get("SmsSid");
  const twilioStatus = (form.get("MessageStatus") || "").toLowerCase();
  const errorMessage = form.get("ErrorMessage") || (form.get("ErrorCode") ? `Twilio error ${form.get("ErrorCode")}` : null);
  if (!messageSid) return new NextResponse("Missing MessageSid", { status: 400 });

  const mapped = TWILIO_STATUS_MAP[twilioStatus];
  if (!mapped) return NextResponse.json({ ok: true, ignored: twilioStatus }); // queued/sending/accepted — no log change needed

  const supabase = createAdminClient();
  const { error } = await supabase.from("notification_logs")
    .update({ status: mapped, error_message: mapped === "failed" ? errorMessage : null, updated_at: new Date().toISOString() })
    .eq("provider_message_sid", messageSid);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
