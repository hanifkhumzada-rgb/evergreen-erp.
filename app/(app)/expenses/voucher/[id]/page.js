import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadExpenseVoucher } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { ExpenseVoucherDoc } from "@/components/ew/docs/VoucherDocs";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadExpenseVoucher(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Expense Voucher" fallbackHref="/expenses"><EwMissing title="Expense Voucher not found" /></DocumentViewer>;
  const e = data.expense;
  const title = `Expense Voucher ${e.expense_no || ""}`.trim();
  const text = `*Evergreen Water — ${title}*\n${fmtDate(e.expense_date)} · ${e.expense_categories?.name || ""}\nAmount: ${pkr(e.amount)}\n${e.description || ""}`;
  return (
    <DocumentViewer title={title} subtitle={`${e.expense_categories?.name || "Expense"} · ${fmtDate(e.expense_date)}`} fallbackHref="/expenses"
      excel={{ title, period: fmtDate(e.expense_date), filters: [], sheets: [{ name: "Expense", columns: [{ key: "no", label: "Voucher #", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "cat", label: "Category", type: "text" }, { key: "desc", label: "Description", type: "text" }, { key: "amount", label: "Amount", type: "money" }, { key: "mode", label: "Mode", type: "text" }, { key: "status", label: "Status", type: "text" }], rows: [{ no: e.expense_no, date: e.expense_date, cat: e.expense_categories?.name, desc: e.description, amount: Number(e.amount), mode: e.payment_method, status: e.voided ? "void" : e.status }] }] }}
      whatsapp={{ phone: "", text }} share={{ title, text }}>
      <ExpenseVoucherDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
