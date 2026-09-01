import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import OutstandingDocument from "@/lib/pdf/OutstandingDocument";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: customers }, { data: balances }] = await Promise.all([
    supabase.from("customers").select("id, name, mobile, opening_balance, credit_limit"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const rows = (customers || [])
    .map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const totalOutstanding = rows.reduce((a, c) => a + c.balance, 0);

  const buffer = await renderToBuffer(<OutstandingDocument rows={rows} totalOutstanding={totalOutstanding} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="outstanding-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
