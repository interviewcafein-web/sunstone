// Guided tours (driver.js): shown once per person the first time they open a page, and
// replayable from the account menu. Targets are marked with data-tour="…" in the markup.

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export type TourId = 'students' | 'campus' | 'student';

interface Step {
  /** data-tour value of the element to point at; omitted for a centred message. */
  target?: string;
  title: string;
  text: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const TOURS: Record<TourId, Step[]> = {
  students: [
    {
      title: 'Welcome to Sunstone PRIME Vertex 👋',
      text: 'A quick tour of where to find everything. It takes under a minute; you can leave at any time and replay it from your account menu.',
    },
    {
      target: 'nav-students',
      title: 'Students',
      text: 'Every PRIME student you have access to, with coding, attendance, AMCAT and test scores side by side.',
      side: 'bottom',
    },
    {
      target: 'filters',
      title: 'Filter the list',
      text: 'Narrow down by campus, batch and course, or search a student by name.',
      side: 'bottom',
    },
    {
      target: 'zones',
      title: 'Practice zones',
      text: 'Students grouped by how much they practise coding. Click a zone to list only those students, or download the campus report as a PDF.',
      side: 'top',
    },
    {
      target: 'table',
      title: 'One row per student',
      text: 'Coding on LeetCode, GFG and GitHub, then attendance, the latest AMCAT score and PRIME test average, each with its trend. Click a column to sort; click a name to open the full profile.',
      side: 'top',
    },
    {
      target: 'nav-campuses',
      title: 'Campuses',
      text: 'Each campus’s PRIME journey: tests and Learning & Practice, exams, attendance by subject and instructor, AMCAT, and who needs a follow-up.',
      side: 'bottom',
    },
    {
      target: 'theme',
      title: 'Light or dark',
      text: 'Switch the look whenever you like.',
      side: 'bottom',
    },
    {
      target: 'bell',
      title: 'Notifications',
      text: 'Important updates from HQ land here, and by email too when they matter.',
      side: 'bottom',
    },
    {
      target: 'account',
      title: 'Your account',
      text: 'Your profile, the team (for HQ), sign out, and this tour again whenever you need it.',
      side: 'left',
    },
  ],
  campus: [
    {
      target: 'campus-tiles',
      title: 'The campus at a glance',
      text: 'Tests held, participation, average score, attendance and Learning & Practice progress. The faint lines show the last weeks; ▲▼ is the change since last week.',
      side: 'bottom',
    },
    {
      target: 'campus-batches',
      title: 'One batch at a time',
      text: 'Everything on this page follows the batch you pick.',
      side: 'bottom',
    },
    {
      target: 'campus-tabs',
      title: 'The full journey',
      text: 'Overview, Prime Mock Tests (with leaderboards), Practice Test and MCQs, AMCAT, exams, attendance, and Students, where the attendance-vs-score chart shows who to follow up with.',
      side: 'bottom',
    },
  ],
  student: [
    {
      target: 'student-sections',
      title: 'Everything about this student',
      text: 'Coding profiles, Assessments (PRIME tests, internal exams, AMCAT) and Attendance, each in its own section.',
      side: 'bottom',
    },
  ],
};

const storageKey = (id: TourId, user: string) => `vertex:tour:${id}:${user.toLowerCase()}`;

export function hasSeenTour(id: TourId, user: string): boolean {
  try {
    return localStorage.getItem(storageKey(id, user)) === '1';
  } catch {
    return true; // storage blocked: never nag
  }
}

function markSeen(id: TourId, user: string) {
  try {
    localStorage.setItem(storageKey(id, user), '1');
  } catch {
    // Storage blocked: the tour simply shows again next time.
  }
}

export function forgetTours(user: string) {
  for (const id of Object.keys(TOURS) as TourId[]) {
    try {
      localStorage.removeItem(storageKey(id, user));
    } catch {
      // ignore
    }
  }
}

let running = false;

/** Starts a tour now, skipping steps whose target is not on the page. */
export function startTour(id: TourId, user: string) {
  if (running) return;
  const steps: DriveStep[] = TOURS[id]
    .filter((step) => !step.target || document.querySelector(`[data-tour="${step.target}"]`))
    .map((step) => ({
      element: step.target ? `[data-tour="${step.target}"]` : undefined,
      popover: {
        title: step.title,
        description: step.text,
        side: step.side,
        align: 'start',
      },
    }));
  if (!steps.length) return;
  running = true;
  const tour = driver({
    steps,
    showProgress: steps.length > 1,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    popoverClass: 'vertex-tour',
    stagePadding: 6,
    stageRadius: 14,
    smoothScroll: true,
    onDestroyed: () => {
      running = false;
      markSeen(id, user);
    },
  });
  tour.drive();
}

/** Event the account menu sends to replay the main tour on the students page. */
export const REPLAY_EVENT = 'vertex:tour';
