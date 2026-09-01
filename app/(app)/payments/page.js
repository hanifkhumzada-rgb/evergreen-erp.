import { createClient } from "@/lib/supabase/server";
import { pkr, fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import AddPaymentForm from "@/components/AddPaymentForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportPayments } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [{ data: payments }, { data: balances }] = await Promise.all([
    supabase.from("payments").select("*, customers(name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("v_customer_balance").select("customer_id, name, balance"),
  ]);
  const exportRows = (payments || []).map((p) => ({ Date: p.payment_date, Customer: p.customers?.name, Amount: p.amount, Method: p.method }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Payments</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Amount, Date, Method"
          action={bulkImportPayments}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Amount: 1000, Date: "2026-08-31", Method: "Cash" }}
          previewType="payments"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-payments.xlsx" sheetName="Payments" />
        <PrintButton />
        <AddPaymentForm customers={(balances || []).map((b) => ({ id: b.customer_id, name: b.name, balance: b.balance }))} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Customer</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
          <tbody>
            {(payments || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate">No payments yet.</td></tr>}
            {(payments || []).map((p) => (
              <tr key={p.id} className="hover:bg-foam"><Td>{fmtDate(p.payment_date)}</Td><Td>{p.customers?.name}</Td><Td>{pkr(p.amount)}</Td><Td>{p.method}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
