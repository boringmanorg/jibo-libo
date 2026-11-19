/** Shared pieces for the booking-engine console pages. */
import { Card, CardContent } from '@/components/ui/card';
import { formatInr } from '@/booking/money';

export const selectCls = 'h-12 w-full rounded-md border border-input bg-background px-3 text-base';
export const inr = (paise: number | string) => formatInr(Number(paise));
export const MIGRATION_FILE = 'supabase/migrations/20261119140000_booking_engine_tables.sql';

export function NotSetUp() {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="space-y-2 p-5 text-sm">
        <p className="font-medium">The booking database is not set up yet.</p>
        <p className="text-muted-foreground">Apply <code className="rounded bg-muted px-1">{MIGRATION_FILE}</code> to the website's database. These pages fill in as soon as the tables exist; nothing else on the site is affected.</p>
      </CardContent>
    </Card>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  held: 'Held (awaiting payment)', confirmed: 'Confirmed', checked_in: 'Checked in', settled: 'Settled',
  cancelled_by_guest: 'Cancelled by guest', cancelled_by_xtsy: 'Cancelled by XTSY', expired: 'Expired',
};
