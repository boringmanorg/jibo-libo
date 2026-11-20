/**
 * Console activity in plain sentences instead of raw action codes. Browser-safe.
 */
import { unitInfo, findProperty } from '@/integrations/xtsy-saas/catalogue';

type Details = Record<string, any> | null | undefined;

const fmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (iso?: string) => (iso ? fmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : '');
const range = (a?: string, b?: string) => (a && b && a !== b ? `${day(a)} – ${day(b)}` : day(a ?? b));

function roomName(d: Details): string {
  if (!d) return 'rooms';
  if (d.unitTypeId === '__all_stays__') return 'every property';
  if (d.unitTypeId === '__property__') return `all of ${findProperty(d.propertyId)?.name ?? 'the property'}`;
  return unitInfo(d.unitTypeId)?.name ?? d.unitTypeId ?? 'a room';
}

export function activitySentence(action: string, d: Details): string {
  switch (action) {
    case 'inventory.blocked': return `Closed ${d?.units ? `${d.units} of ` : ''}${roomName(d)} for ${range(d?.startDate, d?.endDate)}${d?.reason ? ` (${d.reason})` : ''}`;
    case 'inventory.open': return `Reopened ${roomName(d)} for ${range(d?.startDate, d?.endDate)}`;
    case 'inventory.remove': return 'Removed a block';
    case 'settings.update': return `Changed connection settings${d ? `: ${Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v ? 'on' : 'off'}`).join(', ')}` : ''}`;
    case 'pms.sync': return 'Synced rooms with the PMS';
    case 'tables.blocked': return `Closed TAB Bistro tables on ${day(d?.serviceDate)}`;
    case 'tables.open': return `Reopened TAB Bistro tables on ${day(d?.serviceDate)}`;
    default: return action.replace(/[._]/g, ' ');
  }
}
