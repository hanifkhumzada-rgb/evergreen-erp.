import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import CustomerStatementDocument from "@/lib/pdf/CustomerStatementDocument";
import { getBusinessBranding } from "@/lib/pdf/business";

export async function GET(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const branding = await getBusinessBranding(supabase);

  // Optional month/year scoping (Customer Portal's Monthly Statement) —
  // absent for every existing staff caller, which keeps returning the
  // full all-time statement exactly as before.
  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  const isScoped = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year);
  const periodStart = isScoped ? new Date(Date.UTC(year, month - 1, 1)) : null;
  const periodEnd = isScoped ? new Date(Date.UTC(year, month, 1)) : null;

  // Bottle balance cutoff: as of the end of the viewed month when scoped,
  // otherwise as of right now (all-time statement) — same running-total
  // logic v_customer_bottle_balance uses, just date-bounded.
  const bottleCutoff = isScoped ? periodEnd : new Date();

  const [{ data: customer }, { data: entries }, { data: bottleTxns }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").eq("id", params.id).single(),
    supabase.from("customer_ledger_entries").select("entry_date, reference_type, description, debit, credit, created_at")
      .eq("customer_id", params.id).order("entry_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("bottle_transactions").select("quantity, from_state, to_state")
      .eq("customer_id", params.id).lt("txn_date", bottleCutoff.toISOString().slice(0, 10)),
  ]);
  if (!customer) return new NextResponse("Customer not found", { status: 404 });

  const bottleBalance = (bottleTxns || []).reduce((bal, t) => {
    if (t.to_state === "with_customer") return bal + Number(t.quantity);
    if (t.from_state === "with_customer") return bal - Number(t.quantity);
    return bal;
  }, 0);

  // The customer's opening_balance is shown as its own statement line —
  // but its VALUE is read from the ledger's own 'opening' entry
  // (fn_post_opening_balance posts one at registration), never from the
  // customers.opening_balance column directly. That column can be edited
  // later (Customer Master) without the matching ledger entry being
  // touched — the trigger only fires on INSERT — so trusting it directly
  // let this statement's total silently drift from v_customer_balance
  // (the balance the rest of the app shows everywhere else) for any
  // customer whose opening balance was edited after creation. Deriving it
  // from the actual ledger entry instead makes openingBalance + sum(every
  // other entry) mathematically identical to sum(all ledger entries) —
  // i.e. always equal to v_customer_balance — by construction. Caught
  // and fixed while verifying Phase 5's "statement totals match the
  // underlying ledger" requirement against real data.
  const allEntries = entries || [];
  const openingEntry = allEntries.find((e) => e.reference_type === "opening");
  const baseOpeningBalance = openingEntry ? (Number(openingEntry.debit) || 0) - (Number(openingEntry.credit) || 0) : 0;
  const nonOpeningEntries = allEntries.filter((e) => e.reference_type !== "opening");

  // For a scoped (monthly) statement, "opening balance" is the running
  // balance as of the start of that month — every entry before the
  // period (the ledger's own opening entry included, wherever it falls)
  // is folded in rather than shown as a row.
  let openingBalance = baseOpeningBalance;
  let periodEntries = nonOpeningEntries;
  if (isScoped) {
    const before = allEntries.filter((e) => new Date(e.entry_date) < periodStart);
    openingBalance = before.reduce((bal, e) => bal + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0);
    // The opening entry is NOT excluded here (unlike the all-time view) —
    // if registration happened to fall inside the viewed month, it needs
    // to show up as a normal row so the month's total still reconciles;
    // excluding it unconditionally would make it vanish from both the
    // opening-balance fold above and the period rows below.
    periodEntries = allEntries.filter((e) => new Date(e.entry_date) >= periodStart && new Date(e.entry_date) < periodEnd);
  }

  let running = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = periodEntries.map((e) => {
    const debit = Number(e.debit) || 0;
    const credit = Number(e.credit) || 0;
    running += debit - credit;
    totalDebit += debit;
    totalCredit += credit;
    return { date: e.entry_date, description: e.description, debit, credit, balance: running };
  });

  const period = isScoped ? `Period: ${periodStart.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${year}` : undefined;

  const buffer = await renderToBuffer(
    <CustomerStatementDocument customer={customer} rows={rows} openingBalance={openingBalance} totalDebit={totalDebit} totalCredit={totalCredit} closingBalance={running} branding={branding} period={period} bottleBalance={bottleBalance} />
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
