import { createClient } from "@/lib/supabase/server";
import { ExportExcelButton, PrintButton, Th, Td, pkr, fmtDate } from "@/components/ui";
import AddExpenseForm from "@/components/AddExpenseForm";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: expenses } = await supabase.from("expenses").select("*").order("created_at", { ascending: false }).limit(200);
  const exportRows = (expenses || []).map(({ id, created_by, ...r }) => r);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Expenses</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-expenses.xlsx" sheetName="Expenses" />
        <PrintButton />
        <AddExpenseForm />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th>Method</Th></tr></thead>
          <tbody>
            {(expenses || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No expenses yet.</td></tr>}
            {(expenses || []).map((e) => (
              <tr key={e.id} className="hover:bg-foam"><Td>{fmtDate(e.exp_date)}</Td><Td>{e.category}</Td><Td>{e.description}</Td><Td>{pkr(e.amount)}</Td><Td>{e.method}</Td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
