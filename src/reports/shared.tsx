// Branding and building blocks shared by the PDF reports. The reports are drawn in the
// browser with @react-pdf/renderer and loaded only when someone downloads one.

import { Font, Image, StyleSheet, Text, View } from '@react-pdf/renderer';

export const NAVY = '#1a3e70';
export const NAVY_DARK = '#102646';
export const GOLD = '#f59e0b';
export const INK = '#0f172a';
export const MUTED = '#64748b';
export const LINE = '#e2e8f0';
export const SOFT = '#f8fafc';

let registered = false;

/** Inter from the site's own /fonts, so the PDFs match the website. */
export function registerFonts(origin: string) {
  if (registered) return;
  Font.register({
    family: 'Inter',
    fonts: [400, 600, 700, 800].map((weight) => ({
      src: `${origin}/fonts/inter-${weight}.woff`,
      fontWeight: weight,
    })),
  });
  // Never split words with hyphens: names and campus names read badly broken.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export const base = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: INK, paddingBottom: 40 },
  muted: { color: MUTED },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
});

export const formatNumber = (value: number) => value.toLocaleString('en-IN');

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (date: Date) =>
  date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Navy band across the top of the first page: logo, PRIME, report name and date. */
export function ReportHeader({
  origin,
  kind,
  generatedAt,
}: {
  origin: string;
  kind: string;
  generatedAt: Date;
}) {
  return (
    <View
      style={{
        backgroundColor: NAVY,
        paddingVertical: 18,
        paddingHorizontal: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View>
        <Image src={`${origin}/sunstone-logo-white.png`} style={{ width: 150, height: 19.5 }} />
        <Text
          style={{
            color: GOLD,
            fontSize: 7.5,
            fontWeight: 800,
            letterSpacing: 4,
            marginTop: 5,
            marginLeft: 33,
          }}
        >
          PRIME
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{kind}</Text>
        <Text style={{ color: '#b5cae6', fontSize: 8.5, marginTop: 3 }}>
          Generated {formatDateTime(generatedAt)}
        </Text>
      </View>
    </View>
  );
}

/** Repeated on every page: what the report is, and page x of y. */
export function ReportFooter({ label }: { label: string }) {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        bottom: 16,
        left: 32,
        right: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 0.5,
        borderTopColor: LINE,
        paddingTop: 6,
        fontSize: 7.5,
        color: MUTED,
      }}
    >
      <Text>Sunstone PRIME Vantage · {label}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

/** A labelled number in a bordered tile with a coloured top edge. */
export function StatTile({
  label,
  value,
  hint,
  color = NAVY,
  width,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  width: number | string;
}) {
  return (
    <View
      style={{
        width,
        borderWidth: 0.75,
        borderColor: LINE,
        borderTopWidth: 2.5,
        borderTopColor: color,
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'white',
      }}
    >
      <Text style={{ fontSize: 7, fontWeight: 600, color: MUTED, letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: 700, marginTop: 3 }}>{value}</Text>
      {hint ? <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

/** A thin horizontal bar, `share` of the way full. */
export function Bar({
  share,
  color,
  width,
  height = 4,
}: {
  share: number;
  color: string;
  width: number;
  height?: number;
}) {
  return (
    <View style={{ width, height, backgroundColor: '#eef2f6', borderRadius: height }}>
      <View
        style={{
          width: Math.max(0, Math.min(1, share)) * width,
          height,
          backgroundColor: color,
          borderRadius: height,
        }}
      />
    </View>
  );
}

/** File names: no characters that operating systems reject. */
export const safeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
