import { View, Text } from "@react-pdf/renderer";
import { PdfShell, CustomerInfo } from "./DocumentChrome";
import { VoucherAmountInWords, VoucherSignatures } from "./VoucherChrome";
import { table } from "./tableStyles";
import { fmtDate, pkr } from "@/lib/format";

export default function PaymentReceiptDocument({ payment, customer, receivedBy, branding, qr }) {
  const amount = Number(payment.amount);
  return (
    <PdfShell title="Payment Receipt" subtitle={`# ${payment.receipt_no}`} meta={fmtDate(payment.payment_date)} branding={branding} qr={qr} status="payment_received" statusLabel="Payment Received">
      <View style={{ backgroundColor: "#073B3A", borderRadius: 9, padding: 14, marginBottom: 13 }} wrap={false}>
        <Text style={{ fontSize: 7, color: "#DDF8F1", fontFamily: "Helvetica-Bold", letterSpacing: 0.8 }}>AMOUNT RECEIVED</Text>
        <Text style={{ fontSize: 22, color: "#FFFFFF", fontFamily: "Helvetica-Bold", marginTop: 4 }}>{pkr(amount)}</Text>
      </View>

      <CustomerInfo items={[
        { label: "Customer ID", value: customer?.code },
        { label: "Customer Name", value: customer?.name },
        { label: "Phone", value: customer?.mobile },
        { label: "Payment Date", value: fmtDate(payment.payment_date) },
        { label: "Payment Mode", value: payment.method },
        { label: "Reference / Transaction ID", value: payment.reference },
        { label: "Received By", value: receivedBy },
        { label: "Approved By", value: payment.approved_by_name },
      ]} />

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "8%" }]}>S#</Text>
          <Text style={[table.headCell, { width: "52%" }]}>Account</Text>
          <Text style={[table.headCell, { width: "20%", textAlign: "right" }]}>Debit</Text>
          <Text style={[table.headCell, { width: "20%", textAlign: "right" }]}>Credit</Text>
        </View>
        <View style={table.row}>
          <Text style={[table.cellMuted, { width: "8%" }]}>1</Text>
          <Text style={[table.cell, { width: "52%" }]}>Cash / Bank — {payment.method}</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}></Text>
        </View>
        <View style={table.rowAlt}>
          <Text style={[table.cellMuted, { width: "8%" }]}>2</Text>
          <Text style={[table.cell, { width: "52%" }]}>{customer?.name || "Customer"} — Accounts Receivable</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}></Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B1F1D" }}>
          <Text style={[table.cellBold, { width: "60%" }]}>Total</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <VoucherAmountInWords amount={amount} />

      {payment.notes ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#5C7D78", letterSpacing: 0.4, textTransform: "uppercase" }}>Narration</Text>
          <Text style={{ fontSize: 9, color: "#0B1F1D", marginTop: 2 }}>{payment.notes}</Text>
        </View>
      ) : null}

      <VoucherSignatures labels={["Received By", "Checked By", "Approved By"]} />
    </PdfShell>
  );
}
