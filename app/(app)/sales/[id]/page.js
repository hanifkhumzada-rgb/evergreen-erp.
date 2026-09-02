import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, Droplet } from "lucide-react";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, PrintButton, DownloadPdfButton } from "@/components/ui";

export const dynamic = "force-dynamic";
const STATUS_LABEL = { paid: "Paid", partially_paid: "Partially Paid", sent: "Pending", draft: "Draft", overdue: "Overdue", void: "Void" };

export default async function InvoicePage({ params }) {
  const supabase = await createClient();
  const { data: s } = await supabase.from("invoices").select("*, customers(*), invoice_items(*)").eq("id", params.id).single();

  if (!s) {
    return (
      <div>
        <Link href="/sales" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Sales</Link>
        <p>Invoice not found.</p>
      </div>
    );
  }
  const c = s.customers;
  const { data: payments } = await supabase.from("payments").select("amount").eq("customer_id", c?.id).eq("reference", s.invoice_no);
  const paid = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const balance = Number(s.net_amount) - paid;

  // Previous balance = the customer's opening balance plus every invoice
  // and payment strictly before this one, replayed in order — not the
  // customer's CURRENT balance, which would include everything since.
  const [{ data: priorInvoices }, { data: priorPayments }] = await Promise.all([
    c?.id ? supabase.from("invoices").select("net_amount").eq("customer_id", c.id).lt("created_at", s.created_at) : Promise.resolve({ data: [] }),
    c?.id ? supabase.from("payments").select("amount").eq("customer_id", c.id).lt("created_at", s.created_at) : Promise.resolve({ data: [] }),
  ]);
  const previousBalance = Number(c?.opening_balance || 0)
    + (priorInvoices || []).reduce((a, i) => a + Number(i.net_amount), 0)
    - (priorPayments || []).reduce((a, p) => a + Number(p.amount), 0);
  const newBalance = previousBalance + Number(s.net_amount) - paid;

  return (
    <div className="print-area">
      <Link href="/sales" className="no-print flex items-center gap-2 text-aqua font-semibold text-sm mb-4"><ArrowLeft size={18} /> Back to Sales</Link>
      <div className="border border-line rounded-2xl p-8 max-w-lg">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-aqua flex items-center justify-center"><Droplet size={16} className="text-white" /></div>
            <span className="font-display font-bold text-base">Evergreen Plus Water</span>
          </div>
          <Badge text={STATUS_LABEL[s.status] || s.status} tone={s.status === "paid" ? "green" : "amber"} />
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div><strong>Bill to:</strong><br />{c?.name}<br /><span className="text-xs text-slate font-mono-num">{c?.code}</span><br />{c?.address}<br />{c?.mobile}</div>
          <div className="text-right"><strong>Invoice:</strong> {s.invoice_no}<br /><strong>Date:</strong> {fmtDate(s.invoice_date)}</div>
        </div>
        <table className="w-full text-sm border-collapse mb-4">
          <thead><tr className="border-b-2 border-ink"><th className="text-left p-1.5">Bottle Size / Item</th><th className="text-right p-1.5">Qty</th><th className="text-right p-1.5">Rate</th><th className="text-right p-1.5">Total</th></tr></thead>
          <tbody>
            {(s.invoice_items || []).map((it) => (
              <tr key={it.id}><td className="p-1.5">{it.description}</td><td className="text-right p-1.5">{it.quantity}</td><td className="text-right p-1.5">{pkr(it.rate)}</td><td className="text-right p-1.5">{pkr(it.amount)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto w-56 text-[13.5px]">
          <div className="flex justify-between py-1"><span>Previous balance</span><span>{pkr(previousBalance)}</span></div>
          <div className="flex justify-between py-1"><span>This invoice</span><span>{pkr(s.net_amount)}</span></div>
          <div className="flex justify-between py-1"><span>Payment received</span><span>{pkr(paid)}</span></div>
          <div className="flex justify-between py-1 font-bold border-t border-line"><span>New balance / outstanding</span><span>{pkr(newBalance)}</span></div>
        </div>
        <div className="no-print flex gap-2 mt-6">
          <PrintButton />
          <DownloadPdfButton href={`/api/pdf/invoice/${s.id}`} label="Download PDF" />
          {c?.whatsapp_number && (
            <a href={`https://wa.me/${c.whatsapp_number.replace(/^0/, "92")}?text=${encodeURIComponent(`Invoice ${s.invoice_no} — Total ${pkr(s.net_amount)}, Balance ${pkr(balance)}. Evergreen Plus Water.`)}`} target="_blank"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">Share on WhatsApp</a>
          )}
        </div>
      </div>
    </div>
  );
}
