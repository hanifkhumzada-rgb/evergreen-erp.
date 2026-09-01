import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { pkr, fmtDate } from "@/lib/format";

export default function CustomerStatementDocument({ customer, rows, totalSales, totalPaid, balance }) {
  return (
    <PdfShell title="Customer Statement" meta={fmtDate(new Date().toISOString())}>
      <View style={table.section}>
        <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0B1F1D" }}>{customer.name}</Text>
        <Text style={{ fontSize: 8.5, color: "#5C7D78", marginTop: 3 }}>
          {[customer.mobile, customer.address, customer.zones?.name].filter(Boolean).join("  ·  ")}
        </Text>
        <Text style={{ fontSize: 8.5, color: "#5C7D78", marginTop: 1 }}>Customer since {fmtDate(customer.created_at)}</Text>
      </View>

      <View style={table.statsRow}>
        <View style={table.statBox}>
          <Text style={table.statLabel}>TOTAL SALES</Text>
          <Text style={[table.statValue, { color: statTone("navy") }]}>{pkr(totalSales)}</Text>
        </View>
        <View style={table.statBox}>
          <Text style={table.statLabel}>TOTAL PAID</Text>
          <Text style={[table.statValue, { color: statTone("green") }]}>{pkr(totalPaid)}</Text>
        </View>
        <View style={table.statBoxLast}>
          <Text style={table.statLabel}>OUTSTANDING BALANCE</Text>
          <Text style={[table.statValue, { color: statTone("coral") }]}>{pkr(balance)}</Text>
        </View>
      </View>

      <View style={table.section}>
        <Text style={table.sectionTitle}>Ledger History</Text>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "14%" }]}>Date</Text>
          <Text style={[table.headCell, { width: "42%" }]}>Description</Text>
          <Text style={[table.headCell, { width: "14%", textAlign: "right" }]}>Debit</Text>
          <Text style={[table.headCell, { width: "14%", textAlign: "right" }]}>Credit</Text>
          <Text style={[table.headCell, { width: "16%", textAlign: "right" }]}>Balance</Text>
        </View>
        {rows.length === 0 && <Text style={table.empty}>No ledger activity recorded yet.</Text>}
        {rows.map((r, i) => (
          <View key={i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cell, { width: "14%" }]}>{fmtDate(r.date)}</Text>
            <Text style={[table.cell, { width: "42%" }]}>{r.description}</Text>
            <Text style={[table.cellMuted, { width: "14%", textAlign: "right" }]}>{r.debit ? pkr(r.debit) : "—"}</Text>
            <Text style={[table.cellMuted, { width: "14%", textAlign: "right" }]}>{r.credit ? pkr(r.credit) : "—"}</Text>
            <Text style={[table.cellBold, { width: "16%", textAlign: "right" }]}>{pkr(r.balance)}</Text>
          </View>
        ))}
      </View>
    </PdfShell>
  );
}
