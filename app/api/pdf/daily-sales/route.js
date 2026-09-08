import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import DailySalesDocument from "@/lib/pdf/DailySalesDocument";
import { getBusinessBranding } from "@/lib/pdf/business";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const branding = await getBusinessBranding(supabase);
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const { data: invoices } = await supabase.from("invoices")
    .select("id, invoice_no, net_amount, status, customers(name), invoice_items(quantity)")
    .eq("invoice_date", date).neq("status", "void").order("created_at", { ascending: true });

  const rows = (invoices || []).map((s) => ({ ...s, qty: (s.invoice_items || []).reduce((a, i) => a + Number(i.quantity), 0) }));
  const totalAmount = rows.reduce((a, s) => a + Number(s.net_amount), 0);

  const buffer = await renderToBuffer(<DailySalesDocument date={date} rows={rows} totalAmount={totalAmount} businessName={branding.businessName} address={branding.address} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="daily-sales-${date}.pdf"`,
    },
  });
}
