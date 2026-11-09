import { ROOM_TYPES } from '@/config/roomTypes';
import type { CatalogueRoom } from '@/utils/bookingCatalogue';

/** Enquiries finish on WhatsApp; references are made in the browser so no backend call can block a guest. */
export function localEnquiryRef(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return 'XTSY-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Bookable room catalogue served from the static owner-approved price list. */
export function staticRoomCatalogue(): CatalogueRoom[] {
  return Object.values(ROOM_TYPES).map((r) => ({ id: r.id, name: r.name, base_price: r.basePrice, is_active: r.isBookable }));
}
