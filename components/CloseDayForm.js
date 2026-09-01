"use client";
import { useState } from "react";
import { closeDay } from "@/app/actions";
import { pkr } from "@/components/ui";

export default function CloseDayForm({ today, defaultOpeningCash }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (formData) => {
    setBusy(true); setError("");
    const res = await closeDay(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setResult(res);
  };

  return (
    <form action={handleSubmit} className="border border-line rounded-2xl p-5 max-w-md">
      <label className="block mb-3">
        <span className="text-xs font-semibold text-slate block mb-1">Closing date</span>
        <input type="date" name="close_date" defaultValue={today} required className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      <label className="block mb-3">
        <span className="text-xs font-semibold text-slate block mb-1">Opening cash (PKR)</span>
        <input type="number" name="opening_cash" defaultValue={defaultOpeningCash} required className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      <label className="block mb-4">
        <span className="text-xs font-semibold text-slate block mb-1">Actual cash counted (PKR)</span>
        <input type="number" name="actual_cash" required className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-sm" />
      </label>
      {error && <p className="text-coral text-xs mb-3">{error}</p>}
      <button disabled={busy} className="w-full py-2.5 rounded-lg bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Closing…" : "Close the day"}</button>

      {result && (
        <div className="mt-4 p-3 rounded-xl bg-foam text-sm">
          <div className="flex justify-between"><span>Expected cash</span><span>{pkr(result.expectedCash)}</span></div>
          <div className={`flex justify-between font-bold ${Math.abs(result.difference) < 1 ? "text-green" : "text-coral"}`}>
            <span>Difference</span><span>{result.difference >= 0 ? "+" : ""}{pkr(result.difference)}</span>
          </div>
        </div>
      )}
    </form>
  );
}
