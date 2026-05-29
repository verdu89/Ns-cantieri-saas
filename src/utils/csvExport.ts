/** Escape RFC4180 cell for CSV. */
export function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Scarica un CSV UTF-8 con BOM (Excel su Windows legge correttamente à, è, €, ecc.).
 */
export function downloadCsvFile(filename: string, rows: unknown[][]): void {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(","));
  const csv = lines.join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
