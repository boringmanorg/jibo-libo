import { createFileRoute } from "@tanstack/react-router";
import { collectionSchema } from "@/lib/seo/pageEntitySchema";
import PartnerStays from "@/pages/v2/PartnerStaysV2";
import { buildRouteHead } from "@/lib/seo-head";

export const Route = createFileRoute("/partner-stays")({
  head: () =>
    buildRouteHead({
      path: "/partner-stays",
      jsonLd: [collectionSchema({ path: "/partner-stays", name: "Become an XTSY Partner Stay in Meghalaya | XTSY", description: "Run a homestay or guest house in Sohra, Tyrna, Dawki or elsewhere in the Northeast? Host XTSY guests and group trips. See what we look for and apply." })],
      title: "Become an XTSY Partner Stay in Meghalaya | XTSY",
      description:
        "Run a homestay or guest house in Sohra, Tyrna, Dawki or elsewhere in the Northeast? Host XTSY guests and group trips. See what we look for and apply.",
    }),
  component: PartnerStays,
});
