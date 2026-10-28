// Branding and building blocks shared by the PDF reports. The reports are drawn in the
// browser with @react-pdf/renderer and loaded only when someone downloads one.

import { Font, Image, StyleSheet, Text, View } from '@react-pdf/renderer';

import { BAND_COLORS, type Band, type Dimension } from '@/lib/insights';

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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        <View
          style={{
            width: 0.75,
            height: 30,
            backgroundColor: 'rgba(255,255,255,0.3)',
            marginHorizontal: 14,
          }}
        />
        <Image src={`${origin}/vertex-logo-white.png`} style={{ width: 98, height: 35 }} />
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
      <Text>Sunstone PRIME Vertex · {label}</Text>
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

/** A hex colour at `opacity`, for light tinted backgrounds. */
export function tint(hex: string, opacity: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

/** A front's score with its unit, or a dash when there is no data. */
export const frontValue = (dimension: Dimension, value: number | null | undefined) =>
  value == null ? '—' : `${formatNumber(value)}${dimension.suffix}`;

export const BAND_LABELS: Record<Band, string> = {
  good: 'Doing well',
  ok: 'Average',
  risk: 'At risk',
  none: 'No data',
};

/** The overall score (mean of the fronts) is banded like the 360° page: 70+ well, under 50 at risk. */
export const overallColor = (value: number | null) =>
  value === null
    ? BAND_COLORS.none
    : value >= 70
      ? BAND_COLORS.good
      : value >= 50
        ? BAND_COLORS.ok
        : BAND_COLORS.risk;

/** Green / amber / red swatches with their meaning. */
export function BandLegend() {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(['good', 'ok', 'risk'] as const).map((band) => (
        <View key={band} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 1.5,
              backgroundColor: BAND_COLORS[band],
              marginRight: 3,
            }}
          />
          <Text style={{ fontSize: 7, color: MUTED }}>{BAND_LABELS[band]}</Text>
        </View>
      ))}
    </View>
  );
}

/** A score in a tinted box coloured by its band; a plain dash when there is no data. */
export function BandCell({
  text,
  color,
  width,
  note,
  strong = false,
}: {
  text: string | null;
  color: string;
  width: number;
  note?: string;
  strong?: boolean;
}) {
  return (
    <View style={{ width, paddingHorizontal: 2 }}>
      {text === null ? (
        <Text style={{ textAlign: 'center', color: '#cbd5e1' }}>—</Text>
      ) : (
        <View style={{ backgroundColor: tint(color, 0.12), borderRadius: 3, paddingVertical: 2.5 }}>
          <Text
            style={{
              textAlign: 'center',
              color,
              fontWeight: 700,
              fontSize: strong ? 9.5 : 8.5,
            }}
          >
            {text}
          </Text>
          {note ? (
            <Text style={{ textAlign: 'center', color, fontSize: 5.5, opacity: 0.8 }}>{note}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** File names: no characters that operating systems reject. */
export const safeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
