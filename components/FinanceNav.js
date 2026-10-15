import Link from "next/link";

const tabs = [
  ["/accounting", "Overview"],
  ["/accounting/general-ledger", "General Ledger"],
  ["/accounting/cash-bank", "Cash & Bank"],
  ["/accounting/receivables", "Receivables"],
  ["/accounting/payables", "Payables"],
  ["/accounting/reconciliation", "Reconciliation"],
  ["/accounting/cash-flow", "Cash Flow"],
  ["/accounting/approvals", "Approvals"],
];

export default function FinanceNav({ current }) {
  return (
    <nav aria-label="Finance tools" className="no-print mb-5 overflow-x-auto rounded-2xl border border-line bg-card p-1.5">
      <div className="flex min-w-max gap-1">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${current === href ? "bg-navy text-white" : "text-slate hover:bg-aquaSoft hover:text-aqua"}`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
