/** Pieces shared by the stay booking page and its guest-details step. */
import { createContext, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { IsoDate } from '@/booking/dates';
import type { SmartRule } from '@/booking/smartPricing';
import type { ClosureRow } from '@/booking/consoleClosures';
import type { SheetAvailability } from '@/booking/sheetAvailability';
import type { RoomResult } from '@/booking/publicEngine.core';

/** Counts and smart-pricing rules for enquiry-mode quotes in the summary/checkout steps. */
export const QuoteInputs = createContext<{ closures?: ClosureRow[]; sheet?: SheetAvailability; pricing?: SmartRule[] }>({});
export type Cart = Record<string, { units: number; guests: number }>;
export type QuoteData = Awaited<ReturnType<typeof import('@/booking/publicEngine.core').quoteCheckout>>;
export type Line = { room?: RoomResult; units: number; guests: number };
export type EngineMode = 'live' | 'preview' | 'enquiry';

const utc = (d: IsoDate) => new Date(`${d}T00:00:00Z`);
const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const day = (d: IsoDate) => dayFmt.format(utc(d));
export const date = (d: IsoDate) => dateFmt.format(utc(d));
export const longDate = (d: IsoDate) => longDateFmt.format(utc(d));
export const nightsLabel = (n: number) => `${n} night${n === 1 ? '' : 's'}`;

export function XtDialog({ open, onOpenChange, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('rounded-[28px] border-xt-line bg-xt-sand font-[Manrope,system-ui,sans-serif] text-xt-ink', className)}>{children}</DialogContent>
    </Dialog>
  );
}

