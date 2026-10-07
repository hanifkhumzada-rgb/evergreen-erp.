import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { pkr } from "@/lib/format";
import { appOrigin } from "@/lib/appOrigin";
import { loadCustomerAccount } from "@/lib/ew/docData";
import { resolveRange, periodLabel } from "@/lib/ew/dates";
import DocumentViewer from "@/components/ew/DocumentViewer";
import PeriodBar from "@/components/ew/PeriodBar";
import { StatementDoc, accountExcel } from "@/components/ew/docs/StatementDoc";
import { EwMissing } from "@/components/ew/EwDoc";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const range = resolveRange(sp, "month");
  const supabase = await createClient();
  const [data, branding] = await Promise.all([loadCustomerAccount(supabase, id, range), getBrandingLite(supabase)]);
  const controls = <PeriodBar current={range.key} from={range.from} to={range.to} omit={["today", "yesterday"]} extra={[{ key: "all", label: "All Time" }]} />;
  if (!data) return <DocumentViewer title="Customer Statement" fallbackHref="/ledger"><EwMissing title="Customer not found" /></DocumentViewer>;
  const c = data.customer;
  const t = data.totals;
  const text = `Assalam-o-Alaikum ${c.name},\nEvergreen Water account statement (${periodLabel(range)})\nOpening: ${pkr(t.opening)}\nBilling: ${pkr(t.billing)}\nPayments: ${pkr(t.payments)}\nClosing outstanding: ${pkr(t.closing)}\nBottles with you: ${t.closingBottles}\nView online: ${appOrigin()}/portal/statement\nThank you!`;
  return (
    <DocumentViewer
      title={`Statement ${c.code || c.name}`}
      subtitle={`${c.name} · ${periodLabel(range)}`}
      fallbackHref={`/ledger?customer=${c.id}`}
      controls={controls}
      excel={accountExcel(data, "Statement")}
      whatsapp={c.whatsapp_number || c.mobile ? { phone: c.whatsapp_number || c.mobile, text } : undefined}
      share={{ title: `Statement — ${c.name}`, text }}
    >
      <StatementDoc data={data} branding={branding} />
    </DocumentViewer>
  );
}
