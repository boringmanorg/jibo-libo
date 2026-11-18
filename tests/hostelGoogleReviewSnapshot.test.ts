import { describe, expect, it } from 'vitest';
import { hostelGoogleReviewSnapshot as snapshot } from '../src/data/hostelGoogleReviewSnapshot';

describe('Complete hostel Google snapshot', () => {
  it('preserves all 253 unique reviews returned across six Google pages', () => {
    expect(snapshot.total).toBe(253);
    expect(snapshot.reviews).toHaveLength(253);
    expect(new Set(snapshot.reviews.map((r) => r.reviewId)).size).toBe(253);
    expect(snapshot.reviews.every((r) => r.property === 'XTSY Travellers Hostel' && r.source === 'Google')).toBe(true);
  });
  it('keeps 203 written reviews and 50 rating-only entries without fabricated words', () => {
    expect(snapshot.reviews.filter((r) => r.comment.trim())).toHaveLength(203);
    expect(snapshot.reviews.filter((r) => !r.comment.trim())).toHaveLength(50);
  });
  it('retains all 236 owner replies and low-rated feedback', () => {
    expect(snapshot.reviews.filter((r) => 'ownerReply' in r)).toHaveLength(236);
    expect(snapshot.reviews.find((r) => r.name === 'Anju Subba')).toMatchObject({ rating: 3, comment: '' });
    expect(snapshot.reviews.find((r) => r.name === 'Nupur Kothari')).toMatchObject({ ownerReply: 'Thanks for your valuable feedback ❤️😍' });
  });
});