// Shared by the share functions (stats, og, card, share): look a student up by slug and
// work out the numbers their link preview and coding card show. Mirrors InterviewCafe's
// backend/app/users/services/profile_card.py. The leading underscore keeps Vercel from
// treating this file as an endpoint.

import { mergeCalendars, streaksOf } from '../src/lib/coding-profiles/activity';
import { fetchCodingProfile, setRelayOrigin } from '../src/lib/coding-profiles/adapters';
import { PLATFORMS } from '../src/lib/coding-profiles/platforms';
import type { Student } from '../src/lib/students/types';
import type { CardStats } from './_render';

export * from './_render';

export async function findStudent(origin: string, slug: string): Promise<Student | undefined> {
  // The public one-student endpoint: the full list needs a login (see middleware.ts).
  const response = await fetch(`${origin}/api/student?s=${encodeURIComponent(slug)}`);
  if (!response.ok) return undefined;
  return ((await response.json()) as { student?: Student }).student;
}

export async function cardStats(origin: string, student: Student): Promise<CardStats> {
  setRelayOrigin(origin);
  const linked = PLATFORMS.filter((platform) => student.handles[platform.id]);
  const results = await Promise.allSettled(
    linked.map((platform) => fetchCodingProfile(platform.id, student.handles[platform.id]!))
  );
  const profiles = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );

  let topRating: CardStats['topRating'] = null;
  for (const profile of profiles) {
    const current = profile.rating?.current;
    if (current && (!topRating || current > topRating.value)) {
      topRating = {
        platform: PLATFORMS.find((platform) => platform.id === profile.platform)!.name,
        value: current,
      };
    }
  }

  return {
    slug: student.slug,
    name: student.name,
    campus: student.campus,
    batch: student.batch,
    course: student.course,
    solved: profiles.reduce((sum, profile) => sum + (profile.solved ?? 0), 0),
    contests: profiles.reduce((sum, profile) => sum + (profile.rating?.contests ?? 0), 0),
    activeDays: streaksOf(mergeCalendars(profiles.map((profile) => profile.calendar))).activeDays,
    topRating,
    incomplete: results.some(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { kind?: string } | undefined)?.kind !== 'not_found'
    ),
    ratings: profiles.flatMap((profile) =>
      profile.rating?.current
        ? [
            {
              id: profile.platform,
              name: PLATFORMS.find((platform) => platform.id === profile.platform)!.name,
              value: profile.rating.current,
            },
          ]
        : []
    ),
    platforms: profiles.map((profile) => {
      const platform = PLATFORMS.find((item) => item.id === profile.platform)!;
      const contributions = profile.kpis[0]?.value;
      return {
        id: platform.id,
        name: platform.name,
        color: platform.color,
        value: profile.solved ?? (typeof contributions === 'number' ? contributions : null),
      };
    }),
  };
}
