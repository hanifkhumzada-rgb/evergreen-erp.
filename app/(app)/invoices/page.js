import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import VoidButton from "@/components/VoidButton";
import { bulkImportSales, voidInvoice } from "@/app/actions";

// Invoice Center. Invoices in this schema ARE the invoices table
// (createSale/bulkImportSales generate one per sale; sales/[id]/page.js is
// already the branded invoice document, reused here unchanged rather than
// duplicated). invoice_items.rate is a plain stored column set once at
// creation (getEffectiveRate at that moment) — never re-read from
// customer_prices later, so a customer's rate changing afterwards cannot
// change a historical invoice's total; confirmed against the live schema
// (invoice_items.rate: NEVER generated, amount: GENERATED ALWAYS from
// quantity*rate-discount, so only rate/quantity/discount at insert time
// ever feed it).
export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "coral" };

export default async function InvoicesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [{ data: invoices }, { data: customers }, { data: products }, { data: canVoid }] = await Promise.all([
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name, default_product_id"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "invoices.delete" }),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const allRows = invoices || [];

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const todaysInvoices = allRows.filter((s) => s.invoice_date === today);
  const monthInvoices = allRows.filter((s) => s.invoice_date >= monthStart);
  const unpaidInvoices = allRows.filter((s) => ["sent", "partially_paid", "overdue"].includes(s.status));
  const totalBilled = allRows.filter((s) => s.status !== "void").reduce((a, s) => a + Number(s.net_amount), 0);

  const q = (sp.q || "").trim().toLowerCase();
  const statusFilter = sp.status || "";
  const rows = allRows.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (q && !`${s.invoice_no} ${s.customers?.name || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const hasFilters = q || statusFilter;

  const exportRows = rows.map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Invoice Center</h2>
      <p className="text-slate text-sm mb-4">Every invoice, its rate frozen at the moment it was billed.</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY'S INVOICES" value={todaysInvoices.length} tone="navy" sub={pkr(todaysInvoices.filter((s) => s.status !== "void").reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="THIS MONTH" value={monthInvoices.length} tone="aqua" sub={pkr(monthInvoices.filter((s) => s.status !== "void").reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="UNPAID" value={unpaidInvoices.length} tone="coral" sub={pkr(unpaidInvoices.reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="TOTAL BILLED" value={pkr(totalBilled)} tone="slate" sub={`${allRows.length} invoices all-time`} />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/invoices">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search invoice #, customer…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-52" />
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Search</button>
        {hasFilters && <a href="/invoices" className="text-xs text-slate hover:text-aqua">Clear</a>}
      </form>
      {/* Sibling <div>, not inside the filter <form> above — AddSaleForm's
          trigger button has no type="button" set, so nesting it in a form
          makes clicking "New Sale" also submit that form (same bug class
          fixed on /customers). */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, Paid, Date, Method, Product (optional — size/sku, defaults to 19L)"
          action={bulkImportSales}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, Paid: 500, Date: "2026-08-31", Method: "Cash", Product: "19L" }}
          previewType="sales"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-invoices.xlsx" sheetName="Invoices" />
        <DownloadPdfButton href={`/api/pdf/daily-sales?date=${today}`} label="Download Today's PDF" />
        <PrintButton />
        <AddSaleForm customers={customers || []} products={products || []} initialCustomerId={sp.customer || ""} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} invoices</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No invoices match.</td></tr>}
            {rows.map((s) => {
              const canVoidThis = canVoid && s.status !== "void" && !["paid", "partially_paid"].includes(s.status);
              return (
                <tr key={s.id} className={`hover:bg-foam ${s.status === "void" ? "opacity-60" : ""}`}>
                  <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                  <Td>{fmtDate(s.invoice_date)}</Td>
                  <Td>{s.customers?.name}</Td>
                  <Td>{qtyOf(s)}</Td>
                  <Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={STATUS_LABEL[s.status] || s.status} tone={STATUS_TONE[s.status] || "slate"} />{s.status === "void" && s.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{s.void_reason}</div>}</Td>
                  <Td>{canVoidThis && <VoidButton action={voidInvoice} id={s.id} confirmText={`Void invoice ${s.invoice_no}?`} />}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
