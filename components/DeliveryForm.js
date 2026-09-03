"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { createDelivery } from "@/app/actions";
import { pkr } from "@/lib/format";
import Toast from "@/components/Toast";

// customers here already carry everything the search needs to show
// pre-submit — zone/route/rate/bottle balance/outstanding/payment frequency
// — all computed server-side in deliveries/page.js so this stays a plain
// client-side filter (no round trip) matching AddSaleForm/AddPaymentForm's
// "pass the full list as props" pattern used across the app.
export default function DeliveryForm({ customers, products, riders = [], currentUserId, initialCustomerId }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [productId, setProductId] = useState(products?.[0]?.id || "");
  const formRef = useRef();

  // A per-row "Deliver" quick action elsewhere (e.g. the Customers workspace)
  // links here with ?customer=<id> instead of duplicating this form's rate/
  // bottle-balance lookups — open pre-selected the one time on mount.
  useEffect(() => {
    if (!initialCustomerId) return;
    const c = customers.find((x) => x.id === initialCustomerId);
    if (!c) return;
    setSelected(c);
    setQuery(c.name);
    if (c.default_product_id) setProductId(c.default_product_id);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCustomerId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || selected) return [];
    return customers
      .filter((c) => [c.code, c.name, c.mobile, c.zoneName, c.route].filter(Boolean).join(" ").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, customers, selected]);

  const pickCustomer = (c) => {
    setSelected(c);
    setQuery(c.name);
    if (c.default_product_id) setProductId(c.default_product_id);
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setProductId(products?.[0]?.id || "");
    formRef.current?.reset();
  };

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await createDelivery(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    reset();
    setToast({ type: "success", message: "Delivery recorded." });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Delivery
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setOpen(false); reset(); }}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Delivery</h3>
              <button type="button" onClick={() => { setOpen(false); reset(); }}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            <label className="block mb-1 relative">
              <span className="text-xs font-semibold text-slate block mb-1">Customer *</span>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                  placeholder="Search name, ID, phone, zone, route…"
                  className="in pl-8"
                  autoComplete="off"
                  required
                />
                <input type="hidden" name="customer_id" value={selected?.id || ""} required />
              </div>
              {matches.length > 0 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border border-line rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {matches.map((c) => (
                    <div key={c.id} onClick={() => pickCustomer(c)} className="px-3 py-2 text-xs hover:bg-foam cursor-pointer flex justify-between gap-2">
                      <span className="font-semibold truncate">{c.name}</span>
                      <span className="text-slate flex-shrink-0">{c.mobile}</span>
                    </div>
                  ))}
                </div>
              )}
            </label>

            {selected && (
              <div className="mb-3 p-3 rounded-xl bg-foam border border-line text-[12.5px] grid grid-cols-2 gap-x-3 gap-y-1">
                <span className="text-slate">ID: <strong className="text-ink font-mono-num">{selected.code || "—"}</strong></span>
                <span className="text-slate">Zone: <strong className="text-ink">{selected.zoneName || "—"}</strong></span>
                <span className="text-slate">Route: <strong className="text-ink">{selected.route || "—"}</strong></span>
                <span className="text-slate">Frequency: <strong className="text-ink">{selected.payment_frequency || "Monthly"}</strong></span>
                <span className="text-slate">Bottle balance: <strong className="text-ink">{selected.bottleBalance ?? 0}</strong></span>
                <span className="text-slate">Outstanding: <strong className={selected.balance > 0 ? "text-coral" : "text-green"}>{pkr(selected.balance || 0)}</strong></span>
                <span className="text-slate col-span-2">Rate: <strong className="text-ink">{selected.rate ? pkr(selected.rate) : "uses standard rate"}</strong></span>
              </div>
            )}

            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Bottle size *</span>
              <select name="product_id" required className="in" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Bottles delivered *</span>
                <input name="delivered_qty" type="number" min={1} defaultValue={1} required className="in" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Empty bottles returned</span>
                <input name="returned_qty" type="number" min={0} defaultValue={0} className="in" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Cash collected (optional)</span>
                <input name="cash_collected" type="number" min={0} step="0.01" className="in" placeholder="0" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Date</span>
                <input name="delivery_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="in" />
              </label>
            </div>

            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Delivery boy *</span>
              <select name="rider_id" defaultValue={currentUserId || ""} required className="in">
                {!riders.some((r) => r.id === currentUserId) && <option value={currentUserId}>Me</option>}
                {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </label>

            <button type="submit" disabled={busy || !selected} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Saving…" : "Save Delivery"}
            </button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
