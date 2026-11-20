/**
 * RATE SANITY CHECK
 * Single source of truth for canonical Shillong rates. Run this on
 * every booking step to ensure UI prices match the inventory module.
 *
 * If any room has drifted from canonical pricing, we log a warning and
 * return the canonical figure — the UI must always show the latest.
 */

import { ROOM_INVENTORY } from '@/data/roomInventory';
import { ENGINE_ROOM_ID, publicRate } from '@/data/publicRates';

// Canonical published rates for Shillong: nightly, before GST (booking-engine catalogue).
export const SHILLONG_CANONICAL_RATES: Record<string, number> = Object.fromEntries(
  Object.keys(ENGINE_ROOM_ID).map((id) => [id, publicRate(id)]),
);

/**
 * Returns the canonical price for a room. If inventory has drifted,
 * a console warning is logged so devs can spot the regression.
 */
export function getCanonicalRate(roomId: string): number {
  const canonical = SHILLONG_CANONICAL_RATES[roomId];
  if (canonical === undefined) return ROOM_INVENTORY[roomId]?.basePrice ?? 0;

  const inventoryPrice = ROOM_INVENTORY[roomId]?.basePrice;
  if (inventoryPrice !== undefined && inventoryPrice !== canonical) {
    console.warn(
      `[RateSanityCheck] Drift detected for ${roomId}: inventory=${inventoryPrice}, canonical=${canonical}. Using canonical.`,
    );
  }
  return canonical;
}

/**
 * Verify a single price matches canonical. Returns canonical price.
 */
export function verifyRate(roomId: string, displayedPrice: number): number {
  const canonical = getCanonicalRate(roomId);
  if (displayedPrice !== canonical) {
    console.warn(
      `[RateSanityCheck] UI showing ₹${displayedPrice} for ${roomId} but canonical is ₹${canonical}.`,
    );
  }
  return canonical;
}

/**
 * Rooms that include complimentary breakfast in the published rate.
 * Used by room cards and booking summary to surface the inclusion.
 */
export const ROOMS_WITH_COMPLIMENTARY_BREAKFAST: Record<string, string> = {};

export function getBreakfastInclusion(roomId: string): string | null {
  return ROOMS_WITH_COMPLIMENTARY_BREAKFAST[roomId] ?? null;
}
