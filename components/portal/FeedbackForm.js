"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { submitCustomerFeedback } from "@/app/portal/actions";

function StarInput({ name, label, required }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <div>
      <span className="text-xs font-semibold text-slate block mb-1.5">{label}{required && " *"}</span>
      <input type="hidden" name={name} value={value || ""} required={required} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setValue(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} aria-label={`${n} star`}>
            <Star size={26} className={(hover || value) >= n ? "fill-amber text-amber" : "text-line"} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackForm({ deliveries }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setStatus(null);
    const res = await submitCustomerFeedback(formData);
    setLoading(false);
    setStatus(res.ok ? "success" : res.error || "error");
    if (res.ok) document.getElementById("feedback-form")?.reset();
  };

  return (
    <form id="feedback-form" action={handleSubmit} className="bg-card border border-line rounded-2xl p-4 flex flex-col gap-4">
      <h2 className="text-sm font-bold">Give Feedback</h2>
      <StarInput name="overall_rating" label="Overall Experience" required />
      <StarInput name="delivery_rating" label="Delivery Boy" />
      <StarInput name="product_rating" label="Product Quality" />
      <StarInput name="timeliness_rating" label="Timeliness" />
      {deliveries?.length > 0 && (
        <label className="block">
          <span className="text-xs font-semibold text-slate block mb-1.5">Related Delivery (optional)</span>
          <select name="delivery_id" className="w-full px-3 py-2.5 rounded-xl border border-line bg-card text-sm">
            <option value="">None</option>
            {deliveries.map((d) => <option key={d.id} value={d.id}>{d.delivery_no} — {d.delivery_date}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs font-semibold text-slate block mb-1.5">Comments (optional)</span>
        <textarea name="comment" rows={3} className="w-full px-3 py-2.5 rounded-xl border border-line bg-card text-sm" placeholder="Tell us more..." />
      </label>
      {status === "success" && <p className="text-green text-xs bg-greenSoft px-3 py-2 rounded-lg">Thank you for your feedback!</p>}
      {status && status !== "success" && <p className="text-coral text-xs bg-coralSoft px-3 py-2 rounded-lg">{status}</p>}
      <button disabled={loading} className="py-2.5 rounded-xl bg-navyLight text-white text-xs font-bold disabled:opacity-60">
        {loading ? "Submitting…" : "Submit Feedback"}
      </button>
    </form>
  );
}
