import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  type TestCategory,
  type TestStatus,
} from '@/lib/assessments';
import { cn } from '@/lib/utils';

export function StatusChip({ status }: { status: TestStatus }) {
  return (
    <span
      className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold', STATUS_STYLES[status])}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function CategoryChip({ category }: { category: TestCategory }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-px text-[10px] font-semibold',
        CATEGORY_STYLES[category]
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

/** "Module 2 : Lead Generation" → "Module 2: Lead Generation"; stray quotes trimmed. */
export const tidy = (name: string) =>
  name
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+:/g, ':')
    .trim();
