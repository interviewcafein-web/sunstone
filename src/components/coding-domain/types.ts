// What the PRIME Coding Domain page (src/pages/CodingDomainPage.tsx) gives each tab.

import type { ReactNode } from 'react';

import type { CodingResponse, CodingSearch, CodingStudent, Cycle } from '@/lib/codingDomain';

export interface TabProps {
  data: CodingResponse;
  /** The students under the page's filters (campus, program, batch, COE track). */
  students: CodingStudent[];
  search: CodingSearch;
  setSearch: (patch: Partial<CodingSearch>) => void;
  /** AMCAT pass mark. */
  pass: number;
  /** AMCAT cycles with sittings among these students, oldest first. */
  cycles: Cycle[];
  /** The chosen cycle (the latest with sittings by default). */
  cycle: Cycle | null;
  /** Words for file names and headings: "SAGE University · B.Tech 2024". */
  scope: string;
  studentLink: (slug: string, children: ReactNode) => ReactNode;
}
