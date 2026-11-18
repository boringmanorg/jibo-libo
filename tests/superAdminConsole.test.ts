import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { rangeHitsBlock, staticTableSlots } from '@/admin/slots';
import { SUPER_ADMIN } from '@/admin/adminAuth';

describe('super admin console rules', () => {
  it('only admin@xtsy.one is the super admin', () => {
    expect(SUPER_ADMIN).toBe('admin@xtsy.one');
  });
  it('a stay overlapping a blocked range is blocked; checkout on the block start is not', () => {
    expect(rangeHitsBlock('2026-12-20', '2026-12-22', '2026-12-21', '2026-12-21')).toBe(true);
    expect(rangeHitsBlock('2026-12-18', '2026-12-21', '2026-12-21', '2026-12-23')).toBe(false);
    expect(rangeHitsBlock('2026-12-24', '2026-12-25', '2026-12-21', '2026-12-23')).toBe(false);
  });
  it('table board only offers Bistro service times (08:45–11:45, 17:00–22:30)', () => {
    const slots = staticTableSlots();
    expect(slots[0]).toBe('08:45');
    expect(slots).toContain('22:30');
    expect(slots).not.toContain('13:00');
    expect(slots).not.toContain('22:45');
  });
  it('console never imports the platform-generated database helpers', () => {
    const src = readFileSync('src/admin/console.functions.ts', 'utf8');
    expect(src).not.toMatch(/supabase\/client\.server|auth-middleware/);
  });
});
