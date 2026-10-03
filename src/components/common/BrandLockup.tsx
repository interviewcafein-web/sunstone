import { cn } from '@/lib/utils';

interface BrandLockupProps {
  /** Sets the logo's height, e.g. "h-5"; PRIME scales with `primeClassName`. */
  logoClassName?: string;
  primeClassName?: string;
  className?: string;
}

/**
 * The Sunstone logo with PRIME set beneath the wordmark between two gold rules.
 * The 21% left inset clears the step mark so PRIME lines up under "SUNSTONE".
 */
export function BrandLockup({ logoClassName, primeClassName, className }: BrandLockupProps) {
  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <img
        src="/sunstone-logo.png"
        alt="Sunstone"
        width={886}
        height={115}
        className={cn('h-5 w-auto', logoClassName)}
      />
      <span className="flex items-center gap-1.5 pl-[21%]">
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500" />
        <span
          className={cn(
            '-mr-[0.5em] bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 bg-clip-text text-[9px] leading-none font-extrabold tracking-[0.5em] text-transparent',
            primeClassName
          )}
        >
          PRIME
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500" />
      </span>
    </span>
  );
}
