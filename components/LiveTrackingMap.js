"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";

// A rider whose last reported position is older than this reads as
// "stale" — most likely their tab is backgrounded, they closed the app,
// or their route finished — rather than actively out for delivery.
const STALE_MS = 5 * 60 * 1000;
const DEFAULT_CENTER = [24.8607, 67.0011]; // fallback view before any rider has reported a position

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function riderDivIcon(L, stale) {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${stale ? "#94a3b8" : "#10b981"};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Current-location-only rider map (no route history / trip replay by
// design). Riders is [{ id, name, location: { latitude, longitude,
// recorded_at } | null }], passed in from a server-fetched initial
// snapshot; Supabase Realtime keeps it current after that.
export default function LiveTrackingMap({ riders: initialRiders }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const fittedRef = useRef(false);
  const [riders, setRiders] = useState(initialRiders);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("rider-locations-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rider_locations" }, (payload) => {
        const row = payload.new;
        setRiders((prev) => prev.map((r) => (r.id === row.rider_id
          ? { ...r, location: { rider_id: row.rider_id, latitude: row.latitude, longitude: row.longitude, recorded_at: row.recorded_at } }
          : r)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Nothing changes server-side every tick — this just re-renders the
  // "X min ago" labels and stale/fresh coloring as time passes.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  function updateMarkers(currentRiders) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const located = currentRiders.filter((r) => r.location);
    const seen = new Set();

    located.forEach((r) => {
      seen.add(r.id);
      const stale = Date.now() - new Date(r.location.recorded_at).getTime() > STALE_MS;
      const latlng = [r.location.latitude, r.location.longitude];
      const popupHtml = `<strong>${r.name}</strong><br/>${stale ? "Stale — " : ""}${timeAgo(r.location.recorded_at)}`;
      const existing = markersRef.current[r.id];
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(riderDivIcon(L, stale));
        existing.setPopupContent(popupHtml);
      } else {
        markersRef.current[r.id] = L.marker(latlng, { icon: riderDivIcon(L, stale) }).addTo(map).bindPopup(popupHtml);
      }
    });

    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });

    // Fit the view to whoever's reporting once, on first load — not on
    // every later update, or the map would keep yanking the Owner's
    // pan/zoom back every ~30-45s as riders report in.
    if (!fittedRef.current && located.length > 0) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds(located.map((r) => [r.location.latitude, r.location.longitude])), { padding: [40, 40], maxZoom: 15 });
    }
  }

  // Leaflet touches `window`/`document` on import, so it's loaded here
  // (client-only effect) rather than at module scope, keeping this
  // component safe to render during the server pass.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      updateMarkers(riders);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { updateMarkers(riders); }, [riders]); // eslint-disable-line react-hooks/exhaustive-deps

  const located = riders.filter((r) => r.location);
  const unlocated = riders.filter((r) => !r.location);

  return (
    <div>
      <div ref={containerRef} className="w-full rounded-2xl border border-line" style={{ height: "480px" }} />
      <div className="no-print mt-3 flex flex-wrap gap-2">
        {riders.length === 0 && <p className="text-sm text-slate">No riders configured for this business.</p>}
        {located.map((r) => {
          const stale = Date.now() - new Date(r.location.recorded_at).getTime() > STALE_MS;
          return (
            <span key={r.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold ${stale ? "text-slate" : "text-green"}`}>
              <span className={`w-2 h-2 rounded-full ${stale ? "bg-slate" : "bg-green"}`} />
              {r.name} · {timeAgo(r.location.recorded_at)}
            </span>
          );
        })}
        {unlocated.map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold text-slate opacity-60">
            <span className="w-2 h-2 rounded-full bg-slate opacity-40" /> {r.name} · no location yet
          </span>
        ))}
      </div>
    </div>
  );
}
