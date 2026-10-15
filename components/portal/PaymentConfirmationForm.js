"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPaymentConfirmation } from "@/app/portal/actions";

export default function PaymentConfirmationForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(formData) {
    setBusy(true); setResult(null);
    const response = await submitPaymentConfirmation(formData);
    setBusy(false); setResult(response);
    if (response.ok) router.refresh();
  }
  return <form action={submit} className="rounded-2xl border border-line bg-card p-4 space-y-3">
    <div><h2 className="text-sm font-bold">Submit Payment Confirmation</h2><p className="mt-1 text-[11px] text-slate">Your balance changes only after authorized staff verify and post the payment.</p></div>
    <div className="grid grid-cols-2 gap-3">
      <label><span className="mb-1 block text-xs font-semibold text-slate">Method</span><select name="method" required className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"><option value="">Select</option><option>EasyPaisa</option><option>JazzCash</option><option>Bank Transfer</option><option>Cash</option></select></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate">Amount</span><input name="amount" type="number" min="1" step="0.01" required className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm" /></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate">Payment Date</span><input name="payment_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm" /></label>
      <label><span className="mb-1 block text-xs font-semibold text-slate">Reference</span><input name="reference" required placeholder="Transaction ID" className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm" /></label>
    </div>
    {result && <p className={`rounded-xl px-3 py-2 text-xs ${result.ok ? "bg-greenSoft text-green" : "bg-coralSoft text-coral"}`}>{result.ok ? "Submitted for verification. This is not yet posted to your ledger." : result.error}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-navyLight px-4 py-3 text-xs font-bold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit for Verification"}</button>
  </form>;
}
