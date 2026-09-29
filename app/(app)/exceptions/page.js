import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleAlert, RefreshCw, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, KPI, Th, Td } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const priorityTone = { Critical: "coral", "Action Needed": "amber", Information: "aqua" };
const statusTone = { Open: "coral", Review: "amber", Monitoring: "aqua" };

function smartException(row) {
  const failed = row.status === "failed";
  const details = failed
    ? Object.values(row.validation_errors || {}).filter(Boolean).join(" · ") || "Entry failed validation or posting."
    : "Entry is waiting for owner/accountant approval.";
  return {
    id: `smart-${row.id}`,
    type: failed ? "Failed Posting" : "Pending Approval",
    date: row.created_at,
    reference: row.entry_no,
    problem: details,
    impact: failed ? "Not posted to the operational or financial ledger" : "Does not affect approved balances until approved",
    priority: failed ? "Critical" : "Action Needed",
    status: failed ? "Open" : "Review",
    href: `/smart-entry?entry=${row.id}`,
  };
}

export default async function ExceptionCenterPage() {
  const supabase = await createClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [{ data: smartRows }, { data: deliveryRows }, { data: bottleRows }, { data: failedNotifications }] = await Promise.all([
    supabase.from("smart_entries").select("id,entry_no,entry_type,status,validation_errors,warnings,created_at").in("status", ["failed", "pending_approval"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("deliveries").select("id,delivery_no,delivery_date,status,customer_id,customers(name)").in("status", ["delivered", "partially_delivered"]).gte("delivery_date", ninetyDaysAgo).order("delivery_date", { ascending: false }).limit(300),
    supabase.from("v_customer_bottle_balance").select("customer_id,name,bottles_with_customer").lt("bottles_with_customer", 0).limit(100),
    supabase.from("notification_logs").select("id,channel,to_number,status,error_message,created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(50),
  ]);

  const deliveryIds = (deliveryRows || []).map((row) => row.id);
  const { data: linkedInvoices } = deliveryIds.length
    ? await supabase.from("invoices").select("delivery_id").in("delivery_id", deliveryIds)
    : { data: [] };
  const invoicedDeliveries = new Set((linkedInvoices || []).map((row) => row.delivery_id));

  const exceptions = [
    ...(smartRows || []).map(smartException),
    ...(deliveryRows || []).filter((row) => !invoicedDeliveries.has(row.id)).map((row) => ({
      id: `delivery-${row.id}`, type: "Delivery Without Invoice", date: row.delivery_date, reference: row.delivery_no,
      problem: `${row.customers?.name || "Customer"} delivery has no linked invoice.`, impact: "Billing and customer document may be incomplete",
      priority: "Critical", status: "Open", href: `/deliveries?hq=${encodeURIComponent(row.delivery_no || "")}`,
    })),
    ...(bottleRows || []).map((row) => ({
      id: `bottle-${row.customer_id}`, type: "Negative Bottle Balance", date: null, reference: row.name,
      problem: `Calculated bottle balance is ${row.bottles_with_customer}.`, impact: "Bottle ledger requires reconciliation",
      priority: "Critical", status: "Open", href: `/customers/${row.customer_id}`,
    })),
    ...(failedNotifications || []).map((row) => ({
      id: `notification-${row.id}`, type: "Failed Notification", date: row.created_at, reference: row.to_number || row.channel,
      problem: row.error_message || "Message delivery failed.", impact: "Customer communication was not delivered",
      priority: "Action Needed", status: "Review", href: "/notifications",
    })),
  ];

  const critical = exceptions.filter((row) => row.priority === "Critical").length;
  const actionNeeded = exceptions.filter((row) => row.priority === "Action Needed").length;
  const pending = (smartRows || []).filter((row) => row.status === "pending_approval").length;

  return <div>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldAlert className="text-coral" size={23} /><h2 className="font-display text-2xl font-semibold">Exception Center</h2></div><p className="mt-1 text-sm text-slate">Only records requiring review—normal completed transactions are intentionally hidden.</p></div>
      <Link href="/exceptions" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm font-semibold hover:bg-foam"><RefreshCw size={15} /> Refresh</Link>
    </div>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KPI label="OPEN EXCEPTIONS" value={exceptions.length} tone={exceptions.length ? "coral" : "green"} />
      <KPI label="CRITICAL" value={critical} tone={critical ? "coral" : "green"} />
      <KPI label="ACTION NEEDED" value={actionNeeded} tone={actionNeeded ? "amber" : "green"} />
      <KPI label="PENDING APPROVAL" value={pending} tone={pending ? "amber" : "green"} href="/smart-entry?status=pending_approval" />
    </div>

    {exceptions.length === 0 ? <div className="rounded-2xl border border-line bg-card p-10 text-center"><CheckCircle2 size={34} className="mx-auto text-green" /><h3 className="mt-3 font-semibold">No unresolved exceptions</h3><p className="mt-1 text-sm text-slate">Failed postings, missing invoices, negative bottle balances and failed notifications are clear.</p></div> : <div className="overflow-x-auto rounded-2xl border border-line bg-card"><table className="w-full min-w-[980px] border-collapse text-[13px]"><thead className="sticky top-0 bg-foam"><tr><Th>Priority</Th><Th>Type</Th><Th>Date</Th><Th>Customer / Reference</Th><Th>Problem</Th><Th>Impact</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{exceptions.map((row) => <tr key={row.id} className="border-t border-line hover:bg-foam"><Td><Badge text={row.priority} tone={priorityTone[row.priority]} /></Td><Td><span className="inline-flex items-center gap-1.5 font-semibold"><CircleAlert size={14} className={row.priority === "Critical" ? "text-coral" : "text-amber"} />{row.type}</span></Td><Td>{row.date ? fmtDate(row.date) : "—"}</Td><Td><span className="font-mono-num text-xs">{row.reference || "—"}</span></Td><Td><span className="block max-w-xs whitespace-normal">{row.problem}</span></Td><Td><span className="block max-w-xs whitespace-normal text-slate">{row.impact}</span></Td><Td><Badge text={row.status} tone={statusTone[row.status]} /></Td><Td><div className="flex items-center gap-2"><Link href={row.href} className="rounded-lg bg-navy px-3 py-1.5 text-xs font-bold text-white">Review</Link><Link href="/audit-logs" className="text-xs font-semibold text-aqua hover:underline">Audit</Link></div></Td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/20 bg-amberSoft p-3 text-xs text-slate"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" /><p>Exception Center is read-only detection. Corrections use the original controlled workflow so approved financial history remains traceable.</p></div>
  </div>;
}
