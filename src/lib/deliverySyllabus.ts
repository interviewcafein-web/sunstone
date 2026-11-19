// A batch and section's syllabus, topic by topic, from the delivery tracker (the campus page's
// delivery data): which topics are completed (every subtopic has a verified class), in progress,
// only awaiting verification, or not started. Used by the campus page and the PDF report.

import type { CampusDelivery } from '@/lib/assessments';

export type TopicStatus = 'done' | 'progress' | 'pending' | 'not';

type SectionRowData = CampusDelivery['sections'][number];

/** A section's syllabus (the curricula its program and batch follow) with what was taught. */
export function sectionSyllabus(row: SectionRowData, data: CampusDelivery) {
  const taught = (data.sectionTopics ?? []).filter(
    (item) =>
      item.program === row.program &&
      item.batch_year === row.batch_year &&
      (item.section ?? '') === (row.section ?? '')
  );
  const key = (curriculum: string, topic: string) => `${curriculum}|${topic}`;
  const taughtBy = new Map(taught.map((item) => [key(item.curriculum, item.topic), item]));
  const seen = new Set<string>();
  const planned = data.topics.filter((topic) => {
    const id = key(topic.curriculum, topic.topic);
    const follows =
      // Answers saved before program and batch years were added: the curricula taught here.
      topic.program === undefined
        ? taught.some((item) => item.curriculum === topic.curriculum)
        : topic.program === row.program &&
          row.batch_year != null &&
          (topic.batch_years ?? []).includes(row.batch_year);
    if (!follows || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const topics = planned.map((topic) => {
    const done = taughtBy.get(key(topic.curriculum, topic.topic));
    const subtopicsDone = done?.subtopics_taught.length ?? 0;
    const status: TopicStatus = !done
      ? 'not'
      : done.classes === 0
        ? 'pending'
        : topic.subtopics > 0 && subtopicsDone >= topic.subtopics
          ? 'done'
          : 'progress';
    return {
      curriculum: topic.curriculum,
      topic: topic.topic,
      order: topic.topic_order,
      subtopics: topic.subtopics,
      subtopicsDone: Math.min(subtopicsDone, topic.subtopics || subtopicsDone),
      taught: done?.subtopics_taught ?? [],
      hours: done?.hours ?? 0,
      classes: done?.classes ?? 0,
      pending: done?.pending ?? 0,
      lastClass: done?.last_class ?? null,
      status,
    };
  });
  // Topics logged in the tracker that are not in this batch's syllabus.
  const other = taught.filter((item) => !seen.has(key(item.curriculum, item.topic)));
  const latest = [...taught]
    .filter((item) => item.last_class)
    .sort((a, b) => (b.last_class ?? '').localeCompare(a.last_class ?? ''))[0];
  return { topics, other, latest };
}

export type SectionSyllabus = ReturnType<typeof sectionSyllabus>;

/** "4 completed · 3 in progress · 4 not started · latest: Arrays". */
export function syllabusLine(syllabus: SectionSyllabus): string | null {
  const { topics, latest } = syllabus;
  if (!topics.length) return null;
  const count = (status: TopicStatus) => topics.filter((topic) => topic.status === status).length;
  return [
    `${count('done')} of ${topics.length} topics completed`,
    count('progress') && `${count('progress')} in progress`,
    count('pending') && `${count('pending')} awaiting verification`,
    `${count('not')} not started`,
    latest && `latest: ${latest.topic}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
