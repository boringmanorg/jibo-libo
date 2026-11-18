import { createFileRoute } from "@tanstack/react-router";
import { infoPageSchema } from "@/lib/seo/pageEntitySchema";
import TermsOfService from "@/pages/TermsOfService";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(company)/about/terms-of-service")({
  head: () =>
    buildRouteHead({
      path: "/about/terms-of-service",
      jsonLd: [infoPageSchema({ path: "/about/terms-of-service", name: "Terms of Service | XTSY Travellers Hostel Shillong", description: "Booking terms and conditions for XTSY Travellers Hostel, tours and TAB Bistro — cancellation policy, payment rules, check-in times and guest guidelines." })],
      title: "Terms of Service | XTSY Travellers Hostel Shillong",
      description:
        "Booking terms and conditions for XTSY Travellers Hostel, tours and TAB Bistro — cancellation policy, payment rules, check-in times and guest guidelines.",
      keywords: "XTSY terms, booking terms, cancellation policy, hostel rules Shillong",
    }),
  component: TermsOfService,
});
