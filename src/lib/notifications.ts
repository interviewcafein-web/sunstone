// The notification bell: reading, marking read and (for HQ) sending. See api/notifications.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type NotificationLevel = 'info' | 'important' | 'urgent';
export type NotificationAudience = 'all' | 'hq' | 'campus';

export interface Notification {
  id: number;
  title: string;
  body: string;
  link: string | null;
  level: NotificationLevel;
  audience: NotificationAudience;
  campus_ids: number[];
  /** Milliseconds since 1970. */
  at: number;
  sender: string;
  emailed: number;
  read: boolean;
}

export interface NotificationsResponse {
  items: Notification[];
  unread: number;
  canSend: boolean;
  campuses: { id: number; name: string }[];
}

export interface NewNotification {
  title: string;
  body: string;
  link?: string;
  level: NotificationLevel;
  audience: NotificationAudience;
  campusIds: number[];
  email: boolean;
}

const KEY = ['notifications'];

async function call<T>(init?: RequestInit): Promise<T> {
  const response = await fetch('/api/notifications', {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.');
  return data as T;
}

/** Checked every minute, and whenever the tab comes back into focus. */
export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: KEY,
    queryFn: () => call<NotificationsResponse>(),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) =>
      call({ method: 'POST', body: JSON.stringify({ action: 'read', ids }) }),
    // Show it read straight away.
    onMutate: (ids) => {
      client.setQueryData<NotificationsResponse>(KEY, (data) => {
        if (!data) return data;
        const items = data.items.map((item) =>
          !ids || ids.includes(item.id) ? { ...item, read: true } : item
        );
        const cleared = data.items.filter(
          (item) => !item.read && (!ids || ids.includes(item.id))
        ).length;
        return { ...data, items, unread: Math.max(0, data.unread - cleared) };
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSendNotification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (notification: NewNotification) =>
      call<{ id: number; emailed: number }>({
        method: 'POST',
        body: JSON.stringify({ action: 'send', ...notification }),
      }),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
