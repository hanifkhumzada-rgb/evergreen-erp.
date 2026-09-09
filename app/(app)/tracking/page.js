import { createClient } from "@/lib/supabase/server";
import LiveTrackingMap from "@/components/LiveTrackingMap";

export const dynamic = "force-dynamic";

// Live GPS staff tracking — current-location only (no route history, no
// trip replay). Generalized from riders-only to every staff role
// (Owner/Admin/Manager/Accountant/Rider): each reports their position
// from StaffLocationTracker (mounted globally in app/(app)/layout.js)
// whenever they have the app open — riders are no longer conditioned on
// having an active delivery route either. This page shows the
// Owner/Admin/Manager (unchanged — still gated on gps.view) where each
// staff member was most recently, live-updating via Supabase Realtime
// rather than a manual refresh.
export default async function TrackingPage() {
  const supabase = await createClient();

  const [{ data: staff }, { data: locations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles!inner(key, name)").neq("roles.key", "customer").eq("is_active", true).order("full_name"),
    // Most recent row first per person — reduced to one-per-person below.
    // RLS (gps.view) already scopes this to the caller's own business.
    supabase.from("staff_locations").select("user_id, latitude, longitude, recorded_at").order("recorded_at", { ascending: false }),
  ]);

  const latestByUser = {};
  (locations || []).forEach((l) => { if (!latestByUser[l.user_id]) latestByUser[l.user_id] = l; });

  const staffRows = (staff || []).map((s) => ({
    id: s.id,
    name: s.full_name,
    role: s.roles?.name || s.roles?.key,
    location: latestByUser[s.id] || null,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Live Tracking</h2>
      <p className="text-sm text-slate mb-4">Current position of every logged-in staff member (Owner/Admin/Manager/Accountant/Rider) with the app open. Updates live — no need to refresh.</p>
      <LiveTrackingMap riders={staffRows} />
    </div>
  );
}
