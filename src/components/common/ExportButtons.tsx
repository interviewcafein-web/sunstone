// CSV and Excel buttons for a table on the page (src/lib/exportTable.ts). The file holds the
// rows given, which are the rows on screen with the page's filters applied, not just the ones
// shown before "Show more".

import { Download, FileSpreadsheet } from 'lucide-react';

import { downloadCsv, downloadXlsx, type ExportColumn, type ExportSheet } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

const button =
  'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-brand-700 disabled:opacity-50';

export function ExportButtons<T>({
  name,
  sheet,
  columns,
  rows,
  more = [],
  className,
}: {
  /** The file name, without the extension. */
  name: string;
  /** The Excel sheet's name. */
  sheet: string;
  columns: ExportColumn<T>[];
  rows: T[];
  /** Further sheets for the Excel file (the CSV holds the first table only). */
  more?: ExportSheet<any>[];
  className?: string;
}) {
  const empty = rows.length === 0 && more.every((extra) => extra.rows.length === 0);
  return (
    <span className={cn('flex shrink-0 gap-1.5', className)}>
      <button
        type="button"
        className={button}
        disabled={empty}
        title={`Download as CSV (${rows.length} rows)`}
        onClick={() => downloadCsv(name, columns, rows)}
      >
        <Download className="size-3.5" aria-hidden />
        CSV
      </button>
      <button
        type="button"
        className={button}
        disabled={empty}
        title="Download as Excel"
        onClick={() => downloadXlsx(name, [{ sheet, columns, rows }, ...more])}
      >
        <FileSpreadsheet className="size-3.5" aria-hidden />
        Excel
      </button>
    </span>
  );
}

/** One "Download All" Excel button for a whole page: one sheet per table. */
export function DownloadAll({
  name,
  sheets,
  className,
  label = 'Download All',
}: {
  name: string;
  sheets: () => ExportSheet<any>[];
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => downloadXlsx(name, sheets())}
      className={cn(
        'text-brand-800 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow',
        className
      )}
    >
      <FileSpreadsheet className="size-4" aria-hidden />
      {label}
    </button>
  );
}
