import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";
import AddSaleForm from "@/components/AddSaleForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportSales } from "@/app/actions";

export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "slate" };

export default async function SalesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: customers }] = await Promise.all([
    supabase.from("invoices").select("*, customers(name), invoice_items(quantity)").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("id, name"),
  ]);

  const qtyOf = (s) => (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0);
  const exportRows = (invoices || []).map((s) => ({
    Invoice: s.invoice_no, Date: s.invoice_date, Customer: s.customers?.name, Qty: qtyOf(s), Total: s.net_amount, Status: STATUS_LABEL[s.status] || s.status,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Sales</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Phone (or Name), Qty, Paid, Date, Method"
          action={bulkImportSales}
          sampleRow={{ Phone: "03001234567", Name: "Ali Traders", Qty: 5, Paid: 500, Date: "2026-08-31", Method: "Cash" }}
          previewType="sales"
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-sales.xlsx" sheetName="Sales" />
        <DownloadPdfButton href={`/api/pdf/daily-sales?date=${new Date().toISOString().slice(0, 10)}`} label="Download Today's PDF" />
        <PrintButton />
        <AddSaleForm customers={customers || []} />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Invoice #</Th><Th>Date</Th><Th>Customer</Th><Th>Qty</Th><Th>Total</Th><Th>Status</Th></tr></thead>
          <tbody>
            {(invoices || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No sales yet.</td></tr>}
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
