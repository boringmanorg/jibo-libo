/** "Know before you go": shown before guest details. Only owner-stated facts. */
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';

export interface HouseRule { label: string; value: string }

export const HOUSE_RULES: readonly HouseRule[] = [
  { label: 'Check-in', value: `From ${HOSTEL_POLICIES.checkIn}` },
  { label: 'Check-out', value: `By ${HOSTEL_POLICIES.checkOut}` },
  { label: 'Quiet hours', value: HOSTEL_POLICIES.quietHours },
  { label: 'Pets', value: 'Cats and birds welcome; dogs depending on breed and size. Ask the desk about any extra charges.' },
  { label: 'Food', value: 'TAB Bistro on the property. Breakfast can be added to your booking.' },
  { label: 'Payment', value: BOOKING_POLICY_TEXT.payment },
  { label: 'Cancellation', value: BOOKING_POLICY_TEXT.cancellation },
];
