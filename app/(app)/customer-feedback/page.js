import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { KPI, Badge } from "@/components/ui";
import { RatingTrendChart } from "@/components/LazyCharts";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} className={i <= n ? "fill-amber text-amber" : "text-line"} />)}
    </div>
  );
}

export default async function CustomerFeedbackPage() {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "deliveries.edit" });

  if (!allowed) {
    return <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Customer feedback is visible to delivery-authorized staff.</p>;
  }

  const { data: feedback } = await supabase.from("customer_feedback")
    .select("*, customers(name, code), profiles(full_name)").order("created_at", { ascending: false }).limit(300);

  const rows = feedback || [];
  const avgOverall = rows.length ? rows.reduce((s, f) => s + f.overall_rating, 0) / rows.length : 0;
  const lowRatings = rows.filter((f) => f.overall_rating <= 2);
  const recent = rows.slice(0, 10);

  // Delivery-boy ratings — average delivery_rating per rider, riders with
  // at least one rated delivery only.
  const byRider = {};
  rows.forEach((f) => {
    if (!f.rider_id || !f.delivery_rating) return;
    (byRider[f.rider_id] ||= { name: f.profiles?.full_name || "Unknown", sum: 0, count: 0 }).sum += f.delivery_rating;
    byRider[f.rider_id].count += 1;
  });
  const riderRatings = Object.values(byRider).map((r) => ({ ...r, avg: r.sum / r.count })).sort((a, b) => b.avg - a.avg);

  // Satisfaction trend — average overall rating per ISO week, oldest to
  // newest, last 12 weeks of activity.
  const byWeek = {};
  rows.forEach((f) => {
    const d = new Date(f.created_at);
    const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    (byWeek[key] ||= { sum: 0, count: 0 }).sum += f.overall_rating;
    byWeek[key].count += 1;
  });
  const trend = Object.entries(byWeek).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
    .map(([week, { sum, count }]) => ({ week: fmtDate(week), avgRating: Number((sum / count).toFixed(2)) }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customer Feedback</h2>
      <div className="flex flex-wrap gap-3 mb-5">
        <KPI label="Average Rating" value={`${avgOverall.toFixed(1)} ★`} tone="amber" />
        <KPI label="Total Feedback" value={rows.length} tone="navy" />
        <KPI label="Low Ratings (≤2★)" value={lowRatings.length} tone="coral" />
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 mb-5">
        <h3 className="text-sm font-bold mb-3">Satisfaction Trend</h3>
        {trend.length > 0 ? <RatingTrendChart data={trend} /> : <p className="text-xs text-slate">Not enough data yet.</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-line rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">Delivery Rider Ratings</h3>
          <div className="flex flex-col gap-2.5">
            {riderRatings.length === 0 && <p className="text-xs text-slate">No rider-specific ratings yet.</p>}
            {riderRatings.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span className="flex items-center gap-1.5"><Stars n={Math.round(r.avg)} /> <span className="text-xs text-slate">({r.count})</span></span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">Low Ratings</h3>
          <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
            {lowRatings.length === 0 && <p className="text-xs text-slate">No low ratings — great work!</p>}
            {lowRatings.map((f) => (
              <div key={f.id} className="border-b border-line last:border-0 pb-2.5 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{f.customers?.name}</span>
                  <Stars n={f.overall_rating} />
                </div>
                {f.comment && <p className="text-[11px] text-slate mt-1">{f.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-5">
        <h3 className="text-sm font-bold mb-3">Recent Feedback</h3>
        <div className="flex flex-col gap-2.5">
          {recent.map((f) => (
            <div key={f.id} className="flex items-center justify-between border-b border-line last:border-0 pb-2.5 last:pb-0">
              <div>
                <div className="text-xs font-semibold">{f.customers?.name}</div>
                {f.comment && <div className="text-[11px] text-slate mt-0.5">{f.comment}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <Stars n={f.overall_rating} />
                <div className="text-[10.5px] text-slate mt-0.5">{fmtDate(f.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
