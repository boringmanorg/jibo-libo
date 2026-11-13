import { describe, it, expect } from 'vitest';
import { isHiddenPath } from '@/components/FloatingWhatsApp';

describe('FloatingWhatsApp hidden routes', () => {
  // The list used to read '/booking', a route that has never existed, so the
  // button showed through the whole checkout flow.
  it('hides the button across the booking flow', () => {
    for (const p of ['/book', '/book/', '/book/select', '/book/campsite', '/admin', '/admin/anything']) {
      expect(isHiddenPath(p), p).toBe(true);
    }
  });

  // Matching with a bare startsWith('/book') would also swallow this landing
  // page, which is a lead page and wants the WhatsApp CTA.
  it('keeps the button on pages that merely start with the same letters', () => {
    for (const p of ['/book-hostel-shillong', '/bookings-guide', '/administrator-notes', '/']) {
      expect(isHiddenPath(p), p).toBe(false);
    }
  });
});
