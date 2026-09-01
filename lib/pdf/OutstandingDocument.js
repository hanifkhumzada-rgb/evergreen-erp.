import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { pkr, fmtDate } from "@/lib/format";

export default function OutstandingDocument({ rows, totalOutstanding }) {
  return (
    <PdfShell title="Outstanding / Receivables Report" meta={fmtDate(new Date().toISOString())}>
      <View style={table.statsRow}>
        <View style={table.statBox}>
          <Text style={table.statLabel}>CUSTOMERS WITH BALANCE</Text>
          <Text style={[table.statValue, { color: statTone("navy") }]}>{rows.length}</Text>
        </View>
        <View style={table.statBoxLast}>
          <Text style={table.statLabel}>TOTAL OUTSTANDING</Text>
          <Text style={[table.statValue, { color: statTone("coral") }]}>{pkr(totalOutstanding)}</Text>
        </View>
      </View>

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "32%" }]}>Customer</Text>
          <Text style={[table.headCell, { width: "20%" }]}>Phone</Text>
          <Text style={[table.headCell, { width: "16%", textAlign: "right" }]}>Opening</Text>
          <Text style={[table.headCell, { width: "16%", textAlign: "right" }]}>Balance</Text>
          <Text style={[table.headCell, { width: "16%", textAlign: "right" }]}>Credit Limit</Text>
        </View>
        {rows.length === 0 && <Text style={table.empty}>No outstanding receivables right now.</Text>}
        {rows.map((c, i) => (
          <View key={c.id} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cellBold, { width: "32%" }]}>{c.name}</Text>
            <Text style={[table.cellMuted, { width: "20%" }]}>{c.mobile || "—"}</Text>
            <Text style={[table.cell, { width: "16%", textAlign: "right" }]}>{pkr(c.opening_balance)}</Text>
            <Text style={[table.cellBold, { width: "16%", textAlign: "right" }]}>{pkr(c.balance)}</Text>
            <Text style={[table.cell, { width: "16%", textAlign: "right" }]}>{pkr(c.credit_limit)}</Text>
          </View>
        ))}
      </View>
    </PdfShell>
  );
}
