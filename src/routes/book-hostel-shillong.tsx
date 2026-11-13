import { createFileRoute, redirect } from "@tanstack/react-router";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/book-hostel-shillong")({
  head: () =>
    buildRouteHead({
      path: "/book-hostel-shillong",
      title: "Book a Hostel in Shillong from Rs 399/Night | XTSY",
      description:
        "Book direct at XTSY Travellers Hostel Shillong. Mixed dorms from Rs 399, private rooms and Experience by XTSY, booked direct at the base rate.",
    }),
  beforeLoad: () => {
    // 301, not the router default of 307: this rename is permanent, and a 307
    // tells Google not to consolidate the old URL's ranking onto the new one.
    throw redirect({ to: "/hostel-booking", replace: true, statusCode: 301 });
  },
});
