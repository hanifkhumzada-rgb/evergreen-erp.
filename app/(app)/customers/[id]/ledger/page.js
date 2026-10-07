import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { loadCustomerAccount } from "@/lib/ew/docData";
import { resolveRange, periodLabel } from "@/lib/ew/dates";
import DocumentViewer from "@/components/ew/DocumentViewer";
import PeriodBar from "@/components/ew/PeriodBar";
import { LedgerPrintDoc, accountExcel } from "@/components/ew/docs/StatementDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

// Customer Ledger print — A4 landscape (13 columns).
export default async function CustomerLedgerPrintPage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const range = resolveRange(sp, "month");
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadCustomerAccount(supabase, id, { ...range, withLines: true }), getBrandingLite(supabase)]);
  const controls = <PeriodBar current={range.key} from={range.from} to={range.to} omit={["today", "yesterday"]} extra={[{ key: "all", label: "All Time" }]} />;
  if (!data) return <DocumentViewer title="Customer Ledger" fallbackHref="/ledger"><EwMissing title="Customer not found" /></DocumentViewer>;
  const c = data.customer;
  return (
    <DocumentViewer
      title={`Ledger ${c.code || c.name}`}
      subtitle={`${c.name} · ${periodLabel(range)}`}
      fallbackHref={`/ledger?customer=${c.id}`}
      controls={controls}
      excel={accountExcel(data, "Ledger")}
      share={{ title: `Customer Ledger — ${c.name}` }}
    >
      <LedgerPrintDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
