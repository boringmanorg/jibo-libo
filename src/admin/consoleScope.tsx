import { createContext, useContext } from 'react';
import { getRouteApi, useRouterState } from '@tanstack/react-router';

export const HOSTEL_ID = 'XTSY-SHL-HOSTEL';
export const HOSTEL_CONSOLE_PATHS = ['/admin', '/admin/inventory', '/admin/inbox', '/admin/check-in', '/admin/stays', '/admin/room-photos', '/admin/property', '/admin/booking-engine', '/admin/bookings', '/admin/live', '/admin/guest-folio', '/admin/invoices', '/admin/sales-invoices', '/admin/form-c'] as const;
export function hostelConsolePath(path: string): boolean {
  return HOSTEL_CONSOLE_PATHS.some((p) => path === p || (['/admin/bookings', '/admin/invoices', '/admin/sales-invoices', '/admin/guest-folio'].includes(p) && path.startsWith(`${p}/`)));
}
/** Presentation only. Server middleware and RLS are authoritative. */
export const ConsoleScopeContext = createContext<'super' | 'hostel'>('hostel');
export const useConsoleScope = () => useContext(ConsoleScopeContext);
export type ConsoleAccess = 'admin' | 'property' | 'desk';
export const ConsoleAccessContext = createContext<ConsoleAccess>('desk');
export const useConsoleAccess = () => useContext(ConsoleAccessContext);
/** The one property a non-super login is tied to (hostel admin, or a front desk's own property). */
export const ConsolePropertyLock = createContext<string | undefined>(undefined);
export function useConsoleProperty() {
  const { property } = getRouteApi('/(admin)/admin').useSearch();
  const scope = useConsoleScope();
  const lock = useContext(ConsolePropertyLock);
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, '') });
  if (lock) return lock as typeof HOSTEL_ID;
  return scope === 'hostel' ? HOSTEL_ID : property ?? (['/admin', '/admin/check-in', '/admin/inbox', '/admin/guest-folio', '/admin/live'].includes(path) ? undefined : HOSTEL_ID);
}
export function canManageProperty(isSuperAdmin: boolean, propertyId: string): boolean {
  return isSuperAdmin || [HOSTEL_ID, 'XTSY-SHL-SUITE'].includes(propertyId);
}
export function assertPropertyScope(isSuperAdmin: boolean, propertyId: string): void {
  if (!canManageProperty(isSuperAdmin, propertyId)) throw new Error('Forbidden: this account manages XTSY Travellers Hostel only.');
}
