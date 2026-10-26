import { cn } from '@/lib/utils';

/**
 * The Vertex product logo. `onDark` always uses the white-and-gold version (for navy
 * banners); otherwise the full-colour logo shows on the light theme and the white one on
 * the dark theme.
 */
export function VertexLogo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const size = cn('h-7 w-auto', className);
  if (onDark) {
    return (
      <img src="/vertex-logo-white.png" alt="Vertex" width={1247} height={445} className={size} />
    );
  }
  return (
    <>
      <img
        src="/vertex-logo.png"
        alt="Vertex"
        width={1247}
        height={445}
        className={cn(size, 'dark:hidden')}
      />
      <img
        src="/vertex-logo-white.png"
        alt="Vertex"
        width={1247}
        height={445}
        className={cn(size, 'hidden dark:block')}
      />
    </>
  );
}
