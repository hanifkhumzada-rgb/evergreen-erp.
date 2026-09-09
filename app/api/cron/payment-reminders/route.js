import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/notifications";

// Same due-date heuristic as the Payments/Recovery page (last payment +
// the customer's frequency interval) — kept identical on purpose so a
// customer the reminder job contacts is exactly one the Owner would also
// see in the Due Today / Overdue buckets, never a second disagreeing
// definition of "due".
const FREQ_DAYS = { Daily: 1, Weekly: 7, Monthly: 30, Custom: 30 };

function currentHourInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "Asia/Karachi", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === "hour")?.value;
  return hourPart ? Number(hourPart) % 24 : new Date().getUTCHours();
}

function inQuietHours(hour, start, end) {
  if (start === end) return false;
  // Wraps past midnight when start > end (e.g. 21 -> 8).
  return start > end ? (hour >= start || hour < end) : (hour >= start && hour < end);
}

// Recurring Payment Reminders — respects each customer's payment
// frequency (due-date heuristic above), the Automation Center's
// payment_reminders row (enabled, threshold_value = days before due to
// start reminding, max_reminders, quiet_hours_start/end), and sends at
// most once per customer per calendar day (checked against the
// payment_reminders table before sending) so a cron that fires more than
// once a day — or is manually re-triggered — never double-reminds.
//
// Same auth pattern as every other cron route: `?secret=` or
// `Authorization: Bearer` matching CRON_SECRET.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not configured", { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const { data: businesses, error: bizError } = await supabase.from("businesses").select("id, timezone");
  if (bizError) return NextResponse.json({ ok: false, error: bizError.message }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const business of businesses || []) {
    const { data: rule } = await supabase.from("automation_rules")
      .select("enabled, threshold_value, max_reminders, quiet_hours_start, quiet_hours_end, channel_whatsapp, channel_sms")
      .eq("business_id", business.id).eq("key", "payment_reminders").maybeSingle();
    if (!rule || !rule.enabled) { results.push({ business_id: business.id, skipped: "disabled" }); continue; }

    const hour = currentHourInTimezone(business.timezone);
    if (inQuietHours(hour, rule.quiet_hours_start ?? 21, rule.quiet_hours_end ?? 8)) {
      results.push({ business_id: business.id, skipped: "quiet_hours" });
      continue;
    }

    const [{ data: balances }, { data: customersMeta }, { data: allPayments }] = await Promise.all([
      supabase.from("v_customer_balance").select("customer_id, name, balance"),
      supabase.from("customers").select("id, payment_frequency, mobile, whatsapp_number, business_id").eq("business_id", business.id),
      supabase.from("payments").select("customer_id, payment_date").eq("business_id", business.id).eq("voided", false).order("payment_date", { ascending: false }),
    ]);
    const customerIds = new Set((customersMeta || []).map((c) => c.id));
    const lastPaymentMap = {};
    (allPayments || []).forEach((p) => { if (!lastPaymentMap[p.customer_id]) lastPaymentMap[p.customer_id] = p.payment_date; });
    const freqMap = {};
    (customersMeta || []).forEach((c) => { freqMap[c.id] = c.payment_frequency || "Monthly"; });

    const dueOrOverdue = (balances || []).filter((b) => {
      if (!customerIds.has(b.customer_id) || Number(b.balance) <= 0) return false;
      const last = lastPaymentMap[b.customer_id];
      if (!last) return true; // never paid + has a balance = already due
      const freq = freqMap[b.customer_id] || "Monthly";
      const dueDate = new Date(new Date(last).getTime() + (FREQ_DAYS[freq] || 30) * 86400000);
      const leadDays = Number(rule.threshold_value) || 3;
      const remindFrom = new Date(dueDate.getTime() - leadDays * 86400000);
      return new Date() >= remindFrom;
    });

    let sent = 0, skippedToday = 0, skippedMax = 0, failed = 0;
    for (const b of dueOrOverdue) {
      const { data: sentToday } = await supabase.from("payment_reminders")
        .select("id").eq("customer_id", b.customer_id).gte("sent_at", `${today}T00:00:00`).limit(1).maybeSingle();
      if (sentToday) { skippedToday++; continue; }

      const since = lastPaymentMap[b.customer_id] || null;
      let countQuery = supabase.from("payment_reminders").select("id", { count: "exact", head: true }).eq("customer_id", b.customer_id);
      countQuery = since ? countQuery.gte("sent_at", `${since}T00:00:00`) : countQuery;
      const { count: reminderCount } = await countQuery;
      if ((reminderCount || 0) >= (rule.max_reminders || 3)) { skippedMax++; continue; }

      const channel = rule.channel_whatsapp ? "whatsapp" : rule.channel_sms ? "sms" : null;
      if (!channel) continue;

      const result = await sendNotification({
        supabase, businessId: business.id, customerId: b.customer_id, templateKey: "payment_reminder",
        variables: { customer_name: b.name, amount: Math.round(Number(b.balance)).toLocaleString("en-PK") },
        channel, automationKey: "payment_reminders",
      });
      if (result.ok) {
        sent++;
        await supabase.from("payment_reminders").insert({ business_id: business.id, customer_id: b.customer_id, channel, sent_at: new Date().toISOString() });
      } else if (!result.skipped) {
        failed++;
      }
    }
    results.push({ business_id: business.id, due: dueOrOverdue.length, sent, skippedToday, skippedMax, failed });
  }

  return NextResponse.json({ ok: true, date: today, results });
}
