import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, respond } from '../src/lib/travel/assistant';

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
});