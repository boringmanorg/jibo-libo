import { createFileRoute } from "@tanstack/react-router";
import MeghalayaTourPackages from "@/pages/destinations/MeghalayaTourPackages";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/meghalaya-tour-packages")({
  head: () =>
    buildRouteHead({
      path: "/meghalaya-tour-packages",
      title: "Meghalaya Tour Package: Saturday Group 4D/3N ₹9,000 | XTSY",
      description:
        "Meghalaya group tour, 4D/3N for ₹9,000 per person, 1st and 3rd Saturday: Guwahati pickup, Shillong hostel stay, Cherrapunji and Jowai, transport and breakfast.",
      keywords:
        "Meghalaya tour package, Meghalaya adventure tour, adventure tours in Northeast India, Shillong tour, Cherrapunji tour, Jowai tour, Guwahati to Shillong tour",
    }),
  component: MeghalayaTourPackages,
});
