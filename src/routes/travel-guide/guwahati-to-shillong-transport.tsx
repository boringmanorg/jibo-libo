import { createFileRoute } from "@tanstack/react-router";
import GuwahatiToShillongTransport from "@/pages/GuwahatiToShillongTransport";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/travel-guide/guwahati-to-shillong-transport")({
  head: () =>
    buildRouteHead({
      path: "/travel-guide/guwahati-to-shillong-transport",
      title: "Guwahati to Shillong: Shared Taxi, Cab & Bus Guide | XTSY",
      description:
        "Compare Guwahati–Shillong shared taxis, private cabs and buses: pickup points, indicative fares, journey times and onward travel to New Shillong.",
      ogType: "article",
    }),
  component: GuwahatiToShillongTransport,
});
