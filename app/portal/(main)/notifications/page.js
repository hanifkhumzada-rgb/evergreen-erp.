import { Bell, CheckCheck } from "lucide-react";
import { requirePortalCustomer } from "@/lib/portal/session";
import { markAllCustomerNotificationsRead } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortalNotificationsPage() {
  const { supabase, customerId } = await requirePortalCustomer();
  const { data: notifications } = await supabase.from("customer_notifications")
    .select("id, title, message, type, is_read, created_at")
    .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50);
  const unread = (notifications || []).filter((item) => !item.is_read).length;

  return <div className="flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3">
      <div><h1 className="font-display text-xl font-semibold">Notifications</h1><p className="text-xs text-slate mt-1">Delivery, payment and account updates in one place.</p></div>
      {unread > 0 && <form action={markAllCustomerNotificationsRead}><button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[11px] font-bold text-aqua"><CheckCheck size={14}/>Mark all read</button></form>}
    </div>
    <div className="flex flex-col gap-2.5">
      {(notifications || []).length === 0 && <div className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-slate">No notifications yet.</div>}
      {(notifications || []).map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${item.is_read ? "border-line bg-card" : "border-aqua/30 bg-aquaSoft"}`}>
        <div className="flex items-start gap-3"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.is_read ? "bg-foam text-slate" : "bg-card text-aqua"}`}><Bell size={16}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold">{item.title}</h2>{!item.is_read && <span className="rounded-full bg-aqua px-2 py-0.5 text-[9px] font-bold text-white">New</span>}</div><p className="mt-1 text-xs leading-relaxed text-slate">{item.message}</p><p className="mt-2 text-[10px] text-slate">{fmtDate(item.created_at)}</p></div></div>
      </article>)}
    </div>
  </div>;
}
