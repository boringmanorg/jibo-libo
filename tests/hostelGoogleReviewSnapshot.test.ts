import { describe, expect, it } from 'vitest';
import { hostelGoogleReviewSnapshot as snapshot } from '../src/data/hostelGoogleReviewSnapshot';

describe('Complete hostel Google snapshot', () => {
  it('preserves all 256 unique reviews returned across six Google pages', () => {
    expect(snapshot.total).toBe(256);
    expect(snapshot.reviews).toHaveLength(256);
    expect(new Set(snapshot.reviews.map((r) => r.reviewId)).size).toBe(256);
    expect(snapshot.reviews.every((r) => r.property === 'XTSY Travellers Hostel' && r.source === 'Google')).toBe(true);
  });
  it('keeps 206 written reviews and 50 rating-only entries without fabricated words', () => {
    expect(snapshot.reviews.filter((r) => r.comment.trim())).toHaveLength(206);
    expect(snapshot.reviews.filter((r) => !r.comment.trim())).toHaveLength(50);
  });
  it('retains all 239 owner replies and low-rated feedback', () => {
    expect(snapshot.reviews.filter((r) => 'ownerReply' in r)).toHaveLength(239);
    expect(snapshot.reviews.find((r) => r.name === 'Anju Subba')).toMatchObject({ rating: 3, comment: '' });
    expect(snapshot.reviews.find((r) => r.name === 'Nupur Kothari')).toMatchObject({ ownerReply: 'Thanks for your valuable feedback ❤️😍' });
  });
});