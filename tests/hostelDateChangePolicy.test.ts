import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOKING_POLICY_ANSWER, BOOKING_POLICY_TEXT, HOSTEL_POLICIES } from '../src/data/hostelPolicies';

/**
 * Owner-approved booking policy, 19 Nov 2026:
 * no refund on guest cancellation for any reason; one date change, requested at least
 * 14 days before check-in; none within 14 days; 25% advance, 75% at check-in.
 */
describe('owner-approved booking policy', () => {
  it('holds the 14-day cutoff, one change and the 25/75 split', () => {
    expect(HOSTEL_POLICIES.modificationCutoffDays).toBe(14);
    expect(HOSTEL_POLICIES.modificationsAllowed).toBe(1);
    expect(HOSTEL_POLICIES.advancePercent).toBe(25);
    expect(HOSTEL_POLICIES.balancePercent).toBe(75);
  });

  it('says it in one wording', () => {
    expect(BOOKING_POLICY_TEXT.cancellation).toContain('for any reason');
    expect(BOOKING_POLICY_TEXT.dateChange).toContain('at least 14 days before check-in');
    expect(BOOKING_POLICY_TEXT.dateChange).toContain('No changes within 14 days');
    expect(BOOKING_POLICY_ANSWER).toContain('25% advance');
  });

  it.each(['llms.txt', 'llms-full.txt'])('publishes the 14-day rule and 25%% advance in %s', (file) => {
    const content = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    expect(content).toContain('at least 14 days before check-in');
    expect(content).toContain('25% advance');
  });

  // The superseded wording must not come back on any page, FAQ, schema or AI file.
  const RETIRED = [
    /within 15 days (?:of|from) (?:the )?original check-in/i,
    /date change (?:is )?(?:allowed )?within 15 days/i,
    /dates? once within 15 days/i,
    /at least 48 hours(?:’|')? (?:before|notice)/i,
    /free (?:cancellation )?up to 48 ?h/i,
    /no advance payment required/i,
    /real-time availability[^.]{0,20}(?:no overbooking|instant booking)|book instantly with real-time/i,
  ];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|txt)$/.test(name)) files.push(full);
    }
  };
  walk('src');
  files.push('public/llms.txt', 'public/llms-full.txt');

  it.each(RETIRED.map((r) => [r.source, r] as const))('no file still says /%s/', (_label, pattern) => {
    const hits = files.filter((f) => !f.endsWith('routeTree.gen.ts') && pattern.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
