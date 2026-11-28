import { describe, expect, it } from 'vitest';
import { canManageMember, isInternalEmail } from '@/admin/teamRules';

describe('console team rules', () => {
  it('hostel admin may manage hostel front desk only', () => {
    expect(canManageMember(false, 'XTSY-SHL-HOSTEL', 'front_desk')).toBe(true);
    expect(canManageMember(false, 'XTSY-SHL-HOSTEL', 'property_admin')).toBe(false);
    expect(canManageMember(false, 'XTSY-SHN-CAMP', 'front_desk')).toBe(false);
  });
  it('super admin manages everyone it can scope safely', () => {
    expect(canManageMember(true, 'XTSY-SHL-HOSTEL', 'property_admin')).toBe(true);
    expect(canManageMember(true, 'XTSY-SHN-CAMP', 'front_desk')).toBe(true);
    expect(canManageMember(true, 'XTSY-SHN-CAMP', 'property_admin')).toBe(false);
  });
  it('logins must be internal xtsy.one emails', () => {
    expect(isInternalEmail('desk1@xtsy.one')).toBe(true);
    expect(isInternalEmail('someone@gmail.com')).toBe(false);
  });
});
