/** Property admins may remove an unallocated check-in; an allocated stay must be released first. */
export type CheckInDeleteRole = 'super' | 'property_admin' | 'front_desk';

export function checkInDeletionProblem(
  row: { allocatedUnits?: string[]; allocationOverrideId?: string | null },
  role: CheckInDeleteRole,
): string | null {
  if (role === 'front_desk') return 'Only the property admin or super admin can delete a check-in.';
  if (row.allocationOverrideId || (row.allocatedUnits?.length ?? 0) > 0) {
    return 'Release the room allocation before deleting this check-in.';
  }
  return null;
}
