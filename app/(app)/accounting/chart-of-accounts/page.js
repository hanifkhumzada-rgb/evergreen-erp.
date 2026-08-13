import { createClient } from "@/lib/supabase/server";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";
const TYPE_TONE = { ASSET: "aqua", LIABILITY: "coral", EQUITY: "slate", INCOME: "green", COGS: "amber", EXPENSE: "amber" };

export default async function ChartOfAccountsPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("chart_of_accounts").select("*").order("code");
  const exportRows = (accounts || []).map(({ id, is_system, active, created_at, ...r }) => r);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Chart of Accounts</h2>
      <p className="text-slate text-sm mb-5">The backbone of the accounting engine — every sale, payment and expense posts here automatically.</p>
      <div className="no-print flex gap-2.5 mb-4">
        <ExportExcelButton rows={exportRows} filename="chart-of-accounts.xlsx" sheetName="Accounts" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Code</Th><Th>Account</Th><Th>Type</Th><Th>System</Th></tr></thead>
          <tbody>
            {(accounts || []).map((a) => (
              <tr key={a.id} className="hover:bg-foam">
                <Td><span className="font-mono-num">{a.code}</span></Td>
                <Td className="font-semibold">{a.name}</Td>
                <Td><Badge text={a.type} tone={TYPE_TONE[a.type]} /></Td>
                <Td>{a.is_system ? "Yes" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
