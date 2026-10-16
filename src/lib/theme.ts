import { useSyncExternalStore } from 'react';

// Site theme: light by default, dark when chosen with the header toggle. The choice is kept
// in this browser. index.html applies it before the first paint so the page never flashes.

export type Theme = 'light' | 'dark';

export const THEME_KEY = 'sunstone:theme';

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0b1426' : '#1a3e70');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked (private mode): the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light');
}

/** Colours for charts drawn as SVG, where CSS variables cannot be used as attributes. */
export function chartColors(theme: Theme) {
  return theme === 'dark'
    ? {
        grid: '#24324b',
        tick: '#7c8ba3',
        empty: '#1d2a41',
        cursor: '#1a2740',
        tooltip: '#131f36',
        text: '#e2e8f0',
      }
    : {
        grid: '#E2E8F0',
        tick: '#94A3B8',
        empty: '#EEF2F6',
        cursor: '#F1F5F9',
        tooltip: '#ffffff',
        text: '#0f172a',
      };
}
