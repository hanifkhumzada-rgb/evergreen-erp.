import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Badge, Th, Td } from "@/components/ui";
import RefreshAlertsButton from "@/components/RefreshAlertsButton";

export const dynamic = "force-dynamic";
const SEV_TONE = { critical: "coral", warning: "amber", info: "aqua", success: "green" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Notifications</h2>
      <p className="text-slate text-sm mb-4">Stored in the database — visible to your role, not just your browser session. Low stock, high outstanding, bottle limit, and inactive-customer alerts are computed live from your real data.</p>
      <div className="no-print mb-4"><RefreshAlertsButton /></div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>When</Th><Th>Severity</Th><Th>Title</Th><Th>Message</Th></tr></thead>
          <tbody>
            {(notifications || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No notifications yet. Tap &quot;Refresh Alerts&quot; to check for low stock, overdue payments, bottle limits, and inactive customers.</td></tr>}
            {(notifications || []).map((n) => (
              <tr key={n.id} className="hover:bg-foam"><Td>{fmtDate(n.created_at)}</Td><Td><Badge text={n.severity} tone={SEV_TONE[n.severity]} /></Td><Td className="font-semibold">{n.title}</Td><Td>{n.message}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
