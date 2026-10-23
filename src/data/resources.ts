// The Resources tab. To add a book or PDF, copy an entry below and change it.
// Cards appear in the order of this list.
//
// link: the Google Drive share link ("Anyone with the link can view"), e.g.
//   https://drive.google.com/file/d/<file id>/view?usp=sharing
// Any direct PDF URL works too. Leave it out and the card shows "Link coming soon".

export type ResourceIcon =
  | 'network'
  | 'oops'
  | 'database'
  | 'os'
  | 'dsa'
  | 'document'
  | 'book'
  | 'web'
  | 'cloud'
  | 'ai'
  | 'aptitude'
  | 'career'
  | 'code';

export type ResourceTheme = 'green' | 'purple' | 'blue' | 'orange' | 'navy' | 'rose';

export interface Resource {
  /** Stable and unique; used in the page address when a preview is open. */
  id: string;
  title: string;
  description: string;
  link?: string;
  tags: string[];
  /** YYYY-MM-DD, shown on the card. */
  date: string;
  icon: ResourceIcon;
  theme: ResourceTheme;
  /** Short label on the coloured header, e.g. "Java". */
  badge?: string;
  /** Shows a gold "Premium" ribbon. */
  premium?: boolean;
}

export const RESOURCES: Resource[] = [
  {
    id: 'data-structures-and-algorithms',
    title: 'Sunstone PRIME - Data Structures and Algorithms',
    description:
      'The ultimate guide to Data Structures and Algorithms, from arrays to graphs and dynamic programming, with patterns and practice problems for coding rounds.',
    link: 'https://drive.google.com/file/d/1x72oxbFoFvuPh-sYZUdDfPVmm2RTfzTv/view?usp=sharing',
    tags: ['DSA', 'Interview Prep'],
    date: '2026-03-05',
    icon: 'dsa',
    theme: 'blue',
    premium: true,
  },
  {
    id: 'java',
    title: 'Sunstone PRIME - Java',
    description:
      'Your complete guide to cracking Java interviews: core Java, collections, multithreading, JVM internals and the questions top companies ask.',
    link: 'https://drive.google.com/file/d/1jfa8wdAz8xhBhUGdXQV6b3py5usmYsa_/view?usp=sharing',
    tags: ['Java', 'Interview Prep'],
    date: '2026-03-05',
    icon: 'document',
    theme: 'purple',
    badge: 'Java',
    premium: true,
  },
  {
    id: 'operating-systems',
    title: 'Sunstone PRIME - Operating Systems',
    description:
      'Operating Systems power every computer, from your smartphone to cloud servers. Processes, threads, scheduling, memory management, deadlocks and file systems explained simply.',
    link: 'https://drive.google.com/file/d/1ND7Y7P6BscPv2utPsPb9t8rjd4MQyFnu/view?usp=sharing',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'os',
    theme: 'green',
  },
  {
    id: 'dbms',
    title: 'Sunstone PRIME - DBMS',
    description:
      'Databases are the backbone of every modern application. Normalisation, transactions, indexing, SQL queries and the DBMS concepts that come up in every placement interview.',
    link: 'https://drive.google.com/file/d/1jrcoSy6rYV21uJa2sxQKj3r7Xg6SZ6Xv/view?usp=sharing',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'database',
    theme: 'green',
  },
  {
    id: 'computer-networks',
    title: 'Sunstone PRIME - Computer Networks',
    description:
      'From sending a WhatsApp message to streaming Netflix, everything runs on networks. OSI and TCP/IP models, routing, DNS, HTTP and the networking questions interviewers ask most.',
    link: 'https://drive.google.com/file/d/1Nh3s5xUxoUVOxp8D3VDS5SQ_t-WJdZQg/view?usp=sharing',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'network',
    theme: 'green',
  },
];
