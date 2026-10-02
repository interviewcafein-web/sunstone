import type { IconType } from 'react-icons';
import {
  SiCodechef,
  SiCodeforces,
  SiGeeksforgeeks,
  SiGithub,
  SiHackerrank,
  SiLeetcode,
} from 'react-icons/si';

import type { PlatformId } from '@/lib/coding-profiles/types';
import { cn } from '@/lib/utils';

// Each platform's own brand colour. HackerRank's current green (#00EA64) is too light to
// read on white, so this uses its darker long-standing green.
const LOGOS: Record<PlatformId, { Icon: IconType; color: string }> = {
  leetcode: { Icon: SiLeetcode, color: '#FFA116' },
  geeksforgeeks: { Icon: SiGeeksforgeeks, color: '#2F8D46' },
  hackerrank: { Icon: SiHackerrank, color: '#1BA94C' },
  codeforces: { Icon: SiCodeforces, color: '#1F8ACB' },
  codechef: { Icon: SiCodechef, color: '#5B4638' },
  github: { Icon: SiGithub, color: '#181717' },
};

/** Decorative: always rendered next to the platform's name. */
export function PlatformLogo({
  platform,
  className,
}: {
  platform: PlatformId;
  className?: string;
}) {
  const { Icon, color } = LOGOS[platform];
  return <Icon aria-hidden color={color} className={cn('size-4 shrink-0', className)} />;
}
