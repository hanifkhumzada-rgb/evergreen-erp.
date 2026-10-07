import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, DocumentActionBar, RowActionMenu, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import RecordPreview from "@/components/RecordPreview";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { bulkImportSales, voidInvoice } from "@/app/actions";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { applyInvoiceFilters, invoiceFilters, matchingCustomerIds } from "@/lib/listQueries";
import { exportInvoiceRows } from "@/lib/exportActions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { INVOICE_STATUS_LABEL as STATUS_LABEL, INVOICE_STATUS_TONE as STATUS_TONE } from "@/lib/invoiceStatus";
import { BulkSelectProvider, SelectAllCheckbox, RowCheckbox } from "@/components/BulkSelect";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function SalesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  // Search / status / dates / paging all run in the database; a search
  // term also matches customer name, ID and phone.
  const filters = invoiceFilters(sp);
  const page = pageFrom(sp);
  const [from, to] = rangeFor(page, PAGE_SIZE);
  const customerIds = filters.q ? await matchingCustomerIds(supabase, filters.q) : null;
  const [branding, { data: invoices, count }, { data: customers }, { data: products }, { data: canVoid }] = await Promise.all([
    getBrandingLite(supabase),
    applyInvoiceFilters(supabase.from("invoices").select("id, invoice_no, invoice_date, net_amount, status, customers(name), invoice_items(quantity)", { count: "exact" }), filters, customerIds)
      .order("created_at", { ascending: false }).order("id").range(from, to),
    supabase.from("customers").select("id, name, default_product_id").order("name"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "invoices.delete" }),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const rows = invoices || [];
  const total = count || 0;
  const exportAction = exportInvoiceRows.bind(null, filters);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Sales" meta={`${total} invoices\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Sales</h2>
      <p className="no-print text-sm text-slate mb-4">Search first, preview any record safely, then open the full invoice only when you need to edit or act.</p>

      <ListFilterBar
        placeholder="Search invoice #, customer name / ID / phone…"
        filters={[{ name: "status", label: "All statuses", options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) }]}
        dateFilters={[{ name: "from", label: "From" }, { name: "to", label: "To" }]}
      />

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
          excel={{ loadRows: exportAction, sheetName: "Sales", reportTitle: "Sales", branding }}
          share={{ title: "Sales" }}
        />
        <AddSaleForm customers={customers || []} products={products || []} initialOpen={sp.quick === "new"} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{total} sales records</p>
      <BulkSelectProvider noun="invoice" actions={canVoid ? [{ key: "void", label: "Void", icon: "ban", action: voidInvoice, busyLabel: "Voiding", doneLabel: "Void", detailText: "Each invoice is voided exactly as with the single Void button (reversing its ledger effect; the original stays for the audit trail). Paid or part-paid invoices can't be selected." }] : []}>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canVoid && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={canVoid ? 8 : 7} className="text-center py-8 text-slate">No sales match.</td></tr>}
            {rows.map((s) => {
              const statusLabel = STATUS_LABEL[s.status] || s.status;
              const previewFields = [
                { label: "Invoice #", value: s.invoice_no, emphasis: true },
                { label: "Date", value: fmtDate(s.invoice_date) },
                { label: "Customer", value: s.customers?.name },
                { label: "Quantity", value: qtyOf(s) },
                { label: "Total", value: pkr(s.net_amount), emphasis: true },
                { label: "Status", value: statusLabel },
              ];
              const previewExcel = [{ Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Quantity: qtyOf(s), Total: s.net_amount, Status: statusLabel }];
              return (
                <tr key={s.id} className="hover:bg-foam">
                  {canVoid && <Td className="no-print">{s.status !== "void" && !["paid", "partially_paid"].includes(s.status) ? <RowCheckbox id={s.id} label={s.invoice_no} /> : null}</Td>}
                  <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                  <Td>{fmtDate(s.invoice_date)}</Td>
                  <Td>{s.customers?.name}</Td>
                  <Td>{qtyOf(s)}</Td>
                  <Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={statusLabel} tone={STATUS_TONE[s.status] || "slate"} /></Td>
                  <Td className="no-print">
                    <RowActionMenu label={`Actions for ${s.invoice_no}`}>
                      <RecordPreview iconOnly title={`${s.invoice_no} · ${s.customers?.name || "Sale"}`} subtitle="Read-only sale preview" fields={previewFields} excelRows={previewExcel} excelTitle={s.invoice_no || "Sale"} openHref={`/sales/${s.id}`} openLabel="Open Invoice" />
                      {canVoid && s.status !== "void" && !["paid", "partially_paid"].includes(s.status) && <ReasonConfirmButton action={voidInvoice} id={s.id} confirmText={`Void invoice ${s.invoice_no}?`} />}
                    </RowActionMenu>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>
      <Pager basePath="/sales" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={total} label="Sales pages" />
      <DocumentPrintFooter />
    </div>
  );
}
