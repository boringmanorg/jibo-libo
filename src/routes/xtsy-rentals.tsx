import { createFileRoute } from "@tanstack/react-router";
import XTSYRentals from "@/pages/v2/RentalsV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/xtsy-rentals")({
  head: () =>
    buildRouteHead({
      path: "/xtsy-rentals",
      title: "Assam & Meghalaya Car, Bike & Urbania Rentals | XTSY",
      description:
        "Browse self-drive cars, Royal Enfield bikes, a caravan and Force Urbania for Assam and Meghalaya. Compare daily rates and confirm availability on WhatsApp.",
      keywords: "car rental Assam, car rental Meghalaya, bike rental Shillong, self drive Guwahati, XTSY rentals",
    }),
  component: XTSYRentals,
});
