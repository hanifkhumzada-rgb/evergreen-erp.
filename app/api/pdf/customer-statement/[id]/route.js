import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import CustomerStatementDocument from "@/lib/pdf/CustomerStatementDocument";
import { getBusinessBranding } from "@/lib/pdf/business";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const branding = await getBusinessBranding(supabase);

  // Optional month/year scoping (Customer Portal's Monthly Statement) —
  // absent for every existing staff caller, which keeps returning the
  // full all-time statement exactly as before.
  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  const isScoped = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year);
  const periodStart = isScoped ? new Date(Date.UTC(year, month - 1, 1)) : null;
  const periodEnd = isScoped ? new Date(Date.UTC(year, month, 1)) : null;

  const [{ data: customer }, { data: entries }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", params.id).single(),
    supabase.from("customer_ledger_entries").select("entry_date, reference_type, description, debit, credit, created_at")
      .eq("customer_id", params.id).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (!customer) return new NextResponse("Customer not found", { status: 404 });

  // The customer's opening_balance is shown as its own statement line, so
  // the ledger's own 'opening' entry (fn_post_opening_balance posts one
  // automatically at registration, carrying the exact same amount) is
  // excluded from the transaction rows below — otherwise it would be
  // counted twice, once as the Opening Balance line and once as a row in
  // the table.
  const allEntries = (entries || []).filter((e) => e.reference_type !== "opening");
  const baseOpeningBalance = Number(customer.opening_balance) || 0;

  // For a scoped (monthly) statement, "opening balance" is the running
  // balance as of the start of that month — every entry before the
  // period is folded in rather than shown as a row, same convention the
  // all-time statement already uses for customer.opening_balance itself.
  let openingBalance = baseOpeningBalance;
  let periodEntries = allEntries;
  if (isScoped) {
    const before = allEntries.filter((e) => new Date(e.entry_date) < periodStart);
    openingBalance = before.reduce((bal, e) => bal + (Number(e.debit) || 0) - (Number(e.credit) || 0), baseOpeningBalance);
    periodEntries = allEntries.filter((e) => new Date(e.entry_date) >= periodStart && new Date(e.entry_date) < periodEnd);
  }

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = periodEntries.map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    return { date: e.entry_date, description: e.description, debit, credit, balance: running };
  });

  const period = isScoped ? `Period: ${periodStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${year}` : undefined;

  const buffer = await renderToBuffer(
    <CustomerStatementDocument customer={customer} rows={rows} openingBalance={openingBalance} totalDebit={totalDebit} totalCredit={totalCredit} closingBalance={running} branding={branding} period={period} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
