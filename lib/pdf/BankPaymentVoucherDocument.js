import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { VoucherInfo, VoucherAmountInWords, VoucherSignatures } from "./VoucherChrome";
import { table } from "./tableStyles";
import { fmtDate } from "@/lib/format";

const MODULE_LABEL = { expenses: "Expenses", payments: "Payments" };

// record.bpv_no / record.entry_date-or-payment_date / party / transactionType
// are all resolved by the route handler before this renders — this
// component only lays them out, same split as Journal/Payment Receipt.
export default function BankPaymentVoucherDocument({ record, module, date, party, transactionType, chequeRef, entry, lines, currency, address }) {
  const total = lines.reduce((a, l) => a + Number(l.debit), 0);
  return (
    <PdfShell title="Bank Payment Voucher" meta={`${record.bpv_no} · ${fmtDate(date)}`} address={address}>
      <VoucherInfo items={[
        { label: "Voucher #", value: record.bpv_no },
        { label: "Date", value: fmtDate(date) },
        { label: "Reversal #", value: null },
        { label: "Ref #", value: entry?.reference },
        { label: "Transaction Type", value: transactionType },
        { label: "Voucher Type", value: "BPV" },
        { label: "Party", value: party ? `${party.code ? `${party.code} — ` : ""}${party.name}` : null },
        { label: "Module", value: MODULE_LABEL[module] || module },
        { label: "Currency", value: currency || "PKR" },
        { label: "Cheque #", value: chequeRef },
      ]} />

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "6%" }]}>S#</Text>
          <Text style={[table.headCell, { width: "12%" }]}>Acc Code</Text>
          <Text style={[table.headCell, { width: "28%" }]}>Particular</Text>
          <Text style={[table.headCell, { width: "10%" }]}>Cost Center</Text>
          <Text style={[table.headCell, { width: "13%", textAlign: "right" }]}>Debit</Text>
          <Text style={[table.headCell, { width: "13%", textAlign: "right" }]}>Credit</Text>
          <Text style={[table.headCell, { width: "18%" }]}>Narration</Text>
        </View>
        {lines.map((l, i) => (
          <View key={l.id || i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cellMuted, { width: "6%" }]}>{i + 1}</Text>
            <Text style={[table.cell, { width: "12%" }]}>{l.chart_of_accounts?.code || "—"}</Text>
            <Text style={[table.cell, { width: "28%" }]}>{l.chart_of_accounts?.name || "—"}</Text>
            <Text style={[table.cellMuted, { width: "10%" }]}>—</Text>
            <Text style={[table.cellBold, { width: "13%", textAlign: "right" }]}>{Number(l.debit) > 0 ? Number(l.debit).toLocaleString("en-PK", { minimumFractionDigits: 2 }) : ""}</Text>
            <Text style={[table.cellBold, { width: "13%", textAlign: "right" }]}>{Number(l.credit) > 0 ? Number(l.credit).toLocaleString("en-PK", { minimumFractionDigits: 2 }) : ""}</Text>
            <Text style={[table.cellMuted, { width: "18%" }]}>{entry?.description || "—"}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B1F1D" }}>
          <Text style={[table.cellBold, { width: "56%" }]}>Total</Text>
          <Text style={[table.cellBold, { width: "13%", textAlign: "right" }]}>{total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
          <Text style={[table.cellBold, { width: "13%", textAlign: "right" }]}>{total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
          <Text style={[table.cellBold, { width: "18%" }]}></Text>
        </View>
      </View>

      <VoucherAmountInWords amount={total} currency={currency || "PKR"} />

      <VoucherSignatures labels={["Prepared By", "Reviewed By", "Approved By"]} />
    </PdfShell>
  );
}
