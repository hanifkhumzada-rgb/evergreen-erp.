import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";
import IssueForm from "@/components/portal/IssueForm";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  open: "bg-amberSoft text-amber", under_review: "bg-aquaSoft text-aqua",
  resolved: "bg-greenSoft text-green", rejected: "bg-coralSoft text-coral",
};
const STATUS_LABEL = { open: "Open", under_review: "Under Review", resolved: "Resolved", rejected: "Rejected" };

export default async function PortalSupportPage({ searchParams }) {
  const { supabase, customerId } = await requirePortalCustomer();

  const [{ data: issues }, { data: deliveries }] = await Promise.all([
    supabase.from("customer_issues").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("deliveries").select("id, delivery_no, delivery_date").eq("customer_id", customerId).order("delivery_date", { ascending: false }).limit(20),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="font-display text-xl font-semibold">Help & Requests</h1><p className="text-xs text-slate mt-1">Request an extra order, pause service, or report a problem.</p></div>
      <IssueForm deliveries={deliveries} defaultDeliveryId={searchParams?.delivery} defaultType={searchParams?.type} />

      <div>
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">My Tickets</h2>
        <div className="flex flex-col gap-2.5">
          {(issues || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-5 text-xs text-slate text-center">No issues reported yet.</div>}
          {(issues || []).map((issue) => (
            <div key={issue.id} className="bg-card border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{issue.issue_type}</span>
                <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${STATUS_TONE[issue.status]}`}>{STATUS_LABEL[issue.status]}</span>
              </div>
              <p className="text-xs text-slate mt-1.5">{issue.description}</p>
              <p className="text-[10.5px] text-slate mt-2">{fmtDate(issue.created_at)}</p>
              {issue.resolution_note && (
                <div className="mt-2.5 pt-2.5 border-t border-line">
                  <span className="text-[10.5px] font-semibold text-slate uppercase tracking-wide">Resolution</span>
                  <p className="text-xs mt-1">{issue.resolution_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
