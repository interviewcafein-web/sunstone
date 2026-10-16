// Calendar maths shared by the platform panels and the overview. Calendars are keyed by
// ISO day (YYYY-MM-DD, UTC).

const DAY_MS = 86_400_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function mergeCalendars(calendars: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const calendar of calendars) {
    for (const [day, count] of Object.entries(calendar)) {
      if (count > 0) merged[day] = (merged[day] || 0) + count;
    }
  }
  return merged;
}

/**
 * Active days, best streak and current streak. The current streak may end yesterday:
 * a student who has not solved anything yet today has not broken it.
 */
export function streaksOf(calendar: Record<string, number>) {
  const days = Object.keys(calendar)
    .filter((day) => calendar[day] > 0)
    .sort();

  let best = 0;
  let run = 0;
  let previous = 0;
  for (const day of days) {
    const time = Date.parse(day);
    run = previous && time - previous === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    previous = time;
  }

  const today = todayUtc().getTime();
  const last = days.length ? Date.parse(days[days.length - 1]) : 0;
  const current = last && today - last <= DAY_MS ? run : 0;

  return { activeDays: days.length, best, current };
}

/** Submissions yesterday and in the last 7 and 30 days (each window ends today). */
export function activityWindows(calendar: Record<string, number>) {
  const today = todayUtc();
  const sumSince = (daysBack: number) => {
    let total = 0;
    for (let offset = 0; offset < daysBack; offset++) {
      total += calendar[isoDay(new Date(today.getTime() - offset * DAY_MS))] || 0;
    }
    return total;
  };
  return {
    yesterday: calendar[isoDay(new Date(today.getTime() - DAY_MS))] || 0,
    week: sumSince(7),
    month: sumSince(30),
  };
}
