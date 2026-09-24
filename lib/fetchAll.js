// Supabase's API returns at most 1,000 rows per request (PostgREST
// max-rows) and silently drops the rest. Anything that totals or exports a
// date range — reports, a month of deliveries — must page through the full
// result instead, or totals quietly come out short once volume grows.
//
// `buildQuery` must return a NEW query builder each call (builders are
// mutated by .range()), and should include a deterministic order ending in
// a unique column so pages never overlap or skip rows.
export const FETCH_PAGE_SIZE = 1000;

export async function fetchAll(buildQuery, { label = "query" } = {}) {
  const rows = [];
  for (let start = 0; ; start += FETCH_PAGE_SIZE) {
    const { data, error } = await buildQuery().range(start, start + FETCH_PAGE_SIZE - 1);
    if (error) {
      console.error(`[fetchAll] ${label} failed`, { code: error.code, message: error.message });
      return { data: rows, error };
    }
    rows.push(...(data || []));
    if (!data || data.length < FETCH_PAGE_SIZE) return { data: rows, error: null };
  }
}
