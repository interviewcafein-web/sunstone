import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useState } from 'react';

const DISMISSED = 'vertex:app-banner-dismissed';

const onAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const dismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
};

/** On Android phones only: a slim invitation to the Vertex app, until it is dismissed. */
export function AppBanner() {
  const [shown, setShown] = useState(() => onAndroid() && !dismissed());
  if (!shown) return null;
  const close = () => {
    setShown(false);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Storage blocked: it hides for this visit only.
    }
  };
  return (
    <div className="from-brand-700 to-brand-900 animate-rise flex items-center gap-3 bg-gradient-to-r px-4 py-2.5 text-white">
      <img src="/vertex-mark.png" alt="" className="size-9 shrink-0 rounded-xl bg-white p-1.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Vertex is on Android</p>
        <p className="text-brand-100 truncate text-xs">Faster, with notifications</p>
      </div>
      <Link
        to="/app"
        className="shrink-0 rounded-full bg-[#e8a33d] px-3.5 py-1.5 text-xs font-bold text-[#1a1206]"
      >
        Get the app
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Hide"
        className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
