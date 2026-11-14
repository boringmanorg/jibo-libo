import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOSTEL_POLICIES } from '../src/data/hostelPolicies';

describe('owner-approved date-change window', () => {
  it('allows date modification within 15 days in shared guest policies', () => {
    expect(HOSTEL_POLICIES.modificationDays).toBe(15);
  });

  it.each(['llms.txt', 'llms-full.txt'])('publishes only the 15-day window in %s', (file) => {
    const content = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    const windows = [...content.matchAll(/(?:date change is allowed|change your dates once) within (\d+) days/g)]
      .map((match) => Number(match[1]));
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((days) => days === 15)).toBe(true);
  });
});