// Cohorts: a program and its admission year, named the way the campuses do, e.g. BCA25-28
// (BCA admitted in 2025, finishing in 2028). Course lengths in years by program.

const LENGTH: Record<string, number> = { MCA: 2, BCA: 3, 'B.Tech': 4, BE: 4, Diploma: 3 };

/** "B.Tech", 2025 → "BTECH25-29". */
export function cohortLabel(
  program: string | null | undefined,
  year: number | string | null | undefined
) {
  const start = Number(year);
  if (!program || !Number.isFinite(start) || !start)
    return [program, year].filter(Boolean).join(' ');
  const code = program.replace(/[^a-z]/gi, '').toUpperCase();
  const length = LENGTH[program];
  const yy = (value: number) => String(value % 100).padStart(2, '0');
  return length ? `${code}${yy(start)}-${yy(start + length)}` : `${code}${yy(start)}`;
}

/** "B.Tech", 2025 → "2025–29": the years alone, where the program is already shown. */
export function cohortYears(
  program: string | null | undefined,
  year: number | string | null | undefined
) {
  const start = Number(year);
  const length = program ? LENGTH[program] : undefined;
  if (!Number.isFinite(start) || !start) return String(year ?? '');
  return length ? `${start}–${String((start + length) % 100).padStart(2, '0')}` : String(start);
}

/**
 * A batch filter value: "2025" (everyone admitted that year), "B.Tech:" (the whole program) or
 * "B.Tech:2025" (a cohort).
 */
export function parseBatch(batch: string | undefined): { year?: string; program?: string } {
  if (!batch) return {};
  const [program, year] = batch.includes(':') ? batch.split(':') : [undefined, batch];
  return { year: year || undefined, program };
}

/** How a batch filter value reads on screen. */
export const batchLabel = (batch: string) => {
  const { year, program } = parseBatch(batch);
  if (program && !year) return `All ${program}`;
  return program ? cohortLabel(program, year) : `Batch ${year}`;
};
