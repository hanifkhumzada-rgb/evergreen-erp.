export function pkr(n) {
  return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK");
}
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ERP records are operated from Karachi. Formatting with an explicit time
// zone keeps server-rendered timestamps and browser-rendered timestamps
// identical, while still showing the full day, month and year requested for
// the audit trail.
export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Every ledger-posting trigger writes a description like "Invoice
// EGW-INV-000001" or "Payment received - EGW-RCT-000001" — the document
// number is always the last whitespace-separated token, and always
// contains a hyphen (no other word in these descriptions does). Used to
// show a Reference No. column on the client statement without adding a
// new schema column just to duplicate what's already in the text.
export function refNoFromDescription(description) {
  const last = (description || "").trim().split(/\s+/).pop() || "";
  return last.includes("-") ? last : "—";
}

// Plain amount without the currency prefix, for table cells whose column
// header already says "(PKR)". Keeps the sign.
export function amt(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("en-PK");
}

// Quantity with up to 2 decimals (bottles are whole numbers in practice).
export function qty(n) {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

// Today in Karachi as YYYY-MM-DD (server time on Vercel is UTC).
export function todayPK() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}
