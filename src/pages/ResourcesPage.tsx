import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Library, Search, X } from 'lucide-react';

import { PdfViewer } from '@/components/resources/PdfViewer';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { RESOURCES } from '@/data/resources';
import { cn } from '@/lib/utils';

const route = getRouteApi('/resources');

/** Books, PDFs and premium material, each with a Drive preview and download. */
export default function ResourcesPage() {
  const { q, tag, view } = route.useSearch();
  const navigate = route.useNavigate();
  const setSearch = (patch: { q?: string; tag?: string; view?: string }) =>
    navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  const tags = useMemo(
    () => [...new Set(RESOURCES.flatMap((resource) => resource.tags))].sort(),
    []
  );

  const shown = useMemo(() => {
    const needle = q?.toLowerCase().trim();
    // Shown in the order of src/data/resources.ts.
    return RESOURCES.filter(
      (resource) =>
        (!tag || resource.tags.includes(tag)) &&
        (!needle ||
          [resource.title, resource.description, ...resource.tags, resource.badge ?? '']
            .join(' ')
            .toLowerCase()
            .includes(needle))
    );
  }, [q, tag]);

  // The open preview lives in the URL (?view=<id>), so a preview can be linked to directly.
  const previewing = RESOURCES.find((resource) => resource.id === view && resource.link);

  return (
    <div className="rise-stagger space-y-5">
      <section className="from-brand-700 to-brand-900 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-7">
        <div
          aria-hidden
          className="bg-brand-400/30 pointer-events-none absolute -top-24 right-1/4 size-72 rounded-full blur-3xl"
        />
        <p className="text-brand-200 relative text-xs font-semibold tracking-[0.2em] uppercase">
          Learning library
        </p>
        <h1 className="relative mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Library className="size-7" aria-hidden />
          Resources
        </h1>
        <p className="text-brand-100 relative mt-2 max-w-2xl text-sm">
          Books, PDFs and premium material for interview preparation. Preview any of them here or
          download a copy.
        </p>
        <p className="text-brand-200 relative mt-3 text-xs">
          {RESOURCES.length} resources · {RESOURCES.filter((resource) => resource.premium).length}{' '}
          premium
        </p>
      </section>

      <div className="shadow-card bg-surface flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q ?? ''}
            onChange={(event) => setSearch({ q: event.target.value || undefined })}
            placeholder="Search resources"
            aria-label="Search resources"
            className="focus-visible:outline-brand-500 bg-surface w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
          {['All', ...tags].map((label) => {
            const active = label === 'All' ? !tag : tag === label;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setSearch({ tag: label === 'All' || active ? undefined : label })}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(q || tag) && (
          <button
            type="button"
            onClick={() => setSearch({ q: undefined, tag: undefined })}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 lg:ml-auto"
          >
            <X className="size-4" aria-hidden />
            Clear
          </button>
        )}
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onPreview={(item) => setSearch({ view: item.id })}
              onTag={(label) => setSearch({ tag: label })}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">
          No resources match. Try another search or tag.
        </p>
      )}

      {previewing && (
        <PdfViewer resource={previewing} onClose={() => setSearch({ view: undefined })} />
      )}
    </div>
  );
}
