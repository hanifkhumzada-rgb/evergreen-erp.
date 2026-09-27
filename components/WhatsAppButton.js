"use client";
import { MessageCircle } from "lucide-react";
import { waHref } from "@/lib/whatsapp";

// Click-to-WhatsApp reminder — a plain wa.me deep link with a prefilled,
// editable message, opened in a new tab. No WhatsApp Business API, no
// credentials, no per-message cost: works the moment this ships. The
// person sending still reviews and taps Send themselves in WhatsApp.
export default function WhatsAppButton({ phone, message, label = "WhatsApp", className = "" }) {
  const href = waHref(phone, message);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`no-print flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-green text-xs font-semibold hover:bg-greenSoft ${className}`}>
      <MessageCircle size={13} /> {label}
    </a>
  );
}
