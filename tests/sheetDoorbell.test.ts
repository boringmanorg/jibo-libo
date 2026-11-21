import { describe, expect, it, vi } from 'vitest';
vi.mock('@/admin/adminAuthConfig.functions', () => ({ getAdminAuthConfig: vi.fn() }));
import { subscribeSheetDoorbell } from '@/booking/sheetDoorbell.client';
import type { SupabaseClient } from '@supabase/supabase-js';

function fixture() {
  let broadcast = () => {};
  let status = (_status: string) => {};
  const channel = {
    on: vi.fn((_type: string, _filter: { event: string }, callback: () => void) => { broadcast = callback; return channel; }),
    subscribe: vi.fn((callback: (value: string) => void) => { status = callback; return channel; }),
  };
  const client = { channel: vi.fn(() => channel), removeChannel: vi.fn(async () => 'ok') };
  const ring = vi.fn();
  const close = subscribeSheetDoorbell(client as unknown as Pick<SupabaseClient, 'channel' | 'removeChannel'>, ring);
  return { ring, close, client, broadcast: () => broadcast(), status: (s: string) => status(s) };
}

describe('event-driven sheet availability updates', () => {
  it('does not refresh idle pages; refreshes immediately on a sheet sync', () => {
    const f = fixture();
    expect(f.ring).not.toHaveBeenCalled();
    f.broadcast();
    expect(f.ring).toHaveBeenCalledTimes(1);
    f.close();
  });
  it('catches up on initial subscription and reconnection, not connection errors', () => {
    const f = fixture();
    f.status('SUBSCRIBED');
    f.status('CHANNEL_ERROR');
    f.status('SUBSCRIBED');
    expect(f.ring).toHaveBeenCalledTimes(2);
    f.close();
  });
  it('removes the listener and ignores late events after leaving the page', () => {
    const f = fixture();
    f.close();
    f.broadcast();
    f.status('SUBSCRIBED');
    expect(f.client.removeChannel).toHaveBeenCalledTimes(1);
    expect(f.ring).not.toHaveBeenCalled();
  });
});