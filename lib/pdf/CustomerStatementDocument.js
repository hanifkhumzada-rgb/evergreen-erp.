import { View, Text } from "@react-pdf/renderer";
import { PdfShell, CustomerInfo, AmountSummary } from "./DocumentChrome";
import { table } from "./tableStyles";
import { COLORS } from "./theme";
import { pkr, fmtDate, refNoFromDescription } from "@/lib/format";

// Bank-statement-style Client Account Statement — client info card, an
// Opening Balance row (the customer's own opening_balance; the matching
// 'opening' ledger entry is excluded from the transaction rows by the
// route handler so it isn't counted twice), then the transaction table
// (Date, Reference No., Description, Debit, Credit, Balance), then
// Closing Balance/Total Debit/Total Credit together at the bottom.
export default function CustomerStatementDocument({ customer, rows, openingBalance, totalDebit, totalCredit, closingBalance, branding, period, bottleBalance, qr }) {
  return (
    <PdfShell title="Statement of Account" meta={`${period || "All activity to date"}\nGenerated: ${fmtDate(new Date().toISOString())}`} branding={branding} qr={qr}>
      <CustomerInfo items={[
        { label: "Customer ID", value: customer.code },
        { label: "Customer Name", value: customer.name },
        { label: "Phone", value: customer.mobile },
        { label: "Zone", value: customer.zones?.name },
        { label: "Address", value: customer.address },
        { label: "Statement Period", value: period || "All activity to date" },
      ]} />

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

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 210 }}>
          {bottleBalance != null && (
            <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.aqua, textTransform: "uppercase" }}>Bottle Account Summary</Text>
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: COLORS.navy, marginTop: 5 }}>{bottleBalance} bottles</Text>
              <Text style={{ fontSize: 7.5, color: COLORS.slate, marginTop: 2 }}>Balance at end of statement period</Text>
            </View>
          )}
        </View>
        <View style={{ width: 260 }}><AmountSummary rows={[{ label: "Opening Balance", value: pkr(openingBalance) }, { label: "Total Billing / Debit", value: pkr(totalDebit) }, { label: "Total Received / Credit", value: pkr(totalCredit) }]} totalLabel="Closing Outstanding" totalValue={pkr(closingBalance)} /></View>
      </View>
    </PdfShell>
  );
}
