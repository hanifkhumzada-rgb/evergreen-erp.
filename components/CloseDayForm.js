"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closeDay } from "@/app/actions";
import { pkr } from "@/lib/format";

export default function CloseDayForm({ today, defaultOpeningCash, expectedCash }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [opening, setOpening] = useState(String(defaultOpeningCash ?? 0));
  const router = useRouter();
  // expectedCash arrives for the default opening; follow any edit to it.
  const expectedNow = Number(expectedCash || 0) - Number(defaultOpeningCash || 0) + (Number(opening) || 0);
  const difference = actualCash === "" ? 0 : Number(actualCash) - expectedNow;

  const handleSubmit = async (formData) => {
    setBusy(true); setError("");
    try {
      const res = await closeDay(formData);
      setBusy(false);
      if (res?.error) { setError(res.error); return; }
      setResult(res);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Network error — please check your connection and try again.");
    }
  };

  return (
    <form action={handleSubmit} className="border border-line rounded-2xl p-5 max-w-md">
      <label className="block mb-3">
        <span className="text-xs font-semibold text-slate block mb-1">Closing date</span>
        <input type="date" name="close_date" defaultValue={today} required className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      <label className="block mb-3">
        <span className="text-xs font-semibold text-slate block mb-1">Opening cash (PKR)</span>
        <input type="number" name="opening_cash" value={opening} onChange={(event) => setOpening(event.target.value)} required className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      <label className="block mb-4">
        <span className="text-xs font-semibold text-slate block mb-1">Actual cash counted (PKR)</span>
        <input type="number" name="actual_cash" required value={actualCash} onChange={(event) => setActualCash(event.target.value)} className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      {actualCash !== "" && <div className={`mb-3 rounded-xl px-3 py-2 text-xs ${Math.abs(difference) < 1 ? "bg-greenSoft text-green" : "bg-coralSoft text-coral"}`}><div className="flex justify-between font-bold"><span>Difference</span><span>{difference >= 0 ? "+" : ""}{pkr(difference)}</span></div></div>}
      {actualCash !== "" && Math.abs(difference) >= 1 ? <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Difference explanation <strong className="text-coral">*</strong></span><textarea name="difference_reason" required minLength={5} rows={3} placeholder="Explain cash shortage or excess…" className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink" /></label> : null}
      {error && <p className="text-coral text-xs mb-3">{error}</p>}
      <button disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Submitting…" : "Submit for closing"}</button>

      {result && (
        <div className="mt-4 p-3 rounded-xl bg-foam text-sm">
          <div className="flex justify-between"><span>Expected cash</span><span>{pkr(result.expectedCash)}</span></div>
          {result.id ? <Link href={`/accounting/daily-closing/${result.id}`} className="mt-2 inline-block text-xs font-semibold text-aqua">View Daily Closing Statement →</Link> : null}
          <div className={`flex justify-between font-bold ${Math.abs(result.difference) < 1 ? "text-green" : "text-coral"}`}>
            <span>Difference</span><span>{result.difference >= 0 ? "+" : ""}{pkr(result.difference)}</span>
          </div>
        </div>
      )}
    </form>
  );
}
