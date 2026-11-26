/**
 * The channel manager the booking engine sends to (ZimmerStack, src/booking/channel/zimmerstack.server.ts).
 *
 * XTSY's booking engine is the source of truth: room counts come from the owner's Google Sheet and
 * the console, and are sent to the channel manager, which passes them to the OTAs. OTA bookings come
 * back by signed webhook. A future XTSY PMS connects to this booking engine, never straight to the
 * channel manager, so each hotel has exactly one writer.
 */
import type { IsoDate } from '../dates';
import type { Paise } from '../money';

/** A website booking sent to the channel manager, so the OTAs stop selling those rooms. */
export interface ChannelReservation {
  reference: string;
  status: 'confirmed' | 'modified' | 'cancelled';
  checkIn: IsoDate;
  checkOut: IsoDate;
  rooms: { roomTypeId: string; units: number; guests: number; nightlyRates: Paise[] }[];
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  total: Paise;
  paid: Paise;
}

export interface ChannelManager {
  id: 'zimmerstack';
  /** True once the property is switched on in the console and linked to a ZimmerStack hotel. */
  connected: boolean;
  /** Engine room types not yet linked to a ZimmerStack room type and rate plan. */
  unmapped: string[];
  /** Sends a website booking. Idempotent on `reference`. */
  pushReservation(r: ChannelReservation): Promise<{ acknowledged: boolean; channelId?: string; detail?: string }>;
}

/** No channel manager: the engine stays on WhatsApp enquiries (launchGate). */
export function channelNotConnected(unmapped: string[] = [], detail = 'No channel manager is connected.'): ChannelManager {
  return {
    id: 'zimmerstack',
    connected: false,
    unmapped,
    pushReservation: async () => ({ acknowledged: false, detail }),
  };
}
