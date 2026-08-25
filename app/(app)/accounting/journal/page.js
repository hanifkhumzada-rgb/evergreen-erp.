import { Badge } from "@/components/ui";

export default function JournalPage() {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Journal Entries</h2>
      <p className="text-slate text-sm mb-5">Double-entry postings generated automatically from sales, payments and expenses.</p>
      <div className="border border-line rounded-2xl p-6 max-w-lg">
        <Badge text="Not available yet — the live database has no journal engine" tone="slate" />
        <p className="text-[13px] text-slate leading-relaxed mt-3">
          Transactions are recorded directly (invoices, payments, expenses, cash transactions) rather
          than as balanced debit/credit journal entries. See Reports for the raw transaction history.
        </p>
      </div>
    </div>
  );
}
