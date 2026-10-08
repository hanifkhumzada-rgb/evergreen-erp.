"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Droplets, BadgeDollarSign, RefreshCw } from "lucide-react";
import { createDelivery } from "@/app/actions";
import { pkr } from "@/lib/format";
import Toast from "@/components/Toast";
import { useOfflineSubmit } from "@/lib/useOfflineSubmit";
import { EntryFormActions, EntryFormHeader, EntrySection, EntrySummary, useUnsavedForm } from "@/components/ProfessionalEntryForm";
import CustomerPicker from "@/components/smart-entry/CustomerPicker";

export default function DeliveryForm({ customers, products, riders = [], currentUserId, initialCustomerId, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [productId, setProductId] = useState(products?.[0]?.id || "");
  const [requestId, setRequestId] = useState("");
  const [deliveredQty, setDeliveredQty] = useState(1);
  const [returnedQty, setReturnedQty] = useState(0);
  const formRef = useRef();
  const { submit, busy } = useOfflineSubmit("delivery", createDelivery, {
    label: (payload) => `Delivery — ${customers.find((c) => c.id === payload.customer_id)?.name || "customer"}`,
  });
  const unsaved = useUnsavedForm(open);

  useEffect(() => {
    if (!initialCustomerId) return;
    const c = customers.find((x) => x.id === initialCustomerId);
    if (!c) return;
    setSelected(c);
    setRequestId(crypto.randomUUID());
    if (c.default_product_id) setProductId(c.default_product_id);
    setOpen(true);
  }, [initialCustomerId, customers]);

  const currentBottleBalance = Number(selected?.bottleBalancesByProduct?.[productId] ?? (selected?.default_product_id === productId ? (selected?.bottleBalance ?? selected?.bottle_balance) : 0) ?? 0);
  const currentRate = Number(selected?.ratesByProduct?.[productId] ?? (selected?.default_product_id === productId ? selected?.rate : 0) ?? 0);
  const projectedBottleBalance = Math.max(0, currentBottleBalance + Number(deliveredQty || 0) - Number(returnedQty || 0));
  const maxReturn = currentBottleBalance + Number(deliveredQty || 0);

  const pickCustomer = (c) => {
    setSelected(c);
    setDeliveredQty(1);
    setReturnedQty(0);
    if (c.default_product_id) setProductId(c.default_product_id);
  };

  const reset = () => {
    setSelected(null);
    setProductId(products?.[0]?.id || "");
    setRequestId(crypto.randomUUID());
    setDeliveredQty(1);
    setReturnedQty(0);
    formRef.current?.reset();
  };

  const handleSubmit = async (formData) => {
    const saveAndNew = formData.get("submit_intent") === "save_new";
    setError("");
    if (Number(returnedQty || 0) > maxReturn) {
      setError(`Empty return cannot exceed ${maxReturn} bottles currently available with this customer.`);
      return;
    }
    try {
      const res = await submit(formData);
      if (res?.error) { setError(res.error); return; }
      unsaved.resetDirty();
      setOpen(saveAndNew);
      reset();
      setToast({ type: "success", message: res?.offline ? "Delivery saved offline — it will sync automatically when internet returns." : saveAndNew ? "Delivery recorded. Ready for the next delivery." : "Delivery recorded and bottle balance updated." });
    } catch {
      setError("Could not save this delivery. Please try again.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setRequestId(crypto.randomUUID()); setOpen(true); }} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Delivery
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => unsaved.requestClose(() => { setOpen(false); reset(); })}>
          <form ref={formRef} action={handleSubmit} onChange={unsaved.markDirty} onClick={(e) => e.stopPropagation()} className="erp-entry-form rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 max-w-3xl w-full max-h-[94vh] overflow-y-auto">
            <EntryFormHeader title="New Delivery" subtitle="Customer, bottles, billing and rider posting" status="New" reference={requestId ? `Ref ${requestId.slice(0, 8).toUpperCase()}` : undefined} onClose={() => unsaved.requestClose(() => { setOpen(false); reset(); })} onRefresh={reset} actions={[{ label: "Clear form", onClick: reset }]} />
            {error && <p className="text-coral text-xs mb-3 rounded-lg bg-coralSoft px-3 py-2">{error}</p>}
            <input type="hidden" name="request_id" value={requestId} />

            <EntrySection title="Customer & Main Information" description="Search by name, customer ID, phone, zone or route.">
            <label className="block mb-2 relative">
              <span className="text-xs font-semibold text-slate block mb-1">Customer *</span>
              <CustomerPicker customers={customers} value={selected?.id || ""} onChange={() => {}} onSelect={pickCustomer} placeholder="Search name, ID, phone, building, flat, zone…" />
              <input type="hidden" name="customer_id" value={selected?.id || ""} required />
            </label>

            {selected && (
              <div className="mb-4 rounded-2xl border border-line bg-foam/70 p-3 sm:col-span-2">
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div><span className="text-slate">Customer ID</span><div className="font-semibold font-mono-num">{selected.code || "—"}</div></div>
                  <div><span className="text-slate">Zone / Route</span><div className="font-semibold truncate">{selected.zoneName || selected.zone_name || "—"} · {selected.route || "—"}</div></div>
                  <div className="rounded-xl border border-line bg-card p-2.5">
                    <div className="flex items-center gap-1.5 text-slate"><BadgeDollarSign size={13} /> Rate</div>
                    <div className="font-bold text-sm mt-1">{currentRate ? pkr(currentRate) : "Rate not configured"}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-card p-2.5">
                    <div className="flex items-center gap-1.5 text-slate"><RefreshCw size={13} /> Frequency / Type</div>
                    <div className="font-bold text-sm mt-1">{selected.payment_frequency || "Monthly"}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-card border border-line px-3 py-2.5 text-xs">
                  <span className="text-slate">Outstanding</span>
                  <strong className={selected.balance > 0 ? "text-coral" : "text-green"}>{pkr(selected.balance || 0)}</strong>
                </div>
              </div>
            )}
            </EntrySection>

            <EntrySection title="Delivery & Bottle Details" description="Quantity, rate and bottle movement calculate automatically.">
            <label className="block mb-3">
              <span className="text-xs font-semibold text-slate block mb-1">Bottle size *</span>
              <select name="product_id" required className="in" value={productId} onChange={(e) => { setProductId(e.target.value); setReturnedQty(0); }}>
                {!products?.length && <option value="">No active bottle product configured</option>}
                {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Bottle delivered *</span>
                <input name="delivered_qty" type="number" min={1} value={deliveredQty} onChange={(e) => setDeliveredQty(Math.max(1, Number(e.target.value || 1)))} required className="in" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Empty bottle return</span>
                <input name="returned_qty" type="number" min={0} max={maxReturn} value={returnedQty} onChange={(e) => setReturnedQty(Math.max(0, Number(e.target.value || 0)))} className="in" />
              </label>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-aqua/20 bg-aquaSoft/60 p-3 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate">Before</div>
                <div className="mt-1 text-lg font-bold">{selected ? currentBottleBalance : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate">Net change</div>
                <div className="mt-1 text-lg font-bold">{selected ? `${Number(deliveredQty || 0) - Number(returnedQty || 0) >= 0 ? "+" : ""}${Number(deliveredQty || 0) - Number(returnedQty || 0)}` : "—"}</div>
              </div>
              <div className="rounded-xl bg-card border border-aqua/20 py-1.5">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-slate"><Droplets size={11} /> Total bottles</div>
                <div className="mt-1 text-xl font-extrabold text-aqua">{selected ? projectedBottleBalance : "—"}</div>
              </div>
            </div>
            </EntrySection>

            <EntrySection title="Collection & Assignment" description="Optional cash collection posts with the delivery.">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Cash collected (optional)</span>
                <input name="cash_collected" type="number" min={0} step="0.01" className="in" placeholder="0" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate block mb-1">Date</span>
                <input name="delivery_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="in" />
              </label>
            </div>

            <label className="block mb-4">
              <span className="text-xs font-semibold text-slate block mb-1">Delivery boy *</span>
              <select name="rider_id" defaultValue={currentUserId || ""} required className="in">
                {!riders.some((r) => r.id === currentUserId) && <option value={currentUserId}>Me</option>}
                {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </label>
            </EntrySection>

            <div className="mb-3 rounded-xl border border-line bg-foam/60 px-3 py-2 text-[11px] text-slate">
              Saving this delivery automatically updates the customer bottle balance, bottle inventory movement, delivery history and customer outstanding/collection.
            </div>

            <EntrySummary items={[{ label: "Delivery Amount", value: selected ? pkr(currentRate * Number(deliveredQty || 0)) : "—" }, { label: "Bottles Issued", value: selected ? String(deliveredQty || 0) : "—" }, { label: "Empty Returned", value: selected ? String(returnedQty || 0) : "—" }, { label: "New Bottle Balance", value: selected ? String(projectedBottleBalance) : "—" }]} />
            <EntryFormActions busy={busy || !selected || !productId} primaryLabel="Save Delivery" onCancel={() => unsaved.requestClose(() => { setOpen(false); reset(); })} />
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
