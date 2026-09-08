"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessSettings } from "@/app/actions";
import Toast from "@/components/Toast";

function Field({ label, name, defaultValue, placeholder, type = "text", textarea, hint, half }) {
  const Comp = textarea ? "textarea" : "input";
  return (
    <label className={`flex flex-col gap-1 ${half ? "sm:w-[calc(50%-8px)]" : "w-full"}`}>
      <span className="text-xs font-semibold text-slate">{label}</span>
      <Comp
        name={name} type={textarea ? undefined : type} defaultValue={defaultValue || ""} placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="px-3 py-2 rounded-lg border border-line bg-card text-[13px] w-full"
      />
      {hint && <span className="text-[11px] text-slate">{hint}</span>}
    </label>
  );
}

function ImageUpload({ label, name, currentUrl, shape = "square" }) {
  const [preview, setPreview] = useState(currentUrl || null);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-16 h-16 border border-line bg-foam flex items-center justify-center overflow-hidden ${shape === "round" ? "rounded-full" : "rounded-lg"}`}>
          {preview ? <img src={preview} alt={label} className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate text-center px-1">No image</span>}
        </div>
        <input
          type="file" name={name} accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }}
          className="text-xs file:mr-2 file:px-2.5 file:py-1.5 file:rounded-lg file:border file:border-line file:bg-card file:text-xs file:font-semibold file:cursor-pointer"
        />
      </div>
    </div>
  );
}

// Central branding settings — the single place the Owner edits company
// identity, contact details, bank/payment info, document number prefixes,
// and the letterhead images (logo/signature/stamp). Every generated
// document (invoice, statement, report, voucher, Excel export) reads from
// this same business_settings row (see lib/pdf/business.js's
// getBusinessBranding()), so one save here updates every future document.
export default function BusinessSettingsForm({ settings }) {
  const s = settings || {};
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const router = useRouter();

  const handleSubmit = async (formData) => {
    setBusy(true);
    try {
      const res = await updateBusinessSettings(formData);
      setBusy(false);
      if (res?.error) { setToast({ type: "error", message: res.error }); return; }
      setToast({ type: "success", message: "Branding settings saved — every new document will use this from now on." });
      router.refresh();
    } catch {
      setBusy(false);
      setToast({ type: "error", message: "Network error — please check your connection and try again." });
    }
  };

  return (
    <form action={handleSubmit} className="border border-line rounded-2xl p-5 max-w-3xl flex flex-col gap-6">
      <div>
        <h4 className="text-sm font-bold mb-1">Business Branding</h4>
        <p className="text-xs text-slate">
          Shown on every invoice, receipt, voucher, statement, report and Excel export — logo, contact details, bank
          info and document number prefixes all come from here.
        </p>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-wider text-slate mb-2.5">COMPANY IDENTITY</div>
        <div className="flex flex-wrap gap-3">
          <Field label="Company Name" name="business_name" defaultValue={s.business_name} half />
          <Field label="Tagline" name="tagline" defaultValue={s.tagline} placeholder="Pure Drinking Water" half />
        </div>
        <div className="flex flex-wrap gap-4 mt-3">
          <ImageUpload label="Company Logo" name="logo" currentUrl={s.logo_url} />
          <ImageUpload label="Authorized Signature" name="signature" currentUrl={s.signature_url} />
          <ImageUpload label="Business Stamp" name="stamp" currentUrl={s.stamp_url} shape="round" />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-wider text-slate mb-2.5">CONTACT &amp; REGISTRATION</div>
        <div className="flex flex-wrap gap-3">
          <Field label="Address" name="address" defaultValue={s.address} textarea />
          <Field label="Mobile Number" name="phone" defaultValue={s.phone} half />
          <Field label="Second Mobile Number" name="phone_2" defaultValue={s.phone_2} half />
          <Field label="WhatsApp Number" name="whatsapp_number" defaultValue={s.whatsapp_number} half />
          <Field label="Email" name="email" defaultValue={s.email} type="email" half />
          <Field label="NTN" name="ntn" defaultValue={s.ntn} placeholder="National Tax Number" half />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-wider text-slate mb-2.5">BANK &amp; PAYMENT DETAILS</div>
        <div className="flex flex-wrap gap-3">
          <Field label="Bank / Payment Details" name="bank_details" defaultValue={s.bank_details} textarea hint="Bank name, account title, account number / IBAN — shown on invoices under Payment Method." />
          <Field label="Payment Terms" name="payment_terms" defaultValue={s.payment_terms} textarea hint="e.g. Payment due within 7 days of invoice date." />
          <Field label="Footer Note" name="footer_note" defaultValue={s.footer_note} textarea hint="Thank-you line shown at the bottom of every document." />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-bold tracking-wider text-slate mb-2.5">DOCUMENT NUMBER PREFIXES</div>
        <div className="flex flex-wrap gap-3">
          <Field label="Invoice Prefix" name="invoice_prefix" defaultValue={s.invoice_prefix} hint={`Next: ${s.invoice_prefix || ""}${s.next_invoice_number ?? 1}`} half />
          <Field label="Receipt Prefix" name="receipt_prefix" defaultValue={s.receipt_prefix} hint={`Next: ${s.receipt_prefix || ""}${s.next_receipt_number ?? 1}`} half />
          <Field label="Delivery Prefix" name="delivery_prefix" defaultValue={s.delivery_prefix} hint={`Next: ${s.delivery_prefix || ""}${s.next_delivery_number ?? 1}`} half />
          <Field label="Order Prefix" name="order_prefix" defaultValue={s.order_prefix} hint={`Next: ${s.order_prefix || ""}${s.next_order_number ?? 1}`} half />
          <Field label="Bank Payment Voucher Prefix" name="bpv_prefix" defaultValue={s.bpv_prefix} hint={`Next: ${s.bpv_prefix || ""}${s.next_bpv_number ?? 1}`} half />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button disabled={busy} type="submit" className="px-4 py-2 rounded-lg bg-navy text-white text-xs font-semibold disabled:opacity-60">
          {busy ? "Saving…" : "Save Branding Settings"}
        </button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </form>
  );
}
