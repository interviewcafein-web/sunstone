// PRIME for management students has three tracks: the PRIME domains ("IT Prime Domain", "HR
// Prime Domain", "Finance Prime Domain", "Revenue Generation Prime Domain", "Operations Prime
// Domain", the BBA career tracks), communication ("Prime Communication", its spelling variants,
// "ELQ Test") and aptitude ("Prime Aptitude", "Prime_Aptitude", "Aptitude (Prime)"…). Kept in
// step with APT_SUBJECT and COMM_SUBJECT in api/assessments.ts, which split the students
// table's averages the same way.

import type { Student } from '@/lib/students/types';

export type Track = 'domain' | 'comm' | 'apt';

export const TRACK_IDS: Track[] = ['domain', 'comm', 'apt'];

const APT = /(^|[^a-z])apt/i;
const COMM = /com+u|elq/i;

/** Which track an LMS subject (course) belongs to. */
export const trackOf = (subject: string | null | undefined): Track =>
  subject && APT.test(subject) ? 'apt' : subject && COMM.test(subject) ? 'comm' : 'domain';

export const TRACKS: Record<Track, { label: string; short: string; note: string }> = {
  domain: {
    label: 'PRIME Domain',
    short: 'PRIME Domain',
    note: 'IT, HR, finance, revenue generation and operations',
  },
  comm: {
    label: 'Communication',
    short: 'Communication',
    note: 'PRIME communication and ELQ',
  },
  apt: {
    label: 'Aptitude',
    short: 'Aptitude',
    note: 'PRIME aptitude',
  },
};

const SUPER_100 = /super[\s-]*100/i;

export const isSuper100Cohort = (cohort: string) => SUPER_100.test(cohort);

export const isSuper100 = (student: Pick<Student, 'cohorts'>) =>
  student.cohorts?.some(isSuper100Cohort) ?? false;

/** "Cohort E - Super-100" → "Cohort E · Super 100". */
export const cohortDisplay = (cohort: string) =>
  cohort.replace(/\s+-\s+/g, ' · ').replace(SUPER_100, 'Super 100');
