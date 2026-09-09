import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computeBusinessHealthSummary, computeDailyOwnerBrief } from "@/app/actions";

// Phase 10 automation — "daily owner summary", extended (Phase 2 of the
// automation/notification work) with a facts-first Morning Brief:
// today's deliveries/sales/collection/due-today/overdue/new-customers,
// plus a short plain-language read-out (weak zone, at-risk-of-inactive
// count, sales vs normal) in the same rule-based Evergreen AI style as
// every other on-demand answer — computed facts only, never a model call,
// never writes anything back. Business Health Score stays first in the
// message since it's the one figure with a 0-100 band at a glance; the
// Morning Brief follows with the same-day operational detail the score
// doesn't carry.
//
// Now loops every business (previously assumed a single one, same gap
// recurring-orders already avoided) — computeDailyOwnerBrief is scoped by
// business_id throughout (every table it queries has the column). Note:
// computeBusinessHealthSummary itself is NOT business-scoped — it reads
// v_customer_balance, which has no business_id column to filter on, so it
// stays a global aggregate here (harmless today with one business; if a
// second business is added, give that view a business_id first).
//
// Still just an endpoint: point a Vercel Cron entry (or any external
// scheduler) at GET /api/cron/daily-summary with a `?secret=` query param
// (or `Authorization: Bearer` header) matching CRON_SECRET, which must be
// set for this route to do anything.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not configured", { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const { data: businesses, error: bizError } = await supabase.from("businesses").select("id");
  if (bizError) return NextResponse.json({ ok: false, error: bizError.message }, { status: 500 });

  const results = [];
  for (const business of businesses || []) {
    const [{ text: healthText }, { text: briefText }] = await Promise.all([
      computeBusinessHealthSummary(supabase),
      computeDailyOwnerBrief(supabase, business.id),
    ]);

    const { error } = await supabase.from("notifications").insert({
      severity: "info",
      title: "Daily Business Summary",
      message: `${healthText} ${briefText}`,
      business_id: business.id,
    });
    results.push({ business_id: business.id, ok: !error, error: error?.message });
  }

  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results });
}
