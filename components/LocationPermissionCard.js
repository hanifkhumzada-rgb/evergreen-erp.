"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LocateFixed, MapPinOff, Settings } from "lucide-react";
import { reportStaffLocation } from "@/app/actions";

export default function LocationPermissionCard() {
  const [permission, setPermission] = useState("prompt");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setPermission("unsupported"); return; }
    if (!navigator.permissions?.query) return;
    let result;
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      result = status;
      setPermission(status.state);
      status.onchange = () => setPermission(status.state);
    }).catch(() => {});
    return () => { if (result) result.onchange = null; };
  }, []);

  function enableLocation() {
    if (!navigator.geolocation) { setPermission("unsupported"); return; }
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const response = await reportStaffLocation(position.coords.latitude, position.coords.longitude);
      setBusy(false);
      if (response?.error) { setMessage(response.error); return; }
      setPermission("granted");
      setMessage("Location enabled. You will now appear in Live Tracking while the ERP is open.");
    }, (error) => {
      setBusy(false);
      if (error.code === error.PERMISSION_DENIED) {
        setPermission("denied");
        setMessage("Location is blocked in this browser. Use the site icon beside the address bar, select Location → Allow, then reload this page.");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setMessage("Location is unavailable. Turn on your device Location Services/GPS and try again.");
      } else {
        setMessage("Location request timed out. Turn on GPS and try again.");
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  const enabled = permission === "granted";
  return <section className={`mb-4 rounded-2xl border p-4 ${enabled ? "border-green/25 bg-greenSoft" : "border-aqua/25 bg-aquaSoft"}`}>
    <div className="flex items-start gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${enabled ? "bg-green text-white" : "bg-white text-aqua"}`}>{enabled ? <CheckCircle2 size={20}/> : permission === "denied" ? <MapPinOff size={20}/> : <LocateFixed size={20}/>}</span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{enabled ? "My Location is Enabled" : "Enable My Location"}</h3><p className="mt-1 text-[11px] leading-relaxed text-slate">{enabled ? "Location updates automatically while the ERP is open and visible." : "Tap once and choose Allow in the browser popup."}</p></div>
    </div>
    {!enabled && permission !== "unsupported" && <button type="button" onClick={enableLocation} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-navyLight px-4 py-3 text-xs font-bold text-white disabled:opacity-60"><LocateFixed size={16}/>{busy ? "Getting Location…" : "Enable Location Now"}</button>}
    {permission === "denied" && <div className="mt-3 flex gap-2 rounded-xl bg-white p-3 text-[11px] leading-relaxed text-slate"><Settings size={15} className="mt-0.5 shrink-0 text-aqua"/><span><strong>Already blocked?</strong> Tap the lock/site icon beside the browser address → Permissions → Location → Allow → Reload.</span></div>}
    {permission === "unsupported" && <p className="mt-3 rounded-xl bg-white p-3 text-xs text-coral">This browser or device does not support location access.</p>}
    {message && <p className={`mt-3 rounded-xl bg-white p-3 text-xs ${enabled ? "text-green" : "text-coral"}`}>{message}</p>}
  </section>;
}
