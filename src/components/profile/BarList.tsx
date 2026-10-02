import type { CountItem } from '@/lib/coding-profiles/types';

export function BarList({ items }: { items: CountItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="grid grid-cols-[minmax(6rem,34%)_1fr_3rem] items-center gap-2 text-xs"
        >
          <span className="truncate" title={item.label}>
            {item.label}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <span
              className="bg-brand-500 block h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right text-slate-500 tabular-nums">
            {item.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
