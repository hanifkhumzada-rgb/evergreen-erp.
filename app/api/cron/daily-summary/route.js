import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computeBusinessHealthSummary } from "@/app/actions";

// Phase 10 automation — "daily owner summary". This route computes the
// same Business Health Score + summary the AI page answers on-demand and
// stores it as a notification (severity "info"), so it shows up in
// Notifications for every owner/manager without them having to ask.
//
// It does nothing on its own: something has to call it once a day. This
// sandbox has no way to verify a scheduler is actually wired up, so this
// is the endpoint, not a working cron job — point a Vercel Cron entry
// (or any external scheduler) at GET /api/cron/daily-summary with a
// `?secret=` query param (or `Authorization: Bearer` header) matching the
// CRON_SECRET environment variable, which must be set for this route to
// do anything; without it configured, every request is rejected.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new NextResponse("CRON_SECRET is not configured", { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = createAdminClient();
  const { text } = await computeBusinessHealthSummary(supabase);

  const { error } = await supabase.from("notifications").insert({
    severity: "info",
    title: "Daily Business Summary",
    message: text,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
