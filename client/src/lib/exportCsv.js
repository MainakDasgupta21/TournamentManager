/** Minimal, dependency-free CSV export. */

function escapeCell(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string from rows.
 * @param {Array} rows
 * @param {Array<{header:string, get:(row)=>any}>} columns
 */
export function toCsv(rows, columns) {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.get(r))).join(','))
    .join('\r\n');
  return `${head}\r\n${body}`;
}

/** Trigger a client-side download of a CSV string (BOM for Excel friendliness). */
export function downloadCsv(filename, csv) {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Filesystem-safe slug for filenames. */
export function slugify(name, fallback = 'export') {
  const s = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || fallback;
}
