import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui";
import RefreshAlertsButton from "@/components/RefreshAlertsButton";
import { AlertOctagon, CircleAlert, Info, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
const SEV_TONE = { critical: "coral", warning: "amber", info: "aqua", success: "green" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const groups = [
    { title: "Critical", icon: AlertOctagon, tone: "text-coral bg-coralSoft", rows: (notifications || []).filter((n) => n.severity === "critical") },
    { title: "Action Needed", icon: CircleAlert, tone: "text-amber bg-amberSoft", rows: (notifications || []).filter((n) => n.severity === "warning") },
    { title: "Information", icon: Info, tone: "text-aqua bg-aquaSoft", rows: (notifications || []).filter((n) => !["critical", "warning", "success"].includes(n.severity)) },
    { title: "Resolved / Success", icon: CheckCircle2, tone: "text-green bg-greenSoft", rows: (notifications || []).filter((n) => n.severity === "success") },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-aqua">Business signal center</p><h2 className="font-display text-2xl font-semibold">Smart Notifications</h2><p className="text-slate text-sm">Important work is separated from routine information, so the team knows what to do first.</p></div>
        <div className="no-print"><RefreshAlertsButton /></div>
      </div>
      {(notifications || []).length === 0 ? <div className="rounded-2xl border border-line bg-card py-12 text-center text-sm text-slate">No notifications yet. Refresh alerts to scan live business data.</div> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(({ title, icon: Icon, tone, rows }) => (
            <section key={title} className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon size={16} /></span><h3 className="text-sm font-bold">{title}</h3></div><span className="rounded-full bg-foam px-2.5 py-1 text-xs font-bold">{rows.length}</span></div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {rows.length === 0 ? <p className="rounded-xl bg-foam p-4 text-xs text-slate">Nothing in this category.</p> : rows.map((n) => (
                  <article key={n.id} className="rounded-xl border border-line p-3 transition-colors hover:bg-foam"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{n.title}</p><Badge text={n.severity} tone={SEV_TONE[n.severity]} /></div><p className="mt-1 text-xs leading-relaxed text-slate">{n.message}</p><p className="mt-2 text-[10px] text-slate">{fmtDate(n.created_at)}</p></article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
