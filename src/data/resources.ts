// The Resources tab. To add a book or PDF, copy an entry below and change it.
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
  /** YYYY-MM-DD, shown on the card and used for "newest first". */
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
    id: 'computer-networks',
    title: 'The Art of Computer Networks',
    description:
      'From sending a WhatsApp message to streaming Netflix, everything runs on networks. OSI and TCP/IP models, routing, DNS, HTTP and the networking questions interviewers ask most.',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'network',
    theme: 'green',
  },
  {
    id: 'oops-concepts',
    title: 'The Art of OOPs Concepts',
    description:
      'OOPs is the DNA of modern programming – the foundation of every large codebase. Classes, objects, inheritance, polymorphism, abstraction and encapsulation with interview-style examples.',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'oops',
    theme: 'purple',
  },
  {
    id: 'dbms',
    title: 'The Art of DBMS',
    description:
      'Databases are the backbone of every modern application. Normalisation, transactions, indexing, SQL queries and the DBMS concepts that come up in every placement interview.',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'database',
    theme: 'green',
  },
  {
    id: 'operating-systems',
    title: 'The Art of Operating Systems',
    description:
      'Operating Systems power every computer, from your smartphone to cloud servers. Processes, threads, scheduling, memory management, deadlocks and file systems explained simply.',
    tags: ['Interview Prep'],
    date: '2026-03-05',
    icon: 'os',
    theme: 'green',
  },
  {
    id: 'data-structures-and-algorithms',
    title: 'The Art of Data Structures and Algorithms',
    description:
      'The Art of Data Structures and Algorithms – the ultimate guide from arrays to graphs and dynamic programming, with patterns and practice problems for coding rounds.',
    tags: ['DSA', 'Interview Prep'],
    date: '2026-03-05',
    icon: 'dsa',
    theme: 'blue',
  },
  {
    id: 'cracking-java-interviews',
    title: 'The Art of Cracking Java Interviews',
    description:
      'This book is your complete guide to cracking Java interviews: core Java, collections, multithreading, JVM internals and the questions top companies ask.',
    tags: ['Java', 'Interview Prep'],
    date: '2026-03-05',
    icon: 'document',
    theme: 'purple',
    badge: 'Java',
    premium: true,
  },
];
