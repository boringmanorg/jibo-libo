/**
 * /book/campsite — Shnonpedeng riverside camping (an XTSY franchise accommodation partner),
 * booked through the XTSY desk on WhatsApp. Same panel as /book?location=shnonpedeng.
 */
import { PageShell } from '@/components/v2/blocks';
import CampBooking from '@/components/booking/engine/CampBooking';

export default function CampsiteBookingFlow() {
  return (
    <PageShell cta={false} bar={false}>
      <CampBooking />
    </PageShell>
  );
}
