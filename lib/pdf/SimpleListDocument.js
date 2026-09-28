import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";

// Generic branded table PDF for list pages.
// columns: [{ key, label, width: "20%", align?: "right", bold? }]
// stats:   [{ label, value, tone? }]
export default function SimpleListDocument({ title, meta, branding, columns, rows, stats = [], emptyText = "No records.", qr }) {
  return (
    <PdfShell title={title} meta={meta} branding={branding} qr={qr}>
      {stats.length > 0 && (
        <View style={table.statsRow}>
          {stats.map((s, i) => (
            <View key={s.label} style={i === stats.length - 1 ? table.statBoxLast : table.statBox}>
              <Text style={table.statLabel}>{s.label}</Text>
              <Text style={[table.statValue, { color: statTone(s.tone) }]}>{s.value}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={table.section}>
        <View style={table.head} fixed>
          {columns.map((c) => <Text key={c.key} style={[table.headCell, { width: c.width, textAlign: c.align || "left" }]}>{c.label}</Text>)}
        </View>
        {rows.length === 0 && <Text style={table.empty}>{emptyText}</Text>}
        {rows.map((r, i) => (
          <View key={i} style={i % 2 ? table.rowAlt : table.row} wrap={false}>
            {columns.map((c) => (
              <Text key={c.key} style={[c.bold ? table.cellBold : table.cell, { width: c.width, textAlign: c.align || "left" }]}>{String(r[c.key] ?? "—")}</Text>
            ))}
          </View>
        ))}
      </View>
    </PdfShell>
  );
}
