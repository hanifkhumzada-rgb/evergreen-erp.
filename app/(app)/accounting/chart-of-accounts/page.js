import { createClient } from "@/lib/supabase/server";
import { Th, Td, pkr } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  const supabase = await createClient();
  const [{ data: accounts }, { data: balances }] = await Promise.all([
    supabase.from("chart_of_accounts").select("*").eq("is_active", true).order("code"),
    supabase.from("v_trial_balance").select("account_id, balance"),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.account_id] = Number(b.balance); });

  const groups = ["asset", "liability", "equity", "income", "cogs", "expense"];
  const byType = groups.map((t) => ({ type: t, rows: (accounts || []).filter((a) => a.type === t) }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Chart of Accounts</h2>
      <p className="text-slate text-sm mb-5">Live account balances, calculated from posted journal entries.</p>

      {byType.map(({ type, rows }) => rows.length > 0 && (
        <div key={type} className="mb-6">
          <h4 className="text-xs font-bold tracking-wide text-slate mb-2 uppercase">{type}</h4>
          <div className="overflow-x-auto border border-line rounded-2xl">
            <table className="w-full text-[13.5px] border-collapse">
              <thead><tr className="bg-foam"><Th>Code</Th><Th>Account</Th><Th>Balance</Th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-foam">
                    <Td className="font-mono-num text-xs">{a.code}</Td>
                    <Td className="font-semibold">{a.name}</Td>
                    <Td>{pkr(balanceMap[a.id] || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(!accounts || accounts.length === 0) && <p className="text-sm text-slate">No accounts found.</p>}
    </div>
  );
}
