import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui";
import RefreshAlertsButton from "@/components/RefreshAlertsButton";
import { MarkReadButton, MarkAllReadButton } from "@/components/NotificationMarkRead";
import { AlertOctagon, CircleAlert, Info, CheckCircle2 } from "lucide-react";
import Link from "@/components/ErpNavLink";

export const dynamic = "force-dynamic";
const SEV_TONE = { critical: "coral", warning: "amber", info: "aqua", success: "green" };

export default async function NotificationsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: allNotifications } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const notifications = (allNotifications || []).filter(n =>
    (!q || n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q)) &&
    (sp.read !== "unread" || !n.is_read) &&
    (!sp.severity || n.severity === sp.severity)
  );
  const unreadCount = (allNotifications || []).filter((n) => !n.is_read).length;
  const groups = [
    { title: "Critical", icon: AlertOctagon, tone: "text-coral bg-coralSoft", rows: notifications.filter((n) => n.severity === "critical") },
    { title: "Action Needed", icon: CircleAlert, tone: "text-amber bg-amberSoft", rows: notifications.filter((n) => n.severity === "warning") },
    { title: "Information", icon: Info, tone: "text-aqua bg-aquaSoft", rows: notifications.filter((n) => !["critical", "warning", "success"].includes(n.severity)) },
    { title: "Resolved / Success", icon: CheckCircle2, tone: "text-green bg-greenSoft", rows: notifications.filter((n) => n.severity === "success") },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-aqua">Business signal center</p><h2 className="font-display text-2xl font-semibold">Smart Notifications</h2><p className="text-slate text-sm">Important work is separated from routine information, so the team knows what to do first.</p></div>
        <div className="no-print flex gap-2"><MarkAllReadButton count={unreadCount} /><RefreshAlertsButton /></div>
      </div>
      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/notifications">
        <select name="read" aria-label="Notification read status" defaultValue={sp.read || "all"} className="in"><option value="all">All notifications</option><option value="unread">Unread only</option></select>
        <select name="severity" aria-label="Notification severity" defaultValue={sp.severity || ""} className="in"><option value="">All priorities</option><option value="critical">Critical</option><option value="warning">Action needed</option><option value="info">Information</option><option value="success">Resolved</option></select>
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search title or message…" className="in w-64" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        <Link href="/notifications" className="text-xs text-slate hover:text-aqua">Reset filters</Link>
        <Link href="/settings" className="text-xs font-semibold text-aqua">Rules & delivery channels</Link>
      </form>
      <p className="text-xs text-slate mb-4">Showing {notifications.length} of the latest {(allNotifications || []).length} alerts. SMS/WhatsApp delivery still requires a configured provider.</p>
      {(allNotifications || []).length === 0 ? <div className="rounded-2xl border border-line bg-card py-12 text-center text-sm text-slate">No notifications yet. Refresh alerts to scan live business data.</div> : notifications.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card py-12 text-center text-sm text-slate">No notifications match this search.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map(({ title, icon: Icon, tone, rows }) => (
            <section key={title} className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon size={16} /></span><h3 className="text-sm font-bold">{title}</h3></div><span className="rounded-full bg-foam px-2.5 py-1 text-xs font-bold">{rows.length}</span></div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {rows.length === 0 ? <p className="rounded-xl bg-foam p-4 text-xs text-slate">Nothing in this category.</p> : rows.map((n) => (
                  <article key={n.id} className={`rounded-xl border border-line p-3 transition-colors hover:bg-foam ${!n.is_read ? "bg-foam/60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold flex items-center gap-1.5">{!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-aqua" />}{n.title}</p>
                      <Badge text={n.severity} tone={SEV_TONE[n.severity]} />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-slate">{fmtDate(n.created_at)}</p>
                      {!n.is_read && <MarkReadButton id={n.id} />}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
