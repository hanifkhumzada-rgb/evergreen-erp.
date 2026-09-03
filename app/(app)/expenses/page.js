import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { pkr, fmtDate } from "@/lib/format";
import { ExportExcelButton, PrintButton, Th, Td, Badge } from "@/components/ui";
import AddExpenseForm from "@/components/AddExpenseForm";
import BulkImportButton from "@/components/BulkImportButton";
import PendingApprovals from "@/components/PendingApprovals";
import { bulkImportExpenses } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  submitted: { text: "Pending approval", tone: "amber" },
  approved: { text: "Approved", tone: "green" },
  paid: { text: "Paid", tone: "green" },
  rejected: { text: "Rejected", tone: "coral" },
  draft: { text: "Draft", tone: "slate" },
};

export default async function ExpensesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const { supabase, profile } = await getCurrentProfile();
  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase.from("expenses").select("*, expense_categories(name), profiles!expenses_submitted_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("expense_categories").select("id, name").order("name"),
  ]);
  const isOwner = profile?.roles?.key === "owner";
  const pendingExpenses = (expenses || []).filter((e) => e.status === "submitted");

  const categoryFilter = sp.category || "";
  const statusFilter = sp.status || "";
  const fromDate = sp.from || "";
  const toDate = sp.to || "";
  const allRows = expenses || [];
  const rows = allRows.filter((e) => {
    if (categoryFilter && e.expense_categories?.name !== categoryFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (fromDate && e.expense_date < fromDate) return false;
    if (toDate && e.expense_date > toDate) return false;
    return true;
  });
  const hasFilters = categoryFilter || statusFilter || fromDate || toDate;
  const exportRows = rows.map((e) => ({ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method, Status: e.status, EnteredBy: e.profiles?.full_name, Receipt: e.receipt_reference }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Expenses</h2>
      {isOwner && <PendingApprovals expenses={pendingExpenses} />}
      <form className="no-print flex flex-wrap gap-2.5 mb-2 items-center" action="/expenses">
        <select name="category" defaultValue={categoryFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All categories</option>
          {(categories || []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          {Object.entries(STATUS_BADGE).map(([v, b]) => <option key={v} value={v}>{b.text}</option>)}
        </select>
        <input type="date" name="from" defaultValue={fromDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <input type="date" name="to" defaultValue={toDate} className="px-3 py-2 rounded-xl border border-line bg-card text-xs" />
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {hasFilters && <Link href="/expenses" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Category, Description, Amount, Date, Method"
          action={bulkImportExpenses}
          sampleRow={{ Category: "Fuel", Description: "Bike fuel", Amount: 500, Date: "2026-08-31", Method: "Cash" }}
          previewType="expenses"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-expenses.xlsx" sheetName="Expenses" />
        <PrintButton />
        <AddExpenseForm />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} expenses</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th>Method</Th><Th>Entered By</Th><Th>Receipt</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No expenses match.</td></tr>}
            {rows.map((e) => {
              const badge = STATUS_BADGE[e.status] || STATUS_BADGE.approved;
              return (
                <tr key={e.id} className="hover:bg-foam">
                  <Td>{fmtDate(e.expense_date)}</Td><Td>{e.expense_categories?.name}</Td><Td>{e.description}</Td><Td>{pkr(e.amount)}</Td><Td>{e.payment_method}</Td>
                  <Td>{e.profiles?.full_name || "—"}</Td><Td className="text-xs text-slate max-w-[140px] truncate">{e.receipt_reference || "—"}</Td>
                  <Td><Badge text={badge.text} tone={badge.tone} /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
