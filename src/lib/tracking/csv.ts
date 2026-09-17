export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function toCsv(rows: unknown[][]) {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
