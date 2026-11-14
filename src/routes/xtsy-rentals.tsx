import { createFileRoute } from "@tanstack/react-router";
import XTSYRentals from "@/pages/v2/RentalsV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/xtsy-rentals")({
  head: () =>
    buildRouteHead({
      path: "/xtsy-rentals",
      title: "Car & Bike Rentals in Assam & Meghalaya | XTSY",
      description:
        "Explore XTSY car and bike rentals for Assam and Meghalaya, including Guwahati and Shillong. View vehicles, listed rates and enquire on WhatsApp.",
      keywords: "car rental Assam, car rental Meghalaya, bike rental Shillong, self drive Guwahati, XTSY rentals",
    }),
  component: XTSYRentals,
});
