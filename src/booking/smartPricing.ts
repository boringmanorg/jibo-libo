/**
 * Automatic nightly pricing within owner-set limits. Browser-safe and pure (smartPricing.test.ts).
 * Off for every room type until the super admin switches it on in the console. When on, the price
 * for a night follows how full that room type is, and never leaves the owner's lowest/highest.
 *
 *   ≥ 90% taken → base +25%      ≥ 75% → +15%      ≥ 50% → +5%
 *   under 30% taken and 2 days or less away → base −10%
 *   otherwise → base
 * Then × search demand for the property (src/booking/demandIntent.ts, 0.95–1.10), refreshed only
 * when the super admin presses "Refresh search demand". Always clamped to the owner's limits.
 */
import type { IsoDate } from './dates';
import { daysBetween } from './dates';

export interface SmartRule { roomTypeId: string; enabled: boolean; minRupees: number; maxRupees: number; demandMultiplier?: number }

export function smartMultiplier(occupancy: number, daysOut: number): number {
  if (occupancy >= 0.9) return 1.25;
  if (occupancy >= 0.75) return 1.15;
  if (occupancy >= 0.5) return 1.05;
  if (occupancy < 0.3 && daysOut <= 2) return 0.9;
  return 1;
}

/** Nightly rate in paise. Base rate when there is no rule or it is off. */
export function smartRate(basePaise: number, rule: SmartRule | undefined, free: number, units: number, night: IsoDate, today: IsoDate): number {
  if (!rule?.enabled || units <= 0) return basePaise;
  const occupancy = Math.min(1, Math.max(0, (units - Math.max(0, free)) / units));
  const demand = rule.demandMultiplier && rule.demandMultiplier >= 0.9 && rule.demandMultiplier <= 1.15 ? rule.demandMultiplier : 1;
  const rupees = Math.round((basePaise / 100) * smartMultiplier(occupancy, daysBetween(today, night)) * demand);
  return Math.min(rule.maxRupees, Math.max(rule.minRupees, rupees)) * 100;
}

export function ruleFromRow(row: Record<string, unknown>): SmartRule | null {
  if (typeof row.room_type_id !== 'string') return null;
  const min = Number(row.min_rupees), max = Number(row.max_rupees);
  if (!(min > 0) || !(max >= min)) return null;
  return { roomTypeId: row.room_type_id, enabled: row.enabled === true, minRupees: min, maxRupees: max };
}
