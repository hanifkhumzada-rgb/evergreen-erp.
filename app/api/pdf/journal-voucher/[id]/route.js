import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import JournalVoucherDocument from "@/lib/pdf/JournalVoucherDocument";
import { getBusinessBranding } from "@/lib/pdf/business";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const branding = await getBusinessBranding(supabase);
  const { data: entry } = await supabase.from("journal_entries").select("*, journal_lines(*, chart_of_accounts(code, name))").eq("id", params.id).single();
  if (!entry) return new NextResponse("Journal entry not found", { status: 404 });

  const buffer = await renderToBuffer(<JournalVoucherDocument entry={entry} lines={entry.journal_lines || []} businessName={branding.businessName} address={branding.address} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="voucher-${entry.entry_no}.pdf"`,
    },
  });
}
