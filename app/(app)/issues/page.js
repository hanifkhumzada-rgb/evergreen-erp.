import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPI, Badge, Th, Td } from "@/components/ui";
import IssueStatusForm from "@/components/IssueStatusForm";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE = { open: "amber", under_review: "aqua", resolved: "green", rejected: "coral" };
const STATUS_LABEL = { open: "Open", under_review: "Under Review", resolved: "Resolved", rejected: "Rejected" };

function buildIssuesHref(status, q) {
  const params = new URLSearchParams({ ...(status !== "all" && { status }), ...(q && { q }) });
  const s = params.toString();
  return s ? `/issues?${s}` : "/issues";
}

export default async function IssuesPage({ searchParams }) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "deliveries.edit" });

  if (!allowed) {
    return <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Customer issue tickets are managed by delivery-authorized staff.</p>;
  }

  const sp = (await searchParams) || {};
  const status = sp.status || "all";
  const q = (sp.q || "").trim();
  let query = supabase.from("customer_issues").select("*, customers(name, code, mobile), deliveries(delivery_no)").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.or(`issue_type.ilike.%${q}%,description.ilike.%${q}%`);
  // A search needs to reach the full history, not just the default recent-200 feed.
  if (!q) query = query.limit(200);

  const [{ data: issues }, openCount, reviewCount, resolvedCount, rejectedCount] = await Promise.all([
    query,
    supabase.from("customer_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("customer_issues").select("id", { count: "exact", head: true }).eq("status", "under_review"),
    supabase.from("customer_issues").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("customer_issues").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);
  const counts = { open: openCount.count || 0, under_review: reviewCount.count || 0, resolved: resolvedCount.count || 0, rejected: rejectedCount.count || 0 };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Customer Issues</h2>
      <p className="text-slate text-sm mb-4">Complaints and requests reported on a delivery — track status from open to resolved.</p>
      <div className="flex flex-wrap gap-3 mb-5">
        <KPI label="Open" value={counts.open} tone="amber" />
        <KPI label="Under Review" value={counts.under_review} tone="aqua" />
        <KPI label="Resolved" value={counts.resolved} tone="green" />
        <KPI label="Rejected" value={counts.rejected} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {["all", "open", "under_review", "resolved", "rejected"].map((s) => (
            <Link key={s} href={buildIssuesHref(s, q)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === s ? "bg-navy text-white" : "bg-card border border-line text-slate"}`}>
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
        <form action="/issues" className="flex gap-2 items-center">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input type="text" name="q" defaultValue={q} placeholder="Search type or description…" className="in w-56" />
          <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
          {q && <Link href={buildIssuesHref(status, "")} className="text-xs text-slate hover:text-aqua">Clear</Link>}
        </form>
      </div>

      <div className="bg-card border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>
            <Th>Customer</Th><Th>Type</Th><Th>Description</Th><Th>Delivery</Th><Th>Reported</Th><Th>Status</Th>
          </tr></thead>
          <tbody>
            {(issues || []).length === 0 && <tr><Td colSpan={6} className="text-center text-slate py-8">No issues found.</Td></tr>}
            {(issues || []).map((issue) => (
              <tr key={issue.id}>
                <Td>
                  <div className="font-semibold">{issue.customers?.name}</div>
                  <div className="text-[11px] text-slate">{issue.customers?.code} · {issue.customers?.mobile}</div>
                </Td>
                <Td>{issue.issue_type}</Td>
                <Td className="max-w-xs whitespace-normal">{issue.description}</Td>
                <Td>{issue.deliveries?.delivery_no || "—"}</Td>
                <Td>{fmtDate(issue.created_at)}</Td>
                <Td>
                  <Badge text={STATUS_LABEL[issue.status]} tone={STATUS_TONE[issue.status]} />
                  <IssueStatusForm issue={issue} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
