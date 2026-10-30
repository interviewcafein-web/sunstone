import { useEffect, useState } from 'react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { Check, ChevronRight, Download, IdCard, Link2, Share2 } from 'lucide-react';

import { Card } from '@/components/coding/ui';
import { useStudent } from '@/hooks/useStudents';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const route = getRouteApi('/s/$slug_/card');

/**
 * A student's shareable coding card (/s/{slug}/card), like InterviewCafe's. The card is
 * drawn by api/card.ts, so what is shown here is exactly what downloads, and a shared
 * link previews with the card itself.
 */
export default function CodingCardPage() {
  const { slug } = route.useParams();
  const student = useStudent(slug).data ?? undefined;

  // The card follows the site theme: the light card on the light site, navy on the dark one.
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [theme, slug]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const image = `/api/card?s=${encodeURIComponent(slug)}&theme=${theme}`;
  const pageUrl = `${window.location.origin}/s/${slug}/card`;
  const name = student?.name ?? 'Student';
  const text = `${name}'s coding card on Sunstone PRIME`;
  const enc = encodeURIComponent;
  const shareTargets = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text}: ${pageUrl}`)}` },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(pageUrl)}`,
    },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(pageUrl)}` },
  ];
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
    } catch {
      // Clipboard access denied: the link is still in the address bar.
    }
  };

  const button =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors';

  return (
    <div className="rise-stagger space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-slate-500">
          <li>
            <Link to="/" className="hover:text-slate-900 hover:underline">
              Students
            </Link>
          </li>
          {student?.campus && student.campus !== 'Not specified' && (
            <>
              <ChevronRight className="size-3.5" aria-hidden />
              <li>
                <Link
                  to="/"
                  search={{ campus: student.campus }}
                  className="hover:text-slate-900 hover:underline"
                >
                  {student.campus}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="size-3.5" aria-hidden />
          <li>
            <Link to="/s/$slug" params={{ slug }} className="hover:text-slate-900 hover:underline">
              {name}
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="font-medium text-slate-900">
            Coding Card
          </li>
        </ol>
      </nav>

      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,380px)_1fr] lg:gap-12">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="relative overflow-hidden rounded-[22px] shadow-[0_24px_60px_-20px_rgb(16_38_70/0.55)] ring-1 ring-black/5">
            {!loaded && !failed && (
              <div className="bg-brand-100 dark:bg-brand-900/60 flex aspect-[1080/1350] w-full animate-pulse items-end justify-center p-6 text-center text-xs text-slate-500">
                Drawing the card. The first time can take a few seconds while every platform is
                checked.
              </div>
            )}
            {failed ? (
              <Card className="aspect-[1080/1350] place-content-center text-center text-sm text-slate-600">
                This card could not be drawn. Try again in a moment.
              </Card>
            ) : (
              <img
                src={image}
                alt={`${name}'s coding card`}
                className={loaded ? 'block w-full' : 'hidden'}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            )}
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {theme === 'dark' ? 'Navy' : 'Light'} card, matching the site theme. Use the{' '}
            {theme === 'dark' ? 'sun' : 'moon'} button at the top to switch.
          </p>
        </div>

        <div className="md:pt-4">
          <span className="bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
            <IdCard className="size-3.5" aria-hidden /> Coding Card
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {name}'s coding card
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Problems solved, active days and contests across every linked coding platform, with
            current contest ratings. Share it on LinkedIn or WhatsApp, or add it to a resume.
          </p>

          <div className="mt-6 grid max-w-sm grid-cols-2 gap-2">
            <a
              href={`${image}&download=1`}
              className={cn(button, 'bg-brand-700 hover:bg-brand-800 text-white')}
            >
              <Download className="size-4" aria-hidden /> Download PNG
            </a>
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                button,
                'border border-slate-200 bg-surface text-slate-700 hover:bg-slate-50'
              )}
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Share on
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {shareTargets.map((target) => (
                <a
                  key={target.label}
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:border-brand-300 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 rounded-full border border-slate-200 bg-surface px-3.5 py-1.5 text-sm font-medium text-slate-700"
                >
                  {target.label}
                </a>
              ))}
              {canShare && (
                <button
                  type="button"
                  onClick={() =>
                    void navigator.share({ title: text, url: pageUrl }).catch(() => {})
                  }
                  className="hover:border-brand-300 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-3.5 py-1.5 text-sm font-medium text-slate-700"
                >
                  <Share2 className="size-3.5" aria-hidden /> More
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 max-w-md space-y-2 border-t border-slate-200 pt-5 text-sm text-slate-600">
            <p>Numbers refresh every few hours from the linked coding platforms.</p>
            <Link
              to="/s/$slug"
              params={{ slug }}
              className="text-brand-700 dark:text-brand-300 inline-block font-semibold hover:underline"
            >
              View the Full Coding Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
