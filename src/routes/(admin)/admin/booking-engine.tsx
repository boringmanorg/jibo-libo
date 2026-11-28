import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { PropertySetup } from '@/admin/components/PropertySetupPanel';
import { BookingEngine } from '@/admin/components/OnlineBookingPanel';
import { useConsoleAccess, useConsoleProperty } from '@/admin/consoleScope';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/(admin)/admin/booking-engine')({ validateSearch: z.object({ tab: z.string().max(12).optional() }), component: BookingConfig });

/** Booking Config: property details for /book, plus online payment settings (super admin, hostel). */
function BookingConfig() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const access = useConsoleAccess();
  const property = useConsoleProperty() ?? 'XTSY-SHL-HOSTEL';
  const canOnline = access === 'admin' && property === 'XTSY-SHL-HOSTEL';
  const current = canOnline && tab === 'online' ? 'online' : 'property';
  return <div className="space-y-4">
    {canOnline && <div role="tablist" aria-label="Booking Config" className="inline-flex rounded-full border border-xt-line bg-white p-1">
      {([['property', 'Property'], ['online', 'Online booking & payments']] as const).map(([v, label]) => <button key={v} type="button" role="tab" aria-selected={v === current}
        onClick={() => void navigate({ search: (prev) => ({ ...prev, tab: v }), replace: true })}
        className={cn('min-h-[44px] rounded-full px-5 text-sm font-bold', v === current ? 'bg-xt-ink text-xt-sand' : 'text-xt-mute')}>{label}</button>)}
    </div>}
    {current === 'property' ? <PropertySetup /> : <BookingEngine />}
  </div>;
}

