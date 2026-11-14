import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, recommendStay, respond } from '../src/lib/travel/assistant';
import { PLACE_BY_ID } from '../src/lib/travel/places';

describe('trip assistant question routing', () => {
  it.each([
    'Can I change my booking dates?',
    'Can I move my reservation to next week?',
    'Can I change my booking within 15 days?',
    'Can I reschedule my booking?',
  ])('routes %s to the unchanged cancellation answer', (question) => {
    const { reply, state } = respond(question, INITIAL_STATE);
    expect(reply.text).toContain('once within 15 days');
    expect(reply.text).toContain('at least 48 hours before');
    expect(reply.text).toContain('non-refundable');
    expect(reply.plan).toBeUndefined();
    expect(state.hasPlan).toBe(false);
  });

  it.each([
    'What is the weather in Shillong tomorrow?',
    'Is it raining in Dawki right now?',
    'What is the forecast for Meghalaya?',
    'Will it rain in Shillong this weekend?',
  ])('discloses unavailable live weather for %s', (question) => {
    const { reply } = respond(question, INITIAL_STATE);
    expect(reply.text).toContain('don’t have access to a live weather forecast');
    expect(reply.text).toContain('not a forecast for today or tomorrow');
    expect(reply.plan).toBeUndefined();
  });

  it('preserves seasonal planning answers', () => {
    expect(respond('What is the best time to visit Meghalaya?', INITIAL_STATE).reply.text)
      .toContain('October');
  });

  it('preserves day-by-day trip requests', () => {
    expect(respond('5 days in Meghalaya for 4 friends in December', INITIAL_STATE).reply.plan?.input.days)
      .toBe(5);
  });

  it('matches social backpackers to dorms before offering a local stay', () => {
    expect(recommendStay('Recommend a social hostel in Shillong', PLACE_BY_ID.shillong))
      .toMatchObject({ kind: 'dorm', offer: true });
  });
  it('prioritises privacy over a dorm for a solo woman wanting her own room', () => {
    expect(recommendStay('Recommend a stay for a solo woman wanting a private room'))
      .toMatchObject({ kind: 'private' });
  });
  it('does not offer New Shillong for a city-centre requirement', () => {
    expect(recommendStay('Recommend a hostel near Police Bazar', PLACE_BY_ID.shillong))
      .toMatchObject({ central: true, offer: false });
  });
  it('recommends staying near distant sights rather than returning to the property', () => {
    expect(recommendStay('Where should I stay in Tawang?', PLACE_BY_ID.tawang))
      .toMatchObject({ local: false, offer: false });
    expect(respond('Where should I stay in Tawang?', INITIAL_STATE).reply.actions).toEqual([]);
  });
  it('does not promote the glass suite to a group larger than two', () => {
    expect(recommendStay('Recommend a romantic stay for 4 guests in Shillong', PLACE_BY_ID.shillong))
      .toMatchObject({ kind: 'couple', offer: false });
  });
  it('does not claim verified accessibility', () => {
    expect(recommendStay('Recommend an accessible private stay'))
      .toMatchObject({ accessibility: true, offer: false });
  });
  it('asks for needs instead of promoting a room when preferences are unknown', () => {
    expect(recommendStay('Where should I stay in Shillong?'))
      .toMatchObject({ kind: 'unspecified', offer: false });
  });
  it('answers stay questions containing a length of stay without generating a trip', () => {
    expect(respond('Recommend a private stay in Shillong for 3 nights', INITIAL_STATE).reply.plan)
      .toBeUndefined();
  });
});