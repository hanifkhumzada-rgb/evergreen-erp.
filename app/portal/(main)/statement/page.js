import { Droplet } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate, pkr } from "@/lib/format";
import StatementPeriodPicker from "@/components/portal/StatementPeriodPicker";
import { DownloadPdfButton, PrintButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PortalStatementPage({ searchParams }) {
  const { supabase, customerId } = await requirePortalCustomer();
  const now = new Date();
  const month = Number(searchParams?.month) || now.getMonth() + 1;
  const year = Number(searchParams?.year) || now.getFullYear();
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const [{ data: entries }, { data: bottleTxns }] = await Promise.all([
    supabase.from("customer_ledger_entries").select("entry_date, reference_type, description, debit, credit")
      .eq("customer_id", customerId).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("bottle_transactions").select("txn_date, quantity, from_state, to_state")
      .eq("customer_id", customerId).lt("txn_date", periodEnd.toISOString().slice(0, 10)),
  ]);

  // Bottle balance as of the end of the viewed month — same running-total
  // logic as v_customer_bottle_balance (migration behind the Bottles
  // page), just cut off at periodEnd instead of "now", so a past month's
  // statement shows the balance as it stood at the time, not today's.
  const bottleBalanceAsOfPeriod = (bottleTxns || []).reduce((bal, t) => {
    if (t.to_state === "with_customer") return bal + Number(t.quantity);
    if (t.from_state === "with_customer") return bal - Number(t.quantity);
    return bal;
  }, 0);

  // Opening balance as of the start of the viewed month is folded purely
  // from the ledger itself (every entry before the period, the ledger's
  // own 'opening' entry included wherever it falls) — never from
  // customers.opening_balance directly, which can be edited without the
  // matching ledger entry being touched and silently drift out of sync
  // with v_customer_balance (the balance shown everywhere else in the
  // app). This keeps the statement's math always equal to the ledger's,
  // by construction. A same-month opening entry isn't excluded from the
  // period rows either — excluding it unconditionally would make it
  // vanish entirely for the one month a customer registered in.
  const allEntries = entries || [];
  const before = allEntries.filter((e) => new Date(e.entry_date) < periodStart);
  const openingBalance = before.reduce((bal, e) => bal + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0);
  const periodEntries = allEntries.filter((e) => new Date(e.entry_date) >= periodStart && new Date(e.entry_date) < periodEnd);

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = periodEntries.map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    return { ...e, debit, credit, balance: running };
  });

  const pdfHref = `/api/pdf/customer-statement/${customerId}?month=${month}&year=${year}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">Monthly Statement</h1>
      <StatementPeriodPicker month={month} year={year} />

      <div className="flex gap-2">
        <DownloadPdfButton href={pdfHref} label="Download PDF" />
        <PrintButton />
      </div>

      <div className="bg-card border border-line rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm font-bold pb-3 border-b border-line">
          <span>Opening Balance</span>
          <span className="font-mono-num">{pkr(openingBalance)}</span>
        </div>
        <div className="flex flex-col divide-y divide-line">
          {rows.length === 0 && <div className="py-4 text-xs text-slate text-center">No activity this month.</div>}
          {rows.map((r, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between text-xs">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.description}</div>
                <div className="text-slate mt-0.5">{fmtDate(r.entry_date)}</div>
              </div>
              <div className="text-right flex-shrink-0 pl-2">
                {r.debit > 0 && <div className="text-coral font-mono-num">+{pkr(r.debit)}</div>}
                {r.credit > 0 && <div className="text-green font-mono-num">-{pkr(r.credit)}</div>}
                <div className="font-mono-num font-semibold mt-0.5">{pkr(r.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-navyLight text-white rounded-2xl p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-[#BFE3E0]"><span>Total Debit</span><span className="font-mono-num">{pkr(totalDebit)}</span></div>
        <div className="flex items-center justify-between text-xs text-[#BFE3E0]"><span>Total Credit</span><span className="font-mono-num">{pkr(totalCredit)}</span></div>
        <div className="flex items-center justify-between text-sm font-bold pt-1.5 border-t border-white/15">
          <span>Closing Outstanding</span><span className="font-mono-num">{pkr(running)}</span>
        </div>
      </div>

      <div className="bg-card border border-line rounded-2xl p-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate"><Droplet size={13} className="text-aqua" /> Bottle Balance (end of period)</span>
        <span className="font-mono-num text-sm font-bold">{bottleBalanceAsOfPeriod}</span>
      </div>
    </div>
  );
}
