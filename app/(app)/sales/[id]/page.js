import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, PrintButton, DownloadPdfButton } from "@/components/ui";
import DocumentPrintHeader from "@/components/DocumentPrintHeader";
import { getBrandingLite } from "@/lib/pdf/business";

export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };
const STATUS_TONE = { paid: "green", partially_paid: "amber", sent: "coral", draft: "slate", overdue: "coral", void: "coral" };

export default async function InvoicePage({ params }) {
  const supabase = await createClient();
  const [{ data: s }, branding] = await Promise.all([
    supabase.from("invoices").select("*, customers(*, zones(name)), invoice_items(*, products(name, size_label))").eq("id", params.id).single(),
    getBrandingLite(supabase),
  ]);

  if (!s) {
    return (
      <div>
        <Link href="/sales" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Sales</Link>
        <p>Invoice not found.</p>
      </div>
    );
  }
  const c = s.customers;
  const { data: payments } = await supabase.from("payments").select("amount").eq("customer_id", c?.id).eq("reference", s.invoice_no).eq("voided", false);
  const paid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(s.net_amount) - paid;

  // Previous balance = the customer's opening balance plus every invoice
  // and payment strictly before this one, replayed in order — not the
  // customer's CURRENT balance, which would include everything since.
  const [{ data: priorInvoices }, { data: priorPayments }] = await Promise.all([
    c?.id ? supabase.from("invoices").select("net_amount").eq("customer_id", c.id).lt("created_at", s.created_at).neq("status", "void") : Promise.resolve({ data: [] }),
    c?.id ? supabase.from("payments").select("amount").eq("customer_id", c.id).lt("created_at", s.created_at).eq("voided", false) : Promise.resolve({ data: [] }),
  ]);
  const previousBalance = Number(c?.opening_balance || 0)
    + (priorInvoices || []).reduce((a, i) => a + Number(i.net_amount), 0)
    - (priorPayments || []).reduce((a, p) => a + Number(p.amount), 0);
  const newBalance = previousBalance + Number(s.net_amount) - paid;

  return (
    <div className="print-area">
      <Link href="/sales" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Sales</Link>

      <div className="no-print flex gap-2 mb-4">
        <PrintButton />
        <DownloadPdfButton href={`/api/pdf/invoice/${s.id}`} label="Download PDF" />
        {c?.whatsapp_number && (
          <a href={`https://wa.me/${c.whatsapp_number.replace(/^0/, "92")}?text=${encodeURIComponent(`Invoice ${s.invoice_no} — Total ${pkr(s.net_amount)}, Balance ${pkr(balance)}. Evergreen Water.`)}`} target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">Share on WhatsApp</a>
        )}
      </div>

      <div className="border border-line rounded-2xl p-8 max-w-2xl bg-card">
        <DocumentPrintHeader
          printOnly={false}
          branding={branding}
          title="Sales Invoice"
          meta={`Invoice No: ${s.invoice_no}\nDate: ${fmtDate(s.invoice_date)}\nDue: ${s.due_date ? fmtDate(s.due_date) : "—"}\nStatus: ${STATUS_LABEL[s.status] || s.status}`}
        />

        <div className="bg-foam rounded-xl p-4 mb-5 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="text-[10px] font-bold text-slate uppercase tracking-wide mb-1">Bill To</div>
            <div className="text-lg font-bold text-ink">{c?.name}</div>
            <div className="text-xs text-slate mt-0.5">Client ID: {c?.code || "—"}</div>
            <div className="text-[13px] text-ink mt-2">{[c?.mobile, c?.address].filter(Boolean).join("   ·   ")}</div>
            {c?.zones?.name && <div className="text-xs text-slate mt-1">Area / Zone: {c.zones.name}</div>}
          </div>
          <Badge text={STATUS_LABEL[s.status] || s.status} tone={STATUS_TONE[s.status] || "slate"} />
        </div>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-navy text-white text-[10.5px] uppercase tracking-wide">
                <th className="text-left p-2 rounded-l-md">Sr#</th>
                <th className="text-left p-2">Product</th>
                <th className="text-left p-2">Bottle Size</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-right p-2">Rate</th>
                <th className="text-right p-2">Discount</th>
                <th className="text-right p-2 rounded-r-md">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(s.invoice_items || []).length === 0 && <tr><td colSpan={7} className="text-center py-6 text-slate">No line items on this invoice.</td></tr>}
              {(s.invoice_items || []).map((it, i) => (
                <tr key={it.id} className={i % 2 ? "bg-foam" : ""}>
                  <td className="p-2 text-slate">{i + 1}</td>
                  <td className="p-2">{it.products?.name || it.description}</td>
                  <td className="p-2 text-slate">{it.products?.size_label || "—"}</td>
                  <td className="text-right p-2">{it.quantity}</td>
                  <td className="text-right p-2 text-slate">{pkr(it.rate)}</td>
                  <td className="text-right p-2 text-slate">{Number(it.discount) > 0 ? pkr(it.discount) : "—"}</td>
                  <td className="text-right p-2 font-semibold">{pkr(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mb-6">
          <div className="w-full sm:w-72 text-[13px]">
            <div className="flex justify-between py-1"><span className="text-slate">Subtotal</span><span>{pkr(s.subtotal ?? s.net_amount)}</span></div>
            {Number(s.discount) > 0 && <div className="flex justify-between py-1"><span className="text-slate">Discount</span><span className="text-coral">−{pkr(s.discount)}</span></div>}
            <div className="flex justify-between py-1 border-t border-line mt-1 pt-2"><span className="text-slate">Previous balance</span><span>{pkr(previousBalance)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate">Current invoice amount</span><span className="font-semibold">{pkr(s.net_amount)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate">Amount paid</span><span className="text-green">{pkr(paid)}</span></div>
            <div className="flex justify-between items-center py-2.5 px-3 mt-2 rounded-lg bg-navy text-white">
              <span className="text-sm font-bold">Total Payable</span>
              <span className="text-lg font-bold">{pkr(newBalance)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-line">
          <div className="flex-1 text-[12px]">
            {branding.bankDetails && (
              <div className="mb-2.5">
                <div className="text-[10px] font-bold text-slate uppercase tracking-wide">Payment Details</div>
                <p className="text-ink mt-0.5 whitespace-pre-line">{branding.bankDetails}</p>
              </div>
            )}
            {branding.paymentTerms && (
              <div className="mb-2.5">
                <div className="text-[10px] font-bold text-slate uppercase tracking-wide">Terms</div>
                <p className="text-ink mt-0.5">{branding.paymentTerms}</p>
              </div>
            )}
            {branding.footerNote && <p className="text-slate italic mt-1">{branding.footerNote}</p>}
          </div>
          <div className="flex flex-col items-center flex-shrink-0">
            {branding.stampUrl && <img src={branding.stampUrl} alt="" className="w-14 h-14 object-contain mb-1 opacity-90" />}
            {branding.signatureUrl && <img src={branding.signatureUrl} alt="" className="w-24 h-8 object-contain" />}
            <div className="border-t border-ink w-32 mt-1" />
            <div className="text-[11px] text-slate mt-1">Authorized Signature</div>
          </div>
        </div>

        <p className="hidden print:block text-center text-[10px] text-slate italic mt-6 pt-2 border-t border-line">
          This is a computer-generated document and does not require a signature unless noted.
        </p>
      </div>
    </div>
  );
}
