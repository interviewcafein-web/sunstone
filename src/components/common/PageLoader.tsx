import { cn } from '@/lib/utils';

/** A grey block with a light sweeping across it, standing in for content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} />;
}

/** The status pill: the Vertex mark breathing, the message, and three bouncing dots. */
function LoadingPill({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-surface/90 shadow-card animate-rise flex items-center gap-3 rounded-full border border-slate-200 py-2 pr-5 pl-2 backdrop-blur"
    >
      <span className="relative flex size-9 items-center justify-center">
        <span className="bg-brand-200/60 absolute inset-0 animate-ping rounded-full motion-reduce:hidden" />
        <span className="bg-surface relative flex size-9 items-center justify-center rounded-full ring-1 ring-slate-200">
          <img src="/vertex-mark.png" alt="" className="loader-breathe size-6" />
        </span>
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="loader-dot bg-brand-500 size-1.5 rounded-full"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}

const heroBlock =
  'from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 sm:p-7';

/** A faint shape of the page that is on its way, with a status pill floating over it. */
export function PageLoader({
  label,
  variant = 'table',
}: {
  label: string;
  /** table: banner, filters and rows. cards: banner and a grid of cards. profile: banner and panels. */
  variant?: 'table' | 'cards' | 'profile' | 'plain';
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none space-y-5 select-none" aria-hidden>
        {variant !== 'plain' && (
          <section className={cn(heroBlock, 'hero-glow')}>
            <div className="skeleton-dark h-3 w-36 rounded" />
            <div className="skeleton-dark mt-3 h-8 w-2/3 max-w-md rounded-lg" />
            <div className="skeleton-dark mt-3 h-3 w-1/2 max-w-sm rounded" />
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="skeleton-dark h-16 rounded-xl" />
              ))}
            </div>
          </section>
        )}

        {variant === 'table' && (
          <>
            <div className="shadow-card bg-surface flex flex-wrap gap-3 rounded-2xl border border-slate-200 p-4">
              {['flex-[2]', 'flex-1', 'flex-1', 'flex-[1.5]'].map((grow, index) => (
                <Skeleton key={index} className={cn('h-10 min-w-24', grow)} />
              ))}
            </div>
            <div className="shadow-card bg-surface overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
                <Skeleton className="h-3 w-1/3" />
              </div>
              {Array.from({ length: 7 }, (_, row) => (
                <div
                  key={row}
                  className="flex items-center gap-4 border-b border-dotted border-slate-200 px-4 py-3.5 last:border-0"
                  style={{ opacity: 1 - row * 0.11 }}
                >
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-2.5 w-64 max-w-full" />
                  </div>
                  {Array.from({ length: 5 }, (_, cell) => (
                    <Skeleton key={cell} className="hidden h-6 w-16 md:block" />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {variant === 'cards' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="shadow-card bg-surface space-y-4 rounded-2xl border border-slate-200 p-5"
              >
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-4">
                  {[0, 1, 2].map((ring) => (
                    <Skeleton key={ring} className="size-14 rounded-full" />
                  ))}
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        )}

        {variant === 'profile' && (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="shadow-card bg-surface space-y-3 rounded-2xl border border-slate-200 p-5"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center sm:top-28">
        <LoadingPill label={label} />
      </div>
    </div>
  );
}

/** Inside a card or panel: the status pill alone, centred. */
export function InlineLoader({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-8">
      <LoadingPill label={label} />
    </div>
  );
}
