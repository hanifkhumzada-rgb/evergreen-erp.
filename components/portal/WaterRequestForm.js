"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitWaterDeliveryRequest } from "@/app/portal/actions";

export default function WaterRequestForm({ defaultAddress = "" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const minDate = new Date().toISOString().slice(0, 10);

  async function submit(formData) {
    setBusy(true); setResult(null);
    const response = await submitWaterDeliveryRequest(formData);
    setBusy(false); setResult(response);
    if (response.ok) router.refresh();
  }

  return <form action={submit} className="rounded-3xl border border-line bg-card p-4 sm:p-5 space-y-4">
    <div><h2 className="text-sm font-bold">Request 19L Water</h2><p className="mt-1 text-[11px] text-slate">Your request will be reviewed and confirmed by our delivery team.</p></div>
    <div className="grid grid-cols-2 gap-3">
      <label><span className="mb-1.5 block text-xs font-semibold text-slate">Quantity</span><input name="quantity" type="number" min="1" max="20" defaultValue="1" required className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm" /></label>
      <label><span className="mb-1.5 block text-xs font-semibold text-slate">Preferred Date</span><input name="preferred_date" type="date" min={minDate} defaultValue={minDate} required className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm" /></label>
    </div>
    <label><span className="mb-1.5 block text-xs font-semibold text-slate">Delivery Address</span><textarea name="address" rows="2" defaultValue={defaultAddress} required className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm" /></label>
    <label><span className="mb-1.5 block text-xs font-semibold text-slate">Remarks (optional)</span><textarea name="remarks" rows="2" placeholder="Preferred time or delivery instructions" className="w-full rounded-xl border border-line bg-card px-3 py-3 text-sm" /></label>
    {result && <p className={`rounded-xl px-3 py-2.5 text-xs ${result.ok ? "bg-greenSoft text-green" : "bg-coralSoft text-coral"}`}>{result.ok ? "Request submitted. We will confirm your delivery shortly." : result.error}</p>}
    <button disabled={busy} className="w-full rounded-2xl bg-aqua px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60">{busy ? "Submitting…" : "Submit Delivery Request"}</button>
  </form>;
}
