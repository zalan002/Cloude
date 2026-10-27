// Supabase (PostgREST) returns at most 1000 rows per request ("Max rows"
// API setting) and silently drops the rest. Lists that can grow past that
// limit must be fetched page by page.
const PAGE_SIZE = 1000;

// buildQuery must return a fresh, fully filtered query each time it is called.
// The query needs a deterministic order (e.g. end with .order('id')),
// otherwise rows can be skipped or repeated between pages.
// Stops on an empty page, so it still works if "Max rows" is below PAGE_SIZE.
export async function fetchAll(buildQuery) {
  const rows = [];
  for (;;) {
    const { data, error } = await buildQuery().range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...data);
  }
}
