import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import MeghalayaCoupleTourPackage from "@/pages/destinations/MeghalayaCoupleTourPackage";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/meghalaya-couple-tour-package")({
  head: () =>
    buildRouteHead({
      path: "/meghalaya-couple-tour-package",
      jsonLd: [articleSchema({ path: "/meghalaya-couple-tour-package", headline: "Meghalaya Couple Tour Package | XTSY Travel", description: "Romantic Meghalaya packages for couples: root bridges, Dawki boating, private cabs and a stay at Experience by XTSY, with transparent per-couple pricing." })],
      title: "Meghalaya Couple Tour Package | XTSY Travel",
      description:
        "Romantic Meghalaya packages for couples: root bridges, Dawki boating, private cabs and a stay at Experience by XTSY, with transparent per-couple pricing.",
    }),
  component: MeghalayaCoupleTourPackage,
});
