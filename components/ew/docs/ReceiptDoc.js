// Evergreen Water PAYMENT RECEIPT. Server-safe.
import { EwPaper, EwDocHeader, EwSection, EwInfoGrid, EwStatTiles, EwAmountSummary, EwNote, EwSignatures, EwDocFooter } from "@/components/ew/EwDoc";
import { pkr, fmtDate, fmtDateTime } from "@/lib/format";
import { methodLabel } from "@/lib/ew/status";
import { customerAddress } from "@/lib/ew/docData";
import { amountInWords } from "@/lib/pdf/numberToWords";

export default function ReceiptDoc({ data, branding }) {
  const { payment: p, customer: c, invoice, totals, bottleBalance } = data;
  return (
    <EwPaper>
      {p.voided ? <div className="ew-stamp ew-text-red">VOID</div> : <div className="ew-stamp ew-text-green">RECEIVED</div>}
      <EwDocHeader
        branding={branding}
        title="Receipt"
        subtitle="Payment Received"
        meta={[
          { label: "Receipt No.", value: p.receipt_no || "—" },
          { label: "Receipt Date", value: fmtDate(p.payment_date) },
          { label: "Payment Mode", value: methodLabel(p.method) },
        ]}
        status={p.voided ? "void" : "paid"}
      />
      <div className="ew-body-grow">
        <div className="ew-banner">
          <div>
            <div className="ew-banner-label">Amount Received</div>
            <div className="ew-words">{amountInWords(Number(p.amount) || 0, "PKR")}</div>
          </div>
          <div className="ew-banner-value">{pkr(p.amount)}</div>
        </div>

        <EwSection title="Received From">
          <EwInfoGrid columns={3} items={[
            { label: "Customer ID", value: c.code, strong: true },
            { label: "Customer Name", value: c.name, strong: true },
            { label: "Phone", value: c.mobile || c.whatsapp_number },
            { label: "Address", value: customerAddress(c) },
            { label: "Zone", value: c.zones?.name },
            { label: "Bottle Balance", value: `${bottleBalance} bottles` },
          ]} />
        </EwSection>

        <EwSection title="Payment Details">
          <EwInfoGrid columns={3} items={[
            { label: "Payment Mode", value: methodLabel(p.method) },
            { label: "Reference", value: p.reference },
            { label: "Against Invoice", value: invoice ? `${invoice.invoice_no} (${fmtDate(invoice.invoice_date)})` : "On account" },
            { label: "Collected By", value: p.collector?.full_name },
            { label: "Recorded At", value: fmtDateTime(p.created_at) },
            { label: "Bank Voucher", value: p.bpv_no },
            ...(p.notes ? [{ label: "Notes", value: p.notes, wide: true }] : []),
            ...(p.voided ? [{ label: "Void Reason", value: p.void_reason, wide: true }] : []),
          ]} />
        </EwSection>

        <div className="ew-split">
          <EwSection title="Account Position">
            <EwStatTiles cols={3} items={[
              { label: "Balance Before", value: pkr(totals.before) },
              { label: "This Payment", value: pkr(totals.amount), tone: "green" },
              { label: "Balance After", value: pkr(totals.after), highlight: true },
            ]} />
            <div style={{ marginTop: 10 }}>
              <EwNote title="Note">{p.voided ? "This receipt has been voided and does not reduce the customer balance." : "Please keep this receipt for your records. Balances are as at the time of this payment."}</EwNote>
            </div>
          </EwSection>
          <div>
            <EwSection title="Summary">
              <EwAmountSummary lines={[
                { label: "Previous Outstanding", value: pkr(totals.before) },
                { label: "Amount Received", value: `− ${pkr(totals.amount)}`, tone: "green" },
                { label: "Remaining Outstanding", value: pkr(totals.after), total: true },
              ]} />
            </EwSection>
            <EwSignatures branding={branding} labels={["Received By"]} />
          </div>
        </div>
      </div>
      <EwDocFooter branding={branding} reference={`Receipt ${p.receipt_no || ""}`} />
    </EwPaper>
  );
}

export function receiptExcel(data) {
  const { payment: p, customer: c, invoice, totals } = data;
  return {
    title: `Receipt ${p.receipt_no || ""}`,
    period: fmtDate(p.payment_date),
    filters: [["Customer", `${c.code || ""} ${c.name || ""}`.trim()]],
    sheets: [{
      name: "Receipt",
      columns: [
        { key: "receipt", label: "Receipt #", type: "text" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", type: "text" },
        { key: "mode", label: "Mode", type: "text" },
        { key: "reference", label: "Reference", type: "text" },
        { key: "invoice", label: "Invoice", type: "text" },
        { key: "before", label: "Balance Before", type: "money" },
        { key: "amount", label: "Amount", type: "money" },
        { key: "after", label: "Balance After", type: "money" },
      ],
      rows: [{ receipt: p.receipt_no, date: p.payment_date, customer: c.name, mode: methodLabel(p.method), reference: p.reference, invoice: invoice?.invoice_no, before: totals.before, amount: totals.amount, after: totals.after }],
    }],
  };
}
