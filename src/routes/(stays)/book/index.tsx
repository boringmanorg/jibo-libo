import PropertyOverview, { usePublicPropertyProfile } from "@/components/booking/PropertyOverview";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import StayEngine from "@/components/booking/engine/StayEngine";
import { PageShell } from "@/components/v2/blocks";
import { z } from "zod";
import { BOOK_PAGE_PENDING, loadBookPageData, rememberBookPageData, type BookPageData } from "@/booking/bookPageLoader";
import type { IsoDate } from "@/booking/dates";
import { buildRouteHead } from "@/lib/seo-head";
import { inr, roomPrice } from "@/components/v2/pricing";
import { PANORAMA_STAY_ONLY } from "@/data/panoramaPricing";
import { IMG } from "@/data/v2Images";
import { responsiveImage } from "@/data/cdnImages";

const bookHero = responsiveImage(IMG.property[0]);

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
      // Start the first property photo during HTML parse, sized for the phone.
      ...(bookHero ? { preloadImage: bookHero.src, preloadImageSrcSet: bookHero.srcSet, preloadImageSizes: "(max-width: 768px) 100vw, 50vw" } : {}),
    }),
  // Online payment appears only when the console's launch gate allows it (channel manager connected,
  // rooms mapped, payment and bot-check keys saved, switch on). Until then, and on any error,
  // the same page runs from the static catalogue and ends in a WhatsApp enquiry.
  // A paused Cloud database must not hold the page: after 4.5 s guests get the enquiry page with
  // the built-in photos.
  // The server sends the page without waiting for the database (it took ~1 s); the browser asks for
  // the live counts as soon as the page starts (see BookPage).
  loader: () => (import.meta.env.SSR ? BOOK_PAGE_PENDING : loadBookPageData()),
  component: BookPage,
});

function BookPage() {
  const routeData = Route.useLoaderData();
  // Server-sent page: the live counts are fetched here, straight after the page starts.
  const [fetched, setFetched] = useState<BookPageData | null>(null);
  useEffect(() => {
    if (!routeData.pending) return;
    let gone = false;
    void loadBookPageData().then((d) => { if (!gone) setFetched(d); });
    return () => { gone = true; };
  }, [routeData]);
  const data = routeData.pending ? (fetched ?? routeData) : routeData;
  const { live, photos, closures, sheet } = data;
  useEffect(() => { rememberBookPageData(data); }, [data]);
  const router = useRouter();
  // Live updates come from the sitewide listener in the root layout; this also refreshes
  // when a guest returns to the tab. No timers run while nothing changes.
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') void router.invalidate(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [router]);
  const { location, checkIn, checkOut } = Route.useSearch();
  const profile = usePublicPropertyProfile("XTSY-SHL-HOSTEL");
  // Site header (logo, menu) and footer around the booking page; the page has its own bottom bar.
  return (
    <PageShell cta={false} bar={false}>
      <StayEngine hiddenRooms={profile.data?.hiddenRoomTypes} mode={live ? "live" : "enquiry"} pending={!!data.pending} photos={photos} closures={closures} sheet={sheet} pricing={data.pricing} initialLocation={location} initialDates={checkIn && checkOut ? { checkIn: checkIn as IsoDate, checkOut: checkOut as IsoDate } : undefined} />
      <PropertyOverview propertyId="XTSY-SHL-HOSTEL" />
    </PageShell>
  );
}
