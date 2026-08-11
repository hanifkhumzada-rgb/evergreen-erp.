import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";
import AddPaymentForm from "@/components/AddPaymentForm";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = createClient();
  const [{ data: payments }, { data: customers }] = await Promise.all([
    supabase.from("payments").select("*, customers(name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name, balance"),
  ]);
  const exportRows = (payments || []).map((p) => ({ Date: p.pay_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Payments</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-payments.xlsx" sheetName="Payments" />
        <PrintButton />
        <AddPaymentForm customers={customers || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
          <tbody>
            {(payments || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No payments yet.</td></tr>}
            {(payments || []).map((p) => (
              <tr key={p.id} className="hover:bg-foam"><Td>{fmtDate(p.pay_date)}</Td><Td>{p.customers?.name}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
