import { useEffect, useState } from 'react';

import { PlatformLogo } from '@/components/profile/PlatformLogo';
import { PLATFORMS } from '@/lib/coding-profiles/platforms';
import type { Handles } from '@/lib/coding-profiles/types';

interface HandleFormProps {
  /** Handles currently in the URL; the form resets to them when they change. */
  handles: Handles;
  onSubmit: (handles: Handles) => void;
}

export function HandleForm({ handles, onSubmit }: HandleFormProps) {
  const [draft, setDraft] = useState<Handles>(handles);

  useEffect(() => {
    setDraft(handles);
  }, [handles]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned: Handles = {};
    for (const platform of PLATFORMS) {
      const value = draft[platform.id]?.trim();
      if (value) cleaned[platform.id] = value;
    }
    onSubmit(cleaned);
  };

  return (
    <form onSubmit={submit} className="shadow-card rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <div key={platform.id}>
            <label
              htmlFor={`handle-${platform.id}`}
              className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600"
            >
              <PlatformLogo platform={platform.id} className="size-3.5" />
              {platform.name} username
            </label>
            <input
              id={`handle-${platform.id}`}
              value={draft[platform.id] ?? ''}
              onChange={(event) => setDraft({ ...draft, [platform.id]: event.target.value })}
              placeholder={platform.placeholder}
              autoComplete="off"
              spellCheck={false}
              className="focus-visible:outline-brand-500 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-500 rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Show profile
        </button>
      </div>
    </form>
  );
}
