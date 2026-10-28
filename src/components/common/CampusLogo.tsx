import { useState } from 'react';

import { cn } from '@/lib/utils';

/** Gradients for the letters shown when a campus has no logo, picked by name. */
const GRADIENTS = [
  'from-sky-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

const STOP_WORDS = new Set(['of', 'and', '&', 'the', 'college', 'group']);

/** "IITM Group of Institutions" → "IITM"; "Rathinam Global University" → "RG". */
export function campusInitials(name: string) {
  const first = name.split(/[\s,]+/)[0] ?? '';
  if (/^[A-Z]{2,4}$/.test(first)) return first;
  return name
    .split(/[\s,]+/)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

const hash = (text: string) =>
  [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 7);

/**
 * In production the logo goes through Vercel's image resizer (see "images" in vercel.json),
 * so a 300 KB upload arrives as a few KB of WebP. The dev server has no resizer.
 */
function sized(url: string, width: number) {
  return import.meta.env.PROD
    ? `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=80`
    : url;
}

/** The campus logo in a white square, or its initials on a gradient when there is none. */
export function CampusLogo({
  name,
  logo,
  className,
}: {
  name: string;
  logo?: string | null;
  /** Size, e.g. "size-11"; defaults to size-11. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = campusInitials(name);

  if (logo && !failed) {
    return (
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-0.5 shadow-md ring-1 ring-[#e2e8f0]',
          className
        )}
      >
        <img
          src={sized(logo, 128)}
          alt={`${name} logo`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-md ring-2 ring-white/60',
        GRADIENTS[Math.abs(hash(name)) % GRADIENTS.length],
        initials.length > 3 && 'text-[11px] tracking-tight',
        className
      )}
    >
      {initials}
    </span>
  );
}
