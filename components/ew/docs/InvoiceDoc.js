// Evergreen Water INVOICE — Water Delivery Service. Server-safe.
import { EwPaper, EwDocHeader, EwSection, EwInfoGrid, EwStatTiles, EwTable, EwAmountSummary, EwNote, EwSignatures, EwDocFooter } from "@/components/ew/EwDoc";
import { pkr, fmtDate, amt, qty } from "@/lib/format";
import { deliverySchedule, customerAddress } from "@/lib/ew/docData";
import { amountInWords } from "@/lib/pdf/numberToWords";

export default function InvoiceDoc({ data, branding }) {
  const { invoice, customer: c, items, totals, bottles } = data;
  const isVoid = invoice.status === "void";

  return (
    <EwPaper>
      {isVoid ? <div className="ew-stamp ew-text-red">VOID</div> : invoice.status === "paid" ? <div className="ew-stamp ew-text-green">PAID</div> : null}
      <EwDocHeader
        branding={branding}
        title="Invoice"
        subtitle="Water Delivery Service"
        meta={[
          { label: "Invoice No.", value: invoice.invoice_no },
          { label: "Invoice Date", value: fmtDate(invoice.invoice_date) },
          { label: "Due Date", value: invoice.due_date ? fmtDate(invoice.due_date) : "On receipt" },
        ]}
        status={invoice.status}
      />

      <div className="ew-body-grow">
        <EwSection title="Customer Details">
          <EwInfoGrid columns={3} items={[
            { label: "Customer ID", value: c.code, strong: true },
            { label: "Customer Name", value: c.name, strong: true },
            { label: "Phone", value: c.mobile || c.whatsapp_number },
            { label: "Address", value: customerAddress(c), wide: false },
            { label: "Zone", value: c.zones?.name },
            { label: "Delivery Schedule", value: deliverySchedule(c) },
          ]} />
        </EwSection>

        <EwSection title="Billing Summary">
          <EwStatTiles items={[
            { label: "Opening Balance", value: pkr(totals.opening) },
            { label: "Current Invoice Billing", value: pkr(totals.billing), sub: isVoid ? "Invoice voided" : `${items.length} line${items.length === 1 ? "" : "s"}` },
            { label: "Payments Received", value: pkr(totals.paid), tone: "green" },
            { label: "Current Outstanding", value: pkr(totals.outstanding), highlight: true },
          ]} />
        </EwSection>

        <EwSection title="Delivery Details" aside={data.delivery ? <span className="ew-muted" style={{ fontSize: 10.5 }}>Delivery {data.delivery.delivery_no}</span> : null}>
          <EwTable
            columns={[
              { key: "sr", label: "#", width: "6%", render: (_, i) => String(i + 1).padStart(2, "0") },
              { key: "date", label: "Date", width: "15%", render: (r) => fmtDate(r.date) },
              { key: "description", label: "Description", render: (r) => <strong>{r.description}</strong> },
              { key: "qty", label: "Qty", align: "right", width: "9%", render: (r) => qty(r.qty) },
              { key: "rate", label: "Rate (PKR)", align: "right", width: "14%", render: (r) => amt(r.rate) },
              { key: "amount", label: "Amount (PKR)", align: "right", width: "16%", render: (r) => <strong>{amt(r.amount)}</strong> },
            ]}
            rows={items}
            empty="No delivery lines on this invoice."
            footer={items.length ? (
              <tr>
                <td colSpan={3}>Total</td>
                <td style={{ textAlign: "right" }}>{qty(items.reduce((a, i) => a + i.qty, 0))}</td>
                <td />
                <td style={{ textAlign: "right" }}>{amt(items.reduce((a, i) => a + i.amount, 0))}</td>
              </tr>
            ) : null}
          />
        </EwSection>

        <div className="ew-split">
          <div>
            <EwSection title="Bottle Summary">
              <EwStatTiles cols={3} items={[
                { label: "Bottles Delivered", value: qty(bottles.delivered) },
                { label: "Empty Returned", value: qty(bottles.returned) },
                { label: "Bottle Balance", value: qty(bottles.balance), tone: "aqua" },
              ]} />
            </EwSection>
            <EwSection title="Notes & Payment">
              <EwNote title="Notes">{[branding?.paymentTerms, c.delivery_instructions].filter(Boolean).join("\n") || "Please keep empty bottles ready for exchange at the next delivery."}</EwNote>
              <div className="ew-note">
                <div className="ew-note-title">Payment Methods</div>
                <div className="ew-pay-methods"><span>Cash</span><span>Bank Transfer</span><span>Easypaisa</span><span>JazzCash</span></div>
                {branding?.bankDetails ? <div className="ew-note-body" style={{ marginTop: 6 }}>{branding.bankDetails}</div> : null}
              </div>
            </EwSection>
          </div>
          <div>
            <EwSection title="Amount Summary">
              <EwAmountSummary lines={[
                { label: "Subtotal", value: pkr(totals.subtotal) },
                { label: "Discount", value: totals.discount ? `− ${pkr(totals.discount)}` : pkr(0), tone: totals.discount ? "red" : undefined },
                { label: "Additional Charges", value: pkr(totals.charges) },
                { label: "Total Amount", value: pkr(totals.total), strong: true },
                { label: "Payment Received", value: totals.paid ? `− ${pkr(totals.paid)}` : pkr(0), tone: "green" },
                { label: "Previous Balance", value: pkr(totals.opening) },
                { label: "Current Outstanding", value: pkr(totals.outstanding), total: true },
              ]} />
              <p className="ew-muted" style={{ fontSize: 10.5, marginTop: 6, fontStyle: "italic" }}>
                {amountInWords(Math.max(0, totals.outstanding), "PKR")}
              </p>
            </EwSection>
            <EwSignatures branding={branding} labels={["Authorized Signature"]} />
          </div>
        </div>
      </div>

      <EwDocFooter branding={branding} reference={`Invoice ${invoice.invoice_no}`} />
    </EwPaper>
  );
}

export function invoiceExcel(data) {
  const { invoice, customer: c, items, totals } = data;
  return {
    title: `Invoice ${invoice.invoice_no}`,
    period: fmtDate(invoice.invoice_date),
    filters: [["Customer", `${c.code || ""} ${c.name || ""}`.trim()], ["Status", invoice.status]],
    sheets: [
      {
        name: "Invoice Lines",
        columns: [
          { key: "date", label: "Date", type: "date" },
          { key: "description", label: "Description", type: "text" },
          { key: "qty", label: "Qty", type: "number" },
          { key: "rate", label: "Rate (PKR)", type: "money", noTotal: true },
          { key: "amount", label: "Amount (PKR)", type: "money" },
        ],
        rows: items,
        totals: true,
      },
      {
        name: "Summary",
        columns: [{ key: "k", label: "Item", type: "text" }, { key: "v", label: "Amount (PKR)", type: "money" }],
        rows: [
          { k: "Opening Balance", v: totals.opening },
          { k: "Subtotal", v: totals.subtotal },
          { k: "Discount", v: -totals.discount },
          { k: "Additional Charges", v: totals.charges },
          { k: "Total Amount", v: totals.total },
          { k: "Payment Received", v: -totals.paid },
          { k: "Current Outstanding", v: totals.outstanding },
        ],
      },
    ],
  };
}
