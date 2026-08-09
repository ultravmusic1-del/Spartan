/**
 * RFC 4180 CSV, with one deliberate departure.
 *
 * A field beginning `=`, `+`, `-` or `@` is executed as a formula by Excel and
 * Google Sheets. Enquiry messages are free text written by strangers, so
 * exporting them verbatim hands whoever opens the file a script somebody else
 * wrote. Prefixing with a single quote is the standard neutralisation, and
 * spreadsheets strip it on display so nothing is lost to a human reader.
 *
 * The cost is that a genuinely negative number becomes text. Nothing this
 * exports is negative — quantities and line counts are the only numerics, and
 * both are bounded at 1 by `enquiryPayloadSchema` — so the trade is free here.
 * It would not be in a financial export.
 */
const RISKY = /^[=+\-@]/;

function field(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = RISKY.test(raw) ? `'${raw}` : raw;

  // Quote when the content requires it, and always when it was neutralised —
  // an unquoted leading apostrophe is not reliably honoured.
  const mustQuote = /[",\r\n]/.test(safe) || safe !== raw;
  return mustQuote ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly (keyof T & string)[],
): string {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => field(row[column])).join(','));
  return [header, ...body].join('\r\n');
}
