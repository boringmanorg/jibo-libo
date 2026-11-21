import { createFileRoute } from "@tanstack/react-router";
import DestinationWeddingShillong from "@/pages/v2/WeddingsV2";
import { buildRouteHead } from "@/lib/seo-head";
import { COVERS } from "@/data/v2Images";
import { responsiveImage } from "@/data/cdnImages";

const hero = responsiveImage(COVERS.wedding);

export const Route = createFileRoute("/(tours)/tours/destination-wedding-shillong")({
  head: () =>
    buildRouteHead({
      path: "/tours/destination-wedding-shillong",
      title: "Destination Wedding Venue in Shillong | XTSY",
      description:
        "Host an intimate destination wedding in Shillong with XTSY: mountain-view venues, group accommodation, TAB Bistro catering and full event coordination.",
      ...(hero ? { preloadImage: hero.src, preloadImageSrcSet: hero.srcSet, preloadImageSizes: "(max-width: 768px) 100vw, 50vw" } : {}),
    }),
  component: DestinationWeddingShillong,
});
