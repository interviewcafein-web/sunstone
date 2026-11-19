// Syllabus & Class Delivery: target hours against verified, pending and rejected classes from
// the delivery tracker (a read-only copy, scripts/sync-delivery.ts), section by section, topic by
// topic and trainer by trainer.

import { useMemo, useState, type ReactNode } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  UserRound,
  XCircle,
} from 'lucide-react';

import { ExportButtons } from '@/components/common/ExportButtons';
import { cohortLabel } from '@/lib/cohorts';
import {
  pct,
  type DeliverySection,
  type DeliveryTopicRow,
  type SyllabusTopic,
} from '@/lib/codingDomain';
import type { ExportColumn } from '@/lib/exportTable';
import { cn } from '@/lib/utils';

import type { TabProps } from './types';

const panel = 'shadow-card bg-surface rounded-2xl border border-slate-200';
const td = 'px-2 py-2 text-right tabular-nums';
const GREEN = '#16a34a';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const hours = (value: number) => Number(value.toFixed(1)).toLocaleString('en-IN');
const sectionKey = (row: {
  campus_code: string;
  program: string;
  batch_year: number;
  section: string | null;
}) => `${row.campus_code}|${row.program}|${row.batch_year}|${row.section ?? ''}`;
const day = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : '—';

function Title({
  icon: Icon,
  title,
  description,
  aside,
}: {
  icon: typeof Layers;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="text-brand-700 dark:text-brand-300 size-4.5" aria-hidden />
          {title}
        </h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

function Rate({ value }: { value: number | null }) {
  const color = value == null ? '#cbd5e1' : value >= 70 ? GREEN : value >= 40 ? AMBER : RED;
  return (
    <span className="inline-flex min-w-20 items-center justify-end gap-2">
      <span className="font-semibold tabular-nums">{value == null ? '—' : `${value}%`}</span>
      <span className="block h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: color }}
        />
      </span>
    </span>
  );
}

export default function DeliveryTab({ data, search, setSearch, scope }: TabProps) {
  const { delivery } = data;
  const nameOf = useMemo(
    () => new Map(data.campuses.map((campus) => [campus.code ?? '', campus.name])),
    [data.campuses]
  );
  const allCampuses = !search.campus;
  const campusName = (code: string) => nameOf.get(code) ?? code;

  const inScope = (row: { program: string; batch_year: number }) =>
    (!search.program || row.program === search.program) &&
    (!search.batch || row.batch_year === search.batch);
  const beforeSection = delivery.sections.filter(inScope);
  const sectionOptions = [
    ...new Set(beforeSection.map((row) => row.section).filter(Boolean) as string[]),
  ].sort();
  const section =
    search.section && sectionOptions.includes(search.section) ? search.section : undefined;
  const sections = beforeSection.filter((row) => !section || row.section === section);
  const keys = new Set(sections.map(sectionKey));
  const taught = delivery.taught.filter((row) => keys.has(sectionKey(row)));
  const trainerRows = delivery.trainers.filter((row) => keys.has(sectionKey(row)));
  const updated = delivery.syncedAt
    ? new Date(delivery.syncedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  const sectionSelect = sectionOptions.length > 0 && (
    <select
      aria-label="Section"
      value={section ?? ''}
      onChange={(event) => setSearch({ section: event.target.value || undefined })}
      className="bg-surface rounded-full border border-slate-300 px-3 py-1.5 text-sm"
    >
      <option value="">All Sections</option>
      {sectionOptions.map((option) => (
        <option key={option} value={option}>
          Section {option}
        </option>
      ))}
    </select>
  );

  if (!sections.length) {
    return (
      <>
        {sectionSelect && <div>{sectionSelect}</div>}
        <div className={cn(panel, 'border-dashed p-8 text-center')}>
          <p className="font-semibold text-slate-700">No Classes in the Delivery Tracker Here</p>
          <p className="mt-1 text-sm text-slate-500">
            Sections show once the tracker has targets or classes for this campus and batch.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          From the delivery tracker{updated ? `, updated ${updated}` : ''}. Verified classes of 1
          minute to 10 hours count as taught; repeat entries are left out.
        </p>
        {sectionSelect}
      </div>
      <Summary sections={sections} />
      <SectionsTable
        sections={sections}
        allCampuses={allCampuses}
        campusName={campusName}
        scope={scope}
      />
      <Topics
        sections={sections}
        topics={delivery.topics}
        taught={taught}
        allCampuses={allCampuses}
        campusName={campusName}
        scope={scope}
      />
      <Trainers rows={trainerRows} campusName={campusName} scope={scope} />
    </>
  );
}

// --- Summary --------------------------------------------------------------------------------

function Summary({ sections }: { sections: DeliverySection[] }) {
  const sum = (pick: (row: DeliverySection) => number) =>
    sections.reduce((total, row) => total + pick(row), 0);
  const planned = sum((row) => row.planned);
  const verified = sum((row) => row.verified);
  const pending = sum((row) => row.pending);
  const rejected = sum((row) => row.rejected);
  const verifiedHours = sum((row) => row.verified_hours);
  const pendingHours = sum((row) => row.pending_hours);
  const rejectedHours = sum((row) => row.rejected_hours);
  const targetClasses = sections.every((row) => !row.planned || row.class_minutes)
    ? Math.round(
        sections.reduce(
          (total, row) =>
            total + (row.planned && row.class_minutes ? (row.planned * 60) / row.class_minutes : 0),
          0
        )
      )
    : null;
  const logged = verified + pending + rejected;
  const share = (part: number) => pct(part, logged) ?? 0;
  const cards = [
    {
      icon: CalendarClock,
      label: 'Target Hours',
      value: `${planned.toLocaleString('en-IN')} h`,
      note: targetClasses ? `≈ ${targetClasses} target classes` : `${sections.length} sections`,
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      icon: CheckCircle2,
      label: 'Verified',
      value: `${hours(verifiedHours)} h`,
      note: `${verified} classes · ${pct(verifiedHours, planned) ?? 0}% of target`,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      icon: Clock,
      label: 'Pending Verification',
      value: `${pending} classes`,
      note: `${hours(pendingHours)} h`,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      icon: XCircle,
      label: 'Rejected',
      value: `${rejected} classes`,
      note: `${hours(rejectedHours)} h`,
      tone: 'bg-rose-50 text-rose-700',
    },
  ];
  const v = share(verified);
  const p = share(pending);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, note, tone }) => (
          <div key={label} className={cn(panel, 'p-4')}>
            <span className={cn('inline-flex rounded-lg p-1.5', tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-2 text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-slate-500">{note}</p>
          </div>
        ))}
      </div>
      <div className={cn(panel, 'flex items-center gap-4 p-4')}>
        <div
          className="relative size-28 shrink-0 rounded-full"
          style={{
            background: logged
              ? `conic-gradient(${GREEN} 0 ${v}%, ${AMBER} ${v}% ${v + p}%, ${RED} ${v + p}% 100%)`
              : '#e2e8f0',
          }}
          role="img"
          aria-label={`Classes logged: ${v}% verified, ${p}% pending, ${share(rejected)}% rejected`}
        >
          <span className="bg-surface absolute inset-4 flex flex-col items-center justify-center rounded-full">
            <span className="text-lg font-bold tabular-nums">{logged}</span>
            <span className="text-[10px] text-slate-500">classes</span>
          </span>
        </div>
        <ul className="space-y-1.5 text-xs">
          {[
            ['Verified', verified, GREEN],
            ['Pending', pending, AMBER],
            ['Rejected', rejected, RED],
          ].map(([label, count, color]) => (
            <li key={label as string} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: color as string }} />
              <span className="w-14">{label}</span>
              <b className="tabular-nums">
                {count as number} ({share(count as number)}%)
              </b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- Sections -------------------------------------------------------------------------------

const verification = (row: { verified: number; pending: number; rejected: number }) =>
  pct(row.verified, row.verified + row.pending + row.rejected);

function SectionsTable({
  sections,
  allCampuses,
  campusName,
  scope,
}: {
  sections: DeliverySection[];
  allCampuses: boolean;
  campusName: (code: string) => string;
  scope: string;
}) {
  const sum = (pick: (row: DeliverySection) => number) =>
    sections.reduce((total, row) => total + pick(row), 0);
  const totals = {
    students: sum((row) => row.students ?? 0),
    planned: sum((row) => row.planned),
    verified_hours: sum((row) => row.verified_hours),
    pending_hours: sum((row) => row.pending_hours),
    verified: sum((row) => row.verified),
    pending: sum((row) => row.pending),
    rejected: sum((row) => row.rejected),
  };
  const columns: ExportColumn<DeliverySection>[] = [
    { header: 'Campus', value: (row) => campusName(row.campus_code) },
    { header: 'Campus code', value: (row) => row.campus_code },
    { header: 'Program', value: (row) => row.program },
    { header: 'Batch', value: (row) => cohortLabel(row.program, row.batch_year) },
    { header: 'Section', value: (row) => row.section },
    { header: 'Students', value: (row) => row.students },
    { header: 'Target hours', value: (row) => row.planned },
    { header: 'Allocated hours', value: (row) => row.allocated },
    {
      header: 'Approx. target classes',
      value: (row) =>
        row.planned && row.class_minutes
          ? Math.round((row.planned * 60) / row.class_minutes)
          : null,
    },
    { header: 'Verified hours', value: (row) => row.verified_hours },
    { header: 'Pending hours', value: (row) => row.pending_hours },
    { header: 'Rejected hours', value: (row) => row.rejected_hours },
    { header: 'Verified classes', value: (row) => row.verified },
    { header: 'Pending classes', value: (row) => row.pending },
    { header: 'Rejected classes', value: (row) => row.rejected },
    {
      header: 'Coverage % (verified / target hours)',
      value: (row) => pct(row.verified_hours, row.planned),
    },
    { header: 'Verification %', value: verification },
    { header: 'Average class minutes', value: (row) => row.class_minutes },
    { header: 'Attendance %', value: (row) => row.attendance },
    { header: 'Trainers', value: (row) => row.trainers },
    { header: 'Last class', value: (row) => row.last_class },
  ];
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={Layers}
        title="Program × Batch × Section"
        description="Target hours against classes verified, waiting for verification and rejected, section by section."
        aside={
          <ExportButtons
            name={`prime-coding-delivery-sections-${scope}`}
            sheet="Sections"
            columns={columns}
            rows={sections}
          />
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-2 font-semibold">Batch and Section</th>
              <th className="px-2 py-2 text-right font-semibold">Students</th>
              <th className="px-2 py-2 text-right font-semibold">Target h</th>
              <th className="px-2 py-2 text-right font-semibold">Verified h</th>
              <th className="px-2 py-2 text-right font-semibold">Pending h</th>
              <th className="px-2 py-2 text-right font-semibold">Rejected</th>
              <th className="px-2 py-2 text-right font-semibold">Coverage</th>
              <th className="px-2 py-2 text-right font-semibold">Verification</th>
              <th className="px-2 py-2 font-semibold">Trainers</th>
              <th className="px-2 py-2 text-right font-semibold">Last Class</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((row) => (
              <tr key={sectionKey(row)} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2">
                  <div className="font-medium">
                    {cohortLabel(row.program, row.batch_year)}
                    {row.section ? ` · ${row.section}` : ''}
                  </div>
                  {allCampuses && (
                    <div className="text-xs text-slate-500">{campusName(row.campus_code)}</div>
                  )}
                </td>
                <td className={td}>{row.students ?? '—'}</td>
                <td className={td}>{row.planned || '—'}</td>
                <td className={cn(td, 'font-semibold')}>{hours(row.verified_hours)}</td>
                <td className={cn(td, row.pending_hours > 0 && 'text-amber-600')}>
                  {hours(row.pending_hours)}
                </td>
                <td className={cn(td, row.rejected > 0 && 'text-rose-600')}>{row.rejected}</td>
                <td className={td}>
                  <Rate value={row.planned ? pct(row.verified_hours, row.planned) : null} />
                </td>
                <td className={td}>
                  <Rate value={verification(row)} />
                </td>
                <td className="max-w-48 px-2 py-2 text-xs text-slate-600">{row.trainers ?? '—'}</td>
                <td className={cn(td, 'text-xs text-slate-600')}>{day(row.last_class)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:bg-slate-800/40">
              <td className="py-2 pr-2">Total ({sections.length} sections)</td>
              <td className={td}>{totals.students || '—'}</td>
              <td className={td}>{totals.planned}</td>
              <td className={td}>{hours(totals.verified_hours)}</td>
              <td className={td}>{hours(totals.pending_hours)}</td>
              <td className={td}>{totals.rejected}</td>
              <td className={td}>
                <Rate value={pct(totals.verified_hours, totals.planned)} />
              </td>
              <td className={td}>
                <Rate value={verification(totals)} />
              </td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// --- Topics ---------------------------------------------------------------------------------

const PER_SECTION_LIMIT = 6;

function Topics({
  sections,
  topics,
  taught,
  allCampuses,
  campusName,
  scope,
}: {
  sections: DeliverySection[];
  topics: SyllabusTopic[];
  taught: DeliveryTopicRow[];
  allCampuses: boolean;
  campusName: (code: string) => string;
  scope: string;
}) {
  // The curricula the sections in view follow.
  const curricula = useMemo(() => {
    const map = new Map<string, { topics: SyllabusTopic[]; sections: DeliverySection[] }>();
    for (const topic of topics) {
      const following = sections.filter(
        (row) => row.program === topic.program && topic.batch_years.includes(row.batch_year)
      );
      if (!following.length) continue;
      const entry = map.get(topic.curriculum) ?? { topics: [], sections: [] };
      if (!entry.topics.some((t) => t.topic === topic.topic)) entry.topics.push(topic);
      for (const row of following) if (!entry.sections.includes(row)) entry.sections.push(row);
      map.set(topic.curriculum, entry);
    }
    for (const entry of map.values()) entry.topics.sort((a, b) => a.topic_order - b.topic_order);
    return map;
  }, [topics, sections]);
  const names = [...curricula.keys()].sort();
  const [picked, setPicked] = useState<string | null>(null);
  const curriculum = picked && curricula.has(picked) ? picked : names[0];
  const entry = curriculum ? curricula.get(curriculum)! : null;

  const taughtBy = useMemo(() => {
    const map = new Map<string, DeliveryTopicRow>();
    for (const row of taught)
      if (row.curriculum === curriculum) map.set(`${sectionKey(row)}|${row.topic}`, row);
    return map;
  }, [taught, curriculum]);

  if (!entry) {
    return (
      <section className={cn(panel, 'p-5')}>
        <Title icon={BookOpenCheck} title="Topic-wise Syllabus Coverage" />
        <p className="text-sm text-slate-500">No syllabus in the tracker for these batches.</p>
      </section>
    );
  }

  const cols = entry.sections;
  const label = (row: DeliverySection) =>
    [
      allCampuses ? row.campus_code : null,
      cols.some((other) => other.batch_year !== row.batch_year || other.program !== row.program)
        ? cohortLabel(row.program, row.batch_year)
        : null,
      row.section ? `Section ${row.section}` : 'No section',
    ]
      .filter(Boolean)
      .join(' · ');
  const cell = (row: DeliverySection, topic: SyllabusTopic) => {
    const found = taughtBy.get(`${sectionKey(row)}|${topic.topic}`);
    return {
      verified: found?.verified ?? 0,
      pending: found?.pending ?? 0,
      rejected: found?.rejected ?? 0,
      hours: found?.hours ?? 0,
      covered: Math.min(found?.subtopics ?? 0, topic.subtopics),
    };
  };
  const coverage = (covered: number, total: number) => pct(covered, total);
  const perSection = cols.length <= PER_SECTION_LIMIT;

  // Long format for the download: one row per topic and section.
  const long = entry.topics.flatMap((topic) =>
    cols.map((row) => ({ topic, row, ...cell(row, topic) }))
  );
  type Long = (typeof long)[number];
  const columns: ExportColumn<Long>[] = [
    { header: 'Curriculum', value: () => curriculum },
    { header: 'Topic order', value: (item) => item.topic.topic_order },
    { header: 'Topic', value: (item) => item.topic.topic },
    { header: 'Subtopics', value: (item) => item.topic.subtopics },
    { header: 'Campus', value: (item) => campusName(item.row.campus_code) },
    { header: 'Program', value: (item) => item.row.program },
    { header: 'Batch', value: (item) => cohortLabel(item.row.program, item.row.batch_year) },
    { header: 'Section', value: (item) => item.row.section },
    { header: 'Verified classes', value: (item) => item.verified },
    { header: 'Pending classes', value: (item) => item.pending },
    { header: 'Rejected classes', value: (item) => item.rejected },
    { header: 'Verified hours', value: (item) => item.hours },
    { header: 'Subtopics covered', value: (item) => item.covered },
    { header: 'Coverage %', value: (item) => coverage(item.covered, item.topic.subtopics) },
  ];

  const totalSubtopics = entry.topics.reduce((sum, topic) => sum + topic.subtopics, 0);
  const sectionTotals = cols.map((row) =>
    entry.topics.reduce(
      (sum, topic) => {
        const c = cell(row, topic);
        return {
          verified: sum.verified + c.verified,
          pending: sum.pending + c.pending,
          rejected: sum.rejected + c.rejected,
          covered: sum.covered + c.covered,
        };
      },
      { verified: 0, pending: 0, rejected: 0, covered: 0 }
    )
  );

  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={BookOpenCheck}
        title="Topic-wise Syllabus Coverage"
        description="Each syllabus topic: classes verified, pending and rejected, and the share of its subtopics covered by verified classes."
        aside={
          <span className="flex flex-wrap items-center gap-2">
            {names.length > 1 && (
              <select
                aria-label="Curriculum"
                value={curriculum}
                onChange={(event) => setPicked(event.target.value)}
                className="bg-surface rounded-full border border-slate-300 px-3 py-1 text-xs"
              >
                {names.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            )}
            <ExportButtons
              name={`prime-coding-syllabus-${curriculum}-${scope}`}
              sheet="Syllabus"
              columns={columns}
              rows={long}
            />
          </span>
        }
      />
      <p className="mb-2 text-xs text-slate-500">
        Curriculum <b>{curriculum}</b> · {entry.topics.length} topics · {cols.length} section
        {cols.length === 1 ? '' : 's'}
        {perSection
          ? ''
          : '. Too many sections to show side by side: averages shown, every section is in the download.'}
      </p>
      <div className="overflow-x-auto">
        {perSection ? (
          <table className="w-full text-sm" style={{ minWidth: `${24 + cols.length * 17}rem` }}>
            <thead>
              <tr className="text-xs text-slate-500">
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 py-2 pr-2 text-left font-semibold"
                >
                  Topic
                </th>
                <th
                  rowSpan={2}
                  className="border-b border-slate-200 px-2 py-2 text-right font-semibold"
                >
                  Subtopics
                </th>
                {cols.map((row) => (
                  <th
                    key={sectionKey(row)}
                    colSpan={4}
                    className="border-l border-slate-200 px-2 pt-2 text-center font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {label(row)}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                {cols.flatMap((row) => [
                  <th
                    key={`${sectionKey(row)}v`}
                    className="border-l border-slate-200 px-1.5 py-1 text-right font-medium"
                  >
                    Verified
                  </th>,
                  <th key={`${sectionKey(row)}p`} className="px-1.5 py-1 text-right font-medium">
                    Pending
                  </th>,
                  <th key={`${sectionKey(row)}r`} className="px-1.5 py-1 text-right font-medium">
                    Rejected
                  </th>,
                  <th key={`${sectionKey(row)}c`} className="px-1.5 py-1 text-right font-medium">
                    Coverage
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {entry.topics.map((topic) => (
                <tr key={topic.topic} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-2">
                    <span className="mr-1.5 text-xs text-slate-400 tabular-nums">
                      {topic.topic_order}
                    </span>
                    {topic.topic}
                  </td>
                  <td className={td}>{topic.subtopics}</td>
                  {cols.flatMap((row) => {
                    const c = cell(row, topic);
                    const share = coverage(c.covered, topic.subtopics);
                    return [
                      <td
                        key={`${sectionKey(row)}v`}
                        className="border-l border-slate-100 bg-emerald-50/50 px-1.5 py-2 text-right tabular-nums dark:bg-emerald-900/10"
                      >
                        {c.verified || '·'}
                      </td>,
                      <td
                        key={`${sectionKey(row)}p`}
                        className="bg-amber-50/50 px-1.5 py-2 text-right tabular-nums dark:bg-amber-900/10"
                      >
                        {c.pending || '·'}
                      </td>,
                      <td
                        key={`${sectionKey(row)}r`}
                        className="bg-rose-50/50 px-1.5 py-2 text-right tabular-nums dark:bg-rose-900/10"
                      >
                        {c.rejected || '·'}
                      </td>,
                      <td
                        key={`${sectionKey(row)}c`}
                        className="px-1.5 py-2 text-right font-semibold tabular-nums"
                      >
                        {share ? `${share}%` : '—'}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:bg-slate-800/40">
                <td className="py-2 pr-2">Total</td>
                <td className={td}>{totalSubtopics}</td>
                {cols.flatMap((row, index) => {
                  const total = sectionTotals[index];
                  return [
                    <td
                      key={`${sectionKey(row)}v`}
                      className="border-l border-slate-200 px-1.5 py-2 text-right tabular-nums"
                    >
                      {total.verified}
                    </td>,
                    <td key={`${sectionKey(row)}p`} className="px-1.5 py-2 text-right tabular-nums">
                      {total.pending}
                    </td>,
                    <td key={`${sectionKey(row)}r`} className="px-1.5 py-2 text-right tabular-nums">
                      {total.rejected}
                    </td>,
                    <td key={`${sectionKey(row)}c`} className="px-1.5 py-2 text-right tabular-nums">
                      {coverage(total.covered, totalSubtopics) ?? 0}%
                    </td>,
                  ];
                })}
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-semibold">Topic</th>
                <th className="px-2 py-2 text-right font-semibold">Subtopics</th>
                <th className="px-2 py-2 text-right font-semibold">Sections Started</th>
                <th className="px-2 py-2 text-right font-semibold">Verified</th>
                <th className="px-2 py-2 text-right font-semibold">Pending</th>
                <th className="px-2 py-2 text-right font-semibold">Rejected</th>
                <th className="px-2 py-2 text-right font-semibold">Avg Coverage</th>
              </tr>
            </thead>
            <tbody>
              {entry.topics.map((topic) => {
                const cells = cols.map((row) => cell(row, topic));
                const started = cells.filter((c) => c.verified > 0).length;
                const avg = Math.round(
                  cells.reduce((sum, c) => sum + (coverage(c.covered, topic.subtopics) ?? 0), 0) /
                    Math.max(cells.length, 1)
                );
                return (
                  <tr key={topic.topic} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-2">
                      <span className="mr-1.5 text-xs text-slate-400 tabular-nums">
                        {topic.topic_order}
                      </span>
                      {topic.topic}
                    </td>
                    <td className={td}>{topic.subtopics}</td>
                    <td className={td}>
                      {started} / {cols.length}
                    </td>
                    <td className={td}>{cells.reduce((sum, c) => sum + c.verified, 0)}</td>
                    <td className={td}>{cells.reduce((sum, c) => sum + c.pending, 0)}</td>
                    <td className={td}>{cells.reduce((sum, c) => sum + c.rejected, 0)}</td>
                    <td className={td}>
                      <Rate value={avg} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:bg-slate-800/40">
                <td className="py-2 pr-2">Total</td>
                <td className={td}>{totalSubtopics}</td>
                <td />
                <td className={td}>{sectionTotals.reduce((sum, t) => sum + t.verified, 0)}</td>
                <td className={td}>{sectionTotals.reduce((sum, t) => sum + t.pending, 0)}</td>
                <td className={td}>{sectionTotals.reduce((sum, t) => sum + t.rejected, 0)}</td>
                <td className={td}>
                  <Rate
                    value={pct(
                      sectionTotals.reduce((sum, t) => sum + t.covered, 0),
                      totalSubtopics * cols.length
                    )}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </section>
  );
}

// --- Trainers -------------------------------------------------------------------------------

function Trainers({
  rows,
  campusName,
  scope,
}: {
  rows: TabProps['data']['delivery']['trainers'];
  campusName: (code: string) => string;
  scope: string;
}) {
  const trainers = useMemo(() => {
    const map = new Map<
      string,
      {
        trainer: string;
        sections: string[];
        verified: number;
        pending: number;
        rejected: number;
        hours: number;
        last: string | null;
      }
    >();
    for (const row of rows) {
      const entry = map.get(row.trainer) ?? {
        trainer: row.trainer,
        sections: [],
        verified: 0,
        pending: 0,
        rejected: 0,
        hours: 0,
        last: null,
      };
      entry.sections.push(
        `${row.campus_code} ${cohortLabel(row.program, row.batch_year)}${row.section ? ` ${row.section}` : ''}`
      );
      entry.verified += row.verified;
      entry.pending += row.pending;
      entry.rejected += row.rejected;
      entry.hours += row.hours;
      if (row.last_logged && (!entry.last || row.last_logged > entry.last))
        entry.last = row.last_logged;
      map.set(row.trainer, entry);
    }
    return [...map.values()].sort((a, b) => b.hours - a.hours);
  }, [rows]);
  type Row = (typeof trainers)[number];
  const columns: ExportColumn<Row>[] = [
    { header: 'Trainer', value: (row) => row.trainer },
    { header: 'Sections taught', value: (row) => row.sections.join('; ') },
    { header: 'Verified classes', value: (row) => row.verified },
    { header: 'Verified hours', value: (row) => Math.round(row.hours * 10) / 10 },
    { header: 'Pending classes', value: (row) => row.pending },
    { header: 'Rejected classes', value: (row) => row.rejected },
    { header: 'Verification %', value: verification },
    { header: 'Last logged', value: (row) => row.last },
  ];
  return (
    <section className={cn(panel, 'p-5')}>
      <Title
        icon={UserRound}
        title="Trainer-wise Delivery"
        description="Classes each trainer logged in the tracker, and how many were verified."
        aside={
          <ExportButtons
            name={`prime-coding-trainers-${scope}`}
            sheet="Trainers"
            columns={columns}
            rows={trainers}
          />
        }
      />
      {!trainers.length ? (
        <p className="text-sm text-slate-500">No trainer has logged a class here yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-semibold">Trainer</th>
                <th className="px-2 py-2 font-semibold">Sections</th>
                <th className="px-2 py-2 text-right font-semibold">Verified</th>
                <th className="px-2 py-2 text-right font-semibold">Hours</th>
                <th className="px-2 py-2 text-right font-semibold">Pending</th>
                <th className="px-2 py-2 text-right font-semibold">Rejected</th>
                <th className="px-2 py-2 text-right font-semibold">Verification</th>
                <th className="px-2 py-2 text-right font-semibold">Last Logged</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((row) => (
                <tr key={row.trainer} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-2 font-medium">{row.trainer}</td>
                  <td
                    className="max-w-72 px-2 py-2 text-xs text-slate-600"
                    title={row.sections
                      .map((s) => s.replace(/^(\S+)/, (code) => campusName(code)))
                      .join('\n')}
                  >
                    {row.sections.slice(0, 4).join(', ')}
                    {row.sections.length > 4 ? ` +${row.sections.length - 4} more` : ''}
                  </td>
                  <td className={td}>{row.verified}</td>
                  <td className={cn(td, 'font-semibold')}>{hours(row.hours)}</td>
                  <td className={cn(td, row.pending > 0 && 'text-amber-600')}>{row.pending}</td>
                  <td className={cn(td, row.rejected > 0 && 'text-rose-600')}>{row.rejected}</td>
                  <td className={td}>
                    <Rate value={verification(row)} />
                  </td>
                  <td className={cn(td, 'text-xs text-slate-600')}>{day(row.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
