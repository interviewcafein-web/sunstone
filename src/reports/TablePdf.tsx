// Any table on the page as a PDF: the same columns and rows as its CSV and Excel downloads, on
// landscape A4 pages with the site's name, the table's title and the date. Loaded only when
// someone asks for a PDF (src/lib/exportTable.ts).

import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

import type { ExportSheet } from '@/lib/exportTable';

import { INK, LINE, MUTED, NAVY, SOFT, formatDateTime, registerFonts } from './shared';

/** Usable width of a landscape A4 page, in points, and the padding of each cell. */
const PAGE_WIDTH = 842 - 48;
const CELL_PADDING = 6;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    color: INK,
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  site: { fontSize: 8, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: 700, color: NAVY, marginTop: 2 },
  meta: { fontSize: 8, color: MUTED, marginTop: 2, marginBottom: 10 },
  sheet: { fontSize: 10.5, fontWeight: 700, marginTop: 10, marginBottom: 5 },
  head: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    color: 'white',
    fontWeight: 600,
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE },
  cell: { paddingVertical: 3, paddingHorizontal: CELL_PADDING / 2 },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: MUTED,
  },
});

type Cell = string | number | null | undefined;

const text = (value: Cell) =>
  value == null || value === ''
    ? '—'
    : typeof value === 'number'
      ? value.toLocaleString('en-IN', { maximumFractionDigits: 1 })
      : String(value);

/**
 * Column sizes (in characters) from the longest text in each column, so names get room and
 * counts do not, and a font size small enough that every column, and each header word, fits.
 */
function layout(headers: string[], rows: string[][]) {
  const chars = headers.map((header, index) =>
    Math.min(
      36,
      Math.max(
        3,
        ...header.split(' ').map((word) => word.length),
        ...rows.slice(0, 300).map((row) => row[index].length)
      )
    )
  );
  const total = chars.reduce((a, b) => a + b, 0);
  // An average character is about 0.55 of the font size wide.
  const fontSize = Math.max(
    4.5,
    Math.min(8.5, (PAGE_WIDTH - headers.length * CELL_PADDING) / (total * 0.55))
  );
  const widths = chars.map((count) => count * fontSize * 0.55 + CELL_PADDING);
  const spare = PAGE_WIDTH - widths.reduce((a, b) => a + b, 0);
  return {
    fontSize,
    widths: widths.map((width, index) => width + (spare > 0 ? (spare * chars[index]) / total : 0)),
  };
}

function SheetTable({ sheet, showName }: { sheet: ExportSheet<any>; showName: boolean }) {
  const headers = sheet.columns.map((column) => column.header);
  const rows = sheet.rows.map((row) => sheet.columns.map((column) => text(column.value(row))));
  const { fontSize, widths: sizes } = layout(headers, rows);
  return (
    <View style={{ fontSize }}>
      {showName && <Text style={styles.sheet}>{sheet.sheet}</Text>}
      <View style={styles.head} fixed>
        {headers.map((header, index) => (
          <Text key={index} style={[styles.cell, { width: sizes[index] }]}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((cells, rowIndex) => (
        <View
          key={rowIndex}
          wrap={false}
          style={[styles.row, rowIndex % 2 ? { backgroundColor: SOFT } : {}]}
        >
          {cells.map((cell, index) => (
            <Text key={index} style={[styles.cell, { width: sizes[index] }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
      {!rows.length && <Text style={[styles.cell, { color: MUTED }]}>No rows.</Text>}
    </View>
  );
}

export async function tablePdf(title: string, sheets: ExportSheet<any>[]) {
  const origin = window.location.origin;
  registerFonts(origin);
  const converge = document.documentElement.classList.contains('converge');
  const site = converge ? 'Converge · Sunstone PRIME' : 'Sunstone PRIME Vertex';
  const now = new Date();
  const shown = sheets.filter((sheet) => sheet.rows.length > 0);
  const list = shown.length ? shown : sheets.slice(0, 1);
  const file = (
    <Document title={title} author={site}>
      {list.map((sheet, index) => (
        <Page key={index} size="A4" orientation="landscape" style={styles.page}>
          {index === 0 && (
            <>
              <Text style={styles.site}>{site}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.meta}>Generated {formatDateTime(now)}</Text>
            </>
          )}
          <SheetTable sheet={sheet} showName={list.length > 1} />
          <View style={styles.footer} fixed>
            <Text>
              {site} · {title}
            </Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
  return pdf(file).toBlob();
}
