import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import RecordPreview from "@/components/RecordPreview";
import { bulkImportSales } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { Search } from "lucide-react";

export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "slate" };

export default async function SalesPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [branding, { data: invoices }, { data: customers }, { data: products }] = await Promise.all([
    getBrandingLite(supabase),
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name, default_product_id"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const q = (sp.q || "").trim().toLowerCase();
  const rows = (invoices || []).filter((s) => !q || `${s.invoice_no || ""} ${s.customers?.name || ""} ${s.invoice_date || ""}`.toLowerCase().includes(q));
  const exportRows = rows.map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Sales" meta={`${(invoices || []).length} invoices\nGenerated ${fmtDate(today)}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Sales</h2>
      <p className="no-print text-sm text-slate mb-4">Search first, preview any record safely, then open the full invoice only when you need to edit or act.</p>

      <form className="no-print flex flex-wrap gap-2.5 mb-4" action="/sales">
        <input type="search" name="q" defaultValue={sp.q || ""} placeholder="Search invoice, customer or date…" className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-64" />
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-bold"><Search size={14} /> Search</button>
        {q ? <Link href="/sales" className="self-center text-xs text-slate">Clear</Link> : null}
      </form>

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, Paid, Date, Method, Product (optional — size/sku, defaults to 19L)"
          action={bulkImportSales}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, Paid: 500, Date: "2026-08-31", Method: "Cash", Product: "19L" }}
          previewType="sales"
        />
        <ExportExcelButton rows={exportRows} sheetName="Sales" reportTitle="Sales" branding={branding} />
        <DownloadPdfButton href={`/api/pdf/daily-sales?date=${today}`} label="Download Today's PDF" />
        <PrintButton />
        <AddSaleForm customers={customers || []} products={products || []} initialOpen={sp.quick === "new"} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} sales records</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No sales match.</td></tr>}
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
                  <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                  <Td>{fmtDate(s.invoice_date)}</Td>
                  <Td>{s.customers?.name}</Td>
                  <Td>{qtyOf(s)}</Td>
                  <Td>{pkr(s.net_amount)}</Td>
                  <Td><Badge text={statusLabel} tone={STATUS_TONE[s.status] || "slate"} /></Td>
                  <Td className="no-print">
                    <RecordPreview iconOnly title={`${s.invoice_no} · ${s.customers?.name || "Sale"}`} subtitle="Read-only sale preview" fields={previewFields} excelRows={previewExcel} excelTitle={s.invoice_no || "Sale"} openHref={`/sales/${s.id}`} openLabel="Open Invoice" />
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
