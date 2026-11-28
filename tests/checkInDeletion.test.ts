import { describe, expect, it } from 'vitest';
import { checkInDeletionProblem } from '@/checkin/checkInDeletion';

const unallocated = { allocatedUnits: [], allocationOverrideId: null };

describe('self check-in deletion', () => {
  it('allows the property admin before room allocation', () => {
    expect(checkInDeletionProblem(unallocated, 'property_admin')).toBeNull();
  });

  it('allows the property admin after the room allocation is released', () => {
    expect(checkInDeletionProblem({ allocatedUnits: [], allocationOverrideId: null }, 'property_admin')).toBeNull();
  });

  it('allows the super admin to delete an unallocated check-in', () => {
    expect(checkInDeletionProblem(unallocated, 'super')).toBeNull();
  });

  it('refuses front-desk deletion', () => {
    expect(checkInDeletionProblem(unallocated, 'front_desk')).toMatch(/property admin or super admin/);
  });

  it('refuses deletion while beds or rooms are allocated', () => {
    expect(checkInDeletionProblem({ allocatedUnits: ['8A'], allocationOverrideId: null }, 'property_admin')).toMatch(/Release the room allocation/);
  });

  it('refuses deletion while an inventory hold remains', () => {
    expect(checkInDeletionProblem({ allocatedUnits: [], allocationOverrideId: '6f1c5a8e-0000-4000-8000-000000000001' }, 'property_admin')).toMatch(/Release the room allocation/);
  });
});
