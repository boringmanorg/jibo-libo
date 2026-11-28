import { z } from 'zod';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { CAMP, CAMP_PLANS } from '@/data/shnonpedengCamp';
import { BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '@/data/hostelPolicies';
import { BISTRO_HOURS_SENTENCE } from '@/data/tabBistroHours';

export const CHECK_IN_POLICY_VERSION = '2026-11-28';
export const MAX_CHECK_IN_FILE_BYTES = 8 * 1024 * 1024;
export const CHECK_IN_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export const CHECK_IN_PROPERTIES = [
  { id: 'XTSY-SHL-HOSTEL', name: 'XTSY Travellers Hostel', location: 'New Shillong Township, Meghalaya' },
  { id: 'XTSY-SHN-CAMP', name: CAMP.name, location: 'Shnonpedeng, Meghalaya' },
] as const;
export type CheckInPropertyId = (typeof CHECK_IN_PROPERTIES)[number]['id'];

export const CHECK_IN_PURPOSES = ['Leisure', 'Backpacking', 'Workation', 'Business', 'Family visit', 'Event or wedding', 'Other'] as const;

export interface RoomPreference { id: string; name: string; detail: string }
export function roomPreferences(propertyId: CheckInPropertyId): RoomPreference[] {
  if (propertyId === 'XTSY-SHN-CAMP') return [
    { id: CAMP_PLANS.tent.id, name: CAMP_PLANS.tent.title, detail: CAMP_PLANS.tent.line },
    { id: CAMP_PLANS.bed.id, name: CAMP_PLANS.bed.title, detail: CAMP_PLANS.bed.line },
  ];
  return BOOKING_ROOM_TYPES.map((r) => ({
    id: r.id,
    name: r.name,
    detail: `${r.soldAs === 'bed' ? 'Dorm bed' : 'Private room'}${r.femaleOnly ? ' · women only' : ''}${r.descriptor ? ` · ${r.descriptor}` : ''}`,
  }));
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid check-in date.').refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Use a valid check-in date.');
export const checkInDetailsSchema = z.object({
  propertyId: z.enum(['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP']),
  bookingReference: z.string().trim().max(20).refine((v) => !v || /^XTSY-[A-Z0-9-]{3,16}$/i.test(v), 'Check the booking reference.').optional().default(''),
  guestName: z.string().trim().min(2, 'Enter the lead guest’s full name.').max(120),
  checkInDate: isoDate,
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter the arrival time.'),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20).refine((v) => (v.match(/\d/g)?.length ?? 0) >= 10, 'Enter a phone number with country code.'),
  email: z.string().trim().email().max(160),
  totalGuests: z.number().int().min(1).max(60),
  purpose: z.enum(CHECK_IN_PURPOSES),
  isInternational: z.boolean(),
  roomTypeId: z.string().trim().min(1, 'Choose a room or bed preference.').max(80),
  policyAccepted: z.literal(true),
  policyVersion: z.literal(CHECK_IN_POLICY_VERSION),
});
export type CheckInDetails = z.infer<typeof checkInDetailsSchema>;

export function validateCheckInDetails(input: unknown): CheckInDetails {
  const data = checkInDetailsSchema.parse(input);
  if (!roomPreferences(data.propertyId).some((r) => r.id === data.roomTypeId)) throw new Error('Choose a room type offered by this property.');
  return data;
}

export interface PolicySection { title: string; lines: string[] }
export function checkInPolicies(propertyId: CheckInPropertyId): PolicySection[] {
  const hostel = propertyId === 'XTSY-SHL-HOSTEL';
  return [
    { title: 'Arrival and identity', lines: [
      hostel ? `Check-in is from ${HOSTEL_POLICIES.checkIn}; check-out is strictly by ${HOSTEL_POLICIES.checkOut}.` : 'Confirm your camp arrival and departure times with the XTSY desk before travelling.',
      'Bring the original identity document used here. The lead guest’s name must match the document. International travellers must carry their passport and valid visa or other permitted entry document.',
      'This form records your arrival request. The front desk verifies documents and allocates the actual room, bed or tent; your preference is not an allocation.',
    ] },
    { title: hostel ? 'Dorms and private rooms' : 'Tents and shared spaces', lines: hostel ? [
      'One guest per dorm bed. The 6-bed and 8-bed dorms are mixed; the 4-bed deluxe dorm is women only and every occupant must be female.',
      'Do not exceed room capacity or bring unauthorised visitors into dorms or private rooms. Experience by XTSY and private rooms are limited to the booked occupancy.',
      `Quiet hours are ${HOSTEL_POLICIES.quietHours}. Use headphones, keep calls and voices low, secure valuables and follow staff instructions.`,
    ] : [
      'A full tent sleeps two. A bed space is in a shared two-person tent. Do not exceed tent capacity or bring unauthorised visitors into tents.',
      'Respect other campers, the riverbank and local residents. Follow staff instructions around the river, bonfire and shared facilities.',
      'Keep valuables secure and ask the desk about Wi-Fi availability; the hostel Wi-Fi password does not apply at the camp.',
    ] },
    { title: 'Conduct and property rules', lines: [
      'Treat staff, guests and neighbours with respect. Illegal activity, harassment, damage and unsafe conduct are not permitted.',
      'Do not smoke in non-smoking areas. Declare pets before arrival; pets require the desk’s approval and are allowed only in suitable accommodation.',
      'Violating property rules can lead to immediate expulsion without refund, plus charges for damage.',
    ] },
    { title: 'Cancellation and payment', lines: [BOOKING_POLICY_TEXT.cancellation, BOOKING_POLICY_TEXT.dateChange, BOOKING_POLICY_TEXT.payment] },
    { title: hostel ? 'Wi-Fi and TAB Bistro' : 'Meals and facilities', lines: hostel ? [
      'Wi-Fi password: xtsy.one',
      BISTRO_HOURS_SENTENCE,
      'TAB Bistro is at XTSY Travellers Hostel in New Shillong. Breakfast can be added to a stay; lunch is preorder only.',
    ] : [
      CAMP.mealsNote,
      'TAB Bistro is at the New Shillong hostel and does not operate the camp kitchen.',
      'Ask the XTSY desk about available camp facilities before arrival.',
    ] },
    { title: 'Privacy consent', lines: [
      'I consent to XTSY securely storing and using these details and documents to verify arrival, allocate my stay, provide guest support and meet legal or safety requirements.',
      'Documents are private. Only authorised admin/front-desk staff and I, using my private submission link, can view or download them.',
    ] },
  ];
}

export function clientFileProblem(file: File | null, required = true): string | null {
  if (!file) return required ? 'Choose this document.' : null;
  if (file.size <= 0 || file.size > MAX_CHECK_IN_FILE_BYTES) return 'Each document must be between 1 byte and 8 MB.';
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) return 'Use a JPG, PNG, WebP or PDF document.';
  return null;
}
