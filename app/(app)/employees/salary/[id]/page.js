import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadSalaryVoucher } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { SalaryVoucherDoc } from "@/components/ew/docs/VoucherDocs";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadSalaryVoucher(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Salary Voucher" fallbackHref="/employees"><EwMissing title="Salary Voucher not found" /></DocumentViewer>;
  const { salary: s, employee: e } = data;
  const title = `Salary Voucher ${e.full_name || ""}`.trim();
  const text = `Evergreen Water salary slip — ${e.full_name}\nMonth: ${fmtDate(s.period_month)}\nNet paid: ${pkr(s.net_paid)} on ${fmtDate(s.paid_date)}`;
  return (
    <DocumentViewer title={title} subtitle={`Paid ${fmtDate(s.paid_date)}`} fallbackHref={e.id ? `/employees/${e.id}` : "/employees"}
      excel={{ title, period: fmtDate(s.period_month), filters: [["Employee", e.full_name]], sheets: [{ name: "Salary", columns: [{ key: "k", label: "Item", type: "text" }, { key: "v", label: "Amount (PKR)", type: "money" }], rows: [{ k: "Basic Salary", v: Number(s.base_salary) }, { k: "Advances Recovered", v: -Number(s.advances) }, { k: "Other Deductions", v: -Number(s.deductions) }, { k: "Net Salary Paid", v: Number(s.net_paid) }] }] }}
      whatsapp={{ phone: e.phone || "", text }} share={{ title, text }}>
      <SalaryVoucherDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
