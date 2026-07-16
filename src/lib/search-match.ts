// Global record search: case- and accent-insensitive, matches any field value.
export function normalize(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Returns true if any primitive field value of `row` contains every token in `query`.
 * Splits query on whitespace so "joao 150" matches records containing both.
 * Ignores keys starting with "_" and object/array values.
 */
export function matchesQuery(row: Record<string, unknown>, query: string): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = Object.entries(row)
    .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== undefined && typeof v !== "object")
    .map(([, v]) => normalize(v))
    .join(" \u0001 ");
  return tokens.every((t) => haystack.includes(t));
}
