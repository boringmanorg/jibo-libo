/** Live insights definitions shared by the console page and the database count (be_live_funnel). */
export type Stage = 'view' | 'rooms' | 'details' | 'contacted';
/** "Now" = last step within this many minutes and not contacted. */
export const ACTIVE_MINUTES = 15;
/** Dropped = chose rooms or reached details, never contacted, quiet this long. */
export const DROP_MINUTES = 30;
/** The owner's clean-up button deletes steps older than this. */
export const RETAIN_DAYS = 90;

export interface PropertyFunnel {
  propertyId: string;
  now: { viewing: number; rooms: number; details: number };
  period: { visits: number; rooms: number; details: number; contacted: number; dropped: number };
  contactedRefs: string[];
}
