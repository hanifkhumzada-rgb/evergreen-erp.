import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr, fmtDate } from "@/lib/format";
import { loadClosingDoc } from "@/lib/ew/docData";
import DocumentViewer from "@/components/ew/DocumentViewer";
import { ClosingDoc, closingExcel } from "@/components/ew/docs/ClosingDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function DailyClosingStatementPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadClosingDoc(supabase, id), getBrandingLite(supabase)]);
  if (!data) return <DocumentViewer title="Daily Closing" fallbackHref="/accounting/daily-closing"><EwMissing title="Daily closing not found" /></DocumentViewer>;
  const c = data.closing;
  const text = `*Evergreen Water — Daily Closing ${fmtDate(c.close_date)}*\nSales: ${pkr(c.sales_total)}\nCollections: ${pkr(c.collections_total)}\nExpenses: ${pkr(c.expenses_total)}\nExpected cash: ${pkr(c.expected_cash)}\nActual cash: ${pkr(c.actual_cash)}\nDifference: ${pkr(c.difference)}\nBottles delivered: ${c.bottles_delivered} · Empty returned: ${c.empty_returned}`;
  return (
    <DocumentViewer title={`Daily Closing ${c.closing_no}`} subtitle={fmtDate(c.close_date)} fallbackHref="/accounting/daily-closing"
      excel={closingExcel(c)} whatsapp={{ phone: "", text }} share={{ title: `Daily Closing ${fmtDate(c.close_date)}`, text }}>
      <ClosingDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
