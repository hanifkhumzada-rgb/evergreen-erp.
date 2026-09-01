import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { pkr, fmtDate } from "@/lib/format";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };

export default function DailySalesDocument({ date, rows, totalAmount }) {
  return (
    <PdfShell title="Daily Sales Report" meta={fmtDate(date)}>
      <View style={table.statsRow}>
        <View style={table.statBox}>
          <Text style={table.statLabel}>INVOICES</Text>
          <Text style={[table.statValue, { color: statTone("navy") }]}>{rows.length}</Text>
        </View>
        <View style={table.statBoxLast}>
          <Text style={table.statLabel}>TOTAL SALES</Text>
          <Text style={[table.statValue, { color: statTone("aqua") }]}>{pkr(totalAmount)}</Text>
        </View>
      </View>

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "18%" }]}>Invoice #</Text>
          <Text style={[table.headCell, { width: "34%" }]}>Customer</Text>
          <Text style={[table.headCell, { width: "12%", textAlign: "right" }]}>Qty</Text>
          <Text style={[table.headCell, { width: "18%", textAlign: "right" }]}>Total</Text>
          <Text style={[table.headCell, { width: "18%" }]}>Status</Text>
        </View>
        {rows.length === 0 && <Text style={table.empty}>No sales recorded for this date.</Text>}
        {rows.map((s, i) => (
          <View key={s.id} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cellBold, { width: "18%" }]}>{s.invoice_no}</Text>
            <Text style={[table.cell, { width: "34%" }]}>{s.customers?.name || "—"}</Text>
            <Text style={[table.cell, { width: "12%", textAlign: "right" }]}>{s.qty}</Text>
            <Text style={[table.cellBold, { width: "18%", textAlign: "right" }]}>{pkr(s.net_amount)}</Text>
            <Text style={[table.cellMuted, { width: "18%" }]}>{STATUS_LABEL[s.status] || s.status}</Text>
          </View>
        ))}
      </View>
    </PdfShell>
  );
}
