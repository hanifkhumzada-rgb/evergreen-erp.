import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { COLORS } from "./theme";
import { pkr, fmtDate, refNoFromDescription } from "@/lib/format";

// Bank-statement-style Client Account Statement — client info card, an
// Opening Balance row (the customer's own opening_balance; the matching
// 'opening' ledger entry is excluded from the transaction rows by the
// route handler so it isn't counted twice), then the transaction table
// (Date, Reference No., Description, Debit, Credit, Balance), then
// Closing Balance/Total Debit/Total Credit together at the bottom.
export default function CustomerStatementDocument({ customer, rows, openingBalance, totalDebit, totalCredit, closingBalance, branding, period, bottleBalance }) {
  return (
    <PdfShell title="Client Account Statement" meta={`${period || "Period: All activity to date"}\nGenerated: ${fmtDate(new Date().toISOString())}`} branding={branding}>
      <View style={{ backgroundColor: COLORS.foam, borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.slate, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>Statement For</Text>
        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.ink }}>{customer.name}</Text>
        <Text style={{ fontSize: 8, color: COLORS.slate, marginTop: 2 }}>Client ID: {customer.code || "—"}</Text>
        <Text style={{ fontSize: 8.5, color: COLORS.ink, marginTop: 4 }}>
          {[customer.mobile, customer.address, customer.zones?.name].filter(Boolean).join("   ·   ")}
        </Text>
      </View>

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "12%" }]}>Date</Text>
          <Text style={[table.headCell, { width: "18%" }]}>Reference No.</Text>
          <Text style={[table.headCell, { width: "30%" }]}>Description</Text>
          <Text style={[table.headCell, { width: "13%", textAlign: "right" }]}>Debit</Text>
          <Text style={[table.headCell, { width: "13%", textAlign: "right" }]}>Credit</Text>
          <Text style={[table.headCell, { width: "14%", textAlign: "right" }]}>Balance</Text>
        </View>

        <View style={[table.row, { backgroundColor: COLORS.foam }]}>
          <Text style={[table.cellMuted, { width: "12%" }]}>—</Text>
          <Text style={[table.cellMuted, { width: "18%" }]}>—</Text>
          <Text style={[table.cellBold, { width: "30%" }]}>Opening Balance</Text>
          <Text style={[table.cell, { width: "13%", textAlign: "right" }]}>—</Text>
          <Text style={[table.cell, { width: "13%", textAlign: "right" }]}>—</Text>
          <Text style={[table.cellBold, { width: "14%", textAlign: "right" }]}>{pkr(openingBalance)}</Text>
        </View>

        {rows.length === 0 && <Text style={table.empty}>No ledger activity recorded for this period.</Text>}
        {rows.map((r, i) => (
          <View key={i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cell, { width: "12%" }]}>{fmtDate(r.date)}</Text>
            <Text style={[table.cellMuted, { width: "18%" }]}>{refNoFromDescription(r.description)}</Text>
            <Text style={[table.cell, { width: "30%" }]}>{r.description}</Text>
            <Text style={[table.cellMuted, { width: "13%", textAlign: "right" }]}>{r.debit ? pkr(r.debit) : "—"}</Text>
            <Text style={[table.cellMuted, { width: "13%", textAlign: "right" }]}>{r.credit ? pkr(r.credit) : "—"}</Text>
            <Text style={[table.cellBold, { width: "14%", textAlign: "right" }]}>{pkr(r.balance)}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <View style={{ width: 260 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Total Debit</Text>
            <Text style={{ fontSize: 8.5 }}>{pkr(totalDebit)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Total Credit</Text>
            <Text style={{ fontSize: 8.5, color: statTone("green") }}>{pkr(totalCredit)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, marginTop: 6, backgroundColor: closingBalance > 0 ? COLORS.navy : COLORS.green, borderRadius: 6 }}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: "#fff" }}>Closing Balance / Outstanding</Text>
            <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: "#fff" }}>{pkr(closingBalance)}</Text>
          </View>
          {bottleBalance != null && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, marginTop: 6 }}>
              <Text style={{ fontSize: 8.5, color: COLORS.slate }}>Bottle Balance (end of period)</Text>
              <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>{bottleBalance}</Text>
            </View>
          )}
        </View>
      </View>
    </PdfShell>
  );
}
