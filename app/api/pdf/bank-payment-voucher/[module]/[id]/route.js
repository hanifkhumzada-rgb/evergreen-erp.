import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import BankPaymentVoucherDocument from "@/lib/pdf/BankPaymentVoucherDocument";
import { getBusinessBranding } from "@/lib/pdf/business";
import { pdfContentDisposition } from "@/lib/pdf/response";

const EXPENSE_TX_TYPE_FALLBACK = "Expense Payment";

export async function GET(request, { params }) {
  const { module: mod, id } = params;
  if (mod !== "expenses" && mod !== "payments") {
    return new NextResponse("Unknown voucher module", { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const permissionKey = mod === "expenses" ? "expenses.view" : "payments.view";
  const [{ data: canView, error: viewPermissionError }, { data: canExport, error: exportPermissionError }] = await Promise.all([
    supabase.rpc("fn_has_permission", { perm_key: permissionKey }),
    supabase.rpc("fn_has_permission", { perm_key: "reports.export_pdf" }),
  ]);

  if (viewPermissionError || exportPermissionError || !canView || !canExport) {
    return new NextResponse("You do not have permission to view or export this voucher", { status: 403 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return new NextResponse("PDF service is not configured on the server", { status: 500 });
  }

  const [{ data: record, error: recordError }, branding] = await Promise.all([
    mod === "expenses"
      ? admin.from("expenses").select("*, expense_categories(name), profiles!expenses_employee_id_fkey(employee_code, full_name)").eq("id", id).single()
      : admin.from("payments").select("*, customers(code, name)").eq("id", id).single(),
    getBusinessBranding(admin),
  ]);

  if (recordError || !record) {
    return new NextResponse(`${mod === "expenses" ? "Expense" : "Payment"} not found`, { status: 404 });
  }

  const method = mod === "expenses" ? record.payment_method : record.method;
  if (method !== "bank") {
    return new NextResponse("Bank Payment Voucher is only available for bank-method transactions", { status: 400 });
  }

  const { data: bpvNo, error: bpvError } = await admin.rpc("fn_get_or_create_bpv_no", { p_module: mod, p_id: id });
  if (bpvError) return new NextResponse(`Could not prepare voucher: ${bpvError.message}`, { status: 500 });

  const { data: entry } = await admin
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
      "Cache-Control": "private, no-store",
    },
  });
}
