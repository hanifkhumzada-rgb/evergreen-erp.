"use client";
import { useEffect, useRef } from "react";
import { reportStaffLocation } from "@/app/actions";

export const LOCATION_SHARING_KEY = "ew-location-sharing-enabled";
export const LOCATION_SHARING_EVENT = "ew-location-sharing-change";
const INTERVAL_MS = 45000;

export function isLocationSharingEnabled() {
  return typeof window !== "undefined" && localStorage.getItem(LOCATION_SHARING_KEY) === "true";
}

export function setLocationSharingEnabled(enabled) {
  localStorage.setItem(LOCATION_SHARING_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(LOCATION_SHARING_EVENT, { detail: { enabled } }));
}

// Reports only after this user explicitly turns Location ON on this device.
// OFF clears the timer immediately; browser permission may remain granted,
// but no coordinates are requested or uploaded.
export default function StaffLocationTracker() {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const sendPosition = () => {
      if (!isLocationSharingEnabled() || document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => reportStaffLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {}),
        () => {},
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
      );
    };

    const start = () => {
      stop();
      if (!isLocationSharingEnabled()) return;
      sendPosition();
      timerRef.current = setInterval(sendPosition, INTERVAL_MS);
    };

    const onVisibilityChange = () => { if (document.visibilityState === "visible") sendPosition(); };
    start();
    window.addEventListener(LOCATION_SHARING_EVENT, start);
    window.addEventListener("storage", start);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      window.removeEventListener(LOCATION_SHARING_EVENT, start);
      window.removeEventListener("storage", start);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
