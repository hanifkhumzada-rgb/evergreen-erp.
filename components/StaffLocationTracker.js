"use client";
import { useEffect, useRef, useState } from "react";
import { reportStaffLocation } from "@/app/actions";

const INTERVAL_MS = 45000;

// Mounted once, globally, in app/(app)/layout.js — every logged-in staff
// member (Owner/Admin/Manager/Accountant/Rider) reports their position
// while the app is open, not just riders during an active delivery
// (generalized from the original rider-only, delivery-scoped design; see
// migration 0038 and components/LiveTrackingMap.js). Sends one position
// on mount, then every ~45s, but only while the tab is actually visible
// in the foreground (Page Visibility API) so it doesn't drain the
// battery running in a background tab. Declining the permission prompt
// (or a device with no geolocation support) just stops silently — no
// error surfaced, no effect on the rest of the app.
//
// Note: this is a materially more invasive default than the original
// design — continuous location tracking of office staff (not just
// riders actively out on a delivery) whenever they have the app open.
export default function StaffLocationTracker() {
  const [denied, setDenied] = useState(false);
  const timerRef = useRef(null);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const sendPosition = () => {
      if (deniedRef.current || document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          reportStaffLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            deniedRef.current = true;
            setDenied(true);
          }
          // Timeout/position-unavailable — try again on the next tick, no
          // need to surface a transient GPS hiccup.
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );
    };

    sendPosition();
    timerRef.current = setInterval(sendPosition, INTERVAL_MS);

    const onVisibilityChange = () => { if (document.visibilityState === "visible") sendPosition(); };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Nothing to show on the happy path — this is a background reporter,
  // not a UI element. A denied permission gets one quiet, unobtrusive
  // line in the header area so someone who declined understands why
  // "Live Tracking" won't show them, without it reading like an error.
  if (!denied) return null;
  return <p className="no-print text-[10.5px] text-slate">Location sharing is off (permission declined) — you won&apos;t appear on Live Tracking.</p>;
}
