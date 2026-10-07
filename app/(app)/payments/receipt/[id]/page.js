import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { methodLabel } from "@/lib/ew/status";
import { loadReceiptDoc } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import ReceiptDoc, { receiptExcel } from "@/components/ew/docs/ReceiptDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadReceiptDoc(supabase, id), getBrandingLite(supabase)]);
  if (!data) {
    return <DocumentViewer title="Payment Receipt" fallbackHref="/payments"><EwMissing title="Receipt not found" /></DocumentViewer>;
  }
  const { payment: p, customer: c, totals } = data;
  const text = `Assalam-o-Alaikum ${c.name || ""},\nEvergreen Water has received ${pkr(p.amount)} (${methodLabel(p.method)}) on ${fmtDate(p.payment_date)}.\nReceipt: ${p.receipt_no || "—"}\nRemaining outstanding: ${pkr(totals.after)}\nThank you!`;
  return (
    <DocumentViewer
      title={`Receipt ${p.receipt_no || ""}`.trim()}
      subtitle={`${c.name || "Customer"} · ${fmtDate(p.payment_date)}`}
      fallbackHref="/payments"
      excel={receiptExcel(data)}
      whatsapp={c.whatsapp_number || c.mobile ? { phone: c.whatsapp_number || c.mobile, text } : undefined}
      share={{ title: `Receipt ${p.receipt_no || ""}`, text }}
    >
      <ReceiptDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
