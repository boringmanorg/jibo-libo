import { describe, expect, it } from 'vitest';
import { BOOKING_ROOM_TYPES } from '@/booking/catalogue';
import { channelNotConnected } from '@/booking/channel/channelManager';
import { canTakeLiveBookings, launchBlockers, type LaunchState } from '@/booking/launchGate';

const ids = BOOKING_ROOM_TYPES.map((r) => r.id);
const ready: LaunchState = { switchedOn: true, gatewayConfigured: true, botProtection: true, channelConnected: true, unmappedRoomTypes: [], feeTableProblems: [], databaseReady: true };

describe('no channel manager connected', () => {
  it('reports not connected, lists the unlinked rooms and acknowledges nothing', async () => {
    const ch = channelNotConnected(ids);
    expect(ch).toMatchObject({ id: 'zimmerstack', connected: false, unmapped: ids });
    expect(await ch.pushReservation({ reference: 'XTSY-1', status: 'confirmed', checkIn: '2026-12-01', checkOut: '2026-12-02', rooms: [], guestName: 'A', total: 0, paid: 0 }))
      .toMatchObject({ acknowledged: false });
  });
});

describe('launch gate', () => {
  it('takes live bookings only when everything is ready', () => {
    expect(canTakeLiveBookings(ready)).toBe(true);
  });
  it('stays on WhatsApp enquiries while no channel manager is connected, even with the switch on', () => {
    expect(canTakeLiveBookings({ ...ready, channelConnected: false })).toBe(false);
    expect(launchBlockers({ ...ready, channelConnected: false })).toEqual(['No channel manager or PMS is connected.']);
  });
  it('names every blocker today', () => {
    expect(launchBlockers({ switchedOn: false, gatewayConfigured: false, botProtection: false, channelConnected: false, unmappedRoomTypes: ids, feeTableProblems: [], databaseReady: false })).toHaveLength(6);
  });
});
