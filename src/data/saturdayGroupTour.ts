/**
 * Saturday group departure — owner-set terms (12 Nov 2026). Browse-safe, no backend.
 * 4N/5D only, 1st and 3rd Saturday of every month, minimum 4 guests per group.
 */
export const SATURDAY_GROUP_TOUR = {
  name: 'Meghalaya Saturday Group Tour (4N/5D)',
  duration: '4 Nights / 5 Days',
  pricePerPerson: 10000,
  pricePerNight: 2800,
  minGroup: 4,
  schedule: '1st and 3rd Saturday of every month',
  includes: [
    'Stay, transport and breakfast included',
    '3 nights at XTSY Travellers Hostel, New Shillong Township',
    '1 night at XTSY Dawki (Shnongpdeng) Riverside Camping',
    'Breakfast, dinner and a bonfire at both stays',
  ],
  cancellation: 'No free cancellation; the booking amount is non-refundable.',
} as const;

/** The 1st and 3rd Saturdays on or after `from` (local date), soonest first. */
export function nextSaturdayDepartures(from: Date, count = 6): Date[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out: Date[] = [];
  for (let m = 0; out.length < count && m < 24; m++) {
    const first = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const offset = (6 - first.getDay() + 7) % 7;
    for (const week of [0, 2]) {
      const d = new Date(first.getFullYear(), first.getMonth(), 1 + offset + week * 7);
      if (d >= start && out.length < count) out.push(d);
    }
  }
  return out;
}

export const formatDeparture = (d: Date) =>
  d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
