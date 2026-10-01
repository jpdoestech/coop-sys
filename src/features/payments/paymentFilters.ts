export function parseYearFilter(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
  if (!match) return null;
  const from = Number(match[1]);
  const to = Number(match[2] ?? match[1]);
  if (from < 1900 || to > 2200 || from > to) return null;
  return { yearFrom: from, yearTo: to };
}

export function compactPeriod(from: string | null, to: string | null, fallbackDate: string) {
  if (!from || !to) return { month: new Date(`${fallbackDate}T00:00:00`).toLocaleString("en-PH", { month: "short" }), period: "Date only" };
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const month = start.toLocaleString("en-PH", { month: "short" });
  const endMonth = end.toLocaleString("en-PH", { month: "short" });
  return { month, period: start.getMonth() === end.getMonth() ? `${month}_${start.getDate()}-${end.getDate()}` : `${month}_${start.getDate()}-${endMonth}_${end.getDate()}` };
}
