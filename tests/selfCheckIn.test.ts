import { describe, expect, it } from 'vitest';
import { CAMP } from '@/data/shnonpedengCamp';
import { CHECK_IN_POLICY_VERSION, checkInPolicies, roomPreferences, validateCheckInDetails } from '@/checkin/checkInModel';
import { checkInTokenHash, identityFileProblem } from '@/checkin/checkIn.server';

const valid = {
  propertyId: 'XTSY-SHL-HOSTEL', bookingReference: '', guestName: 'Asha Sharma', checkInDate: '2026-12-01', checkInTime: '11:00',
  city: 'Guwahati', state: 'Assam', country: 'India', phone: '+91 98765 43210', email: 'asha@example.com', totalGuests: 1,
  purpose: 'Leisure', isInternational: false, roomTypeId: 'bed-in-8-bed-mixed-dormitory', policyAccepted: true, policyVersion: CHECK_IN_POLICY_VERSION,
  checkOutDate: '2026-12-02', checkOutTime: '10:00', emergencyName: 'Ravi Sharma', emergencyPhone: '+91 98765 00000', referralSource: 'Instagram', guests: [],
} as const;

const file = (bytes: number[], type: string) => new File([new Uint8Array(bytes)], 'document', { type });

describe('self check-in details and property policies', () => {
  it('uses the approved campsite name and keeps camp and hostel room preferences separate', () => {
    expect(CAMP.name).toBe('Shnonpedeng Riverside Camping by XTSY');
    expect(roomPreferences('XTSY-SHN-CAMP').map((r) => r.id)).toEqual(['tent', 'bed']);
    expect(roomPreferences('XTSY-SHL-HOSTEL')).toHaveLength(7);
    expect(() => validateCheckInDetails({ ...valid, roomTypeId: 'tent' })).toThrow(/offered by this property/);
  });

  it('shows the supplied hostel Wi-Fi password, Bistro hours and explicit no-refund policy', () => {
    const text = checkInPolicies('XTSY-SHL-HOSTEL').flatMap((p) => p.lines).join(' ');
    expect(text).toContain('Wi-Fi password: xtsy.one');
    expect(text).toContain('8:45 AM – 12 PM');
    expect(text).toContain('No refund on cancellation, for any reason.');
    expect(text).toContain('expulsion without refund');
    expect(text).toContain('allocates the actual room');
  });

  it('does not imply TAB Bistro or the hostel Wi-Fi runs at the camp', () => {
    const text = checkInPolicies('XTSY-SHN-CAMP').flatMap((p) => p.lines).join(' ');
    expect(text).toContain('does not operate the camp kitchen');
    expect(text).toContain('hostel Wi-Fi password does not apply');
    expect(text).not.toContain('Wi-Fi password: xtsy.one');
  });
});

describe('identity document validation', () => {
  it('requires both ID sides for domestic guests', async () => {
    expect(await identityFileProblem(null, true)).toMatch(/missing/);
    expect(await identityFileProblem(null, false)).toBeNull();
  });

  it('accepts genuine JPG, PNG, WebP and PDF signatures and rejects renamed content', async () => {
    expect(await identityFileProblem(file([0xff, 0xd8, 0xff, 0xe0], 'image/jpeg'))).toBeNull();
    expect(await identityFileProblem(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'))).toBeNull();
    expect(await identityFileProblem(file([...new TextEncoder().encode('RIFF1234WEBP')], 'image/webp'))).toBeNull();
    expect(await identityFileProblem(file([...new TextEncoder().encode('%PDF-1.7')], 'application/pdf'))).toBeNull();
    expect(await identityFileProblem(file([...new TextEncoder().encode('not a pdf')], 'application/pdf'))).toMatch(/contents/);
  });

  it('stores only a one-way hash of the guest receipt token', () => {
    expect(checkInTokenHash('private-token')).toMatch(/^[a-f0-9]{64}$/);
    expect(checkInTokenHash('private-token')).not.toContain('private-token');
  });
});
