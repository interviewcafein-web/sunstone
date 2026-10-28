// Unusual-score flags for tests taken in an open (unproctored) browser: a sign that answers may
// have been shared, not proof. Each test is compared with what is normal for its type, measured
// on the LMS data (Oct 2026, tests with 10+ submissions):
//   MCQ          typically 20% of students score full marks (90th percentile 68%)
//   AMCAT mock   typically 37% (90th percentile 73%)
//   coding test / assignment: full marks is the norm (70–76%), as passing every test case is
//   the goal, so only near-universal full marks stands out.
// Used by the campus API (api/assessments.ts) and the weekly report.

export type IntegrityLevel = 'high' | 'medium';

export interface Integrity {
  level: IntegrityLevel;
  /** Plain-language reasons, e.g. "72% scored full marks (usual for MCQs: about 20%)". */
  reasons: string[];
}

export interface ScoreStats {
  category: string;
  submitted: number;
  /** Submissions with full marks. */
  perfect: number;
  /** Average and spread (standard deviation) of the score %, over submissions. */
  avg: number | null;
  spread: number | null;
}

/** Fewer submissions than this say too little to flag. */
export const MIN_SUBMISSIONS = 10;

const KNOWLEDGE: Record<string, { label: string; usual: number }> = {
  mcq: { label: 'MCQs', usual: 20 },
  amcat_mock: { label: 'AMCAT mocks', usual: 37 },
};

export function integrityOf(stats: ScoreStats): Integrity | null {
  if (stats.submitted < MIN_SUBMISSIONS) return null;
  const perfect = Math.round((stats.perfect / stats.submitted) * 100);
  const reasons: string[] = [];
  let level: IntegrityLevel | null = null;
  const raise = (to: IntegrityLevel) => {
    if (level !== 'high') level = to;
  };

  const knowledge = KNOWLEDGE[stats.category];
  if (knowledge) {
    // Well above the usual share: 15+ points to check, 30+ points (and a majority) to flag.
    const check = Math.max(40, knowledge.usual + 15);
    const flag = Math.max(60, knowledge.usual + 30);
    if (perfect >= check) {
      raise(perfect >= flag ? 'high' : 'medium');
      reasons.push(
        `${perfect}% scored full marks (usual for ${knowledge.label}: about ${knowledge.usual}%)`
      );
    }
    if (stats.avg !== null && stats.spread !== null && stats.avg >= 90 && stats.spread <= 8) {
      raise('medium');
      reasons.push(
        `Nearly everyone scored 90%+ (average ${Math.round(stats.avg)}%, almost no spread)`
      );
    }
  } else if (perfect >= 90 && stats.avg !== null && stats.avg >= 95) {
    raise('medium');
    reasons.push(`${perfect}% scored full marks, average ${Math.round(stats.avg)}%`);
  }

  return level ? { level, reasons } : null;
}

export const INTEGRITY_NOTE =
  'Taken in an open browser: unusually high, uniform scores can mean answers were shared. A sign to look into, not proof.';
