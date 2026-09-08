export function pkr(n) {
  return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK");
}
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
