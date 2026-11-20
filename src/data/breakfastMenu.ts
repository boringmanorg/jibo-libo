/**
 * Breakfast add-on for stays: guests pick TAB Bistro breakfast dishes and beverages from the
 * printed menu (owner, 20 Nov 2026) instead of a fixed per-person breakfast price.
 * Derived from tabBistroMenu.ts so a menu price change reaches the booking page automatically.
 * Prices are rupees, before GST. Browser-safe; the server uses the same list to price bookings.
 */
import { menuSections } from './tabBistroMenu';

export interface BreakfastItem {
  id: string;
  name: string;
  /** Rupees, before GST. */
  price: number;
  group: 'Breakfast' | 'Beverages';
  category: string;
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Single-price items only; "₹260/₹280/₹340" (sizes) can't be priced without a size choice. */
const rupees = (p: string) => (/^₹\d+$/.test(p.trim()) ? Number(p.trim().slice(1)) : null);

export const BREAKFAST_ITEMS: BreakfastItem[] = menuSections
  .filter((s) => s.id === 'breakfast' || s.id === 'beverages')
  .sort((a, b) => (a.id === 'breakfast' ? -1 : b.id === 'breakfast' ? 1 : 0))
  .flatMap((s) => s.categories.flatMap((c) => c.items.flatMap((i) => {
    const price = rupees(i.price);
    return price === null ? [] : [{ id: slug(i.name), name: i.name, price, group: s.id === 'breakfast' ? 'Breakfast' as const : 'Beverages' as const, category: c.title }];
  })));

const BY_ID = new Map(BREAKFAST_ITEMS.map((i) => [i.id, i]));
export const breakfastItem = (id: string) => BY_ID.get(id);

/** A pick: this many of the item every morning of the stay. */
export interface BreakfastPick { item: string; qty: number }

export const MAX_BREAKFAST_QTY = 20;
