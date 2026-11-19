/** Published hostel terms shared by guest information pages. Owner-approved 19 Nov 2026. */
export const HOSTEL_POLICIES = {
  checkIn: '11 AM',
  checkOut: '10 AM',
  quietHours: '10 PM – 7 AM',
  /** A date change must be requested at least this many days before check-in. */
  modificationCutoffDays: 14,
  modificationsAllowed: 1,
  advancePercent: 25,
  balancePercent: 75,
} as const;

/** One wording for the booking policy everywhere a guest reads it. */
export const BOOKING_POLICY_TEXT = {
  cancellation: 'No refund on cancellation, for any reason. No-shows count as cancellations.',
  dateChange: `One date change per booking, requested at least ${HOSTEL_POLICIES.modificationCutoffDays} days before check-in, subject to availability and any rate difference. No changes within ${HOSTEL_POLICIES.modificationCutoffDays} days of check-in.`,
  payment: `A ${HOSTEL_POLICIES.advancePercent}% advance confirms the booking; the remaining ${HOSTEL_POLICIES.balancePercent}% is paid at check-in.`,
  /** For tables and short lists. */
  short: `Non-refundable; one date change up to ${HOSTEL_POLICIES.modificationCutoffDays} days before check-in`,
} as const;

/** The full answer to "can I cancel or change my booking?". */
export const BOOKING_POLICY_ANSWER = `${BOOKING_POLICY_TEXT.cancellation} ${BOOKING_POLICY_TEXT.dateChange} ${BOOKING_POLICY_TEXT.payment}`;
