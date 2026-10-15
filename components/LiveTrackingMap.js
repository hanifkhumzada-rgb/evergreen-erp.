"use client";
import { useEffect, useRef, useState } from "react";
import { Focus, Lock, Map, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";

// A staff member whose last reported position is older than this reads
// as "stale" — most likely their tab is backgrounded or they've closed
// the app — rather than currently active.
const STALE_MS = 5 * 60 * 1000;
const DEFAULT_CENTER = [24.8607, 67.0011]; // fallback view before anyone has reported a position

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

// Current-location-only staff map (no route history / trip replay by
// design). Riders is [{ id, name, role, location: { latitude, longitude,
// recorded_at } | null }], passed in from a server-fetched initial
// snapshot; Supabase Realtime keeps it current after that. (Prop/var
// names kept as "riders" — this component predates the generalization to
// every staff role and the rename isn't worth the churn.)
export default function LiveTrackingMap({ riders: initialRiders }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const fittedRef = useRef(false);
  const [riders, setRiders] = useState(initialRiders);
  const [interactive, setInteractive] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => { setRiders(initialRiders); }, [initialRiders]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("staff-locations-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_locations" }, (payload) => {
        const row = payload.new;
        setRiders((prev) => prev.map((r) => (r.id === row.user_id
          ? { ...r, location: { user_id: row.user_id, latitude: row.latitude, longitude: row.longitude, recorded_at: row.recorded_at } }
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
      const popupHtml = `<strong>${r.name}</strong>${r.role ? ` <span style="color:#5C7D78">(${r.role})</span>` : ""}<br/>${stale ? "Stale — " : ""}${timeAgo(r.location.recorded_at)}`;
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
      [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard]
        .forEach((control) => control?.disable());
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const controls = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard];
    controls.forEach((control) => interactive ? control?.enable() : control?.disable());
    if (interactive) map.invalidateSize();
  }, [interactive]);

  const fitRiders = () => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const points = riders.filter((r) => r.location).map((r) => [r.location.latitude, r.location.longitude]);
    if (!map || !L) return;
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    else map.setView(DEFAULT_CENTER, 12);
  };

  const located = riders.filter((r) => r.location);
  const unlocated = riders.filter((r) => !r.location);

  return (
    <div className="min-w-0">
      <div className={`relative overflow-hidden rounded-2xl border border-line bg-foam ${interactive ? "ring-2 ring-aqua/40" : ""}`}>
        <div ref={containerRef} className="h-[320px] w-full sm:h-[420px] xl:h-[480px]" aria-label="Live staff location map" />
        {!interactive ? <button type="button" onClick={() => setInteractive(true)} className="absolute inset-0 z-[500] flex items-center justify-center bg-navy/5" aria-label="Enable map interaction">
          <span className="flex items-center gap-2 rounded-xl bg-card/95 px-4 py-3 text-xs font-bold text-ink shadow-lg"><Map size={16}/>Tap to interact with map</span>
        </button> : null}
        <div className="absolute right-2 top-2 z-[600] flex gap-2">
          <button type="button" onClick={fitRiders} className="grid h-9 w-9 place-items-center rounded-lg bg-card text-ink shadow" title="Fit all riders" aria-label="Fit all riders"><Focus size={16}/></button>
          {interactive ? <button type="button" onClick={() => setInteractive(false)} className="flex h-9 items-center gap-1 rounded-lg bg-navy px-3 text-[11px] font-bold text-white shadow" aria-label="Exit map interaction"><X size={15}/>Exit map</button> : null}
        </div>
        {!interactive ? <div className="pointer-events-none absolute bottom-2 left-2 z-[600] flex items-center gap-1 rounded-lg bg-card/90 px-2 py-1 text-[10px] font-semibold text-slate"><Lock size={11}/>Page scrolling stays active</div> : null}
      </div>
      <div className="no-print mt-3 flex flex-wrap gap-2">
        {riders.length === 0 && <p className="text-sm text-slate">No staff configured for this business.</p>}
        {located.map((r) => {
          const stale = Date.now() - new Date(r.location.recorded_at).getTime() > STALE_MS;
          return (
            <span key={r.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold ${stale ? "text-slate" : "text-green"}`}>
              <span className={`w-2 h-2 rounded-full ${stale ? "bg-slate" : "bg-green"}`} />
              {r.name}{r.role ? ` (${r.role})` : ""} · {timeAgo(r.location.recorded_at)}
            </span>
          );
        })}
        {unlocated.map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold text-slate opacity-60">
            <span className="w-2 h-2 rounded-full bg-slate opacity-40" /> {r.name}{r.role ? ` (${r.role})` : ""} · no location yet
          </span>
        ))}
      </div>
    </div>
  );
}
