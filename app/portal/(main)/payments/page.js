import { Wallet } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate, pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

const METHOD_LABEL = { cash: "Cash", bank_transfer: "Bank Transfer", cheque: "Cheque", online: "Online", card: "Card" };

export default async function PortalPaymentsPage() {
  const { supabase, customerId } = await requirePortalCustomer();

  const { data: payments } = await supabase.from("payments")
    .select("id, receipt_no, amount, payment_date, method, reference, voided")
    .eq("customer_id", customerId).eq("voided", false).order("payment_date", { ascending: false }).limit(100);

  const totalPaid = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">Payments</h1>
      <div className="bg-navyLight text-white rounded-2xl p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#BFE3E0]">Total Paid</div>
        <div className="font-mono-num text-2xl font-bold mt-1">{pkr(totalPaid)}</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {(payments || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-5 text-xs text-slate text-center">No payments recorded yet.</div>}
        {(payments || []).map((p) => (
          <div key={p.id} className="bg-card border border-line rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-bold"><Wallet size={13} className="text-green" /> {p.receipt_no || "Payment"}</div>
              <div className="text-[11px] text-slate mt-1">{fmtDate(p.payment_date)} · {METHOD_LABEL[p.method] || p.method}{p.reference ? ` · ${p.reference}` : ""}</div>
            </div>
            <span className="text-sm font-mono-num font-bold text-green">{pkr(p.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
