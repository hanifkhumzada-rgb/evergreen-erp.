import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Audit Logs</h2>
      <p className="text-slate text-sm mb-5">A record of who changed what, and when — for accountability across the whole team.</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>When</Th><Th>User</Th><Th>Module</Th><Th>Action</Th><Th>Record</Th></tr></thead>
          <tbody>
            {(logs || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No audit activity recorded yet.</td></tr>}
            {(logs || []).map((l) => (
              <tr key={l.id} className="hover:bg-foam">
                <Td>{fmtDate(l.created_at)}</Td>
                <Td>{l.profiles?.full_name || "System"}</Td>
                <Td className="font-semibold">{l.module}</Td>
                <Td>{l.action}</Td>
                <Td className="text-xs text-slate">{l.record_id || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
