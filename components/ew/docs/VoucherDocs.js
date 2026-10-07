// Evergreen Water EXPENSE / PURCHASE / SALARY VOUCHERS and DELIVERY SLIP.
// Same header, typography, colours, footer and status system as every EW
// document; bodies are purpose-specific. Server-safe.
import { EwPaper, EwDocHeader, EwSection, EwInfoGrid, EwStatTiles, EwTable, EwAmountSummary, EwNote, EwSignatures, EwDocFooter } from "@/components/ew/EwDoc";
import { pkr, fmtDate, fmtDateTime, amt, qty } from "@/lib/format";
import { methodLabel } from "@/lib/ew/status";
import { customerAddress } from "@/lib/ew/docData";
import { amountInWords } from "@/lib/pdf/numberToWords";

function AmountBanner({ label, amount }) {
  return (
    <div className="ew-banner">
      <div><div className="ew-banner-label">{label}</div><div className="ew-words">{amountInWords(Math.abs(Number(amount) || 0), "PKR")}</div></div>
      <div className="ew-banner-value">{pkr(amount)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- EXPENSE
export function ExpenseVoucherDoc({ data, branding }) {
  const { expense: e, approver, creator } = data;
  const status = e.voided ? "void" : e.status;
  return (
    <EwPaper>
      {e.voided ? <div className="ew-stamp ew-text-red">VOID</div> : null}
      <EwDocHeader branding={branding} title="Expense Voucher" subtitle="Payment Voucher — Expense"
        meta={[{ label: "Voucher No.", value: e.expense_no || "—" }, { label: "Expense Date", value: fmtDate(e.expense_date) }, { label: "Payment Mode", value: methodLabel(e.payment_method) }]}
        status={status} />
      <div className="ew-body-grow">
        <AmountBanner label="Amount Paid" amount={e.amount} />
        <EwSection title="Expense Details">
          <EwInfoGrid columns={3} items={[
            { label: "Category", value: e.expense_categories?.name, strong: true },
            { label: "Paid To / Employee", value: e.employee?.full_name },
            { label: "Receipt / Bill Ref.", value: e.receipt_reference },
            { label: "Zone", value: e.zones?.name },
            { label: "Vehicle", value: e.vehicles?.registration_no },
            { label: "Bank Voucher", value: e.bpv_no },
            { label: "Description", value: e.description, wide: true },
            ...(e.voided ? [{ label: "Void Reason", value: e.void_reason, wide: true }] : []),
          ]} />
        </EwSection>
        <EwSection title="Approval Trail">
          <EwInfoGrid columns={3} items={[
            { label: "Entered By", value: e.submitter?.full_name || creator },
            { label: "Entered At", value: fmtDateTime(e.created_at) },
            { label: "Status", value: e.voided ? "Void" : String(e.status).replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) },
            { label: "Approved By", value: approver || "—", strong: true },
            { label: "Approved At", value: e.approved_at ? fmtDateTime(e.approved_at) : "—" },
          ]} />
        </EwSection>
        <EwSignatures branding={branding} labels={["Prepared By", "Received By", "Approved By"]} />
      </div>
      <EwDocFooter branding={branding} reference={`Expense Voucher ${e.expense_no || ""}`} />
    </EwPaper>
  );
}

// --------------------------------------------------------------- PURCHASE
export function PurchaseVoucherDoc({ data, branding }) {
  const { purchase: p, items, total } = data;
  const s = p.suppliers || {};
  return (
    <EwPaper>
      {p.status === "cancelled" ? <div className="ew-stamp ew-text-red">CANCELLED</div> : null}
      <EwDocHeader branding={branding} title="Purchase Voucher" subtitle="Goods Received / Purchase"
        meta={[{ label: "Voucher No.", value: p.purchase_no || "—" }, { label: "Purchase Date", value: fmtDate(p.purchase_date) }, { label: "Items", value: items.length }]}
        status={p.status} />
      <div className="ew-body-grow">
        <EwSection title="Supplier">
          <EwInfoGrid columns={3} items={[
            { label: "Supplier", value: s.name, strong: true }, { label: "Contact Person", value: s.contact_person }, { label: "Phone", value: s.phone },
            { label: "Address", value: s.address, wide: true },
          ]} />
        </EwSection>
        <EwSection title="Items Purchased">
          <EwTable
            columns={[
              { key: "sr", label: "#", width: "6%", render: (_, i) => String(i + 1).padStart(2, "0") },
              { key: "item", label: "Item", render: (r) => <strong>{r.item}</strong> },
              { key: "qty", label: "Qty", align: "right", width: "10%", render: (r) => `${qty(r.qty)}${r.unit ? ` ${r.unit}` : ""}` },
              { key: "rate", label: "Rate (PKR)", align: "right", width: "15%", render: (r) => amt(r.rate) },
              { key: "discount", label: "Discount", align: "right", width: "12%", render: (r) => (r.discount ? amt(r.discount) : "—") },
              { key: "amount", label: "Amount (PKR)", align: "right", width: "17%", render: (r) => <strong>{amt(r.amount)}</strong> },
            ]}
            rows={items}
            empty="No items on this purchase."
            footer={items.length ? <tr><td colSpan={2}>Total</td><td style={{ textAlign: "right" }}>{qty(items.reduce((a, i) => a + i.qty, 0))}</td><td /><td /><td style={{ textAlign: "right" }}>{amt(total)}</td></tr> : null}
          />
        </EwSection>
        <div className="ew-split">
          <div>
            <EwNote title="Notes">{p.notes || "Goods received in good condition and added to stock."}</EwNote>
            <div style={{ marginTop: 10 }}><EwInfoGrid columns={2} items={[{ label: "Entered By", value: p.creator?.full_name }, { label: "Entered At", value: fmtDateTime(p.created_at) }]} /></div>
          </div>
          <div>
            <EwAmountSummary lines={[{ label: "Items", value: items.length }, { label: "Total Purchase", value: pkr(total), total: true }]} />
            <p className="ew-muted" style={{ fontSize: 10.5, marginTop: 6, fontStyle: "italic" }}>{amountInWords(total, "PKR")}</p>
          </div>
        </div>
        <EwSignatures branding={branding} labels={["Received By", "Checked By", "Approved By"]} />
      </div>
      <EwDocFooter branding={branding} reference={`Purchase Voucher ${p.purchase_no || ""}`} />
    </EwPaper>
  );
}

// ----------------------------------------------------------------- SALARY
export function SalaryVoucherDoc({ data, branding }) {
  const { salary: s, employee: e, creator } = data;
  const month = s.period_month ? new Date(`${String(s.period_month).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "—";
  return (
    <EwPaper>
      <EwDocHeader branding={branding} title="Salary Voucher" subtitle="Salary Payment Slip"
        meta={[{ label: "Salary Month", value: month }, { label: "Paid On", value: fmtDate(s.paid_date) }, { label: "Voucher Ref.", value: `SAL-${String(s.id).slice(0, 8).toUpperCase()}` }]}
        status="paid" />
      <div className="ew-body-grow">
        <AmountBanner label="Net Salary Paid" amount={s.net_paid} />
        <EwSection title="Employee">
          <EwInfoGrid columns={3} items={[
            { label: "Employee", value: e.full_name, strong: true }, { label: "Employee Code", value: e.employee_code }, { label: "Designation", value: e.roles?.name },
            { label: "Phone", value: e.phone }, { label: "Zone", value: e.zones?.name }, { label: "Joining Date", value: e.joining_date ? fmtDate(e.joining_date) : "—" },
          ]} />
        </EwSection>
        <div className="ew-split">
          <EwSection title="Earnings & Deductions">
            <EwAmountSummary lines={[
              { label: "Basic Salary", value: pkr(s.base_salary) },
              { label: "− Advances Recovered", value: pkr(s.advances), tone: "red" },
              { label: "− Other Deductions", value: pkr(s.deductions), tone: "red" },
              { label: "Net Salary Paid", value: pkr(s.net_paid), total: true },
            ]} />
          </EwSection>
          <EwSection title="Summary">
            <EwStatTiles cols={2} items={[
              { label: "Gross", value: pkr(s.base_salary) },
              { label: "Total Deductions", value: pkr((Number(s.advances) || 0) + (Number(s.deductions) || 0)), tone: "red" },
            ]} />
            <div style={{ marginTop: 8 }}><EwNote title="Notes">{s.notes || "Salary paid in full for the month above."}</EwNote></div>
          </EwSection>
        </div>
        <EwSection title="Entry"><EwInfoGrid columns={3} items={[{ label: "Entered By", value: creator }, { label: "Entered At", value: fmtDateTime(s.created_at) }, { label: "Payment Date", value: fmtDate(s.paid_date) }]} /></EwSection>
        <EwSignatures branding={branding} labels={["Employee Signature", "Authorized Signature"]} />
      </div>
      <EwDocFooter branding={branding} reference={`Salary ${month} · ${e.full_name || ""}`} />
    </EwPaper>
  );
}

// ---------------------------------------------------------- DELIVERY SLIP
export function DeliverySlipDoc({ data, branding }) {
  const { delivery: d, customer: c, invoice, payments, collected, bottleBalance, balance } = data;
  const items = (d.delivery_items || []).map((it, i) => ({ id: i, product: [it.products?.name, it.products?.size_label].filter(Boolean).join(" · ") || "Water bottle", expected: Number(it.expected_qty) || 0, delivered: Number(it.delivered_qty) || 0, returned: Number(it.returned_qty) || 0, rate: Number(it.unit_price) || 0, amount: Number(it.amount) || 0 }));
  const sumK = (k) => items.reduce((a, i) => a + i[k], 0);
  return (
    <EwPaper>
      {d.status === "void" ? <div className="ew-stamp ew-text-red">VOID</div> : null}
      <EwDocHeader branding={branding} title="Delivery Slip" subtitle="Water Delivery Note"
        meta={[{ label: "Delivery No.", value: d.delivery_no || "—" }, { label: "Delivery Date", value: fmtDate(d.delivery_date) }, { label: "Delivered At", value: d.delivered_at ? fmtDateTime(d.delivered_at) : "—" }]}
        status={d.status} />
      <div className="ew-body-grow">
        <EwSection title="Deliver To">
          <EwInfoGrid columns={3} items={[
            { label: "Customer ID", value: c.code, strong: true }, { label: "Customer Name", value: c.name, strong: true }, { label: "Phone", value: c.mobile || c.whatsapp_number },
            { label: "Address", value: d.address_snapshot || customerAddress(c), wide: true },
            { label: "Zone", value: c.zones?.name }, { label: "Delivery Boy", value: d.rider?.full_name }, { label: "Vehicle", value: d.vehicles?.registration_no },
          ]} />
        </EwSection>
        <EwSection title="Bottles">
          <EwTable
            columns={[
              { key: "sr", label: "#", width: "6%", render: (_, i) => String(i + 1).padStart(2, "0") },
              { key: "product", label: "Product", render: (r) => <strong>{r.product}</strong> },
              { key: "expected", label: "Ordered", align: "right", width: "11%", render: (r) => qty(r.expected) },
              { key: "delivered", label: "Delivered", align: "right", width: "11%", render: (r) => qty(r.delivered) },
              { key: "returned", label: "Empty Ret.", align: "right", width: "11%", render: (r) => qty(r.returned) },
              { key: "rate", label: "Rate", align: "right", width: "11%", render: (r) => amt(r.rate) },
              { key: "amount", label: "Amount (PKR)", align: "right", width: "15%", render: (r) => <strong>{amt(r.amount)}</strong> },
            ]}
            rows={items}
            empty="No bottles on this delivery."
            footer={items.length ? <tr><td colSpan={2}>Total</td><td style={{ textAlign: "right" }}>{qty(sumK("expected"))}</td><td style={{ textAlign: "right" }}>{qty(sumK("delivered"))}</td><td style={{ textAlign: "right" }}>{qty(sumK("returned"))}</td><td /><td style={{ textAlign: "right" }}>{amt(d.amount)}</td></tr> : null}
          />
        </EwSection>
        <div className="ew-split">
          <EwSection title="Payment">
            <EwAmountSummary lines={[
              { label: "Delivery Amount", value: pkr(d.amount) },
              { label: "Collected on Delivery", value: pkr(collected || d.amount_collected), tone: "green" },
              { label: "Payment Mode", value: d.payment_method ? methodLabel(d.payment_method) : (payments[0] ? methodLabel(payments[0].method) : "—") },
              { label: "Customer Balance Now", value: pkr(balance), total: true },
            ]} />
            <p className="ew-muted" style={{ fontSize: 10.5, marginTop: 6 }}>{invoice ? `Invoice ${invoice.invoice_no}` : "Invoice not generated yet"}{payments.length ? ` · Receipt ${payments.map((p) => p.receipt_no).join(", ")}` : ""}</p>
          </EwSection>
          <div>
            <EwSection title="Bottle Balance">
              <EwStatTiles cols={2} items={[{ label: "Delivered Today", value: qty(sumK("delivered")) }, { label: "Bottles With Customer", value: qty(bottleBalance), tone: "aqua" }]} />
            </EwSection>
            <EwNote title="Remarks">{[d.rider_remarks, d.customer_remarks, d.void_reason].filter(Boolean).join(" · ") || "Received the above bottles in good condition."}</EwNote>
          </div>
        </div>
        <EwSignatures branding={branding} labels={["Delivery Boy", "Customer Signature"]} />
      </div>
      <EwDocFooter branding={branding} reference={`Delivery ${d.delivery_no || ""}`} />
    </EwPaper>
  );
}
