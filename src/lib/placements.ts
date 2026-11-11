// Placements (job offers and internships from the LMS): labels shared by the API and the pages.

/** LMS joining statuses. */
export const JOINING: Record<number, string> = {
  1: 'Joined, working',
  2: 'Joined, then left',
  3: 'Joining awaited',
  4: 'Not joining: another offer',
  5: 'Refused the offer',
  6: 'Documents not shared',
  7: 'Terminated by the company',
  8: 'Offer denied by the company',
  9: 'Denied: JD or CTC mismatch',
  10: 'Denied: work mismatch',
};

/** "6.5 LPA" for a full-time CTC in lakhs a year; "₹25,000/mo" for a monthly stipend. */
export function formatPay(value: number | null | undefined, fullTime: boolean): string {
  if (value == null) return '—';
  return fullTime
    ? `${Number(value.toFixed(2))} LPA`
    : `₹${Math.round(value).toLocaleString('en-IN')}/mo`;
}
