import { createContext, useContext } from 'react';

export const HOSTEL_ID = 'XTSY-SHL-HOSTEL';
export const HOSTEL_CONSOLE_PATHS = ['/admin', '/admin/inventory', '/admin/inbox', '/admin/check-in', '/admin/stays', '/admin/room-photos', '/admin/bookings', '/admin/invoices', '/admin/form-c'] as const;
export function hostelConsolePath(path: string): boolean {
  return HOSTEL_CONSOLE_PATHS.some((p) => path === p || (['/admin/bookings', '/admin/invoices'].includes(p) && path.startsWith(`${p}/`)));
}
/** Presentation only. Server middleware and RLS are authoritative. */
export const ConsoleScopeContext = createContext<'super' | 'hostel'>('hostel');
export const useConsoleScope = () => useContext(ConsoleScopeContext);
export function canManageProperty(isSuperAdmin: boolean, propertyId: string): boolean {
  return isSuperAdmin || [HOSTEL_ID, 'XTSY-SHL-SUITE'].includes(propertyId);
}
export function assertPropertyScope(isSuperAdmin: boolean, propertyId: string): void {
  if (!canManageProperty(isSuperAdmin, propertyId)) throw new Error('Forbidden: this account manages XTSY Travellers Hostel only.');
}
