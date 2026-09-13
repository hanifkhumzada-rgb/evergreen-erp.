import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import RecordPreview from "@/components/RecordPreview";
import { bulkImportSales, voidInvoice } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "coral" };

export default async function InvoicesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [branding, { data: invoices }, { data: customers }, { data: products }, { data: canVoid }] = await Promise.all([
    getBrandingLite(supabase),
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
    if (q && !`${s.invoice_no} ${s.customers?.name || ""} ${s.invoice_date || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const hasFilters = q || statusFilter;
  const exportRows = rows.map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Invoice Center" meta={`${rows.length} of ${allRows.length} invoices\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Invoice Center</h2>
      <p className="no-print text-slate text-sm mb-4">Search and preview invoices first; open the full document only when you need to act.</p>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/invoices">
        <input type="text" name="q" defaultValue={sp.q || ""} placeholder="Search invoice #, customer, date…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-60" />
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold"><Search size={14} /> Search</button>
        {hasFilters && <Link href="/invoices" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY'S INVOICES" value={todaysInvoices.length} tone="navy" sub={pkr(todaysInvoices.filter((s) => s.status !== "void").reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="THIS MONTH" value={monthInvoices.length} tone="aqua" sub={pkr(monthInvoices.filter((s) => s.status !== "void").reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="UNPAID" value={unpaidInvoices.length} tone="coral" sub={pkr(unpaidInvoices.reduce((a, s) => a + Number(s.net_amount), 0))} />
        <KPI label="TOTAL BILLED" value={pkr(totalBilled)} tone="slate" sub={`${allRows.length} invoices all-time`} />
      </div>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, Paid, Date, Method, Product (optional — size/sku, defaults to 19L)"
          action={bulkImportSales}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, Paid: 500, Date: "2026-08-31", Method: "Cash", Product: "19L" }}
          previewType="sales"
        />
        <ExportExcelButton rows={exportRows} sheetName="Invoices" reportTitle="Invoice Center" branding={branding} />
        <DownloadPdfButton href={`/api/pdf/daily-sales?date=${today}`} label="Download Today's PDF" />
        <PrintButton />
        <AddSaleForm customers={customers || []} products={products || []} initialCustomerId={sp.customer || ""} initialOpen={sp.quick === "new"} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} invoices</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No invoices match.</td></tr>}
            {rows.map((s) => {
              const canVoidThis = canVoid && s.status !== "void" && !["paid", "partially_paid"].includes(s.status);
              const statusLabel = STATUS_LABEL[s.status] || s.status;
              const previewFields = [
                { label: "Invoice #", value: s.invoice_no, emphasis: true },
                { label: "Invoice Date", value: fmtDate(s.invoice_date) },
                { label: "Customer", value: s.customers?.name },
                { label: "Quantity", value: qtyOf(s) },
                { label: "Net Amount", value: pkr(s.net_amount), emphasis: true },
                { label: "Status", value: statusLabel },
                ...(s.void_reason ? [{ label: "Void Reason", value: s.void_reason, fullWidth: true }] : []),
              ];
              const previewExcel = [{ Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Quantity: qtyOf(s), Total: s.net_amount, Status: statusLabel }];
              return (
                <tr key={s.id} className={`hover:bg-foam ${s.status === "void" ? "opacity-60" : ""}`}>
                  <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                  <Td>{fmtDate(s.invoice_date)}</Td>
                  <Td>{s.customers?.name}</Td>
                  <Td>{qtyOf(s)}</Td>
                  <Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={statusLabel} tone={STATUS_TONE[s.status] || "slate"} />{s.status === "void" && s.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{s.void_reason}</div>}</Td>
                  <Td className="no-print">
                    <div className="flex items-center gap-1.5">
                      <RecordPreview iconOnly title={`${s.invoice_no} · ${s.customers?.name || "Invoice"}`} subtitle="Read-only invoice preview" fields={previewFields} excelRows={previewExcel} excelTitle={s.invoice_no || "Invoice"} openHref={`/sales/${s.id}`} openLabel="Open Invoice" />
                      {canVoidThis && <ReasonConfirmButton action={voidInvoice} id={s.id} confirmText={`Void invoice ${s.invoice_no}?`} />}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DocumentPrintFooter />
    </div>
  );
}
