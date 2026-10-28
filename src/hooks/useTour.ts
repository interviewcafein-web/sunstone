import { useEffect } from 'react';

import { useSession } from '@/lib/session';
import { REPLAY_EVENT, hasSeenTour, startTour, type TourId } from '@/lib/tour';

/**
 * Shows a tour the first time this person opens the page (once `ready`, i.e. the page's
 * content is on screen), and again whenever the account menu asks for it.
 */
export function useTour(id: TourId, ready: boolean) {
  const user = useSession().data?.user;

  useEffect(() => {
    if (!ready || !user || hasSeenTour(id, user)) return;
    // Let the page finish its entrance animation first.
    const timer = setTimeout(() => startTour(id, user), 900);
    return () => clearTimeout(timer);
  }, [id, ready, user]);

  useEffect(() => {
    if (!user) return;
    const replay = (event: Event) => {
      if ((event as CustomEvent<TourId>).detail === id) startTour(id, user);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, [id, user]);
}
