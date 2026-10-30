import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';

import type { Resource } from '@/data/resources';
import { driveDownloadUrl, drivePreviewUrl, driveViewUrl } from '@/lib/driveLinks';

/** Full-screen PDF preview using Google Drive's own viewer. Esc or the backdrop closes it. */
export function PdfViewer({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const link = resource.link!;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // The page behind should not scroll while the viewer is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const action =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${resource.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="mr-auto min-w-0 truncate text-base font-bold">{resource.title}</h2>
          <a
            href={driveDownloadUrl(link)}
            target="_blank"
            rel="noopener noreferrer"
            download
            className={`${action} bg-brand-700 hover:bg-brand-800 text-white`}
          >
            <Download className="size-4" aria-hidden />
            Download
          </a>
          <a
            href={driveViewUrl(link)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${action} border border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            <ExternalLink className="size-4" aria-hidden />
            <span className="hidden sm:inline">Open in New Tab</span>
          </a>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="relative flex-1 bg-slate-100">
          {!loaded && (
            <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Opening the PDF…
            </p>
          )}
          <iframe
            src={drivePreviewUrl(link)}
            title={resource.title}
            onLoad={() => setLoaded(true)}
            allow="autoplay"
            className="relative h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
