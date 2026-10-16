import { Moon, Sun } from 'lucide-react';

import { setTheme, useTheme } from '@/lib/theme';

/** Sun/moon button in the header that switches the whole site between light and dark. */
export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="hover:bg-brand-50 dark:hover:bg-brand-900/40 hover:text-brand-700 dark:hover:text-brand-300 ml-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors"
    >
      {theme === 'dark' ? (
        <Sun className="size-4.5" aria-hidden />
      ) : (
        <Moon className="size-4.5" aria-hidden />
      )}
    </button>
  );
}
