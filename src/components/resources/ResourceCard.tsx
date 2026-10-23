import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Boxes,
  Braces,
  Brain,
  Briefcase,
  Calculator,
  CalendarDays,
  Cloud,
  Code,
  Cpu,
  Crown,
  Database,
  Download,
  Eye,
  FileText,
  Globe,
  Network,
} from 'lucide-react';

import type { Resource, ResourceIcon, ResourceTheme } from '@/data/resources';
import { driveDownloadUrl } from '@/lib/driveLinks';
import { cn } from '@/lib/utils';

export const ICONS: Record<ResourceIcon, LucideIcon> = {
  network: Network,
  oops: Boxes,
  database: Database,
  os: Cpu,
  dsa: Braces,
  document: FileText,
  book: BookOpen,
  web: Globe,
  cloud: Cloud,
  ai: Brain,
  aptitude: Calculator,
  career: Briefcase,
  code: Code,
};

// Fixed colours (not theme classes), so the headers look the same in light and dark mode.
const THEMES: Record<ResourceTheme, string> = {
  green: 'linear-gradient(135deg, #2f9a6c 0%, #3dbca0 100%)',
  purple: 'linear-gradient(135deg, #8b2cf5 0%, #5b3ff0 100%)',
  blue: 'linear-gradient(135deg, #2563eb 0%, #38b2e0 100%)',
  orange: 'linear-gradient(135deg, #ea6c1a 0%, #f5a524 100%)',
  navy: 'linear-gradient(135deg, #1a3e70 0%, #3863a0 100%)',
  rose: 'linear-gradient(135deg, #e11d63 0%, #f2617a 100%)',
};

const SHORT_LENGTH = 70;

export function formatResourceDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface ResourceCardProps {
  resource: Resource;
  onPreview: (resource: Resource) => void;
  onTag: (tag: string) => void;
}

export function ResourceCard({ resource, onPreview, onTag }: ResourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[resource.icon] ?? FileText;
  const long = resource.description.length > SHORT_LENGTH;
  const button =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors';

  return (
    <article className="shadow-card bg-surface group flex flex-col overflow-hidden rounded-2xl border border-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      {/* Coloured header: dot grid, the icon, and a faded large copy of it */}
      <div
        className="relative flex h-32 items-center justify-center overflow-hidden"
        style={{ background: THEMES[resource.theme] ?? THEMES.navy }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.55) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <Icon
          aria-hidden
          className="relative size-12 stroke-[1.75] text-white transition-transform group-hover:scale-110"
        />
        <Icon
          aria-hidden
          className="absolute -right-4 -bottom-6 size-32 stroke-[1.5] text-white/20"
        />
        {resource.badge && (
          <span className="absolute bottom-3 left-3 rounded-md bg-slate-900/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
            {resource.badge}
          </span>
        )}
        {resource.premium && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-amber-950 uppercase shadow-sm">
            <Crown className="size-3" aria-hidden />
            Premium
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg leading-snug font-bold">{resource.title}</h3>

        {resource.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {resource.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTag(tag)}
                title={`Show only ${tag}`}
                className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-200"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {expanded || !long
            ? resource.description
            : `${resource.description.slice(0, SHORT_LENGTH).trimEnd()}… `}
          {long && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-brand-700 dark:text-brand-300 ml-1 font-semibold hover:underline"
            >
              {expanded ? 'show less' : 'read more'}
            </button>
          )}
        </p>

        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatResourceDate(resource.date)}
        </p>

        <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
          {resource.link ? (
            <>
              <button
                type="button"
                onClick={() => onPreview(resource)}
                className={cn(button, 'bg-brand-700 hover:bg-brand-800 flex-1 text-white')}
              >
                <Eye className="size-4" aria-hidden />
                Preview
              </button>
              <a
                href={driveDownloadUrl(resource.link)}
                target="_blank"
                rel="noopener noreferrer"
                download
                className={cn(
                  button,
                  'flex-1 border border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <Download className="size-4" aria-hidden />
                Download
              </a>
            </>
          ) : (
            <span className="w-full rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-500">
              Link coming soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
