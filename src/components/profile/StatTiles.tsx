import type { Stat } from '@/lib/coding-profiles/types';

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex flex-wrap gap-x-7 gap-y-2">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col-reverse">
          <dt className="text-xs text-slate-500">{stat.label}</dt>
          <dd className="text-xl font-bold break-words tabular-nums">
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-1.5 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
      {children}
    </h3>
  );
}
