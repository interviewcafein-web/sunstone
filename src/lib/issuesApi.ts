// Campus issues on the website: the list, one issue's thread, and raising, replying,
// changing status and reassigning. See api/issues.ts and src/lib/issues.ts.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  MAX_IMAGE_BYTES,
  type IssueDetail,
  type IssueImage,
  type IssuePriority,
  type IssueStatus,
  type IssuesResponse,
} from './issues';

export type IssueFilter = 'active' | 'resolved' | 'all';

export interface NewIssue {
  campusId: number;
  category: string;
  priority: IssuePriority;
  location?: string;
  details: string;
  images?: IssueImage[];
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

export const useIssues = (filter: IssueFilter, campus?: number, enabled = true, mine = false) =>
  useQuery({
    queryKey: ['issues', filter, campus ?? null, mine],
    queryFn: () =>
      call<IssuesResponse>(
        `?status=${filter}${campus ? `&campus=${campus}` : ''}${mine ? '&mine=1' : ''}`
      ),
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
  useIssueMutation(({ id, body, images }: { id: number; body: string; images?: IssueImage[] }) =>
    post<IssueDetail>({ action: 'reply', id, body, images })
  );

export const useSetStatus = () =>
  useIssueMutation(({ id, status, note }: { id: number; status: IssueStatus; note?: string }) =>
    post<IssueDetail>({ action: 'status', id, status, note })
  );

export const useAssign = () =>
  useIssueMutation(({ id, assignee }: { id: number; assignee: string }) =>
    post<IssueDetail>({ action: 'assign', id, assignee })
  );

// --- Photos ----------------------------------------------------------------------------------

/** Phone photos are large: anything over this is scaled down before it is uploaded. */
const SHRINK_ABOVE = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;

/** A smaller JPEG of a large photo (longest side 2000 px); the photo itself when it is small. */
async function shrink(file: File): Promise<Blob> {
  if (file.size <= SHRINK_ABOVE || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Uploads one photo straight to Cloudinary with a signature from /api/issues, and returns
 * what to send with the issue or reply.
 */
export async function uploadPhoto(file: File): Promise<IssueImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a photo.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} is over 10 MB.`);
  const sign = await call<{
    cloudName: string;
    apiKey: string;
    folder: string;
    timestamp: number;
    signature: string;
  }>('?sign=1');
  const form = new FormData();
  form.append('file', await shrink(file));
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('folder', sign.folder);
  form.append('signature', sign.signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) : {};
  if (!response?.ok || !data.secure_url) {
    throw new Error(
      data.error?.message ? `Upload failed: ${data.error.message}` : 'Upload failed. Try again.'
    );
  }
  return { url: data.secure_url, width: data.width ?? null, height: data.height ?? null };
}
