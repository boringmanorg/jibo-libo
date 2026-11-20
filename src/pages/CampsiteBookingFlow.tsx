/**
 * /book/campsite — Shnonpedeng riverside camping (an XTSY franchise accommodation partner),
 * booked through the XTSY desk on WhatsApp. Same panel as /book?location=shnonpedeng.
 */
import { PageShell } from '@/components/v2/blocks';
import CampBooking from '@/components/booking/engine/CampBooking';
import type { ClosureRow } from '@/booking/consoleClosures';

export default function CampsiteBookingFlow({ closures = [] }: { closures?: ClosureRow[] }) {
  return (
    <PageShell cta={false} bar={false}>
      <CampBooking closures={closures} />
    </PageShell>
  );
}
