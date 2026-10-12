// Cleans up the free-text Campus and Year of Passing answers from the form, so one campus
// or batch does not show up as several filter options. The leading underscore keeps Vercel
// from treating this file as an endpoint.

export const UNKNOWN_BATCH = 'Not specified';
export const UNKNOWN_CAMPUS = 'Not specified';

/**
 * Reduces a "year of passing" answer to one four-digit year.
 * "2026-30", "2026 - 2030" and "30" all become "2030". Answers that are not a passing year
 * ("2nd", "First year") or are out of range ("2039") become UNKNOWN_BATCH.
 */
export function normalizeBatch(raw: string, currentYear = new Date().getFullYear()): string {
  const tokens = raw.match(/\d+/g);
  if (!tokens) return UNKNOWN_BATCH;

  const years = tokens.map((token) => {
    if (token.length === 4) return Number(token);
    if (token.length === 2) return 2000 + Number(token);
    return NaN;
  });
  const plausible = (year: number) => year >= currentYear - 3 && year <= currentYear + 6;
  // One unreadable number ("2026-20230") makes the whole answer unreliable.
  if (!years.every(plausible)) return UNKNOWN_BATCH;

  // A range is "joining-passing"; the passing year is the later one.
  return String(Math.max(...years));
}

const SMALL_WORDS = /\b(Of|And|The|For)\b/g;

function campusKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
    .replace(/banglore|bengaluru|bangaluru|bengalore/g, 'bangalore');
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

const MAX_TYPOS = 2;
// Below this a key is too short to match safely ("sage" would match anything).
const MIN_KEY_LENGTH = 12;

/** True when `key` looks like `target` with typos and/or with the city left off. */
function sameCampus(key: string, target: string): boolean {
  if (editDistance(key, target) <= MAX_TYPOS) return true;
  return (
    key.length >= MIN_KEY_LENGTH &&
    target.length > key.length &&
    editDistance(key, target.slice(0, key.length)) <= MAX_TYPOS
  );
}

/**
 * Groups spellings of the same campus and returns a lookup from each raw answer to one
 * display name. Nothing is hard-coded: rarer spellings are folded into the commonest campus
 * they resemble, and left alone when they resemble more than one.
 */
export function canonicalCampuses(answers: string[]): (raw: string) => string {
  const spellings = new Map<string, Map<string, number>>();
  for (const raw of answers) {
    if (!raw) continue;
    const key = campusKey(raw);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
    spellings.set(key, counts);
  }

  const size = (key: string) => [...spellings.get(key)!.values()].reduce((a, b) => a + b, 0);
  const keys = [...spellings.keys()].sort((a, b) => size(b) - size(a) || a.localeCompare(b));

  // Commonest first, so each key can only fold into a more common one (no cycles).
  const root = new Map<string, string>();
  keys.forEach((key, index) => {
    const matches = new Set(
      keys
        .slice(0, index)
        .filter((target) => sameCampus(key, target))
        .map((target) => root.get(target)!)
    );
    root.set(key, matches.size === 1 ? [...matches][0] : key);
  });

  // Display name: prefer the form's own "Name, City" style, then the commonest spelling.
  const label = new Map<string, string>();
  for (const key of new Set(root.values())) {
    const ranked = [...spellings.get(key)!.entries()].sort(
      ([a, countA], [b, countB]) =>
        Number(b.includes(', ')) - Number(a.includes(', ')) ||
        countB - countA ||
        (a.match(SMALL_WORDS)?.length ?? 0) - (b.match(SMALL_WORDS)?.length ?? 0) ||
        a.localeCompare(b)
    );
    label.set(key, ranked[0][0]);
  }

  return (raw) => (raw ? label.get(root.get(campusKey(raw))!)! : UNKNOWN_CAMPUS);
}
