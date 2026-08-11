"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { createSale } from "@/app/actions";

export default function AddSaleForm({ customers }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError("");
    const res = await createSale(formData);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Sale
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Sale</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Customer</span>
              <select name="customer_id" required className="in">
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.rate}/bottle</option>)}
              </select>
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Quantity (19L bottles)</span>
              <input name="qty" type="number" defaultValue={2} min={1} required className="in" />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Amount paid now (PKR)</span>
              <input name="paid" type="number" defaultValue={0} className="in" />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Payment method</span>
              <select name="payment_method" className="in">
                <option>Cash</option><option>Bank Transfer</option><option>JazzCash</option><option>Easypaisa</option>
              </select>
            </label>
            <button type="submit" className="w-full py-2.5 rounded-lg bg-aqua text-white font-bold text-sm">Save Sale &amp; Generate Invoice</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid #E2EAEA; font-size:13.5px; outline:none; }`}</style>
    </>
  );
}
