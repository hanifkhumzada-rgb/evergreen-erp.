"use client";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { updateCustomerLiveTrackingSetting } from "@/app/actions";

// Owner-controlled toggle for whether the Customer Portal's Home page
// shows the live rider map during an "Out for Delivery" delivery.
// Defaults to on; this component just flips business_settings.
// customer_live_tracking_enabled — app/portal/(main)/page.js checks it
// before even querying staff_locations, so turning it off removes the
// map section entirely for every customer, no other behavior change.
export default function CustomerTrackingToggle({ initialEnabled }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const res = await updateCustomerLiveTrackingSetting(next);
    setSaving(false);
    if (res?.error) setEnabled(!next); // revert on failure
  };

  return (
    <div className="border border-line rounded-2xl p-4 flex items-center justify-between gap-4 bg-card">
      <div className="flex items-start gap-3 min-w-0">
        <MapPin size={16} className="text-aqua mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-bold">Customers can see live delivery tracking</div>
          <p className="text-xs text-slate mt-0.5">When on, a customer whose delivery is "Out for Delivery" sees their rider's live position on their Home page. Off removes that section for everyone.</p>
        </div>
      </div>
      <button type="button" onClick={toggle} disabled={saving}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-60 ${enabled ? "bg-aqua" : "bg-line"}`}
        role="switch" aria-checked={enabled} aria-label="Customers can see live delivery tracking">
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
