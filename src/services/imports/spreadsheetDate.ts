function calendarDate(year: number, month: number, day: number) {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10) : null;
}

export function spreadsheetDate(value: unknown, date1904 = false): string | null {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial < (date1904 ? 0 : 1) || serial > 2958465 || (!date1904 && serial === 60)) return null;
    // Excel's 1900 calendar includes a fictitious February 29 (serial 60).
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, serial < 60 ? 31 : 30);
    const date = new Date(epoch + serial * 86400000);
    return calendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.exec(text);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (slash) return calendarDate(Number(slash[3]), Number(slash[1]), Number(slash[2]));
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const named = /^(?:(\d{1,2})[- ]([a-z]+)[- ,]+(\d{4})|([a-z]+)\.? +(\d{1,2}),? +(\d{4}))$/i.exec(text);
  if (named) return calendarDate(Number(named[3] || named[6]), months.indexOf((named[2] || named[4]).slice(0, 3).toLowerCase()) + 1, Number(named[1] || named[5]));
  return null;
}
