export function pkr(n) {
  return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK");
}
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
