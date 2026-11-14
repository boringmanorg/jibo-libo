import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { buildRouteHead } from "@/lib/seo-head";
import { HOSTEL_SCHEMA } from "@/data/siteSchemas";
import { HERO_IMAGE } from "@/data/v2Images";
import { responsive } from "@/components/v2/primitives";

const hero = responsive(HERO_IMAGE.src);

export const Route = createFileRoute("/")({
  head: () =>
    buildRouteHead({
      path: "/",
      title: "XTSY Travellers Hostel, New Shillong | Dorms & Stays",
      description:
        "XTSY in New Shillong Township: mixed and women-only dorms, King Double rooms, Experience by XTSY glass suite and TAB Bistro on site.",
      keywords:
        "best hostel in Shillong, hostel in Shillong, hostels in Shillong, budget-friendly hostel Shillong, budget stay Shillong, dorm in Shillong, backpacker hostel Meghalaya",
      // Preload the real hero photo (responsive WebP) so it is the first image the browser fetches.
      preloadImage: hero?.src ?? HERO_IMAGE.src,
      image: hero?.src ?? HERO_IMAGE.src,
      preloadImageSrcSet: hero?.srcSet,
      preloadImageSizes: hero ? "100vw" : undefined,
      // Typed AVIF preload: browsers without AVIF skip it and use the WebP <source>.
      preloadMobile: { href: HERO_IMAGE.mobile.avifSrc, srcSet: HERO_IMAGE.mobile.avifSrcSet, sizes: "100vw", type: "image/avif" },
      jsonLd: [HOSTEL_SCHEMA],
    }),
  component: Index,
});
