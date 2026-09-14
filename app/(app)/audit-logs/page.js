import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AuditLogsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const page = Math.max(1, parseInt(sp.page, 10) || 1);
  const moduleFilter = sp.module || "";
  const userFilter = sp.user || "";
  const dateFrom = sp.from || "";
  const dateTo = sp.to || "";

  let query = supabase.from("audit_logs").select("*, profiles(full_name)", { count: "exact" }).order("created_at", { ascending: false });
  if (moduleFilter) query = query.eq("module", moduleFilter);
  if (userFilter) query = query.eq("user_id", userFilter);
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const [{ data: logs, count }, { data: modules }, { data: users }] = await Promise.all([
    query,
    // Distinct modules ever logged — used to populate the filter dropdown
    // without hardcoding a module list that would drift from reality.
    supabase.from("audit_logs").select("module").limit(1000),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const moduleOptions = [...new Set((modules || []).map((m) => m.module))].sort();
  const total = count || 0;
  const hasNext = from + PAGE_SIZE < total;
  const hasPrev = page > 1;

  const buildHref = (overrides) => {
    const params = new URLSearchParams({ ...(moduleFilter && { module: moduleFilter }), ...(userFilter && { user: userFilter }), ...(dateFrom && { from: dateFrom }), ...(dateTo && { to: dateTo }), ...overrides });
    const s = params.toString();
    return s ? `/audit-logs?${s}` : "/audit-logs";
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Audit Logs</h2>
      <p className="text-slate text-sm mb-5">A record of who changed what, and when — for accountability across the whole team.</p>

      <form action="/audit-logs" className="flex flex-wrap gap-2.5 mb-4 items-center">
        <select name="user" defaultValue={userFilter} className="in w-44">
          <option value="">All users</option>
          {(users || []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select name="module" defaultValue={moduleFilter} className="in w-40">
          <option value="">All modules</option>
          {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" name="from" defaultValue={dateFrom} className="in w-36" />
        <span className="text-xs text-slate">to</span>
        <input type="date" name="to" defaultValue={dateTo} className="in w-36" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {(moduleFilter || userFilter || dateFrom || dateTo) && <Link href="/audit-logs" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>When</Th><Th>User</Th><Th>Module</Th><Th>Action</Th><Th>Record</Th></tr></thead>
          <tbody>
            {(logs || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No audit activity matches this filter.</td></tr>}
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

      <div className="flex items-center justify-between mt-3 text-xs text-slate">
        <span>{total === 0 ? "No records" : `Showing ${from + 1}–${Math.min(from + PAGE_SIZE, total)} of ${total}`}</span>
        <div className="flex gap-2">
          {hasPrev && <Link href={buildHref({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg border border-line bg-card font-semibold">← Newer</Link>}
          {hasNext && <Link href={buildHref({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg border border-line bg-card font-semibold">Older →</Link>}
        </div>
      </div>
    </div>
  );
}
