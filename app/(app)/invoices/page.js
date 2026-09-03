import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportSales } from "@/app/actions";

// UX redesign Phase 1 — minimal Invoice Center list. Invoices in this
// schema ARE the invoices table (createSale/bulkImportSales generate one
// per sale; sales/[id]/page.js is already the branded invoice document,
// reused here unchanged rather than duplicated). Phase 5 adds the KPI row
// (Today's Invoices/This Month/Unpaid/Total Billed) and search/filters on
// top of this same data — this pass only moves it into the nav's new
// Invoices slot with a working list underneath it.
export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "slate" };

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: customers }, { data: products }] = await Promise.all([
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name, default_product_id"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const exportRows = (invoices || []).map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Invoices</h2>
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
        <DownloadPdfButton href={`/api/pdf/daily-sales?date=${new Date().toISOString().slice(0, 10)}`} label="Download Today's PDF" />
        <PrintButton />
        <AddSaleForm customers={customers || []} products={products || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(invoices || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No invoices yet.</td></tr>}
            {(invoices || []).map((s) => (
              <tr key={s.id} className="hover:bg-foam">
                <Td><Link href={`/sales/${s.id}`} className="font-semibold text-navy hover:text-aqua">{s.invoice_no}</Link></Td>
                <Td>{fmtDate(s.invoice_date)}</Td>
                <Td>{s.customers?.name}</Td>
                <Td>{qtyOf(s)}</Td>
                <Td>{pkr(s.net_amount)}</Td>
                <Td><Badge text={STATUS_LABEL[s.status] || s.status} tone={STATUS_TONE[s.status] || "slate"} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
