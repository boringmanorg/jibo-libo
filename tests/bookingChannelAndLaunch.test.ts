import { describe, expect, it } from 'vitest';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { ariBlocksStay, unmappedRoomTypes } from '@/booking/channel/channelManager';
import { staahNotConnected } from '@/booking/channel/staah.server';
import { canTakeLiveBookings, launchBlockers, type LaunchState } from '@/booking/launchGate';

const ids = BOOKING_ROOM_TYPES.map((r) => r.id);
const ready: LaunchState = { switchedOn: true, gatewayConfigured: true, botProtection: true, channelConnected: true, unmappedRoomTypes: [], feeTableProblems: [], databaseReady: true };

describe('STAAH mapping', () => {
  it('lists every room type with no STAAH room or rate code', () => {
    expect(unmappedRoomTypes(ids, [{ roomTypeId: 'experience-by-xtsy', roomCode: 'R7', rateCode: 'RO' }])).toHaveLength(6);
    expect(unmappedRoomTypes(['experience-by-xtsy'], [{ roomTypeId: 'experience-by-xtsy', roomCode: 'R7', rateCode: ' ' }])).toEqual(['experience-by-xtsy']);
  });
});

describe('STAAH restrictions', () => {
  const night = { roomTypeId: 'experience-by-xtsy', night: '2026-12-01', available: 1, rate: 499900 };
  it('stops a sale on stop-sell, zero availability, closed arrival or too short a stay', () => {
    const arrive = { isArrival: true, isDeparture: false, stayNights: 1 };
    expect(ariBlocksStay({ ...night, stopSell: true }, arrive)).toBe(true);
    expect(ariBlocksStay({ ...night, available: 0 }, arrive)).toBe(true);
    expect(ariBlocksStay({ ...night, closedToArrival: true }, arrive)).toBe(true);
    expect(ariBlocksStay({ ...night, minStay: 2 }, arrive)).toBe(true);
    expect(ariBlocksStay(night, arrive)).toBe(false);
  });
});

describe('STAAH until ChannelConnect access', () => {
  it('reports not connected and refuses to sell', async () => {
    const staah = staahNotConnected();
    expect(staah.connected).toBe(false);
    await expect(staah.getAri(ids, '2026-12-01', '2026-12-02')).rejects.toThrow(/not connected/);
  });
});

describe('launch gate', () => {
  it('takes live bookings only when everything is ready', () => {
    expect(canTakeLiveBookings(ready)).toBe(true);
  });
  it('stays on WhatsApp enquiries while STAAH is not connected, even with the switch on', () => {
    expect(canTakeLiveBookings({ ...ready, channelConnected: false })).toBe(false);
    expect(launchBlockers({ ...ready, channelConnected: false })).toEqual(['STAAH is not connected.']);
  });
  it('names every blocker today', () => {
    expect(launchBlockers({ switchedOn: false, gatewayConfigured: false, botProtection: false, channelConnected: false, unmappedRoomTypes: ids, feeTableProblems: [], databaseReady: false })).toHaveLength(6);
  });
});
