import { describe, it, expect } from 'vitest';
import { INITIAL_STATE, respond } from '@/lib/travel/assistant';
import { STARGAZING_NOTICE, STARGAZING_ACK_LABEL } from '@/data/stargazingPolicy';

const ask = (q: string) => respond(q, INITIAL_STATE).reply;

describe('stargazing policy', () => {
  it('states every part of the owner position', () => {
    for (const fragment of ["don't promote or promise", 'UV-treated', '30%', "don't book or enquire"]) {
      expect(STARGAZING_NOTICE).toContain(fragment);
    }
    expect(STARGAZING_ACK_LABEL).toMatch(/not promised/i);
  });

  // Asking about stars used to fall through to the generic "didn't catch that",
  // and the suite was promoted twice with a price and no caveat.
  it('answers any stargazing question with the notice, never an itinerary', () => {
    for (const q of [
      'can I see stars at Experience by XTSY',
      'is stargazing guaranteed',
      'will we see the milky way',
      'how is the night sky from the glass suite',
    ]) {
      const r = ask(q);
      expect(r.text, q).toBe(STARGAZING_NOTICE);
      expect((r as { plan?: unknown }).plan, q).toBeUndefined();
    }
  });
});

describe('brand facts the assistant used to get wrong', () => {
  it('answers live music instead of returning a trip plan', () => {
    const r = ask('do you have live music at the hostel');
    expect(r.text).toMatch(/pre-booked/i);
    expect((r as { plan?: unknown }).plan).toBeUndefined();
  });

  it('knows the bonfire runs nightly for in-house guests', () => {
    expect(ask('do you have a bonfire').text).toMatch(/every night.*in-house/i);
  });
});

describe('date-change policy', () => {
  it('quotes the 15-day window, not the old 90', () => {
    for (const q of ['what is your cancellation policy', 'can I change my dates', 'can I reschedule my booking']) {
      const t = ask(q).text ?? '';
      expect(t, q).toContain('15 days');
      expect(t, q).not.toContain('90 days');
    }
  });
});

describe('planning still works', () => {
  it('still builds an itinerary for a real trip request', () => {
    expect((ask('5 days in Meghalaya with Dawki') as { plan?: unknown }).plan).toBeDefined();
  });
});
