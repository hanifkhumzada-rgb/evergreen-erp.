import { createClient } from "@/lib/supabase/server";
import { Badge, Th, Td, fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEV_TONE = { critical: "coral", warning: "amber", info: "aqua", success: "green" };

export default async function NotificationsPage() {
  const supabase = createClient();
  const { data: notifications } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Notifications</h2>
      <p className="text-slate text-sm mb-5">Stored in the database — visible to your role, not just your browser session.</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>When</Th><Th>Severity</Th><Th>Title</Th><Th>Message</Th></tr></thead>
          <tbody>
            {(notifications || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No notifications yet. As triggers are wired up (low stock, overdue payments), they will appear here automatically.</td></tr>}
            {(notifications || []).map((n) => (
              <tr key={n.id} className="hover:bg-foam"><Td>{fmtDate(n.created_at)}</Td><Td><Badge text={n.severity} tone={SEV_TONE[n.severity]} /></Td><Td className="font-semibold">{n.title}</Td><Td>{n.message}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
