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

/** Daily counts for the `days` days ending `endOffset` days before today, oldest first. */
export function dailySeries(calendar: Record<string, number>, days: number, endOffset = 0) {
  const today = todayUtc().getTime();
  return Array.from({ length: days }, (_, index) => {
    const date = isoDay(new Date(today - (endOffset + days - 1 - index) * DAY_MS));
    return { date, count: calendar[date] || 0 };
  });
}

const total = (series: { count: number }[]) => series.reduce((sum, day) => sum + day.count, 0);

/**
 * Yesterday, the last 7 days and the last 30 days, each with the period just before it
 * for comparison and the daily counts to draw. The 7- and 30-day windows end today.
 */
export function activityWindows(calendar: Record<string, number>) {
  const window = (label: string, days: number, endOffset: number) => {
    const series = dailySeries(calendar, days, endOffset);
    return {
      label,
      value: total(series),
      previous: total(dailySeries(calendar, days, endOffset + days)),
      // Yesterday alone is one bar, so draw the week leading up to it instead.
      series: days === 1 ? dailySeries(calendar, 7, endOffset) : series,
    };
  };
  return [window('Yesterday', 1, 1), window('Last 7 days', 7, 0), window('Last 30 days', 30, 0)];
}
