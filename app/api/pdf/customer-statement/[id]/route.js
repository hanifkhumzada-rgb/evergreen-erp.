import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import CustomerStatementDocument from "@/lib/pdf/CustomerStatementDocument";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: customer }, { data: entries }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", params.id).single(),
    supabase.from("customer_ledger_entries").select("entry_date, description, debit, credit, created_at")
      .eq("customer_id", params.id).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (!customer) return new NextResponse("Customer not found", { status: 404 });

  let running = Number(customer.opening_balance) || 0;
  let totalSales = 0;
  let totalPaid = 0;
  const rows = (entries || []).map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalSales += debit;
    totalPaid += credit;
    return { date: e.entry_date, description: e.description, debit, credit, balance: running };
  });

  const buffer = await renderToBuffer(
    <CustomerStatementDocument customer={customer} rows={rows} totalSales={totalSales} totalPaid={totalPaid} balance={running} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
