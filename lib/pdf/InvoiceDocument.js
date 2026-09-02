import { View, Text } from "@react-pdf/renderer";
import { PdfShell } from "./DocumentChrome";
import { table, statTone } from "./tableStyles";
import { pkr, fmtDate } from "@/lib/format";

const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };

export default function InvoiceDocument({ invoice, customer, items, paid, previousBalance, newBalance }) {
  return (
    <PdfShell title="Invoice" meta={`${invoice.invoice_no} · ${fmtDate(invoice.invoice_date)} · ${STATUS_LABEL[invoice.status] || invoice.status}`}>
      <View style={table.section}>
        <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#5C7D78", marginBottom: 2 }}>BILL TO</Text>
        <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0B1F1D" }}>{customer?.name}</Text>
        <Text style={{ fontSize: 8.5, color: "#5C7D78", marginTop: 2 }}>{customer?.code}</Text>
        <Text style={{ fontSize: 8.5, color: "#5C7D78", marginTop: 1 }}>
          {[customer?.mobile, customer?.address].filter(Boolean).join("  ·  ")}
        </Text>
      </View>

      <View style={table.section}>
        <View style={table.head}>
          <Text style={[table.headCell, { width: "46%" }]}>Bottle Size / Item</Text>
          <Text style={[table.headCell, { width: "16%", textAlign: "right" }]}>Qty</Text>
          <Text style={[table.headCell, { width: "18%", textAlign: "right" }]}>Rate</Text>
          <Text style={[table.headCell, { width: "20%", textAlign: "right" }]}>Amount</Text>
        </View>
        {items.length === 0 && <Text style={table.empty}>No line items on this invoice.</Text>}
        {items.map((it, i) => (
          <View key={it.id || i} style={i % 2 ? table.rowAlt : table.row}>
            <Text style={[table.cell, { width: "46%" }]}>{it.description}</Text>
            <Text style={[table.cell, { width: "16%", textAlign: "right" }]}>{it.quantity}</Text>
            <Text style={[table.cellMuted, { width: "18%", textAlign: "right" }]}>{pkr(it.rate)}</Text>
            <Text style={[table.cellBold, { width: "20%", textAlign: "right" }]}>{pkr(it.amount)}</Text>
          </View>
        ))}
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <View style={{ width: 220 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: "#5C7D78" }}>Previous balance</Text>
            <Text style={{ fontSize: 8.5 }}>{pkr(previousBalance)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: "#5C7D78" }}>This invoice</Text>
            <Text style={{ fontSize: 8.5 }}>{pkr(invoice.net_amount)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
            <Text style={{ fontSize: 8.5, color: "#5C7D78" }}>Payment received</Text>
            <Text style={{ fontSize: 8.5, color: statTone("green") }}>{pkr(paid)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderTopWidth: 1, borderTopColor: "#E4E9E7", marginTop: 2 }}>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold" }}>New balance / outstanding</Text>
            <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: statTone(newBalance > 0 ? "coral" : "green") }}>{pkr(newBalance)}</Text>
          </View>
        </View>
      </View>
    </PdfShell>
  );
}
