import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, ExportExcelButton, PrintButton, Th, Td, Badge } from "@/components/ui";
import AddExpenseForm from "@/components/AddExpenseForm";
import BulkImportButton from "@/components/BulkImportButton";
import PendingApprovals from "@/components/PendingApprovals";
import VoidButton from "@/components/VoidButton";
import { bulkImportExpenses, voidExpense } from "@/app/actions";
import { Tag } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  submitted: { text: "Pending approval", tone: "amber" },
  approved: { text: "Approved", tone: "green" },
  paid: { text: "Paid", tone: "green" },
  rejected: { text: "Rejected", tone: "coral" },
  draft: { text: "Draft", tone: "slate" },
  void: { text: "Voided", tone: "coral" },
};

export default async function ExpensesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const { supabase, profile } = await getCurrentProfile();
  const [{ data: expenses }, { data: categories }, { data: canVoid }] = await Promise.all([
    supabase.from("expenses").select("*, expense_categories(name), profiles!expenses_submitted_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "expenses.delete" }),
  ]);
  const isOwner = profile?.roles?.key === "owner";
  const pendingExpenses = (expenses || []).filter((e) => e.status === "submitted");

  // KPIs + category tiles — counted spend is approved/paid only, matching
  // the Dashboard's TODAY'S EXPENSES figure (both filter to the same
  // ["approved","paid"] set) so the same calendar day reads the same
  // total on both pages. Submitted (pending-approval) amounts are real
  // but not yet confirmed spend — they show up only in the PENDING
  // APPROVAL count, never folded into a spend total. Production &
  // Filling has its own workspace against production_batches; nothing
  // here overlaps it since no expense_categories row represents filling.
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const spendRows = (expenses || []).filter((e) => ["approved", "paid"].includes(e.status));
  const todayTotal = spendRows.filter((e) => e.expense_date === today).reduce((a, e) => a + Number(e.amount), 0);
  const monthRows = spendRows.filter((e) => e.expense_date >= monthStart);
  const monthTotal = monthRows.reduce((a, e) => a + Number(e.amount), 0);
  const categoryTotals = {};
  monthRows.forEach((e) => {
    const name = e.expense_categories?.name || "Uncategorized";
    categoryTotals[name] = (categoryTotals[name] || 0) + Number(e.amount);
  });
  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];
  const allTimeCategoryTotals = {};
  const allTimeCategoryCounts = {};
  spendRows.forEach((e) => {
    const name = e.expense_categories?.name || "Uncategorized";
    allTimeCategoryTotals[name] = (allTimeCategoryTotals[name] || 0) + Number(e.amount);
    allTimeCategoryCounts[name] = (allTimeCategoryCounts[name] || 0) + 1;
  });

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
      <h2 className="font-display text-2xl font-semibold mb-1">Expenses</h2>
      <p className="text-slate text-sm mb-4">Operating costs by category — filling/production costs live in their own workspace.</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY" value={pkr(todayTotal)} tone="navy" />
        <KPI label="THIS MONTH" value={pkr(monthTotal)} tone="aqua" />
        <KPI label="PENDING APPROVAL" value={pendingExpenses.length} tone={pendingExpenses.length > 0 ? "amber" : "slate"} />
        <KPI label="TOP CATEGORY" value={topCategory ? topCategory[0] : "—"} tone="coral" sub={topCategory ? `${pkr(topCategory[1])} this month` : "no spend yet this month"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mb-6">
        {(categories || []).map((c) => (
          <Link
            key={c.id} href={`/expenses?category=${encodeURIComponent(c.name)}`}
            className={`card-lift flex flex-col gap-1.5 p-3.5 rounded-2xl border ${categoryFilter === c.name ? "border-aqua bg-aquaSoft" : "border-line bg-card"}`}
          >
            <Tag size={15} className="text-aqua" />
            <span className="text-[12.5px] font-semibold truncate">{c.name}</span>
            <span className="font-mono-num text-sm font-semibold">{pkr(allTimeCategoryTotals[c.name] || 0)}</span>
            <span className="text-[10.5px] text-slate">{allTimeCategoryCounts[c.name] || 0} entries</span>
          </Link>
        ))}
      </div>

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
          <thead><tr className="bg-foam"><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th>Method</Th><Th>Entered By</Th><Th>Receipt</Th><Th>Status</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate">No expenses match.</td></tr>}
            {rows.map((e) => {
              const badge = STATUS_BADGE[e.status] || STATUS_BADGE.approved;
              return (
                <tr key={e.id} className={`hover:bg-foam ${e.voided ? "opacity-60" : ""}`}>
                  <Td>{fmtDate(e.expense_date)}</Td><Td>{e.expense_categories?.name}</Td><Td>{e.description}</Td><Td>{pkr(e.amount)}</Td><Td>{e.payment_method}</Td>
                  <Td>{e.profiles?.full_name || "—"}</Td><Td className="text-xs text-slate max-w-[140px] truncate">{e.receipt_reference || "—"}</Td>
                  <Td><Badge text={badge.text} tone={badge.tone} />{e.voided && e.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{e.void_reason}</div>}</Td>
                  <Td>{canVoid && !e.voided && <VoidButton action={voidExpense} id={e.id} confirmText={`Void expense "${e.description || e.expense_categories?.name}"?`} />}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
