"use client";
import { useEffect, useRef } from "react";
import { reportStaffLocation } from "@/app/actions";

export const LOCATION_SHARING_KEY = "ew-location-sharing-enabled";
export const LOCATION_SHARING_EVENT = "ew-location-sharing-change";
export const LOCATION_STATUS_EVENT = "ew-location-status-change";
const HEARTBEAT_MS = 2 * 60 * 1000;
const MIN_MOVEMENT_METERS = 30;
const MAX_ACCURACY_METERS = 200;

function emitStatus(detail) {
  window.dispatchEvent(new CustomEvent(LOCATION_STATUS_EVENT, { detail }));
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

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
export default function StaffLocationTracker({ enabledForRole = false }) {
  const watchRef = useRef(null);
  const lastSentRef = useRef(null);

  useEffect(() => {
    if (!enabledForRole || !navigator.geolocation) return;

    const stop = (reason = "Duty ended") => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      emitStatus({ state: "off", message: reason });
    };

    const handlePosition = async (pos) => {
      if (!isLocationSharingEnabled() || document.visibilityState !== "visible") return;
      const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const previous = lastSentRef.current;
      const elapsed = previous ? Date.now() - previous.sentAt : Infinity;
      const moved = distanceMeters(previous, point);
      if (pos.coords.accuracy > MAX_ACCURACY_METERS) {
        emitStatus({ state: "poor", accuracy: Math.round(pos.coords.accuracy), message: "GPS accuracy is weak." });
        return;
      }
      if (previous && moved < MIN_MOVEMENT_METERS && elapsed < HEARTBEAT_MS) {
        emitStatus({ state: "stationary", accuracy: Math.round(pos.coords.accuracy), updatedAt: previous.sentAt });
        return;
      }
      if (!navigator.onLine) {
        emitStatus({ state: "offline", message: "Internet disconnected. A fresh point will send after reconnecting." });
        return;
      }
      emitStatus({ state: "sending", accuracy: Math.round(pos.coords.accuracy) });
      const response = await reportStaffLocation(point.latitude, point.longitude).catch(() => ({ error: "Network error" }));
      if (response?.error) {
        emitStatus({ state: "error", message: response.error });
        return;
      }
      lastSentRef.current = { ...point, sentAt: Date.now() };
      emitStatus({ state: "live", accuracy: Math.round(pos.coords.accuracy), updatedAt: Date.now() });
    };

    const start = () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      if (!isLocationSharingEnabled()) { emitStatus({ state: "off" }); return; }
      if (document.visibilityState !== "visible") { emitStatus({ state: "stale", message: "App is in background. Tracking resumes when opened." }); return; }
      emitStatus({ state: "starting" });
      watchRef.current = navigator.geolocation.watchPosition(handlePosition, (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        emitStatus({ state: denied ? "denied" : "gps-error", message: denied ? "Location permission denied." : "GPS is unavailable." });
        if (denied) setLocationSharingEnabled(false);
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
    };

    const onVisibilityChange = () => { if (document.visibilityState === "visible") start(); else stop("App is in background. Tracking resumes when opened."); };
    const onOnline = () => { if (isLocationSharingEnabled()) start(); };
    const onOffline = () => emitStatus({ state: "offline", message: "Internet disconnected." });
    start();
    window.addEventListener(LOCATION_SHARING_EVENT, start);
    window.addEventListener("storage", start);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      window.removeEventListener(LOCATION_SHARING_EVENT, start);
      window.removeEventListener("storage", start);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabledForRole]);

  return null;
}
