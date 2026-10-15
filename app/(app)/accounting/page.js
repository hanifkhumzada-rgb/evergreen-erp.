import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KPI, Badge } from "@/components/ui";
import FinanceNav from "@/components/FinanceNav";
import { pkr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage() {
  const supabase = await createClient();
  const [{ data: balances }, { count: pending }, { data: latestClosing }] = await Promise.all([
    supabase.from("v_trial_balance").select("type,balance"),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    supabase.from("daily_closings").select("close_date,status,difference").order("close_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const total = (type) => (balances || []).filter((row) => row.type === type).reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const cash = (balances || []).filter((row) => row.type === "asset").reduce((sum, row) => sum + Number(row.balance || 0), 0);
  const profit = -total("income") - total("cogs") - total("expense");
  return <div>
    <FinanceNav current="/accounting" />
    <h2 className="font-display text-2xl font-semibold">Finance Overview</h2>
    <p className="mb-5 text-sm text-slate">One accounting workspace, backed by posted double-entry journals.</p>
    <div className="mb-5 flex flex-wrap gap-3">
      <KPI label="ASSET BALANCE" value={pkr(cash)} tone="navy" />
      <KPI label="PERIOD PROFIT" value={pkr(profit)} tone={profit >= 0 ? "green" : "coral"} />
      <KPI label="PENDING APPROVALS" value={String(pending || 0)} tone="amber" />
      <KPI label="LAST CLOSING" value={latestClosing?.close_date || "Not closed"} tone="aqua" sub={latestClosing ? `Difference ${pkr(latestClosing.difference)}` : "Complete the first daily closing"} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["/accounting/trial-balance","Trial Balance"],["/accounting/profit-loss","Profit & Loss"],["/accounting/balance-sheet","Balance Sheet"],["/accounting/daily-closing","Daily Closing"]].map(([href,label]) => <Link key={href} href={href} className="rounded-2xl border border-line bg-card p-4 text-sm font-semibold hover:border-aqua/40 hover:bg-aquaSoft">{label}<div className="mt-2"><Badge text="Open report" tone="aqua" /></div></Link>)}
    </div>
  </div>;
}
