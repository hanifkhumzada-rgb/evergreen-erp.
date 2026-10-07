import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadPurchaseVoucher } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { PurchaseVoucherDoc } from "@/components/ew/docs/VoucherDocs";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadPurchaseVoucher(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Purchase Voucher" fallbackHref="/inventory"><EwMissing title="Purchase Voucher not found" /></DocumentViewer>;
  const p = data.purchase;
  const title = `Purchase Voucher ${p.purchase_no || ""}`.trim();
  const text = `*Evergreen Water — ${title}*\n${fmtDate(p.purchase_date)} · ${p.suppliers?.name || ""}\nTotal: ${pkr(data.total)}`;
  return (
    <DocumentViewer title={title} subtitle={`${p.suppliers?.name || "Supplier"} · ${fmtDate(p.purchase_date)}`} fallbackHref="/inventory"
      excel={{ title, period: fmtDate(p.purchase_date), filters: [["Supplier", p.suppliers?.name]], sheets: [{ name: "Items", columns: [{ key: "item", label: "Item", type: "text" }, { key: "qty", label: "Qty", type: "number" }, { key: "rate", label: "Rate", type: "money", noTotal: true }, { key: "discount", label: "Discount", type: "money" }, { key: "amount", label: "Amount", type: "money" }], rows: data.items, totals: true }] }}
      whatsapp={{ phone: p.suppliers?.phone || "", text }} share={{ title, text }}>
      <PurchaseVoucherDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
