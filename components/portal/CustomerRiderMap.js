"use client";
import { useEffect, useRef, useState } from "react";
import { Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";

// Single-rider live map for the Customer Portal Dashboard — reuses the
// exact same staff_locations + Realtime infrastructure as the staff Live
// Tracking map (components/LiveTrackingMap.js), scoped down to one rider.
// Security is enforced entirely by RLS (p_staff_locations_customer_self,
// migration 0037, renamed onto staff_locations by migration 0038): a
// customer session can only ever SELECT this rider's row while a
// delivery assigned to THEM, dated today, is 'out_for_delivery' —
// Realtime already respects RLS for subscribers, so this component never
// receives another rider's or another customer's location, and the
// moment the delivery is no longer out for delivery the subscription
// simply stops receiving updates for it.
function riderDivIcon(L) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function CustomerRiderMap({ riderId, initialLocation }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markerRef = useRef(null);
  const [location, setLocation] = useState(initialLocation || null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rider-location-${riderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "staff_locations", filter: `user_id=eq.${riderId}` }, (payload) => {
        setLocation({ latitude: payload.new.latitude, longitude: payload.new.longitude });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [riderId]);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current || !location) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([location.latitude, location.longitude], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      markerRef.current = L.marker([location.latitude, location.longitude], { icon: riderDivIcon(L) }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!location || !mapRef.current || !markerRef.current) return;
    const latlng = [location.latitude, location.longitude];
    markerRef.current.setLatLng(latlng);
    mapRef.current.panTo(latlng);
  }, [location]);

  if (!location) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-line">
      <div className="bg-navyLight text-white px-4 py-2.5 flex items-center gap-2 text-xs font-bold">
        <Truck size={14} /> Your rider is on the way
      </div>
      <div ref={containerRef} className="w-full" style={{ height: "180px" }} />
    </div>
  );
}
