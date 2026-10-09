export function personSearchTerms(search: string): string[] {
  return search.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
}

export function matchesPersonSearch(terms: string[], fields: Array<string | null | undefined>): boolean {
  const values = fields.filter((field): field is string => Boolean(field)).map((field) => field.toLowerCase());
  return terms.every((term) => values.some((value) => value.includes(term)));
}

export function personSearchFilter(search: string, numberColumn: string): string | null {
  const columns = [numberColumn, "first_name", "middle_name", "last_name", "suffix"];
  const terms = personSearchTerms(search);
  if (!terms.length) return null;
  // Quote values for PostgREST's filter grammar and keep LIKE wildcards literal.
  const groups = terms.map((term) => {
    const pattern = `%${term.replace(/[\\%_*]/g, "\\$&")}%`;
    return `or(${columns.map((column) => `${column}.ilike.${JSON.stringify(pattern)}`).join(",")})`;
  });
  return `and(${groups.join(",")})`;
}
