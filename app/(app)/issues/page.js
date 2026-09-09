import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPI, Badge, Th, Td } from "@/components/ui";
import IssueStatusForm from "@/components/IssueStatusForm";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE = { open: "amber", under_review: "aqua", resolved: "green", rejected: "coral" };
const STATUS_LABEL = { open: "Open", under_review: "Under Review", resolved: "Resolved", rejected: "Rejected" };

export default async function IssuesPage({ searchParams }) {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("fn_has_permission", { perm_key: "deliveries.edit" });

  if (!allowed) {
    return <p className="text-xs text-slate border border-line rounded-2xl p-5 max-w-3xl">Customer issue tickets are managed by delivery-authorized staff.</p>;
  }

  const status = searchParams?.status || "all";
  let query = supabase.from("customer_issues").select("*, customers(name, code, mobile), deliveries(delivery_no)").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") query = query.eq("status", status);

  const [{ data: issues }, { data: allIssues }] = await Promise.all([
    query,
    supabase.from("customer_issues").select("status"),
  ]);
  const counts = { open: 0, under_review: 0, resolved: 0, rejected: 0 };
  (allIssues || []).forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customer Issues</h2>
      <div className="flex flex-wrap gap-3 mb-5">
        <KPI label="Open" value={counts.open} tone="amber" />
        <KPI label="Under Review" value={counts.under_review} tone="aqua" />
        <KPI label="Resolved" value={counts.resolved} tone="green" />
        <KPI label="Rejected" value={counts.rejected} tone="slate" />
      </div>

      <div className="flex gap-2 mb-4">
        {["all", "open", "under_review", "resolved", "rejected"].map((s) => (
          <Link key={s} href={s === "all" ? "/issues" : `/issues?status=${s}`}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${status === s ? "bg-navy text-white" : "bg-card border border-line text-slate"}`}>
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="bg-card border border-line rounded-2xl overflow-hidden">
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
