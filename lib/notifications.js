import { sendTwilioMessage, renderTemplate, isTwilioConfigured } from "@/lib/twilio";

// The one place every automated WhatsApp/SMS send goes through — templates,
// idempotency, Twilio, and the notification_logs row are all handled here
// so no caller (delivery completion, payment recording, the reminder cron,
// the Owner-alerts bridge) has to reimplement any of it. Never throws: a
// notification failure must never fail or roll back the caller's actual
// transaction, so every path returns a result object instead.
//
// `automationKey`, when given, is one of the Automation Center's
// communication rows (payment_reminders/delivery_messages/payment_receipts/
// monthly_statements/customer_followup/owner_alerts) — its enabled flag and
// channel_whatsapp/channel_sms toggles gate whether this sends at all, and
// its last_run_at/success_count/failed_count are updated with the result,
// which is what the Automation Center's Last Run/Success/Failed columns
// actually reflect. Omit it for a send with no matching automation row
// (feedback_request/issue_update/general_announcement, all Phase 4-
// triggered from the customer portal, not a scheduled automation).
export async function sendNotification({
  supabase, businessId, customerId, templateKey, variables = {},
  channel, relatedType = null, relatedId = null, automationKey = null, toNumberOverride = null,
}) {
  let effectiveChannel = channel;
  if (automationKey) {
    const { data: rule } = await supabase.from("automation_rules")
      .select("id, enabled, channel_whatsapp, channel_sms")
      .eq("business_id", businessId).eq("key", automationKey).maybeSingle();
    if (!rule || !rule.enabled) return { skipped: true, reason: "automation_disabled" };
    if (!effectiveChannel) effectiveChannel = rule.channel_whatsapp ? "whatsapp" : rule.channel_sms ? "sms" : null;
    if (!effectiveChannel) return { skipped: true, reason: "no_channel_enabled" };
  }
  effectiveChannel = effectiveChannel || "whatsapp";

  const { data: template } = await supabase.from("notification_templates")
    .select("body_template, enabled").eq("business_id", businessId).eq("key", templateKey).maybeSingle();
  if (!template || !template.enabled) return { skipped: true, reason: "template_missing_or_disabled" };

  const { data: customer } = customerId && !toNumberOverride
    ? await supabase.from("customers").select("mobile, whatsapp_number").eq("id", customerId).maybeSingle()
    : { data: null };
  // toNumberOverride is for the two Owner-facing pushes (daily_summary,
  // owner_alerts) — there's no "customer" row to look a phone number up
  // from, just the Owner's own contact number from Business Branding.
  const toNumber = toNumberOverride || (effectiveChannel === "whatsapp" ? (customer?.whatsapp_number || customer?.mobile) : customer?.mobile);
  if (!toNumber) return { skipped: true, reason: "no_phone_number" };

  const messageBody = renderTemplate(template.body_template, variables);

  // Idempotency: the (business, related_type, related_id, template_key)
  // unique index (migration 0031) rejects a second row for the same
  // event+template — a double-click/retry on the delivery/payment save
  // hits this constraint and is treated as "already handled", not an
  // error, rather than sending twice.
  const { data: logRow, error: insertErr } = await supabase.from("notification_logs").insert({
    business_id: businessId, customer_id: customerId, template_key: templateKey,
    channel: effectiveChannel, to_number: toNumber, message_body: messageBody,
    status: "pending", related_type: relatedType, related_id: relatedId,
  }).select("id").single();

  if (insertErr) {
    if (insertErr.code === "23505") return { skipped: true, reason: "duplicate" };
    return { ok: false, error: insertErr.message };
  }

  if (!isTwilioConfigured()) {
    await supabase.from("notification_logs").update({ status: "failed", error_message: "Twilio credentials not configured.", updated_at: new Date().toISOString() }).eq("id", logRow.id);
    if (automationKey) await bumpAutomationCounters(supabase, businessId, automationKey, false);
    return { ok: false, error: "Twilio not configured" };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const statusCallbackUrl = base ? `${base}/api/webhooks/twilio-status` : undefined;
  const result = await sendTwilioMessage({ channel: effectiveChannel, toNumber, body: messageBody, statusCallbackUrl });

  await supabase.from("notification_logs").update({
    status: result.ok ? "sent" : "failed",
    provider_message_sid: result.sid || null,
    error_message: result.ok ? null : result.error,
    sent_at: result.ok ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", logRow.id);

  if (automationKey) await bumpAutomationCounters(supabase, businessId, automationKey, result.ok);
  return result.ok ? { ok: true, sid: result.sid } : { ok: false, error: result.error };
}

async function bumpAutomationCounters(supabase, businessId, automationKey, success) {
  const { data: rule } = await supabase.from("automation_rules").select("success_count, failed_count")
    .eq("business_id", businessId).eq("key", automationKey).maybeSingle();
  if (!rule) return;
  await supabase.from("automation_rules").update({
    last_run_at: new Date().toISOString(),
    success_count: (rule.success_count || 0) + (success ? 1 : 0),
    failed_count: (rule.failed_count || 0) + (success ? 0 : 1),
  }).eq("business_id", businessId).eq("key", automationKey);
}

// Manual retry (Communication Center's Retry button) — reuses the exact
// same send path, just re-fetches the already-rendered message_body from
// the existing log row instead of re-rendering the template (the
// customer's balance etc. may have changed since; a retry resends what
// was originally queued, not a freshly recomputed message).
export async function retryNotification({ supabase, logId }) {
  const { data: log } = await supabase.from("notification_logs").select("*").eq("id", logId).maybeSingle();
  if (!log) return { ok: false, error: "Notification not found." };
  if (!isTwilioConfigured()) {
    await supabase.from("notification_logs").update({ error_message: "Twilio credentials not configured.", updated_at: new Date().toISOString() }).eq("id", logId);
    return { ok: false, error: "Twilio not configured" };
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const statusCallbackUrl = base ? `${base}/api/webhooks/twilio-status` : undefined;
  const result = await sendTwilioMessage({ channel: log.channel, toNumber: log.to_number, body: log.message_body, statusCallbackUrl });
  await supabase.from("notification_logs").update({
    status: result.ok ? "sent" : "failed",
    provider_message_sid: result.sid || log.provider_message_sid,
    error_message: result.ok ? null : result.error,
    sent_at: result.ok ? new Date().toISOString() : log.sent_at,
    attempt_count: (log.attempt_count || 1) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", logId);
  return result;
}
