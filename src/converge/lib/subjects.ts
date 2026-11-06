// PRIME for management students has two tracks: the PRIME domains ("IT Prime Domain", "HR
// Prime Domain", "Finance Prime Domain", "Revenue Generation Prime Domain", "Operations Prime
// Domain") and communication and aptitude ("Prime Communication", "Prime Aptitude", their
// spelling variants, and "ELQ Test"), called ELQ. Kept in step with ELQ_SUBJECT in
// api/assessments.ts, which splits the students table's averages the same way.

import type { Student } from '@/lib/students/types';

export type Track = 'domain' | 'elq';

const ELQ = /(^|[^a-z])apt|com+u|elq/i;

/** Which track an LMS subject (course) belongs to. */
export const trackOf = (subject: string | null | undefined): Track =>
  subject && ELQ.test(subject) ? 'elq' : 'domain';

export const TRACKS: Record<Track, { label: string; short: string; note: string }> = {
  domain: {
    label: 'PRIME Domain',
    short: 'PRIME Domain',
    note: 'IT, HR, finance, revenue generation and operations',
  },
  elq: {
    label: 'Communication & Aptitude',
    short: 'Comm. & Aptitude',
    note: 'PRIME communication, aptitude and ELQ',
  },
};

const SUPER_100 = /super[\s-]*100/i;

export const isSuper100Cohort = (cohort: string) => SUPER_100.test(cohort);

export const isSuper100 = (student: Pick<Student, 'cohorts'>) =>
  student.cohorts?.some(isSuper100Cohort) ?? false;

/** "Cohort E - Super-100" → "Cohort E · Super 100". */
export const cohortDisplay = (cohort: string) =>
  cohort.replace(/\s+-\s+/g, ' · ').replace(SUPER_100, 'Super 100');
