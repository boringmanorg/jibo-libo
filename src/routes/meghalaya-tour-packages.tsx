import { createFileRoute } from "@tanstack/react-router";
import MeghalayaTourPackages from "@/pages/destinations/MeghalayaTourPackages";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/meghalaya-tour-packages")({
  head: () =>
    buildRouteHead({
      path: "/meghalaya-tour-packages",
      title: "Meghalaya Tour Package: Saturday Group 4N/5D ₹10,000 | XTSY",
      description:
        "Meghalaya group tour, 4N/5D for ₹10,000 per person on the 1st and 3rd Saturday: XTSY hostel stay, Dawki camping, transport and breakfast. Enquire today.",
      keywords:
        "Meghalaya tour package, Meghalaya adventure tour, adventure tours in Northeast India, Shillong tour, Cherrapunji tour, Dawki trip",
    }),
  component: MeghalayaTourPackages,
});
