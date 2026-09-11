import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import BankPaymentVoucherDocument from "@/lib/pdf/BankPaymentVoucherDocument";
import { getBusinessBranding } from "@/lib/pdf/business";
import { pdfContentDisposition } from "@/lib/pdf/response";

const EXPENSE_TX_TYPE_FALLBACK = "Expense Payment";

// Bank Payment Voucher — only ever for bank-method expenses/payments (a cash
// one uses the existing Payment Receipt Voucher instead). Renders the
// journal entry the expense/payment already posted (fn_journal_from_expense
// / fn_journal_from_payment, migration 0002) rather than reconstructing the
// debit/credit split here, so the voucher can never drift from the books.
export async function GET(request, { params }) {
  const { module: mod, id } = params;
  if (mod !== "expenses" && mod !== "payments") {
    return new NextResponse("Unknown voucher module", { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: record, error: recordError }, branding] = await Promise.all([
    mod === "expenses"
      ? supabase.from("expenses").select("*, expense_categories(name), profiles!expenses_employee_id_fkey(employee_code, full_name)").eq("id", id).single()
      : supabase.from("payments").select("*, customers(code, name)").eq("id", id).single(),
    getBusinessBranding(supabase),
  ]);
  if (recordError || !record) return new NextResponse(`${mod === "expenses" ? "Expense" : "Payment"} not found`, { status: 404 });

  const method = mod === "expenses" ? record.payment_method : record.method;
  if (method !== "bank") return new NextResponse("Bank Payment Voucher is only available for bank-method transactions", { status: 400 });

  const { data: bpvNo, error: bpvError } = await supabase.rpc("fn_get_or_create_bpv_no", { p_module: mod, p_id: id });
  if (bpvError) return new NextResponse(bpvError.message, { status: 403 });

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("*, journal_lines(*, chart_of_accounts(code, name))")
    .eq("source_module", mod)
    .eq("source_id", id)
    .maybeSingle();

  const party = mod === "expenses"
    ? (record.profiles ? { code: record.profiles.employee_code, name: record.profiles.full_name } : null)
    : (record.customers ? { code: record.customers.code, name: record.customers.name } : null);

  const buffer = await renderToBuffer(
    <BankPaymentVoucherDocument
      record={{ ...record, bpv_no: bpvNo }}
      module={mod}
      date={mod === "expenses" ? record.expense_date : record.payment_date}
      party={party}
      transactionType={mod === "expenses" ? (record.expense_categories?.name || EXPENSE_TX_TYPE_FALLBACK) : "Customer Payment"}
      chequeRef={mod === "expenses" ? record.receipt_reference : record.reference}
      entry={entry}
      lines={entry?.journal_lines || []}
      currency={branding.currency}
      branding={branding}
    />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(request, `bpv-${bpvNo}.pdf`),
    },
  });
}
