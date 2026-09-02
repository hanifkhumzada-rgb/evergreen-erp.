"use client";
import { useState, useRef } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { createCustomer, updateCustomer } from "@/app/actions";
import Toast from "@/components/Toast";

const CUSTOMER_TYPES = ["Home", "Office", "Corporate", "Shop", "Other"];
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_hold", label: "On Hold" },
  { value: "blacklisted", label: "Blacklisted" },
];
const DELIVERY_TIMES = ["Morning (7-10 AM)", "Midday (10 AM-1 PM)", "Afternoon (1-4 PM)", "Evening (4-7 PM)", "Anytime"];
const PAYMENT_TERMS = ["Cash on Delivery", "Weekly Credit", "Monthly Credit", "Advance Payment"];
const PAYMENT_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Custom"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Shared by the "New Customer" and "Edit Customer" triggers — one sectioned
// form covering the full Customer Master, matching how the customers table
// is actually structured (permanent info here; sales/deliveries/payments/
// bottle movements are transactions elsewhere that feed the AUTO fields).
export default function CustomerForm({ mode = "create", customer, zones, products, vehicles, riders, canManageFinancial, trigger }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();
  const c = customer || {};

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = mode === "edit" ? await updateCustomer(c.id, formData) : await createCustomer(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    if (mode === "create") formRef.current?.reset();
    setToast({ type: "success", message: mode === "edit" ? "Customer updated." : "Customer added." });
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
          <Plus size={15} /> New Customer
        </button>
      )}
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-2xl w-full max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">{mode === "edit" ? `Edit ${c.name}` : "New Customer"}</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            <Section title="Basic Information">
              <Row>
                <Field label="Full name *"><input name="name" required defaultValue={c.name} className="in" /></Field>
                <Field label="Business / Company name"><input name="business_name" defaultValue={c.business_name} className="in" /></Field>
              </Row>
              <Row>
                <Field label="Contact person"><input name="contact_person" defaultValue={c.contact_person} className="in" /></Field>
                <Field label="Customer type">
                  <select name="customer_type" defaultValue={c.customer_type || "Home"} className="in">
                    {CUSTOMER_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </Row>
              <Row>
                <Field label="Mobile number *"><input name="phone" required defaultValue={c.mobile} className="in" /></Field>
                <Field label="Alternate phone"><input name="alternate_phone" defaultValue={c.alternate_phone} className="in" /></Field>
              </Row>
              <Row>
                <Field label="WhatsApp number"><input name="whatsapp" defaultValue={c.whatsapp_number} className="in" /></Field>
                <Field label="Email"><input name="email" type="email" defaultValue={c.email} className="in" /></Field>
              </Row>
            </Section>

            <Section title="Address & Delivery">
              <Field label="Complete address"><input name="address" defaultValue={c.address} className="in" /></Field>
              <Row>
                <Field label="Area"><input name="area" defaultValue={c.area} className="in" /></Field>
                <Field label="Zone">
                  <select name="zone_id" defaultValue={c.zone_id || ""} className="in">
                    <option value="">— none —</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </Field>
              </Row>
              <Row>
                <Field label="Route"><input name="route" defaultValue={c.route} className="in" /></Field>
                <Field label="Preferred delivery time">
                  <select name="preferred_delivery_time" defaultValue={c.preferred_delivery_time || ""} className="in">
                    <option value="">— none —</option>
                    {DELIVERY_TIMES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              </Row>
              <Field label="Delivery days">
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" name="preferred_days" value={d} defaultChecked={(c.preferred_days || []).includes(d)} className="w-3.5 h-3.5 accent-aqua" /> {d}
                    </label>
                  ))}
                </div>
              </Field>
              <Row>
                <Field label="Assigned driver">
                  <select name="assigned_rider_id" defaultValue={c.assigned_rider_id || ""} className="in">
                    <option value="">— unassigned —</option>
                    {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Assigned vehicle">
                  <select name="assigned_vehicle_id" defaultValue={c.assigned_vehicle_id || ""} className="in">
                    <option value="">— unassigned —</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_no}</option>)}
                  </select>
                </Field>
              </Row>
              <Field label="Delivery instructions / location notes"><textarea name="delivery_instructions" defaultValue={c.delivery_instructions} rows={2} className="in" /></Field>
            </Section>

            <Section title="Product & Pricing">
              <Row>
                <Field label="Product / bottle size">
                  <select name="default_product_id" defaultValue={c.default_product_id || ""} className="in">
                    <option value="">— none —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="Regular quantity"><input name="regular_qty" type="number" step="0.01" defaultValue={c.regular_qty ?? 0} className="in" /></Field>
              </Row>
              {canManageFinancial ? (
                <Row>
                  <Field label="Special / customer rate (PKR)"><input name="rate" type="number" step="0.01" placeholder="Leave blank to use standard rate" className="in" /></Field>
                  <Field label="Discount %"><input name="discount_pct" type="number" step="0.01" defaultValue={c.discount_pct ?? 0} className="in" /></Field>
                </Row>
              ) : (
                <p className="text-xs text-slate mb-3">Special rate and discount are set by an Owner or Admin.</p>
              )}
              <Row>
                <Field label="Payment terms">
                  <select name="payment_terms" defaultValue={c.payment_terms || ""} className="in">
                    <option value="">— none —</option>
                    {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Payment frequency">
                  <select name="payment_frequency" defaultValue={c.payment_frequency || "Monthly"} className="in">
                    {PAYMENT_FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </Field>
              </Row>
            </Section>

            {canManageFinancial && (
              <Section title="Account Information">
                <Row>
                  <Field label="Opening balance (PKR)"><input name="opening_balance" type="number" step="0.01" defaultValue={c.opening_balance ?? 0} className="in" /></Field>
                  <Field label="Credit limit (PKR)"><input name="credit_limit" type="number" step="0.01" defaultValue={c.credit_limit ?? 0} className="in" /></Field>
                </Row>
              </Section>
            )}

            <Section title="Bottle Information">
              <Row>
                <Field label="Opening bottle balance"><input name="opening_bottles_with_customer" type="number" defaultValue={c.opening_bottles_with_customer ?? 0} className="in" /></Field>
                <Field label="Bottle limit"><input name="bottle_limit" type="number" defaultValue={c.bottle_limit ?? 20} className="in" /></Field>
              </Row>
            </Section>

            <Section title="Status">
              <Field label="Customer status">
                <select name="status" defaultValue={c.status || "active"} className="in">
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </Section>

            <Section title="Other" last>
              <Field label="Notes / special instructions"><textarea name="notes" defaultValue={c.notes} rows={2} className="in" /></Field>
            </Section>

            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm mt-2 disabled:opacity-60">
              {busy ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Customer"}
            </button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}

function Section({ title, children, last }) {
  return (
    <div className={`mb-4 ${last ? "" : "pb-4 border-b border-line"}`}>
      <div className="text-[10px] font-bold tracking-wider text-slate mb-2.5">{title.toUpperCase()}</div>
      {children}
    </div>
  );
}
function Row({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, children }) {
  return <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">{label}</span>{children}</label>;
}

export function EditCustomerTrigger() {
  return (
    <span className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold cursor-pointer hover:bg-foam">
      <Pencil size={14} /> Edit
    </span>
  );
}
