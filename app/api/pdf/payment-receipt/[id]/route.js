import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import PaymentReceiptDocument from "@/lib/pdf/PaymentReceiptDocument";
import { getBusinessBranding } from "@/lib/pdf/business";
import { pdfContentDisposition } from "@/lib/pdf/response";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const branding = await getBusinessBranding(supabase);
  const { data: payment } = await supabase.from("payments").select("*, customers(name), profiles!payments_received_by_fkey(full_name)").eq("id", params.id).single();
  if (!payment) return new NextResponse("Payment not found", { status: 404 });

  const buffer = await renderToBuffer(
    <PaymentReceiptDocument payment={payment} customer={payment.customers} receivedBy={payment.profiles?.full_name} branding={branding} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(request, `receipt-${payment.receipt_no}.pdf`),
    },
  });
}
