import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KPI, Badge, Th, Td, pkr, fmtDate, PrintButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }) {
  const supabase = createClient();
  const [{ data: c }, { data: sales }, { data: payments }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", params.id).single(),
    supabase.from("sales").select("*").eq("customer_id", params.id).order("sale_date", { ascending: false }).limit(8),
    supabase.from("payments").select("*").eq("customer_id", params.id).order("pay_date", { ascending: false }).limit(8),
  ]);

  if (!c) {
    return (
      <div>
        <Link href="/customers" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Customers</Link>
        <p>Customer not found.</p>
      </div>
    );
  }

  const totalSales = (sales || []).reduce((a, s) => a + Number(s.total), 0);
  const totalPaid = (sales || []).reduce((a, s) => a + Number(s.paid), 0) + (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const bottleBalance = c.bottles_delivered - c.bottles_returned;

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
        <KPI label="OUTSTANDING" value={pkr(c.balance)} tone="coral" />
        <KPI label="BOTTLE BALANCE" value={bottleBalance} tone="aqua" sub={`${c.bottles_delivered} delivered · ${c.bottles_returned} returned`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-[13.5px] font-bold mb-2">Recent orders</h4>
          <table className="w-full text-xs border-collapse border border-line rounded-xl overflow-hidden">
            <thead><tr className="bg-foam"><Th>Date</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th></tr></thead>
            <tbody>
              {(sales || []).length === 0 && <tr><td colSpan={4} className="text-center py-5 text-slate">No orders yet.</td></tr>}
              {(sales || []).map((s) => (
                <tr key={s.id}><Td>{fmtDate(s.sale_date)}</Td><Td>{s.qty}</Td><Td>{pkr(s.total)}</Td>
                  <Td><Badge text={s.payment_status} tone={s.payment_status === "Paid" ? "green" : "amber"} /></Td></tr>
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
              {(payments || []).map((p) => <tr key={p.id}><Td>{fmtDate(p.pay_date)}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-[13.5px] font-bold mb-2">Contact details</h4>
        <div className="flex gap-5 flex-wrap text-[13px] text-slate">
          <span>{c.phone}</span><span>{c.address}</span><span>Rate: {pkr(c.rate)}/bottle</span><span>Regular qty: {c.regular_qty}</span>
        </div>
      </div>
    </div>
  );
}
