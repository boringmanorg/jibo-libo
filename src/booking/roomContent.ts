/**
 * What the booking page shows for each room type: photos and one factual line.
 * Photos reuse the site's existing room galleries. The triple room has no photos yet, so it shows
 * none rather than another room's picture. Lines describe only what the catalogue states.
 */
import { ROOM_IMAGES } from '@/config/roomTypes';

export interface RoomContent { images: string[]; blurb: string }

const gallery = (key: string): string[] => ROOM_IMAGES[key] ?? [];

export const ROOM_CONTENT: Record<string, RoomContent> = {
  'bed-in-8-bed-mixed-dormitory': {
    images: gallery('8-bed-mixed-dorm'),
    blurb: 'One bed in a mixed dormitory of eight.',
  },
  'bed-in-6-bed-standard-dormitory': {
    images: gallery('6-bed-mixed-dorm'),
    blurb: 'One bed in a six-bed dormitory. This dorm has no lockers.',
  },
  'bed-in-6-bed-mixed-dormitory': {
    images: gallery('6-bed-mixed-dorm'),
    blurb: 'One bed in a six-bed mixed dormitory.',
  },
  'bed-in-4-bed-female-deluxe-dormitory': {
    images: gallery('4-bed-female-only-dorm'),
    blurb: 'One bed in a four-bed deluxe dormitory for female guests only.',
  },
  'king-room-with-mountain-view': {
    images: gallery('king-double-room'),
    blurb: 'Private room with a king bed and a mountain view, for up to 2 guests.',
  },
  'triple-room-with-mountain-view': {
    images: [],
    blurb: 'Private room with a mountain view, for up to 3 guests.',
  },
  'experience-by-xtsy': {
    images: gallery('xtsy-270'),
    blurb: 'Our premium glass suite for couples, with a queen bed and an ensuite washroom. Sky visibility through the UV-treated glass depends on the weather and is not guaranteed.',
  },
};

export const roomContent = (id: string): RoomContent => ROOM_CONTENT[id] ?? { images: [], blurb: '' };
