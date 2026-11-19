/**
 * The channel manager is the master copy of availability, rates and restrictions (STAAH).
 * The engine reads ARI from it and sends confirmed bookings back. Implementations are server-only.
 */
import type { IsoDate } from '../dates';
import type { Paise } from '../money';

export interface NightAri {
  roomTypeId: string;
  night: IsoDate;
  available: number;
  rate: Paise;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
}

export interface ChannelReservation {
  reference: string;
  status: 'confirmed' | 'modified' | 'cancelled';
  checkIn: IsoDate;
  checkOut: IsoDate;
  rooms: { roomTypeId: string; units: number; guests: number; nightlyRates: Paise[] }[];
  guestName: string;
  total: Paise;
  paid: Paise;
}

export interface ChannelManager {
  id: 'staah';
  /** False until STAAH enables ChannelConnect for this property and the credentials are saved. */
  connected: boolean;
  getAri(roomTypeIds: string[], from: IsoDate, to: IsoDate): Promise<NightAri[]>;
  /** Sends a new, changed or cancelled booking. Idempotent on `reference`. */
  pushReservation(r: ChannelReservation): Promise<{ acknowledged: boolean; channelId?: string }>;
}

/** Each engine room type must map to one STAAH room code and one rate code before launch. */
export interface ChannelMapping { roomTypeId: string; roomCode: string; rateCode: string }

export function unmappedRoomTypes(roomTypeIds: string[], mapping: ChannelMapping[]): string[] {
  return roomTypeIds.filter((id) => {
    const m = mapping.find((x) => x.roomTypeId === id);
    return !m || !m.roomCode.trim() || !m.rateCode.trim();
  });
}

/** True when the night cannot be sold for this stay, whatever the count says. */
export function ariBlocksStay(n: NightAri, opts: { isArrival: boolean; isDeparture: boolean; stayNights: number }): boolean {
  if (n.stopSell || n.available <= 0) return true;
  if (opts.isArrival && n.closedToArrival) return true;
  if (opts.isArrival && n.minStay && opts.stayNights < n.minStay) return true;
  if (opts.isArrival && n.maxStay && opts.stayNights > n.maxStay) return true;
  return false;
}
