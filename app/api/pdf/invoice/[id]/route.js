import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import InvoiceDocument from "@/lib/pdf/InvoiceDocument";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: invoice } = await supabase.from("invoices").select("*, customers(*), invoice_items(*)").eq("id", params.id).single();
  if (!invoice) return new NextResponse("Invoice not found", { status: 404 });
  const customer = invoice.customers;

  const [{ data: payments }, { data: priorInvoices }, { data: priorPayments }] = await Promise.all([
    supabase.from("payments").select("amount").eq("customer_id", customer?.id).eq("reference", invoice.invoice_no),
    customer?.id ? supabase.from("invoices").select("net_amount").eq("customer_id", customer.id).lt("created_at", invoice.created_at) : Promise.resolve({ data: [] }),
    customer?.id ? supabase.from("payments").select("amount").eq("customer_id", customer.id).lt("created_at", invoice.created_at) : Promise.resolve({ data: [] }),
  ]);
  const paid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const previousBalance = Number(customer?.opening_balance || 0)
    + (priorInvoices || []).reduce((a, i) => a + Number(i.net_amount), 0)
    - (priorPayments || []).reduce((a, p) => a + Number(p.amount), 0);
  const newBalance = previousBalance + Number(invoice.net_amount) - paid;

  const buffer = await renderToBuffer(
    <InvoiceDocument invoice={invoice} customer={customer} items={invoice.invoice_items || []} paid={paid} previousBalance={previousBalance} newBalance={newBalance} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_no}.pdf"`,
    },
  });
}
