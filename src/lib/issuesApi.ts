// Campus issues on the website: the list, one issue's thread, and raising, replying,
// changing status and reassigning. See api/issues.ts and src/lib/issues.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { IssueDetail, IssuePriority, IssueStatus, IssuesResponse } from './issues';

export type IssueFilter = 'active' | 'resolved' | 'all';

export interface NewIssue {
  campusId: number;
  category: string;
  priority: IssuePriority;
  location?: string;
  details: string;
}

async function call<T>(query = '', init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/issues${query}`, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data as T;
}

const post = <T>(body: unknown) => call<T>('', { method: 'POST', body: JSON.stringify(body) });

export const useIssues = (filter: IssueFilter, campus?: number, enabled = true) =>
  useQuery({
    queryKey: ['issues', filter, campus ?? null],
    queryFn: () => call<IssuesResponse>(`?status=${filter}${campus ? `&campus=${campus}` : ''}`),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

export const useIssue = (id: number | undefined) =>
  useQuery({
    queryKey: ['issue', id],
    queryFn: () => call<IssueDetail>(`?id=${id}`),
    enabled: Boolean(id),
  });

function useIssueMutation<T>(run: (input: T) => Promise<IssueDetail | { issue: unknown }>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (data) => {
      if ('updates' in data) client.setQueryData(['issue', data.issue.id], data);
      void client.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

export const useRaiseIssue = () =>
  useIssueMutation((issue: NewIssue) =>
    post<{ issue: IssueDetail['issue'] }>({ action: 'create', ...issue })
  );

export const useReply = () =>
  useIssueMutation(({ id, body }: { id: number; body: string }) =>
    post<IssueDetail>({ action: 'reply', id, body })
  );

export const useSetStatus = () =>
  useIssueMutation(({ id, status, note }: { id: number; status: IssueStatus; note?: string }) =>
    post<IssueDetail>({ action: 'status', id, status, note })
  );

export const useAssign = () =>
  useIssueMutation(({ id, assignee }: { id: number; assignee: string }) =>
    post<IssueDetail>({ action: 'assign', id, assignee })
  );
