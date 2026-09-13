"use client";

import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DeliveryCorrectionForm({ delivery }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState((delivery.delivery_items || []).map((item) => ({ ...item })));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    if (!reason.trim()) { setMessage("Correction reason required."); return; }
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("fn_correct_delivery_quantities", {
      p_delivery_id: delivery.id,
      p_items: items.map((item) => ({ product_id: item.product_id, delivered_qty: Number(item.delivered_qty), returned_qty: Number(item.returned_qty) })),
      p_reason: reason.trim(),
    });
    if (error) { setMessage(error.message); setBusy(false); return; }
    setMessage("Correction saved. Bottle balance and customer ledger were adjusted automatically.");
    setBusy(false);
    setTimeout(() => window.location.reload(), 700);
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} title="Correct delivery" className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-amber hover:bg-amberSoft"><Pencil size={15} /></button>
    {open && <div className="fixed inset-0 z-[130] bg-navy/65 p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-xl rounded-2xl bg-card border border-line shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line"><div><h3 className="font-display text-lg font-semibold">Correct Delivery</h3><p className="text-xs text-slate">{delivery.delivery_no} · {delivery.customer_name}</p></div><button type="button" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-foam"><X size={17}/></button></div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-amberSoft border border-amber/20 p-3 text-xs text-amber">Use this only to correct a wrong bottle entry. Every correction needs a reason and keeps an audit-friendly adjustment trail.</div>
          {items.map((item, index) => <div key={item.product_id} className="grid grid-cols-2 gap-3 rounded-xl border border-line p-3"><div className="col-span-2 text-xs font-bold">{item.product_name || "Bottle"}</div><label className="text-xs text-slate">Delivered<input type="number" min="0" step="1" value={item.delivered_qty ?? 0} onChange={(e) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, delivered_qty: e.target.value } : row))} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"/></label><label className="text-xs text-slate">Empty Returned<input type="number" min="0" step="1" value={item.returned_qty ?? 0} onChange={(e) => setItems((rows) => rows.map((row, i) => i === index ? { ...row, returned_qty: e.target.value } : row))} className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"/></label></div>)}
          <label className="block text-xs font-semibold">Reason for correction<textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Example: 5 bottles entered by mistake, actual delivery was 4." className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink"/></label>
          {message && <p className="text-xs rounded-xl bg-foam p-3">{message}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-line text-xs font-bold">Cancel</button><button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-aqua text-white text-xs font-bold disabled:opacity-50"><Save size={14}/>{busy ? "Saving…" : "Save Correction"}</button></div>
        </div>
      </div>
    </div>}
  </>;
}
