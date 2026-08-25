import { Badge } from "@/components/ui";

export default function BalanceSheetPage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Balance Sheet</h2>
      <p className="text-slate text-sm mb-5">Assets, liabilities and equity as of a given date.</p>
      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Badge text="Not available yet — requires the chart-of-accounts / journal engine" tone="slate" />
        <p className="text-[13px] text-slate leading-relaxed mt-3">
          A Balance Sheet is derived from journal entries, which the live database does not yet record.
          Cash account balances are visible on the Dashboard, and outstanding customer balances on the
          Customer Ledger.
        </p>
      </div>
    </div>
  );
}
