/** Who may manage which console login. Browser-safe and pure (tests/teamRules.test.ts). */
export const TEAM_PROPERTIES = ['XTSY-SHL-HOSTEL', 'XTSY-SHN-CAMP'] as const;
export type TeamPropertyId = (typeof TEAM_PROPERTIES)[number];
export type TeamRole = 'property_admin' | 'front_desk';

/**
 * Super admin: front desk anywhere, property admins for the hostel (other properties have no
 * console operations yet). Hostel property admin: front desk of the hostel only.
 */
export function canManageMember(isSuperAdmin: boolean, propertyId: string, role: TeamRole): boolean {
  if (isSuperAdmin) return role === 'front_desk' || propertyId === 'XTSY-SHL-HOSTEL';
  return propertyId === 'XTSY-SHL-HOSTEL' && role === 'front_desk';
}

export function isInternalEmail(email: string): boolean {
  return /^[a-z0-9._%+-]+@xtsy\.one$/i.test(email.trim());
}

/** Console pages a front-desk login may open. */
export const DESK_PATHS = ['/admin/check-in'] as const;
