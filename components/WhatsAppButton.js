"use client";
import { MessageCircle } from "lucide-react";

// Pakistani numbers are stored locally (03001234567) — wa.me needs the
// international form with no leading zero, prefixed by the country code.
// Already-international numbers (92... or +92...) pass through untouched.
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

// Click-to-WhatsApp reminder — a plain wa.me deep link with a prefilled,
// editable message, opened in a new tab. No WhatsApp Business API, no
// credentials, no per-message cost: works the moment this ships. The
// person sending still reviews and taps Send themselves in WhatsApp.
export default function WhatsAppButton({ phone, message, label = "WhatsApp", className = "" }) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const href = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`no-print flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-green text-xs font-semibold hover:bg-greenSoft ${className}`}>
      <MessageCircle size={13} /> {label}
    </a>
  );
}
