// Which school the sync scripts work for: tech (SST, Vertex: B.Tech, BCA, MCA...) or management
// (SSM, Converge: BBA, MBA). Set SCHOOL=SSM, with DATABASE_URL pointing at the Converge
// database, to sync Converge; the default is Vertex. Each has its own database, so the same
// tables and scripts serve both without mixing their students.

export type School = 'SST' | 'SSM';

export const SCHOOL: School = process.env.SCHOOL?.trim().toUpperCase() === 'SSM' ? 'SSM' : 'SST';

/** Short program names as shown, from the LMS's. */
export const PROGRAM_NAMES: Record<string, string> = {
  BTECH: 'B.Tech',
  BE: 'BE',
  BCA: 'BCA',
  MCA: 'MCA',
  BBA: 'BBA',
  MBA: 'MBA',
  PGDM: 'PGDM',
};

/**
 * The PRIME subjects (LMS courses, by their hand-typed names; `c` is the course table) whose
 * tests are synced. Tech: PRIME Domain Coding. Management: the PRIME domains (Revenue
 * Generation, Finance, HR, IT, Operations), PRIME Communication & Aptitude (ELQ) and the ELQ Test.
 */
export const PRIME_SUBJECTS =
  SCHOOL === 'SSM'
    ? `(lower(c.course_name) like '%prime domain%'
        or (lower(c.course_name) like '%prime%'
            and (lower(c.course_name) like '%communication%' or lower(c.course_name) like '%aptitude%'))
        or lower(trim(c.course_name)) = 'elq test')`
    : `lower(trim(c.course_name)) in
        ('prime domain coding', 'competitive coding (sunstone prime tech domain)')`;
