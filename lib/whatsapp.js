// Shared by the one-tap WhatsAppButton and the bulk reminder queue.
// Pakistani numbers are stored locally (03001234567) — wa.me needs the
// international form with no leading zero, prefixed by the country code.
// Already-international numbers (92... or +92...) pass through untouched.
export function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

// wa.me deep link with a prefilled, editable message (null if no usable number).
export function waHref(phone, message) {
  const normalized = normalizePhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message || "")}` : null;
}
