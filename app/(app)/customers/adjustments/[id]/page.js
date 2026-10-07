import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadAdjustmentDoc } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { AdjustmentDoc } from "@/components/ew/docs/ClosingDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function AdjustmentPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadAdjustmentDoc(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Adjustment" fallbackHref="/ledger"><EwMissing title="Adjustment not found" /></DocumentViewer>;
  const { adjustment: a, customer: c } = data;
  const kind = a.adjustment_type === "credit" ? "Credit Note" : "Debit Note";
  const text = `Assalam-o-Alaikum ${c.name},\nEvergreen Water ${kind} ${a.adjustment_no} (${fmtDate(a.adjustment_date)}): ${pkr(a.amount)}\nReason: ${a.reason}\nYour balance is now ${pkr(data.after)}.`;
  return (
    <DocumentViewer title={`${kind} ${a.adjustment_no}`} subtitle={`${c.name} · ${fmtDate(a.adjustment_date)}`} fallbackHref={`/customers/${c.id}`}
      excel={{ title: `${kind} ${a.adjustment_no}`, period: fmtDate(a.adjustment_date), filters: [["Customer", `${c.code || ""} ${c.name}`]], sheets: [{ name: kind, columns: [{ key: "no", label: "Adjustment #", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "type", label: "Type", type: "text" }, { key: "amount", label: "Amount", type: "money" }, { key: "before", label: "Balance Before", type: "money" }, { key: "after", label: "Balance After", type: "money" }, { key: "reason", label: "Reason", type: "text" }], rows: [{ no: a.adjustment_no, date: a.adjustment_date, type: kind, amount: Number(a.amount), before: data.before, after: data.after, reason: a.reason }] }] }}
      whatsapp={c.whatsapp_number || c.mobile ? { phone: c.whatsapp_number || c.mobile, text } : undefined}
      share={{ title: `${kind} ${a.adjustment_no}`, text }}>
      <AdjustmentDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
