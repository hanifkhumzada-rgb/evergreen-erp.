"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LocateFixed, MapPinOff, Settings } from "lucide-react";
import { reportStaffLocation } from "@/app/actions";
import { isLocationSharingEnabled, LOCATION_SHARING_EVENT, LOCATION_STATUS_EVENT, setLocationSharingEnabled } from "@/components/StaffLocationTracker";

export default function LocationPermissionCard({ compact = false }) {
  const [permission, setPermission] = useState("prompt");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [trackingStatus, setTrackingStatus] = useState(null);

  useEffect(() => {
    setEnabled(isLocationSharingEnabled());
    const sync = () => setEnabled(isLocationSharingEnabled());
    const syncStatus = (event) => setTrackingStatus(event.detail || null);
    window.addEventListener(LOCATION_SHARING_EVENT, sync);
    window.addEventListener(LOCATION_STATUS_EVENT, syncStatus);
    if (!navigator.geolocation) { setPermission("unsupported"); return; }
    if (!navigator.permissions?.query) return;
    let result;
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      result = status;
      setPermission(status.state);
      status.onchange = () => setPermission(status.state);
    }).catch(() => {});
    return () => { if (result) result.onchange = null; window.removeEventListener(LOCATION_SHARING_EVENT, sync); window.removeEventListener(LOCATION_STATUS_EVENT, syncStatus); };
  }, []);

  function turnOff() {
    setLocationSharingEnabled(false);
    setEnabled(false);
    setMessage("Location sharing is OFF. ERP is no longer sending GPS updates from this device.");
  }

  function turnOn() {
    if (!navigator.geolocation) { setPermission("unsupported"); return; }
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const response = await reportStaffLocation(position.coords.latitude, position.coords.longitude);
      setBusy(false);
      if (response?.error) { setMessage(response.error); return; }
      setLocationSharingEnabled(true);
      setEnabled(true);
      setPermission("granted");
      setMessage("Duty started. Location updates while ERP is open and visible.");
    }, (error) => {
      setBusy(false);
      if (error.code === error.PERMISSION_DENIED) {
        setPermission("denied");
        setLocationSharingEnabled(false);
        setMessage("Location is blocked. Open the site icon/lock → Permissions → Location → Allow, then reload.");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setMessage("Location is unavailable. Turn on your device Location Services/GPS and try again.");
      } else {
        setMessage("Location request timed out. Turn on GPS and try again.");
      }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  if (compact) return <button type="button" onClick={enabled ? turnOff : turnOn} disabled={busy || permission === "unsupported"}
    className={`topbar-icon-btn inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold disabled:opacity-50 ${enabled ? "text-green" : "text-slate"}`}
    title={enabled ? "Turn location sharing off" : "Turn location sharing on"} aria-pressed={enabled}>
    {enabled ? <LocateFixed size={16}/> : <MapPinOff size={16}/>}<span className="hidden lg:inline">Location {busy ? "…" : enabled ? "ON" : "OFF"}</span>
  </button>;

  return <section className={`mb-4 rounded-2xl border p-4 ${enabled ? "border-green/25 bg-greenSoft" : "border-aqua/25 bg-aquaSoft"}`}>
    <div className="flex items-start gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${enabled ? "bg-green text-white" : "bg-white text-aqua"}`}>{enabled ? <CheckCircle2 size={20}/> : permission === "denied" ? <MapPinOff size={20}/> : <LocateFixed size={20}/>}</span>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-bold">My Location: {enabled ? "ON" : "OFF"}</h3><p className="mt-1 text-[11px] leading-relaxed text-slate">{enabled ? "Your position updates while ERP is open and visible." : "Turn it on when duty starts and off when duty ends."}</p>{enabled && trackingStatus ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-aqua">{trackingStatus.state === "live" ? "Live" : trackingStatus.state === "stationary" ? "Stationary" : trackingStatus.state === "poor" ? "Poor accuracy" : trackingStatus.state === "offline" ? "Offline" : trackingStatus.state === "stale" ? "Stale" : "Connecting"}{trackingStatus.accuracy ? ` · ±${trackingStatus.accuracy}m` : ""}</p> : null}</div>
      <button type="button" onClick={enabled ? turnOff : turnOn} disabled={busy || permission === "unsupported"} role="switch" aria-checked={enabled} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-green" : "bg-slate/30"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}/></button>
    </div>
    {!enabled && permission !== "unsupported" && <button type="button" onClick={turnOn} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-navyLight px-4 py-3 text-xs font-bold text-white disabled:opacity-60"><LocateFixed size={16}/>{busy ? "Getting Location…" : "Start Duty & Location"}</button>}
    {enabled && <button type="button" onClick={turnOff} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-coral/30 bg-white px-4 py-3 text-xs font-bold text-coral"><MapPinOff size={16}/>End Duty & Turn Location Off</button>}
    {permission === "denied" && <div className="mt-3 flex gap-2 rounded-xl bg-white p-3 text-[11px] leading-relaxed text-slate"><Settings size={15} className="mt-0.5 shrink-0 text-aqua"/><span><strong>Blocked?</strong> Chrome: site icon → Permissions → Location → Allow. Installed app: phone Settings → Apps → Evergreen Water/Chrome → Permissions → Location → Allow while using app.</span></div>}
    {permission === "unsupported" && <p className="mt-3 rounded-xl bg-white p-3 text-xs text-coral">This browser or device does not support location access.</p>}
    {message && <p className={`mt-3 rounded-xl bg-white p-3 text-xs ${enabled ? "text-green" : "text-coral"}`}>{message}</p>}
  </section>;
}
