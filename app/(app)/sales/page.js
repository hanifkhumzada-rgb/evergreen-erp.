import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge, ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const supabase = await createClient();
  const [{ data: sales }, { data: customers }] = await Promise.all([
    supabase.from("sales").select("*, customers(name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name, rate"),
  ]);

  const exportRows = (sales || []).map((s) => ({
    Invoice: s.invoice_no, Date: s.sale_date, Customer: s.customers?.name, Qty: s.qty, Total: s.total, Status: s.payment_status,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Sales</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-sales.xlsx" sheetName="Sales" />
        <PrintButton />
        <AddSaleForm customers={customers || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(sales || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No sales yet.</td></tr>}
            {(sales || []).map((s) => (
              <tr key={s.id} className="hover:bg-foam">
                <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                <Td>{fmtDate(s.sale_date)}</Td>
                <Td>{s.customers?.name}</Td>
                <Td>{s.qty}</Td>
                <Td>{pkr(s.total)}</Td>
                <Td><Badge text={s.payment_status} tone={s.payment_status === "Paid" ? "green" : s.payment_status === "Pending" ? "coral" : "amber"} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
