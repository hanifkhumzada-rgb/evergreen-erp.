// Shared helpers for server-paginated list pages.

export const DEFAULT_PAGE_SIZE = 50;

export function pageFrom(sp, param = "page") {
  return Math.max(1, Number.parseInt(sp?.[param], 10) || 1);
}

// [from, to] for supabase .range()
export function rangeFor(page, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

// Builds a link to the same page with some params changed (empty = removed).
export function hrefWith(basePath, sp, changes = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) if (typeof v === "string" && v) params.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === null || v === "" || (k === "page" && Number(v) === 1)) params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

// Escapes a user search term for a PostgREST .or() ilike filter. Commas,
// parentheses and the ilike wildcards would otherwise change the filter's
// meaning (or break it), so they are stripped/escaped.
export function ilikeTerm(q) {
  const cleaned = String(q || "").replace(/[,()*"\\]/g, " ").replace(/[%_]/g, (m) => `\\${m}`).trim();
  return cleaned ? `%${cleaned.replace(/\s+/g, "%")}%` : "";
}

// .or() expression matching the term against several columns.
export function orIlike(columns, q) {
  const term = ilikeTerm(q);
  return term ? columns.map((c) => `${c}.ilike.${term}`).join(",") : "";
}
