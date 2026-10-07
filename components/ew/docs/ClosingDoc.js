// Evergreen Water DAILY CLOSING STATEMENT and CREDIT/DEBIT ADJUSTMENT.
// Server-safe.
import { EwPaper, EwDocHeader, EwSection, EwInfoGrid, EwStatTiles, EwAmountSummary, EwNote, EwSignatures, EwDocFooter } from "@/components/ew/EwDoc";
import { pkr, fmtDate, fmtDateTime, qty } from "@/lib/format";
import { customerAddress } from "@/lib/ew/docData";
import { amountInWords } from "@/lib/pdf/numberToWords";

export function ClosingDoc({ data, branding }) {
  const { closing: c, live } = data;
  const diff = Number(c.difference) || 0;
  return (
    <EwPaper>
      <EwDocHeader branding={branding} title="Daily Closing" subtitle="Cash & Operations Statement"
        meta={[{ label: "Closing No.", value: c.closing_no }, { label: "Closing Date", value: fmtDate(c.close_date) }, { label: "Closed At", value: fmtDateTime(c.closed_at) }]}
        status={c.status === "closed" ? "pending" : c.status} />
      <div className="ew-body-grow">
        <EwSection title="Cash Reconciliation">
          <div className="ew-split">
            <EwAmountSummary lines={[
              { label: "Opening Cash", value: pkr(c.opening_cash) },
              { label: "+ Cash Collections", value: pkr(c.cash_collections), tone: "green" },
              { label: "− Cash Expenses", value: pkr(c.cash_expenses), tone: "red" },
              { label: "Expected Cash", value: pkr(c.expected_cash), strong: true },
              { label: "Actual Cash Counted", value: pkr(c.actual_cash), strong: true },
              { label: diff === 0 ? "Difference — Balanced" : diff > 0 ? "Difference — Excess" : "Difference — Short", value: pkr(diff), total: true },
            ]} />
            <div>
              <EwStatTiles cols={2} items={[
                { label: "Sales", value: pkr(c.sales_total) },
                { label: "Collections (all modes)", value: pkr(c.collections_total), tone: "green" },
                { label: "Expenses (approved)", value: pkr(c.expenses_total), tone: "orange" },
                { label: "Non-cash Collections", value: pkr((Number(c.collections_total) || 0) - (Number(c.cash_collections) || 0)), sub: "bank / Easypaisa / JazzCash" },
              ]} />
              {c.difference_reason ? <div style={{ marginTop: 10 }}><EwNote title="Difference Explanation">{c.difference_reason}</EwNote></div> : null}
            </div>
          </div>
        </EwSection>

        <EwSection title="Deliveries & Bottles">
          <EwStatTiles cols={4} items={[
            { label: "Deliveries", value: qty(c.deliveries_count) },
            { label: "Bottles Delivered", value: qty(c.bottles_delivered), tone: "green" },
            { label: "Empty Returned", value: qty(c.empty_returned), tone: "aqua" },
            { label: "Missed Deliveries", value: qty(c.missed_deliveries), tone: c.missed_deliveries ? "red" : undefined },
          ]} />
        </EwSection>

        {live && (Math.round(live.sales) !== Math.round(c.sales_total) || Math.round(live.collections) !== Math.round(c.collections_total) || Math.round(live.expenses) !== Math.round(c.expenses_total)) ? (
          <EwSection title="Changes After Closing">
            <EwNote title="Records changed after this day was closed">
              {`Current records for ${fmtDate(c.close_date)}: Sales ${pkr(live.sales)} · Collections ${pkr(live.collections)} · Expenses ${pkr(live.expenses)}. The figures above are as recorded at closing.`}
            </EwNote>
          </EwSection>
        ) : null}

        <EwSection title="Sign-off">
          <EwInfoGrid columns={3} items={[
            { label: "Closed By", value: c.closer?.full_name, strong: true },
            { label: "Closing Date / Time", value: fmtDateTime(c.closed_at) },
            { label: "Status", value: c.status === "closed" ? "Pending Approval" : c.status === "approved" ? "Approved" : "Rejected" },
            { label: c.status === "rejected" ? "Rejected By" : "Approved By", value: c.approver?.full_name || "—", strong: true },
            { label: "Approved At", value: c.approved_at ? fmtDateTime(c.approved_at) : "—" },
            { label: "Notes", value: c.notes },
          ]} />
        </EwSection>
        <EwSignatures branding={branding} labels={["Closed By", "Approved By"]} />
      </div>
      <EwDocFooter branding={branding} reference={`Daily Closing ${c.closing_no}`} />
    </EwPaper>
  );
}

export function closingExcel(c) {
  const rows = [
    ["Opening Cash", c.opening_cash], ["Sales", c.sales_total], ["Collections (all modes)", c.collections_total], ["Cash Collections", c.cash_collections],
    ["Expenses (approved)", c.expenses_total], ["Cash Expenses", c.cash_expenses], ["Expected Cash", c.expected_cash], ["Actual Cash", c.actual_cash], ["Difference", c.difference],
  ].map(([k, v]) => ({ k, v: Number(v) || 0 }));
  const ops = [["Deliveries", c.deliveries_count], ["Bottles Delivered", c.bottles_delivered], ["Empty Returned", c.empty_returned], ["Missed Deliveries", c.missed_deliveries]].map(([k, v]) => ({ k, v: Number(v) || 0 }));
  return {
    title: `Daily Closing ${c.closing_no}`,
    period: fmtDate(c.close_date),
    filters: [["Closed by", c.closer?.full_name], ["Approved by", c.approver?.full_name], ["Status", c.status]],
    sheets: [
      { name: "Cash", columns: [{ key: "k", label: "Item", type: "text" }, { key: "v", label: "Amount (PKR)", type: "money" }], rows },
      { name: "Operations", columns: [{ key: "k", label: "Item", type: "text" }, { key: "v", label: "Count", type: "int" }], rows: ops },
    ],
  };
}

export function AdjustmentDoc({ data, branding }) {
  const { adjustment: a, customer: c, before, after } = data;
  const credit = a.adjustment_type === "credit";
  return (
    <EwPaper>
      <EwDocHeader branding={branding} title={credit ? "Credit Note" : "Debit Note"} subtitle="Customer Account Adjustment"
        meta={[{ label: "Adjustment No.", value: a.adjustment_no }, { label: "Date", value: fmtDate(a.adjustment_date) }, { label: "Type", value: credit ? "Credit (reduces balance)" : "Debit (adds to balance)" }]}
        status={a.status} />
      <div className="ew-body-grow">
        <div className="ew-banner">
          <div><div className="ew-banner-label">{credit ? "Amount Credited" : "Amount Debited"}</div><div className="ew-words">{amountInWords(Number(a.amount) || 0, "PKR")}</div></div>
          <div className="ew-banner-value">{pkr(a.amount)}</div>
        </div>
        <EwSection title="Customer Details">
          <EwInfoGrid columns={3} items={[
            { label: "Customer ID", value: c.code, strong: true }, { label: "Customer Name", value: c.name, strong: true }, { label: "Phone", value: c.mobile },
            { label: "Address", value: customerAddress(c) }, { label: "Zone", value: c.zones?.name }, { label: "Reference", value: a.reference },
          ]} />
        </EwSection>
        <EwSection title="Reason"><EwNote title="Reason for adjustment">{a.reason}</EwNote></EwSection>
        <div className="ew-split">
          <EwSection title="Account Effect">
            <EwAmountSummary lines={[
              { label: "Balance Before", value: pkr(before) },
              { label: credit ? "− Credit Adjustment" : "+ Debit Adjustment", value: pkr(a.amount), tone: credit ? "green" : "red" },
              { label: "Balance After", value: pkr(after), total: true },
            ]} />
          </EwSection>
          <div>
            <EwSection title="Entry">
              <EwInfoGrid columns={2} items={[{ label: "Entered By", value: a.creator?.full_name }, { label: "Entered At", value: fmtDateTime(a.created_at) }]} />
            </EwSection>
            <EwSignatures branding={branding} labels={["Prepared By", "Authorized Signature"]} />
          </div>
        </div>
      </div>
      <EwDocFooter branding={branding} reference={`${credit ? "Credit Note" : "Debit Note"} ${a.adjustment_no}`} />
    </EwPaper>
  );
}
