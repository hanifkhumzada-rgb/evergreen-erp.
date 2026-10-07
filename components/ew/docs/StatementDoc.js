// Evergreen Water CUSTOMER STATEMENT + CUSTOMER LEDGER (print). Server-safe.
import { EwPaper, EwDocHeader, EwSection, EwInfoGrid, EwStatTiles, EwTable, EwStatusBadge, EwDocFooter, EwSignatures } from "@/components/ew/EwDoc";
import { pkr, fmtDate, amt, qty } from "@/lib/format";
import { customerAddress, deliverySchedule } from "@/lib/ew/docData";
import { periodLabel } from "@/lib/ew/dates";

function customerItems(c) {
  return [
    { label: "Customer ID", value: c.code, strong: true },
    { label: "Customer Name", value: c.name, strong: true },
    { label: "Phone", value: c.mobile || c.whatsapp_number },
    { label: "Address", value: customerAddress(c) },
    { label: "Zone", value: c.zones?.name },
    { label: "Delivery Schedule", value: deliverySchedule(c) },
  ];
}

const signed = (n) => (Number(n) < 0 ? `(${amt(Math.abs(n))})` : amt(n));

export function StatementDoc({ data, branding }) {
  const { customer: c, rows, totals } = data;
  const period = periodLabel(data);
  const stmtNo = `STM-${c.code || c.id.slice(0, 6)}-${(data.to || data.from || "").replace(/-/g, "").slice(0, 8) || "ALL"}`;
  return (
    <EwPaper>
      <EwDocHeader branding={branding} title="Statement" subtitle="Customer Account Statement"
        meta={[{ label: "Statement No.", value: stmtNo }, { label: "Statement Period", value: period }, { label: "Statement Date", value: fmtDate(new Date().toISOString()) }]}
        status={totals.closing > 0 ? "payment_due" : "clear"} />
      <div className="ew-body-grow">
        <EwSection title="Customer Details"><EwInfoGrid columns={3} items={customerItems(c)} /></EwSection>
        <EwSection title="Account Summary">
          <EwStatTiles cols={3} items={[
            { label: "Opening Balance", value: pkr(totals.opening) },
            { label: "Total Billing", value: pkr(totals.billing) },
            { label: "Total Payments", value: pkr(totals.payments), tone: "green" },
            { label: "Adjustments", value: pkr(totals.adjustments) },
            { label: "Closing Outstanding", value: pkr(totals.closing), highlight: true },
            { label: "Bottle Balance", value: qty(totals.closingBottles), tone: "aqua" },
          ]} />
        </EwSection>
        <EwSection title="Transactions">
          <EwTable
            columns={[
              { key: "date", label: "Date", width: "13%", render: (r) => (r.opening ? "" : fmtDate(r.entry_date)) },
              { key: "reference", label: "Reference", width: "17%" },
              { key: "description", label: "Description", render: (r) => r.opening ? <strong>Opening Balance</strong> : <>{r.typeLabel}{r.description && r.description !== r.typeLabel ? <span className="ew-muted"> · {r.description}</span> : null}</> },
              { key: "debit", label: "Debit (PKR)", align: "right", width: "13%", render: (r) => (r.debit ? amt(r.debit) : "—") },
              { key: "credit", label: "Credit (PKR)", align: "right", width: "13%", render: (r) => (r.credit ? amt(r.credit) : "—") },
              { key: "running", label: "Balance (PKR)", align: "right", width: "14%", render: (r) => <strong>{signed(r.running)}</strong> },
            ]}
            rows={[{ id: "opening", opening: true, reference: "", running: totals.opening, debit: 0, credit: 0 }, ...rows]}
            footer={(
              <tr>
                <td colSpan={3}>Period Totals</td>
                <td style={{ textAlign: "right" }}>{amt(totals.totalDebit)}</td>
                <td style={{ textAlign: "right" }}>{amt(totals.totalCredit)}</td>
                <td style={{ textAlign: "right" }}>{signed(totals.closing)}</td>
              </tr>
            )}
          />
          {rows.length === 0 ? <p className="ew-muted" style={{ fontSize: 11, marginTop: 6, fontStyle: "italic" }}>No transactions in this period.</p> : null}
        </EwSection>
        <div className="ew-split">
          <EwStatTiles items={[
            { label: "Closing Outstanding", value: pkr(totals.closing), highlight: true, sub: totals.closing > 0 ? "Amount payable" : totals.closing < 0 ? "Advance / credit balance" : "Account clear" },
            { label: "Current Bottle Balance", value: `${qty(totals.closingBottles)} bottles`, tone: "aqua" },
          ]} />
          <EwSignatures branding={branding} labels={["Accounts Department"]} />
        </div>
      </div>
      <EwDocFooter branding={branding} reference={`Statement ${stmtNo}`} />
    </EwPaper>
  );
}

export function LedgerPrintDoc({ data, branding }) {
  const { customer: c, rows, totals } = data;
  const period = periodLabel(data);
  return (
    <EwPaper landscape>
      <EwDocHeader branding={branding} title="Customer Ledger" subtitle="Detailed Account Ledger"
        meta={[{ label: "Customer", value: `${c.code || ""} · ${c.name}` }, { label: "Period", value: period }, { label: "Printed", value: fmtDate(new Date().toISOString()) }]} />
      <div className="ew-body-grow">
        <EwSection title="Ledger Summary">
          <EwStatTiles items={[
            { label: "Opening Balance", value: pkr(totals.opening) },
            { label: "Total Debit", value: pkr(totals.totalDebit) },
            { label: "Total Credit", value: pkr(totals.totalCredit), tone: "green" },
            { label: "Closing Balance", value: pkr(totals.closing), highlight: true },
            { label: "Opening Bottles", value: qty(totals.openingBottles) },
            { label: "Closing Bottles", value: qty(totals.closingBottles), tone: "aqua" },
          ]} />
        </EwSection>
        <EwSection title={`Ledger — ${c.name}`}>
          <EwTable dense
            columns={[
              { key: "date", label: "Date", render: (r) => (r.opening ? "" : fmtDate(r.entry_date)) },
              { key: "reference", label: "Reference" },
              { key: "typeLabel", label: "Type", render: (r) => (r.opening ? <strong>Opening</strong> : r.typeLabel) },
              { key: "description", label: "Description", render: (r) => (r.opening ? "Balance brought forward" : r.description || "—") },
              { key: "qty", label: "Qty", align: "right", render: (r) => (r.qty ? qty(r.qty) : "—") },
              { key: "rate", label: "Rate", align: "right", render: (r) => (r.rate ? amt(r.rate) : "—") },
              { key: "debit", label: "Debit", align: "right", render: (r) => (r.debit ? amt(r.debit) : "—") },
              { key: "credit", label: "Credit", align: "right", render: (r) => (r.credit ? amt(r.credit) : "—") },
              { key: "running", label: "Running O/S", align: "right", render: (r) => <strong>{signed(r.running)}</strong> },
              { key: "bottlesOut", label: "Btl Out", align: "right", render: (r) => (r.bottlesOut ? qty(r.bottlesOut) : "—") },
              { key: "bottlesIn", label: "Btl Ret.", align: "right", render: (r) => (r.bottlesIn ? qty(r.bottlesIn) : "—") },
              { key: "bottleRunning", label: "Btl Bal.", align: "right", render: (r) => qty(r.bottleRunning) },
              { key: "status", label: "Status", render: (r) => (r.opening ? "" : <EwStatusBadge status={r.status} />) },
            ]}
            rows={[{ id: "opening", opening: true, reference: "", running: totals.opening, bottleRunning: totals.openingBottles }, ...rows]}
            footer={(
              <tr>
                <td colSpan={6}>Totals · Closing Balance</td>
                <td style={{ textAlign: "right" }}>{amt(totals.totalDebit)}</td>
                <td style={{ textAlign: "right" }}>{amt(totals.totalCredit)}</td>
                <td style={{ textAlign: "right" }}>{signed(totals.closing)}</td>
                <td style={{ textAlign: "right" }}>{qty(totals.bottlesOut)}</td>
                <td style={{ textAlign: "right" }}>{qty(totals.bottlesIn)}</td>
                <td style={{ textAlign: "right" }}>{qty(totals.closingBottles)}</td>
                <td />
              </tr>
            )}
          />
        </EwSection>
      </div>
      <EwDocFooter branding={branding} reference={`Ledger ${c.code || ""}`} />
    </EwPaper>
  );
}

export function accountExcel(data, kind = "Statement") {
  const { customer: c, rows, totals } = data;
  const columns = [
    { key: "date", label: "Date", type: "date" },
    { key: "reference", label: "Reference", type: "text" },
    { key: "type", label: "Type", type: "text" },
    { key: "description", label: "Description", type: "text" },
    ...(kind === "Ledger" ? [{ key: "qty", label: "Qty", type: "number" }, { key: "rate", label: "Rate", type: "money", noTotal: true }] : []),
    { key: "debit", label: "Debit", type: "money" },
    { key: "credit", label: "Credit", type: "money" },
    { key: "running", label: kind === "Ledger" ? "Running Outstanding" : "Running Balance", type: "money", noTotal: true },
    ...(kind === "Ledger" ? [
      { key: "bout", label: "Bottle Out", type: "int" },
      { key: "bin", label: "Bottle Returned", type: "int" },
      { key: "bbal", label: "Bottle Balance", type: "int", noTotal: true },
      { key: "status", label: "Status", type: "text" },
    ] : []),
  ];
  const dataRows = [
    { date: data.from || null, reference: "", type: "Opening", description: "Opening Balance", debit: null, credit: null, running: totals.opening, bbal: totals.openingBottles },
    ...rows.map((r) => ({ date: r.entry_date, reference: r.reference, type: r.typeLabel, description: r.description, qty: r.qty, rate: r.rate, debit: r.debit || null, credit: r.credit || null, running: r.running, bout: r.bottlesOut || null, bin: r.bottlesIn || null, bbal: r.bottleRunning, status: r.status })),
  ];
  return {
    title: `${c.name} ${kind}`,
    period: periodLabel(data),
    filters: [["Customer ID", c.code], ["Zone", c.zones?.name]],
    sheets: [
      { name: kind, columns, rows: dataRows, totals: Object.fromEntries([["debit", totals.totalDebit], ["credit", totals.totalCredit], ["running", totals.closing], ["bout", totals.bottlesOut], ["bin", totals.bottlesIn], ["bbal", totals.closingBottles]]) },
      { name: "Summary", columns: [{ key: "k", label: "Item", type: "text" }, { key: "v", label: "Amount", type: "money" }], rows: [
        { k: "Opening Balance", v: totals.opening }, { k: "Total Billing", v: totals.billing }, { k: "Total Payments", v: totals.payments },
        { k: "Adjustments", v: totals.adjustments }, { k: "Closing Outstanding", v: totals.closing }, { k: "Bottle Balance", v: totals.closingBottles },
      ] },
    ],
  };
}
