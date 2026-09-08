import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function genCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// A customer is due today if they're on a daily schedule, or their
// preferred_days (set at signup / bulk import) includes today — mirrors
// isDueToday() in app/(app)/deliveries/page.js, EXCEPT it deliberately
// does not fall back to "no preferred_days set = due every day" the way
// that page does for its own display purposes. That fallback exists so
// customers imported before this schedule field existed still show up on
// the manual Today's Deliveries board; auto-creating a real delivery record
// for every such customer, every single day, would be a much bigger and
// riskier behavior change than "automate the customers who already have a
// real schedule configured" — which is what was actually asked for.
function isDueToday(c, todayAbbr) {
  if (c.delivery_frequency === "daily") return true;
  return Array.isArray(c.preferred_days) && c.preferred_days.includes(todayAbbr);
}

// Recurring/subscription order automation — each morning, creates a
// "pending" deliveries + delivery_items row (the same shape a rider would
// otherwise have to add by hand) for every customer whose recurring
// schedule says they're due today, using their regular_qty and
// default_product_id. Nothing about the manual workflow changes: a rider
// completing one of these via DeliverSheet/OneTapDeliverButton reuses this
// same row (see createDelivery in app/actions.js) rather than creating a
// second one, and Today's Deliveries already treats a "pending" row exactly
// like "no row yet" — same cards, same actions.
//
// Same auth pattern as /api/cron/daily-summary: point a scheduler at this
// URL once a day (e.g. 6am) with a `?secret=` query param or
// `Authorization: Bearer` header matching CRON_SECRET.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not configured", { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  // Same expression app/(app)/deliveries/page.js uses for its own
  // preferred_days matching — kept identical on purpose so "due today"
  // never disagrees between what the cron creates and what the board shows.
  const todayAbbr = new Date().toLocaleDateString("en-US", { weekday: "short" });

  const { data: businesses, error: bizError } = await supabase.from("businesses").select("id");
  if (bizError) return NextResponse.json({ ok: false, error: bizError.message }, { status: 500 });

  let created = 0;
  let skippedExisting = 0;
  let skippedError = 0;
  const perBusiness = [];

  for (const business of businesses || []) {
    // Service-role client bypasses RLS entirely (and the business_id
    // auto-fill trigger, which needs a real user session) — every insert
    // below stamps business_id explicitly, scoped to this one business's
    // customers, so recurring orders never cross tenant lines.
    const { data: customers } = await supabase.from("customers")
      .select("id, regular_qty, default_product_id, assigned_rider_id, preferred_days, delivery_frequency")
      .eq("business_id", business.id)
      .eq("recurring_status", "active")
      .eq("is_active", true)
      // Same "active enough to show up" set app/(app)/deliveries/page.js's
      // activeCustomers filter uses, kept identical on purpose.
      .neq("status", "inactive")
      .neq("status", "blacklisted")
      .gt("regular_qty", 0)
      .not("default_product_id", "is", null);

    const dueToday = (customers || []).filter((c) => isDueToday(c, todayAbbr));
    if (dueToday.length === 0) { perBusiness.push({ business_id: business.id, due: 0, created: 0 }); continue; }

    // Idempotency: one query for every customer already having ANY delivery
    // row today in this business, not one query per customer — also what
    // makes a second same-day cron run a no-op instead of a duplicate.
    const { data: existingToday } = await supabase.from("deliveries")
      .select("customer_id").eq("business_id", business.id).eq("delivery_date", today);
    const alreadyHasDelivery = new Set((existingToday || []).map((d) => d.customer_id));

    let bizCreated = 0;
    for (const c of dueToday) {
      if (alreadyHasDelivery.has(c.id)) { skippedExisting++; continue; }

      const qty = Number(c.regular_qty);
      // Rate resolution is intentionally skipped here — the Today's
      // Deliveries board already computes the customer's effective rate
      // itself for display (customer_prices/product_prices, not
      // deliveries.amount), and createDelivery resolves the real rate
      // again when this placeholder is actually completed. A 0 here is
      // never shown as a real price anywhere.
      const { data: delivery, error: delErr } = await supabase.from("deliveries").insert({
        delivery_no: genCode("DEL"),
        customer_id: c.id,
        rider_id: c.assigned_rider_id || null,
        delivery_date: today,
        status: "pending",
        amount: 0,
        amount_collected: 0,
        business_id: business.id,
      }).select("id").single();
      if (delErr || !delivery) { skippedError++; continue; }

      await supabase.from("delivery_items").insert({
        delivery_id: delivery.id, product_id: c.default_product_id,
        expected_qty: qty, delivered_qty: 0, returned_qty: 0, unit_price: 0,
        business_id: business.id,
      });
      created++;
      bizCreated++;
    }
    perBusiness.push({ business_id: business.id, due: dueToday.length, created: bizCreated });
  }

  return NextResponse.json({ ok: true, date: today, day: todayAbbr, created, skippedExisting, skippedError, perBusiness });
}
