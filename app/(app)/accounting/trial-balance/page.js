import { Badge } from "@/components/ui";

export default function TrialBalancePage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Trial Balance</h2>
      <p className="text-slate text-sm mb-5">A account-by-account debit/credit balance listing.</p>
      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Badge text="Not available yet — requires the chart-of-accounts / journal engine" tone="slate" />
        <p className="text-[13px] text-slate leading-relaxed mt-3">
          A Trial Balance is derived from journal entries, which the live database does not yet record.
          See Profit &amp; Loss for a heuristic revenue/expense summary in the meantime.
        </p>
      </div>
    </div>
  );
}
