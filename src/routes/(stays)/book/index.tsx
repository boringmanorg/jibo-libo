import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSheetDoorbell } from "@/hooks/useSheetDoorbell";
import StayEngine from "@/components/booking/engine/StayEngine";
import { PageShell } from "@/components/v2/blocks";
import { z } from "zod";
import { loadBookPageData } from "@/booking/bookPageLoader";
import type { IsoDate } from "@/booking/dates";
import { buildRouteHead } from "@/lib/seo-head";
import { inr, roomPrice } from "@/components/v2/pricing";
import { PANORAMA_STAY_ONLY } from "@/data/panoramaPricing";

export const Route = createFileRoute("/(stays)/book/")({
  // "dawki" is kept as an alias so older links land on the Shnonpedeng camp.
  validateSearch: z.object({
    location: z.enum(["new-shillong", "shnonpedeng", "dawki"]).optional().transform((l) => (l === "dawki" ? "shnonpedeng" : l)),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  }),
  head: () =>
    buildRouteHead({
      path: "/book",
      noIndex: true,
      noIndexFollow: true,
      title: "Hostel Booking Shillong — Book Dorms & Rooms Online | XTSY",
      description:
        `Book XTSY in New Shillong Township: dorms from ${inr(roomPrice("8-bed-mixed-dorm").now)}, King Double ${inr(roomPrice("king-double-room").now)}, Experience by XTSY ${inr(PANORAMA_STAY_ONLY)}. Check-in 11 AM, check-out 10 AM.`,
      keywords:
        "hostel booking, online hostel booking, book hostel shillong, dorm booking shillong, hostel booking meghalaya",
    }),
  // Online payment appears only when the console's launch gate allows it (STAAH connected,
  // rooms mapped, payment and bot-check keys saved, switch on). Until then, and on any error,
  // the same page runs from the static catalogue and ends in a WhatsApp enquiry.
  // A paused Cloud database must not hold the page: after 1.5 s guests get the enquiry page with
  // the built-in photos.
  loader: () => loadBookPageData(),
  component: BookPage,
});

function BookPage() {
  const { live, photos, closures, sheet } = Route.useLoaderData();
  // Live availability refreshes only when the Google Sheet actually syncs (backend doorbell),
  // and when a guest returns to the tab. No timers run while nothing changes.
  const router = useRouter();
  useSheetDoorbell(() => { if (document.visibilityState === 'visible') void router.invalidate(); });
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') void router.invalidate(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [router]);
  const { location, checkIn, checkOut } = Route.useSearch();
  // Site header (logo, menu) and footer around the booking page; the page has its own bottom bar.
  return (
    <PageShell cta={false} bar={false}>
      <StayEngine mode={live ? "live" : "enquiry"} photos={photos} closures={closures} sheet={sheet} initialLocation={location} initialDates={checkIn && checkOut ? { checkIn: checkIn as IsoDate, checkOut: checkOut as IsoDate } : undefined} />
    </PageShell>
  );
}
