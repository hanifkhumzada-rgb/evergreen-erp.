// Date-range presets shared by every report and statement. Plain module —
// works on server and client. All dates are Karachi calendar days as
// YYYY-MM-DD strings (Vercel's server clock is UTC).

export function pkToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function parse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function iso(d) { return d.toISOString().slice(0, 10); }
export function addDays(s, n) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

export const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

export function presetRange(key, today = pkToday()) {
  const t = parse(today);
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: y }; }
    case "week": { const dow = (t.getUTCDay() + 6) % 7; return { from: addDays(today, -dow), to: today }; } // Monday-start
    case "last_month": {
      const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return { from: iso(first), to: iso(last) };
    }
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all": return { from: "", to: "" };
    case "month":
    default: return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

const VALID = /^\d{4}-\d{2}-\d{2}$/;

// Resolves ?range=&from=&to= from searchParams into a concrete period.
export function resolveRange(sp = {}, fallback = "month") {
  const key = sp.range || (sp.from || sp.to ? "custom" : fallback);
  if (key === "custom") {
    const from = VALID.test(sp.from || "") ? sp.from : "";
    const to = VALID.test(sp.to || "") ? sp.to : "";
    if (from && to && from > to) return { key, from: to, to: from };
    return { key, from, to };
  }
  return { key, ...presetRange(key) };
}

export function fmtDay(s) {
  if (!s) return "";
  return parse(s).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
}

export function periodLabel({ from, to }) {
  if (!from && !to) return "All time";
  if (from && to && from === to) return fmtDay(from);
  if (from && to) return `${fmtDay(from)} – ${fmtDay(to)}`;
  if (from) return `From ${fmtDay(from)}`;
  return `Up to ${fmtDay(to)}`;
}

export function daysBetween(a, b) {
  return Math.round((parse(b) - parse(a)) / 86400000);
}
