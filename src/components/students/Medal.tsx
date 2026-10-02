import { cn } from '@/lib/utils';

const MEDALS = [
  { label: '1st', className: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950' },
  { label: '2nd', className: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800' },
  { label: '3rd', className: 'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950' },
];

/** Gold, silver or bronze disc for places 0–2. */
export function Medal({ place, className }: { place: number; className?: string }) {
  const medal = MEDALS[place];
  if (!medal) return null;

  return (
    <span
      title={`${medal.label} place`}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-full text-[11px] font-extrabold shadow-sm ring-2 ring-white',
        medal.className,
        className
      )}
    >
      {place + 1}
    </span>
  );
}
