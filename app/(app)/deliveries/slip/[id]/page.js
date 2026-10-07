import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadDeliverySlip } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { DeliverySlipDoc } from "@/components/ew/docs/VoucherDocs";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadDeliverySlip(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Delivery Slip" fallbackHref="/deliveries"><EwMissing title="Delivery Slip not found" /></DocumentViewer>;
  const { delivery: d, customer: c } = data;
  const title = `Delivery Slip ${d.delivery_no || ""}`.trim();
  const qtyOut = (d.delivery_items || []).reduce((a, i) => a + (Number(i.delivered_qty) || 0), 0);
  const back = (d.delivery_items || []).reduce((a, i) => a + (Number(i.returned_qty) || 0), 0);
  const text = `Assalam-o-Alaikum ${c.name || ""},\nEvergreen Water delivery ${d.delivery_no || ""} on ${fmtDate(d.delivery_date)}\nBottles delivered: ${qtyOut} · Empty returned: ${back}\nAmount: ${pkr(d.amount)}\nBottles with you: ${data.bottleBalance}\nCurrent balance: ${pkr(data.balance)}`;
  return (
    <DocumentViewer title={title} subtitle={`${c.name || "Customer"} · ${fmtDate(d.delivery_date)}`} fallbackHref="/deliveries"
      excel={{ title, period: fmtDate(d.delivery_date), filters: [["Customer", `${c.code || ""} ${c.name || ""}`]], sheets: [{ name: "Delivery", columns: [{ key: "product", label: "Product", type: "text" }, { key: "expected", label: "Ordered", type: "int" }, { key: "delivered", label: "Delivered", type: "int" }, { key: "returned", label: "Empty Returned", type: "int" }, { key: "rate", label: "Rate", type: "money", noTotal: true }, { key: "amount", label: "Amount", type: "money" }], rows: (d.delivery_items || []).map((i) => ({ product: i.products?.name, expected: i.expected_qty, delivered: i.delivered_qty, returned: i.returned_qty, rate: i.unit_price, amount: i.amount })), totals: true }] }}
      whatsapp={c.whatsapp_number || c.mobile ? { phone: c.whatsapp_number || c.mobile, text } : undefined} share={{ title, text }}>
      <DeliverySlipDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
