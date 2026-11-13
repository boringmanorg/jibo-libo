/**
 * Saturday group departure — owner-set terms (13 Nov 2026). Browse-safe, no backend.
 * 4 Days / 3 Nights, 1st and 3rd Saturday of every month, minimum 4 guests per group.
 *
 * Supersedes the 12 Nov terms (4N/5D, ₹10,000, with a night at Dawki/Shnongpdeng).
 * The tour now runs Guwahati–Shillong–Cherrapunji–Jowai–Shillong–Guwahati with all
 * three nights at the Shillong hostel, and breakfast only — no dinner or bonfire.
 */
export const SATURDAY_GROUP_TOUR = {
  name: 'Meghalaya & Guwahati Saturday Group Tour (4D/3N)',
  duration: '4 Days / 3 Nights',
  route: 'Guwahati – Shillong – Cherrapunji – Jowai – Shillong – Guwahati',
  pricePerPerson: 9000,
  pricePerDay: 2250,
  minGroup: 4,
  /** ₹9,000 × the 4-guest minimum. Shown so groups can see the whole cost. */
  groupTotal: 36000,
  schedule: '1st and 3rd Saturday of every month',
  includes: [
    'Pickup and drop at Guwahati',
    'Transport throughout with a driver — tolls, parking, fuel and driver allowance included',
    '3 nights at XTSY Travellers Hostel, New Shillong Township',
    'Breakfast each morning at the hostel',
  ],
  cancellation: 'No free cancellation; the booking amount is non-refundable.',
  /**
   * Owner-supplied day plan. Two wordings were adjusted and nothing else:
   * the source text said "checkout from Shillong" on days 2 and 3 while also
   * ending both days with an overnight in Shillong, which contradicts itself
   * on a public page — the hostel is kept through all three nights here.
   * "Krang Shuri" is spelled "Krang Suri" to match the destination guide at
   * /destinations/meghalaya/jowai/krang-suri-falls.
   */
  itinerary: [
    {
      day: 1,
      title: 'Guwahati to Shillong',
      overnight: 'Shillong',
      stops: [
        '05:00 AM — pickup from Guwahati',
        'Visit Kamakhya Temple',
        'Proceed towards Shillong',
        'Visit Umiam Lake',
        'Visit Elephant Falls',
        'Visit the Air Force Museum, subject to operating hours',
        'Evening arrival and check-in at Shillong',
      ],
    },
    {
      day: 2,
      title: 'Shillong to Cherrapunji sightseeing',
      overnight: 'Shillong',
      stops: [
        'Early breakfast and departure from the hostel',
        'Proceed towards Cherrapunji',
        'Visit Nohkalikai Falls',
        'Visit the Seven Sisters Falls viewpoint',
        'Visit Mawsmai Cave, subject to available time',
        'Explore nearby scenic viewpoints, depending on time',
      ],
    },
    {
      day: 3,
      title: 'Shillong to Jowai to Shillong',
      overnight: 'Shillong',
      stops: [
        '06:30 AM — breakfast and departure from the hostel',
        'Proceed towards Jowai',
        'Visit Phe Phe Falls',
        'Visit Krang Suri Falls',
        'Time at the waterfalls and the surrounding scenery',
        'Proceed towards Shillong',
        'Evening arrival back at the hostel',
      ],
    },
    {
      day: 4,
      title: 'Shillong to Guwahati departure',
      overnight: null,
      stops: [
        'Breakfast and checkout from Shillong',
        'Proceed towards Guwahati',
        'Visit an Assam tea estate, subject to availability and prior permission',
        'Brahmaputra river cruise, subject to the sailing schedule and availability',
        'Drop at Guwahati railway station or airport',
      ],
    },
  ],
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
