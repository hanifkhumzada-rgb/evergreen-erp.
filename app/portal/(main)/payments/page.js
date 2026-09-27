import Link from "next/link";
import { Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import ListFilterBar from "@/components/ListFilterBar";
import { DocumentActionBar } from "@/components/ui";
import { portalPaymentFilters, portalPaymentsQuery, PORTAL_METHOD_LABEL as METHOD_LABEL } from "@/lib/portal/listQueries";
import { exportPortalPayments } from "@/lib/portal/exportActions";
import { requirePortalCustomer } from "@/lib/portal/session";
import { fmtDate, pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function pageHref(month, q, page) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/portal/payments${params.size ? `?${params}` : ""}`;
}

export default async function PortalPaymentsPage({ searchParams }) {
  const { supabase, customerId } = await requirePortalCustomer();
  const filters = portalPaymentFilters(searchParams || {});
  const { month, q } = filters;
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data: payments, count } = await portalPaymentsQuery(supabase, customerId, filters, { count: true }).range(from, from + PAGE_SIZE - 1);
  const pdfParams = new URLSearchParams({ kind: "payments", ...(q && { q }), ...(month && { month }) });
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const pageTotal = (payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="font-display text-xl font-semibold">Payments</h1><p className="text-xs text-slate mt-1">Receipts and references for your approved payments.</p></div>
      <ListFilterBar className="!mb-0" placeholder="Search receipt or reference" dateFilters={[{ name: "month", label: "Month", type: "month" }]} />
      <div className="flex flex-wrap gap-2">
        <DocumentActionBar
          print
          pdfHref={`/api/pdf/portal-list?${pdfParams}`}
          pdfLabel="PDF"
          excel={{ loadRows: exportPortalPayments.bind(null, filters), sheetName: "My Payments", reportTitle: "My Payments" }}
          share={{ title: "My Payments" }}
        />
      </div>
      <div className="bg-navyLight text-white rounded-2xl p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#BFE3E0]">{month ? "Visible period total" : "Visible payments total"}</div>
        <div className="font-mono-num text-2xl font-bold mt-1">{pkr(pageTotal)}</div>
        <div className="mt-1 text-[10px] text-[#BFE3E0]">{count || 0} payment{count === 1 ? "" : "s"} found</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {(payments || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-6 text-xs text-slate text-center">No payments found for this period.</div>}
        {(payments || []).map((payment) => (
          <div key={payment.id} className="bg-card border border-line rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="flex items-center gap-1.5 text-sm font-bold"><Wallet size={13} className="text-green shrink-0" /><span className="truncate">{payment.receipt_no || "Payment"}</span></div><div className="text-[11px] text-slate mt-1 break-words">{fmtDate(payment.payment_date)} · {METHOD_LABEL[payment.method] || payment.method}{payment.reference ? ` · ${payment.reference}` : ""}</div></div>
            <span className="text-sm font-mono-num font-bold text-green shrink-0">{pkr(payment.amount)}</span>
          </div>
        ))}
      </div>

      {(count || 0) > PAGE_SIZE && <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-2">
        <Link aria-disabled={page <= 1} href={pageHref(month, q, Math.max(1, page - 1))} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${page <= 1 ? "pointer-events-none text-slate/40" : "text-aqua hover:bg-aquaSoft"}`}><ChevronLeft size={14}/>Previous</Link>
        <span className="text-[11px] text-slate">Page {Math.min(page, totalPages)} of {totalPages}</span>
        <Link aria-disabled={page >= totalPages} href={pageHref(month, q, Math.min(totalPages, page + 1))} className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${page >= totalPages ? "pointer-events-none text-slate/40" : "text-aqua hover:bg-aquaSoft"}`}>Next<ChevronRight size={14}/></Link>
      </div>}
    </div>
  );
}
