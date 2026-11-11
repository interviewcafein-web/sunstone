// Placements (job offers and internships from the LMS): labels shared by the API and the pages.

/** LMS joining statuses. */
export const JOINING: Record<number, string> = {
  1: 'Joined, working',
  2: 'Joined, then left',
  3: 'Joining awaited',
  4: 'Not joining: another offer',
  5: 'Refused the offer',
  6: 'Documents not shared',
  7: 'Terminated by the company',
  8: 'Offer denied by the company',
  9: 'Denied: JD or CTC mismatch',
  10: 'Denied: work mismatch',
};

/** "6.5 LPA" for a full-time CTC in lakhs a year; "₹25,000/mo" for a monthly stipend. */
export function formatPay(value: number | null | undefined, fullTime: boolean): string {
  if (value == null) return '—';
  return fullTime
    ? `${Number(value.toFixed(2))} LPA`
    : `₹${Math.round(value).toLocaleString('en-IN')}/mo`;
}

export type PlacementKind = 'full-time' | 'internship';

export interface PlacementMeasure {
  key: string;
  label: string;
  unit: '%' | '';
  readiness: boolean;
}

interface GroupStats {
  students: number;
  placed: number;
  rate: number | null;
  medianPay: number | null;
  highestPay: number | null;
}

export interface PlacementStudent {
  slug: string;
  name: string;
  campus: string;
  program: string;
  year: number | null;
  super100: boolean;
  readiness: number | null;
  measures: Record<string, number | null>;
}

export interface PlacementOffer extends PlacementStudent {
  company: string | null;
  designation: string | null;
  category: string | null;
  /** Hidden (null) for campus staff. */
  pay: number | null;
  months: number | null;
  selectedOn: string | null;
  joining: string | null;
  crc: string | null;
}

export interface FitMatrix {
  columns: string[];
  rows: {
    domain: string;
    offers: number;
    matched: number;
    rate: number | null;
    cells: Record<string, number>;
  }[];
}

export interface RoleGroup {
  group: string;
  offers: number;
  students: number;
  medianPay: number | null;
  measures: Record<string, number | null>;
}

/** GET /api/placements (api/_placements.ts). */
export interface PlacementsResponse {
  kind: PlacementKind;
  measures: PlacementMeasure[];
  campuses: { id: number; name: string }[];
  totals: {
    students: number;
    placed: number;
    offers: number;
    rate: number | null;
    medianPay: number | null;
    averagePay: number | null;
    highestPay: number | null;
    companies: number;
    joined: number;
    awaiting: number;
    dropped: number;
  };
  batches: (GroupStats & { program: string; year: number | null })[];
  byCampus: (GroupStats & { id: number | null; name: string })[];
  roles: {
    category: string;
    offers: number;
    medianPay: number | null;
    measures: Record<string, number | null>;
  }[];
  companies: { company: string; offers: number; medianPay: number | null }[];
  months: { month: string; offers: number }[];
  joining: { key: string; label: string; offers: number }[];
  cohorts: (GroupStats & { cohort: string })[];
  /** Converge: domain studied against the job taken. Vertex: tech roles against the rest. */
  fit: FitMatrix | RoleGroup[] | null;
  prep: {
    key: string;
    placedAvg: number | null;
    othersAvg: number | null;
    placedCount: number;
    othersCount: number;
    bands: {
      label: string;
      from: number;
      to: number;
      students: number;
      placed: number;
      rate: number | null;
      medianPay: number | null;
    }[];
  }[];
  ready: PlacementStudent[];
  needHelp: PlacementStudent[];
  offers: PlacementOffer[];
  showPay: boolean;
  syncedAt: string | null;
}

/** A student's offers on their profile (api/assessments.ts, view=student). */
export interface StudentPlacement {
  company: string | null;
  designation: string | null;
  category: string | null;
  full_time: boolean;
  role_type: string | null;
  total_lpa: number | null;
  stipend: number | null;
  months: number | null;
  selected_on: string | null;
  joining: string | null;
  withdrawn: boolean;
}

/** The job a PRIME domain prepares for, as the fit table's column headings. */
export const ROLE_LABELS: Record<string, string> = {
  'Revenue Generation': 'Sales & Marketing',
  Finance: 'Finance',
  HR: 'HR',
  IT: 'IT',
  Operations: 'Operations',
  'General roles': 'General Roles',
};

/** The Placements page's address: /placements?kind=internship&campus=12. */
export interface PlacementsSearch {
  kind?: PlacementKind;
  campus?: number;
}

export const validatePlacementsSearch = (search: Record<string, unknown>): PlacementsSearch => {
  const campus = Number(search.campus);
  return {
    kind: search.kind === 'internship' ? 'internship' : undefined,
    campus: Number.isInteger(campus) && campus > 0 ? campus : undefined,
  };
};
