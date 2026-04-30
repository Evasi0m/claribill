/** Date/time formatters reused across the app. We can't share `Intl.DateTime
 *  Format` here because the existing call sites use specific patterns (CSV
 *  needs ISO-ish, history list needs "DD/MM/YYYY HH:mm", filenames need
 *  compact "YYYYMMDD-HHmm") and matching them via Intl options is more
 *  fragile than the pad helpers below. */

const pad = (n: number) => String(n).padStart(2, "0");

/** "DD/MM HH:mm" — used for auto-generated history entry titles. */
export function fmtShortDate(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "DD/MM/YYYY HH:mm" — used in HistoryModal entry metadata row. */
export function fmtLongDate(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DD HH:mm" — used in CSV exports for sortability. */
export function fmtIsoDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "<prefix>-YYYYMMDD-HHmm.<ext>" — safe for filesystems on every platform. */
export function todayFilename(prefix: string, ext: string): string {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

/** Shared Intl.NumberFormat — constructing one is non-trivial and we were
 *  paying that cost on every render of every BigCard / SmallCard / FeeTable
 *  row. Caching at module scope keeps it to a one-time hit. */
const moneyFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n: number): string {
  return moneyFormatter.format(n);
}
