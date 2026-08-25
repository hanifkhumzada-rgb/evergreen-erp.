import { Badge } from "@/components/ui";

export default function ChartOfAccountsPage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Chart of Accounts</h2>
      <p className="text-slate text-sm mb-5">A full chart-of-accounts / double-entry ledger.</p>
      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Badge text="Not available yet — the live database has no chart-of-accounts engine" tone="slate" />
        <p className="text-[13px] text-slate leading-relaxed mt-3">
          Sales, payments and expenses are recorded directly against customers and cash accounts.
          A formal chart of accounts with automatic double-entry posting is planned but not yet built
          into the live database.
        </p>
      </div>
    </div>
  );
}
