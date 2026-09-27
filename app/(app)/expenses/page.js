import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { pkr, fmtDate } from "@/lib/format";
import { KPI, DocumentActionBar, Th, Td, Badge } from "@/components/ui";
import AddExpenseForm from "@/components/AddExpenseForm";
import BulkImportButton from "@/components/BulkImportButton";
import PendingApprovals from "@/components/PendingApprovals";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import RecordPreview from "@/components/RecordPreview";
import { bulkImportExpenses, voidExpense } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { Tag } from "lucide-react";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { expenseFilters, applyExpenseFilters } from "@/lib/listQueries";
import { exportExpenseRows } from "@/lib/exportActions";
import { BulkSelectProvider, SelectAllCheckbox, RowCheckbox } from "@/components/BulkSelect";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  submitted: { text: "Pending approval", tone: "amber" },
  approved: { text: "Approved", tone: "green" },
  paid: { text: "Paid", tone: "green" },
  rejected: { text: "Rejected", tone: "coral" },
  draft: { text: "Draft", tone: "slate" },
  void: { text: "Voided", tone: "coral" },
};

const PAGE_SIZE = 50;

export default async function ExpensesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const { supabase, profile } = await getCurrentProfile();
  const filters = expenseFilters(sp);
  const page = pageFrom(sp);
  const [from, to] = rangeFor(page, PAGE_SIZE);
  // The list is paged/filtered in the database; KPIs and category cards come
  // from SECURITY INVOKER aggregate functions (RLS applies), so the page
  // never downloads the full expense history.
  const [branding, { data: expenses, count }, { data: kpis }, { data: catTotals }, { data: pending }, { data: categories }, { data: canVoid }] = await Promise.all([
    getBrandingLite(supabase),
    applyExpenseFilters(
      supabase.from("expenses").select("*, expense_categories(name), profiles!expenses_submitted_by_fkey(full_name)", { count: "exact" }), filters,
    ).order("created_at", { ascending: false }).order("id").range(from, to),
    supabase.rpc("fn_expense_kpis"),
    supabase.rpc("fn_expense_category_totals"),
    supabase.from("expenses").select("*, expense_categories(name), profiles!expenses_submitted_by_fkey(full_name)").eq("status", "submitted").order("created_at", { ascending: false }).limit(200),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "expenses.delete" }),
  ]);
  const isOwner = profile?.roles?.key === "owner";
  const pendingExpenses = pending || [];
  const k = kpis || {};

  const today = new Date().toISOString().slice(0, 10);
  const catById = Object.fromEntries((catTotals || []).map((c) => [c.category_id, c]));
  const catName = Object.fromEntries((categories || []).map((c) => [c.id, c.name]));
  const top = (catTotals || []).filter((c) => Number(c.month_total) > 0).sort((a, b) => Number(b.month_total) - Number(a.month_total))[0];
  const topCategory = top ? [catName[top.category_id] || "Uncategorized", Number(top.month_total)] : null;

  const categoryFilter = filters.category;
  const rows = expenses || [];
  const matching = count || 0;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Expenses" meta={`${matching} of ${k.total_count ?? 0} expenses\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Expenses</h2>
      <p className="no-print text-slate text-sm mb-4">Operating costs by category — search, preview and verify before changing anything.</p>

      <ListFilterBar
        placeholder="Search expense #, description, receipt…"
        filters={[
          { name: "category", label: "All categories", options: (categories || []).map((c) => ({ value: c.id, label: c.name })) },
          { name: "status", label: "All statuses", options: Object.entries(STATUS_BADGE).map(([value, b]) => ({ value, label: b.text })) },
        ]}
        dateFilters={[{ name: "from", label: "From" }, { name: "to", label: "To" }]}
      />

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY" value={pkr(k.today_amount ?? 0)} tone="navy" />
        <KPI label="THIS MONTH" value={pkr(k.month_amount ?? 0)} tone="aqua" />
        <KPI label="PENDING APPROVAL" value={pendingExpenses.length} tone={pendingExpenses.length > 0 ? "amber" : "slate"} />
        <KPI label="TOP CATEGORY" value={topCategory ? topCategory[0] : "—"} tone="coral" sub={topCategory ? `${pkr(topCategory[1])} this month` : "no spend yet this month"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mb-6">
        {(categories || []).map((c) => (
          <Link
            key={c.id} href={`/expenses?category=${c.id}`}
            className={`card-lift flex flex-col gap-1.5 p-3.5 rounded-2xl border ${categoryFilter === c.id ? "border-aqua bg-aquaSoft" : "border-line bg-card"}`}
          >
            <Tag size={15} className="text-aqua" />
            <span className="text-[12.5px] font-semibold truncate">{c.name}</span>
            <span className="font-mono-num text-sm font-semibold">{pkr(catById[c.id]?.all_total || 0)}</span>
            <span className="text-[10.5px] text-slate">{catById[c.id]?.all_count || 0} entries</span>
          </Link>
        ))}
      </div>

      {isOwner && <PendingApprovals expenses={pendingExpenses} />}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Category, Description, Amount, Date, Method"
          action={bulkImportExpenses}
          sampleRow={{ Category: "Fuel", Description: "Bike fuel", Amount: 500, Date: "2026-08-31", Method: "Cash" }}
          previewType="expenses"
        />
        <DocumentActionBar
          print
          excel={{ loadRows: exportExpenseRows.bind(null, filters), sheetName: "Expenses", reportTitle: "Expenses", branding }}
          share={{ title: "Expenses" }}
        />
        <AddExpenseForm initialOpen={sp.quick === "new"} categories={categories || []} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{matching.toLocaleString()} matching · {(k.total_count ?? 0).toLocaleString()} total</p>
      <BulkSelectProvider noun="expense" actions={canVoid ? [{ key: "void", label: "Void", icon: "ban", action: voidExpense, busyLabel: "Voiding", doneLabel: "Void", detailText: "Each expense is voided exactly as with the single Void button (its journal entry is reversed; the original stays for the audit trail)." }] : []}>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canVoid && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th>Method</Th><Th>Entered By</Th><Th>Receipt</Th><Th>Status</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canVoid ? 10 : 9} className="text-center py-8 text-slate">No expenses match.</td></tr>}
            {rows.map((e) => {
              const badge = STATUS_BADGE[e.status] || STATUS_BADGE.approved;
              const previewFields = [
                { label: "Date", value: fmtDate(e.expense_date) },
                { label: "Category", value: e.expense_categories?.name },
                { label: "Amount", value: pkr(e.amount), emphasis: true },
                { label: "Method", value: e.payment_method },
                { label: "Entered By", value: e.profiles?.full_name || "—" },
                { label: "Status", value: badge.text },
                { label: "Receipt / Reference", value: e.receipt_reference || "—" },
                { label: "Description", value: e.description, fullWidth: true },
                ...(e.void_reason ? [{ label: "Void Reason", value: e.void_reason, fullWidth: true }] : []),
              ];
              const previewExcel = [{ Date: e.expense_date, Category: e.expense_categories?.name, Description: e.description, Amount: e.amount, Method: e.payment_method, EnteredBy: e.profiles?.full_name, Receipt: e.receipt_reference, Status: badge.text }];
              return (
                <tr key={e.id} className={`hover:bg-foam ${e.voided ? "opacity-60" : ""}`}>
                  {canVoid && <Td className="no-print">{!e.voided ? <RowCheckbox id={e.id} label={e.expense_no || e.description} /> : null}</Td>}
                  <Td>{fmtDate(e.expense_date)}</Td><Td>{e.expense_categories?.name}</Td><Td>{e.description}</Td><Td>{pkr(e.amount)}</Td><Td>{e.payment_method}</Td>
                  <Td>{e.profiles?.full_name || "—"}</Td><Td className="text-xs text-slate max-w-[140px] truncate">{e.receipt_reference || "—"}</Td>
                  <Td><Badge text={badge.text} tone={badge.tone} />{e.voided && e.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{e.void_reason}</div>}</Td>
                  <Td className="no-print">
                    <div className="flex items-center gap-1.5">
                      <RecordPreview iconOnly title={`${e.expense_categories?.name || "Expense"} · ${pkr(e.amount)}`} subtitle="Read-only expense preview" fields={previewFields} excelRows={previewExcel} excelTitle={`Expense_${e.expense_date}`} />
                      {e.payment_method === "bank" && ["approved", "paid"].includes(e.status) && (
                        <DocumentActionBar compact pdfHref={`/api/pdf/bank-payment-voucher/expenses/${e.id}`} pdfLabel="BPV" />
                      )}
                      {isOwner && !e.voided && e.status !== "void" && <AddExpenseForm expense={e} categories={categories || []} />}
                      {canVoid && !e.voided && <ReasonConfirmButton action={voidExpense} id={e.id} confirmText={`Void expense "${e.description || e.expense_categories?.name}"?`} />}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>
      <Pager basePath="/expenses" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={matching} label="Expense pages" />
      <DocumentPrintFooter />
    </div>
  );
}
