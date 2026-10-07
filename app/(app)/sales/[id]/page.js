import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { appOrigin } from "@/lib/appOrigin";
import { loadInvoiceDoc } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import InvoiceDoc, { invoiceExcel } from "@/components/ew/docs/InvoiceDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

// Invoice — opens inside the ERP Document Viewer (Back/Print/PDF/Excel/
// WhatsApp/Share/Close). Every link to "/sales/<id>" across the ERP lands here.
export default async function InvoicePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadInvoiceDoc(supabase, id), getBrandingLite(supabase)]);

  if (!data) {
    return (
      <DocumentViewer title="Invoice" fallbackHref="/invoices">
        <EwMissing title="Invoice not found" />
      </DocumentViewer>
    );
  }
  const { invoice, customer: c, totals } = data;
  const portal = `${appOrigin()}/portal/statement`;
  const text = `Assalam-o-Alaikum ${c.name || ""},\nEvergreen Water Invoice ${invoice.invoice_no} (${fmtDate(invoice.invoice_date)})\nInvoice amount: ${pkr(totals.total)}\nPayment received: ${pkr(totals.paid)}\nCurrent outstanding: ${pkr(totals.outstanding)}\nView your statement: ${portal}\nThank you!`;

  return (
    <DocumentViewer
      title={`Invoice ${invoice.invoice_no}`}
      subtitle={`${c.name || "Customer"} · ${fmtDate(invoice.invoice_date)}`}
      fallbackHref="/invoices"
      excel={invoiceExcel(data)}
      whatsapp={c.whatsapp_number || c.mobile ? { phone: c.whatsapp_number || c.mobile, text } : undefined}
      share={{ title: `Invoice ${invoice.invoice_no}`, text }}
    >
      <InvoiceDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
