import { createFileRoute } from "@tanstack/react-router";
import { articleSchema } from "@/lib/seo/pageEntitySchema";
import ShillongTourPackage from "@/pages/destinations/ShillongTourPackage";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/(tours)/tours/shillong-tour-package")({
  head: () =>
    buildRouteHead({
      path: "/tours/shillong-tour-package",
      jsonLd: [articleSchema({ path: "/tours/shillong-tour-package", headline: "Shillong Tour Package with Stay & Cab | XTSY", description: "Shillong tour packages including hostel or private stay, cab, guide and key sightseeing, priced per person with no hidden extras. Book direct with XTSY." })],
      title: "Shillong Tour Package with Stay & Cab | XTSY",
      description:
        "Shillong tour packages including hostel or private stay, cab, guide and key sightseeing, priced per person with no hidden extras. Book direct with XTSY.",
    }),
  component: ShillongTourPackage,
});
