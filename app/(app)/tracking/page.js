import { createClient } from "@/lib/supabase/server";
import LiveTrackingMap from "@/components/LiveTrackingMap";

export const dynamic = "force-dynamic";

// Live GPS rider tracking — current-location only (no route history, no
// trip replay). Riders report their position from RiderLocationTracker
// (components/RiderLocationTracker.js) while they have an active route
// open; this page shows the Owner/Admin/Manager where each of them was
// most recently, live-updating via Supabase Realtime rather than a
// manual refresh.
export default async function TrackingPage() {
  const supabase = await createClient();

  const [{ data: riders }, { data: locations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    // Most recent row first per rider — reduced to one-per-rider below.
    // RLS (gps.view) already scopes this to the caller's own business.
    supabase.from("rider_locations").select("rider_id, latitude, longitude, recorded_at").order("recorded_at", { ascending: false }),
  ]);

  const latestByRider = {};
  (locations || []).forEach((l) => { if (!latestByRider[l.rider_id]) latestByRider[l.rider_id] = l; });

  const riderRows = (riders || []).map((r) => ({
    id: r.id,
    name: r.full_name,
    location: latestByRider[r.id] || null,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Live Tracking</h2>
      <p className="text-sm text-slate mb-4">Current position of riders who are out on an active delivery route. Updates live — no need to refresh.</p>
      <LiveTrackingMap riders={riderRows} />
    </div>
  );
}
