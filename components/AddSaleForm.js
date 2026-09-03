"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { createSale } from "@/app/actions";
import Toast from "@/components/Toast";

export default function AddSaleForm({ customers, products, initialCustomerId }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState(products?.[0]?.id || "");
  const formRef = useRef();

  // "Create Invoice" quick action elsewhere links here with ?customer=<id>
  // — open pre-selected instead of making the caller duplicate this form.
  useEffect(() => {
    if (!initialCustomerId) return;
    const c = customers.find((x) => x.id === initialCustomerId);
    if (c?.default_product_id) setProductId(c.default_product_id);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId]);

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await createSale(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
    setProductId(products?.[0]?.id || "");
    setToast({ type: "success", message: "Sale saved & invoice generated." });
  };

  // Picking a customer defaults the bottle size to whatever they're usually
  // billed for (Customer Master's default_product_id), staff can still change it.
  const handleCustomerChange = (customerId) => {
    const c = customers.find((x) => x.id === customerId);
    if (c?.default_product_id) setProductId(c.default_product_id);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Sale
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Sale</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Customer</span>
              <select name="customer_id" required defaultValue={initialCustomerId || undefined} className="in" onChange={(e) => handleCustomerChange(e.target.value)}>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Product / bottle size</span>
              <select name="product_id" required className="in" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Quantity</span>
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
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save Sale & Generate Invoice"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
