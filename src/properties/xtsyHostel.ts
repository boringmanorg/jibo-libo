/**
 * XTSY Travellers Hostel, New Shillong: the room types /book sells. Owner-confirmed 19 Nov 2026.
 * Edit this property here only; other properties live in their own files under src/properties/.
 */
import { rupees } from '@/booking/money';
import type { BookingRoomType } from '@/booking/catalogue';

export const HOSTEL_ID = 'XTSY-SHL-HOSTEL';

const beds = (prefixes: string[]) => prefixes.flatMap((p) => ['A', 'B', 'C', 'D', 'E', 'F'].map((l) => `${p}${l}`));

export const HOSTEL_ROOM_TYPES: readonly BookingRoomType[] = [
  {
    id: 'bed-in-8-bed-mixed-dormitory', name: 'Bed in 8 Bed Mixed Dormitory',
    soldAs: 'bed', units: 8, rate: rupees(400), maxGuestsPerUnit: 1, femaleOnly: false,
    floorRooms: ['8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H'],
  },
  {
    id: 'bed-in-6-bed-standard-dormitory', name: 'Bed in 6 Bed Standard Dormitory', descriptor: 'Without lockers',
    soldAs: 'bed', units: 14, rate: rupees(450), maxGuestsPerUnit: 1, femaleOnly: false,
  },
  {
    id: 'bed-in-6-bed-mixed-dormitory', name: 'Bed in 6 Bed Mixed Dormitory',
    soldAs: 'bed', units: 18, rate: rupees(500), maxGuestsPerUnit: 1, femaleOnly: false,
    floorRooms: beds(['4', '5', '7']),
  },
  {
    id: 'bed-in-4-bed-female-deluxe-dormitory', name: 'Bed in 4 Bed Female Deluxe Dormitory',
    soldAs: 'bed', units: 2, rate: rupees(600), maxGuestsPerUnit: 1, femaleOnly: true,
  },
  {
    id: 'king-room-with-mountain-view', name: 'King Room with Mountain View',
    soldAs: 'room', units: 2, rate: rupees(2400), maxGuestsPerUnit: 2, femaleOnly: false,
  },
  {
    id: 'triple-room-with-mountain-view', name: 'Triple Room with Mountain View',
    soldAs: 'room', units: 1, rate: rupees(3000), maxGuestsPerUnit: 3, femaleOnly: false,
  },
  {
    id: 'experience-by-xtsy', name: 'Experience by XTSY', descriptor: 'Premium Couple Ensuite',
    soldAs: 'room', units: 1, rate: rupees(4999), maxGuestsPerUnit: 2, femaleOnly: false,
    floorRooms: ['666'],
  },
] as const;

