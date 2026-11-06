import { cn } from '@/lib/utils';

/**
 * The CONVERGE 2026 wordmark. `onDark` always uses the white-and-gold version (navy banners);
 * otherwise navy-and-gold on the light theme and white-and-gold on the dark theme.
 */
export function ConvergeLogo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const size = cn('h-8 w-auto', className);
  if (onDark) {
    return (
      <img
        src="/converge-logo-white.png"
        alt="Converge 2026"
        width={808}
        height={181}
        className={size}
      />
    );
  }
  return (
    <>
      <img
        src="/converge-logo-ink.png"
        alt="Converge 2026"
        width={808}
        height={181}
        className={cn(size, 'dark:hidden')}
      />
      <img
        src="/converge-logo-white.png"
        alt="Converge 2026"
        width={808}
        height={181}
        className={cn(size, 'hidden dark:block')}
      />
    </>
  );
}
