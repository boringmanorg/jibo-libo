import { createFileRoute } from "@tanstack/react-router";
import CityHub from "@/pages/destinations/CityHub";
import { buildRouteHead } from "@/lib/seo-head";
import { fitTitle } from "@/lib/seo/fitTitle";
import { getStateBySlug, getCityBySlug } from "@/data/neTaxonomy";
import { NEARBY_ADVENTURES } from "@/data/nearbyAdventures";
import { describePage } from "@/lib/seo/metadataText";

export const Route = createFileRoute("/destinations/$state/$city/")({
  head: ({ params }) => {
    const state = getStateBySlug(params.state);
    const city = getCityBySlug(params.state, params.city);
    const hasNearby = (params.state === "assam" || params.state === "meghalaya") && Boolean(NEARBY_ADVENTURES[params.city]);
    const short = city?.name.replace(/\s*\(.*?\)\s*/g, "").trim();
    const title = city
      ? fitTitle([
          `Places to Visit in ${city.name}, ${state?.name} | XTSY`,
          `Places to Visit in ${short}, ${state?.name} | XTSY`,
          `Places to Visit in ${short} | XTSY`,
        ])
      : "Places to Visit in Northeast India | XTSY";
    return buildRouteHead({
      path: `/destinations/${params.state}/${params.city}`,
      title,
      description:
        city ? describePage(city.blurb, `Plan ${city.name} routes, nearby places and onward trips with the XTSY desk in New Shillong.`) :
        "Attractions, viewpoints and day trips around Northeast India base towns.",
      keywords: hasNearby ? `adventure activities near ${city?.name}, adventures near me ${city?.name}, ${city?.name} day trips` : undefined,
      noIndex: !city,
    });
  },
  component: CityHub,
});
