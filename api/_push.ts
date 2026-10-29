// Push notifications to the Vertex app through Expo's push service (no key needed). Phones
// register their Expo push token with /api/push; tokens Expo reports as no longer registered
// are switched off.

import { db } from './_db';

export interface Push {
  title: string;
  body: string;
  /** Path in the app or on the website, opened when the push is tapped. */
  link?: string | null;
}

/** Sends `push` to every registered phone of these people; returns how many were sent. */
export async function pushTo(emails: string[], push: Push): Promise<number> {
  if (!emails.length) return 0;
  const devices = await db()`
    select token from push_devices where not disabled and email = any(${emails}::text[])`;
  const tokens = devices.map((row) => String(row.token));
  let sent = 0;
  for (let start = 0; start < tokens.length; start += 100) {
    const chunk = tokens.slice(start, start + 100);
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        chunk.map((to) => ({
          to,
          title: push.title,
          body: push.body.slice(0, 180),
          sound: 'default',
          data: { link: push.link ?? null },
        }))
      ),
    }).catch(() => null);
    if (!response?.ok) continue;
    const { data } = (await response.json().catch(() => ({ data: [] }))) as {
      data: { status: string; details?: { error?: string } }[];
    };
    const dead = chunk.filter((_, index) => data[index]?.details?.error === 'DeviceNotRegistered');
    if (dead.length) {
      await db()`update push_devices set disabled = true where token = any(${dead}::text[])`;
    }
    sent += data.filter((ticket) => ticket.status === 'ok').length;
  }
  return sent;
}
