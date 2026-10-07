import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, DocumentActionBar, RecordStamp, RowActionMenu, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import RecordPreview from "@/components/RecordPreview";
import { bulkImportSales, voidInvoice } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { invoiceFilters, applyInvoiceFilters, matchingCustomerIds } from "@/lib/listQueries";
import { exportInvoiceRows } from "@/lib/exportActions";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { INVOICE_STATUS_LABEL as STATUS_LABEL, INVOICE_STATUS_TONE as STATUS_TONE } from "@/lib/invoiceStatus";
import { BulkSelectProvider, SelectAllCheckbox, RowCheckbox } from "@/components/BulkSelect";

export const dynamic = "force-dynamic";

// Rows per page. Paging, search and filters run in the database; the KPIs
// come from fn_invoice_kpis (aggregated under RLS), so the page no longer
// downloads the whole invoice history on every load.
const PAGE_SIZE = 50;

export default async function InvoicesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const filters = invoiceFilters(sp);
  const page = pageFrom(sp);
  const [from, to] = rangeFor(page, PAGE_SIZE);
  const customerIds = filters.q ? await matchingCustomerIds(supabase, filters.q) : null;
  const [branding, { data: invoices, count }, { data: kpis }, { data: customers }, { data: products }, { data: canVoid }] = await Promise.all([
    getBrandingLite(supabase),
    applyInvoiceFilters(
      supabase.from("invoices").select("id, invoice_no, invoice_date, status, net_amount, void_reason, created_at, customers(name), invoice_items(quantity), creator:profiles!invoices_created_by_fkey(full_name)", { count: "exact" }),
      filters, customerIds,
    ).order("created_at", { ascending: false }).order("id").range(from, to),
    supabase.rpc("fn_invoice_kpis"),
    supabase.from("customers").select("id, name, default_product_id"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "invoices.delete" }),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const k = kpis || {};
  const pageRows = invoices || [];
  const matching = count || 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Invoice Center" meta={`${matching} of ${k.total_count ?? 0} invoices\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Invoice Center</h2>
      <p className="no-print text-slate text-sm mb-4">Search and preview invoices first; open the full document only when you need to act.</p>

      <ListFilterBar
        placeholder="Search invoice #, customer name, code or phone…"
        filters={[{ name: "status", label: "All statuses", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) }]}
        dateFilters={[{ name: "from", label: "From" }, { name: "to", label: "To" }]}
      />

      <div className="no-print flex flex-wrap gap-3.5 mb-5">
        <KPI label="TODAY'S INVOICES" value={k.today_count ?? 0} tone="navy" sub={pkr(k.today_amount ?? 0)} />
        <KPI label="THIS MONTH" value={k.month_count ?? 0} tone="aqua" sub={pkr(k.month_amount ?? 0)} />
        <KPI label="UNPAID" value={k.unpaid_count ?? 0} tone="coral" sub={pkr(k.unpaid_amount ?? 0)} />
        <KPI label="TOTAL BILLED" value={pkr(k.billed_amount ?? 0)} tone="slate" sub={`${k.total_count ?? 0} invoices all-time`} />
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
        <DocumentActionBar
          print
          pdfHref={`/api/pdf/daily-sales?date=${today}`}
          pdfLabel="Today's Report"
          excel={{ loadRows: exportInvoiceRows.bind(null, filters), sheetName: "Invoices", reportTitle: "Invoice Center", branding }}
          share={{ title: "Invoice Center" }}
        />
        <AddSaleForm customers={customers || []} products={products || []} initialCustomerId={sp.customer || ""} initialOpen={sp.quick === "new"} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{matching.toLocaleString()} matching · {(k.total_count ?? 0).toLocaleString()} total</p>
      <BulkSelectProvider noun="invoice" actions={canVoid ? [{ key: "void", label: "Void", icon: "ban", action: voidInvoice, busyLabel: "Voiding", doneLabel: "Void", detailText: "Each invoice is voided exactly as with the single Void button (reversing its ledger effect; the original stays for the audit trail). Paid or part-paid invoices can't be selected." }] : []}>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canVoid && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th>Details</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={canVoid ? 9 : 8} className="text-center py-8 text-slate">No invoices match.</td></tr>}
            {pageRows.map((s) => {
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
                  {canVoid && <Td className="no-print">{canVoidThis ? <RowCheckbox id={s.id} label={s.invoice_no} /> : null}</Td>}
                  <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                  <Td>{fmtDate(s.invoice_date)}</Td>
                  <Td>{s.customers?.name}</Td>
                  <Td>{qtyOf(s)}</Td>
                  <Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={statusLabel} tone={STATUS_TONE[s.status] || "slate"} />{s.status === "void" && s.void_reason && <div className="text-[10px] text-slate mt-1 max-w-[140px]">{s.void_reason}</div>}</Td>
                  <Td><RecordStamp date={s.created_at} user={s.creator?.full_name} /></Td>
                  <Td className="no-print"><RowActionMenu label={`Actions for invoice ${s.invoice_no}`}>
                      <Link href={`/sales/${s.id}`} title="View Invoice" className="flex items-center gap-1.5 text-xs font-semibold"><FileText size={14} /></Link>
                      <RecordPreview iconOnly title={`${s.invoice_no} · ${s.customers?.name || "Invoice"}`} subtitle="Read-only invoice preview" fields={previewFields} excelRows={previewExcel} excelTitle={s.invoice_no || "Invoice"} openHref={`/sales/${s.id}`} openLabel="Open Invoice" />
                      {canVoidThis && <ReasonConfirmButton action={voidInvoice} id={s.id} confirmText={`Void invoice ${s.invoice_no}?`} />}
                  </RowActionMenu></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>
      <Pager basePath="/invoices" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={matching} label="Invoice pages" />
      <DocumentPrintFooter />
    </div>
  );
}
