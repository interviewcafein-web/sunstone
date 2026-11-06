// Links and navigation for Converge's own routes (routes.ts).
//
// The router types registered in src/main.tsx describe Vertex's route tree, and that
// registration applies to every file in src. Converge has different paths (/super-100,
// /campuses/$id), so these wrappers type them against Converge's paths instead. At runtime
// they are TanStack Router's own Link and navigate.

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import {
  Link as RouterLink,
  useNavigate as useRouterNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';

export type ConvergePath =
  | '/'
  | '/login'
  | '/s/$slug'
  | '/campuses'
  | '/campuses/$id'
  | '/super-100'
  | '/issues';

type Search = Record<string, unknown>;

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: ConvergePath;
  params?: Record<string, string>;
  search?: Search | ((previous: Search) => Search);
  replace?: boolean;
  activeProps?: { className?: string };
  activeOptions?: { exact?: boolean; includeSearch?: boolean };
  children?: ReactNode;
}

export const Link = RouterLink as unknown as (props: LinkProps) => ReactNode;

export interface NavigateOptions {
  to?: ConvergePath;
  params?: Record<string, string>;
  search?: Search | ((previous: Search) => Search);
  replace?: boolean;
}

export function useNavigate() {
  return useRouterNavigate() as unknown as (options: NavigateOptions) => Promise<void>;
}

/** The current page's search, as its route validated it (routes.ts). */
export function useRouteSearch<T>(): T {
  return useSearch({ strict: false }) as unknown as T;
}

export function useRouteParams(): Record<string, string | undefined> {
  return useParams({ strict: false }) as unknown as Record<string, string | undefined>;
}

/** Updates part of the current page's search, keeping the rest. */
export function useSetSearch<T extends object>() {
  const navigate = useNavigate();
  return (patch: Partial<T>) =>
    navigate({
      search: (previous) => ({ ...previous, ...patch }),
      replace: true,
    });
}
