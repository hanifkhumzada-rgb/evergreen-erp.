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
  const openingBalance = Number(customer.opening_balance) || 0;
  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = (entries || []).filter((e) => e.reference_type !== "opening").map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    return { date: e.entry_date, description: e.description, debit, credit, balance: running };
  });

  const buffer = await renderToBuffer(
    <CustomerStatementDocument customer={customer} rows={rows} openingBalance={openingBalance} totalDebit={totalDebit} totalCredit={totalCredit} closingBalance={running} branding={branding} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
