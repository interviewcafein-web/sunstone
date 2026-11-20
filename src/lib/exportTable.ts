// Download a table as CSV, Excel (.xlsx) or PDF, from the rows already on the page. The Excel
// writer and the PDF renderer load only when someone asks for a file.

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

export interface ExportSheet<T> {
  sheet: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

const safeName = (name: string) => name.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName(fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (value: string | number | null | undefined) => {
  if (value == null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function downloadCsv<T>(fileName: string, columns: ExportColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(',')),
  ];
  // The byte-order mark makes Excel read the file as UTF-8 (₹, names with accents).
  save(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);
}

/** One workbook, one sheet per table. */
export async function downloadXlsx(fileName: string, sheets: ExportSheet<any>[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const used = new Set<string>();
  const workbook = sheets.map(({ sheet, columns, rows }) => {
    // Excel sheet names: at most 31 characters, unique, without []:*?/\
    let name = sheet.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
    for (let n = 2; used.has(name); n++) name = `${name.slice(0, 28)} ${n}`;
    used.add(name);
    return {
      sheet: name,
      data: [
        columns.map((column) => ({ value: column.header, fontWeight: 'bold' as const })),
        ...rows.map((row) =>
          columns.map((column) => {
            const value = column.value(row);
            return value == null || value === '' ? null : { value };
          })
        ),
      ],
      columns: columns.map((column) => ({
        width: Math.min(40, Math.max(10, column.header.length + 4)),
      })),
      stickyRowsCount: 1,
    };
  });
  const blob = await writeXlsxFile(workbook as never).toBlob();
  save(blob, `${fileName}.xlsx`);
}

/** The tables as a PDF (src/reports/TablePdf.tsx): one titled table per sheet. */
export async function downloadPdf(fileName: string, title: string, sheets: ExportSheet<any>[]) {
  const { tablePdf } = await import('@/reports/TablePdf');
  save(await tablePdf(title, sheets), `${fileName}.pdf`);
}
