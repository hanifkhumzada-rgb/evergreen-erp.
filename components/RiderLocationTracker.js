"use client";
import { useEffect, useRef, useState } from "react";
import { reportRiderLocation } from "@/app/actions";

const INTERVAL_MS = 45000;

// Mounted only on the rider's Today's Route view, and only while they have
// at least one still-pending delivery today (see deliveries/page.js) — that
// "active route" condition is the caller's job, not this component's. Sends
// one position on mount, then every ~45s, but only while the tab is actually
// visible in the foreground (Page Visibility API) so it doesn't drain the
// battery running in a background tab. Declining the permission prompt (or
// a device with no geolocation support) just stops silently — no error
// surfaced, no effect on the rest of the page.
export default function RiderLocationTracker() {
  const [denied, setDenied] = useState(false);
  const timerRef = useRef(null);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const sendPosition = () => {
      if (deniedRef.current || document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          reportRiderLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            deniedRef.current = true;
            setDenied(true);
          }
          // Timeout/position-unavailable — try again on the next tick, no
          // need to surface a transient GPS hiccup to the rider.
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

  // Nothing to show on the happy path — this is a background reporter, not
  // a UI element. A denied permission gets one quiet, dismissible-by-nature
  // line (no state to dismiss it, it just never blocks anything) so a rider
  // who declined understands why "Live Tracking" won't show them, without
  // it reading like an error.
  if (!denied) return null;
  return <p className="no-print text-[11px] text-slate mt-1">Location sharing is off (permission declined) — the Owner won&apos;t see your live position on the map.</p>;
}
