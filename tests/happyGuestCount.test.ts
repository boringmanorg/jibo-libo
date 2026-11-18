import { describe, expect, it } from 'vitest';
import { HAPPY_GUESTS } from '../src/data/brandFacts';

describe('confirmed happy guest total', () => {
  it('keeps the owner-confirmed total at 11,116', () => {
    expect(HAPPY_GUESTS.count).toBe(11116);
    expect(HAPPY_GUESTS.display).toBe('11,116');
  });
  it('requires owner confirmation rather than website activity sync', () => {
    expect(HAPPY_GUESTS.updateMode).toBe('owner-confirmed');
  });
});