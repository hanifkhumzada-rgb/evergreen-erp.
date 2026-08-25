import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KPI, Badge, Th, Td, pkr, fmtDate, PrintButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const INVOICE_TONE = { paid: "green", partially_paid: "amber", sent: "amber", draft: "slate", overdue: "coral", void: "slate" };

export default async function CustomerProfilePage({ params }) {
  const supabase = await createClient();
  const [{ data: c }, { data: invoices }, { data: payments }, { data: balanceRow }, { data: bottleRows }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", params.id).single(),
    supabase.from("invoices").select("*").eq("customer_id", params.id).order("invoice_date", { ascending: false }).limit(8),
    supabase.from("payments").select("*").eq("customer_id", params.id).order("payment_date", { ascending: false }).limit(8),
    supabase.from("v_customer_balance").select("balance").eq("customer_id", params.id).maybeSingle(),
    supabase.from("v_customer_bottle_balance").select("bottles_with_customer").eq("customer_id", params.id),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  const totalSales = (invoices || []).reduce((a, s) => a + Number(s.net_amount), 0);
  const totalPaid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(balanceRow?.balance || 0);
  const bottleBalance = (bottleRows || []).reduce((a, b) => a + Number(b.bottles_with_customer), 0);

  return (
    <div className="print-area">
      <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>

      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
          <p className="text-slate text-sm mt-1">{c.customer_type} · {c.zones?.name || "No zone"} · Customer since {fmtDate(c.created_at)}</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPI label="TOTAL SALES" value={pkr(totalSales)} tone="navy" />
        <KPI label="TOTAL PAID" value={pkr(totalPaid)} tone="green" />
        <KPI label="OUTSTANDING" value={pkr(balance)} tone="coral" />
        <KPI label="BOTTLE BALANCE" value={bottleBalance} tone="aqua" sub="net bottles currently with this customer" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Recent invoices</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Invoice #</Th><Th>Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {(invoices || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No invoices yet.</td></tr>}
              {(invoices || []).map((s) => (
                <tr key={s.id}><Td>{fmtDate(s.invoice_date)}</Td><Td>{s.invoice_no}</Td><Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={s.status} tone={INVOICE_TONE[s.status] || "slate"} /></Td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Payments received</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
            <tbody>
              {(payments || []).length === 0 && <tr><td colSpan={3} className="text-center py-5 text-slate">No payments yet.</td></tr>}
              {(payments || []).map((p) => <tr key={p.id}><Td>{fmtDate(p.payment_date)}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-[13.5px] font-bold mb-2">Contact details</h4>
        <div className="flex gap-5 flex-wrap text-[13px] text-slate">
          <span>{c.mobile}</span><span>{c.address}</span><span>Credit limit: {pkr(c.credit_limit)}</span>
        </div>
      </div>
    </div>
  );
}
