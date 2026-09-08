import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { VoucherInfo, VoucherAmountInWords, VoucherSignatures } from "./VoucherChrome";
import { table } from "./tableStyles";
import { fmtDate } from "@/lib/format";

const SOURCE_LABEL = {
  expenses: "Expense", payments: "Payment", invoices: "Sales Invoice", deliveries: "Delivery",
  journal_void: "Reversal", manual: "Manual Entry",
};

export default function JournalVoucherDocument({ entry, lines, businessName, address }) {
  const total = lines.reduce((a, l) => a + Number(l.debit), 0);
  return (
    <PdfShell title="Journal Voucher" meta={`${entry.entry_no} · ${fmtDate(entry.entry_date)}`} businessName={businessName} address={address}>
      <VoucherInfo items={[
        { label: "Voucher #", value: entry.entry_no },
        { label: "Date", value: fmtDate(entry.entry_date) },
        { label: "Reference", value: entry.reference },
        { label: "Source", value: SOURCE_LABEL[entry.source_module] || entry.source_module || "Manual Entry" },
      ]} />

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "8%" }]}>S#</Text>
          <Text style={[table.headCell, { width: "52%" }]}>Account</Text>
          <Text style={[table.headCell, { width: "20%", textAlign: "right" }]}>Debit</Text>
          <Text style={[table.headCell, { width: "20%", textAlign: "right" }]}>Credit</Text>
        </View>
        {lines.map((l, i) => (
          <View key={l.id || i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cellMuted, { width: "8%" }]}>{i + 1}</Text>
            <Text style={[table.cell, { width: "52%" }]}>
              {l.chart_of_accounts?.code ? `${l.chart_of_accounts.code} — ` : ""}{l.chart_of_accounts?.name || "—"}
            </Text>
            <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{Number(l.debit) > 0 ? Number(l.debit).toLocaleString("en-PK", { minimumFractionDigits: 2 }) : ""}</Text>
            <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{Number(l.credit) > 0 ? Number(l.credit).toLocaleString("en-PK", { minimumFractionDigits: 2 }) : ""}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B1F1D" }}>
          <Text style={[table.cellBold, { width: "60%" }]}>Total</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
          <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{total.toLocaleString("en-PK", { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <VoucherAmountInWords amount={total} />

      {entry.description && (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#5C7D78", letterSpacing: 0.4, textTransform: "uppercase" }}>Narration</Text>
          <Text style={{ fontSize: 9, color: "#0B1F1D", marginTop: 2 }}>{entry.description}</Text>
        </View>
      )}

      <VoucherSignatures />
    </PdfShell>
  );
}
